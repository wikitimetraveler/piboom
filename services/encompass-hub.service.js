import axios from 'axios';
import { ensureEncompassToken } from './encompass-auth.service.js';

const API_BASE_URL = process.env.ENCOMPASS_API_BASE || 'https://api.elliemae.com/encompass/v1';

const DEFAULT_FIELDS = [
  'Loan.LoanNumber',
  'Loan.LoanAmount',
  'Loan.BorrowerName',
  'Fields.4000',
  'Fields.11',
  'Fields.12',
  'Fields.13',
  'Fields.14',
  'Fields.15',
];

const BASE_TERMS = [
  {
    canonicalName: 'Loan.LoanFolder',
    value: 'My Pipeline',
    matchType: 'exact',
  },
  {
    canonicalName: 'Fields.1172',
    value: 'Conventional',
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

function filterByLocation(items, { state, counties }) {
  let filtered = items;

  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = filtered.filter((item) => {
      const itemState = item?.fields?.['Fields.14'];
      return itemState ? itemState.toUpperCase() === stateUpper : false;
    });
  }

  if (counties?.length) {
    const countySet = new Set(counties.map((c) => c.trim().toLowerCase()));
    filtered = filtered.filter((item) => {
      const county = item?.fields?.['Fields.15'];
      return county ? countySet.has(county.trim().toLowerCase()) : false;
    });
  }

  return filtered;
}

export async function fetchPipelineLoans(options = {}) {
  const {
    state,
    counties,
    limit = 25,
    loanFolder = 'Pipeline',
    loanType,
  } = options;

  const token = await ensureEncompassToken();
  const terms = [...BASE_TERMS];

  if (loanFolder && loanFolder !== 'Pipeline') {
    terms[0] = {
      canonicalName: 'Loan.LoanFolder',
      value: loanFolder,
      matchType: 'exact',
    };
  }

  if (loanType) {
    terms.push({
      canonicalName: 'Fields.1172',
      value: loanType,
      matchType: 'exact',
    });
  }

  const response = await axios.post(
    `${API_BASE_URL}/loanPipeline`,
    {
      filter: {
        terms,
      },
      fields: DEFAULT_FIELDS,
      sortOrder: [
        { canonicalName: 'Loan.LoanNumber', order: 'desc' },
        { canonicalName: 'Fields.4000', order: 'desc' },
      ],
    },
    {
      params: {
        cursortype: 'randomAccess',
        limit,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const items = normalizePipelineItems(response.data);
  const filteredItems = filterByLocation(items, {
    state,
    counties: Array.isArray(counties)
      ? counties
      : typeof counties === 'string'
        ? counties.split(',').map((c) => c.trim()).filter(Boolean)
        : [],
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

