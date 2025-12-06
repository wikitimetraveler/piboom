const statusChip = document.getElementById('statusChip');
const refreshStatusBtn = document.getElementById('refreshStatusBtn');
const pipelineForm = document.getElementById('pipelineForm');
const pipelineTableBody = document.getElementById('pipelineResultsBody');
const activeFilters = document.getElementById('activeFilters');
const resultMeta = document.getElementById('resultMeta');
const loanDetailsBody = document.getElementById('loanDetailsBody');
const loanGuidDisplay = document.getElementById('loanGuidDisplay');

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

let currentLoans = [];

function setStatusChip(text, status = 'warn', icon = 'bi-clock-history') {
  if (!statusChip) return;
  statusChip.className = `status-chip ${status}`;
  statusChip.innerHTML = `<i class="bi ${icon}"></i>${text}`;
}

async function refreshStatus() {
  try {
    setStatusChip('Checking...', 'warn', 'bi-clock-history');
    const response = await fetch('/api/encompass-hub/status');
    if (!response.ok) {
      throw new Error(`Status request failed (${response.status})`);
    }
    const data = await response.json();
    if (data.connected) {
      const remaining = data.secondsRemaining
        ? `${Math.floor(data.secondsRemaining / 60)}m ${data.secondsRemaining % 60}s`
        : 'unknown';
      setStatusChip(`Connected · ${remaining}`, 'ok', 'bi-check-circle');
    } else if (data.reason === 'missing-env') {
      setStatusChip('Missing credentials', 'err', 'bi-exclamation-octagon');
    } else {
      setStatusChip('Auth error', 'err', 'bi-shield-exclamation');
    }
  } catch (error) {
    console.error('Failed to refresh status', error);
    setStatusChip('Status unavailable', 'err', 'bi-slash-circle');
  }
}

function buildQueryParams(formData) {
  const params = new URLSearchParams();
  const state = formData.get('state');
  const counties = formData.get('counties');
  const limit = formData.get('limit');
  const loanFolder = formData.get('loanFolder');
  const loanType = formData.get('loanType');

  if (state) params.append('state', state.trim());
  if (counties) params.append('counties', counties);
  if (limit) params.append('limit', limit);
  if (loanFolder) params.append('loanFolder', loanFolder);
  if (loanType) params.append('loanType', loanType);
  return params;
}

function updateFilterBadges(filters) {
  const chips = [];
  if (filters.get('state')) {
    chips.push(`<span>State: ${filters.get('state').toUpperCase()}</span>`);
  }
  if (filters.get('counties')) {
    chips.push(`<span>Counties: ${filters.get('counties')}</span>`);
  }
  if (filters.get('loanFolder')) {
    chips.push(`<span>Folder: ${filters.get('loanFolder')}</span>`);
  }
  if (filters.get('loanType')) {
    chips.push(`<span>Doc: ${filters.get('loanType')}</span>`);
  }
  activeFilters.innerHTML = chips.join(' ') || '<small class="text-muted">No filters</small>';
}

function renderPipelineRows(loans) {
  if (!loans.length) {
    pipelineTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          No loans returned for the current filter set.
        </td>
      </tr>
    `;
    resultMeta.textContent = 'No results';
    return;
  }

  const rows = loans
    .map((loan) => {
      const loanNumber = loan?.fields?.['Loan.LoanNumber'] || '—';
      const borrower = loan?.fields?.['Loan.BorrowerName'] || '—';
      const county = loan?.fields?.['Fields.15'] || '—';
      const state = loan?.fields?.['Fields.14'] || '—';
      const amount = loan?.fields?.['Loan.LoanAmount']
        ? currencyFormatter.format(loan.fields['Loan.LoanAmount'])
        : '—';
      const docType = loan?.fields?.['Fields.4000'] || '—';

      return `
        <tr data-guid="${loan.loanGuid || ''}">
          <td>${loanNumber}</td>
          <td>${borrower}</td>
          <td>${county}</td>
          <td>${state}</td>
          <td>${amount}</td>
          <td>${docType}</td>
        </tr>
      `;
    })
    .join('');

  pipelineTableBody.innerHTML = rows;
  resultMeta.textContent = `${loans.length} loans`;
}

async function loadPipeline(event) {
  event.preventDefault();
  loanDetailsBody.innerHTML = 'Select a loan to load the full record.';

  const formData = new FormData(pipelineForm);
  formData.set('state', document.getElementById('stateFilter').value);
  formData.set('counties', document.getElementById('countyFilter').value);
  formData.set('loanFolder', document.getElementById('loanFolderFilter').value);
  formData.set('loanType', document.getElementById('loanTypeFilter').value);
  formData.set('limit', document.getElementById('limitFilter').value);

  const filters = buildQueryParams(formData);
  updateFilterBadges(filters);

  pipelineTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-2">Requesting pipeline data...</div>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(`/api/encompass-hub/pipeline?${filters.toString()}`);
    if (!response.ok) {
      throw new Error(`Pipeline request failed (${response.status})`);
    }

    const data = await response.json();
    currentLoans = data.items || [];
    renderPipelineRows(currentLoans);
  } catch (error) {
    console.error('Unable to load pipeline data', error);
    pipelineTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          Failed to load pipeline data. ${error.message}
        </td>
      </tr>
    `;
    resultMeta.textContent = 'Error loading data';
  }
}

