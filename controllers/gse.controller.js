import { readProducts, readSources, readInvestorOverlays } from '../services/gse-source.service.js';
import { lookupLoanLimit } from '../services/fhfa-loan-limit.service.js';
import { analyzeScenario, normalizeScenario } from '../services/gse-scenario.service.js';
import { askLoanProgramExpert } from '../services/finance-loan-expert.service.js';

export function getGseProducts(req, res) {
  try {
    res.json({ success: true, products: readProducts() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Failed to load products' });
  }
}

export function getGseSources(req, res) {
  try {
    const sources = readSources();
    const overlays = readInvestorOverlays();
    res.json({
      success: true,
      data: {
        ...sources,
        overlayCatalog: {
          version: overlays?.version || '',
          count: Array.isArray(overlays?.overlays) ? overlays.overlays.length : 0
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Failed to load sources' });
  }
}

export function postGseAnalyzeScenario(req, res) {
  try {
    const out = analyzeScenario(req.body);
    if (!out.success) {
      return res.status(400).json({ success: false, errors: out.errors });
    }
    res.json({
      success: true,
      summary: out.summary,
      products: out.products,
      suggestions: out.suggestions,
      warnings: out.warnings
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Analyze failed' });
  }
}

export function postGseImportLoanJson(req, res) {
  try {
    const out = normalizeScenario(req.body);
    if (!out.ok) {
      return res.status(400).json({ success: false, errors: out.errors });
    }
    res.json({
      success: true,
      scenario: out.scenario,
      warnings: out.warnings
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Import failed' });
  }
}

export function getGseLoanLimits(req, res) {
  try {
    const state = req.query.state;
    const county = req.query.county;
    const units = req.query.units ?? '1';
    if (!state || !county) {
      return res.status(400).json({ success: false, error: 'Query params state and county are required.' });
    }
    const hit = lookupLoanLimit(state, county, units);
    if (!hit) {
      return res.status(400).json({
        success: false,
        error: 'No bundled limit row for this state/county. Extend data/gse/fhfa-loan-limits-2026.json or verify fhfa.gov.'
      });
    }
    res.json({
      success: true,
      state: hit.matched.state,
      county: hit.matched.county,
      units: String(Math.min(4, Math.max(1, parseInt(String(units), 10) || 1))),
      conformingLimit: hit.limit,
      year: hit.year,
      highCostArea: hit.highCost
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Lookup failed' });
  }
}

export function postLoanProgramExpert(req, res) {
  try {
    const out = askLoanProgramExpert(req.body || {});
    if (!out.success) {
      return res.status(400).json({
        success: false,
        errors: out.errors || ['Expert request failed.']
      });
    }
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Loan expert failed' });
  }
}
