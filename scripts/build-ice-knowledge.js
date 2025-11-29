import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

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
  }

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

  const payload = {
    lastIndexed: nowIso,
    counts: buildSummary(),
    records
  };

  await fsp.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  log(`Wrote ${records.length} knowledge records to ${OUTPUT_FILE}`);
};

main().catch((err) => {
  console.error('❌ Failed to build ICE knowledge base:', err);
  process.exitCode = 1;
});

