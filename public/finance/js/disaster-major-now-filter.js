/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Major now filter (High/Critical event intensity + last 2–3 days).
 * Event intensity is a relative ranking from loaded hazard rows — not a loan ops triage
 * score and not a probability of loss.
 */
(function (global) {
  'use strict';

  /** Matches getRiskBadge High (6–9) and Critical (10+). */
  const HIGH_INTENSITY_MIN = 6;
  const CRITICAL_INTENSITY_MIN = 10;
  const HOURS_2D = 48;
  const HOURS_3D = 72;
  const DEFAULT_HOURS = HOURS_3D;
  const ALLOWED_HOURS = [HOURS_2D, HOURS_3D];

  function normalizeHours(hours) {
    const n = Number(hours);
    if (n === HOURS_2D) return HOURS_2D;
    return DEFAULT_HOURS;
  }

  function normalizeMinScore(minScore) {
    const n = Number(minScore);
    return Number.isFinite(n) ? n : HIGH_INTENSITY_MIN;
  }

  function resolveStartMs(row) {
    if (!row || typeof row !== 'object') return null;
    if (Number.isFinite(row.startTime)) return row.startTime;
    const raw = row.start_time ?? row.disasterObj?.start_time ?? row.disasterObj?.startTime;
    if (raw == null || raw === '') return null;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function resolveRiskScore(row) {
    if (!row || typeof row !== 'object') return null;
    const candidates = [row.riskScore, row.risk_score, row.disasterObj?.riskScore, row.disasterObj?.risk_score];
    for (let i = 0; i < candidates.length; i += 1) {
      const n = Number(candidates[i]);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function eventAgeHours(startMs, nowMs) {
    if (!Number.isFinite(startMs)) return null;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return (now - startMs) / (1000 * 60 * 60);
  }

  function isWithinCurrentWindow(startMs, hours, nowMs) {
    const age = eventAgeHours(startMs, nowMs);
    if (age == null) return false;
    return age <= normalizeHours(hours);
  }

  function meetsHighIntensity(score, minScore) {
    const n = Number(score);
    if (!Number.isFinite(n)) return false;
    return n >= normalizeMinScore(minScore);
  }

  function isCameraRow(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.isCamera === true) return true;
    const eventType = String(row.eventType || row.event_type || row.disasterObj?.event_type || '').toLowerCase();
    const source = String(row.source || row.disasterObj?.source || '').toLowerCase();
    return eventType === 'camera' || source === 'alertcalifornia';
  }

  /**
   * @param {object} row Grid row or raw disaster object
   * @param {{ hours?: number, minScore?: number, nowMs?: number }} [options]
   */
  function rowPasses(row, options) {
    if (!row || isCameraRow(row)) return false;
    const opts = options || {};
    const score = resolveRiskScore(row);
    if (!meetsHighIntensity(score, opts.minScore)) return false;
    return isWithinCurrentWindow(resolveStartMs(row), opts.hours, opts.nowMs);
  }

  function filterRows(rows, options) {
    return (rows || []).filter((row) => rowPasses(row, options));
  }

  function disasterObjsFromPassingRows(gridRows, options) {
    return filterRows(gridRows, options)
      .map((row) => row.disasterObj || row)
      .filter(Boolean);
  }

  function windowLabel(hours) {
    return normalizeHours(hours) === HOURS_2D ? '2 days' : '3 days';
  }

  function statusMessage(visibleCount, totalCount, hours) {
    const vis = Number(visibleCount) || 0;
    const tot = Number(totalCount) || 0;
    const window = windowLabel(hours);
    if (tot === 0) {
      return `Major now: High & Critical intensity · last ${window}. Load events to apply.`;
    }
    if (vis === 0) {
      return `Major now: no High or Critical events in the last ${window} (${tot.toLocaleString()} loaded). Try 3 days, another place, or turn the filter off.`;
    }
    return `Major now: ${vis.toLocaleString()} High/Critical event${vis === 1 ? '' : 's'} from the last ${window} (${tot.toLocaleString()} loaded).`;
  }

  global.DisasterMajorNowFilter = {
    HIGH_INTENSITY_MIN,
    CRITICAL_INTENSITY_MIN,
    HOURS_2D,
    HOURS_3D,
    DEFAULT_HOURS,
    ALLOWED_HOURS,
    normalizeHours,
    resolveStartMs,
    resolveRiskScore,
    eventAgeHours,
    isWithinCurrentWindow,
    meetsHighIntensity,
    isCameraRow,
    rowPasses,
    filterRows,
    disasterObjsFromPassingRows,
    windowLabel,
    statusMessage
  };
})(typeof window !== 'undefined' ? window : globalThis);
