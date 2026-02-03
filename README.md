# AuditPro — AI-Assisted Smart Contract Audit & Security Platform

AuditPro helps developers understand smart contracts, identify common security **risk signals**, and get **plain-English explanations**.

**⚠️ Disclaimer:** This tool provides security insights and heuristics — it is **not** a substitute for a professional audit.

## Stack

- Frontend: React (CRA) + Tailwind + shadcn/ui components
- Backend (primary): Node.js + Express.js (Groq Cloud for chatbot)
- Backend (legacy): FastAPI (kept for reference; not used by the UI now)

## Features (MVP)

- Contract upload (file or paste)
- Risk visualization cards (hover shadows + severity badges)
- Expandable explanation sections (accordion)
- Chat assistant powered by **Groq Cloud** with strict security guardrails

## Environment variables

### Frontend (`frontend/.env`)

- `REACT_APP_BACKEND_URL` (default: `http://localhost:8000`)

### Node backend (`backend-node/.env`)

Copy `backend-node/.env.example` → `backend-node/.env` and set:

- `PORT=8000`
- `CORS_ORIGINS=*`
- `GROQ_API_KEY=...` (your free Groq Cloud key)
- `GROQ_MODEL=llama-3.1-8b-instant` (default)

## API

- `POST /api/audit/analyze` → returns risk signals + explanations + `reportHash`
- `POST /api/chat` → returns assistant response + disclaimer
- `GET /health` → server health

## Develop (local)

### 1) Start backend

```bash
cd backend-node
npm install
cp .env.example .env
npm run dev
```

### 2) Start frontend

```bash
cd frontend
yarn
yarn start
```

## Notes

- The Node backend uses Groq’s OpenAI-compatible endpoint (`https://api.groq.com/openai/v1/chat/completions`).
- We do **not** store your API keys in code. Use `.env`.

## Next steps

- Foundry test integration (`forge test`) + pipe results into report
- Solidity on-chain proof contract: `storeReportHash(bytes32)`, `verifyReport(bytes32)`, `mintAuditNFT(...)`
- Optional MongoDB persistence for reports + chat sessions
