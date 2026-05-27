/**
 * Development work by David Lane
 */
import { analyzeScenario, normalizeScenario } from './gse-scenario.service.js';
import { readInvestorOverlays, readSources } from './gse-source.service.js';

function normalizeQuestion(value) {
  return String(value || '').trim();
}

function detectQuestionMode(question) {
  const q = normalizeQuestion(question).toLowerCase();
  if (/(ops|operation|next step|what should .* do next|re-structure|restructure|alternate investor|exception path|denied)/.test(q)) {
    return 'ops-next-steps';
  }
  if (/(document|documents|docs|paperwork|required upfront|upfront)/.test(q)) {
    return 'docs-upfront';
  }
  if (/(overlay|blocker|blockers|stop this file|hard stop|hard-stop|investor issue|investor issues)/.test(q)) {
    return 'overlay-blocker-review';
  }
  if (/(compare|versus|\bvs\b|difference|affordable option|affordable options)/.test(q)) {
    return 'product-compare';
  }
  return 'general-guidance';
}

function collectSourceMap() {
  const src = readSources();
  const byId = new Map();
  const direct = Array.isArray(src?.sources) ? src.sources : [];
  for (const row of direct) {
    if (!row?.id) continue;
    byId.set(String(row.id), {
      id: String(row.id),
      title: String(row.title || row.id),
      url: String(row.url || '')
    });
  }
  const refs = src?.sourceRefs && typeof src.sourceRefs === 'object' ? src.sourceRefs : {};
  for (const [id, row] of Object.entries(refs)) {
    byId.set(String(id), {
      id: String(id),
      title: String(row?.title || id),
      url: String(row?.url || '')
    });
  }
  return byId;
}

function toCitationList(ids = [], sourceMap = new Map()) {
  const out = [];
  for (const id of ids) {
    const key = String(id || '').trim();
    if (!key || !sourceMap.has(key)) continue;
    out.push(sourceMap.get(key));
  }
  return out;
}

function productSummaryRows(products = []) {
  return products
    .filter((row) => row.status === 'fit' || row.status === 'possible-fit')
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3)
    .map((row) => ({
      productId: row.productId,
      agency: row.agency,
      product: row.product,
      status: row.status,
      score: row.score,
      whyFit: row.explanation?.whyFit || '',
      nextSteps: row.explanation?.nextSteps || [],
      overlayImpactSummary: row.explanation?.overlayImpactSummary || [],
      keyRequirements: row.contentGuide?.keyRequirements || [],
      documentationExpectations: row.contentGuide?.documentationExpectations || [],
      commonDenialReasons: row.contentGuide?.commonDenialReasons || [],
      sourceRefs: row.sourceRefs || []
    }));
}

