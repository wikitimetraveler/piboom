/**
 * Development work by David Lane
 * Build GSE knowledge JSON (+ optional pgvector embeddings).
 *
 * Usage:
 *   npm run build:gse-knowledge
 *   GSE_SKIP_EMBED=1 npm run build:gse-knowledge
 */
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const SOURCE_ROOT = path.join(ROOT, 'knowledge-sources', 'gse');
const OUTPUT_DIR = path.join(ROOT, 'data', 'knowledge');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'gse-sources.json');
const RULE_META = path.join(ROOT, 'data', 'gse', 'rule-metadata.json');

const EMBEDDING_MODEL = process.env.GSE_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const SKIP_EMBED = process.env.GSE_SKIP_EMBED === '1';

const log = (msg) => console.log(`[gse-knowledge] ${msg}`);
const warn = (msg) => console.warn(`[gse-knowledge] ${msg}`);

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
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

async function walkMarkdown(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(abs)));
    } else if (/\.(md|mdx|txt)$/i.test(entry.name) && entry.name.toLowerCase() !== 'readme.md') {
      files.push(abs);
    }
  }
  return files;
}

function titleFromPath(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryFromRel(rel) {
  if (rel.includes('arm')) return 'arm';
  if (rel.includes('pool') || rel.includes('mbs')) return 'pooling';
  if (rel.includes('product') || rel.includes('agency')) return 'products';
  if (rel.startsWith('docs/')) return 'local-docs';
  return 'local';
}

async function loadLocalRecords() {
  const files = await walkMarkdown(SOURCE_ROOT);
  const records = [];

  for (const filePath of files) {
    const content = await fsp.readFile(filePath, 'utf8');
    const rel = path.relative(SOURCE_ROOT, filePath).replace(/\\/g, '/');
    const title = titleFromPath(filePath);
    const category = categoryFromRel(rel);
    const chunks = chunkText(content);
    chunks.forEach((chunk, idx) => {
      const sourceId = `local:${rel}:${idx}`;
      records.push({
        id: sourceId,
        title: chunks.length > 1 ? `${title} (${idx + 1}/${chunks.length})` : title,
        category,
        sourceType: 'local',
        url: '',
        path: rel,
        content: chunk,
        excerpt: chunk.slice(0, 400),
        tags: ['gse', 'local', category, ...rel.split('/')],
        contentHash: hashContent(chunk)
      });
    });
  }

  log(`Local files: ${files.length} → ${records.length} chunks`);
  return records;
}

async function loadRuleMetadataRecords() {
  if (!fs.existsSync(RULE_META)) return [];
  try {
    const raw = await fsp.readFile(RULE_META, 'utf8');
    const meta = JSON.parse(raw);
    const records = [];
    const disclaimer = String(meta.disclaimer || '').trim();
    if (disclaimer) {
      const content = `GSE analyzer disclaimer\n\n${disclaimer}`;
      records.push({
        id: 'meta:disclaimer:0',
        title: 'GSE analyzer disclaimer',
        category: 'policy',
        sourceType: 'rule_metadata',
        url: '',
        path: 'data/gse/rule-metadata.json',
        content,
        excerpt: content.slice(0, 400),
        tags: ['gse', 'policy', 'disclaimer'],
        contentHash: hashContent(content)
      });
    }

    for (const src of meta.sources || []) {
      if (!src?.id || !src?.url) continue;
      const content = [
        src.title || src.id,
        `Source id: ${src.id}`,
        `URL: ${src.url}`,
        'Official reference linked from the GSE scenario analyzer and knowledge bank.'
      ].join('\n');
      records.push({
        id: `meta:source:${src.id}`,
        title: src.title || src.id,
        category: 'official-source',
        sourceType: 'rule_metadata',
        url: src.url,
        path: 'data/gse/rule-metadata.json',
        content,
        excerpt: content.slice(0, 400),
        tags: ['gse', 'official', src.id],
        contentHash: hashContent(content)
      });
    }

    log(`Rule metadata → ${records.length} chunks`);
    return records;
  } catch (err) {
    warn(`Rule metadata skipped: ${err.message}`);
    return [];
  }
}

async function embedTexts(texts, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 8000))
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

async function upsertVectors(records) {
  if (SKIP_EMBED) {
    log('Skipping embeddings (GSE_SKIP_EMBED=1)');
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
    warn('Database pool unavailable');
    return { vectorReady: false, upserted: 0 };
  }

  const schema = await databaseService.ensureGseKnowledgeTable(pool);
  if (!schema.vector) {
    warn('pgvector not available — JSON index only');
    return { vectorReady: false, upserted: 0 };
  }

  let upserted = 0;
  const batchSize = 16;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const embeddings = await embedTexts(
      batch.map((r) => `${r.title}\n\n${r.content}`),
      apiKey
    );

    for (let j = 0; j < batch.length; j++) {
      const record = batch[j];
      const embedding = embeddings[j];
      if (!embedding) continue;
      const vectorLiteral = `[${embedding.join(',')}]`;
      await pool.query(
        `INSERT INTO gse_knowledge_chunks
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
          record.id,
          record.title,
          record.url || null,
          record.category || 'gse',
          record.content,
          JSON.stringify({
            sourceType: record.sourceType,
            path: record.path || null,
            tags: record.tags || []
          }),
          record.contentHash,
          vectorLiteral
        ]
      );
      upserted += 1;
    }
    log(`Embedded ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  return { vectorReady: true, upserted };
}

async function main() {
  const local = await loadLocalRecords();
  const meta = await loadRuleMetadataRecords();
  const records = [...local, ...meta];

  if (!records.length) {
    warn('No records indexed');
  }

  const { vectorReady, upserted } = await upsertVectors(records);

  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  const payload = {
    lastIndexed: new Date().toISOString(),
    vectorReady,
    vectorUpserted: upserted,
    embeddingModel: EMBEDDING_MODEL,
    records: records.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      sourceType: r.sourceType,
      url: r.url,
      path: r.path,
      content: r.content,
      excerpt: r.excerpt,
      tags: r.tags,
      contentHash: r.contentHash
    }))
  };

  await fsp.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  log(`Wrote ${payload.records.length} records → ${path.relative(ROOT, OUTPUT_FILE)}`);
  log(`Vector upserts: ${upserted} (ready=${vectorReady})`);
}

main().catch((err) => {
  console.error('[gse-knowledge] FATAL:', err);
  process.exit(1);
});
