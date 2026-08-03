/**
 * Resolve Google Cloud client options for Speech / TTS on local and Render.
 * Development work by David Lane
 *
 * Prefer inline JSON on cloud hosts (no credential file on disk):
 *   GOOGLE_CREDENTIALS_JSON  (or GOOGLE_SERVICE_ACCOUNT_JSON)
 * Else a readable key file via GOOGLE_APPLICATION_CREDENTIALS / ./google-credentials.json
 */
import fs from 'fs';
import path from 'path';

function parseInlineCredentials() {
  const raw = (
    process.env.GOOGLE_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CLOUD_CREDENTIALS_JSON ||
    ''
  ).trim();
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    if (!credentials || typeof credentials !== 'object') return null;
    return credentials;
  } catch (err) {
    console.warn('GOOGLE_CREDENTIALS_JSON is not valid JSON:', err.message);
    return null;
  }
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
  const inline = parseInlineCredentials();
  if (inline) {
    // Inline JSON wins — clear a stale absolute path so ADC does not keep failing.
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId =
      inline.project_id ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT_ID ||
      undefined;
    return projectId ? { credentials: inline, projectId } : { credentials: inline };
  }

  const envPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const candidates = [];
  if (envPath) {
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
    return { keyFilename };
  }

  if (envPath) {
    console.warn(
      `GOOGLE_APPLICATION_CREDENTIALS is set to "${envPath}" but that file is missing. ` +
        'Set GOOGLE_CREDENTIALS_JSON to the service-account JSON on Render, or mount a real key file.'
    );
    // Prevent TextToSpeechClient() from repeatedly ENOENT-ing on the bad path.
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  return {};
}

export default { resolveGoogleClientOptions };
