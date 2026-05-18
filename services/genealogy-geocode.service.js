/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Normalize free-text place strings from Lane genealogy before server geocoding.
 * Avoids ambiguous overseas hits (e.g. Bennington UK, random "Philip" places).
 */
export function resolveGenealogyGeocodeQuery(raw) {
  const s = String(raw || '').trim();
  if (!s) return s;

  if (/\bking\s+philips?\s+war\b/i.test(s) || /\bking\s+philip'?s?\s+war\b/i.test(s)) {
    return 'New England, United States';
  }

  if (/\bbattle\s+of\s+bennington\b/i.test(s) || /\bthe\s+battle\s+of\s+bennington\b/i.test(s)) {
    return 'Walloomsac, New York, United States';
  }

  if (/^chester$/i.test(s.trim())) {
    return 'Chester, New Hampshire, United States';
  }

  if (/\bbennington\b/i.test(s) && /\b(battle|killed|aug\.?\s*1777|revolutionary|regiment)\b/i.test(s)) {
    return 'Bennington, Vermont, United States';
  }

  if (/^bennington$/i.test(s.trim())) {
    return 'Bennington, Vermont, United States';
  }

  return s;
}
