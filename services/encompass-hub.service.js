import axios from 'axios';
import { ensureEncompassToken } from './encompass-auth.service.js';
import {
  buildLoanAnalytics,
} from './loan-analytics.service.js';

const API_BASE_URL = process.env.ENCOMPASS_API_BASE || 'https://api.elliemae.com/encompass/v1';
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

function normalizePipelineItems(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.pipelineData)) {
    return payload.pipelineData;
  }

  return [];
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
    housingRatio: parseNumber(getValue('Loan.HousingRatio')),
    totalDTI: parseNumber(getValue('Loan.TotalDTI') ?? getValue('Loan.DebtRatio')),
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

  const token = await ensureEncompassToken();
  const terms = [...BASE_TERMS];
  const parsedLimit = Number(limit) > 0 ? Number(limit) : DEFAULT_LIMIT;

  if (loanFolder && loanFolder !== 'My Pipeline') {
    terms[0] = {
      canonicalName: 'Loan.LoanFolder',
      value: loanFolder,
      matchType: 'exact',
    };
  }

  const resolvedLoanProgram = loanProgram || loanType || null;
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

  const response = await axios.post(
    `${API_BASE_URL}/loanPipeline`,
    {
      filter: {
        terms,
      },
      fields: PIPELINE_FIELDS,
      sortOrder: [
        { canonicalName: 'Loan.LoanNumber', order: 'desc' },
        { canonicalName: 'Fields.4000', order: 'desc' },
      ],
    },
    {
      params: {
        cursortype: 'randomAccess',
        limit: parsedLimit,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const items = normalizePipelineItems(response.data).map(enrichLoanRecord);
  const filteredItems = applyAdvancedFilters(items, {
    state: toUpper(state),
    counties: normalizeCounties(counties),
    loanFolder,
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

  const token = await ensureEncompassToken();
  const response = await axios.get(`${API_BASE_URL}/loans/${loanGuid}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

