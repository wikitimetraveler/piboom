import axios from 'axios';
import { clearEncompassTokenCache, ensureEncompassToken, encompassEnvStorage } from './encompass-auth.service.js';
import {
  buildLoanAnalytics,
} from './loan-analytics.service.js';

const API_BASE_URL = process.env.ENCOMPASS_API_BASE || 'https://concept.api.elliemae.com/encompass/v1';
const API_SERVER = API_BASE_URL.replace(/\/encompass\/v\d+\/?$/i, '');
const API_V3_BASE = `${API_SERVER}/encompass/v3`;
const API_V1_BASE = `${API_SERVER}/encompass/v1`;
const DEFAULT_LIMIT = Number(process.env.ENCOMPASS_PIPELINE_LIMIT || 50);

const PIPELINE_FIELDS = [
  'Loan.LoanGuid',
  'Loan.LoanNumber',
  'Loan.LoanAmount',
  'Loan.BorrowerName',
  'Loan.LoanFolder',
  'Loan.LoanPurpose',
  'Loan.LoanType',
  'Loan.LoanProgram',
  'Loan.LoanChannel',
  'Loan.LoanStatus',
  'Loan.BranchName',
  'Loan.Division',
  'Loan.OccupancyStatus',
  'Loan.PropertyType',
  'Loan.NumberOfUnits',
  'Loan.LoanTerm',
  'Loan.LTV',
  'Loan.CLTV',
  'Loan.HousingRatio',
  'Loan.DebtRatio',
  'Loan.TotalDTI',
  'Loan.TotalExpenseRatio',
  'Loan.BackRatio',
  'Loan.TopRatioPercent',
  'Loan.BottomRatioPercent',
  'Loan.FundsRequiredClose',
  'Loan.ReservesRequiredVerified',
  'Loan.TotalFundsVerified',
  'Loan.CashBack',
  'Loan.NetCashBack',
  'Loan.ProposedTotalMonthlyDebt',
  'Loan.ProposedTotalHousingPayment',
  'Loan.ProposedHazardInsurance',
  'Loan.ProposedTaxes',
  'Loan.ProposedMortgageInsurance',
  'Loan.ProposedHoaFees',
  'Loan.ProposedOtherPayment',
  'Loan.FirstPaymentPrincipalAndInterest',
  'Loan.CurrentMilestoneId',
  'Loan.CurrentMilestoneName',
  'Loan.CurrentMilestoneDate',
  'Loan.BorrowerScore',
  'Loan.BorrowerScore2',
  'Loan.BorrowerScore3',
  'Loan.CoBorrowerScore',
  'Loan.CoBorrowerScore2',
  'Loan.CoBorrowerScore3',
  'Loan.LoanOfficerID',
  'Loan.LoanOfficerName',
  'Loan.LoanProcessorID',
  'Loan.LoanProcessorName',
  'Loan.UnderwriterID',
  'Loan.UnderwriterName',
  'Loan.CloserID',
  'Loan.CloserName',
  'Loan.InvestorName',
  'Fields.1172', // Loan program (legacy)
  'Fields.4000', // Doc / channel specific type
  'Fields.11', // Property Street
  'Fields.12', // Property City
  'Fields.13', // Property Zip
  'Fields.14', // Property State
  'Fields.15', // Property County
];

const BASE_TERMS = [
  {
    canonicalName: 'Loan.LoanFolder',
    value: 'My Pipeline',
    matchType: 'exact',
  },
  {
    canonicalName: 'Fields.11',
    matchType: 'isNotEmpty',
  },
  {
    canonicalName: 'Fields.12',
    matchType: 'isNotEmpty',
  },
  {
    canonicalName: 'Fields.15',
    matchType: 'isNotEmpty',
  },
];

async function requestWithAuth(config, { retryOn401 = true } = {}) {
  const token = await ensureEncompassToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const requestConfig = {
    ...config,
    headers,
  };

  try {
    return await axios(requestConfig);
  } catch (error) {
    if (retryOn401 && error.response?.status === 401) {
      clearEncompassTokenCache();
      const refreshedToken = await ensureEncompassToken();
      return axios({
        ...requestConfig,
        headers: {
          ...headers,
          Authorization: `Bearer ${refreshedToken}`,
        },
      });
    }
    throw error;
  }
}

function normalizePipelineItems(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return [];
  }

  const arr =
    payload.items ??
    payload.pipelineData ??
    payload.data ??
    payload.loans ??
    payload.results ??
    payload.pipeline;
  return Array.isArray(arr) ? arr : [];
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function coercePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

