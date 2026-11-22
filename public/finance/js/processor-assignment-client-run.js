/**
 * Development work by David Lane
 */
/**
 * Browser-only processor assignment dry-run / mock-apply.
 * Mirrors services/processor-assignment.service.js + loan-complexity rules scoring
 * without calling Encompass or /api/encompass-hub.
 */
(function (root) {
  'use strict';

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

  function evaluateWhen(fields, when) {
    if (!when || typeof when !== 'object') return false;
    if (when.all && Array.isArray(when.all)) {
      return when.all.every((c) => evaluateWhen(fields, c));
    }
    if (when.any && Array.isArray(when.any)) {
      return when.any.some((c) => evaluateWhen(fields, c));
    }

    const field = when.field;
    const op = (when.op || 'eq').toLowerCase();
    const raw = getFieldRaw(fields, field);

    switch (op) {
      case 'isempty':
        return isEmptyValue(raw);
      case 'isnotempty':
        return !isEmptyValue(raw);
      case 'eq':
        return when.value === undefined
          ? false
          : `${raw ?? ''}`.trim() === `${when.value}`.trim();
      case 'neq':
        return when.value === undefined
          ? false
          : `${raw ?? ''}`.trim() !== `${when.value}`.trim();
      case 'contains':
        if (when.value === undefined || when.value === null) return false;
        return `${raw ?? ''}`.toLowerCase().includes(`${when.value}`.toLowerCase());
      case 'in': {
        const list = when.values;
        if (!Array.isArray(list) || list.length === 0) return false;
        const s = `${raw ?? ''}`.trim().toLowerCase();
        return list.some((x) => `${x}`.trim().toLowerCase() === s);
      }
      case 'regex': {
        if (!when.pattern || typeof when.pattern !== 'string') return false;
        try {
          return new RegExp(when.pattern, when.flags || 'i').test(`${raw ?? ''}`);
        } catch {
          return false;
        }
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const n = coerceNumber(raw);
        const target = coerceNumber(when.value);
        if (n === null || target === null) return false;
        if (op === 'gt') return n > target;
        if (op === 'gte') return n >= target;
        if (op === 'lt') return n < target;
        return n <= target;
      }
      case 'between': {
        const n = coerceNumber(raw);
        const min = coerceNumber(when.min);
        const max = coerceNumber(when.max);
        if (n === null || min === null || max === null) return false;
        return n >= min && n <= max;
      }
      default:
        return false;
    }
  }

  function scoreLoanWithRules(fields, rules, options) {
    const maxPoints =
      options?.maxPoints !== undefined && options?.maxPoints !== null
        ? Number(options.maxPoints)
        : null;
    if (!Array.isArray(rules)) return { score: 0, ruleHits: [] };

    let score = 0;
    const ruleHits = [];
    for (const rule of rules) {
      if (!rule || typeof rule !== 'object') continue;
      const pts = Number(rule.points);
      if (!Number.isFinite(pts) || pts === 0) continue;
      if (evaluateWhen(fields || {}, rule.when)) {
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
    return (
      fields['Loan.LoanProcessorID']
      ?? fields['Loan.LoanProcessorId']
      ?? fields['Loan.LoanProcessorid']
      ?? null
    );
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

  function deriveLoanProductTags(fields) {
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
    return processor.products.map((t) => normalizeTag(t)).filter(Boolean);
  }

  function evaluateProcessorEligibility(loanTags, processor) {
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

  function computeWeightedCapacityImpact(score, opts) {
    const {
      capacityWeightingMode,
      capacityWeightFactor,
      hardLoanThreshold,
      hardLoanWeightMultiplier,
    } = opts;
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
      if (a.targetDelta !== b.targetDelta) return a.targetDelta - b.targetDelta;
      const aMatches = a.eligibility?.matchedTags?.length || 0;
      const bMatches = b.eligibility?.matchedTags?.length || 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      if (a.postUtilization !== b.postUtilization) return b.postUtilization - a.postUtilization;
      if (a.residualAfterAssign !== b.residualAfterAssign) {
        return a.residualAfterAssign - b.residualAfterAssign;
      }
      if (a.remaining !== b.remaining) return b.remaining - a.remaining;
      return `${a.key}`.localeCompare(`${b.key}`);
    };

    const eligible = candidates.filter((c) => Boolean(c.eligibility?.eligible)).sort(rank);
    if (eligible.length) return eligible[0].processor;
    if (allowIneligibleOverride) return candidates.sort(rank)[0].processor;
    return null;
  }

  function currentProcessorFromFields(fields) {
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
   * @param {object} body - same shape as POST /processor-assignment/run (rules mode only)
   * @returns {object} assignment result payload
   */
  function runProcessorAssignmentClient(body) {
    const {
      dryRun = true,
      loans: loansOverride,
      processors = [],
      complexityRules = [],
      complexityMaxPoints,
      assignOnlyUnassigned = true,
      allowIneligibleOverride = false,
      sortOrder = 'desc',
      globalTargetUtilization: globalTargetUtilizationRaw,
      capacityWeightingMode: capacityWeightingModeRaw = 'linear',
      capacityWeightFactor: capacityWeightFactorRaw = 1,
      hardLoanThreshold: hardLoanThresholdRaw,
      hardLoanWeightMultiplier: hardLoanWeightMultiplierRaw = 1,
    } = body || {};

    const capacityWeightingMode = normalizeCapacityWeightingMode(capacityWeightingModeRaw);
    if (!capacityWeightingMode) {
      throw new Error('capacityWeightingMode must be one of: linear, none');
    }
    const capacityWeightFactor = Number(capacityWeightFactorRaw);
    if (!Number.isFinite(capacityWeightFactor) || capacityWeightFactor <= 0) {
      throw new Error('capacityWeightFactor must be numeric > 0');
    }
    const hardLoanThreshold = (
      hardLoanThresholdRaw === undefined
      || hardLoanThresholdRaw === null
      || `${hardLoanThresholdRaw}`.trim() === ''
    )
      ? null
      : Number(hardLoanThresholdRaw);
    if (hardLoanThreshold !== null && (!Number.isFinite(hardLoanThreshold) || hardLoanThreshold < 0)) {
      throw new Error('hardLoanThreshold must be numeric >= 0 when provided');
    }
    const hardLoanWeightMultiplier = Number(hardLoanWeightMultiplierRaw);
    if (!Number.isFinite(hardLoanWeightMultiplier) || hardLoanWeightMultiplier <= 0) {
      throw new Error('hardLoanWeightMultiplier must be numeric > 0');
    }
    const hasGlobalTargetRaw = !(
      globalTargetUtilizationRaw === undefined
      || globalTargetUtilizationRaw === null
      || `${globalTargetUtilizationRaw}`.trim() === ''
    );
    const globalTargetUtilization = normalizeUtilizationTarget(globalTargetUtilizationRaw);
    if (hasGlobalTargetRaw && globalTargetUtilization === null) {
      throw new Error('globalTargetUtilization must be 0..1 or 0..100');
    }

    if (!Array.isArray(processors) || processors.length === 0) {
      throw new Error('processors must be a non-empty array of { userId, maxPoints }');
    }
    for (const p of processors) {
      if (p == null || p.userId === undefined || p.userId === null || `${p.userId}`.trim() === '') {
        throw new Error('Each processor must have userId');
      }
      const mp = Number(p.maxPoints);
      if (!Number.isFinite(mp) || mp < 0) {
        throw new Error('Each processor must have numeric maxPoints >= 0');
      }
    }

    if (!Array.isArray(complexityRules)) {
      throw new Error('complexityRules must be an array');
    }
    if (!Array.isArray(loansOverride)) {
      throw new Error('loans must be a JSON array for client-side mock runs');
    }
    const loans = loansOverride;

    const usedPoints = {};
    processors.forEach((p) => {
      usedPoints[`${p.userId}`] = 0;
    });

    const scoreCache = new Map();
    function scoreLoanOnce(loan) {
      const guid = loanGuidFromItem(loan);
      const fields = loanFieldsFromItem(loan);
      const cacheKey = guid && `${guid}`.trim() !== ''
        ? `${guid}`.trim()
        : `noguid:${fields['Loan.LoanNumber'] ?? ''}:${fields['Loan.BorrowerName'] ?? ''}`;
      if (scoreCache.has(cacheKey)) return scoreCache.get(cacheKey);
      const { score, ruleHits } = scoreLoanWithRules(fields, complexityRules, {
        maxPoints: complexityMaxPoints,
      });
      const packed = {
        score,
        rulesScore: score,
        ruleHits,
        aiPoints: null,
        aiRationale: null,
        fields,
      };
      scoreCache.set(cacheKey, packed);
      return packed;
    }

    const weightOpts = {
      capacityWeightingMode,
      capacityWeightFactor,
      hardLoanThreshold,
      hardLoanWeightMultiplier,
    };

    for (const loan of loans) {
      const fields = loanFieldsFromItem(loan);
      const procId = processorIdFromFields(fields);
      const match = processors.find((x) => `${x.userId}` === `${procId}`);
      if (match) {
        const { score: pts } = scoreLoanOnce(loan);
        usedPoints[`${match.userId}`] += computeWeightedCapacityImpact(pts, weightOpts);
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

    const scored = candidates.map((loan) => {
      const fields = loanFieldsFromItem(loan);
      const guid = loanGuidFromItem(loan);
      const {
        score,
        rulesScore,
        ruleHits,
        aiPoints,
        aiRationale,
      } = scoreLoanOnce(loan);
      return {
        loan,
        fields,
        score,
        rulesScore,
        ruleHits,
        aiPoints,
        aiRationale,
        guid,
        number: fields['Loan.LoanNumber'] ?? null,
        borrowerName: fields['Loan.BorrowerName'] ?? null,
        loanProductTags: deriveLoanProductTags(fields),
        capacityImpact: computeWeightedCapacityImpact(score, weightOpts),
      };
    });

    scored.sort((a, b) => (sortOrder === 'asc' ? a.score - b.score : b.score - a.score));

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

      const weightedPointsNeeded = row.capacityImpact;
      const loanTags = row.loanProductTags || [];
      const eligibilityByProcessorId = {};
      for (const p of processors) {
        eligibilityByProcessorId[`${p.userId}`] = evaluateProcessorEligibility(loanTags, p);
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

      // Mock apply: never hits Encompass; marks assigned_mock when dryRun is false.
      const status = dryRun ? 'proposed' : 'assigned_mock';
      results.push({
        loanGuid: row.guid,
        status,
        processorUserId: proposedUserId,
        eligibilityNote,
        ...resultRowBase(row),
      });
      processorRemaining[proposedUserId] -= weightedPointsNeeded;
    }

    const summary = {
      proposed: results.filter((r) => r.status === 'proposed').length,
      assigned: results.filter((r) => r.status === 'assigned' || r.status === 'assigned_mock').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    return {
      dryRun: Boolean(dryRun),
      complexityMode: 'rules',
      clientSide: true,
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

  root.processorAssignmentClientRun = {
    run: runProcessorAssignmentClient,
  };
})(typeof window !== 'undefined' ? window : globalThis);
