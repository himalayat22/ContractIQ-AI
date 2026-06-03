# Notification Service — Structure

Port **4004** · Database **`contractiq_notification`** · Queue **`notification.send`** (BullMQ)

## Directory layout

```
apps/notification-service/
├── Dockerfile
├── package.json
├── STRUCTURE.md
└── src/
    ├── index.js                 # Bootstrap: MongoDB, Redis, HTTP, BullMQ worker
    ├── app.js                   # Express app factory
    ├── config/
    │   └── env.js               # Env loading & typed config
    ├── infrastructure/
    │   ├── mongodb/             # connect, ensureDns
    │   ├── redis/               # ioredis (BullMQ connections)
    │   ├── email/
    │   │   ├── transporter.js   # Nodemailer singleton
    │   │   └── templates.js     # MVP inline templates
    │   └── queue/
    │       ├── queues.js        # Job name constants
    │       ├── notification.queue.js   # BullMQ Queue + enqueue
    │       └── notification.worker.js  # BullMQ Worker
    ├── workers/
    │   └── index.js             # Runtime wiring (queue + worker + services)
    ├── modules/notifications/
    │   ├── models/              # Notification, EmailOutbox
    │   ├── repositories/
    │   ├── services/
    │   │   ├── NotificationService.js        # In-app CRUD (list, read)
    │   │   ├── EmailService.js               # Nodemailer + outbox
    │   │   └── NotificationDispatchService.js # Job processor logic
    │   ├── jobs/
    │   │   └── sendNotification.job.js
    │   ├── controllers/
    │   ├── routes/
    │   └── validations/
    ├── middleware/
    ├── routes/
    │   ├── index.js
    │   └── health.routes.js
    └── utils/
        └── AppError.js
```

## HTTP routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/ready` | MongoDB + Redis |
| GET | `/api/v1/notifications` | List in-app notifications |
| GET | `/api/v1/notifications/unread-count` | Badge count |
| PATCH | `/api/v1/notifications/:id/read` | Mark one read |
| POST | `/api/v1/notifications/read-all` | Mark all read |
| POST | `/api/v1/internal/notify` | Enqueue dispatch (requires `X-Internal-Api-Key`) |

## BullMQ flow

```
POST /internal/notify
       │
       ▼
  notification.send queue
       │
       ▼
  Worker → NotificationDispatchService
       ├─► notifications collection (in-app)
       └─► EmailService → Nodemailer → email_outbox
```

## Run locally

```bash
# From repo root (requires MongoDB + Redis)
npm run dev --workspace=@contractiq/notification-service
```

Set `NOTIFICATION_RUN_WORKER=false` to run API only without consuming jobs.
