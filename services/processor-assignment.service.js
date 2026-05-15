import {
  fetchPipelineLoans,
  fetchLoanAssociates,
  assignLoanAssociate,
} from './encompass-hub.service.js';
import { scoreLoanWithRules, validateComplexityRules } from './loan-complexity.service.js';
import {
  scoreLoanComplexityWithAi,
  isAiComplexityConfigured,
} from './loan-complexity-ai.service.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize GET associates response to an array of slot objects.
 * @param {unknown} data
 * @returns {object[]}
 */
export function normalizeAssociatesList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.associates)) return data.associates;
  if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Extract milestone / milestone-free role log id for PUT .../associates/{logId}
 * @param {object} item - Raw associate element from Encompass
 */
export function extractAssociateLogId(item) {
  if (!item || typeof item !== 'object') return null;
  const direct =
    item.logId ??
    item.LogId ??
    item.milestoneLogId ??
    item.MilestoneLogId ??
    item.milestoneFreeRoleLogId ??
    item.MilestoneFreeRoleLogId ??
    item.loanAssociateLogId ??
    item.LoanAssociateLogId;
  if (direct != null && `${direct}`.trim() !== '') return `${direct}`.trim();
  if (item.id != null && `${item.id}`.trim() !== '') return `${item.id}`.trim();
  return null;
}

function associateRoleName(item) {
  if (!item || typeof item !== 'object') return '';
  const r =
    item.roleName ??
    item.RoleName ??
    item.role?.entityName ??
    item.Role?.EntityName ??
    item.role?.entityName ??
    '';
  return `${r}`.toLowerCase();
}

/**
 * @param {unknown} associatesResponse - Raw from fetchLoanAssociates
 * @param {object} roleConfig
 * @param {string} [roleConfig.roleNameIncludes] - default 'processor'
 * @param {string} [roleConfig.fixedRoleId]
 * @param {string} [roleConfig.roleId]
 * @returns {string|null} logId
 */
export function findProcessorLogId(associatesResponse, roleConfig = {}) {
  const list = normalizeAssociatesList(associatesResponse);
  const includes = (roleConfig.roleNameIncludes || 'processor').toLowerCase();
  const fixedRoleId = roleConfig.fixedRoleId != null ? `${roleConfig.fixedRoleId}` : null;
  const roleId = roleConfig.roleId != null ? `${roleConfig.roleId}` : null;

  for (const item of list) {
    const logId = extractAssociateLogId(item);
    if (!logId) continue;

    const fr = item.fixedRoleId ?? item.FixedRoleId;
    const rid = item.roleId ?? item.RoleId;
    if (fixedRoleId != null && `${fr ?? ''}` !== fixedRoleId) continue;
    if (roleId != null && `${rid ?? ''}` !== roleId) continue;

    const rn = associateRoleName(item);
    if (rn.includes(includes)) return logId;
  }

  for (const item of list) {
    const logId = extractAssociateLogId(item);
    if (!logId) continue;
    const rn = associateRoleName(item);
    if (rn.includes('process')) return logId;
  }

  return null;
}

function loanFieldsFromItem(loan) {
  if (!loan || typeof loan !== 'object') return {};
  if (loan.fields && typeof loan.fields === 'object') return { ...loan.fields };
  return {};
}

function loanGuidFromItem(loan) {
  if (!loan || typeof loan !== 'object') return null;
  return loan.loanGuid ?? loan.loanId ?? loan.normalized?.guid ?? null;
}

function processorIdFromFields(fields) {
  return fields['Loan.LoanProcessorID'] ?? fields['Loan.LoanProcessorId'] ?? fields['Loan.LoanProcessorid'] ?? null;
}

