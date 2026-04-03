const endpointSelect = document.getElementById('endpointSelect');
const testForm = document.getElementById('testForm');
const responseBody = document.getElementById('responseBody');
const responseMeta = document.getElementById('responseMeta');
const copyBtn = document.getElementById('copyBtn');
const quickButtons = document.getElementById('quickButtons');
const stateInput = document.getElementById('stateInput');
const countyInput = document.getElementById('countyInput');
const limitInput = document.getElementById('limitInput');
const loanGuidInput = document.getElementById('loanGuidInput');
const logIdInput = document.getElementById('logIdInput');
const requestBodyInput = document.getElementById('requestBodyInput');
const payloadPresetSelect = document.getElementById('payloadPresetSelect');

const endpoints = [
  { label: 'Status', value: '/api/encompass-hub/status', method: 'GET' },
  { label: 'Pipeline', value: '/api/encompass-hub/pipeline', method: 'GET', needsFilters: true },
  { label: 'Loan Details', value: '/api/encompass-hub/loans/{loanGuid}', method: 'GET', needsLoanGuid: true },
  {
    label: 'Field Reader',
    value: '/api/encompass-hub/loans/{loanGuid}/field-reader?invalidFieldBehavior=Include',
    method: 'POST',
    needsLoanGuid: true,
    needsBody: true
  },
  {
    label: 'Field Writer',
    value: '/api/encompass-hub/loans/{loanGuid}/field-writer',
    method: 'POST',
    needsLoanGuid: true,
    needsBody: true
  },
  { label: 'Loan associates (GET)', value: '/api/encompass-hub/loans/{loanGuid}/associates', method: 'GET', needsLoanGuid: true },
  {
    label: 'Loan associate assign (PUT)',
    value: '/api/encompass-hub/loans/{loanGuid}/associates/{logId}',
    method: 'PUT',
    needsLoanGuid: true,
    needsLogId: true,
    needsBody: true,
  },
  {
    label: 'Processor assignment run',
    value: '/api/encompass-hub/processor-assignment/run',
    method: 'POST',
    needsBody: true,
  },
  { label: 'Calculator Summary', value: '/api/encompass-hub/analytics/calc-summary', method: 'GET', needsFilters: true },
  { label: 'Ratio Analytics', value: '/api/encompass-hub/analytics/ratios', method: 'GET', needsFilters: true },
  { label: '3D Map Dataset', value: '/api/encompass-hub/visualizations/map3d', method: 'GET', needsFilters: true },
  { label: 'Stacked Cubes Dataset', value: '/api/encompass-hub/visualizations/stacked-cubes', method: 'GET', needsFilters: true },
  { label: 'Timeline Dataset', value: '/api/encompass-hub/visualizations/timeline', method: 'GET', needsFilters: true },
  { label: 'Native Fields', value: '/api/encompass-hub/native-fields', method: 'GET' },
  { label: 'Custom Fields', value: '/api/encompass-hub/custom-fields', method: 'GET' },
  {
    label: 'Loan batch update',
    value: '/api/encompass-hub/loan-batch/update-requests',
    method: 'POST',
    needsBody: true,
  },
  { label: 'Users Directory', value: '/api/encompass-hub/users', method: 'GET', hideInDropdown: true },
];

const payloadPresets = [
  {
    label: 'Field Reader – Sample IDs',
    value: JSON.stringify(
      ['1401', '4002', '4000#2', '1109', 'CUST02FV', 'LR.1500', 'BE0139x'],
      null,
      2
    ),
  },
  {
    label: 'Field Writer – Sample Set',
    value: JSON.stringify(
      [
        { id: '4002', value: 'Doe' },
        { id: '4000#2', value: 'John' },
      ],
      null,
      2
    ),
  },
  {
    label: 'Associate assign – user id body',
    value: JSON.stringify({ id: 'USER_ENTITY_ID' }, null, 2),
  },
  {
    label: 'Processor assignment – dry run (edit user IDs)',
    value: JSON.stringify(
      {
        dryRun: true,
        pipelineFilters: { limit: 20 },
        assignOnlyUnassigned: true,
        sortOrder: 'desc',
        processors: [
          { userId: 'USER_ENTITY_ID_1', displayName: 'Processor A', maxPoints: 40 },
          { userId: 'USER_ENTITY_ID_2', displayName: 'Processor B', maxPoints: 40 },
        ],
        complexityMode: 'rules',
        complexityRules: [
          { id: 'high_balance', points: 10, when: { field: 'Loan.LoanAmount', op: 'gte', value: 500000 } },
        ],
        roleConfig: { roleNameIncludes: 'processor' },
      },
      null,
      2
    ),
  },
];

