# Backend (`backend-node`)

AuditPro backend contains:

- Vercel serverless APIs (`api/*`)
- Queue + worker (`src/queue`, `src/workers`)
- MongoDB models (`src/database/models`)

## Environment

This backend now loads environment from the root `../.env.local` first (fallback to local `.env`).

## Dead Letter Queue (DLQ)

Failed jobs that exhaust retries are stored in MongoDB collection `deadletterjobs`.

### API

- `GET /api/dlq` (authenticated)
- optional admin restriction via `ADMIN_EMAILS` env (comma-separated)

## Worker

Run worker on a public VM/container (not Vercel):

- `node src/workers/auditWorker.js`

Worker requires:

- MongoDB Atlas access
- Upstash Redis access
- Ollama endpoint access
- Slither + Foundry binaries installed (if enabled)
