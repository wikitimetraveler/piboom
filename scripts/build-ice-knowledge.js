/**
 * Development work by David Lane
 */
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  DEFAULT_EMBEDDING_MODEL,
  embedTexts,
  hashContent,
  chunkText,
  toVectorLiteral
} from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const SKIP_EMBED = process.env.ICE_SKIP_EMBED === '1';

const SOURCE_ROOT = path.join(ROOT_DIR, 'knowledge-sources', 'ice');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'knowledge');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ice-sources.json');

const SOURCE_REPOS = [
  { name: 'imt-developerconnect-dotnet-bindings', url: 'https://github.com/intercontinentalexchange/imt-developerconnect-dotnet-bindings' },
  { name: 'imt-integration-dotnetcore-sample-application', url: 'https://github.com/intercontinentalexchange/imt-integration-dotnetcore-sample-application' },
  { name: 'imt-loconnect-custom-tool-sample', url: 'https://github.com/intercontinentalexchange/imt-loconnect-custom-tool-sample' },
  { name: 'imt-exp20-token-exchange', url: 'https://github.com/intercontinentalexchange/imt-exp20-token-exchange' },
  { name: 'imt-exp20-ifb-scripting', url: 'https://github.com/intercontinentalexchange/imt-exp20-ifb-scripting' },
  { name: 'imt-epc-datadocs-mockinvestor', url: 'https://github.com/intercontinentalexchange/imt-epc-datadocs-mockinvestor' },
  { name: 'exp24-custom-form', url: 'https://github.com/intercontinentalexchange/exp24-custom-form' },
  { name: 'nyse-bqt-cloudstreaming', url: 'https://github.com/intercontinentalexchange/nyse-bqt-cloudstreaming' }
];

const ALLOWED_EXTENSIONS = new Set([
  '.md', '.mdx', '.markdown', '.txt', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.cs', '.json', '.http', '.html', '.htm', '.xml', '.yml', '.yaml', '.sql'
]);

const SKIP_FILENAMES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'dist', 'build', '.next', 'out', '.turbo', '.vscode', 'coverage']);

const MAX_FILE_SIZE = 256 * 1024; // 256 KB
const MAX_CONTENT_LENGTH = 8000;
const nowIso = new Date().toISOString();

const records = [];

const log = (msg) => console.log(`[ice-knowledge] ${msg}`);
const warn = (msg) => console.warn(`[ice-knowledge] ${msg}`);

const safeStat = async (filePath) => {
  try {
    return await fsp.stat(filePath);
  } catch {
    return null;
  }
};

const shouldIndexFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const base = path.basename(filePath);
  if (SKIP_FILENAMES.has(base)) return false;

  const stats = await safeStat(filePath);
  if (!stats || !stats.isFile()) return false;
  if (stats.size === 0 || stats.size > MAX_FILE_SIZE) return false;

  return true;
};

const walkFiles = async (dir) => {
  const files = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkFiles(absPath);
      files.push(...nested);
    } else {
      files.push(absPath);
    }
  }

  return files;
};

const summarize = (content, limit = 600) => {
  if (!content) return '';
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
};

const truncateContent = (content) => {
  if (!content) return '';
  return content.length > MAX_CONTENT_LENGTH
    ? `${content.slice(0, MAX_CONTENT_LENGTH)}\n…`
    : content;
};

const createRecord = (data) => {
  records.push({
    id: data.id,
    title: data.title,
    category: data.category,
    sourceType: data.sourceType,
    repo: data.repo,
    path: data.path,
    url: data.url,
    tags: data.tags || [],
    lastVerified: nowIso,
    executionAllowed: false,
    excerpt: data.excerpt,
    content: data.content
  });
};

const processRepo = async (repo) => {
  const repoPath = path.join(SOURCE_ROOT, 'repos', repo.name);
  if (!fs.existsSync(repoPath)) {
    warn(`Repo folder missing: ${repoPath}`);
    return;
  }

  log(`Indexing repo ${repo.name}`);
  const files = await walkFiles(repoPath);

  for (const absFile of files) {
    if (!(await shouldIndexFile(absFile))) continue;

    const relPath = path.relative(repoPath, absFile).replace(/\\/g, '/');
    let content;
    try {
      content = await fsp.readFile(absFile, 'utf8');
    } catch {
      continue;
    }

    const id = crypto.createHash('sha1')
      .update(`repo|${repo.name}|${relPath}`)
      .digest('hex');

    createRecord({
      id,
      title: `${repo.name}/${relPath}`,
      category: 'Code Reference',
      sourceType: 'code_reference',
      repo: repo.name,
      path: relPath,
      url: repo.url,
      excerpt: summarize(content),
      content: truncateContent(content)
    });
  }
};

