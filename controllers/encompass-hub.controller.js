import {
  fetchPipelineLoans,
  fetchLoanDetails,
  writeLoanFields,
  readLoanFields,
  fetchCompanyUsers,
  fetchNativeFields,
  fetchCustomFields,
  createCustomFields,
  postLoanBatchUpdateRequests,
  fetchLoanAssociates,
  assignLoanAssociate,
  unassignLoanAssociate,
} from '../services/encompass-hub.service.js';
import { runProcessorAssignment } from '../services/processor-assignment.service.js';
import {
  ensureEncompassToken,
  getEncompassEnvStatus,
  getEncompassTokenStatus,
  encompassEnvStorage,
} from '../services/encompass-auth.service.js';
import {
  getProcessorAssignmentToolConfig,
  saveProcessorAssignmentToolConfig,
} from '../services/processor-assignment-config.service.js';
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

function parseUserFilters(query = {}) {
  const parseIntValue = (val, fallback) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const parseEnabled = (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const normalized = `${val}`.toLowerCase();
    if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'inactive', 'disabled'].includes(normalized)) return false;
    return undefined;
  };

  return {
    search: query.search?.trim() || undefined,
    personaId: query.personaId || query.personaIds,
    personaName: query.personaName?.trim() || undefined,
    groupId: query.groupId,
    roleId: query.roleId,
    featureId: query.featureId,
    organizationId: query.organizationId,
    includeEmailSignature: query.viewEmailSignature === 'true' || query.includeEmailSignature === 'true',
    start: parseIntValue(query.start, 1),
    limit: parseIntValue(query.limit, 200),
    enabled: parseEnabled(query.enabled),
  };
}

export async function getPipeline(req, res) {
  try {
    const filters = parseFilters(req.query);
    const loans = await fetchPipelineLoans(filters);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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

export async function getCompanyUsers(req, res) {
  try {
    const filters = parseUserFilters(req.query);
    const users = await fetchCompanyUsers(filters);

    return res.json({
      count: users.length,
      items: users,
    });
  } catch (error) {
    console.error('Error fetching Encompass users:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch Encompass users',
      details: error.message,
    });
  }
}

export async function getNativeFields(req, res) {
  try {
    const payload = await fetchNativeFields();
    return res.json(payload);
  } catch (error) {
    console.error('Error fetching Encompass native fields:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch Encompass native fields',
      details: error.message,
    });
  }
}

export async function getCustomFields(req, res) {
  try {
    const payload = await fetchCustomFields();
    return res.json(payload);
  } catch (error) {
    console.error('Error fetching Encompass custom fields:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch Encompass custom fields',
      details: error.message,
    });
  }
}

export async function postCreateFields(req, res) {
  try {
    const fields = req.body;
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        error: 'Request body must be a non-empty array of field definitions',
      });
    }
    const result = await createCustomFields(fields);
    return res.json(result);
  } catch (error) {
    console.error('Error creating Encompass custom fields:', error.message);
    return res.status(500).json({
      error: 'Failed to create Encompass custom fields',
      details: error.message,
    });
  }
}

