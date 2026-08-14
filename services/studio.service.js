/**
 * Browser Studio — LiveKit tokens, reel sessions, client-side bounce catalog
 * Development work by David Lane
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './database.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELEASE_DIR = path.join(__dirname, '../data/studio-releases');

const REEL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const memorySessions = new Map();
const memoryReleases = new Map();

/** @type {null | ((opts: object) => Promise<string>)} */
let livekitTokenFactory = null;

export function setLivekitTokenFactory(factory) {
  livekitTokenFactory = typeof factory === 'function' ? factory : null;
}

export function normalizeReelCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function createReelCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += REEL_ALPHABET[Math.floor(Math.random() * REEL_ALPHABET.length)];
  }
  return code;
}

export function livekitRoomName(code) {
  const reel = normalizeReelCode(code) || 'lobby';
  return `studio-${reel}`;
}

export function sanitizeDisplayName(raw) {
  const name = String(raw || '')
    .replace(/[\r\n<>]/g, '')
    .trim()
    .slice(0, 40);
  return name || 'Player';
}

export function getLivekitConfig() {
  const url = String(process.env.LIVEKIT_URL || '').trim();
  const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
  return {
    url,
    apiKey,
    apiSecret,
    configured: Boolean(url && apiKey && apiSecret),
  };
}

export const STARBAND_AGENT_NAME = 'StarBand';

async function defaultMintToken({ roomName, identity, name, canPublish }) {
  const { AccessToken, RoomAgentDispatch, RoomConfiguration } = await import('livekit-server-sdk');
  const { apiKey, apiSecret } = getLivekitConfig();
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: '6h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: canPublish !== false,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: STARBAND_AGENT_NAME })],
  });
  return token.toJwt();
}

export async function mintLivekitToken({
  reelCode,
  identity,
  name,
  canPublish = true,
} = {}) {
  const config = getLivekitConfig();
  if (!config.configured) {
    const err = new Error('LIVEKIT_NOT_CONFIGURED');
    err.code = 'LIVEKIT_NOT_CONFIGURED';
    throw err;
  }
  const roomName = livekitRoomName(reelCode);
  const participantName = sanitizeDisplayName(name);
  const participantId = String(identity || `${participantName}-${Date.now()}`)
    .replace(/[^\w.-]/g, '-')
    .slice(0, 64);
  const factory = livekitTokenFactory || defaultMintToken;
  const jwt = await factory({
    roomName,
    identity: participantId,
    name: participantName,
    canPublish,
  });
  return {
    token: jwt,
    url: config.url,
    roomName,
    identity: participantId,
    name: participantName,
    agentName: STARBAND_AGENT_NAME,
  };
}

function sessionRecord(code, title) {
  return {
    code,
    title: String(title || 'Untitled reel').slice(0, 80),
    livekitRoom: livekitRoomName(code),
    createdAt: new Date().toISOString(),
  };
}

export async function createSession({ title } = {}) {
  const code = createReelCode();
  const session = sessionRecord(code, title);
  memorySessions.set(code, session);
  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO studio_sessions (code, title, livekit_room)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [session.code, session.title, session.livekitRoom]
      );
    } catch (_) {
      /* table may not exist in tests */
    }
  }
  return session;
}

export async function getSession(rawCode) {
  const code = normalizeReelCode(rawCode);
  if (!code) return null;
  if (memorySessions.has(code)) return memorySessions.get(code);
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT code, title, livekit_room AS "livekitRoom", created_at AS "createdAt"
         FROM studio_sessions WHERE code = $1`,
        [code]
      );
      if (rows[0]) {
        const session = {
          code: rows[0].code,
          title: rows[0].title,
          livekitRoom: rows[0].livekitRoom,
          createdAt: rows[0].createdAt,
        };
        memorySessions.set(code, session);
        return session;
      }
    } catch (_) {
      /* ignore */
    }
  }
  const session = sessionRecord(code, `Reel ${code}`);
  memorySessions.set(code, session);
  return session;
}

export async function ensureReleaseDir() {
  await fs.mkdir(RELEASE_DIR, { recursive: true });
  return RELEASE_DIR;
}

export function releaseDir() {
  return RELEASE_DIR;
}

export async function addRelease({
  title,
  artist,
  reelCode,
  originalName,
  buffer,
  mimeType,
} = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 32) {
    const err = new Error('AUDIO_REQUIRED');
    err.code = 'AUDIO_REQUIRED';
    throw err;
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = /\.wav$/i.test(originalName || '') ? '.wav' : '.webm';
  await ensureReleaseDir();
  const filename = `${id}${ext}`;
  const filePath = path.join(RELEASE_DIR, filename);
  await fs.writeFile(filePath, buffer);
  const release = {
    id,
    title: String(title || 'Untitled bounce').slice(0, 120),
    artist: String(artist || '').slice(0, 80),
    reelCode: normalizeReelCode(reelCode) || null,
    filename,
    mimeType: mimeType || (ext === '.wav' ? 'audio/wav' : 'audio/webm'),
    bytes: buffer.length,
    createdAt: new Date().toISOString(),
  };
  memoryReleases.set(id, release);
  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO studio_releases (id, title, artist, reel_code, filename, mime_type, bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, release.title, release.artist, release.reelCode, filename, release.mimeType, release.bytes]
      );
    } catch (_) {
      /* optional */
    }
  }
  return release;
}

export async function listReleases() {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, artist, reel_code AS "reelCode", filename, mime_type AS "mimeType",
                bytes, created_at AS "createdAt"
         FROM studio_releases
         ORDER BY created_at DESC
         LIMIT 50`
      );
      if (rows.length) return rows;
    } catch (_) {
      /* fall through */
    }
  }
  return [...memoryReleases.values()].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
}

export async function getRelease(id) {
  const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;
  if (memoryReleases.has(safeId)) return memoryReleases.get(safeId);
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, artist, reel_code AS "reelCode", filename, mime_type AS "mimeType",
                bytes, created_at AS "createdAt"
         FROM studio_releases WHERE id = $1`,
        [safeId]
      );
      if (rows[0]) return rows[0];
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

export async function resolveReleaseFile(release) {
  if (!release?.filename) return null;
  const filePath = path.join(RELEASE_DIR, path.basename(release.filename));
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export function getStudioStatus() {
  const livekit = getLivekitConfig();
  return {
    ok: true,
    livekitConfigured: livekit.configured,
    livekitUrl: livekit.configured ? livekit.url : null,
    agentName: STARBAND_AGENT_NAME,
    openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
    listenConfigured: true,
  };
}

export default {
  STARBAND_AGENT_NAME,
  setLivekitTokenFactory,
  normalizeReelCode,
  createReelCode,
  livekitRoomName,
  sanitizeDisplayName,
  getLivekitConfig,
  mintLivekitToken,
  createSession,
  getSession,
  addRelease,
  listReleases,
  getRelease,
  resolveReleaseFile,
  getStudioStatus,
  ensureReleaseDir,
  releaseDir,
};
