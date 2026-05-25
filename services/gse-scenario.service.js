/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import '../public/shared/calcEngineLibrary.js';
import { lookupLoanLimit } from './fhfa-loan-limit.service.js';
import { evaluateProduct } from './gse-rules.service.js';
import { readInvestorOverlays } from './gse-source.service.js';

const { calcMath } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GSE_DIR = path.join(__dirname, '..', 'data', 'gse');

const OCC = new Set(['primary', 'secondHome', 'investment']);
const PURPOSE = new Set(['purchase', 'rateTermRefi', 'cashOutRefi']);
const PROP = new Set(['singleFamily', 'condo', 'pud', '2unit', '3unit', '4unit']);

const FORBIDDEN_BORROWER_KEYS = new Set([
  'name',
  'firstName',
  'lastName',
  'ssn',
  'taxId',
  'email',
  'phone',
  'dob',
  'dateOfBirth',
  'address',
  'street',
  'streetAddress'
]);

const FORBIDDEN_ROOT = new Set(['ssn', 'taxId', 'email', 'phone', 'fullName']);

const PRODUCT_FILES = [
  ['fannie-products.json', 'fannie'],
  ['freddie-products.json', 'freddie'],
  ['va-products.json', 'va'],
  ['fha-products.json', 'fha'],
  ['usda-products.json', 'usda']
];

function loadFullProductRows() {
  const rows = [];
  for (const [file, prefix] of PRODUCT_FILES) {
    const p = path.join(GSE_DIR, file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const prod of data.products || []) {
      rows.push({
        ...prod,
        agency: data.agency,
        productId: `${prefix}:${prod.id}`
      });
    }
  }
  return rows;
}

let productRowsCache;
let investorOverlaysCache;

function getProductRows() {
  if (!productRowsCache) productRowsCache = loadFullProductRows();
  return productRowsCache;
}

function getInvestorOverlays() {
  if (!investorOverlaysCache) {
    const doc = readInvestorOverlays();
    investorOverlaysCache = Array.isArray(doc?.overlays) ? doc.overlays : [];
  }
  return investorOverlaysCache;
}

/**
 * @param {object} body raw POST body
 * @returns {{ ok: true, scenario: object, warnings: string[] } | { ok: false, errors: string[] }}
 */
export function normalizeScenario(body) {
  const warnings = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Body must be a JSON object.'] };
  }

  for (const k of Object.keys(body)) {
    if (FORBIDDEN_ROOT.has(k)) {
      return { ok: false, errors: [`Field "${k}" is not allowed (PII / sensitive).`] };
    }
  }

  const borrower = body.borrower && typeof body.borrower === 'object' ? body.borrower : {};
  for (const k of Object.keys(borrower)) {
    if (FORBIDDEN_BORROWER_KEYS.has(k)) {
      return { ok: false, errors: [`borrower.${k} is not allowed (PII).`] };
    }
  }

  const loan = body.loan && typeof body.loan === 'object' ? body.loan : {};
  const risk = body.risk && typeof body.risk === 'object' ? body.risk : {};

  const errors = [];
  const need = (cond, msg) => {
    if (!cond) errors.push(msg);
  };

  need(borrower.creditScore != null && Number.isFinite(Number(borrower.creditScore)), 'borrower.creditScore is required (number).');
  need(typeof borrower.firstTimeHomebuyer === 'boolean', 'borrower.firstTimeHomebuyer is required (boolean).');
  need(borrower.income != null && Number.isFinite(Number(borrower.income)), 'borrower.income is required (number, annual).');

  need(loan.loanAmount != null && Number.isFinite(Number(loan.loanAmount)), 'loan.loanAmount is required.');
  need(loan.purchasePrice != null && Number.isFinite(Number(loan.purchasePrice)), 'loan.purchasePrice is required.');
  need(loan.ltv != null && Number.isFinite(Number(loan.ltv)), 'loan.ltv is required.');
  need(loan.cltv != null && Number.isFinite(Number(loan.cltv)), 'loan.cltv is required.');
  need(typeof loan.occupancy === 'string' && OCC.has(loan.occupancy), `loan.occupancy must be one of: ${[...OCC].join(', ')}`);
  need(typeof loan.purpose === 'string' && PURPOSE.has(loan.purpose), `loan.purpose must be one of: ${[...PURPOSE].join(', ')}`);
  need(typeof loan.propertyType === 'string' && PROP.has(loan.propertyType), `loan.propertyType must be one of: ${[...PROP].join(', ')}`);
  need(loan.units != null && Number.isFinite(Number(loan.units)), 'loan.units is required (1–4).');
  need(typeof loan.state === 'string' && loan.state.trim().length === 2, 'loan.state is required (2-letter).');
  need(typeof loan.county === 'string' && loan.county.trim().length > 0, 'loan.county is required.');

  need(risk.dti != null && Number.isFinite(Number(risk.dti)), 'risk.dti is required.');
  need(risk.reservesMonths != null && Number.isFinite(Number(risk.reservesMonths)), 'risk.reservesMonths is required.');

  if (errors.length) return { ok: false, errors };

  const units = Math.min(4, Math.max(1, parseInt(String(loan.units), 10)));
  const ltv = Number(loan.ltv);
  const cltv = Number(loan.cltv);
  if (ltv < 0 || ltv > 105) errors.push('loan.ltv must be between 0 and 105.');
  if (cltv < 0 || cltv > 120) errors.push('loan.cltv must be between 0 and 120.');
  if (errors.length) return { ok: false, errors };

  const scenario = {
    borrower: {
      creditScore: Number(borrower.creditScore),
      firstTimeHomebuyer: borrower.firstTimeHomebuyer,
      income: Number(borrower.income),
      ...(borrower.amiPercent != null && Number.isFinite(Number(borrower.amiPercent))
        ? { amiPercent: Number(borrower.amiPercent) }
        : {})
    },
    loan: {
      loanAmount: Number(loan.loanAmount),
      purchasePrice: Number(loan.purchasePrice),
      ltv,
      cltv,
      occupancy: loan.occupancy,
      purpose: loan.purpose,
      propertyType: loan.propertyType,
      units,
      state: String(loan.state).trim().toUpperCase(),
      county: String(loan.county).trim(),
      ...(loan.investorName != null ? { investorName: String(loan.investorName).trim() } : {}),
      ...(loan.channel != null ? { channel: String(loan.channel).trim() } : {}),
      ...(typeof loan.usdaEligibleArea === 'boolean' ? { usdaEligibleArea: loan.usdaEligibleArea } : {})
    },
    risk: {
      dti: Number(risk.dti),
      reservesMonths: Number(risk.reservesMonths),
      ...(typeof risk.manualUnderwrite === 'boolean' ? { manualUnderwrite: risk.manualUnderwrite } : {})
    }
  };

  const derivedLtv = calcMath.gseLtvPercent([scenario.loan.loanAmount, scenario.loan.purchasePrice]);
  if (Math.abs(derivedLtv - ltv) > 0.51) {
    warnings.push(
      `Stated LTV (${ltv}%) differs from loan amount ÷ price (${derivedLtv}%). Analysis uses stated LTV; confirm inputs.`
    );
  }

  return { ok: true, scenario, warnings };
}