function renderLoanDetails(loan) {
  if (!loan) {
    loanDetailsBody.innerHTML = '<div class="empty-state">Loan details unavailable.</div>';
    return;
  }

  const borrowerPair = loan?.borrowerPairs?.[0];
  const borrowerName = borrowerPair
    ? `${borrowerPair.borrower?.firstName || ''} ${borrowerPair.borrower?.lastName || ''}`.trim()
    : loan?.borrowerName || 'Not provided';

  const property = loan?.property || loan?.subjectProperty || {};
  const propertyAddress = [
    property.addressLineText,
    property.cityName,
    property.stateCode,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  const milestones = (loan?.milestones || []).slice(0, 4);
  const milestoneList = milestones.length
    ? milestones
        .map(
          (m) => `
        <li>
          <strong>${m.milestoneName || m.name}</strong>
          <span class="text-muted">(${m.completedDate ? new Date(m.completedDate).toLocaleDateString() : 'Pending'})</span>
        </li>`,
        )
        .join('')
    : '<li class="text-muted">No milestone data available</li>';

  loanDetailsBody.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <h6 class="text-uppercase text-muted">Borrower</h6>
        <p class="mb-1">${borrowerName}</p>
        <p class="text-muted mb-3">Loan Officer: ${loan?.loanOfficer?.name || 'Not assigned'}</p>
      </div>
      <div class="col-md-6">
        <h6 class="text-uppercase text-muted">Property</h6>
        <p class="mb-1">${propertyAddress || 'Address not populated'}</p>
        <p class="text-muted mb-3">Type: ${loan?.property?.propertyType || 'N/A'}</p>
      </div>
    </div>
    <div class="row">
      <div class="col-md-4">
        <div class="card bg-light border-0 mb-3">
          <div class="card-body">
            <p class="text-muted mb-1">Loan Amount</p>
            <h5>${loan?.loanAmount ? currencyFormatter.format(loan.loanAmount) : '—'}</h5>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-light border-0 mb-3">
          <div class="card-body">
            <p class="text-muted mb-1">Program</p>
            <h5>${loan?.loanProgramName || loan?.channel || '—'}</h5>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-light border-0 mb-3">
          <div class="card-body">
            <p class="text-muted mb-1">Folder</p>
            <h5>${loan?.loanFolder || '—'}</h5>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <h6 class="text-uppercase text-muted">Milestones</h6>
        <ul class="pl-3">${milestoneList}</ul>
      </div>
      <div class="col-md-6">
        <h6 class="text-uppercase text-muted">Raw Snapshot</h6>
        <pre class="bg-dark text-white p-3 rounded" style="max-height: 220px; overflow: auto;">${JSON.stringify(
          {
            loanNumber: loan.loanNumber,
            loanGuid: loan.loanGuid,
            milestones: milestones.slice(0, 2),
            loanOfficer: loan.loanOfficer,
          },
          null,
          2,
        )}</pre>
      </div>
    </div>
  `;
}

async function handleLoanSelection(loanGuid) {
  if (!loanGuid) return;
  loanGuidDisplay.textContent = loanGuid;
  loanDetailsBody.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="mt-2">Loading loan details...</div>
    </div>
  `;

  try {
    const response = await fetch(`/api/encompass-hub/loans/${loanGuid}`);
    if (!response.ok) {
      throw new Error(`Loan fetch failed (${response.status})`);
    }
    const loan = await response.json();
    renderLoanDetails(loan);
  } catch (error) {
    console.error('Unable to load loan details', error);
    loanDetailsBody.innerHTML = `
      <div class="empty-state text-danger">
        Unable to load loan details. ${error.message}
      </div>
    `;
  }
}

pipelineTableBody.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-guid]');
  if (!row) return;

  pipelineTableBody.querySelectorAll('tr').forEach((tr) => tr.classList.remove('selected'));
  row.classList.add('selected');

  const loanGuid = row.getAttribute('data-guid');
  handleLoanSelection(loanGuid);
});

refreshStatusBtn?.addEventListener('click', refreshStatus);
pipelineForm?.addEventListener('submit', loadPipeline);

refreshStatus();

