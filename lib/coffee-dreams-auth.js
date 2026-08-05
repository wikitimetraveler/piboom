/**
 * Coffee Dreams page password verification (no database).
 * Defaults to a built-in password so Render does not need an env var.
 * Optional COFFEE_DREAMS_PASSWORD overrides the default when set.
 */
import crypto from 'crypto';

export const ENV_KEY = 'COFFEE_DREAMS_PASSWORD';
/** Built-in gate password when env is unset (no Render config required). */
export const DEFAULT_PASSWORD = 'Wampus';

export function getConfiguredPassword() {
  const value = String(process.env[ENV_KEY] || '').trim();
  return value || DEFAULT_PASSWORD;
}

export function isCoffeeDreamsConfigured() {
  return true;
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
  isCoffeeDreamsConfigured,
  verifyCoffeeDreamsPassword,
};