export function analyzeScenario(body) {
  const normalized = normalizeScenario(body);
  if (!normalized.ok) {
    return { success: false, errors: normalized.errors };
  }
  const { scenario, warnings: inputWarnings } = normalized;

  const limitHit = lookupLoanLimit(scenario.loan.state, scenario.loan.county, scenario.loan.units);
  let conformingStatus = 'unknown';
  if (limitHit) {
    conformingStatus = calcMath.gseConformingBand([scenario.loan.loanAmount, limitHit.limit]);
    if (limitHit.highCost && conformingStatus === 'within-limit') {
      // Still conforming if under high-cost ceiling in our model (single limit number)
    }
  } else {
    inputWarnings.push('County not found in bundled FHFA sample limits; conforming status is unknown. Add the county to data/gse/fhfa-loan-limits-2026.json or verify at fhfa.gov.');
  }

  const riskLevel = calcMath.gseScenarioRiskLevel([
    scenario.risk.dti,
    scenario.risk.reservesMonths,
    scenario.loan.ltv
  ]);

  const products = [];
  const overlayRows = getInvestorOverlays();
  for (const row of getProductRows()) {
    products.push(evaluateProduct(scenario, row, { overlayRows }));
  }

  const ranked = products.filter((p) => p.status === 'fit' || p.status === 'possible-fit');
  ranked.sort((a, b) => b.score - a.score);
  const bestFit = ranked.length ? ranked[0].product : 'none';

  const suggestions = [
    'Check whether borrower qualifies for HomeReady or Home Possible income limits using official AMI / census tools.',
    'Confirm county conforming loan limit for the subject year at fhfa.gov before product selection.',
    'Run AUS (DU / LPA / TOTAL / GUS as applicable) and comply with investor overlays before final decision.',
    'Document overlay impacts with clear next steps: re-structure, exception path, or alternate investor.'
  ];
  if (conformingStatus === 'unknown') {
    suggestions.push('Load accurate FHFA limit data for the subject county and unit count.');
  }

  const failedOverlayCount = products.reduce(
    (sum, row) => sum + (Array.isArray(row.overlayFindings) ? row.overlayFindings.filter((f) => f.status !== 'pass').length : 0),
    0
  );

  return {
    success: true,
    warnings: [...inputWarnings],
    summary: {
      bestFit,
      riskLevel,
      conformingStatus,
      failedOverlayCount,
      loanLimit: limitHit
        ? { amount: limitHit.limit, year: limitHit.year, highCostArea: limitHit.highCost }
        : null
    },
    products,
    suggestions
  };
}