function mapOverlayOperations(products = []) {
  const rows = [];
  for (const product of products) {
    for (const overlay of product.overlayFindings || []) {
      if (overlay.status === 'pass') continue;
      rows.push({
        productId: product.productId,
        product: product.product,
        investor: overlay.investor,
        title: overlay.title,
        severity: overlay.severity,
        status: overlay.status,
        reasons: overlay.reasons || [],
        operationsNote: overlay.operationsNote || '',
        sourceRefs: overlay.sourceRefs || []
      });
    }
  }
  const rank = (row) => {
    if (row.status === 'hard-fail') return 0;
    if (row.status === 'soft-fail') return 1;
    return 2;
  };
  return rows
    .sort((a, b) => {
      const byStatus = rank(a) - rank(b);
      if (byStatus !== 0) return byStatus;
      return String(a.product || '').localeCompare(String(b.product || ''));
    })
    .slice(0, 8);
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function buildCitationList(rows = [], overlays = [], sourceMap = new Map()) {
  const ids = new Set();
  for (const row of rows) {
    for (const src of row?.sourceRefs || []) ids.add(src);
  }
  for (const overlay of overlays) {
    for (const src of overlay?.sourceRefs || []) ids.add(src);
  }
  return toCitationList([...ids], sourceMap);
}

function defaultVerifications(analysis, scenario) {
  const requiredVerifications = [
    'Validate AUS path for target agency (DU/LPA/TOTAL/GUS as applicable).',
    'Confirm investor-specific overlays effective at lock date.',
    'Confirm current agency guide eligibility and county/area limits.'
  ];
  if (analysis.summary.conformingStatus === 'unknown') {
    requiredVerifications.push('Confirm county conforming/agency limits with current official datasets before recommendation.');
  }
  if (scenario.loan.usdaEligibleArea == null) {
    requiredVerifications.push('If evaluating USDA, run USDA eligible-area + household-income checks.');
  }
  return requiredVerifications;
}

function buildGeneralGuidance(topProducts, overlayOperations, analysis, scenario, sourceMap) {
  const lead = topProducts[0];
  const recommendation =
    lead?.product ||
    'No clear product fit. Re-work scenario and overlay posture before selecting investor execution.';
  const rationale = uniqueStrings([
    lead ? `${lead.product}: ${lead.whyFit || 'Highest current fit for this scenario.'}` : '',
    `Risk heuristic: ${analysis.summary.riskLevel}; conforming status: ${analysis.summary.conformingStatus}.`,
    overlayOperations.length
      ? `${overlayOperations.length} overlay issue(s) require operations review before lock.`
      : 'No active overlay failures surfaced in the bundled overlay matrix for the likely-fit options.'
  ]);

  return {
    expertMode: 'general-guidance',
    recommendation,
    rationale,
    requiredVerifications: defaultVerifications(analysis, scenario),
    overlayRisks: overlayOperations,
    citations: buildCitationList(topProducts, overlayOperations, sourceMap),
    productsConsidered: topProducts
  };
}

function buildProductCompare(topProducts, overlayOperations, analysis, scenario, sourceMap) {
  const lead = topProducts[0];
  const alt = topProducts[1];
  if (!lead) return buildGeneralGuidance(topProducts, overlayOperations, analysis, scenario, sourceMap);

  const compareRows = alt ? [lead, alt] : [lead];
  const compareOverlays = overlayOperations.filter((row) => compareRows.some((product) => product.productId === row.productId));
  const overlaySummary = compareOverlays.length
    ? `Overlay watch-outs: ${compareOverlays.slice(0, 2).map((row) => `${row.investor} - ${row.title}`).join('; ')}.`
    : 'No active overlay failures surfaced across the compared options.';

  return {
    expertMode: 'product-compare',
    recommendation: alt
      ? `${lead.product} ranks ahead of ${alt.product} for the current scenario.`
      : `${lead.product} is the clearest current fit.`,
    rationale: uniqueStrings([
      `${lead.product}: ${lead.whyFit || 'Highest current fit score.'}`,
      alt ? `${alt.product}: ${alt.whyFit || 'Best alternate path if execution details change.'}` : '',
      overlaySummary
    ]),
    requiredVerifications: uniqueStrings([
      ...defaultVerifications(analysis, scenario),
      ...(lead.keyRequirements || []).slice(0, 2),
      ...(alt?.keyRequirements || []).slice(0, 1)
    ]).slice(0, 5),
    overlayRisks: compareOverlays.slice(0, 6),
    citations: buildCitationList(compareRows, compareOverlays, sourceMap),
    productsConsidered: compareRows
  };
}

function buildOverlayBlockerReview(topProducts, overlayOperations, analysis, scenario, sourceMap) {
  const lead = topProducts[0];
  const blocker = overlayOperations[0];
  const rationale = blocker
    ? uniqueStrings([
        `${blocker.investor}: ${blocker.title} (${blocker.status}).`,
        ...(blocker.reasons || []).slice(0, 2),
        blocker.operationsNote || '',
        overlayOperations[1]
          ? `${overlayOperations[1].investor}: ${overlayOperations[1].title} is another file-level overlay risk.`
          : ''
      ])
    : [
        'No active hard-stop or soft-fail overlay blockers surfaced for the likely-fit products in the bundled matrix.',
        lead ? `${lead.product} remains the lead option subject to current guide and AUS confirmation.` : 'Re-run analysis with a complete scenario to surface blockers.'
      ];

  return {
    expertMode: 'overlay-blocker-review',
    recommendation: blocker
      ? `${blocker.investor}: ${blocker.title} is the most likely overlay blocker for this file.`
      : 'No active overlay blocker surfaced for the likely-fit options in the current matrix.',
    rationale,
    requiredVerifications: uniqueStrings([
      'Confirm lock-date overlay matrix for the selected investor and agency.',
      'Validate agency baseline eligibility and AUS path before treating overlays as the only blocker.',
      blocker?.operationsNote || '',
      ...defaultVerifications(analysis, scenario).slice(0, 2)
    ]).slice(0, 5),
    overlayRisks: overlayOperations.slice(0, 6),
    citations: buildCitationList(lead ? [lead] : [], overlayOperations, sourceMap),
    productsConsidered: topProducts
  };
}

function buildDocsUpfront(topProducts, overlayOperations, analysis, scenario, sourceMap) {
  const lead = topProducts[0];
  if (!lead) return buildGeneralGuidance(topProducts, overlayOperations, analysis, scenario, sourceMap);

  const leadOverlays = overlayOperations.filter((row) => row.productId === lead.productId);
  const docs = uniqueStrings([
    ...(lead.documentationExpectations || []),
    ...(lead.keyRequirements || [])
  ]);

  return {
    expertMode: 'docs-upfront',
    recommendation: `Front-load the file for ${lead.product} with guide and investor documentation before underwriting.`,
    rationale: uniqueStrings([
      `${lead.product}: ${lead.whyFit || 'Best current fit for the scenario.'}`,
      docs[0] ? `Priority doc: ${docs[0]}` : '',
      docs[1] ? `Also collect: ${docs[1]}` : '',
      leadOverlays[0]?.operationsNote || ''
    ]),
    requiredVerifications: uniqueStrings([
      ...docs,
      ...defaultVerifications(analysis, scenario)
    ]).slice(0, 6),
    overlayRisks: leadOverlays.slice(0, 4),
    citations: buildCitationList([lead], leadOverlays, sourceMap),
    productsConsidered: topProducts
  };
}

function buildOpsNextSteps(topProducts, overlayOperations, analysis, scenario, sourceMap) {
  const lead = topProducts[0];
  const opsSteps = uniqueStrings([
    ...(lead?.nextSteps || []),
    ...overlayOperations.map((row) => row.operationsNote || ''),
    ...(analysis.suggestions || [])
  ]).slice(0, 6);

  return {
    expertMode: 'ops-next-steps',
    recommendation: lead
      ? `Operations should work ${lead.product} first, but keep an alternate investor path ready if overlays stay unresolved.`
      : 'Operations should pause investor selection, repair the scenario, and re-run analysis before proceeding.',
    rationale: uniqueStrings([
      lead ? `${lead.product}: ${lead.whyFit || 'Lead execution path based on the current scenario.'}` : '',
      opsSteps[0] || 'Run AUS and confirm current guide eligibility first.',
      opsSteps[1] || '',
      overlayOperations[0] ? `${overlayOperations[0].investor}: ${overlayOperations[0].title} needs resolution before lock.` : ''
    ]),
    requiredVerifications: uniqueStrings([
      ...defaultVerifications(analysis, scenario),
      ...(lead?.commonDenialReasons || []).slice(0, 2)
    ]).slice(0, 6),
    overlayRisks: overlayOperations.slice(0, 6),
    citations: buildCitationList(lead ? [lead] : [], overlayOperations, sourceMap),
    productsConsidered: topProducts
  };
}

export function askLoanProgramExpert(input = {}) {
  const question = normalizeQuestion(input.question);
  if (!question) {
    return { success: false, errors: ['question is required.'] };
  }

  const normalized = normalizeScenario(input.scenario || {});
  if (!normalized.ok) {
    return { success: false, errors: normalized.errors || ['Invalid scenario.'] };
  }

  const analysis = analyzeScenario(normalized.scenario);
  if (!analysis.success) {
    return { success: false, errors: analysis.errors || ['Scenario analysis failed.'] };
  }

  const sourceMap = collectSourceMap();
  const topProducts = productSummaryRows(analysis.products || []);
  const overlayOperations = mapOverlayOperations(analysis.products || []);
  const questionMode = detectQuestionMode(question);
  const response =
    questionMode === 'product-compare'
      ? buildProductCompare(topProducts, overlayOperations, analysis, normalized.scenario, sourceMap)
      : questionMode === 'overlay-blocker-review'
        ? buildOverlayBlockerReview(topProducts, overlayOperations, analysis, normalized.scenario, sourceMap)
        : questionMode === 'docs-upfront'
          ? buildDocsUpfront(topProducts, overlayOperations, analysis, normalized.scenario, sourceMap)
          : questionMode === 'ops-next-steps'
            ? buildOpsNextSteps(topProducts, overlayOperations, analysis, normalized.scenario, sourceMap)
            : buildGeneralGuidance(topProducts, overlayOperations, analysis, normalized.scenario, sourceMap);

  return {
    success: true,
    question,
    expertMode: response.expertMode,
    recommendation: response.recommendation,
    rationale: response.rationale,
    requiredVerifications: response.requiredVerifications,
    overlayRisks: response.overlayRisks,
    productsConsidered: response.productsConsidered,
    suggestions: analysis.suggestions || [],
    warnings: analysis.warnings || [],
    citations: response.citations,
    sourceDisclaimer: readSources()?.disclaimer || '',
    availableOverlayProfiles: (readInvestorOverlays()?.overlays || []).length
  };
}
