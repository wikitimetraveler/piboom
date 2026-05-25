/**
 * Development work by David Lane
 */
import { analyzeScenario, normalizeScenario } from './gse-scenario.service.js';
import { readInvestorOverlays, readSources } from './gse-source.service.js';

function normalizeQuestion(value) {
  return String(value || '').trim();
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
  return rows.slice(0, 8);
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

  const recommendation =
    topProducts[0]?.product ||
    'No clear product fit. Re-work scenario and overlay posture before selecting investor execution.';

  const rationale = [
    `Best-fit product from current scenario analysis: ${analysis.summary.bestFit}.`,
    `Risk heuristic: ${analysis.summary.riskLevel}; conforming status: ${analysis.summary.conformingStatus}.`,
    `${overlayOperations.length} overlay issue(s) require operations review before lock.`
  ];

  const requiredVerifications = [
    'Validate AUS path for target agency (DU/LPA/TOTAL/GUS as applicable).',
    'Confirm investor-specific overlays effective at lock date.',
    'Confirm current agency guide eligibility and county/area limits.'
  ];
  if (analysis.summary.conformingStatus === 'unknown') {
    requiredVerifications.push('Confirm county conforming/agency limits with current official datasets before recommendation.');
  }
  if (normalized.scenario.loan.usdaEligibleArea == null) {
    requiredVerifications.push('If evaluating USDA, run USDA eligible-area + household-income checks.');
  }

  const citationIds = new Set();
  for (const row of topProducts) {
    for (const src of row.sourceRefs || []) citationIds.add(src);
  }
  for (const row of overlayOperations) {
    for (const src of row.sourceRefs || []) citationIds.add(src);
  }

  return {
    success: true,
    question,
    expertMode: 'rule-grounded-loan-program-expert',
    recommendation,
    rationale,
    requiredVerifications,
    overlayRisks: overlayOperations,
    productsConsidered: topProducts,
    suggestions: analysis.suggestions || [],
    warnings: analysis.warnings || [],
    citations: toCitationList([...citationIds], sourceMap),
    sourceDisclaimer: readSources()?.disclaimer || '',
    availableOverlayProfiles: (readInvestorOverlays()?.overlays || []).length
  };
}