function populateEndpoints() {
  const shown = endpoints.filter((e) => !e.hideInDropdown);
  shown.forEach((endpoint, index) => {
    const option = document.createElement('option');
    option.value = endpoint.value;
    option.textContent = `${endpoint.label} (${endpoint.method})`;
    if (index === 0) option.selected = true;
    endpointSelect.appendChild(option);
  });
}

function populateQuickButtons() {
  endpoints.slice(0, 6).forEach((endpoint) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm btn-outline-primary';
    button.textContent = endpoint.label;
    button.addEventListener('click', () => {
      endpointSelect.value = endpoint.value;
      runTest();
    });
    quickButtons.appendChild(button);
  });
}

function populatePayloadPresets() {
  if (!payloadPresetSelect) return;
  payloadPresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.value;
    option.textContent = preset.label;
    payloadPresetSelect.appendChild(option);
  });
}

function buildQueryParams() {
  const params = new URLSearchParams();
  if (stateInput.value.trim()) params.append('state', stateInput.value.trim());
  if (countyInput.value.trim()) params.append('counties', countyInput.value.trim());
  if (limitInput.value.trim()) params.append('limit', limitInput.value.trim());
  return params;
}

function resolveEndpointPath(endpoint) {
  let path = endpoint.value;
  if (endpoint.needsLoanGuid) {
    const loanGuid = loanGuidInput.value.trim();
    if (!loanGuid) {
      throw new Error('Loan GUID is required for this endpoint.');
    }
    path = path.replace('{loanGuid}', encodeURIComponent(loanGuid));
  }
  if (endpoint.needsLogId) {
    const logId = logIdInput?.value?.trim();
    if (!logId) {
      throw new Error('Associate log ID is required for this endpoint.');
    }
    path = path.replace('{logId}', encodeURIComponent(logId));
  }
  return path;
}

async function runTest(event) {
  if (event) event.preventDefault();

  const selected = endpoints.find((endpoint) => endpoint.value === endpointSelect.value);
  if (!selected) return;

  let url = resolveEndpointPath(selected);
  if (selected.needsFilters) {
    const params = buildQueryParams();
    const query = params.toString();
    if (query) {
      url = `${url}?${query}`;
    }
  }

  responseMeta.textContent = `Requesting ${selected.label}...`;
  responseBody.textContent = 'Loading...';

  try {
    const requestOptions = { method: selected.method || 'GET' };
    if (selected.method && selected.method !== 'GET') {
      const body = requestBodyInput?.value?.trim();
      if (selected.needsBody && !body) {
        throw new Error('Request body is required for this endpoint.');
      }
      requestOptions.headers = { 'Content-Type': 'application/json' };
      requestOptions.body = body || null;
    }

    const response = await (window.encompassApi?.encompassFetch || fetch)(url, requestOptions);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let payload = text;

    if (contentType.includes('application/json')) {
      payload = JSON.stringify(JSON.parse(text), null, 2);
    }

    responseBody.textContent = payload;
    responseMeta.textContent = `${selected.method} ${url} · ${response.status}`;
  } catch (error) {
    responseBody.textContent = error.message;
    responseMeta.textContent = 'Request failed';
  }
}

async function copyResponse() {
  try {
    await navigator.clipboard.writeText(responseBody.textContent);
    copyBtn.textContent = 'Copied';
    setTimeout(() => {
      copyBtn.innerHTML = '<i class="bi-clipboard"></i> Copy JSON';
    }, 1500);
  } catch (error) {
    responseMeta.textContent = 'Clipboard not available';
  }
}

populateEndpoints();
populateQuickButtons();
populatePayloadPresets();
testForm.addEventListener('submit', runTest);
copyBtn.addEventListener('click', copyResponse);

payloadPresetSelect?.addEventListener('change', () => {
  if (!requestBodyInput) return;
  requestBodyInput.value = payloadPresetSelect.value;
});