export async function postLoanBatchUpdateRequestsHandler(req, res) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const { status, data } = await postLoanBatchUpdateRequests(body);
    if (data === undefined || data === null || data === '') {
      return res.status(status).json({});
    }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return res.status(status).json(data);
    }
    if (Array.isArray(data)) {
      return res.status(status).json(data);
    }
    return res.status(status).json({ result: data });
  } catch (error) {
    const status = error.statusCode || error.response?.status || 500;
    const upstream = error.upstream || error.response?.data;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    console.error('Error posting Encompass loan batch update:', error.message, upstream ? { upstream } : '');
    return res.status(safeStatus).json({
      error: 'Failed to post Encompass loan batch update',
      details: error.message,
      upstream: upstream
        ? {
            summary: upstream.summary,
            details: upstream.details,
            errors: upstream.errors,
            message: upstream.message,
          }
        : null,
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

export async function setLoanFields(req, res) {
  try {
    const { loanId } = req.params;
    const payload = req.body;
    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    }
    const result = await writeLoanFields(loanId, payload);
    return res.json(result ?? { success: true });
  } catch (error) {
    const status = error.response?.status || 500;
    const upstream = error.response?.data;
    console.error('Error writing Encompass loan fields:', error.message, upstream ? { upstream } : '');
    return res.status(status).json({
      error: 'Failed to write Encompass loan fields',
      details: error.message,
      upstream: upstream ? { summary: upstream.summary, details: upstream.details, errors: upstream.errors } : null,
    });
  }
}

export async function getLoanFields(req, res) {
  try {
    const { loanGuid } = req.params;
    const { invalidFieldBehavior = 'Include', includeMetadata } = req.query;
    const fieldIds = req.body;

    if (!loanGuid) {
      return res.status(400).json({ error: 'Loan GUID is required' });
    }
    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of field IDs' });
    }

    const result = await readLoanFields(loanGuid, fieldIds, invalidFieldBehavior, includeMetadata);
    return res.json(result ?? []);
  } catch (error) {
    console.error('Error reading Encompass loan fields:', error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Failed to read Encompass loan fields',
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

export async function getLoanAssociatesHandler(req, res) {
  try {
    const { loanGuid } = req.params;
    const { userId, roleId, fixedRoleId } = req.query;
    if (!loanGuid) {
      return res.status(400).json({ error: 'Loan GUID is required' });
    }
    const data = await fetchLoanAssociates(loanGuid, { userId, roleId, fixedRoleId });
    return res.json(Array.isArray(data) ? data : data ?? []);
  } catch (error) {
    console.error('Error fetching loan associates:', error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Failed to fetch loan associates',
      details: error.message,
    });
  }
}

export async function putLoanAssociateHandler(req, res) {
  try {
    const { loanGuid, logId } = req.params;
    const body = req.body;
    if (!loanGuid || !logId) {
      return res.status(400).json({ error: 'loanGuid and logId are required' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object (e.g. { id: userEntityId })' });
    }
    const result = await assignLoanAssociate(loanGuid, logId, body);
    return res.json(result ?? { success: true });
  } catch (error) {
    const status = error.response?.status || 500;
    const upstream = error.response?.data;
    console.error('Error assigning loan associate:', error.message, upstream ? { upstream } : '');
    return res.status(status).json({
      error: 'Failed to assign loan associate',
      details: error.message,
      upstream: upstream ? { summary: upstream.summary, details: upstream.details, errors: upstream.errors } : null,
    });
  }
}

export async function deleteLoanAssociateHandler(req, res) {
  try {
    const { loanGuid, logId } = req.params;
    if (!loanGuid || !logId) {
      return res.status(400).json({ error: 'loanGuid and logId are required' });
    }
    const result = await unassignLoanAssociate(loanGuid, logId);
    return res.json(result ?? { success: true });
  } catch (error) {
    const status = error.response?.status || 500;
    const upstream = error.response?.data;
    console.error('Error unassigning loan associate:', error.message, upstream ? { upstream } : '');
    return res.status(status).json({
      error: 'Failed to unassign loan associate',
      details: error.message,
      upstream: upstream ? { summary: upstream.summary, details: upstream.details, errors: upstream.errors } : null,
    });
  }
}

function requestEncompassEnv() {
  return encompassEnvStorage.getStore()?.env ?? 'correspondent';
}

export async function getProcessorAssignmentConfig(req, res) {
  try {
    const env = requestEncompassEnv();
    const { config, updatedAt } = await getProcessorAssignmentToolConfig(env);
    return res.json({
      encompassEnv: env,
      config: config ?? {},
      updatedAt,
    });
  } catch (error) {
    console.error('Error loading processor assignment config:', error.message);
    const sc = error.statusCode;
    const status =
      typeof sc === 'number' && sc >= 400 && sc < 600 ? sc : 500;
    return res.status(status).json({
      error: 'Failed to load processor assignment config',
      details: error.message,
    });
  }
}

export async function putProcessorAssignmentConfig(req, res) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const env = requestEncompassEnv();
    const { config, updatedAt } = await saveProcessorAssignmentToolConfig(env, body);
    return res.json({
      encompassEnv: env,
      config,
      updatedAt,
    });
  } catch (error) {
    console.error('Error saving processor assignment config:', error.message);
    const sc = error.statusCode;
    const status =
      typeof sc === 'number' && sc >= 400 && sc < 600 ? sc : 500;
    return res.status(status).json({
      error: 'Failed to save processor assignment config',
      details: error.message,
    });
  }
}

export async function postProcessorAssignmentRun(req, res) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const result = await runProcessorAssignment(body);
    return res.json(result);
  } catch (error) {
    console.error('Error running processor assignment:', error.message);
    const sc = error.statusCode;
    const status =
      typeof sc === 'number' && sc >= 400 && sc < 600 ? sc : 500;
    return res.status(status).json({
      error: 'Processor assignment failed',
      details: error.message,
    });
  }
}

