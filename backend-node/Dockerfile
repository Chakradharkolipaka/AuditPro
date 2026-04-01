FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Worker process (expects env vars: MONGODB_URI, UPSTASH_REDIS_URL, OLLAMA_BASE_URL, etc.)
CMD ["node", "src/workers/auditWorker.js"]
