/**
 * Development work by David Lane
 */
/**
 * Watch together theater access code (no database).
 * Defaults to a built-in code so Render does not need an env var.
 * Optional WATCH_TOGETHER_CODE overrides the default when set.
 */
import crypto from 'crypto';

export const ENV_KEY = 'WATCH_TOGETHER_CODE';
/** Built-in gate code when env is unset (no Render config required). */
export const DEFAULT_CODE = 'couch';

export function getConfiguredCode() {
  const value = String(process.env[ENV_KEY] || '').trim();
  return value || DEFAULT_CODE;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * @param {string} code
 * @returns {{ valid: boolean, reason?: 'invalid' | 'ok' }}
 */
export function verifyWatchTogetherCode(code) {
  const configured = getConfiguredCode();
  const candidate = typeof code === 'string' ? code : '';
  if (!candidate || !safeEqual(candidate, configured)) {
    return { valid: false, reason: 'invalid' };
  }
  return { valid: true, reason: 'ok' };
}

export default {
  ENV_KEY,
  DEFAULT_CODE,
  getConfiguredCode,
  verifyWatchTogetherCode,
};
