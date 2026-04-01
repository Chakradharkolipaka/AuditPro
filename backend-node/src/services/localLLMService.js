/**
 * localLLMService
 *
 * Thin reusable wrapper around a local Ollama server.
 *
 * - No auth (free/local-first). Auth can be added later by putting middleware in routes.
 * - Uses the Ollama REST API: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

const DEFAULT_BASE_URL = "http://localhost:11434";

function normalizeBaseUrl(url) {
  const u = String(url || "").trim();
  return u ? u.replace(/\/$/, "") : DEFAULT_BASE_URL;
}

/**
 * @typedef {{role:'system'|'user'|'assistant', content:string}} ChatMessage
 */

/**
 * Generate a completion using Ollama's /api/chat.
 *
 * @param {{messages: ChatMessage[], model?: string, temperature?: number, num_ctx?: number}} params
 * @returns {Promise<{content:string, raw:any}>}
 */
export async function ollamaChat({ messages, model, temperature = 0.2, num_ctx = 8192 }) {
  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const m = model || process.env.LLM_MODEL || "deepseek-coder:6.7b";

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      messages,
      stream: false,
      options: {
        temperature,
        num_ctx,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Ollama chat failed: ${resp.status} ${text}`);
    err.status = 502;
    throw err;
  }

  const data = await resp.json();
  const content = data?.message?.content ?? "";
  return { content: content || "(No response)", raw: data };
}

/**
 * Generate embeddings using Ollama's /api/embeddings.
 *
 * NOTE: Ollama requires an embeddings capable model (e.g. nomic-embed-text).
 * You can configure EMBEDDING_MODEL in .env.
 *
 * @param {{input: string|string[], model?: string}} params
 * @returns {Promise<{embeddings:number[][], raw:any}>}
 */
export async function ollamaEmbeddings({ input, model }) {
  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const embeddingModel = model || process.env.EMBEDDING_MODEL || "nomic-embed-text";

  const inputs = Array.isArray(input) ? input : [input];

  // Ollama embeddings endpoint accepts a single prompt;
  // we handle batching here for reuse.
  const embeddings = [];
  const raw = [];

  for (const prompt of inputs) {
    const resp = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: embeddingModel, prompt }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err = new Error(`Ollama embeddings failed: ${resp.status} ${text}`);
      err.status = 502;
      throw err;
    }

    const data = await resp.json();
    raw.push(data);
    if (!Array.isArray(data?.embedding)) {
      const err = new Error("Ollama embeddings response missing 'embedding' array");
      err.status = 502;
      throw err;
    }
    embeddings.push(data.embedding);
  }

  return { embeddings, raw };
}