function normalizeTag(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

function stringifyField(fields, key) {
  return `${fields?.[key] ?? ''}`.trim();
}

function hasToken(text, token) {
  return `${text ?? ''}`.toLowerCase().includes(`${token}`.toLowerCase());
}

export function deriveLoanProductTags(fields) {
  const tags = new Set();
  const mt = stringifyField(fields, 'Loan.MortgageType');
  const program = stringifyField(fields, 'Loan.LoanProgramName');
  const productDesc = stringifyField(fields, 'Loan.ProductName');
  const investorProgram = stringifyField(fields, 'Fields.CX.INVESTOR.PROGRAM');
  const propertyType = stringifyField(fields, 'Loan.PropertyType');

  const composite = `${mt} ${program} ${productDesc} ${investorProgram}`.toLowerCase();
  if (hasToken(composite, 'fha')) tags.add('fha');
  if (hasToken(composite, 'va')) tags.add('va');
  if (hasToken(composite, 'va full doc') || hasToken(composite, 'full doc')) tags.add('va full doc');
  if (hasToken(composite, 'jumbo') || hasToken(composite, 'non agency')) tags.add('jumbo');
  if (hasToken(composite, 'cema')) tags.add('cema');
  if (hasToken(propertyType, 'condo') || hasToken(propertyType, 'condominium')) tags.add('condo');

  return Array.from(tags);
}

function processorProductTags(processor) {
  if (!processor || !Array.isArray(processor.products)) return [];
  return processor.products
    .map((t) => normalizeTag(t))
    .filter(Boolean);
}

function normalizeUtilizationTarget(raw) {
  if (raw === undefined || raw === null || `${raw}`.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

function resolveTargetUtilization({ processor, globalTargetUtilization, defaultTargetUtilization }) {
  const perProcessor = normalizeUtilizationTarget(processor?.targetUtilization);
  if (perProcessor !== null) return perProcessor;
  if (globalTargetUtilization !== null && globalTargetUtilization !== undefined) {
    return globalTargetUtilization;
  }
  return defaultTargetUtilization;
}

function normalizeCapacityWeightingMode(raw) {
  const mode = `${raw ?? 'linear'}`.trim().toLowerCase();
  if (mode === 'none') return 'none';
  if (mode === 'linear') return 'linear';
  return null;
}

function roundCapacity(value) {
  return Math.round(value * 10000) / 10000;
}

function computeWeightedCapacityImpact(score, {
  capacityWeightingMode,
  capacityWeightFactor,
  hardLoanThreshold,
  hardLoanWeightMultiplier,
}) {
  const base = Number(score);
  const rawScore = Number.isFinite(base) ? Math.max(0, base) : 0;
  const factor = Number.isFinite(Number(capacityWeightFactor)) ? Number(capacityWeightFactor) : 1;
  const threshold = Number(hardLoanThreshold);
  const multiplier = Number.isFinite(Number(hardLoanWeightMultiplier))
    ? Number(hardLoanWeightMultiplier)
    : 1;

  let weighted = rawScore;
  if (capacityWeightingMode === 'linear') {
    weighted = rawScore * factor;
  }
  if (Number.isFinite(threshold) && threshold >= 0 && rawScore >= threshold) {
    weighted *= multiplier;
  }
  return roundCapacity(Math.max(0, weighted));
}

export function evaluateProcessorEligibility(loanTags, processor) {
  const pTags = processorProductTags(processor);
  if (!pTags.length) {
    return { eligible: true, matchedTags: [], processorTags: [] };
  }
  const loanSet = new Set((loanTags || []).map((t) => normalizeTag(t)).filter(Boolean));
  const matchedTags = pTags.filter((t) => loanSet.has(t));
  return {
    eligible: matchedTags.length > 0,
    matchedTags,
    processorTags: pTags,
  };
}

function chooseBestFitProcessor({
  processors,
  processorRemaining,
  pointsNeededWeighted,
  eligibilityByProcessorId,
  allowIneligibleOverride,
  globalTargetUtilization,
}) {
  const totalCapacity = processors.reduce((sum, p) => {
    const cap = Number(p?.maxPoints);
    return sum + (Number.isFinite(cap) && cap > 0 ? cap : 0);
  }, 0);
  const totalUsed = processors.reduce((sum, p) => {
    const cap = Number(p?.maxPoints);
    const key = `${p?.userId ?? ''}`;
    const remaining = Number(processorRemaining[key]);
    if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(remaining)) return sum;
    return sum + Math.max(0, cap - remaining);
  }, 0);
  const defaultTargetUtilization = totalCapacity > 0
    ? Math.min(1, Math.max(0, (totalUsed + pointsNeededWeighted) / totalCapacity))
    : 1;

  const candidates = processors
    .map((processor) => {
      const key = `${processor.userId}`;
      const remaining = Number(processorRemaining[key]);
      if (!Number.isFinite(remaining) || remaining < pointsNeededWeighted) {
        return null;
      }
      const maxPoints = Number(processor.maxPoints);
      if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
        return null;
      }
      const eligibility = eligibilityByProcessorId[key] || {
        eligible: true,
        matchedTags: [],
      };
      const usedBeforeAssign = maxPoints - remaining;
      const postUsed = usedBeforeAssign + pointsNeededWeighted;
      const postUtilization = postUsed / maxPoints;
      const targetUtilization = resolveTargetUtilization({
        processor,
        globalTargetUtilization,
        defaultTargetUtilization,
      });
      return {
        processor,
        key,
        maxPoints,
        remaining,
        residualAfterAssign: remaining - pointsNeededWeighted,
        postUtilization,
        targetUtilization,
        targetDelta: Math.abs(postUtilization - targetUtilization),
        eligibility,
      };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const rank = (a, b) => {
    if (a.targetDelta !== b.targetDelta) {
      return a.targetDelta - b.targetDelta;
    }
    const aMatches = a.eligibility?.matchedTags?.length || 0;
    const bMatches = b.eligibility?.matchedTags?.length || 0;
    if (aMatches !== bMatches) {
      return bMatches - aMatches;
    }
    if (a.postUtilization !== b.postUtilization) {
      return b.postUtilization - a.postUtilization;
    }
    if (a.residualAfterAssign !== b.residualAfterAssign) {
      return a.residualAfterAssign - b.residualAfterAssign;
    }
    if (a.remaining !== b.remaining) {
      return b.remaining - a.remaining;
    }
    return `${a.key}`.localeCompare(`${b.key}`);
  };

  const eligible = candidates.filter((c) => Boolean(c.eligibility?.eligible)).sort(rank);
  if (eligible.length) return eligible[0].processor;
  if (allowIneligibleOverride) {
    return candidates.sort(rank)[0].processor;
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {'rules'|'ai'|'both'}
 */
export function normalizeComplexityMode(raw) {
  const s = `${raw ?? 'rules'}`.trim().toLowerCase();
  if (s === 'ai') return 'ai';
  if (s === 'both') return 'both';
  return 'rules';
}

/**
 * @param {{ mode: string, rulesScore: number, aiPoints: number, maxPoints?: number|null }} p
 * @returns {number}
 */
export function composeComplexityScores({ mode, rulesScore, aiPoints, maxPoints }) {
  const rs = Number(rulesScore);
  const ap = Number(aiPoints);
  const r = Number.isFinite(rs) ? rs : 0;
  const a = Number.isFinite(ap) ? ap : 0;
  let score = 0;
  if (mode === 'ai') score = a;
  else if (mode === 'both') score = r + a;
  else score = r;

  const cap = maxPoints === undefined || maxPoints === null ? null : Number(maxPoints);
  if (cap !== null && Number.isFinite(cap) && cap >= 0) {
    score = Math.min(score, cap);
  }
  return score;
}

export function currentProcessorFromFields(fields) {
  const id = processorIdFromFields(fields);
  const name = fields['Loan.LoanProcessorName'] ?? fields['Loan.LoanProcessorname'] ?? null;
  return {
    currentProcessorId: id != null && `${id}`.trim() !== '' ? `${id}`.trim() : null,
    currentProcessorName: name != null && `${name}`.trim() !== '' ? `${name}`.trim() : null,
  };
}

function resultRowBase(row) {
  const cur = currentProcessorFromFields(row.fields || {});
  return {
    loanNumber: row.number,
    borrowerName: row.borrowerName,
    currentProcessorId: cur.currentProcessorId,
    currentProcessorName: cur.currentProcessorName,
    score: row.score,
    rulesScore: row.rulesScore,
    aiPoints: row.aiPoints,
    aiRationale: row.aiRationale,
    ruleHits: row.ruleHits,
    loanProductTags: row.loanProductTags,
    capacityImpact: row.capacityImpact,
  };
}

/**
 * Single loan complexity (rules / AI / both) — shared by capacity accounting and candidate scoring.
 */
async function computeComplexityForFields(fields, {
  complexityMode,
  complexityRules,
  complexityMaxPoints,
  complexityAiModel,
}) {
  const ruleCap = complexityMode === 'both' ? null : complexityMaxPoints;
  let rulesScore = 0;
  let ruleHits = [];
  if (complexityMode !== 'ai') {
    const r = scoreLoanWithRules(fields, complexityRules, { maxPoints: ruleCap });
    rulesScore = r.score;
    ruleHits = r.ruleHits;
  }

  let aiPoints = null;
  let aiRationale = null;
  if (complexityMode === 'ai' || complexityMode === 'both') {
    const ai = await scoreLoanComplexityWithAi(fields, { model: complexityAiModel });
    aiPoints = ai.points;
    aiRationale = ai.rationale;
  }

  const score = composeComplexityScores({
    mode: complexityMode,
    rulesScore,
    aiPoints: aiPoints ?? 0,
    maxPoints: complexityMaxPoints,
  });

  return { score, rulesScore, ruleHits, aiPoints, aiRationale };
}

/**
 * @param {object} body
 * @param {boolean} [body.dryRun]
 * @param {object} [body.pipelineFilters] - passed to fetchPipelineLoans when loans omitted
 * @param {object[]} [body.loans] - enriched pipeline items (must include fields + loanGuid)
 * @param {object[]} body.processors - { userId, displayName?, maxPoints }
 * @param {object[]} body.complexityRules
 * @param {number} [body.complexityMaxPoints]
 * @param {object} [body.roleConfig]
 * @param {boolean} [body.assignOnlyUnassigned] - default true
 * @param {boolean} [body.allowIneligibleOverride] - allow fallback assignment to non-matching processor product tags
 * @param {string} [body.sortOrder] - 'desc' | 'asc' for complexity (default desc)
 * @param {number} [body.delayMsBetweenAssign] - throttle PUTs (default 0)
 * @param {string} [body.complexityMode] - 'rules' | 'ai' | 'both'
 * @param {string} [body.complexityAiModel] - OpenAI model id (default from LOAN_COMPLEXITY_AI_MODEL / OPENAI_AGENT_MODEL, usually gpt-4o)
 * @param {number} [body.globalTargetUtilization] - optional 0..1 or 0..100
 * @param {string} [body.capacityWeightingMode] - 'linear' | 'none'
 * @param {number} [body.capacityWeightFactor] - multiplier for weighted impact (default 1)
 * @param {number} [body.hardLoanThreshold] - optional score threshold for hard-loan multiplier
 * @param {number} [body.hardLoanWeightMultiplier] - multiplier applied at/above hardLoanThreshold (default 1)
 */
export async function runProcessorAssignment(body) {
  const {
    dryRun = true,
    pipelineFilters = {},
    loans: loansOverride,
    processors = [],
    complexityRules = [],
    complexityMaxPoints,
    roleConfig = {},
    assignOnlyUnassigned = true,
    allowIneligibleOverride = false,
    sortOrder = 'desc',
    delayMsBetweenAssign = 0,
    complexityMode: complexityModeRaw,
    complexityAiModel,
    globalTargetUtilization: globalTargetUtilizationRaw,
    capacityWeightingMode: capacityWeightingModeRaw = 'linear',
    capacityWeightFactor: capacityWeightFactorRaw = 1,
    hardLoanThreshold: hardLoanThresholdRaw,
    hardLoanWeightMultiplier: hardLoanWeightMultiplierRaw = 1,
  } = body || {};

  const complexityMode = normalizeComplexityMode(complexityModeRaw);
  const capacityWeightingMode = normalizeCapacityWeightingMode(capacityWeightingModeRaw);
  if (!capacityWeightingMode) {
    const err = new Error('capacityWeightingMode must be one of: linear, none');
    err.statusCode = 400;
    throw err;
  }
  const capacityWeightFactor = Number(capacityWeightFactorRaw);
  if (!Number.isFinite(capacityWeightFactor) || capacityWeightFactor <= 0) {
    const err = new Error('capacityWeightFactor must be numeric > 0');
    err.statusCode = 400;
    throw err;
  }
  const hardLoanThreshold = (
    hardLoanThresholdRaw === undefined || hardLoanThresholdRaw === null || `${hardLoanThresholdRaw}`.trim() === ''
  )
    ? null
    : Number(hardLoanThresholdRaw);
  if (hardLoanThreshold !== null && (!Number.isFinite(hardLoanThreshold) || hardLoanThreshold < 0)) {
    const err = new Error('hardLoanThreshold must be numeric >= 0 when provided');
    err.statusCode = 400;
    throw err;
  }
  const hardLoanWeightMultiplier = Number(hardLoanWeightMultiplierRaw);
  if (!Number.isFinite(hardLoanWeightMultiplier) || hardLoanWeightMultiplier <= 0) {
    const err = new Error('hardLoanWeightMultiplier must be numeric > 0');
    err.statusCode = 400;
    throw err;
  }
  const hasGlobalTargetRaw = !(
    globalTargetUtilizationRaw === undefined
    || globalTargetUtilizationRaw === null
    || `${globalTargetUtilizationRaw}`.trim() === ''
  );
  const globalTargetUtilization = normalizeUtilizationTarget(globalTargetUtilizationRaw);
  if (hasGlobalTargetRaw && globalTargetUtilization === null) {
    const err = new Error('globalTargetUtilization must be 0..1 or 0..100');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(processors) || processors.length === 0) {
    const err = new Error('processors must be a non-empty array of { userId, maxPoints }');
    err.statusCode = 400;
    throw err;
  }

  for (const p of processors) {
    if (p == null || p.userId === undefined || p.userId === null || `${p.userId}`.trim() === '') {
      const err = new Error('Each processor must have userId');
      err.statusCode = 400;
      throw err;
    }
    const mp = Number(p.maxPoints);
    if (!Number.isFinite(mp) || mp < 0) {
      const err = new Error('Each processor must have numeric maxPoints >= 0');
      err.statusCode = 400;
      throw err;
    }
    if (p.products !== undefined && !Array.isArray(p.products)) {
      const err = new Error('Each processor.products must be an array of strings when provided');
      err.statusCode = 400;
      throw err;
    }
    const hasTargetRaw = !(
      p.targetUtilization === undefined
      || p.targetUtilization === null
      || `${p.targetUtilization}`.trim() === ''
    );
    if (hasTargetRaw && normalizeUtilizationTarget(p.targetUtilization) === null) {
      const err = new Error(`Processor ${p.userId} targetUtilization must be 0..1 or 0..100`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!Array.isArray(complexityRules)) {
    const err = new Error('complexityRules must be an array');
    err.statusCode = 400;
    throw err;
  }
  if (complexityRules.length > 0) {
    const rulesCheck = validateComplexityRules(complexityRules);
    if (!rulesCheck.ok) {
      const err = new Error(rulesCheck.error);
      err.statusCode = 400;
      throw err;
    }
  }

  if ((complexityMode === 'ai' || complexityMode === 'both') && !isAiComplexityConfigured()) {
    const err = new Error('complexityMode requires OPENAI_API_KEY for AI scoring');
    err.statusCode = 503;
    throw err;
  }

  let loans = loansOverride;
  if (!loans || !Array.isArray(loans)) {
    loans = await fetchPipelineLoans(pipelineFilters);
  }

  const usedPoints = {};
  processors.forEach((p) => {
    usedPoints[`${p.userId}`] = 0;
  });

  const scoringCtx = {
    complexityMode,
    complexityRules,
    complexityMaxPoints,
    complexityAiModel,
  };

  const scoreCache = new Map();
  async function scoreLoanOnce(loan) {
    const guid = loanGuidFromItem(loan);
    const key = guid && `${guid}`.trim() !== '' ? `${guid}`.trim() : null;
    const fields = loanFieldsFromItem(loan);
    const cacheKey = key || `noguid:${fields['Loan.LoanNumber'] ?? ''}:${fields['Loan.BorrowerName'] ?? ''}`;
    if (scoreCache.has(cacheKey)) {
      return scoreCache.get(cacheKey);
    }
    const computed = await computeComplexityForFields(fields, scoringCtx);
    const packed = { ...computed, fields };
    scoreCache.set(cacheKey, packed);
    return packed;
  }

  for (const loan of loans) {
    const fields = loanFieldsFromItem(loan);
    const procId = processorIdFromFields(fields);
    const match = processors.find((x) => `${x.userId}` === `${procId}`);
    if (match) {
      const { score: pts } = await scoreLoanOnce(loan);
      const weightedPts = computeWeightedCapacityImpact(pts, {
        capacityWeightingMode,
        capacityWeightFactor,
        hardLoanThreshold,
        hardLoanWeightMultiplier,
      });
      usedPoints[`${match.userId}`] += weightedPts;
    }
  }

  const candidates = loans.filter((loan) => {
    const fields = loanFieldsFromItem(loan);
    const procId = processorIdFromFields(fields);
    if (assignOnlyUnassigned) {
      return procId === null || procId === undefined || `${procId}`.trim() === '';
    }
    return true;
  });

  const scored = [];
  for (const loan of candidates) {
    const fields = loanFieldsFromItem(loan);
    const guid = loanGuidFromItem(loan);
    const number = fields['Loan.LoanNumber'] ?? null;
    const borrowerName = fields['Loan.BorrowerName'] ?? null;

    const {
      score,
      rulesScore,
      ruleHits,
      aiPoints,
      aiRationale,
    } = await scoreLoanOnce(loan);

    scored.push({
      loan,
      fields,
      score,
      rulesScore,
      ruleHits,
      aiPoints,
      aiRationale,
      guid,
      number,
      borrowerName,
      loanProductTags: deriveLoanProductTags(fields),
      capacityImpact: computeWeightedCapacityImpact(score, {
        capacityWeightingMode,
        capacityWeightFactor,
        hardLoanThreshold,
        hardLoanWeightMultiplier,
      }),
    });
  }

  scored.sort((a, b) => {
    if (sortOrder === 'asc') return a.score - b.score;
    return b.score - a.score;
  });

  const processorRemaining = {};
  processors.forEach((p) => {
    processorRemaining[`${p.userId}`] = p.maxPoints - (usedPoints[`${p.userId}`] || 0);
  });

  const results = [];

  for (const row of scored) {
    if (!row.guid) {
      results.push({
        loanGuid: null,
        status: 'skipped',
        reason: 'missing_loan_guid',
        ...resultRowBase(row),
      });
      continue;
    }

    const pts = row.score;
    const weightedPointsNeeded = row.capacityImpact;

    const loanTags = row.loanProductTags || [];
    const eligibilityByProcessorId = {};

    for (const p of processors) {
      const key = `${p.userId}`;
      const elig = evaluateProcessorEligibility(loanTags, p);
      eligibilityByProcessorId[key] = elig;
    }

    const chosen = chooseBestFitProcessor({
      processors,
      processorRemaining,
      pointsNeededWeighted: weightedPointsNeeded,
      eligibilityByProcessorId,
      allowIneligibleOverride,
      globalTargetUtilization,
    });
    if (!chosen) {
      const hasEligibleProcessor = processors.some((p) => {
        const elig = eligibilityByProcessorId[`${p.userId}`];
        return Boolean(elig?.eligible);
      });
      const hasEligibleCapacity = processors.some((p) => {
        const key = `${p.userId}`;
        const elig = eligibilityByProcessorId[key];
        return Boolean(elig?.eligible) && processorRemaining[key] >= weightedPointsNeeded;
      });
      const hasAnyCapacity = processors.some(
        (p) => processorRemaining[`${p.userId}`] >= weightedPointsNeeded,
      );
      let reason = 'no_eligible_processor';
      if (hasEligibleProcessor && !hasEligibleCapacity) reason = 'no_capacity_eligible';
      else if (!hasAnyCapacity) reason = 'no_capacity_any_processor';
      results.push({
        loanGuid: row.guid,
        status: 'skipped',
        reason,
        eligibilityNote: `loanTags=${loanTags.join(',') || 'none'} impact=${weightedPointsNeeded}`,
        ...resultRowBase(row),
      });
      continue;
    }

    const proposedUserId = `${chosen.userId}`;
    const proposedEligibility = eligibilityByProcessorId[proposedUserId] || {
      eligible: true,
      matchedTags: [],
      processorTags: [],
    };
    const eligibilityNote = proposedEligibility.eligible
      ? `matched:${proposedEligibility.matchedTags.join(',') || 'none'} loanTags:${loanTags.join(',') || 'none'} impact:${weightedPointsNeeded}`
      : `override processorTags:${proposedEligibility.processorTags.join(',') || 'none'} loanTags:${loanTags.join(',') || 'none'} impact:${weightedPointsNeeded}`;

    if (dryRun) {
      results.push({
        loanGuid: row.guid,
        status: 'proposed',
        processorUserId: proposedUserId,
        eligibilityNote,
        ...resultRowBase(row),
      });
      processorRemaining[proposedUserId] -= weightedPointsNeeded;
      continue;
    }

    try {
      const associates = await fetchLoanAssociates(row.guid, {});
      const logId = findProcessorLogId(associates, roleConfig);
      if (!logId) {
        results.push({
          loanGuid: row.guid,
          status: 'error',
          reason: 'no_processor_slot',
          ...resultRowBase(row),
        });
        continue;
      }

      await assignLoanAssociate(row.guid, logId, { id: proposedUserId });
      results.push({
        loanGuid: row.guid,
        status: 'assigned',
        processorUserId: proposedUserId,
        eligibilityNote,
        ...resultRowBase(row),
      });
      processorRemaining[proposedUserId] -= weightedPointsNeeded;

      const delay = Number(delayMsBetweenAssign);
      if (Number.isFinite(delay) && delay > 0) {
        await sleep(delay);
      }
    } catch (e) {
      results.push({
        loanGuid: row.guid,
        status: 'error',
        reason: e.message || 'assign_failed',
        ...resultRowBase(row),
      });
    }
  }

  const summary = {
    proposed: results.filter((r) => r.status === 'proposed').length,
    assigned: results.filter((r) => r.status === 'assigned').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
  };

  return {
    dryRun: Boolean(dryRun),
    complexityMode,
    usedPointsBasis: 'weighted_capacity_impact',
    routingConfig: {
      globalTargetUtilization,
      capacityWeightingMode,
      capacityWeightFactor,
      hardLoanThreshold,
      hardLoanWeightMultiplier,
    },
    usedPoints,
    processorRemaining,
    summary,
    results,
  };
}