function normalizeUserProfile(user = {}) {
  const personaIds = Array.isArray(user.personaIds)
    ? user.personaIds.filter((id) => id !== null && id !== undefined)
    : [];
  const personaNames = Array.isArray(user.personas)
    ? user.personas.map((p) => p?.entityName).filter(Boolean)
    : [];
  const workingFolders = Array.isArray(user.workingFolders)
    ? user.workingFolders.filter(Boolean)
    : user.workingFolder
      ? [user.workingFolder].filter(Boolean)
      : [];
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const indicators = Array.isArray(user.userIndicators) ? user.userIndicators.filter(Boolean) : [];
  const orgName = user.organization?.entityName || user.organizationName || null;
  const orgId = user.organization?.entityId || user.organizationId || null;

  return {
    id: user.id ?? null,
    userId: user.userId ?? user.id ?? null,
    loginName: user.loginName || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    name: fullName || user.userName || user.loginName || 'Unknown',
    email: user.email || null,
    title: user.title || user.jobTitle || null,
    enabled: user.enabled !== false,
    personaIds,
    personaNames,
    workingFolders,
    organization: orgName || orgId
      ? {
          id: orgId,
          name: orgName,
          uri: user.organization?.entityUri || null,
        }
      : null,
    indicators,
    access: {
      subordinate: user.subordinateLoanAccess || null,
      peer: user.peerLoanAccess || null,
    },
    personalStatusOnline: Boolean(user.personalStatusOnline),
    lastLogin: parseDate(user.lastLogin) || null,
    encompassVersion: user.encompassVersion || null,
    aclPath: user.aclPath || null,
    createdAt: user.createdDateTime || user.createdDate || null,
    updatedAt: user.updatedDateTime || user.lastUpdatedDateTime || null,
    eFolderUser: Boolean(user.eFolderUser),
    comments: user.comments || null,
  };
}

function filterUsersList(users, filters = {}) {
  const { search, enabled, personaId, personaName } = filters;
  let filtered = [...users];

  if (enabled === true || enabled === false) {
    filtered = filtered.filter((user) => user.enabled === enabled);
  }

  if (personaId !== undefined && personaId !== null && personaId !== '') {
    const personaKey = `${personaId}`.trim();
    filtered = filtered.filter((user) => user.personaIds.some((id) => `${id}` === personaKey));
  }

  if (personaName !== undefined && personaName !== null && `${personaName}`.trim() !== '') {
    const needle = `${personaName}`.trim().toLowerCase();
    filtered = filtered.filter(
      (user) =>
        Array.isArray(user.personaNames) &&
        user.personaNames.some((n) => `${n}`.toLowerCase().includes(needle)),
    );
  }

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter((user) =>
      [user.name, user.loginName, user.email, user.title].some((value) =>
        value?.toLowerCase().includes(term),
      ),
    );
  }

  return filtered;
}

