import { fetchPipelineLoans, fetchLoanDetails } from '../services/encompass-hub.service.js';
import {
  ensureEncompassToken,
  getEncompassEnvStatus,
  getEncompassTokenStatus,
} from '../services/encompass-auth.service.js';
import {
  buildCalculatorSummary,
  buildRatioSeries,
  buildMap3dDataset,
  buildStackedCubeDataset,
  buildTimelineSeries,
} from '../services/loan-analytics.service.js';

export async function getHubStatus(req, res) {
  const envStatus = getEncompassEnvStatus();

  if (!envStatus.ok) {
    return res.json({
      connected: false,
      reason: 'missing-env',
      missing: envStatus.missing,
    });
  }

  try {
    if (!getEncompassTokenStatus().connected) {
      await ensureEncompassToken();
    }
    const tokenStatus = getEncompassTokenStatus();
    return res.json({
      connected: tokenStatus.connected,
      expiresAt: tokenStatus.expiresAt,
      secondsRemaining: tokenStatus.secondsRemaining,
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      reason: 'token-error',
      message: error.message,
    });
  }
}

function parseFilters(query = {}, overrides = {}) {
  const coerceNumber = (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseLimit = (val) => {
    const parsed = coerceNumber(val);
    return parsed && parsed > 0 ? parsed : undefined;
  };

  const requestedLimit = parseLimit(query.limit);
  const defaultLimit = overrides.defaultLimit;

  return {
    state: query.state,
    counties: query.counties,
    loanFolder: query.loanFolder,
    loanType: query.loanType,
    loanProgram: query.loanProgram,
    docType: query.docType,
    channel: query.channel,
    branch: query.branch,
    loanPurpose: query.loanPurpose,
    occupancy: query.occupancy,
    propertyType: query.propertyType,
    stage: query.stage,
    milestoneName: query.milestoneName,
    loanOfficerId: query.loanOfficerId,
    processorId: query.processorId,
    underwriterId: query.underwriterId,
    closerId: query.closerId,
    minLoanAmount: coerceNumber(query.minLoanAmount),
    maxLoanAmount: coerceNumber(query.maxLoanAmount),
    minFico: coerceNumber(query.minFico),
    maxFico: coerceNumber(query.maxFico),
    dtiMin: coerceNumber(query.dtiMin),
    dtiMax: coerceNumber(query.dtiMax),
    housingRatioMin: coerceNumber(query.housingRatioMin),
    housingRatioMax: coerceNumber(query.housingRatioMax),
    ratioBuckets: query.ratioBuckets,
    creditBuckets: query.creditBuckets,
    limit: requestedLimit ?? defaultLimit ?? undefined,
  };
}

export async function getPipeline(req, res) {
  try {
    const filters = parseFilters(req.query);
    const loans = await fetchPipelineLoans(filters);

    return res.json({
      count: loans.length,
      items: loans,
    });
  } catch (error) {
    console.error('Error fetching Encompass pipeline:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch Encompass pipeline data',
      details: error.message,
    });
  }
}

export async function getLoan(req, res) {
  try {
    const { loanGuid } = req.params;
    const loan = await fetchLoanDetails(loanGuid);

    return res.json(loan);
  } catch (error) {
    console.error('Error fetching Encompass loan:', error.message);
    const status = error.response?.status === 404 ? 404 : 500;
    return res.status(status).json({
      error: status === 404 ? 'Loan not found' : 'Failed to fetch loan details',
      details: error.message,
    });
  }
}

export async function getCalculatorSummary(req, res) {
  try {
    const filters = parseFilters(req.query, { defaultLimit: 100 });
    const loans = await fetchPipelineLoans(filters);
    const summary = buildCalculatorSummary(loans);

    return res.json({
      count: loans.length,
      summary,
    });
  } catch (error) {
    console.error('Error building calculator summary:', error.message);
    return res.status(500).json({
      error: 'Failed to build calculator summary',
      details: error.message,
    });
  }
}

export async function getRatioAnalytics(req, res) {
  try {
    const filters = parseFilters(req.query, { defaultLimit: 150 });
    const loans = await fetchPipelineLoans(filters);
    const ratios = buildRatioSeries(loans);

    return res.json({
      count: loans.length,
      ratios,
    });
  } catch (error) {
    console.error('Error building ratio analytics:', error.message);
    return res.status(500).json({
      error: 'Failed to build ratio analytics',
      details: error.message,
    });
  }
}

export async function getMapVisualization(req, res) {
  try {
    const filters = parseFilters(req.query, { defaultLimit: 200 });
    const maxGeocodes = req.query.maxGeocodes ? Number(req.query.maxGeocodes) : undefined;
    const loans = await fetchPipelineLoans(filters);
    const dataset = await buildMap3dDataset(loans, {
      maxGeocodes,
    });

    return res.json({
      meta: {
        loans: loans.length,
        geocodeRequestsUsed: dataset.geocodeRequestsUsed,
        geocodingEnabled: dataset.geocodingEnabled,
      },
      features: dataset.features,
    });
  } catch (error) {
    console.error('Error building map visualization dataset:', error.message);
    return res.status(500).json({
      error: 'Failed to build map visualization dataset',
      details: error.message,
    });
  }
}

export async function getStackedVisualization(req, res) {
  try {
    const filters = parseFilters(req.query, { defaultLimit: 200 });
    const loans = await fetchPipelineLoans(filters);
    const dataset = buildStackedCubeDataset(loans);

    return res.json({
      count: loans.length,
      groups: dataset.groups,
    });
  } catch (error) {
    console.error('Error building stacked visualization dataset:', error.message);
    return res.status(500).json({
      error: 'Failed to build stacked visualization dataset',
      details: error.message,
    });
  }
}

export async function getTimelineVisualization(req, res) {
  try {
    const filters = parseFilters(req.query, { defaultLimit: 200 });
    const loans = await fetchPipelineLoans(filters);
    const timeline = buildTimelineSeries(loans);

    return res.json({
      count: loans.length,
      events: timeline.events,
    });
  } catch (error) {
    console.error('Error building timeline visualization dataset:', error.message);
    return res.status(500).json({
      error: 'Failed to build timeline visualization dataset',
      details: error.message,
    });
  }
}
