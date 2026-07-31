/**
 * Cannabis Origins page password verification (env-based, no database).
 * Uses CANNABIS_ORIGINS_PASSWORD when set; otherwise the regular private-page
 * password COFFEE_DREAMS_PASSWORD.
 */
import crypto from 'crypto';

export const ENV_KEY = 'CANNABIS_ORIGINS_PASSWORD';
export const FALLBACK_ENV_KEY = 'COFFEE_DREAMS_PASSWORD';

export function getConfiguredPassword() {
  const primary = String(process.env[ENV_KEY] || '').trim();
  if (primary) return primary;
  const fallback = String(process.env[FALLBACK_ENV_KEY] || '').trim();
  return fallback || null;
}

export function isCannabisOriginsConfigured() {
  return getConfiguredPassword() !== null;
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
 * @param {string} password
 * @returns {{ valid: boolean, reason?: 'unconfigured' | 'invalid' | 'ok' }}
 */
export function verifyCannabisOriginsPassword(password) {
  const configured = getConfiguredPassword();
  if (!configured) {
    return { valid: false, reason: 'unconfigured' };
  }
  const candidate = typeof password === 'string' ? password : '';
  if (!candidate || !safeEqual(candidate, configured)) {
    return { valid: false, reason: 'invalid' };
  }
  return { valid: true, reason: 'ok' };
}

export default {
  ENV_KEY,
  FALLBACK_ENV_KEY,
  getConfiguredPassword,
  isCannabisOriginsConfigured,
  verifyCannabisOriginsPassword,
};