function normalizeListParam(input) {
  if (!input && input !== 0) {
    return undefined;
  }
  if (Array.isArray(input)) {
    return input.map((entry) => `${entry}`.trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [`${input}`.trim()].filter(Boolean);
}

function normalizeCounties(counties) {
  const list = normalizeListParam(counties);
  return list ? list.map((c) => c.toLowerCase()) : undefined;
}

function toUpper(value) {
  return typeof value === 'string' ? value.toUpperCase() : undefined;
}

function buildActorFromFields(fields, prefix, role) {
  const id = fields[`Loan.${prefix}ID`] ?? fields[`Loan.${prefix}Id`] ?? null;
  const name = fields[`Loan.${prefix}Name`] ?? null;
  if (!id && !name) {
    return null;
  }
  return {
    id,
    name,
    role: role || prefix,
  };
}

function buildActors(item, fields) {
  const actors = {
    loanOfficer: buildActorFromFields(fields, 'LoanOfficer', 'Loan Officer'),
    processor: buildActorFromFields(fields, 'LoanProcessor', 'Processor'),
    underwriter: buildActorFromFields(fields, 'Underwriter', 'Underwriter'),
    closer: buildActorFromFields(fields, 'Closer', 'Closer'),
  };

  if (Array.isArray(item?.loanAssociates)) {
    item.loanAssociates.forEach((associate) => {
      const roleName = associate?.role?.entityName?.toLowerCase() || associate?.roleName?.toLowerCase();
      if (!roleName) return;
      if (roleName.includes('loan officer') && !actors.loanOfficer) {
        actors.loanOfficer = {
          id: associate?.loanAssociate?.user?.entityId || associate?.loanAssociate?.user?.entityName || null,
          name: associate?.loanAssociate?.user?.entityName || associate?.loanAssociate?.title || null,
          role: 'Loan Officer',
        };
      }
      if (roleName.includes('processor') && !actors.processor) {
        actors.processor = {
          id: associate?.loanAssociate?.user?.entityId || associate?.loanAssociate?.user?.entityName || null,
          name: associate?.loanAssociate?.user?.entityName || associate?.loanAssociate?.title || null,
          role: 'Processor',
        };
      }
      if (roleName.includes('underwriter') && !actors.underwriter) {
        actors.underwriter = {
          id: associate?.loanAssociate?.user?.entityId || associate?.loanAssociate?.user?.entityName || null,
          name: associate?.loanAssociate?.user?.entityName || associate?.loanAssociate?.title || null,
          role: 'Underwriter',
        };
      }
      if (roleName.includes('closer') && !actors.closer) {
        actors.closer = {
          id: associate?.loanAssociate?.user?.entityId || associate?.loanAssociate?.user?.entityName || null,
          name: associate?.loanAssociate?.user?.entityName || associate?.loanAssociate?.title || null,
          role: 'Closer',
        };
      }
    });
  }

  return actors;
}

function buildNormalizedLoan(item) {
  const fields = item?.fields ?? {};
  const getValue = (key) => fields[key] ?? null;
  const propertyState = getValue('Fields.14');
  const propertyCounty = getValue('Fields.15');

  const payments = {
    principalInterest: parseNumber(
      getValue('Loan.FirstPaymentPrincipalAndInterest') ?? getValue('Loan.PandI'),
    ),
    hazardInsurance: parseNumber(getValue('Loan.ProposedHazardInsurance')),
    taxes: parseNumber(getValue('Loan.ProposedTaxes')),
    mortgageInsurance: parseNumber(getValue('Loan.ProposedMortgageInsurance')),
    hoa: parseNumber(getValue('Loan.ProposedHoaFees')),
    other: parseNumber(getValue('Loan.ProposedOtherPayment')),
    totalHousing: parseNumber(getValue('Loan.ProposedTotalHousingPayment')),
    totalDebt: parseNumber(getValue('Loan.ProposedTotalMonthlyDebt')),
  };

  const metrics = {
    loanAmount: parseNumber(getValue('Loan.LoanAmount')),
    housingRatio: parseNumber(
      getValue('Loan.HousingRatio') ??
        getValue('Loan.TopRatioPercent') ?? // front ratio
        getValue('Loan.BottomRatioPercent') ?? // some exports store front ratio here
        getValue('Loan.TotalExpenseRatio'),
    ),
    totalDTI: parseNumber(
      getValue('Loan.TotalDTI') ??
        getValue('Loan.DebtRatio') ??
        getValue('Loan.TotalExpenseRatio') ??
        getValue('Loan.BackRatio') ??
        getValue('Loan.BottomRatioPercent'),
    ),
    ltv: parseNumber(getValue('Loan.LTV')),
    cltv: parseNumber(getValue('Loan.CLTV')),
    fundsRequired: parseNumber(getValue('Loan.FundsRequiredClose')),
    reservesRequired: parseNumber(getValue('Loan.ReservesRequiredVerified')),
    verifiedFunds: parseNumber(getValue('Loan.TotalFundsVerified')),
    cashBack: parseNumber(getValue('Loan.CashBack')),
    netCashBack: parseNumber(getValue('Loan.NetCashBack')),
  };

  const credit = {
    primary: {
      score: parseNumber(
        getValue('Loan.BorrowerScore') ?? getValue('Loan.BorrowerScore2') ?? getValue('Loan.BorrowerScore3'),
      ),
    },
    secondary: {
      score: parseNumber(
        getValue('Loan.CoBorrowerScore') ??
          getValue('Loan.CoBorrowerScore2') ??
          getValue('Loan.CoBorrowerScore3'),
      ),
    },
  };

  const stage = {
    folder: getValue('Loan.LoanFolder') ?? item.loanFolder ?? null,
    milestoneId: getValue('Loan.CurrentMilestoneId'),
    milestone: getValue('Loan.CurrentMilestoneName'),
    milestoneDate: parseDate(getValue('Loan.CurrentMilestoneDate')),
    status: getValue('Loan.LoanStatus') ?? item.loanStatus ?? null,
  };

  return {
    guid: item.loanGuid ?? getValue('Loan.LoanGuid'),
    number: getValue('Loan.LoanNumber'),
    borrowerName: getValue('Loan.BorrowerName'),
    docType: getValue('Fields.4000'),
    loanProgram: getValue('Loan.LoanProgram') ?? getValue('Fields.1172'),
    loanPurpose: getValue('Loan.LoanPurpose'),
    loanType: getValue('Loan.LoanType'),
    channel: getValue('Loan.LoanChannel'),
    branch: getValue('Loan.BranchName'),
    division: getValue('Loan.Division'),
    occupancy: getValue('Loan.OccupancyStatus'),
    propertyType: getValue('Loan.PropertyType'),
    property: {
      street: getValue('Fields.11'),
      city: getValue('Fields.12'),
      postalCode: getValue('Fields.13'),
      state: propertyState ? propertyState.toUpperCase() : null,
      county: propertyCounty,
      countyKey: propertyCounty ? propertyCounty.toLowerCase() : null,
    },
    metrics,
    payments,
    credit,
    actors: buildActors(item, fields),
    stage,
    filters: {
      state: propertyState ? propertyState.toUpperCase() : null,
      county: propertyCounty ? propertyCounty.toLowerCase() : null,
      channel: getValue('Loan.LoanChannel') ? getValue('Loan.LoanChannel').toLowerCase() : null,
      branch: getValue('Loan.BranchName') ? getValue('Loan.BranchName').toLowerCase() : null,
    },
  };
}

function enrichLoanRecord(item) {
  const normalized = buildNormalizedLoan(item);
  const analytics = buildLoanAnalytics(normalized);
  return {
    ...item,
    normalized,
    analytics,
  };
}

function applyAdvancedFilters(loans, filters = {}) {
  return loans.filter((loan) => {
    const normalized = loan.normalized;
    if (!normalized) {
      return false;
    }

    if (filters.state && normalized.filters.state !== filters.state) {
      return false;
    }

    if (filters.counties?.length) {
      if (!normalized.filters.county || !filters.counties.includes(normalized.filters.county)) {
        return false;
      }
    }

    if (filters.loanFolder && normalized.stage.folder !== filters.loanFolder) {
      return false;
    }

    if (filters.loanProgram && normalized.loanProgram !== filters.loanProgram) {
      return false;
    }

    if (filters.docType && normalized.docType !== filters.docType) {
      return false;
    }

    if (filters.loanPurpose && normalized.loanPurpose !== filters.loanPurpose) {
      return false;
    }

    if (filters.channel && normalized.channel !== filters.channel) {
      return false;
    }

    if (filters.branch && normalized.branch?.toLowerCase() !== filters.branch.toLowerCase()) {
      return false;
    }

    if (filters.occupancy && normalized.occupancy !== filters.occupancy) {
      return false;
    }

    if (filters.propertyType && normalized.propertyType !== filters.propertyType) {
      return false;
    }

    if (filters.stage && normalized.stage.milestone !== filters.stage && normalized.stage.folder !== filters.stage) {
      return false;
    }

    if (
      filters.milestoneName &&
      (!normalized.stage.milestone || normalized.stage.milestone.toLowerCase() !== filters.milestoneName.toLowerCase())
    ) {
      return false;
    }

    if (
      filters.loanOfficerId &&
      normalized.actors.loanOfficer?.id?.toString() !== filters.loanOfficerId.toString()
    ) {
      return false;
    }

    if (
      filters.processorId &&
      normalized.actors.processor?.id?.toString() !== filters.processorId.toString()
    ) {
      return false;
    }

    if (
      filters.underwriterId &&
      normalized.actors.underwriter?.id?.toString() !== filters.underwriterId.toString()
    ) {
      return false;
    }

    if (filters.closerId && normalized.actors.closer?.id?.toString() !== filters.closerId.toString()) {
      return false;
    }

    if (
      filters.minLoanAmount !== undefined &&
      normalized.metrics.loanAmount !== null &&
      normalized.metrics.loanAmount < filters.minLoanAmount
    ) {
      return false;
    }

    if (
      filters.maxLoanAmount !== undefined &&
      normalized.metrics.loanAmount !== null &&
      normalized.metrics.loanAmount > filters.maxLoanAmount
    ) {
      return false;
    }

    const primaryScore = normalized.credit.primary?.score ?? normalized.credit.secondary?.score ?? null;
    if (filters.minFico !== undefined && primaryScore !== null && primaryScore < filters.minFico) {
      return false;
    }

    if (filters.maxFico !== undefined && primaryScore !== null && primaryScore > filters.maxFico) {
      return false;
    }

    if (
      filters.dtiMin !== undefined &&
      normalized.metrics.totalDTI !== null &&
      normalized.metrics.totalDTI < filters.dtiMin
    ) {
      return false;
    }

    if (
      filters.dtiMax !== undefined &&
      normalized.metrics.totalDTI !== null &&
      normalized.metrics.totalDTI > filters.dtiMax
    ) {
      return false;
    }

    if (
      filters.housingRatioMin !== undefined &&
      normalized.metrics.housingRatio !== null &&
      normalized.metrics.housingRatio < filters.housingRatioMin
    ) {
      return false;
    }

    if (
      filters.housingRatioMax !== undefined &&
      normalized.metrics.housingRatio !== null &&
      normalized.metrics.housingRatio > filters.housingRatioMax
    ) {
      return false;
    }

    if (filters.ratioBuckets?.length) {
      const bucketId = loan.analytics?.ratioBuckets?.total?.id || loan.analytics?.ratioBuckets?.housing?.id;
      if (!bucketId || !filters.ratioBuckets.includes(bucketId)) {
        return false;
      }
    }

    if (filters.creditBuckets?.length) {
      const creditBucket = loan.analytics?.creditBucket;
      if (!creditBucket || !filters.creditBuckets.includes(creditBucket)) {
        return false;
      }
    }

    return true;
  });
}

export async function fetchCompanyUsers(options = {}) {
  const {
    search,
    groupId,
    roleId,
    personaId,
    personaName,
    featureId,
    organizationId,
    includeEmailSignature = false,
    start = 1,
    limit = 200,
    enabled,
  } = options;

  const safeStart = coercePositiveInteger(start, 1) ?? 1;
  const safeLimit = Math.min(coercePositiveInteger(limit, 200) ?? 200, 1000);

  const hasPersonaName =
    personaName !== undefined && personaName !== null && `${personaName}`.trim() !== '';
  const hasPersonaId =
    personaId !== undefined && personaId !== null && `${personaId}`.trim() !== '';
  // Name-based filter is applied client-side on normalized personas; omit API personaId when only
  // personaName is used so the returned page is not over-restricted by an unrelated id.
  const apiPersonaId = hasPersonaId ? personaId : undefined;

  let response;
  try {
    response = await requestWithAuth({
      method: 'get',
      url: `${API_BASE_URL}/company/users`,
      params: {
        viewEmailSignature: includeEmailSignature ? 'true' : undefined,
        groupId,
        roleId,
        personaId: apiPersonaId,
        featureId,
        organizationId,
        userName: search || undefined,
        start: safeStart,
        limit: safeLimit,
      },
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass company users request failed', {
      status,
      data,
      message: error.message,
    });
    const detail = data?.message || data?.error || error.message;
    throw new Error(`Encompass users ${status || 'error'}: ${detail}`);
  }

  const rawUsers = Array.isArray(response.data) ? response.data : response.data?.items || [];
  const normalized = rawUsers.map(normalizeUserProfile);
  return filterUsersList(normalized, {
    search,
    enabled,
    personaId: hasPersonaId ? personaId : undefined,
    personaName: hasPersonaName ? personaName : undefined,
  });
}

function normalizeFieldsPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (
    data.items ||
    data.fields ||
    data.standardFields ||
    data.customFields ||
    data.fieldDefinitions ||
    []
  );
}

export async function fetchNativeFields() {
  try {
    const response = await requestWithAuth({
      method: 'get',
      url: `${API_V3_BASE}/schemas/loan/standardFields`,
      params: { start: 0, limit: 30000 },
    });
    const items = normalizeFieldsPayload(response.data);
    const hasBaseLoanAmount = items.some((item) => (
      item?.jsonPath === '$.baseLoanAmount' ||
      item?.contractPath === 'loan.baseLoanAmount' ||
      item?.id === '2' ||
      item?.fieldId === '2'
    ));
    if (!hasBaseLoanAmount) {
      items.push({
        id: '2',
        fieldId: '2',
        fieldName: 'baseLoanAmount',
        description: 'Trans Details Total Loan Amt (w/ MIP/FF)',
        format: 'DECIMAL_2',
        readOnly: true,
        fieldLock: true,
        nullable: true,
        category: 'Common',
        dataType: 'Decimal',
        maxLength: 14,
        multiInstance: false,
        contractPath: 'loan.baseLoanAmount',
        jsonPath: '$.baseLoanAmount',
      });
    }
    return { count: items.length, items };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass native fields request failed', {
      status,
      data,
      message: error.message,
    });
    const detail = data?.message || data?.error || error.message;
    throw new Error(`Encompass native fields ${status || 'error'}: ${detail}`);
  }
}

