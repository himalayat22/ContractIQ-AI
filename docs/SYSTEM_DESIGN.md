# ContractIQ AI — Technical Architecture Document

**Document Version:** 1.0  
**Date:** June 1, 2026  
**Status:** Draft  
**Parent Document:** [PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md)  
**Stack:** MERN + Microservices + RabbitMQ + MongoDB + Redis + S3

---

## Table of Contents

1. [Service Boundaries](#1-service-boundaries)
2. [Database Per Service](#2-database-per-service)
3. [API Contracts](#3-api-contracts)
4. [RabbitMQ Event Design](#4-rabbitmq-event-design)
5. [Queue Names](#5-queue-names)
6. [DTOs](#6-dtos)
7. [Folder Structures](#7-folder-structures)
8. [Shared Libraries](#8-shared-libraries)
9. [Security Architecture](#9-security-architecture)
10. [Deployment Strategy](#10-deployment-strategy)

---

## Document Conventions

| Symbol | Meaning |
|--------|---------|
| `ObjectId` | MongoDB 24-char hex string |
| `ISO8601` | UTC datetime string |
| `→` | Synchronous HTTP call |
| `⇢` | Async message (RabbitMQ) |
| `JWT` | JSON Web Token (access token) |

**API base URL (external):** `https://api.contractiq.ai/api/v1`  
**Internal service mesh:** `http://{service-name}.{namespace}.svc.cluster.local`

---

## 1. Service Boundaries

### 1.1 Bounded Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CLIENTS                                   │
│         React SPA  │  Mobile (future)  │  Partner API (Phase 2)              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
┌───────────────────────────────────▼─────────────────────────────────────────┐
│  API GATEWAY (BFF-lite)                                                      │
│  • JWT validation  • Rate limit  • Route proxy  • Correlation ID injection   │
│  • No business logic  • No database                                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
        │           │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼           ▼
   ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │  Auth  │ │  User  │ │ Contract │ │   AI   │ │ Search │ │ Notif  │
   │        │ │ Tenant │ │          │ │        │ │        │ │        │
   └────────┘ └────────┘ └──────────┘ └────────┘ └────────┘ └────────┘
        │           │           │           │           │           │
        └───────────┴───────────┴─────┬─────┴───────────┴───────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌────────────┐     ┌──────────┐
              │  Audit   │     │ Ingestion  │     │ Playbook │
              │          │     │  Worker    │     │ (Ph. 2)  │
              └──────────┘     └────────────┘     └──────────┘
                    │                 │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │    RabbitMQ     │
                    │  (Event Bus)    │
                    └─────────────────┘
```

### 1.2 Service Catalog & Ownership

| Service | Port (local) | Owns | Does NOT Own |
|---------|--------------|------|--------------|
| **api-gateway** | 4000 | Routing, auth middleware, rate limits | User data, contracts, AI logic |
| **auth-service** | 4001 | Credentials, sessions, refresh tokens, password reset, OAuth tokens | Organization profiles, contract ACLs |
| **user-service** | 4002 | Organizations, memberships, invites, user profiles, preferences | Authentication secrets |
| **contract-service** | 4003 | Contract CRUD, versions, metadata, presigned URLs, comments | Clause extraction, LLM calls |
| **ai-service** | 4004 | Analysis jobs, clauses, embeddings, Q&A, risk scoring | Contract file storage, user invites |
| **search-service** | 4005 | Search indexes, query execution | Source-of-truth contract documents |
| **notification-service** | 4006 | In-app notifications, email dispatch, templates | Business workflow state |
| **audit-service** | 4007 | Immutable audit log writes and queries | Mutating domain entities |
| **ingestion-worker** | — (consumer) | Text extraction, OCR trigger, chunk preparation | Persisting final analysis (delegates to AI) |
| **billing-service** | 4008 | Stripe webhooks, usage, plan limits (Phase 2) | Auth, contracts |
| **playbook-service** | 4009 | Playbook CRUD, deviation rules (Phase 2) | Running LLM analysis |

### 1.3 Boundary Rules (Enforcement)

| Rule | Description |
|------|-------------|
| **Database per service** | No service reads another service's MongoDB database directly |
| **API-only sync coupling** | Cross-service reads use internal REST/gRPC with service JWT |
| **Event-first side effects** | Notifications, audit, search indexing triggered via RabbitMQ, not inline HTTP chains |
| **Tenant context mandatory** | Every handler validates `tenantId` from JWT; never trust client-supplied tenant alone |
| **Idempotent consumers** | All RabbitMQ consumers use `eventId` deduplication (Redis SET, 24h TTL) |
| **Saga ownership** | Contract Service owns upload saga; AI Service owns analysis saga |

### 1.4 Service Interaction Matrix

| From → To | Auth | User | Contract | AI | Search | Notif | Audit |
|-----------|:----:|:----:|:--------:|:--:|:------:|:-----:|:-----:|
| Gateway | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auth | — | ✓ (create user) | — | — | — | ✓ (email) | ✓ |
| User | ✓ (verify) | — | — | — | — | ✓ | ✓ |
| Contract | ✓ | ✓ | — | ✓ | — | — | ✓ |
| AI | ✓ | — | ✓ | — | — | — | ✓ |
| Ingestion | — | — | ✓ | ✓ | — | — | ✓ |
| Search | — | — | — | — | — | — | ✓ |
| Notif | — | ✓ (prefs) | — | — | — | — | ✓ |

### 1.5 Upload & Analysis Saga (Orchestration)

**Owner:** Contract Service (choreography via events)

| Step | Actor | Action | Compensation on Failure |
|------|-------|--------|---------------------------|
| 1 | Contract Service | Create `contract` + `version`, status `uploading` | Delete contract record |
| 2 | Contract Service | Issue presigned S3 URL | — |
| 3 | Client | Upload file to S3 | TTL cleanup job deletes orphan objects |
| 4 | Contract Service | `POST /complete` → status `processing`, publish `contract.upload.completed` | Revert status, delete S3 key |
| 5 | Ingestion Worker | Extract text, update `contract_versions.extractedText` | Publish `contract.ingestion.failed` |
| 6 | AI Service | Run pipeline, persist analysis/clauses | Publish `contract.analysis.failed`, max 3 retries |
| 7 | Contract Service | Consume `contract.analysis.completed`, denormalize risk fields | — |
| 8 | Search Service | Index document | Retry via DLQ |
| 9 | Notification Service | Notify uploader | Fire-and-forget |

---

## 2. Database Per Service

### 2.1 Strategy

| Principle | Implementation |
|-----------|----------------|
| **Logical isolation** | Separate MongoDB database per microservice on shared Atlas cluster (MVP) |
| **Physical isolation (Enterprise)** | Dedicated cluster per tenant tier (Phase 3) |
| **Naming** | `contractiq_{service}_{env}` e.g. `contractiq_auth_prod` |
| **Cross-service references** | Store foreign IDs only; no cross-DB joins |
| **Denormalization** | Contract Service holds cached `riskScore`, `riskLevel` from AI events |
| **Migrations** | `migrate-mongo` per service repository |

### 2.2 Database Allocation

| Service | MongoDB Database | Collections | Notes |
|---------|------------------|-------------|-------|
| **auth-service** | `contractiq_auth` | `users`, `sessions`, `refresh_tokens`, `password_reset_tokens`, `oauth_accounts` | `users` holds auth fields only; profile in user-service |
| **user-service** | `contractiq_user` | `organizations`, `memberships`, `user_profiles`, `invites`, `notification_preferences` | Source of truth for tenant |
| **contract-service** | `contractiq_contract` | `contracts`, `contract_versions`, `comments` | Large `extractedText` may move to GridFS Phase 2 |
| **ai-service** | `contractiq_ai` | `analyses`, `clauses`, `embedding_chunks`, `qa_sessions`, `qa_messages`, `ai_usage_logs` | Vector index on `embedding_chunks` |
| **search-service** | `contractiq_search` | `search_documents` | Denormalized index docs; or Elasticsearch index `contractiq-search-{env}` |
| **notification-service** | `contractiq_notification` | `notifications`, `email_outbox`, `email_templates` | Outbox pattern for reliable email |
| **audit-service** | `contractiq_audit` | `audit_logs` | Append-only; no updates/deletes |
| **billing-service** | `contractiq_billing` | `subscriptions`, `usage_counters`, `stripe_events`, `api_keys` | Phase 2 |
| **playbook-service** | `contractiq_playbook` | `playbooks`, `clause_rules` | Phase 2 |

### 2.3 Shared Infrastructure Datastores

| Store | Used By | Purpose |
|-------|---------|---------|
| **Redis** | All services | Idempotency keys, rate limit counters, session cache, Bull optional |
| **S3 / MinIO** | Contract, Ingestion, AI | Raw files (`tenants/{tenantId}/contracts/{contractId}/{versionId}`) |
| **RabbitMQ** | All publishers/consumers | Domain events and work queues |
| **Elasticsearch** (optional) | Search Service | Full-text if not using Atlas Search |

### 2.4 Cross-Service Data Duplication

| Field | Authoritative Source | Replicated In |
|-------|---------------------|---------------|
| `user.email` | auth-service.users | user-service.user_profiles |
| `organization.name` | user-service.organizations | search-service.search_documents |
| `contract.title`, `riskScore` | contract-service.contracts | search-service.search_documents |
| `analysis.summary` | ai-service.analyses | — (read via AI API) |

**Sync mechanism:** RabbitMQ events (see Section 4); eventual consistency ≤ 5 seconds (p95).

### 2.5 Index Standards (All Services)

Every tenant-scoped collection MUST include:

```
{ tenantId: 1, _id: 1 }           // Point lookups
{ tenantId: 1, createdAt: -1 }    // List pagination
{ tenantId: 1, updatedAt: -1 }  // Sync / CDC
```

### 2.6 Retention & TTL

| Database | Collection | TTL |
|----------|------------|-----|
| auth | `sessions` | 30 days idle |
| auth | `password_reset_tokens` | 1 hour |
| audit | `audit_logs` | Configurable per tenant (default 7 years) |
| ai | `qa_sessions` | 90 days |
| notification | `notifications` | 180 days (read), 365 days (unread) |

---

## 3. API Contracts

### 3.1 Global Conventions

#### Request Headers (Client → Gateway)

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | `Bearer {accessToken}` |
| `X-Tenant-ID` | Yes** | Active organization ID (must match JWT claim) |
| `X-Request-ID` | No | Client-generated UUID; gateway creates if absent |
| `Content-Type` | Yes | `application/json` (except file upload) |
| `Accept` | No | `application/json` |

\* Public auth routes excepted.  
\** Omitted for register/login; required for all `/app/*` routes.

#### Standard Response Envelope

```json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-06-01T12:00:00.000Z"
  }
}
```

#### Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "Contract not found",
    "details": []
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-06-01T12:00:00.000Z"
  }
}
```

#### HTTP Status Usage

| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Validation error |
| 401 | Missing/invalid token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, version mismatch) |
| 422 | Business rule violation (plan limit exceeded) |
| 429 | Rate limited |
| 500 | Internal error |
| 503 | Dependency unavailable (AI overloaded) |

#### Pagination

Query: `?page=1&limit=20&sort=-createdAt`

```json
{
  "success": true,
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

---

### 3.2 Auth Service — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | Register user + org |
| POST | `/login` | Public | Email/password login |
| POST | `/refresh` | Refresh token | Issue new access token |
| POST | `/logout` | Bearer | Revoke refresh token |
| POST | `/forgot-password` | Public | Send reset email |
| POST | `/reset-password` | Public | Reset with token |
| GET | `/verify-email/:token` | Public | Verify email |
| GET | `/me` | Bearer | Current auth identity |
| POST | `/oauth/google` | Public | OAuth callback (Phase 2) |
| POST | `/oauth/microsoft` | Public | OAuth callback (Phase 2) |

#### POST `/register`

**Request:**
```json
{
  "email": "user@acme.com",
  "password": "SecureP@ss1",
  "firstName": "Jane",
  "lastName": "Doe",
  "organizationName": "Acme Legal"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "ObjectId",
    "tenantId": "ObjectId",
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "expiresIn": 900
  }
}
```

#### POST `/login`

**Request:** `{ "email", "password" }`  
**Response (200):** Same token shape as register.

---

### 3.3 User Service — `/api/v1`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/users/me` | Any | Profile + memberships |
| PATCH | `/users/me` | Any | Update profile |
| PATCH | `/users/me/password` | Any | Change password (proxies auth) |
| GET | `/organizations/current` | Any | Current tenant details |
| PATCH | `/organizations/current` | tenant_admin | Update org settings |
| GET | `/organizations/current/members` | tenant_admin | List members |
| POST | `/organizations/current/invites` | tenant_admin | Invite member |
| PATCH | `/organizations/current/members/:userId` | tenant_admin | Change role |
| DELETE | `/organizations/current/members/:userId` | tenant_admin | Remove member |
| GET | `/organizations/current/notification-preferences` | Any | Get prefs |
| PATCH | `/organizations/current/notification-preferences` | Any | Update prefs |

#### POST `/organizations/current/invites`

**Request:**
```json
{
  "email": "reviewer@acme.com",
  "role": "legal_reviewer"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "inviteId": "ObjectId",
    "status": "pending",
    "expiresAt": "ISO8601"
  }
}
```

---

### 3.4 Contract Service — `/api/v1/contracts`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/contracts` | viewer | List with filters |
| POST | `/contracts` | business_user | Initiate upload |
| GET | `/contracts/:id` | viewer | Get contract detail |
| PATCH | `/contracts/:id` | business_user | Update metadata |
| DELETE | `/contracts/:id` | legal_reviewer | Soft delete |
| POST | `/contracts/:id/complete` | business_user | Finalize upload, trigger pipeline |
| GET | `/contracts/:id/versions` | viewer | Version history |
| GET | `/contracts/:id/versions/:versionId/download` | viewer | Presigned download URL |
| POST | `/contracts/:id/versions` | business_user | New version upload |
| GET | `/contracts/:id/comments` | viewer | List comments |
| POST | `/contracts/:id/comments` | legal_reviewer | Add comment |
| DELETE | `/contracts/:id/comments/:commentId` | author/admin | Delete comment |
| POST | `/contracts/:id/retry-analysis` | legal_reviewer | Re-queue failed analysis |
| GET | `/contracts/:id/export` | business_user | PDF report URL |

#### GET `/contracts` — Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | uploading, processing, analyzed, failed |
| `riskLevel` | enum | low, medium, high |
| `contractType` | enum | nda, msa, sow, etc. |
| `counterparty` | string | Partial match |
| `q` | string | Title/counterparty search |
| `page`, `limit`, `sort` | — | Pagination |

#### POST `/contracts`

**Request:**
```json
{
  "title": "Vendor MSA - Acme Corp",
  "counterparty": "Acme Corp",
  "contractType": "msa",
  "effectiveDate": "2026-01-15",
  "tags": ["vendor", "2026"],
  "fileName": "acme-msa.pdf",
  "fileSize": 2048576,
  "mimeType": "application/pdf"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "contractId": "ObjectId",
    "versionId": "ObjectId",
    "uploadUrl": "https://s3.../presigned",
    "uploadMethod": "PUT",
    "uploadHeaders": {
      "Content-Type": "application/pdf"
    },
    "expiresAt": "ISO8601"
  }
}
```

#### POST `/contracts/:id/complete`

**Request:**
```json
{
  "versionId": "ObjectId",
  "checksum": "sha256-hex"
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "contractId": "ObjectId",
    "status": "processing",
    "message": "Analysis queued"
  }
}
```

---

### 3.5 AI Service — `/api/v1/analysis`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/analysis/contracts/:contractId` | viewer | Latest analysis |
| GET | `/analysis/contracts/:contractId/status` | viewer | Job status/progress |
| GET | `/analysis/contracts/:contractId/clauses` | viewer | List clauses |
| GET | `/analysis/contracts/:contractId/clauses/:clauseId` | viewer | Clause detail |
| POST | `/analysis/contracts/:contractId/ask` | viewer | Q&A (sync, streaming Phase 2) |
| GET | `/analysis/contracts/:contractId/qa-history` | viewer | Past Q&A messages |
| POST | `/analysis/contracts/:contractId/compare` | legal_reviewer | Compare versions (Phase 2) |

#### POST `/analysis/contracts/:contractId/ask`

**Request:**
```json
{
  "question": "What is the termination notice period?",
  "sessionId": "ObjectId | null"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "ObjectId",
    "answer": "The agreement requires 90 days written notice...",
    "citations": [
      {
        "clauseId": "ObjectId",
        "clauseType": "term_termination",
        "excerpt": "...90 days prior written notice...",
        "pageNumber": 12
      }
    ],
    "confidence": "high",
    "disclaimer": "AI-generated insight, not legal advice."
  }
}
```

#### GET `/analysis/contracts/:contractId/status`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "progress": 65,
    "stage": "classifying_clauses",
    "startedAt": "ISO8601",
    "estimatedCompletionAt": "ISO8601"
  }
}
```

---

### 3.6 Search Service — `/api/v1/search`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/search` | viewer | Full-text + filters |
| POST | `/search/semantic` | viewer | Vector/semantic search (Phase 2) |
| GET | `/search/suggest` | viewer | Autocomplete |

#### GET `/search`

**Query:** `q`, `riskLevel`, `contractType`, `dateFrom`, `dateTo`, `page`, `limit`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "contractId": "ObjectId",
      "title": "Vendor MSA",
      "counterparty": "Acme Corp",
      "riskLevel": "high",
      "snippet": "...highlighted match...",
      "score": 0.92
    }
  ],
  "pagination": { }
}
```

---

### 3.7 Notification Service — `/api/v1/notifications`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/notifications` | Any | List (paginated) |
| GET | `/notifications/unread-count` | Any | Badge count |
| PATCH | `/notifications/:id/read` | Any | Mark read |
| POST | `/notifications/read-all` | Any | Mark all read |

---

### 3.8 Audit Service — `/api/v1/audit`

| Method | Path | Role Min | Description |
|--------|------|----------|-------------|
| GET | `/audit/logs` | tenant_admin | Filtered audit log |
| GET | `/audit/logs/export` | tenant_admin | CSV export (async job) |

**Query:** `action`, `userId`, `resourceType`, `resourceId`, `dateFrom`, `dateTo`

---

### 3.9 Internal Service APIs (Service-to-Service)

Protected by `X-Service-Token` (signed JWT, 5-minute TTL, issued by gateway or Istio).

| Service | Endpoint | Called By |
|---------|----------|-----------|
| auth-service | `GET /internal/users/:id` | user-service, gateway |
| user-service | `GET /internal/memberships/verify` | gateway, contract-service |
| contract-service | `PATCH /internal/contracts/:id/status` | ai-service, ingestion-worker |
| contract-service | `PATCH /internal/versions/:id/extracted-text` | ingestion-worker |
| ai-service | `POST /internal/analysis/run` | ingestion-worker |
| user-service | `GET /internal/users/:id/email` | notification-service |

---

### 3.10 Webhooks (Phase 2) — `/api/v1/webhooks`

| Event | Payload Summary |
|-------|-----------------|
| `contract.analysis.completed` | contractId, tenantId, riskScore, completedAt |
| `contract.analysis.failed` | contractId, tenantId, errorCode |

Delivery: HMAC-SHA256 signature header `X-ContractIQ-Signature`.

---

### 3.11 Error Code Registry

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Schema validation failed |
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | Role insufficient |
| `RESOURCE_NOT_FOUND` | 404 | Generic not found |
| `CONTRACT_NOT_FOUND` | 404 | Contract missing |
| `TENANT_MISMATCH` | 403 | X-Tenant-ID ≠ JWT tenant |
| `PLAN_LIMIT_EXCEEDED` | 422 | Monthly contract quota |
| `FILE_TOO_LARGE` | 400 | > 50 MB |
| `UNSUPPORTED_FILE_TYPE` | 400 | Not PDF/DOCX |
| `ANALYSIS_IN_PROGRESS` | 409 | Duplicate analysis trigger |
| `AI_SERVICE_UNAVAILABLE` | 503 | LLM circuit open |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## 4. RabbitMQ Event Design

### 4.1 Topology Overview

```
                         ┌──────────────────────────────────────┐
                         │     Exchange: contractiq.events      │
                         │            Type: topic                 │
                         │     Durable: true                      │
                         └──────────────────┬───────────────────┘
                                            │
        Routing Keys (examples)             │
        contract.upload.completed           │
        contract.ingestion.completed        │
        contract.analysis.completed         │
        contract.analysis.failed            │
        user.created                        │
        user.invited                          │
        member.joined                         │
        audit.record                          │
                                            │
     ┌──────────┬──────────┬──────────┬─────┴─────┬──────────┐
     ▼          ▼          ▼          ▼           ▼          ▼
  q.ingest   q.ai       q.search   q.notif    q.audit   q.contract
  worker     worker     indexer    dispatcher  writer    denorm
```

### 4.2 Exchange Definitions

| Exchange Name | Type | Durable | Purpose |
|---------------|------|---------|---------|
| `contractiq.events` | topic | yes | Domain events (pub/sub) |
| `contractiq.commands` | direct | yes | Point-to-point commands |
| `contractiq.dlx` | fanout | yes | Dead-letter routing |

### 4.3 Message Envelope (All Events)

Every message body follows this structure:

```json
{
  "eventId": "uuid-v4",
  "eventType": "contract.analysis.completed",
  "eventVersion": "1.0",
  "timestamp": "2026-06-01T12:00:00.000Z",
  "correlationId": "uuid-v4",
  "causationId": "uuid-v4 | null",
  "tenantId": "ObjectId",
  "actor": {
    "userId": "ObjectId | null",
    "type": "user | system | service"
  },
  "payload": { }
}
```

| Field | Rules |
|-------|-------|
| `eventId` | Unique; used for idempotency |
| `eventVersion` | Semantic versioning; breaking changes increment major |
| `correlationId` | Propagated from `X-Request-ID` |
| `causationId` | `eventId` of triggering event |
| `payload` | Event-specific DTO (Section 6) |

### 4.4 Routing Key Convention

Format: `{aggregate}.{action}.{status}`

| Segment | Values |
|---------|--------|
| aggregate | contract, user, member, analysis, notification, audit |
| action | upload, ingestion, analysis, invite, join, index, notify |
| status | completed, failed, requested, started (optional) |

**Wildcard bindings:**
- `contract.*.completed` → search indexer, notification dispatcher
- `contract.analysis.*` → contract denormalizer, audit writer
- `user.*` → user-service projections
- `#` → audit-service (all events, filtered in consumer)

### 4.5 Event Catalog

| Event Type | Routing Key | Publisher | Consumers |
|------------|-------------|-----------|-----------|
| UserCreated | `user.created` | auth-service | user-service, audit-service |
| UserRegistered | `user.registered` | auth-service | notification-service |
| UserInvited | `user.invited` | user-service | notification-service, audit-service |
| MemberJoined | `member.joined` | user-service | notification-service, audit-service |
| MemberRemoved | `member.removed` | user-service | audit-service |
| ContractCreated | `contract.created` | contract-service | audit-service |
| ContractUploadCompleted | `contract.upload.completed` | contract-service | ingestion-worker |
| ContractIngestionStarted | `contract.ingestion.started` | ingestion-worker | audit-service |
| ContractIngestionCompleted | `contract.ingestion.completed` | ingestion-worker | ai-worker |
| ContractIngestionFailed | `contract.ingestion.failed` | ingestion-worker | contract-service, notification-service, audit-service |
| ContractAnalysisStarted | `contract.analysis.started` | ai-service | audit-service |
| ContractAnalysisCompleted | `contract.analysis.completed` | ai-service | contract-service, search-service, notification-service, audit-service |
| ContractAnalysisFailed | `contract.analysis.failed` | ai-service | contract-service, notification-service, audit-service |
| ContractDeleted | `contract.deleted` | contract-service | search-service, ai-service, audit-service |
| SearchIndexRequested | `search.index.requested` | contract-service | search-service |
| NotificationDispatch | `notification.dispatch` | any | notification-service |
| AuditRecord | `audit.record` | any | audit-service |
| PlaybookDeviationDetected | `playbook.deviation.detected` | ai-service | notification-service (Phase 2) |

### 4.6 Consumer Design Patterns

| Pattern | Application |
|---------|-------------|
| **Competing consumers** | Multiple ingestion-worker pods on `q.ingestion.worker` |
| **Single active consumer** | Audit writer (ordering per tenant optional Phase 2) |
| **Retry with backoff** | 3 retries: 5s, 30s, 120s; then DLQ |
| **Idempotency** | Redis `SET event:{eventId} NX EX 86400` before processing |
| **Outbox** | Publishers write to `outbox_events` collection; relay process publishes to RabbitMQ |
| **Poison message** | After max retries → `contractiq.dlx` → `q.dlq.{service}` |

### 4.7 Outbox Relay

Each publishing service maintains:

**Collection:** `outbox_events`  
**Fields:** `eventId`, `exchange`, `routingKey`, `payload`, `status` (pending|published|failed), `createdAt`, `publishedAt`

Relay cron (or Change Stream): poll `pending` → publish → mark `published`.

### 4.8 Event Flow: Contract Upload to Analysis Complete

```
contract-service                RabbitMQ                 ingestion-worker
     │                              │                            │
     │── publish upload.completed ─▶│                            │
     │                              │── deliver ─────────────────▶│
     │                              │                            │ extract text
     │                              │                            │
     │                              │◀── ingestion.completed ────│
     │                              │                            │
     │                              │── deliver ─────────────────▶│ ai-worker
     │                              │                            │
     │◀── analysis.completed ───────│◀── publish ────────────────│
     │  (denormalize risk)          │                            │
     │                              │── deliver ──▶ search, notif, audit
```

### 4.9 Message Properties (AMQP Headers)

| Header | Description |
|--------|-------------|
| `x-tenant-id` | Tenant isolation validation |
| `x-correlation-id` | Tracing |
| `x-event-type` | Duplicate of body eventType for routing filters |
| `x-retry-count` | Incremented on each retry |
| `content-type` | `application/json` |
| `delivery-mode` | `2` (persistent) |

---

## 5. Queue Names

### 5.1 Naming Convention

Format: `contractiq.{domain}.{purpose}.v{major}`

- All lowercase, dot-separated
- Version suffix for breaking schema changes
- `.dlq` suffix for dead-letter queues

### 5.2 Work Queues (Commands / Jobs)

| Queue Name | Exchange | Binding Key | Consumer | Prefetch | TTL |
|------------|----------|-------------|----------|----------|-----|
| `contractiq.ingestion.worker.v1` | contractiq.commands | `ingestion.process` | ingestion-worker | 5 | — |
| `contractiq.ai.analysis.worker.v1` | contractiq.commands | `analysis.run` | ai-service worker | 3 | — |
| `contractiq.ai.embedding.worker.v1` | contractiq.commands | `embedding.generate` | ai-service worker | 10 | — |
| `contractiq.ai.qa.worker.v1` | contractiq.commands | `qa.process` | ai-service (async Q&A Phase 2) | 10 | — |
| `contractiq.search.indexer.v1` | contractiq.events | `contract.*.completed` | search-service | 20 | — |
| `contractiq.search.indexer.delete.v1` | contractiq.events | `contract.deleted` | search-service | 20 | — |
| `contractiq.notification.dispatcher.v1` | contractiq.events | `contract.analysis.*`, `user.invited`, `member.joined` | notification-service | 50 | — |
| `contractiq.notification.email.v1` | contractiq.commands | `email.send` | notification-service | 20 | — |
| `contractiq.contract.denorm.v1` | contractiq.events | `contract.analysis.completed`, `contract.analysis.failed` | contract-service | 10 | — |
| `contractiq.audit.writer.v1` | contractiq.events | `#` | audit-service | 100 | — |
| `contractiq.user.projection.v1` | contractiq.events | `user.created` | user-service | 10 | — |
| `contractiq.billing.usage.v1` | contractiq.events | `contract.analysis.completed` | billing-service (Ph. 2) | 20 | — |
| `contractiq.export.pdf.v1` | contractiq.commands | `export.pdf` | contract-service worker | 5 | — |

### 5.3 Dead-Letter Queues

| DLQ Name | Source Queue(s) | Alert Threshold |
|----------|-----------------|-----------------|
| `contractiq.ingestion.worker.dlq.v1` | ingestion.worker | > 10 messages |
| `contractiq.ai.analysis.worker.dlq.v1` | ai.analysis.worker | > 5 messages |
| `contractiq.search.indexer.dlq.v1` | search.indexer | > 20 messages |
| `contractiq.notification.dispatcher.dlq.v1` | notification.dispatcher | > 50 messages |
| `contractiq.audit.writer.dlq.v1` | audit.writer | > 0 messages (critical) |

### 5.4 DLX Configuration

| Parameter | Value |
|-----------|-------|
| Dead-letter exchange | `contractiq.dlx` |
| Dead-letter routing key | `{original-queue}.dlq` |
| Message TTL (analysis jobs) | 600000 ms (10 min) |
| Max length (audit queue) | 1,000,000 (overflow to DLQ) |

### 5.5 Redis Keys (Non-RabbitMQ)

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `idempotency:event:{eventId}` | Dedup | 24h |
| `ratelimit:tenant:{tenantId}:api` | API rate limit | 1 min sliding |
| `ratelimit:tenant:{tenantId}:ai` | AI Q&A limit | 1 day |
| `session:analysis:{contractId}` | Progress cache | 1h |
| `cache:contract:{tenantId}:{contractId}` | Hot read cache | 5 min |

---

## 6. DTOs

DTOs are defined as TypeScript interfaces in `@contractiq/shared-types`. Below are canonical shapes (version 1.0).

### 6.1 Enums

```
UserRole: tenant_admin | legal_reviewer | business_user | viewer
MembershipStatus: active | invited | suspended
ContractStatus: uploading | processing | analyzed | failed | deleted
ContractType: nda | msa | sow | employment | vendor | other
RiskLevel: low | medium | high
AnalysisStatus: pending | processing | completed | failed
ClauseType: parties_definitions | term_termination | payment_fees | confidentiality |
            intellectual_property | indemnification | limitation_liability |
            warranties_disclaimers | governing_law | assignment_change_of_control |
            force_majeure | data_protection | non_compete | insurance | miscellaneous
NotificationType: analysis_complete | analysis_failed | high_risk | mention | task_assigned | member_invited
PlanTier: free | pro | enterprise
```

### 6.2 Auth DTOs

#### `RegisterRequestDto`
| Field | Type | Validation |
|-------|------|------------|
| email | string | email format, max 255 |
| password | string | min 8, complexity rules |
| firstName | string | max 100 |
| lastName | string | max 100 |
| organizationName | string | max 200 |

#### `AuthTokenResponseDto`
| Field | Type |
|-------|------|
| userId | string |
| tenantId | string |
| accessToken | string |
| refreshToken | string |
| expiresIn | number (seconds) |

#### `JwtAccessPayloadDto` (claims)
| Field | Type |
|-------|------|
| sub | string (userId) |
| tid | string (tenantId) |
| role | UserRole |
| email | string |
| isSuperAdmin | boolean |
| iat, exp | number |

---

### 6.3 User & Tenant DTOs

#### `UserProfileDto`
| Field | Type |
|-------|------|
| id | string |
| email | string |
| firstName | string |
| lastName | string |
| avatarUrl | string \| null |
| memberships | MembershipDto[] |

#### `OrganizationDto`
| Field | Type |
|-------|------|
| id | string |
| name | string |
| slug | string |
| plan | PlanTier |
| settings | OrganizationSettingsDto |

#### `OrganizationSettingsDto`
| Field | Type |
|-------|------|
| retentionDays | number |
| allowedDomains | string[] |
| defaultPlaybookId | string \| null |

#### `MembershipDto`
| Field | Type |
|-------|------|
| id | string |
| tenantId | string |
| userId | string |
| role | UserRole |
| status | MembershipStatus |
| joinedAt | string \| null |

#### `InviteMemberRequestDto`
| Field | Type |
|-------|------|
| email | string |
| role | UserRole |

---

### 6.4 Contract DTOs

#### `CreateContractRequestDto`
| Field | Type |
|-------|------|
| title | string |
| counterparty | string |
| contractType | ContractType |
| effectiveDate | string \| null (ISO date) |
| tags | string[] |
| fileName | string |
| fileSize | number |
| mimeType | string |

#### `ContractSummaryDto` (list item)
| Field | Type |
|-------|------|
| id | string |
| title | string |
| counterparty | string |
| contractType | ContractType |
| status | ContractStatus |
| riskScore | number \| null |
| riskLevel | RiskLevel \| null |
| createdAt | string |
| updatedAt | string |
| createdBy | UserRefDto |

#### `ContractDetailDto`
| Field | Type |
|-------|------|
| (all ContractSummaryDto fields) | |
| keyDates | KeyDateDto[] |
| currentVersion | ContractVersionDto |
| analysis | AnalysisSummaryDto \| null |
| tags | string[] |

#### `KeyDateDto`
| Field | Type |
|-------|------|
| label | string |
| date | string |
| sourceClauseId | string \| null |

#### `ContractVersionDto`
| Field | Type |
|-------|------|
| id | string |
| versionNumber | number |
| fileName | string |
| fileSize | number |
| mimeType | string |
| pageCount | number \| null |
| uploadedAt | string |
| uploadedBy | UserRefDto |

#### `CompleteUploadRequestDto`
| Field | Type |
|-------|------|
| versionId | string |
| checksum | string (SHA-256) |

#### `CommentDto`
| Field | Type |
|-------|------|
| id | string |
| contractId | string |
| clauseId | string \| null |
| userId | string |
| userDisplayName | string |
| body | string |
| createdAt | string |
| updatedAt | string |

---

### 6.5 AI & Analysis DTOs

#### `AnalysisDto`
| Field | Type |
|-------|------|
| id | string |
| contractId | string |
| versionId | string |
| status | AnalysisStatus |
| summary | string \| null |
| riskScore | number \| null |
| riskLevel | RiskLevel \| null |
| riskFactors | RiskFactorDto[] |
| modelUsed | string \| null |
| tokensUsed | number \| null |
| processingTimeMs | number \| null |
| completedAt | string \| null |
| errorMessage | string \| null |

#### `RiskFactorDto`
| Field | Type |
|-------|------|
| factor | string |
| weight | number |
| score | number |
| explanation | string |

#### `ClauseDto`
| Field | Type |
|-------|------|
| id | string |
| contractId | string |
| clauseType | ClauseType |
| title | string |
| text | string |
| startOffset | number |
| endOffset | number |
| pageNumber | number \| null |
| riskLevel | RiskLevel |
| riskNote | string |
| playbookDeviation | boolean |
| orderIndex | number |

#### `AskQuestionRequestDto`
| Field | Type |
|-------|------|
| question | string (max 1000 chars) |
| sessionId | string \| null |

#### `AskQuestionResponseDto`
| Field | Type |
|-------|------|
| sessionId | string |
| answer | string |
| citations | CitationDto[] |
| confidence | low \| medium \| high |
| disclaimer | string |

#### `CitationDto`
| Field | Type |
|-------|------|
| clauseId | string |
| clauseType | ClauseType |
| excerpt | string |
| pageNumber | number \| null |

#### `AnalysisStatusDto`
| Field | Type |
|-------|------|
| status | AnalysisStatus |
| progress | number (0-100) |
| stage | string |
| startedAt | string |
| estimatedCompletionAt | string \| null |

---

### 6.6 Event Payload DTOs

#### `ContractUploadCompletedEventPayload`
| Field | Type |
|-------|------|
| contractId | string |
| versionId | string |
| storageKey | string |
| mimeType | string |
| fileSize | number |
| uploadedBy | string |

#### `ContractIngestionCompletedEventPayload`
| Field | Type |
|-------|------|
| contractId | string |
| versionId | string |
| pageCount | number |
| textLength | number |
| ocrUsed | boolean |

#### `ContractAnalysisCompletedEventPayload`
| Field | Type |
|-------|------|
| contractId | string |
| versionId | string |
| analysisId | string |
| riskScore | number |
| riskLevel | RiskLevel |
| clauseCount | number |
| summaryPreview | string (first 200 chars) |
| highRiskClauseCount | number |

#### `ContractAnalysisFailedEventPayload`
| Field | Type |
|-------|------|
| contractId | string |
| versionId | string |
| errorCode | string |
| errorMessage | string |
| retryCount | number |

#### `UserCreatedEventPayload`
| Field | Type |
|-------|------|
| userId | string |
| email | string |
| firstName | string |
| lastName | string |
| tenantId | string |
| organizationName | string |

#### `UserInvitedEventPayload`
| Field | Type |
|-------|------|
| inviteId | string |
| email | string |
| role | UserRole |
| invitedBy | string |
| inviteToken | string (hashed in logs) |

#### `AuditRecordEventPayload`
| Field | Type |
|-------|------|
| action | string |
| resourceType | string |
| resourceId | string |
| metadata | Record<string, unknown> |
| ipAddress | string \| null |
| userAgent | string \| null |

---

### 6.7 Search DTOs

#### `SearchRequestDto` (query params)
| Field | Type |
|-------|------|
| q | string \| null |
| riskLevel | RiskLevel \| null |
| contractType | ContractType \| null |
| dateFrom | string \| null |
| dateTo | string \| null |
| page | number |
| limit | number |

#### `SearchResultItemDto`
| Field | Type |
|-------|------|
| contractId | string |
| title | string |
| counterparty | string |
| riskLevel | RiskLevel \| null |
| snippet | string |
| score | number |

---

### 6.8 Notification DTOs

#### `NotificationDto`
| Field | Type |
|-------|------|
| id | string |
| type | NotificationType |
| title | string |
| body | string |
| resourceType | string |
| resourceId | string |
| read | boolean |
| createdAt | string |

---

### 6.9 Shared Primitive DTOs

#### `UserRefDto`
| Field | Type |
|-------|------|
| id | string |
| firstName | string |
| lastName | string |
| email | string |

#### `PaginationMetaDto`
| Field | Type |
|-------|------|
| page | number |
| limit | number |
| total | number |
| totalPages | number |

#### `ApiResponseDto<T>`
| Field | Type |
|-------|------|
| success | boolean |
| data | T |
| meta | { requestId, timestamp } |

---

## 7. Folder Structures

### 7.1 Monorepo Root

```
contractiq-ai/
├── apps/
│   ├── web/                          # React SPA
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── contract-service/
│   ├── ai-service/
│   ├── search-service/
│   ├── notification-service/
│   ├── audit-service/
│   ├── ingestion-worker/
│   ├── billing-service/              # Phase 2
│   └── playbook-service/             # Phase 2
├── packages/
│   ├── shared-types/                 # DTOs, enums
│   ├── shared-utils/                 # Helpers, validators
│   ├── event-contracts/              # Event schemas, routing keys
│   ├── mq-client/                    # RabbitMQ wrapper
│   ├── auth-middleware/              # JWT, RBAC
│   ├── logger/                       # Pino structured logging
│   ├── observability/                # OpenTelemetry setup
│   └── eslint-config/                # Shared lint rules
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml
│   ├── kubernetes/
│   │   ├── base/
│   │   ├── overlays/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   └── helm/
│   │       └── contractiq/
│   ├── terraform/                    # Optional IaC
│   └── rabbitmq/
│       └── definitions.json          # Exchanges, queues, bindings
├── docs/
│   ├── PROJECT_BLUEPRINT.md
│   └── SYSTEM_DESIGN.md
├── scripts/
│   ├── seed-dev-data.sh
│   └── migrate-all.sh
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── package.json                      # npm workspaces root
├── turbo.json                        # Turborepo config
└── README.md
```

### 7.2 Microservice Internal Layout (Template)

Applies to: `auth-service`, `user-service`, `contract-service`, `ai-service`, `search-service`, `notification-service`, `audit-service`.

```
apps/{service-name}/
├── src/
│   ├── index.ts                      # Entry point
│   ├── app.ts                        # Express app setup
│   ├── config/
│   │   ├── index.ts                  # Env validation (zod)
│   │   └── database.ts
│   ├── modules/
│   │   └── {domain}/                 # e.g. contracts, users
│   │       ├── {domain}.controller.ts
│   │       ├── {domain}.service.ts
│   │       ├── {domain}.repository.ts
│   │       ├── {domain}.routes.ts
│   │       ├── {domain}.schema.ts    # Zod validation
│   │       └── {domain}.events.ts    # Publishers
│   ├── consumers/                    # RabbitMQ consumers
│   │   └── {event-name}.consumer.ts
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── tenant-context.ts
│   │   └── validate-request.ts
│   ├── infrastructure/
│   │   ├── mongodb/
│   │   ├── rabbitmq/
│   │   ├── redis/
│   │   └── s3/                       # If applicable
│   └── types/
│       └── express.d.ts              # Request augmentation
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── migrations/
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

### 7.3 Worker Layout (`ingestion-worker`, AI workers)

```
apps/ingestion-worker/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── handlers/
│   │   ├── process-upload.handler.ts
│   │   └── extract-text.handler.ts
│   ├── services/
│   │   ├── pdf-extractor.service.ts
│   │   ├── docx-extractor.service.ts
│   │   └── ocr.service.ts            # Phase 2
│   ├── publishers/
│   └── clients/
│       ├── contract.client.ts
│       └── ai.client.ts
├── tests/
├── Dockerfile
└── package.json
```

### 7.4 React Frontend (`apps/web`)

```
apps/web/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── public.routes.tsx
│   │   └── app.routes.tsx
│   ├── pages/
│   │   ├── landing/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── contracts/
│   │   ├── search/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── layout/
│   │   └── contracts/
│   ├── hooks/
│   ├── services/                     # API clients (axios)
│   ├── store/                        # Zustand or Redux Toolkit
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── auth.ts
│   ├── types/
│   └── styles/
├── tests/
│   └── e2e/                          # Playwright
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### 7.5 API Gateway Layout

```
apps/api-gateway/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── routes/
│   │   └── proxy.routes.ts           # http-proxy-middleware
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── rate-limiter.ts
│   │   ├── tenant-validator.ts
│   │   └── correlation-id.ts
│   └── health/
└── package.json
```

---

## 8. Shared Libraries

### 8.1 Package Overview

| Package | NPM Name | Consumers | Responsibility |
|---------|----------|-----------|----------------|
| shared-types | `@contractiq/shared-types` | All | DTOs, enums, API response types |
| shared-utils | `@contractiq/shared-utils` | All services | Date, string, hash helpers |
| event-contracts | `@contractiq/event-contracts` | Publishers, consumers | Event types, routing keys, version map |
| mq-client | `@contractiq/mq-client` | Services with MQ | Connection pool, publish, subscribe, DLQ |
| auth-middleware | `@contractiq/auth-middleware` | Gateway, services | JWT verify, RBAC guard, service token |
| logger | `@contractiq/logger` | All | Pino logger + correlation mixin |
| observability | `@contractiq/observability` | All | OTel traces, metrics exporters |
| eslint-config | `@contractiq/eslint-config` | All | ESLint + Prettier presets |

### 8.2 `@contractiq/shared-types`

| Export Category | Examples |
|-----------------|----------|
| Request DTOs | `CreateContractRequestDto`, `RegisterRequestDto` |
| Response DTOs | `ContractDetailDto`, `AnalysisDto` |
| Event payloads | `ContractAnalysisCompletedEventPayload` |
| Enums | `UserRole`, `ContractStatus`, `ClauseType` |
| API wrappers | `ApiResponseDto<T>`, `PaginatedResponseDto<T>` |

**Versioning:** Package follows semver; breaking DTO changes require major bump + `eventVersion` increment.

### 8.3 `@contractiq/event-contracts`

| Export | Description |
|--------|-------------|
| `ROUTING_KEYS` | Constant map of all routing keys |
| `QUEUE_NAMES` | Constant map of all queue names |
| `EXCHANGES` | Exchange name constants |
| `EventType` | Union type of all event types |
| `validateEventEnvelope(body)` | Zod schema validation |
| `EVENT_VERSION_MAP` | eventType → current version |

### 8.4 `@contractiq/mq-client`

| API | Description |
|-----|-------------|
| `createConnection(config)` | Singleton AMQP connection with reconnect |
| `publish(exchange, routingKey, envelope)` | Publisher confirms enabled |
| `subscribe(queue, handler, options)` | Auto-ack false, manual ack after success |
| `nack(msg, requeue)` | Retry or DLQ routing |
| `assertTopology(definitions)` | Boot-time queue/exchange assertion |

**Configuration via env:**
- `RABBITMQ_URL`
- `RABBITMQ_PREFETCH`
- `RABBITMQ_RETRY_ATTEMPTS`

### 8.5 `@contractiq/auth-middleware`

| Middleware | Description |
|------------|-------------|
| `authenticateJwt` | Validates Bearer token, attaches `req.user` |
| `requireRole(...roles)` | RBAC check against `req.user.role` |
| `validateTenantHeader` | Ensures `X-Tenant-ID` === JWT `tid` |
| `authenticateService` | Validates `X-Service-Token` for internal routes |
| `signServiceToken(serviceName)` | Issues short-lived S2S JWT |

### 8.6 `@contractiq/logger`

| Feature | Description |
|---------|-------------|
| Structured JSON | Pino with `level`, `time`, `msg` |
| Correlation mixin | Auto-injects `correlationId`, `tenantId`, `userId` |
| Redaction | `password`, `token`, `authorization` paths redacted |
| Child loggers | Per-module `logger.child({ module: 'contract' })` |

### 8.7 `@contractiq/observability`

| Feature | Description |
|---------|-------------|
| Tracing | HTTP + MongoDB + AMQP spans |
| Metrics | `http_request_duration_seconds`, `mq_consume_total`, `ai_tokens_used` |
| Health | `/health`, `/ready` probe helpers |

### 8.8 Dependency Rules

```
apps/*  →  packages/*  →  (no dependency on apps)
packages/shared-types  →  (no internal package deps)
packages/event-contracts  →  shared-types
packages/mq-client  →  event-contracts, logger
packages/auth-middleware  →  shared-types, logger
```

---

## 9. Security Architecture

### 9.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Edge — WAF, DDoS, TLS 1.3, HSTS, CSP (frontend) │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Gateway — JWT, rate limit, tenant validation      │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Service — RBAC, input validation, S2S tokens      │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Data — encryption at rest, tenant-scoped queries  │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Infrastructure — NetworkPolicy, secrets, IAM      │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Authentication

| Mechanism | Detail |
|-----------|--------|
| Access token | JWT, RS256, 15-minute TTL |
| Refresh token | Opaque or JWT, 7-day TTL, stored hashed in `refresh_tokens` |
| Token issuer | auth-service (`iss: contractiq-auth`) |
| Key rotation | JWKS endpoint `/.well-known/jwks.json`, rotate every 90 days |
| Password storage | bcrypt, cost factor 12 |
| OAuth (Ph. 2) | PKCE flow, state parameter, provider tokens encrypted at rest |

### 9.3 Authorization (RBAC)

| Check Point | Implementation |
|-------------|----------------|
| Gateway | JWT signature, expiry, `tid` claim present |
| Gateway | `X-Tenant-ID` matches JWT `tid` |
| Service | `requireRole()` per route (see API Contracts) |
| Service | Resource-level: `contract.tenantId === req.user.tid` |
| AI Q&A | Viewer role allowed (read-only analysis) |
| Super admin | Separate `isSuperAdmin` claim; routes under `/api/v1/admin/*` |

### 9.4 Service-to-Service Security

| Control | Implementation |
|---------|----------------|
| Internal JWT | Signed with separate key pair; `aud` = target service |
| mTLS (production) | Istio/Linkerd between pods |
| Network policies | Only gateway receives external traffic; DB ports blocked from internet |
| Secret injection | Kubernetes Secrets + External Secrets Operator → Vault/AWS SM |

### 9.5 Data Protection

| Asset | Protection |
|-------|------------|
| Contracts at rest (S3) | SSE-KMS, per-tenant prefix isolation |
| MongoDB | Encryption at rest (Atlas), TLS in transit |
| PII in logs | Redaction via logger package |
| AI prompts | Production logs store SHA-256 hash only |
| Backups | Encrypted, cross-region, access audited |

### 9.6 API Security Controls

| Control | Configuration |
|---------|---------------|
| Rate limiting | 100 req/min per user; 1000 req/min per tenant (gateway) |
| AI rate limiting | 50 Q&A requests/day (free), unlimited (pro) |
| File upload | MIME whitelist, magic-byte validation, 50 MB cap |
| Malware scan | ClamAV sidecar or cloud AV on upload complete (Phase 2) |
| CORS | Allowlist production frontend origin only |
| CSRF | SameSite cookies if cookie-based auth added; currently Bearer-only |
| Input validation | Zod schemas on all request bodies |
| SQL/NoSQL injection | Mongoose parameterized queries; no raw user input in queries |

### 9.7 Tenant Isolation

| Layer | Enforcement |
|-------|-------------|
| API | `tenantId` from JWT, never from body alone |
| Database | All queries include `{ tenantId }` filter |
| S3 | Path prefix `tenants/{tenantId}/` |
| RabbitMQ | `x-tenant-id` header validated in consumers |
| Search | Index alias per tenant OR filtered alias with mandatory `tenantId` |
| Cache | Redis keys prefixed with `tenantId` |

### 9.8 Audit & Compliance

| Requirement | Implementation |
|-------------|----------------|
| Immutable audit | audit-service append-only collection |
| AI accountability | `ai_usage_logs` with model, token count, prompt hash |
| GDPR delete | Orchestrated saga: delete S3 → MongoDB docs → search index → audit tombstone |
| Session timeout | 30 min idle; refresh token rotation on use |
| Legal disclaimer | Required on AI endpoints and UI |

### 9.9 Security Testing & Monitoring

| Activity | Frequency |
|----------|-----------|
| Dependency scanning (Snyk/Dependabot) | Every PR |
| SAST (SonarQube) | Every PR |
| DAST | Quarterly |
| Penetration test | Annual |
| Failed login alerting | > 5 attempts / 15 min → lock 30 min |
| Anomaly detection | Unusual download volume per tenant |

---

## 10. Deployment Strategy

### 10.1 Environment Matrix

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| Cluster | Docker Compose | EKS/AKS (1 AZ) | EKS/AKS (multi-AZ) |
| MongoDB | Local container | Atlas M10 | Atlas M30+ |
| RabbitMQ | Local container | CloudAMQP dedicated | CloudAMQP HA cluster |
| Redis | Local container | ElastiCache small | ElastiCache cluster |
| S3 | MinIO | AWS S3 (staging bucket) | AWS S3 + CRR |
| LLM | Mock / low-cost model | GPT-4o (limited quota) | GPT-4o / Azure OpenAI |
| Replicas per service | 1 | 2 | 2–10 (HPA) |
| Domain | localhost | staging.contractiq.ai | api.contractiq.ai |

### 10.2 Container Strategy

| Property | Value |
|----------|-------|
| Base image | `node:20-alpine` |
| Build | Multi-stage Dockerfile per app |
| Registry | AWS ECR / Azure ACR |
| Tagging | `{git-sha}`, `{semver}` on release |
| Non-root user | `node` (UID 1000) |
| Health checks | `GET /health` (liveness), `GET /ready` (readiness) |
| Resources (MVP) | requests: 256Mi/100m CPU; limits: 512Mi/500m CPU |
| AI workers | requests: 1Gi/500m CPU; limits: 2Gi/2000m CPU |

### 10.3 Kubernetes Layout

```
namespace: contractiq-production
├── deployments/
│   ├── api-gateway          (replicas: 3)
│   ├── auth-service         (replicas: 2)
│   ├── user-service         (replicas: 2)
│   ├── contract-service     (replicas: 3)
│   ├── ai-service-api       (replicas: 2)
│   ├── ai-service-worker    (replicas: 2-10, KEDA)
│   ├── search-service       (replicas: 2)
│   ├── notification-service (replicas: 2)
│   ├── audit-service        (replicas: 2)
│   └── ingestion-worker     (replicas: 2-5, KEDA)
├── services/                (ClusterIP)
├── ingress/                 (NGINX + cert-manager)
├── configmaps/
├── secrets/                 (External Secrets)
├── hpa/                     (CPU + custom metrics)
└── networkpolicies/
```

### 10.4 Autoscaling Rules

| Deployment | Metric | Target | Min | Max |
|------------|--------|--------|-----|-----|
| api-gateway | CPU | 70% | 2 | 10 |
| contract-service | CPU | 70% | 2 | 8 |
| ai-service-worker | RabbitMQ queue depth `contractiq.ai.analysis.worker.v1` | 5 msgs/pod | 2 | 10 |
| ingestion-worker | Queue depth `contractiq.ingestion.worker.v1` | 3 msgs/pod | 1 | 5 |
| search-service | CPU | 70% | 2 | 6 |

**KEDA Scaler (AI worker):** RabbitMQ trigger, `queueLength > 5` → scale up.

### 10.5 CI/CD Pipeline

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────────┐
│  Push   │───▶│  Lint   │───▶│  Test    │───▶│  Build  │───▶│   Push     │
│         │    │  + SAST │    │  unit +  │    │  Docker │    │   ECR      │
│         │    │         │    │  integ   │    │  images │    │            │
└─────────┘    └─────────┘    └──────────┘    └─────────┘    └──────┬─────┘
                                                                     │
                    ┌────────────────────────────────────────────────┘
                    ▼
            ┌───────────────┐         ┌────────────────┐
            │ Deploy Staging│────────▶│ Smoke Tests    │
            │ (ArgoCD)      │         │ + Contract API │
            └───────┬───────┘         └────────────────┘
                    │ manual approval
                    ▼
            ┌───────────────┐         ┌────────────────┐
            │ Deploy Prod   │────────▶│ Synthetic      │
            │ Blue/Green    │         │ Monitoring     │
            └───────────────┘         └────────────────┘
```

| Stage | Gate |
|-------|------|
| PR | Unit tests pass, coverage ≥ 70%, no critical Snyk findings |
| Staging deploy | Auto on merge to `main` |
| Production deploy | Manual approval + staging smoke pass 24h |
| Rollback | ArgoCD rollback or `kubectl rollout undo` < 5 min |

### 10.6 GitOps (ArgoCD)

| Path | Purpose |
|------|---------|
| `infrastructure/kubernetes/overlays/staging` | Staging manifests |
| `infrastructure/kubernetes/overlays/production` | Production manifests |
| `infrastructure/rabbitmq/definitions.json` | Queue topology (applied on deploy) |

**Sync policy:** Auto-sync staging; manual sync production.

### 10.7 Database Migration Strategy

| Rule | Detail |
|------|--------|
| Tool | `migrate-mongo` per service |
| Execution | Init container or pre-deploy Job in K8s |
| Ordering | auth → user → contract → ai → search → notification → audit |
| Rollback | Down migrations tested in staging; backward-compatible schema changes only |
| Zero-downtime | Expand-contract pattern (add column → dual write → migrate → remove old) |

### 10.8 RabbitMQ Deployment

| Environment | Solution |
|-------------|----------|
| Local | RabbitMQ 3.13 in Docker Compose; definitions mounted |
| Staging/Prod | CloudAMQP (HA) or RabbitMQ Cluster Operator on K8s |
| Topology | Applied via `definitions.json` on deploy (idempotent) |
| Monitoring | Prometheus RabbitMQ exporter; alert queue depth > 1000 |

### 10.9 Release & Versioning

| Artifact | Versioning |
|----------|------------|
| API | URL path `/api/v1`; 12-month deprecation |
| Events | `eventVersion` in envelope; consumers support N and N-1 |
| Docker images | Semver git tags |
| Shared packages | Independent semver in monorepo |

### 10.10 Disaster Recovery

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Single pod failure | < 1 min | 0 | K8s auto-restart |
| AZ failure | < 15 min | 0 | Multi-AZ replicas |
| MongoDB failure | < 4 h | < 1 h | Atlas point-in-time restore |
| Region failure | < 24 h | < 1 h | Cross-region S3 + DB restore (Enterprise) |
| RabbitMQ failure | < 30 min | 0 (persistent queues) | Failover to mirror node |

### 10.11 Local Development (Docker Compose Services)

| Service | Host Port | Image |
|---------|-----------|-------|
| api-gateway | 4000 | build |
| auth-service | 4001 | build |
| user-service | 4002 | build |
| contract-service | 4003 | build |
| ai-service | 4004 | build |
| search-service | 4005 | build |
| notification-service | 4006 | build |
| audit-service | 4007 | build |
| ingestion-worker | — | build |
| web (Vite) | 5173 | build |
| mongodb | 27017 | mongo:7 |
| redis | 6379 | redis:7 |
| rabbitmq | 5672, 15672 | rabbitmq:3.13-management |
| minio | 9000, 9001 | minio |
| mailhog | 8025 | mailhog |

### 10.12 Observability Deployment

| Component | Deployment |
|-----------|------------|
| OpenTelemetry Collector | DaemonSet |
| Prometheus | Helm kube-prometheus-stack |
| Grafana | Dashboards per service + business KPIs |
| Loki | Log aggregation from all pods |
| Jaeger/Tempo | Trace backend |
| Alerts | PagerDuty integration for P1/P2 |

**Critical alerts:**
- API error rate > 1% for 5 min
- AI analysis DLQ depth > 0
- RabbitMQ memory alarm
- MongoDB replication lag > 30s
- Audit writer consumer down

---

## Appendix A: Traceability to PROJECT_BLUEPRINT

| Blueprint Section | Covered In |
|-------------------|------------|
| Microservice Architecture (§7) | §1 Service Boundaries |
| Database Design (§10) | §2 Database Per Service |
| API Gateway Routes (§7.4) | §3 API Contracts |
| User Flows (§11) | §4 Events, §1.5 Saga |
| Deployment (§12) | §10 Deployment Strategy |
| AI Features (§8) | §3.5 AI API, §6.5 AI DTOs |
| Security NFRs (§4.4) | §9 Security Architecture |

## Appendix B: Architecture Decision Records (Summary)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Database-per-service (logical) | Independent scaling and schema evolution |
| ADR-002 | RabbitMQ for domain events | Reliable pub/sub, DLQ, routing flexibility |
| ADR-003 | Outbox pattern for publishers | At-least-once delivery without dual-write issues |
| ADR-004 | JWT RS256 | Stateless gateway validation, key rotation via JWKS |
| ADR-005 | Monorepo with Turborepo | Shared DTOs, coordinated releases |
| ADR-006 | Presigned S3 upload | Offload file traffic from API servers |
| ADR-007 | Choreography over orchestration | Looser coupling for upload/analysis saga |

## Appendix C: Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | Principal Architect | Initial technical architecture |

---

*This document defines implementation contracts for ContractIQ AI engineering teams. Changes require architecture review and version increment.*
