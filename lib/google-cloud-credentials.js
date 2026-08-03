/**
 * Resolve Google Cloud client options for Speech / TTS on local and Render.
 * Development work by David Lane
 *
 * Prefer inline JSON on cloud hosts (no credential file on disk):
 *   GOOGLE_CREDENTIALS_JSON  (or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CLOUD_CREDENTIALS_JSON)
 * Also accepts JSON pasted into GOOGLE_APPLICATION_CREDENTIALS (starts with `{`).
 * Inline JSON is written to a temp key file so google-cloud clients use ADC reliably.
 * Else a readable key file via GOOGLE_APPLICATION_CREDENTIALS / ./google-credentials.json
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

let lastSource = 'none';
let cachedTempKeyFile = null;

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
    if (!credentials.client_email || !credentials.private_key) {
      console.warn(`${sourceLabel} JSON is missing client_email or private_key`);
      return null;
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
 * Write inline service-account JSON to a temp file and point ADC at it.
 * Passing `{ credentials }` alone can still fail with "Could not load the default credentials"
 * depending on google-auth-library / client version.
 */
function materializeInlineKeyFile(credentials, sourceLabel) {
  if (cachedTempKeyFile && fs.existsSync(cachedTempKeyFile)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = cachedTempKeyFile;
    lastSource = sourceLabel;
    return cachedTempKeyFile;
  }
  const keyFilename = path.join(os.tmpdir(), `gcloud-sa-${process.pid}.json`);
  fs.writeFileSync(keyFilename, JSON.stringify(credentials), { encoding: 'utf8', mode: 0o600 });
  cachedTempKeyFile = keyFilename;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
  lastSource = sourceLabel;
  return keyFilename;
}

/**
 * @returns {{ credentials?: object, keyFilename?: string, projectId?: string }}
 */
export function resolveGoogleClientOptions() {
  lastSource = 'none';
  const inline = parseInlineCredentials();
  if (inline) {
    const keyFilename = materializeInlineKeyFile(inline, lastSource);
    const projectId =
      inline.project_id ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT_ID ||
      undefined;
    console.log(
      `🎤 Google Cloud credentials: inline via ${lastSource} → temp key file` +
        (projectId ? ` (project ${projectId})` : '')
    );
    return projectId ? { keyFilename, projectId } : { keyFilename };
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
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  lastSource = 'none';
  return {};
}

export function getGoogleCredentialSource() {
  return lastSource;
}

export default { resolveGoogleClientOptions, getGoogleCredentialSource };