export async function fetchCustomFields() {
  try {
    const response = await requestWithAuth({
      method: 'get',
      url: `${API_V3_BASE}/settings/loan/customFields`,
    });
    const items = normalizeFieldsPayload(response.data);
    return { count: items.length, items };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass custom fields request failed', {
      status,
      data,
      message: error.message,
    });
    const detail = data?.message || data?.error || error.message;
    throw new Error(`Encompass custom fields ${status || 'error'}: ${detail}`);
  }
}

/**
 * Patch loan custom field definitions (add or update) via Encompass settings API.
 * Passes payload exactly as received - no transformation.
 * @param {Array<object>} fields - Array of field definitions (tool4 JSON format)
 * @param {'add'|'update'} action - Encompass action query value.
 * @returns {Promise<{ succeeded: number, failed: Array<{id: string, error: string}> }>}
 */
async function patchLoanCustomFields(fields, action) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('fields must be a non-empty array');
  }
  if (action !== 'add' && action !== 'update') {
    throw new Error('action must be add or update');
  }
  const payloads = fields.filter((f) => f && (f.id || f.Id || f.fieldId));
  if (payloads.length === 0) {
    return { succeeded: 0, failed: fields.map((f) => ({ id: f?.id || f?.Id || 'unknown', error: 'Missing field id' })) };
  }

  const baseUrl = `${API_V3_BASE}/settings/loan/customFields?action=${encodeURIComponent(action)}&view=entity`;
  const logLabel = action === 'update' ? '[Encompass update-fields]' : '[Encompass create-fields]';

  // Helper to extract readable error message from Encompass response
  function extractErrorMessage(err) {
    const data = err.response?.data;
    if (!data) return err.message;
    if (typeof data === 'string') return data;
    const msg = data.message || data.error;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(data.errors) && data.errors[0]) {
      const e = data.errors[0];
      return typeof e === 'string' ? e : (e.message || e.code || JSON.stringify(e));
    }
    return JSON.stringify(data);
  }

  function captureError(err, fieldId = 'batch') {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = extractErrorMessage(err);
    console.error(logLabel, { fieldId, status, encompassResponse: data });
    return `${status || 'error'}: ${msg}`;
  }

  // Try batch first.
  try {
    await requestWithAuth({
      method: 'patch',
      url: baseUrl,
      data: payloads,
    });
    return { succeeded: payloads.length, failed: [] };
  } catch (batchError) {
    const msg = captureError(batchError, 'batch');
    if (batchError.response?.status !== 405 && batchError.response?.status !== 404) {
      return { succeeded: 0, failed: payloads.map((p) => ({ id: p.id, error: msg })) };
    }
  }

  // Fallback: one field per request.
  const results = { succeeded: 0, failed: [] };
  for (const payload of payloads) {
    try {
      await requestWithAuth({
        method: 'patch',
        url: baseUrl,
        data: payload,
      });
      results.succeeded += 1;
    } catch (error) {
      results.failed.push({ id: payload.id, error: captureError(error, payload.id) });
    }
  }
  return results;
}

