/**
 * Development work by David Lane
 * Build HeyGen knowledge JSON (+ optional pgvector embeddings).
 *
 * Usage:
 *   npm run build:heygen-knowledge
 *   HEYGEN_DOCS_FETCH=0 npm run build:heygen-knowledge   # local files only
 *   HEYGEN_SKIP_EMBED=1 npm run build:heygen-knowledge   # skip Postgres vectors
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

const SOURCE_ROOT = path.join(ROOT, 'knowledge-sources', 'heygen');
const OUTPUT_DIR = path.join(ROOT, 'data', 'knowledge');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'heygen-sources.json');

const EMBEDDING_MODEL = process.env.HEYGEN_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const FETCH_ENABLED = process.env.HEYGEN_DOCS_FETCH !== '0';
const SKIP_EMBED = process.env.HEYGEN_SKIP_EMBED === '1';

/** Priority official docs (Mintlify .md URLs resolve for agents). */
const REMOTE_DOCS = [
  { title: 'For AI Agents', url: 'https://developers.heygen.com/docs/for-ai-agents.md', category: 'agents' },
  { title: 'Quick Start', url: 'https://developers.heygen.com/docs/quick-start.md', category: 'getting-started' },
  { title: 'Video Agent Overview', url: 'https://developers.heygen.com/docs/overview.md', category: 'video-agent' },
  { title: 'Prompt to Video', url: 'https://developers.heygen.com/docs/video-agent.md', category: 'video-agent' },
  { title: 'Choosing the Right Video API', url: 'https://developers.heygen.com/docs/choosing-the-right-video-api.md', category: 'getting-started' },
  { title: 'Styles & References', url: 'https://developers.heygen.com/docs/styles-and-references.md', category: 'video-agent' },
  { title: 'Upload Assets', url: 'https://developers.heygen.com/docs/upload-assets.md', category: 'assets' },
  { title: 'Interactive Sessions', url: 'https://developers.heygen.com/docs/interactive-sessions.md', category: 'video-agent' },
  { title: 'Create Avatar', url: 'https://developers.heygen.com/docs/create-avatar.md', category: 'avatars' },
  { title: 'Avatar Looks', url: 'https://developers.heygen.com/docs/avatar-looks.md', category: 'avatars' },
  { title: 'Voices Overview', url: 'https://developers.heygen.com/docs/voices/overview.md', category: 'voices' },
  { title: 'Video Translation', url: 'https://developers.heygen.com/docs/video-translate.md', category: 'translation' },
  { title: 'Webhooks', url: 'https://developers.heygen.com/docs/webhooks.md', category: 'webhooks' },
  { title: 'MCP Overview', url: 'https://developers.heygen.com/mcp/overview.md', category: 'mcp' },
  { title: 'Hyperframes Overview', url: 'https://developers.heygen.com/hyperframes-overview.md', category: 'hyperframes' },
  { title: 'Endpoint Version Comparison', url: 'https://developers.heygen.com/endpoint-version-comparison.md', category: 'versioning' },
  { title: 'Create Video (API Reference)', url: 'https://developers.heygen.com/reference/create-video.md', category: 'api-reference' },
  { title: 'Create Video Agent Session', url: 'https://developers.heygen.com/reference/create-video-agent-session.md', category: 'api-reference' }
];

const log = (msg) => console.log(`[heygen-knowledge] ${msg}`);
const warn = (msg) => console.warn(`[heygen-knowledge] ${msg}`);

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

function titleFromPath(filePath, fallback) {
  const base = path.basename(filePath, path.extname(filePath));
  return fallback || base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadLocalRecords() {
  const files = await walkMarkdown(SOURCE_ROOT);
  const records = [];

  for (const filePath of files) {
    const content = await fsp.readFile(filePath, 'utf8');
    const rel = path.relative(SOURCE_ROOT, filePath).replace(/\\/g, '/');
    const title = titleFromPath(filePath);
    const chunks = chunkText(content);
    chunks.forEach((chunk, idx) => {
      const sourceId = `local:${rel}:${idx}`;
      records.push({
        id: sourceId,
        title: chunks.length > 1 ? `${title} (${idx + 1}/${chunks.length})` : title,
        category: rel.startsWith('docs/') ? 'local-docs' : 'local',
        sourceType: 'local',
        url: '',
        path: rel,
        content: chunk,
        excerpt: chunk.slice(0, 400),
        tags: ['heygen', 'local', ...rel.split('/')],
        contentHash: hashContent(chunk)
      });
    });
  }

  log(`Local files: ${files.length} → ${records.length} chunks`);
  return records;
}

async function fetchRemoteRecords() {
  if (!FETCH_ENABLED) {
    log('Remote fetch disabled (HEYGEN_DOCS_FETCH=0)');
    return [];
  }

  const records = [];
  for (const doc of REMOTE_DOCS) {
    try {
      const res = await fetch(doc.url, {
        headers: { Accept: 'text/markdown, text/plain, */*', 'User-Agent': 'DevConnectLabs-HeyGenKnowledge/1.0' }
      });
      if (!res.ok) {
        warn(`Fetch ${doc.url} → ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!text || text.length < 40) {
        warn(`Empty body: ${doc.url}`);
        continue;
      }
      const chunks = chunkText(text);
      chunks.forEach((chunk, idx) => {
        const sourceId = `remote:${doc.url}:${idx}`;
        records.push({
          id: sourceId,
          title: chunks.length > 1 ? `${doc.title} (${idx + 1}/${chunks.length})` : doc.title,
          category: doc.category,
          sourceType: 'official_doc',
          url: doc.url.replace(/\.md$/, ''),
          path: '',
          content: chunk,
          excerpt: chunk.slice(0, 400),
          tags: ['heygen', 'official', doc.category],
          contentHash: hashContent(chunk)
        });
      });
      log(`Fetched: ${doc.title} (${chunks.length} chunks)`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      warn(`Fetch failed ${doc.url}: ${err.message}`);
    }
  }
  return records;
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
    log('Skipping embeddings (HEYGEN_SKIP_EMBED=1)');
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

  const schema = await databaseService.ensureHeygenKnowledgeTable(pool);
  if (!schema.vector) {
    warn('pgvector not available — JSON index only');
    return { vectorReady: false, upserted: 0 };
  }

  let upserted = 0;
  const batchSize = 16;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map((r) => `${r.title}\n\n${r.content}`), apiKey);

    for (let j = 0; j < batch.length; j++) {
      const record = batch[j];
      const embedding = embeddings[j];
      if (!embedding) continue;
      const vectorLiteral = `[${embedding.join(',')}]`;
      await pool.query(
        `INSERT INTO heygen_knowledge_chunks
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
          record.category || 'heygen',
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
  const remote = await fetchRemoteRecords();
  const records = [...local, ...remote];

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
  console.error('[heygen-knowledge] FATAL:', err);
  process.exit(1);
});
