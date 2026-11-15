/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — FIRMS confidence view filter (High / Nominal+ / All).
 * Ingest stores firms_confidence on raw; older rows fall back to severity / raw.confidence.
 * Non-FIRMS rows always pass.
 */
(function (global) {
  'use strict';

  const MODE_HIGH = 'high';
  const MODE_NOMINAL = 'nominal';
  const MODE_ALL = 'all';
  const DEFAULT_MODE = MODE_HIGH;
  const ALLOWED_MODES = [MODE_HIGH, MODE_NOMINAL, MODE_ALL];
  const RANK = { low: 0, nominal: 1, high: 2 };

  function normalizeMode(mode) {
    const m = String(mode || '').toLowerCase().trim();
    return ALLOWED_MODES.includes(m) ? m : DEFAULT_MODE;
  }

  function normalizeConfidence(raw) {
    const c = String(raw ?? '').toLowerCase().trim();
    if (!c) return null;
    if (/^\d+$/.test(c)) {
      const n = parseInt(c, 10);
      if (n >= 80) return 'high';
      if (n >= 50) return 'nominal';
      return 'low';
    }
    const letterMap = { l: 'low', n: 'nominal', h: 'high' };
    if (letterMap[c]) return letterMap[c];
    if (c.startsWith('high')) return 'high';
    if (c.startsWith('nominal')) return 'nominal';
    if (c.startsWith('low')) return 'low';
    return RANK[c] != null ? c : null;
  }

  function resolveDisaster(row) {
    if (!row || typeof row !== 'object') return null;
    return row.disasterObj && typeof row.disasterObj === 'object' ? row.disasterObj : row;
  }

  function isFirmsRow(row) {
    const d = resolveDisaster(row);
    if (!d) return false;
    return String(d.source || row.source || '').toLowerCase() === 'firms';
  }

  /**
   * Best-effort confidence from stored FIRMS row / grid row.
   * @returns {'high'|'nominal'|'low'|null}
   */
  function resolveConfidence(row) {
    const d = resolveDisaster(row);
    if (!d) return null;
    const raw = d.raw && typeof d.raw === 'object' ? d.raw : {};
    const candidates = [
      raw.firms_confidence,
      raw.confidence,
      d.firms_confidence,
      d.confidence,
      d.severity,
      row.severity,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const conf = normalizeConfidence(candidates[i]);
      if (conf) return conf;
    }
    return null;
  }

  function confidenceRank(confidence) {
    const key = normalizeConfidence(confidence);
    return key != null ? (RANK[key] ?? -1) : -1;
  }

  function minRankForMode(mode) {
    const m = normalizeMode(mode);
    if (m === MODE_ALL) return -1;
    if (m === MODE_NOMINAL) return RANK.nominal;
    return RANK.high;
  }

  /**
   * @param {object} row Grid row or raw disaster object
   * @param {{ mode?: string }} [options]
   */
  function rowPasses(row, options) {
    if (!isFirmsRow(row)) return true;
    const mode = normalizeMode(options?.mode);
    if (mode === MODE_ALL) return true;
    const conf = resolveConfidence(row);
    // Unknown confidence: keep only when Nominal+ (not High-only), so legacy rows stay visible when loosening.
    if (conf == null) return mode === MODE_NOMINAL;
    return confidenceRank(conf) >= minRankForMode(mode);
  }

  function filterRows(rows, options) {
    return (rows || []).filter((row) => rowPasses(row, options));
  }

  function disasterObjsFromPassingRows(gridRows, options) {
    return filterRows(gridRows, options)
      .map((row) => row.disasterObj || row)
      .filter(Boolean);
  }

  function modeLabel(mode) {
    const m = normalizeMode(mode);
    if (m === MODE_ALL) return 'All';
    if (m === MODE_NOMINAL) return 'Nominal+';
    return 'High';
  }

  function statusMessage(mode, firmsVisible, firmsTotal) {
    const label = modeLabel(mode);
    const vis = Number(firmsVisible) || 0;
    const tot = Number(firmsTotal) || 0;
    if (normalizeMode(mode) === MODE_ALL) {
      return `FIRMS confidence: All (${tot.toLocaleString()} fire event${tot === 1 ? '' : 's'}).`;
    }
    if (tot === 0) {
      return `FIRMS confidence: ${label}. Turn on the NASA FIRMS chip to load fire hotspots.`;
    }
    return `FIRMS confidence: ${label} — ${vis.toLocaleString()} of ${tot.toLocaleString()} fire event${tot === 1 ? '' : 's'}.`;
  }

  global.DisasterFirmsConfidenceFilter = {
    MODE_HIGH,
    MODE_NOMINAL,
    MODE_ALL,
    DEFAULT_MODE,
    ALLOWED_MODES,
    normalizeMode,
    normalizeConfidence,
    isFirmsRow,
    resolveConfidence,
    confidenceRank,
    minRankForMode,
    rowPasses,
    filterRows,
    disasterObjsFromPassingRows,
    modeLabel,
    statusMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
