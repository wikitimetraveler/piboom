/**
 * Development work by David Lane
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool } from './database.service.js';

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verify Pi app user password (collections / worksheets guard).
 * Prefer password_hash (bcrypt); migrate legacy plaintext row on success.
 */
export async function verifyAppUserPassword(userId, plainPassword) {
  const pool = getPool();
  if (!pool || !userId || typeof plainPassword !== 'string') {
    return { valid: false, reason: 'unavailable' };
  }

  const trimmed = plainPassword.trim();
  const res = await pool.query(
    'SELECT password, password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (!res.rows.length) {
    return { valid: false };
  }

  const { password: legacyPlain, password_hash: hash } = res.rows[0];

  if (hash && String(hash).startsWith('$2')) {
    const ok = await bcrypt.compare(trimmed, hash);
    return { valid: ok };
  }

  if (legacyPlain && timingSafeEqualString(trimmed, legacyPlain)) {
    const newHash = await bcrypt.hash(trimmed, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, password = $2 WHERE id = $3',
      [newHash, '', userId]
    );
    return { valid: true };
  }

  return { valid: false };
}
