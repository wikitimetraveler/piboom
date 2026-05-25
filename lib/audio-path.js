/**
 * Development work by David Lane
 */
import path from 'path';

/**
 * Resolve a safe relative path under musicDir (rejects traversal and absolute paths).
 * @returns {string|null} absolute file path or null if invalid
 */
export function resolveSafeMusicPath(musicDir, relativePath) {
  const decoded = decodeURIComponent(String(relativePath || '')).trim();
  if (!decoded || decoded.includes('..') || path.isAbsolute(decoded)) {
    return null;
  }

  const normalized = decoded.replace(/\\/g, '/');
  const root = path.resolve(musicDir);
  const full = path.resolve(root, normalized);

  if (full !== root && !full.startsWith(root + path.sep)) {
    return null;
  }

  return full;
}
