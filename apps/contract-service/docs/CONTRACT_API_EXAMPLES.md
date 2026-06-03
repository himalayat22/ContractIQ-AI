# Contract Service — API Examples

**Base URL (local):** `http://localhost:4002/api/v1`

All success responses use:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid-or-null", "timestamp": "2026-06-03T12:00:00.000Z" }
}
```

List responses also include `pagination`.

---

## POST `/contracts/upload`

Upload a PDF and store contract metadata.

**Content-Type:** `multipart/form-data`

### Form fields

| Field | Required | Example |
|-------|----------|---------|
| `file` | Yes | PDF binary (`application/pdf`) |
| `title` | Yes | `Vendor MSA - Acme Corp` |
| `counterparty` | Yes | `Acme Corp` |
| `contractType` | Yes | `nda` \| `msa` \| `sow` \| `employment` \| `vendor` \| `other` |
| `tenantId` | Yes | 24-char hex ObjectId |
| `createdBy` | Yes | 24-char hex ObjectId |
| `effectiveDate` | No | `2026-01-15` or ISO datetime |
| `expirationDate` | No | `2027-01-15` or ISO datetime |
| `tags` | No | `vendor,2026` (comma-separated) |

### Sample request (cURL)

```bash
curl -X POST "http://localhost:4002/api/v1/contracts/upload" \
  -H "X-Request-ID: test-upload-001" \
  -F "file=@./sample-contract.pdf;type=application/pdf" \
  -F "title=Vendor MSA - Acme Corp" \
  -F "counterparty=Acme Corp" \
  -F "contractType=msa" \
  -F "effectiveDate=2026-01-15" \
  -F "tags=vendor,2026" \
  -F "tenantId=674a1b2c3d4e5f6789012346" \
  -F "createdBy=674a1b2c3d4e5f6789012345"
```

### Sample response `201`

```json
{
  "success": true,
  "data": {
    "id": "674a1b2c3d4e5f6789012350",
    "tenantId": "674a1b2c3d4e5f6789012346",
    "title": "Vendor MSA - Acme Corp",
    "counterparty": "Acme Corp",
    "contractType": "msa",
    "status": "uploading",
    "riskScore": null,
    "riskLevel": null,
    "keyDates": [],
    "currentVersionId": "674a1b2c3d4e5f6789012351",
    "fileName": "sample-contract.pdf",
    "fileSize": 2048,
    "mimeType": "application/pdf",
    "versionNumber": 1,
    "effectiveDate": "2026-01-15T00:00:00.000Z",
    "expirationDate": null,
    "tags": ["vendor", "2026"],
    "createdBy": "674a1b2c3d4e5f6789012345",
    "createdAt": "2026-06-03T10:00:00.000Z",
    "updatedAt": "2026-06-03T10:00:00.000Z"
  },
  "meta": {
    "requestId": "test-upload-001",
    "timestamp": "2026-06-03T10:00:00.100Z"
  }
}
```

### Error `400` — missing file

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "PDF file is required",
    "details": []
  },
  "meta": { "requestId": null, "timestamp": "2026-06-03T10:00:00.000Z" }
}
```

---

## GET `/contracts`

List contracts (excludes soft-deleted).

### Query parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Max 100 |
| `status` | — | `uploading` \| `processing` \| `analyzed` \| `failed` |
| `contractType` | — | Contract type enum |
| `q` | — | Full-text search on title, counterparty, tags |

### Sample request

```bash
curl "http://localhost:4002/api/v1/contracts?page=1&limit=20&status=uploading"
```

### Sample response `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "674a1b2c3d4e5f6789012350",
      "tenantId": "674a1b2c3d4e5f6789012346",
      "title": "Vendor MSA - Acme Corp",
      "counterparty": "Acme Corp",
      "contractType": "msa",
      "status": "uploading",
      "riskScore": null,
      "riskLevel": null,
      "keyDates": [],
      "currentVersionId": "674a1b2c3d4e5f6789012351",
      "fileName": "sample-contract.pdf",
      "fileSize": 2048,
      "mimeType": "application/pdf",
      "versionNumber": 1,
      "effectiveDate": "2026-01-15T00:00:00.000Z",
      "expirationDate": null,
      "tags": ["vendor", "2026"],
      "createdBy": "674a1b2c3d4e5f6789012345",
      "createdAt": "2026-06-03T10:00:00.000Z",
      "updatedAt": "2026-06-03T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "meta": {
    "requestId": null,
    "timestamp": "2026-06-03T10:01:00.000Z"
  }
}
```

---

## GET `/contracts/:id`

Get one contract by MongoDB ObjectId.

### Sample request

```bash
curl "http://localhost:4002/api/v1/contracts/674a1b2c3d4e5f6789012350"
```

### Sample response `200`

Same shape as a single item in the list `data` array above.

### Error `404`

```json
{
  "success": false,
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "Contract not found",
    "details": []
  },
  "meta": { "requestId": null, "timestamp": "2026-06-03T10:02:00.000Z" }
}
```

---

## DELETE `/contracts/:id`

Soft-delete a contract and remove the local PDF file (best-effort).

### Sample request

```bash
curl -X DELETE "http://localhost:4002/api/v1/contracts/674a1b2c3d4e5f6789012350"
```

### Sample response `204`

No body.

After delete, `GET /contracts/:id` returns `404`.

---

## Postman

Import:

`apps/contract-service/postman/Contract-Service.postman_collection.json`

1. Set collection variables: `baseUrl`, `tenantId`, `createdBy`.
2. Attach a PDF as `sample-contract.pdf` in the upload request (or pick any file).
3. Run **Contracts** folder in order: Upload → List → Get by id → Delete.

Tests assert status codes and save `contractId` from the upload response automatically.
