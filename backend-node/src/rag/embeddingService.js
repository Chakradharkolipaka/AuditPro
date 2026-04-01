/**
 * embeddingService
 *
 * Produces vector embeddings for text chunks.
 * Default: Ollama embeddings (local). Plug in other embedders later.
 */

import { ollamaEmbeddings } from "../services/localLLMService.js";

/**
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(texts) {
  const { embeddings } = await ollamaEmbeddings({ input: texts });
  return embeddings;
}
