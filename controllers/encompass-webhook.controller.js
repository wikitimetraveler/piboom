import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'encompass-webhooks.log');

// Prefer webhook-specific creds; fall back to general Encompass creds.
const BASIC_USER =
  process.env.ENCOMPASS_WEBHOOK_USER || process.env.ENCOMPASS_USERNAME || '';
const BASIC_PASS =
  process.env.ENCOMPASS_WEBHOOK_PASS || process.env.ENCOMPASS_PASSWORD || '';

function unauthorized(res) {
  res.set('WWW-Authenticate', 'Basic realm="Encompass Webhook"');
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

function checkBasicAuth(req, res) {
  if (!BASIC_USER || !BASIC_PASS) {
    console.warn('Encompass webhook credentials not configured; rejecting');
    return unauthorized(res);
  }
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    return unauthorized(res);
  }
  const base64 = authHeader.slice('Basic '.length);
  let decoded = '';
  try {
    decoded = Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return unauthorized(res);
  }
  const [user, pass] = decoded.split(':');
  if (user !== BASIC_USER || pass !== BASIC_PASS) {
    return unauthorized(res);
  }
  return true;
}

/**
 * Receive Encompass/ICE webhook payloads.
 * - Requires Basic Auth (401 if missing or misconfigured).
 * - Accepts JSON, logs to console, and appends raw payloads to a local log file.
 * - Keeps response lightweight to avoid retries/timeouts.
 */
export async function receive(req, res) {
  const { headers, body } = req;

  if (checkBasicAuth(req, res) !== true) {
    return; // Response already sent
  }

  if (body === undefined) {
    return res.status(400).json({ success: false, error: 'Expected JSON body' });
  }

  const receivedAt = new Date().toISOString();
  const entry = {
    receivedAt,
    headers,
    body
  };

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.warn('⚠️ Failed to persist Encompass webhook payload:', err.message);
  }

  console.log('📥 Encompass webhook received', {
    receivedAt,
    bodyType: body === null ? 'null' : typeof body
  });

  res.json({ success: true });
}
// TODO: Add IP allowlisting or shared-secret signature verification when provided by Encompass/ICE.

