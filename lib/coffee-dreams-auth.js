/**
 * Coffee Dreams page password verification (env-based, no database).
 */
import crypto from 'crypto';

export const ENV_KEY = 'COFFEE_DREAMS_PASSWORD';

export function getConfiguredPassword() {
  const value = String(process.env[ENV_KEY] || '').trim();
  return value || null;
}

export function isCoffeeDreamsConfigured() {
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
export function verifyCoffeeDreamsPassword(password) {
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
  getConfiguredPassword,
  isCoffeeDreamsConfigured,
  verifyCoffeeDreamsPassword,
};