/**
 * Create custom fields in Encompass via the settings API.
 * Uses: PATCH /encompass/v3/settings/loan/customFields?action=add&view=entity
 * @param {Array<object>} fields - Array of field definitions (tool4 JSON format)
 * @returns {Promise<{ created: number, failed: Array<{id: string, error: string}> }>}
 */
export async function createCustomFields(fields) {
  const { succeeded, failed } = await patchLoanCustomFields(fields, 'add');
  return { created: succeeded, failed };
}

/**
 * Update existing custom fields in Encompass via the settings API.
 * Uses: PATCH /encompass/v3/settings/loan/customFields?action=update&view=entity
 * @param {Array<object>} fields - Array of field definitions (tool4 JSON format)
 * @returns {Promise<{ updated: number, failed: Array<{id: string, error: string}> }>}
 */
export async function updateCustomFields(fields) {
  const { succeeded, failed } = await patchLoanCustomFields(fields, 'update');
  return { updated: succeeded, failed };
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function fetchPipelineLoans(options = {}) {
  const {
    state,
    counties,
    limit = DEFAULT_LIMIT,
    loanFolder = 'My Pipeline',
    loanType, // legacy field pointing at loan program
    loanProgram,
    docType,
    channel,
    branch,
    loanPurpose,
    occupancy,
    propertyType,
    stage,
    milestoneName,
    minLoanAmount,
    maxLoanAmount,
    minFico,
    maxFico,
    dtiMin,
    dtiMax,
    housingRatioMin,
    housingRatioMax,
    ratioBuckets,
    creditBuckets,
    loanOfficerId,
    processorId,
    underwriterId,
    closerId,
  } = options;

  const env = encompassEnvStorage.getStore()?.env ?? 'correspondent';
  const parsedLimit = Number(limit) > 0 ? Number(limit) : DEFAULT_LIMIT;
  const resolvedLoanProgram = loanProgram || loanType || null;

  const isRetail = env === 'retail';
  let requestData;

  if (isRetail) {
    // Retail: v3 loanPipeline — body from working Postman request
    // v3 uses "Pipeline" not "My Pipeline" for the default folder
    const folderValue = (loanFolder === 'My Pipeline' ? 'Pipeline' : loanFolder) || 'Pipeline';
    requestData = {
      fields: [
        ...new Set([
          'Loan.LoanGuid',
          'Loan.LoanFolder',
          'Fields.4000',
          'Loan.LoanNumber',
          'Loan.LoanRate',
          'Loan.LoanAmount',
          'Loan.LastModified',
          'Loan.BorrowerName',
          'Loan.LoanType',
          'Loan.LoanProgram',
          'Loan.PropertyType',
          'Loan.TotalDTI',
          'Loan.LTV',
          'Loan.BorrowerScore',
          'Loan.CoBorrowerScore',
          'Loan.LoanProcessorID',
          'Fields.1172',
          'Loan.InvestorName',
          ...PIPELINE_FIELDS,
        ]),
      ],
      sortOrder: [
        {
          canonicalName: 'Loan.LastModified',
          order: 'Descending',
        },
      ],
      filter: {
        canonicalName: 'Loan.LoanFolder',
        value: folderValue,
        matchType: 'exact',
      },
      orgType: 'Internal',
      loanOwnership: 'AllLoans',
    };
  } else {
    // Correspondent: v3 loanPipeline with terms (operator + terms)
    let terms = [...BASE_TERMS];
    if (loanFolder && loanFolder !== 'My Pipeline') {
      terms[0] = {
        canonicalName: 'Loan.LoanFolder',
        value: loanFolder,
        matchType: 'exact',
      };
    }
    if (resolvedLoanProgram) {
      terms.push({
        canonicalName: 'Fields.1172',
        value: resolvedLoanProgram,
        matchType: 'exact',
      });
    }
    if (docType) {
      terms.push({
        canonicalName: 'Fields.4000',
        value: docType,
        matchType: 'exact',
      });
    }
    requestData = {
      filter: { operator: 'and', terms },
      fields: PIPELINE_FIELDS,
      sortOrder: [
        { canonicalName: 'Loan.LoanNumber', order: 'Descending' },
        { canonicalName: 'Fields.4000', order: 'Descending' },
      ],
      orgType: 'Internal',
      loanOwnership: 'AllLoans',
    };
  }

  const pipelineUrl = `${API_V3_BASE}/loanPipeline`;
  const pipelineParams = { start: 0, limit: Math.min(Math.max(parsedLimit, 1), 100) };

  let response;
  try {
    response = await requestWithAuth({
      method: 'post',
      url: pipelineUrl,
      data: requestData,
      params: pipelineParams,
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass loanPipeline request failed', {
      status,
      data,
      message: error.message,
    });
    const detail = data?.message || data?.error || error.message;
    throw new Error(`Encompass loanPipeline ${status || 'error'}: ${detail}`);
  }

  let rawItems = normalizePipelineItems(response.data);
  // v3 API: normalize item shape for parsing (loanId→loanGuid, fields/fieldData)
  if (rawItems.length > 0) {
    rawItems = rawItems.map((item) => {
      const loanGuid = item.loanGuid ?? item.loanId ?? null;
      let fields = item.fields ?? item.fieldData;
      if (!fields || typeof fields !== 'object') {
        // Fields may be at top level (Loan.X, Fields.X)
        fields = {};
        for (const [k, v] of Object.entries(item)) {
          if (k.startsWith('Loan.') || k.startsWith('Fields.')) {
            fields[k] = v;
          }
        }
      }
      return { ...item, loanGuid, fields };
    });
  }
  if (rawItems.length === 0 && response.data != null) {
    console.warn('[Encompass v3 pipeline] 0 items; response:', Array.isArray(response.data) ? `array[${response.data.length}]` : Object.keys(response.data));
  }
  const items = rawItems
    .map((item) => {
      try {
        return enrichLoanRecord(item);
      } catch (err) {
        console.warn('[Encompass pipeline] Failed to parse item:', item?.loanId ?? item?.loanGuid, err.message);
        return null;
      }
    })
    .filter(Boolean);
  // Retail uses "Pipeline" not "My Pipeline"; filter must match API response
  const effectiveLoanFolder = isRetail
    ? ((loanFolder === 'My Pipeline' ? 'Pipeline' : loanFolder) || 'Pipeline')
    : loanFolder;
  const filteredItems = applyAdvancedFilters(items, {
    state: toUpper(state),
    counties: normalizeCounties(counties),
    loanFolder: effectiveLoanFolder,
    loanProgram: resolvedLoanProgram || undefined,
    docType,
    loanPurpose,
    channel,
    branch,
    occupancy,
    propertyType,
    stage,
    milestoneName: milestoneName ? milestoneName.trim().toLowerCase() : undefined,
    minLoanAmount: coerceNumber(minLoanAmount),
    maxLoanAmount: coerceNumber(maxLoanAmount),
    minFico: coerceNumber(minFico),
    maxFico: coerceNumber(maxFico),
    dtiMin: coerceNumber(dtiMin),
    dtiMax: coerceNumber(dtiMax),
    housingRatioMin: coerceNumber(housingRatioMin),
    housingRatioMax: coerceNumber(housingRatioMax),
    ratioBuckets: normalizeListParam(ratioBuckets),
    creditBuckets: normalizeListParam(creditBuckets),
    loanOfficerId,
    processorId,
    underwriterId,
    closerId,
  });

  return filteredItems;
}

export async function fetchLoanDetails(loanGuid) {
  if (!loanGuid) {
    throw new Error('loanGuid is required');
  }

  const response = await requestWithAuth({
    method: 'get',
    url: `${API_BASE_URL}/loans/${loanGuid}`,
  });

  return response.data;
}

export async function writeLoanFields(loanId, fieldsPayload = []) {
  if (!loanId) {
    throw new Error('loanId is required');
  }
  if (!Array.isArray(fieldsPayload) || fieldsPayload.length === 0) {
    throw new Error('fieldsPayload must be a non-empty array');
  }

  try {
    const response = await requestWithAuth({
      method: 'post',
      url: `${API_V3_BASE}/loans/${encodeURIComponent(loanId)}/fieldWriter`,
      data: fieldsPayload,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    const errorsJson = data?.errors ? JSON.stringify(data.errors) : '';
    console.error('Encompass fieldWriter request failed', {
      status,
      summary: data?.summary,
      details: data?.details,
      errors: data?.errors,
      message: error.message,
    });
    const detail = data?.details || data?.message || data?.error || error.message;
    const fullDetail = errorsJson ? `${detail} | errors: ${errorsJson}` : detail;
    throw new Error(`Encompass fieldWriter ${status || 'error'}: ${fullDetail}`);
  }
}

export async function readLoanFields(loanGuid, fieldIds = [], invalidFieldBehavior = 'Include', includeMetadata) {
  if (!loanGuid) {
    throw new Error('loanGuid is required');
  }
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    throw new Error('fieldIds must be a non-empty array');
  }

  const params = { invalidFieldBehavior };
  if (includeMetadata === 'true' || includeMetadata === true) {
    params.includeMetadata = 'true';
  }

  try {
    const response = await requestWithAuth({
      method: 'post',
      url: `${API_V3_BASE}/loans/${encodeURIComponent(loanGuid)}/fieldReader`,
      params,
      data: fieldIds,
    });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0 && data.every((i) => i && typeof i === 'object')) {
      return data.map((item) => ({
        ...item,
        id: item.id ?? item.fieldId ?? item.FieldId,
        fieldId: item.fieldId ?? item.FieldId ?? item.id,
        value: item.value ?? item.Value ?? item.fieldValue ?? item.field_value ?? item.stringValue,
      }));
    }
    return data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass fieldReader request failed', {
      status,
      data,
      message: error.message,
    });
    const detail = data?.message || data?.error || error.message;
    throw new Error(`Encompass fieldReader ${status || 'error'}: ${detail}`);
  }
}

