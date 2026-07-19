/**
 * Development work by David Lane
 *
 * Shared helpers for building pgvector-backed knowledge stores.
 * Used by the docs, ICE, and graph-node embedding backfills so they share
 * one embedding model, chunking, and OpenAI batch call.
 */
import crypto from 'crypto';

export const DEFAULT_EMBEDDING_MODEL =
  process.env.ENCOMPASS_EMBEDDING_MODEL || 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536;
const EMBED_INPUT_MAX = 8000;

/** Short, stable content hash used to skip re-embedding unchanged chunks. */
export function hashContent(text) {
  return crypto.createHash('sha256').update(String(text ?? '')).digest('hex').slice(0, 32);
}

/** Split long text into overlapping chunks. Short text returns a single chunk. */
export function chunkText(text, size = 1200, overlap = 150) {
  const clean = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

/** Format a numeric array as a pgvector literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

/**
 * Embed a batch of texts via the OpenAI embeddings REST API.
 * Returns embeddings in input order. Throws on non-2xx.
 */
export async function embedTexts(texts, apiKey, model = DEFAULT_EMBEDDING_MODEL) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: texts.map((t) => String(t ?? '').slice(0, EMBED_INPUT_MAX))
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Embeddings API ${res.status}: ${detail.slice(0, 240)}`);
  }
  const json = await res.json();
  return (json.data || [])
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
}

/**
 * Embed a single query string. Returns the vector, or null when no API key /
 * empty query, so callers can fall back to keyword search silently.
 */
export async function embedQuery(query, model = DEFAULT_EMBEDDING_MODEL) {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || !query) return null;

  const [vector] = await embedTexts([query], apiKey, model);
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) {
    throw new Error(`Unexpected embedding dimensions: ${vector?.length}`);
  }
  return vector;
}
