/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — county hotspot category filters (All / Critical & High / FEMA / Closing Hold).
 * Pure helpers so the toolbar buttons stay deterministic under Jest.
 */
(function (global) {
  'use strict';

  /** Matches getRiskBadge High (6–9) and Critical (10+). */
  const HIGH_INTENSITY_MIN = 6;

  const CATEGORIES = Object.freeze({
    ALL: 'all',
    CRITICAL_HIGH: 'critical_high',
    FEMA: 'fema',
    HOLD: 'hold',
  });

  const HOLD_FILTER_CATEGORIES = Object.freeze(['fema_hold', 'perimeter_watch']);

  function normalizeCategory(category) {
    const raw = String(category || CATEGORIES.ALL).trim().toLowerCase();
    if (
      raw === CATEGORIES.CRITICAL_HIGH ||
      raw === CATEGORIES.FEMA ||
      raw === CATEGORIES.HOLD
    ) {
      return raw;
    }
    return CATEGORIES.ALL;
  }

  function normalizeQuery(query) {
    return String(query || '').trim().toLowerCase();
  }

  function hasFemaSignal(hotspot) {
    if (!hotspot || typeof hotspot !== 'object') return false;
    if (Number(hotspot.femaCount) > 0) return true;
    const sources = hotspot.sources || [];
    return sources.some((s) => String(s).toLowerCase() === 'fema');
  }

  function isClosingHold(hotspot) {
    const cat = hotspot?.lenderGuidance?.filterCategory;
    return HOLD_FILTER_CATEGORIES.includes(cat);
  }

  function matchesSearch(hotspot, query) {
    const q = normalizeQuery(query);
    if (!q) return true;
    const hay = [
      hotspot?.county,
      hotspot?.state,
      hotspot?.dominantType,
      ...(hotspot?.sources || []),
      hotspot?.lenderGuidance?.collateralNeed,
      hotspot?.lenderGuidance?.insuranceNeed,
      hotspot?.lenderGuidance?.closingGate,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  function hotspotPasses(hotspot, options = {}) {
    if (!hotspot || typeof hotspot !== 'object') return false;
    const category = normalizeCategory(options.category);
    const query = options.query;

    if (category === CATEGORIES.CRITICAL_HIGH && (Number(hotspot.peakRisk) || 0) < HIGH_INTENSITY_MIN) {
      return false;
    }
    if (category === CATEGORIES.FEMA && !hasFemaSignal(hotspot)) {
      return false;
    }
    if (category === CATEGORIES.HOLD && !isClosingHold(hotspot)) {
      return false;
    }
    if (!matchesSearch(hotspot, query)) {
      return false;
    }
    return true;
  }

  function filterHotspots(hotspots, options = {}) {
    return (hotspots || []).filter((h) => hotspotPasses(h, options));
  }

  global.DisasterHotspotFilters = {
    HIGH_INTENSITY_MIN,
    CATEGORIES,
    HOLD_FILTER_CATEGORIES,
    normalizeCategory,
    hasFemaSignal,
    isClosingHold,
    hotspotPasses,
    filterHotspots,
  };
})(typeof window !== 'undefined' ? window : globalThis);