/**
 * GET /encompass/v1/loans/{loanGuid}/associates — loan team / milestone associate slots.
 * @param {string} loanGuid
 * @param {{ userId?: string, roleId?: string, fixedRoleId?: string }} [query]
 * @returns {Promise<unknown>} Raw Encompass JSON (usually an array of associate objects).
 */
export async function fetchLoanAssociates(loanGuid, query = {}) {
  if (!loanGuid) {
    throw new Error('loanGuid is required');
  }
  const params = {};
  if (query.userId != null && query.userId !== '') params.userId = query.userId;
  if (query.roleId != null && query.roleId !== '') params.roleId = query.roleId;
  if (query.fixedRoleId != null && query.fixedRoleId !== '') params.fixedRoleId = query.fixedRoleId;

  try {
    const response = await requestWithAuth({
      method: 'get',
      url: `${API_V1_BASE}/loans/${encodeURIComponent(loanGuid)}/associates`,
      params,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass fetchLoanAssociates failed', { status, data, message: error.message });
    const detail = data?.details || data?.message || data?.error || error.message;
    throw new Error(`Encompass loan associates GET ${status || 'error'}: ${detail}`);
  }
}

/**
 * PUT /encompass/v1/loans/{loanGuid}/associates/{logId} — assign user/group to a slot.
 * @param {string} loanGuid
 * @param {string} logId - Milestone / milestone-free role log id (from GET associates).
 * @param {object} body - e.g. { id: userEntityId } (camelCase; Id also sent for compatibility).
 */
export async function assignLoanAssociate(loanGuid, logId, body = {}) {
  if (!loanGuid) throw new Error('loanGuid is required');
  if (!logId) throw new Error('logId is required');

  const payload =
    body && typeof body === 'object'
      ? {
          ...body,
          Id: body.Id ?? body.id,
          id: body.id ?? body.Id,
        }
      : {};

  try {
    const response = await requestWithAuth({
      method: 'put',
      url: `${API_V1_BASE}/loans/${encodeURIComponent(loanGuid)}/associates/${encodeURIComponent(logId)}`,
      data: payload,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass assignLoanAssociate failed', { status, data, message: error.message });
    const detail = data?.details || data?.message || data?.error || error.message;
    throw new Error(`Encompass loan associate PUT ${status || 'error'}: ${detail}`);
  }
}

/**
 * DELETE /encompass/v1/loans/{loanGuid}/associates/{logId} — unassign slot.
 */
export async function unassignLoanAssociate(loanGuid, logId) {
  if (!loanGuid) throw new Error('loanGuid is required');
  if (!logId) throw new Error('logId is required');

  try {
    const response = await requestWithAuth({
      method: 'delete',
      url: `${API_V1_BASE}/loans/${encodeURIComponent(loanGuid)}/associates/${encodeURIComponent(logId)}`,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass unassignLoanAssociate failed', { status, data, message: error.message });
    const detail = data?.details || data?.message || data?.error || error.message;
    throw new Error(`Encompass loan associate DELETE ${status || 'error'}: ${detail}`);
  }
}

/**
 * POST /encompass/v1/loanBatch/updateRequests — batch update loans (by loanIds or filter + loanData).
 * @param {object} body - ICE request body
 * @returns {Promise<{ status: number, data: unknown }>}
 */
export async function postLoanBatchUpdateRequests(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  try {
    const response = await requestWithAuth({
      method: 'post',
      url: `${API_V1_BASE}/loanBatch/updateRequests`,
      data: body,
    });
    return { status: response.status, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Encompass loanBatch updateRequests failed', {
      status,
      summary: data?.summary,
      details: data?.details,
      errors: data?.errors,
      message: error.message,
    });
    const detail = data?.details || data?.message || data?.error || error.message;
    const err = new Error(`Encompass loanBatch ${status || 'error'}: ${detail}`);
    err.statusCode = status || 500;
    err.upstream = data;
    throw err;
  }
}

export {
  normalizePipelineItems,
  parseNumber,
  parseDate,
  coercePositiveInteger,
  normalizeUserProfile,
  filterUsersList,
  normalizeListParam,
  normalizeCounties,
  toUpper,
};

