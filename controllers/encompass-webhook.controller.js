/**
 * Development work by David Lane
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'encompass-webhooks.log');
const SIGNING_KEY = (process.env.ENCOMPASS_WEBHOOK_SIGNING_KEY || '').trim();
const DEBUG =
  (process.env.ENCOMPASS_WEBHOOK_DEBUG || '').trim().toLowerCase() === 'true';
const BYPASS_SIGNATURE =
  (process.env.ENCOMPASS_WEBHOOK_BYPASS_SIGNATURE || '')
    .trim()
    .toLowerCase() === 'true';

function logDebug(payload) {
  if (DEBUG) {
    console.log('[EncompassWebhook][debug]', payload);
  }
}

function unauthorized(res) {
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

function invalidSignature(res, message) {
  logDebug({ step: 'invalidSignature', message });
  console.warn(message);
  return unauthorized(res);
}

function verifySignature(req, res) {
  if (BYPASS_SIGNATURE) {
    console.warn(
      'Encompass webhook signature verification is bypassed via ENCOMPASS_WEBHOOK_BYPASS_SIGNATURE'
    );
    logDebug({ step: 'bypass-signature' });
    return true;
  }

  if (!SIGNING_KEY) {
    return invalidSignature(res, 'Encompass webhook signing key not configured');
  }

  const signatureHeader = (req.headers['elli-signature'] || '').trim();
  if (!signatureHeader) {
    return invalidSignature(res, 'Missing Elli-Signature header');
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return invalidSignature(res, 'Missing raw body for signature verification');
  }

  const rawHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  logDebug({
    step: 'received',
    rawLength: rawBody.length,
    rawSha256: rawHash
  });

  const expected = crypto
    .createHmac('sha256', SIGNING_KEY)
    .update(rawBody)
    .digest('base64');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    logDebug({
      step: 'length-mismatch',
      expectedLength: expectedBuf.length,
      providedLength: providedBuf.length,
      expectedPreview: `${expected.slice(0, 6)}...`,
      providedPreview: `${signatureHeader.slice(0, 6)}...`
    });
    return invalidSignature(res, 'Signature length mismatch');
  }

  const matches = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!matches) {
    logDebug({
      step: 'mismatch',
      expectedLength: expectedBuf.length,
      providedLength: providedBuf.length,
      expectedPreview: `${expected.slice(0, 6)}...`,
      providedPreview: `${signatureHeader.slice(0, 6)}...`
    });
    return invalidSignature(res, 'Invalid Elli-Signature');
  }

  logDebug({
    step: 'verified',
    providedLength: providedBuf.length,
    providedPreview: `${signatureHeader.slice(0, 6)}...`
  });
  return true;
}

/**
 * Receive Encompass/ICE webhook payloads.
 * - Requires HMAC signature (Elli-Signature) using ENCOMPASS_WEBHOOK_SIGNING_KEY.
 * - Accepts JSON, logs to console, and appends raw payloads to a local log file.
 * - Keeps response lightweight to avoid retries/timeouts.
 */
export async function receive(req, res) {
  const { headers, body } = req;

  if (verifySignature(req, res) !== true) {
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
// TODO: Add IP allowlisting when provided by Encompass/ICE.
