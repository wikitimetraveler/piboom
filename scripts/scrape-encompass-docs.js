/**
 * Development work by David Lane
 *
 * Refresh the official Encompass Developer Connect docs store used by the
 * Encompass Assistant + Unit Tests AI RAG retrieval, and (optionally) embed
 * the sections into Postgres pgvector for hybrid retrieval.
 *
 * Output: data/encompass-docs.json (commit the result, like ice-sources.json).
 * Vectors land in Postgres `encompass_docs_chunks` when DATABASE_URL,
 * OPENAI_API_KEY, and the pgvector extension are available.
 *
 * Usage:
 *   npm run scrape:encompass-docs
 *   ENCOMPASS_DOCS_SKIP_EMBED=1 npm run scrape:encompass-docs   # JSON only, no vectors
 */
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import encompassDocsService from '../services/encompass-docs.service.js';
import {
  DEFAULT_EMBEDDING_MODEL,
  embedTexts,
  hashContent,
  toVectorLiteral
} from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const DOCS_PATH = path.join(ROOT, 'data', 'encompass-docs.json');
const SKIP_EMBED = process.env.ENCOMPASS_DOCS_SKIP_EMBED === '1';

const log = (msg) => console.log(`[encompass-docs] ${msg}`);
const warn = (msg) => console.warn(`[encompass-docs] ${msg}`);

/** Build a stable source_id for a docs section. */
function sectionSourceId(section) {
  const key = section.url || `${section.category || 'misc'}:${section.title || 'untitled'}`;
  return `docs:${key}`.toLowerCase();
}

/** Embed docs sections and upsert into encompass_docs_chunks. */
async function embedSections(sections) {
  if (SKIP_EMBED) {
    log('Skipping embeddings (ENCOMPASS_DOCS_SKIP_EMBED=1)');
    return { vectorReady: false, upserted: 0 };
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    warn('OPENAI_API_KEY missing — JSON index only (no vectors)');
    return { vectorReady: false, upserted: 0 };
  }
  if (!process.env.DATABASE_URL) {
    warn('DATABASE_URL missing — JSON index only (no vectors)');
    return { vectorReady: false, upserted: 0 };
  }

  const databaseService = await import('../services/database.service.js');
  databaseService.initializeDatabase();
  const pool = databaseService.getPool();
  if (!pool) {
    warn('Database pool unavailable — JSON index only');
    return { vectorReady: false, upserted: 0 };
  }

  const schema = await databaseService.ensureEncompassDocsTable(pool);
  if (!schema.vector) {
    warn('pgvector not available — JSON index only');
    return { vectorReady: false, upserted: 0 };
  }

  const records = sections
    .map((section) => {
      const content = String(section.content || '').trim();
      if (!content) return null;
      return {
        sourceId: sectionSourceId(section),
        title: section.title || 'Untitled',
        url: section.url || null,
        category: section.category || 'reference',
        content,
        contentHash: hashContent(`${section.title || ''}\n\n${content}`),
        metadata: {
          sourceType: 'official_doc',
          seed: Boolean(section.seed),
          wordCount: section.wordCount || null
        }
      };
    })
    .filter(Boolean);

  let upserted = 0;
  const batchSize = 16;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const embeddings = await embedTexts(
      batch.map((r) => `${r.title}\n\n${r.content}`),
      apiKey,
      DEFAULT_EMBEDDING_MODEL
    );

    for (let j = 0; j < batch.length; j++) {
      const record = batch[j];
      const embedding = embeddings[j];
      if (!embedding) continue;
      await pool.query(
        `INSERT INTO encompass_docs_chunks
           (source_id, title, url, category, content, metadata, content_hash, embedding, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::vector, CURRENT_TIMESTAMP)
         ON CONFLICT (source_id) DO UPDATE SET
           title = EXCLUDED.title,
           url = EXCLUDED.url,
           category = EXCLUDED.category,
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           content_hash = EXCLUDED.content_hash,
           embedding = EXCLUDED.embedding,
           updated_at = CURRENT_TIMESTAMP`,
        [
          record.sourceId,
          record.title,
          record.url,
          record.category,
          record.content,
          JSON.stringify(record.metadata),
          record.contentHash,
          toVectorLiteral(embedding)
        ]
      );
      upserted += 1;
    }
    log(`Embedded ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  return { vectorReady: true, upserted };
}

const main = async () => {
  log('Starting Developer Connect documentation scrape...');
  const docs = await encompassDocsService.scrapeDocumentation();
  const sections = docs?.sections || [];
  log(`Store has ${sections.length} sections (lastUpdated ${docs?.lastUpdated}).`);

  const { vectorReady, upserted } = await embedSections(sections);

  // Persist vector status alongside the committed JSON store.
  try {
    const raw = await fsp.readFile(DOCS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    parsed.vectorReady = vectorReady;
    parsed.vectorUpserted = upserted;
    parsed.embeddingModel = DEFAULT_EMBEDDING_MODEL;
    await fsp.writeFile(DOCS_PATH, JSON.stringify(parsed, null, 2), 'utf8');
  } catch (err) {
    warn(`Could not update vector status in store: ${err.message}`);
  }

  log(`Vector upserts: ${upserted} (ready=${vectorReady})`);

  if (!sections.length) {
    log('No sections in store; verify network access to Developer Connect.');
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error('[encompass-docs] Failed to refresh documentation store:', err);
  process.exitCode = 1;
});
