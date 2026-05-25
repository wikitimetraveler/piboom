/**
 * Development work by David Lane
 */
/**
 * Configurable loan complexity scoring from pipeline-style flat field maps.
 * Rules are JSON: { id?, points, when: Condition | { all: [] } | { any: [] } }
 */

function getFieldRaw(fields, fieldKey) {
  if (!fields || !fieldKey) return undefined;
  if (Object.prototype.hasOwnProperty.call(fields, fieldKey)) {
    return fields[fieldKey];
  }
  return undefined;
}

function coerceNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function isEmptyValue(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

function evaluateCondition(fields, cond) {
  if (!cond || typeof cond !== 'object') return false;

  if (cond.all && Array.isArray(cond.all)) {
    return cond.all.every((c) => evaluateWhen(fields, c));
  }
  if (cond.any && Array.isArray(cond.any)) {
    return cond.any.some((c) => evaluateWhen(fields, c));
  }

  const field = cond.field;
  const op = (cond.op || 'eq').toLowerCase();
  const raw = getFieldRaw(fields, field);

  switch (op) {
    case 'isempty':
      return isEmptyValue(raw);
    case 'isnotempty':
      return !isEmptyValue(raw);
    case 'eq': {
      const v = cond.value;
      if (v === undefined) return false;
      return `${raw ?? ''}`.trim() === `${v}`.trim();
    }
    case 'neq': {
      const v = cond.value;
      if (v === undefined) return false;
      return `${raw ?? ''}`.trim() !== `${v}`.trim();
    }
    case 'contains': {
      const v = cond.value;
      if (v === undefined || v === null) return false;
      return `${raw ?? ''}`.toLowerCase().includes(`${v}`.toLowerCase());
    }
    case 'in': {
      const list = cond.values;
      if (!Array.isArray(list) || list.length === 0) return false;
      const s = `${raw ?? ''}`.trim().toLowerCase();
      return list.some((x) => `${x}`.trim().toLowerCase() === s);
    }
    case 'regex': {
      const pattern = cond.pattern;
      if (!pattern || typeof pattern !== 'string') return false;
      try {
        return new RegExp(pattern, cond.flags || 'i').test(`${raw ?? ''}`);
      } catch {
        return false;
      }
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const n = coerceNumber(raw);
      const target = coerceNumber(cond.value);
      if (n === null || target === null) return false;
      if (op === 'gt') return n > target;
      if (op === 'gte') return n >= target;
      if (op === 'lt') return n < target;
      return n <= target;
    }
    case 'between': {
      const n = coerceNumber(raw);
      const min = coerceNumber(cond.min);
      const max = coerceNumber(cond.max);
      if (n === null || min === null || max === null) return false;
      return n >= min && n <= max;
    }
    default:
      return false;
  }
}

function evaluateWhen(fields, when) {
  if (!when) return false;
  if (typeof when !== 'object') return false;
  if (when.all || when.any) return evaluateCondition(fields, when);
  return evaluateCondition(fields, when);
}

/**
 * @param {Record<string, unknown>} fields - Flat Encompass field map (e.g. pipeline item.fields)
 * @param {object[]} rules
 * @param {{ maxPoints?: number }} [options]
 * @returns {{ score: number, ruleHits: { ruleId: string|null, points: number }[] }}
 */
export function scoreLoanWithRules(fields, rules, options = {}) {
  const maxPoints =
    options.maxPoints !== undefined && options.maxPoints !== null
      ? Number(options.maxPoints)
      : null;

  if (!Array.isArray(rules)) {
    return { score: 0, ruleHits: [] };
  }

  let score = 0;
  const ruleHits = [];

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const pts = Number(rule.points);
    if (!Number.isFinite(pts) || pts === 0) continue;
    const when = rule.when;
    if (evaluateWhen(fields || {}, when)) {
      score += pts;
      ruleHits.push({
        ruleId: rule.id != null ? String(rule.id) : null,
        points: pts,
      });
    }
  }

  if (maxPoints !== null && Number.isFinite(maxPoints) && maxPoints >= 0) {
    score = Math.min(score, maxPoints);
  }

  return { score, ruleHits };
}

/**
 * @param {unknown} rules
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateComplexityRules(rules) {
  if (!Array.isArray(rules)) {
    return { ok: false, error: 'complexityRules must be an array' };
  }
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r || typeof r !== 'object') {
      return { ok: false, error: `Rule at index ${i} must be an object` };
    }
    if (!Number.isFinite(Number(r.points))) {
      return { ok: false, error: `Rule at index ${i} must have numeric points` };
    }
    if (r.when === undefined || r.when === null) {
      return { ok: false, error: `Rule at index ${i} must have when` };
    }
  }
  return { ok: true };
}
