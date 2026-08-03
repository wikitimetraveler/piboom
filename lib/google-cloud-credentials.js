/**
 * Resolve Google Cloud client options for Speech / TTS on local and Render.
 * Development work by David Lane
 *
 * Prefer inline JSON on cloud hosts (no credential file on disk):
 *   GOOGLE_CREDENTIALS_JSON  (or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CLOUD_CREDENTIALS_JSON)
 * Also accepts JSON pasted into GOOGLE_APPLICATION_CREDENTIALS (starts with `{`).
 * Else a readable key file via GOOGLE_APPLICATION_CREDENTIALS / ./google-credentials.json
 */
import fs from 'fs';
import path from 'path';

let lastSource = 'none';

function tryParseCredentials(raw, sourceLabel) {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text) return null;

  // Strip wrapping single/double quotes from dashboard paste.
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    text = text.slice(1, -1).trim();
  }

  // Base64-encoded service account JSON (some hosts store secrets this way).
  if (!text.startsWith('{')) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) text = decoded;
    } catch (_) {
      /* not base64 */
    }
  }

  if (!text.startsWith('{')) return null;

  try {
    const credentials = JSON.parse(text);
    if (!credentials || typeof credentials !== 'object') return null;
    // Render often stores private_key with literal \n sequences.
    if (typeof credentials.private_key === 'string' && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    lastSource = sourceLabel;
    return credentials;
  } catch (err) {
    console.warn(`${sourceLabel} is not valid JSON:`, err.message);
    return null;
  }
}

function parseInlineCredentials() {
  const candidates = [
    ['GOOGLE_CREDENTIALS_JSON', process.env.GOOGLE_CREDENTIALS_JSON],
    ['GOOGLE_SERVICE_ACCOUNT_JSON', process.env.GOOGLE_SERVICE_ACCOUNT_JSON],
    ['GOOGLE_CLOUD_CREDENTIALS_JSON', process.env.GOOGLE_CLOUD_CREDENTIALS_JSON],
    // People sometimes paste the JSON into the path variable by mistake.
    ['GOOGLE_APPLICATION_CREDENTIALS(json)', process.env.GOOGLE_APPLICATION_CREDENTIALS]
  ];
  for (const [label, value] of candidates) {
    const parsed = tryParseCredentials(value, label);
    if (parsed) return parsed;
  }
  return null;
}

function firstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.resolve(candidate);
      }
    } catch (_) {
      /* try next */
    }
  }
  return null;
}

/**
 * @returns {{ credentials?: object, keyFilename?: string, projectId?: string }}
 */
export function resolveGoogleClientOptions() {
  lastSource = 'none';
  const inline = parseInlineCredentials();
  if (inline) {
    // Inline JSON wins — clear a stale absolute path so ADC does not keep failing.
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId =
      inline.project_id ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT_ID ||
      undefined;
    console.log(`🎤 Google Cloud credentials: inline via ${lastSource}`);
    return projectId ? { credentials: inline, projectId } : { credentials: inline };
  }

  const envPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const candidates = [];
  if (envPath && !envPath.startsWith('{')) {
    candidates.push(envPath);
    if (!path.isAbsolute(envPath)) {
      candidates.push(path.resolve(process.cwd(), envPath));
    }
  }
  candidates.push(path.resolve(process.cwd(), 'google-credentials.json'));

  const keyFilename = firstExistingFile(candidates);
  if (keyFilename) {
    // Point ADC at a real file — Render often has a stale absolute path like /google-credentials.json
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
    lastSource = `file:${keyFilename}`;
    console.log(`🎤 Google Cloud credentials: key file ${keyFilename}`);
    return { keyFilename };
  }

  if (envPath && !envPath.startsWith('{')) {
    console.warn(
      `GOOGLE_APPLICATION_CREDENTIALS is set to "${envPath}" but that file is missing. ` +
        'On Render, put the full service-account JSON in GOOGLE_CREDENTIALS_JSON ' +
        '(or paste JSON into GOOGLE_APPLICATION_CREDENTIALS). A path alone is not enough without the file.'
    );
    // Prevent TextToSpeechClient() from repeatedly ENOENT-ing on the bad path.
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  lastSource = 'none';
  return {};
}

export function getGoogleCredentialSource() {
  return lastSource;
}

export default { resolveGoogleClientOptions, getGoogleCredentialSource };
