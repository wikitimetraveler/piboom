/**
 * General file transfer — docs & spreadsheets stored under data/file-transfers.
 * Development work by David Lane
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..', 'data', 'file-transfers');

/** Max bytes per file (25 MB). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Allowed extensions for docs, spreadsheets, and zip bundles. */
export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.odt',
  '.xlsx',
  '.xls',
  '.csv',
  '.ods',
  '.pptx',
  '.ppt',
  '.zip',
]);

const SPREADSHEET_EXT = new Set(['.xlsx', '.xls', '.csv', '.ods']);
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pptx', '.ppt']);

let transferDirOverride = null;

export function setTransferDirForTests(dir) {
  transferDirOverride = dir || null;
}

export function getTransferDir() {
  if (transferDirOverride) return transferDirOverride;
  if (process.env.FILE_TRANSFER_DIR) return path.resolve(process.env.FILE_TRANSFER_DIR);
  return DEFAULT_DIR;
}

function manifestPath() {
  return path.join(getTransferDir(), 'manifest.json');
}

function sanitizeOriginalName(name) {
  const base = path.basename(String(name || 'upload')).replace(/[<>:"|?*\x00-\x1f]/g, '_');
  return base.slice(0, 180) || 'upload';
}

function extensionOf(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return ext;
}

export function classifyKind(originalName) {
  const ext = extensionOf(originalName);
  if (SPREADSHEET_EXT.has(ext)) return 'spreadsheet';
  if (DOC_EXT.has(ext)) return 'document';
  if (ext === '.zip') return 'archive';
  return 'other';
}

export function isAllowedUpload(originalName, mimeType) {
  const ext = extensionOf(originalName);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  // Mime is advisory only — browsers disagree on Office types.
  void mimeType;
  return true;
}

async function ensureDir() {
  const dir = getTransferDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readManifest() {
  await ensureDir();
  try {
    const raw = await fs.readFile(manifestPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.files) ? parsed : { files: [] };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err instanceof SyntaxError)) {
      return { files: [] };
    }
    throw err;
  }
}

async function writeManifest(manifest) {
  await ensureDir();
  const payload = {
    files: Array.isArray(manifest?.files) ? manifest.files : [],
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(manifestPath(), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function publicRecord(row) {
  return {
    id: row.id,
    originalName: row.originalName,
    note: row.note || '',
    kind: row.kind || classifyKind(row.originalName),
    mimeType: row.mimeType || 'application/octet-stream',
    bytes: row.bytes || 0,
    createdAt: row.createdAt,
  };
}

/**
 * Save one uploaded file.
 * @param {{ buffer: Buffer, originalName: string, mimeType?: string, note?: string }} input
 */
export async function saveTransferFile({ buffer, originalName, mimeType, note } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('FILE_REQUIRED');
    err.code = 'FILE_REQUIRED';
    throw err;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error('FILE_TOO_LARGE');
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }
  const safeName = sanitizeOriginalName(originalName);
  if (!isAllowedUpload(safeName, mimeType)) {
    const err = new Error('FILE_TYPE_NOT_ALLOWED');
    err.code = 'FILE_TYPE_NOT_ALLOWED';
    throw err;
  }

  const id = crypto.randomUUID();
  const ext = extensionOf(safeName);
  const storedName = `${id}${ext}`;
  const dir = await ensureDir();
  await fs.writeFile(path.join(dir, storedName), buffer);

  const record = {
    id,
    originalName: safeName,
    storedName,
    note: String(note || '').trim().slice(0, 240),
    kind: classifyKind(safeName),
    mimeType: mimeType || 'application/octet-stream',
    bytes: buffer.length,
    createdAt: new Date().toISOString(),
  };

  const manifest = await readManifest();
  manifest.files.unshift(record);
  await writeManifest(manifest);
  return publicRecord(record);
}

export async function listTransferFiles() {
  const manifest = await readManifest();
  return manifest.files
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(publicRecord);
}

export async function getTransferFile(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const manifest = await readManifest();
  const row = manifest.files.find((f) => f.id === key);
  if (!row) return null;
  const filePath = path.join(getTransferDir(), row.storedName);
  try {
    const buffer = await fs.readFile(filePath);
    return { meta: publicRecord(row), buffer, filePath };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function deleteTransferFile(id) {
  const key = String(id || '').trim();
  if (!key) return false;
  const manifest = await readManifest();
  const idx = manifest.files.findIndex((f) => f.id === key);
  if (idx === -1) return false;
  const [row] = manifest.files.splice(idx, 1);
  await writeManifest(manifest);
  try {
    await fs.unlink(path.join(getTransferDir(), row.storedName));
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
  return true;
}
