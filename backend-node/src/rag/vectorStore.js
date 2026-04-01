/**
 * vectorStore (ChromaDB)
 *
 * This module stores/retrieves embeddings using ChromaDB.
 *
 * We use the HTTP client so Chroma can run as a local server.
 * - Default URL: http://localhost:8000 (user configurable via CHROMA_URL)
 * - Collection: auditpro
 */

import { ChromaClient } from "chromadb";

const DEFAULT_COLLECTION = "auditpro";

function getChromaClient() {
  const url = process.env.CHROMA_URL || "http://localhost:8000";
  return new ChromaClient({ path: url });
}

async function getCollection(name = DEFAULT_COLLECTION) {
  const client = getChromaClient();
  // getOrCreateCollection exists in chromadb js client.
  return await client.getOrCreateCollection({ name });
}

/**
 * Upsert documents.
 *
 * @param {{ids:string[], documents:string[], metadatas?:any[], embeddings:number[][], collection?:string}} params
 */
export async function upsertDocuments({ ids, documents, metadatas = [], embeddings, collection }) {
  const col = await getCollection(collection);
  await col.upsert({
    ids,
    documents,
    metadatas,
    embeddings,
  });
}

/**
 * Query similar documents.
 *
 * @param {{embedding:number[], topK:number, where?:any, collection?:string}} params
 * @returns {Promise<{documents:string[], metadatas:any[], distances:number[]}>}
 */
export async function querySimilar({ embedding, topK = 5, where, collection }) {
  const col = await getCollection(collection);
  const res = await col.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where,
    include: ["documents", "metadatas", "distances"],
  });

  const documents = res?.documents?.[0] || [];
  const metadatas = res?.metadatas?.[0] || [];
  const distances = res?.distances?.[0] || [];
  return { documents, metadatas, distances };
}
