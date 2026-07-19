/**
 * Development work by David Lane
 *
 * GraphRAG backfill: embed disaster-impact graph nodes into the pgvector
 * `graph_nodes.embedding` column so nodes can be retrieved by semantic
 * similarity (findSimilarNodes) alongside structural NEAR / CTE traversal.
 *
 * Usage:
 *   npm run embed:graph-nodes
 *   GRAPH_EMBED_FORCE=1 npm run embed:graph-nodes   # re-embed all nodes
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  DEFAULT_EMBEDDING_MODEL,
  embedTexts,
  toVectorLiteral
} from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const FORCE = process.env.GRAPH_EMBED_FORCE === '1';
const log = (msg) => console.log(`[graph-embeddings] ${msg}`);
const warn = (msg) => console.warn(`[graph-embeddings] ${msg}`);

/** Compose the text embedded per node: type, label, and salient metadata. */
function nodeText(node) {
  const md = node.metadata_json || {};
  const bits = [`${node.node_type}: ${node.label}`];
  for (const key of ['name', 'title', 'summary', 'description', 'city', 'state', 'county', 'hazard', 'status']) {
    if (md[key]) bits.push(`${key}: ${md[key]}`);
  }
  return bits.join('\n').slice(0, 8000);
}

async function main() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    warn('OPENAI_API_KEY missing — nothing to embed');
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    warn('DATABASE_URL missing — nothing to embed');
    process.exitCode = 1;
    return;
  }

  const databaseService = await import('../services/database.service.js');
  databaseService.initializeDatabase();
  const pool = databaseService.getPool();
  if (!pool) {
    warn('Database pool unavailable');
    process.exitCode = 1;
    return;
  }

  const graph = await import('../services/disaster-impact-graph.service.js');
  await graph.initDisasterImpactGraphSchema();

  if (!(await databaseService.isPgvectorAvailable())) {
    warn('pgvector not available — cannot embed graph nodes');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const where = FORCE ? '' : 'WHERE embedding IS NULL';
  const { rows: nodes } = await pool.query(
    `SELECT id, node_type, label, metadata_json FROM graph_nodes ${where}`
  );
  log(`Embedding ${nodes.length} nodes${FORCE ? ' (force)' : ' (missing only)'}`);

  let upserted = 0;
  const batchSize = 16;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map(nodeText), apiKey, DEFAULT_EMBEDDING_MODEL);

    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const embedding = embeddings[j];
      if (!embedding) continue;
      await pool.query(
        'UPDATE graph_nodes SET embedding = $1::vector, updated_at = NOW() WHERE id = $2',
        [toVectorLiteral(embedding), node.id]
      );
      upserted += 1;
    }
    log(`Embedded ${Math.min(i + batchSize, nodes.length)}/${nodes.length}`);
  }

  log(`Graph node embeddings upserted: ${upserted}`);
  await pool.end();
}

main().catch((err) => {
  console.error('[graph-embeddings] FATAL:', err);
  process.exit(1);
});
