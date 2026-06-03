# AI Service — Structure

Port **4003** · Database **`contractiq_ai`** · Provider **Google Gemini** (`@google/genai`)

## Directory layout

```
apps/ai-service/
├── Dockerfile
├── package.json
├── STRUCTURE.md
└── src/
    ├── index.js
    ├── app.js
    ├── config/env.js
    ├── infrastructure/
    │   ├── mongodb/
    │   └── gemini/client.js          # GoogleGenAI singleton
    ├── utils/
    │   ├── withRetry.js              # Exponential backoff retries
    │   └── withTimeout.js            # Request timeout wrapper
    └── modules/analysis/
        ├── models/                   # Analysis, Clause
        ├── repositories/
        ├── schemas/                  # JSON schema + Zod validation
        ├── providers/
        │   └── GeminiAnalysisProvider.js
        ├── services/AnalysisService.js
        ├── controllers/
        ├── routes/
        └── validations/
```

## Features

| Feature | Storage / API |
|---------|----------------|
| **Contract Summary** | `analyses.summary` |
| **Risk Analysis** | `riskScore`, `riskLevel`, `riskFactors` |
| **Clause Extraction** | `clauses` collection |
| **Key Obligations** | `analyses.keyObligations` · GET `.../key-obligations` |

## HTTP routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/internal/analysis/run` | Run Gemini pipeline (`contractText` required) |
| GET | `/api/v1/analysis/contracts/:contractId` | Full analysis |
| GET | `/api/v1/analysis/contracts/:contractId/key-obligations` | Key obligations |

## Run locally

```bash
npm run dev --workspace=@contractiq/ai-service
```

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in repo root `.env`.
