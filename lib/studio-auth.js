/**
 * Studio listening-room password (env-based, no database).
 * Defaults to reel1 so local/demo works without Render config.
 * Development work by David Lane
 */
import crypto from 'crypto';

export const ENV_KEY = 'STUDIO_LISTEN_PASSWORD';
export const DEFAULT_PASSWORD = 'reel1';

export function getConfiguredPassword() {
  const value = String(process.env[ENV_KEY] || '').trim();
  return value || DEFAULT_PASSWORD;
}

export function isStudioListenConfigured() {
  return true;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * @param {string} password
 * @returns {{ valid: boolean, reason?: 'invalid' | 'ok' }}
 */
export function verifyStudioListenPassword(password) {
  const configured = getConfiguredPassword();
  const candidate = typeof password === 'string' ? password : '';
  if (!candidate || !safeEqual(candidate, configured)) {
    return { valid: false, reason: 'invalid' };
  }
  return { valid: true, reason: 'ok' };
}

export default {
  ENV_KEY,
  DEFAULT_PASSWORD,
  getConfiguredPassword,
  isStudioListenConfigured,
  verifyStudioListenPassword,
};