const processPostmanCollections = async () => {
  const postmanDir = path.join(SOURCE_ROOT, 'postman');
  if (!fs.existsSync(postmanDir)) {
    warn(`Postman directory missing: ${postmanDir}`);
    return;
  }

  const entries = await fsp.readdir(postmanDir);
  const jsonFiles = entries.filter((name) => name.toLowerCase().endsWith('.json'));
  if (jsonFiles.length === 0) {
    warn('No Postman collection JSON files found.');
    return;
  }

  log(`Indexing Postman: ${jsonFiles.join(', ')}`);

  for (const file of jsonFiles) {
    const absPath = path.join(postmanDir, file);
    let parsed;
    try {
      parsed = JSON.parse(await fsp.readFile(absPath, 'utf8'));
    } catch (err) {
      warn(`Failed to parse Postman file ${file}: ${err.message}`);
      continue;
    }

    const collectionName = parsed.info?.name || file;
    const items = parsed.item || [];
    const flattenItems = (itemList, prefix = '') => {
      for (const item of itemList) {
        if (item.item && Array.isArray(item.item)) {
          flattenItems(item.item, prefix ? `${prefix} › ${item.name}` : item.name);
          continue;
        }

        const entryName = prefix ? `${prefix} › ${item.name}` : item.name;
        const request = item.request || {};
        const method = request.method || 'GET';
        const url = typeof request.url === 'string'
          ? request.url
          : request.url?.raw || '';
        const body = request.body?.raw || '';

        const id = crypto.createHash('sha1')
          .update(`postman|${file}|${entryName}`)
          .digest('hex');

        createRecord({
          id,
          title: entryName || collectionName,
          category: 'Postman Collection',
          sourceType: 'api_reference',
          repo: collectionName,
          path: file,
          url,
          tags: ['postman', method],
          excerpt: `${method} ${url}`.trim(),
          content: truncateContent(
            `${method} ${url}\nHeaders:\n${JSON.stringify(request.header || [], null, 2)}\n\nBody:\n${body}`
          )
        });
      }
    };

    flattenItems(items);
  }
};

const processDocs = async () => {
  const docsDir = path.join(SOURCE_ROOT, 'docs');
  if (!fs.existsSync(docsDir)) {
    warn(`Docs directory missing: ${docsDir}`);
    return;
  }

  const entries = await fsp.readdir(docsDir);
  if (entries.length === 0) {
    warn('No Developer Connect doc snapshots found.');
  }

  for (const file of entries) {
    const absPath = path.join(docsDir, file);
    if (!(await shouldIndexFile(absPath))) continue;

    let content;
    try {
      content = await fsp.readFile(absPath, 'utf8');
    } catch {
      continue;
    }

    const id = crypto.createHash('sha1')
      .update(`doc|${file}`)
      .digest('hex');

    createRecord({
      id,
      title: file,
      category: 'Developer Connect',
      sourceType: 'official_doc',
      repo: 'developer-connect',
      path: file,
      url: '',
      tags: ['developer-connect'],
      excerpt: summarize(content),
      content: truncateContent(content)
    });
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for transient Render/pg pool drops that are safe to retry. */
const isTransientDbError = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('connection terminated') ||
    msg.includes('connection ended') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('server closed the connection') ||
    msg.includes('timeout exceeded when trying to connect') ||
    err?.code === '57P01' || // admin_shutdown
    err?.code === '57P02' || // crash_shutdown
    err?.code === '57P03' // cannot_connect_now
  );
};

/**
 * Run a pool.query with reconnect+retry on transient disconnects.
 * Long ICE embeds against Render Postgres routinely hit idle drops; without
 * this the whole job dies after hours of progress.
 */
