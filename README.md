# AuditPro — AI Solidity Smart Contract Auditor (Vercel + MongoDB + Upstash)

AuditPro is a Solidity auditor that combines:

- A React dashboard (contract upload + results cards)
- A Node backend with a modular analysis pipeline (shipped as Vercel Serverless Functions)
- A **local LLM via Ollama** (keeps AI local if you want)
- Optional **RAG** using **ChromaDB** as vector storage

Authentication is implemented using **Firebase Google OAuth** (backend verifies Firebase ID tokens).

## Recommended free production stack

- Frontend: **Vercel**
- Backend: **Vercel Serverless Functions** (`backend-node/api/*`)
- Database: **MongoDB Atlas** (Mongoose)
- Queue: **Upstash Redis** + **BullMQ**
- AI Runtime: **Ollama**
- Static Analysis: **Slither** (optional)

## Workspace structure

```text
React-frontend/   # UI dashboard (reused + upgraded)
backend-node/     # Express API (local LLM + analyzers + RAG)
ai-training/      # Training notes/scripts (LoRA scaffolding)
vector-db/        # Local vector DB persistence path
blockchain/       # Foundry project (optional)
```

## System architecture

```text
								 +---------------------------+
								 |   React Frontend          |
								 |  Upload + Dashboard Cards |
								 +------------+--------------+
															|
															| HTTP
															v
+-----------------------------+------------------------------+
|                   Vercel Serverless API                     |
| controllers/ routes/ services/ analyzers/ rag/ utils/      |
|                                                            |
|  POST /api/audit         -> enqueue job -> worker -> report |
|  GET  /api/audit?jobId=  -> job status + report             |
|  POST /api/chat          -> Ollama chat + optional RAG      |
|  GET  /api/health        -> { status, uptime }              |
+-----------------------------+------------------------------+
															|
								+-------------+--------------+
								|                            |
								v                            v
				+---------------+             +--------------+
				| Ollama (local)|             | ChromaDB     |
				| chat+embeddings             | vector store |
				+---------------+             +--------------+
```

## Backend design (modular)

Key modules:

- `backend-node/src/services/localLLMService.js` — local Ollama wrapper (`/api/chat`, `/api/embeddings`)
- `backend-node/src/services/auditPipeline.js` — orchestrates analysis and returns structured JSON
- `backend-node/src/database/mongo.js` — MongoDB Atlas connector
- `backend-node/src/database/models/*` — Mongo schemas (`contracts`, `auditReports`, `auditJobs`)
- `backend-node/src/queue/*` — Upstash Redis + BullMQ
- `backend-node/src/workers/auditWorker.js` — BullMQ worker that stores final reports
- `backend-node/src/analyzers/*` — async analyzers
- `backend-node/src/rag/*` — RAG modules built on ChromaDB

## Installation (rebuild on a new system)

### Prerequisites

- Node.js 18+ (backend uses built-in `fetch`)
- npm
- Optional:
	- Ollama (recommended)
	- ChromaDB server (for RAG)
	- Slither (for deeper static analysis)
	- MongoDB Atlas + Upstash Redis (required for production deployment)

## Running the backend (local dev)

```bash
cd backend-node
cp .env.example .env
npm install
npm run dev
```

Run the worker in another terminal (required for queued audits):

```bash
cd backend-node
node src/workers/auditWorker.js
```

Health check:

```bash
curl http://localhost:5000/health
```

## Running the frontend

```bash
cd React-frontend
npm install

# optional: set backend URL
# echo "REACT_APP_BACKEND_URL=http://localhost:5000" > .env

npm start
```

Open: `http://localhost:3000`

## Installing Ollama (local AI model)

Install Ollama: https://ollama.com

Verify server:

```bash
curl http://localhost:11434/api/tags
```

Pull the default chat model:

```bash
ollama pull deepseek-coder:6.7b
```

Pull embeddings model (for RAG):

```bash
ollama pull nomic-embed-text
```

Configure in `backend-node/.env` if needed:

```text
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=deepseek-coder:6.7b
# EMBEDDING_MODEL=nomic-embed-text
```

## Running ChromaDB (for RAG)

RAG is optional. If Chroma isn’t running, chat still works (it just won’t retrieve extra context).

Example (Docker):

```bash
docker run -p 8000:8000 chromadb/chroma
```

Set:

```text
CHROMA_URL=http://localhost:8000
```

## Running Solidity analyzers

Built-in analyzers run when you call:

- `POST /api/audit` (multipart upload -> queued job)

Optional Slither analyzer:

```bash
pip install slither-analyzer
```

> Note: the current pipeline includes the module but keeps Slither execution conservative. You can extend `auditPipeline` to write temp files and run Slither safely.

## Production deployment (Vercel + MongoDB Atlas + Upstash)

### Environment variables (Vercel)

Required:

```text
MONGODB_URI=
MONGODB_DB=auditpro

UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
MAX_CONCURRENT_JOBS=5

OLLAMA_BASE_URL=
LLM_MODEL=

CHROMA_URL=

MAX_SOURCE_BYTES=200000
AUDIT_TIMEOUT_MS=20000

RATE_LIMIT_PER_MIN=60
CORS_ORIGINS=*
```

> Important: if the backend runs on Vercel, `OLLAMA_BASE_URL` must be reachable from Vercel (VPS/tunnel). Vercel cannot call your machine’s `localhost`.

### CI/CD

GitHub Actions workflow: `.github/workflows/deploy.yml`

Add these GitHub secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## Public API endpoints

### GET `/api/health`

Returns:

```json
{ "status": "ok", "uptime": 123.45 }
```

### POST `/api/audit` (upload + enqueue)

- `multipart/form-data`
- form field: `file`
- supported extensions: `.sol`, `.rs`, `.move`, `.mo`, `.fc`, `.cairo`
- max: 200 KB
- requires `Authorization: Bearer <firebase-id-token>`

### GET `/api/audit?jobId=<id>` (poll)

Returns job status and includes `report` when completed.

### POST `/api/chat`

```json
{ "contractSource": "...", "messages": [{"role":"user","content":"..."}] }
```

Requires `Authorization: Bearer <firebase-id-token>`.

### GET `/api/auth/me`

Returns authenticated user profile from MongoDB.

### POST `/api/auth/wallet`

Body:

```json
{ "walletAddress": "0x..." }
```

Links optional wallet address to authenticated user.

## Example audit report JSON (stored in MongoDB)

```json
{
	"contractHash": "...",
	"contractName": "MyContract.sol",
	"sourceCode": "...",
	"vulnerabilities": [],
	"gasIssues": [],
	"defiPatterns": [],
	"openzeppelinChecks": {},
	"aiRecommendations": [],
	"securityScore": 92,
	"createdAt": "2026-03-16T00:00:00.000Z"
}
```

## Curl examples

```bash
# health
curl -s http://localhost:3000/api/health

# enqueue audit
curl -s -X POST http://localhost:3000/api/audit \
	-F "file=@./MyContract.sol"

# poll job
curl -s "http://localhost:3000/api/audit?jobId=<JOB_ID>"
```

## Training with LoRA (ai-training)

`ai-training/` is reserved for future LoRA workflows:

- building instruction datasets from findings
- fine-tuning a code model
- exporting GGUF
- loading into Ollama

Not required to run the app.

## Auth + wallet

- Google OAuth is handled in frontend Firebase SDK.
- Backend verifies Firebase ID tokens in `backend-node/src/middlewares/auth.js`.
- Optional wallet linking is available via `/api/auth/wallet`.
