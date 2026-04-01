/**
 * retriever
 *
 * Retrieves relevant context snippets from the vector store.
 */

import { embedTexts } from "./embeddingService.js";
import { querySimilar } from "./vectorStore.js";

/**
 * @param {{query:string, topK?:number}} params
 * @returns {Promise<Array<{text:string, metadata:any, distance:number}>>}
 */
export async function retrieveContexts({ query, topK = 5 }) {
  const [embedding] = await embedTexts([query]);
  const res = await querySimilar({ embedding, topK });

  const out = [];
  for (let i = 0; i < res.documents.length; i++) {
    out.push({ text: res.documents[i], metadata: res.metadatas[i], distance: res.distances[i] });
  }
  return out;
}