const withDbRetry = async (databaseService, sql, params, label = 'query') => {
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let pool = databaseService.getPool();
      if (!pool) {
        databaseService.initializeDatabase();
        pool = databaseService.getPool();
      }
      if (!pool) throw new Error('Database pool unavailable');
      return await pool.query(sql, params);
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === maxAttempts) throw err;
      const backoffMs = Math.min(30_000, 1000 * 2 ** (attempt - 1));
      warn(`${label} failed (${err.message}); reconnecting in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);
      try {
        const old = databaseService.getPool();
        if (old) await old.end().catch(() => {});
      } catch { /* ignore */ }
      databaseService.initializeDatabase();
      await sleep(backoffMs);
    }
  }
  throw lastErr;
};

/**
 * Chunk record content, embed in batches, and upsert into ice_knowledge_chunks.
 * Uses content_hash to skip unchanged chunks on re-runs. Non-fatal: falls back
 * to JSON-only when OPENAI_API_KEY / DATABASE_URL / pgvector are unavailable.
 */
const embedRecords = async () => {
  if (SKIP_EMBED) {
    log('Skipping embeddings (ICE_SKIP_EMBED=1)');
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

  const schema = await databaseService.ensureIceKnowledgeTable(pool);
  if (!schema.vector) {
    warn('pgvector not available — JSON index only');
    return { vectorReady: false, upserted: 0 };
  }

  // Expand records into embeddable chunks.
  const chunks = [];
  for (const record of records) {
    const parts = chunkText(record.content || record.excerpt || '');
    parts.forEach((part, idx) => {
      chunks.push({
        sourceId: `${record.id}:${idx}`,
        title: parts.length > 1 ? `${record.title} (${idx + 1}/${parts.length})` : record.title,
        url: record.url || null,
        category: record.category || 'reference',
        content: part,
        contentHash: hashContent(part),
        metadata: {
          sourceType: record.sourceType,
          repo: record.repo || null,
          path: record.path || null,
          tags: record.tags || []
        }
      });
    });
  }

  // Skip chunks whose content is unchanged since the last build.
  const existing = new Map();
  try {
    const { rows } = await withDbRetry(
      databaseService,
      'SELECT source_id, content_hash FROM ice_knowledge_chunks',
      undefined,
      'load hashes'
    );
    for (const row of rows) existing.set(row.source_id, row.content_hash);
  } catch { /* first run: table just created */ }

  const todo = chunks.filter((c) => existing.get(c.sourceId) !== c.contentHash);
  log(`Embedding ${todo.length}/${chunks.length} chunks (skipping ${chunks.length - todo.length} unchanged)`);

  let upserted = 0;
  const batchSize = 16;
  const upsertSql = `INSERT INTO ice_knowledge_chunks
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
           updated_at = CURRENT_TIMESTAMP`;

  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const embeddings = await embedTexts(
      batch.map((c) => `${c.title}\n\n${c.content}`),
      apiKey,
      DEFAULT_EMBEDDING_MODEL
    );

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const embedding = embeddings[j];
      if (!embedding) continue;
      await withDbRetry(
        databaseService,
        upsertSql,
        [
          c.sourceId,
          c.title,
          c.url,
          c.category,
          c.content,
          JSON.stringify(c.metadata),
          c.contentHash,
          toVectorLiteral(embedding)
        ],
        `upsert ${c.sourceId}`
      );
      upserted += 1;
    }
    if (i % (batchSize * 20) === 0) {
      log(`Embedded ${Math.min(i + batchSize, todo.length)}/${todo.length}`);
    }
  }

  return { vectorReady: chunks.length > 0, upserted };
};

const buildSummary = () => {
  const counts = records.reduce((acc, record) => {
    const type = record.sourceType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return counts;
};

const main = async () => {
  log('Starting ICE knowledge build...');
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });

  for (const repo of SOURCE_REPOS) {
    await processRepo(repo);
  }

  await processPostmanCollections();
  await processDocs();

  const { vectorReady, upserted } = await embedRecords();

  const payload = {
    lastIndexed: nowIso,
    counts: buildSummary(),
    vectorReady,
    vectorUpserted: upserted,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    records
  };

  await fsp.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  const postmanCount = records.filter((r) => r.category === 'Postman Collection').length;
  log(`Wrote ${records.length} knowledge records to ${OUTPUT_FILE}`);
  if (postmanCount > 0) log(`  Postman: ${postmanCount} requests | Repos: ${payload.counts.code_reference || 0} | Docs: ${payload.counts.official_doc || 0}`);
  log(`Vector upserts: ${upserted} (ready=${vectorReady})`);

  // Close the DB pool (if opened) so the process can exit cleanly.
  try {
    const databaseService = await import('../services/database.service.js');
    const pool = databaseService.getPool();
    if (pool) await pool.end();
  } catch { /* no pool to close */ }
};

main().catch((err) => {
  console.error('❌ Failed to build ICE knowledge base:', err);
  process.exitCode = 1;
});

