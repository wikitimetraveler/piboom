const statusChip = document.getElementById('statusChip');
const refreshStatusBtn = document.getElementById('refreshStatusBtn');
const pipelineForm = document.getElementById('pipelineForm');
const pipelineTableBody = document.getElementById('pipelineResultsBody');
const activeFilters = document.getElementById('activeFilters');
const resultMeta = document.getElementById('resultMeta');
const loanDetailsBody = document.getElementById('loanDetailsBody');
const loanGuidDisplay = document.getElementById('loanGuidDisplay');
const stateInput = document.getElementById('stateFilter');
const countyInput = document.getElementById('countyFilter');
const loanFolderSelect = document.getElementById('loanFolderFilter');
const loanTypeSelect = document.getElementById('loanTypeFilter');
const limitInput = document.getElementById('limitFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const loadPipelineCta = document.getElementById('loadPipelineCta');
const voiceHelpPanel = document.getElementById('voiceHelp');
const voiceHelpToggle = document.getElementById('toggleVoiceHelp');
const voiceHelpClose = document.getElementById('closeVoiceHelp');
const userInfoShell = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

let currentLoans = [];
let selectedPipelineLoan = null;
let voiceWidgetInstance = null;

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return currencyFormatter.format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(1)}%`;
}

function renderActorList(pipelineLoan) {
  const actors = pipelineLoan?.normalized?.actors;
  if (!actors) {
    return '<li class="text-muted">Loan team data not available</li>';
  }
  const roles = [
    { key: 'loanOfficer', label: 'Loan Officer' },
    { key: 'processor', label: 'Processor' },
    { key: 'underwriter', label: 'Underwriter' },
    { key: 'closer', label: 'Closer' },
  ];
  const items = roles.map((role) => {
    const actor = actors[role.key];
    const name = actor?.name || 'Unassigned';
    return `<li><strong>${role.label}:</strong> ${name}</li>`;
  });

  return items.join('');
}

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
  if (event) {
    event.preventDefault();
  }
  loanDetailsBody.innerHTML = 'Select a loan to load the full record.';
  selectedPipelineLoan = null;

  const formData = new FormData(pipelineForm);
  formData.set('state', stateInput.value);
  formData.set('counties', countyInput.value);
  formData.set('loanFolder', loanFolderSelect.value);
  formData.set('loanType', loanTypeSelect.value);
  formData.set('limit', limitInput.value);

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

function renderLoanDetails(loan, pipelineLoan) {
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

  const pipelineMetrics = pipelineLoan?.normalized?.metrics || {};
  const metricsMarkup = `
    <div class="d-flex flex-wrap gap-3">
      <div>
        <small class="text-muted text-uppercase">Housing Ratio</small>
        <div class="h5 mb-0">${formatPercent(pipelineMetrics.housingRatio)}</div>
      </div>
      <div>
        <small class="text-muted text-uppercase">Total DTI</small>
        <div class="h5 mb-0">${formatPercent(pipelineMetrics.totalDTI)}</div>
      </div>
      <div>
        <small class="text-muted text-uppercase">Funds Required</small>
        <div class="h5 mb-0">${formatCurrency(pipelineMetrics.fundsRequired)}</div>
      </div>
    </div>
  `;

  const actorList = renderActorList(pipelineLoan);

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
        <h6 class="text-uppercase text-muted">Pipeline Metrics</h6>
        ${pipelineLoan ? metricsMarkup : '<p class="text-muted mb-3">No pipeline metrics captured for this loan.</p>'}
      </div>
      <div class="col-md-6">
        <h6 class="text-uppercase text-muted">Loan Team</h6>
        <ul class="pl-3 mb-3">${actorList}</ul>
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
    renderLoanDetails(loan, selectedPipelineLoan);
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
  selectedPipelineLoan = currentLoans.find((loan) => (loan.loanGuid || loan.guid) === loanGuid) || null;
  handleLoanSelection(loanGuid);
});

refreshStatusBtn?.addEventListener('click', refreshStatus);
pipelineForm?.addEventListener('submit', loadPipeline);
clearFiltersBtn?.addEventListener('click', () => clearFilters(true));
loadPipelineCta?.addEventListener('click', (e) => {
  e.preventDefault();
  loadPipeline();
});

voiceHelpToggle?.addEventListener('click', () => toggleVoiceHelp(true));
voiceHelpClose?.addEventListener('click', () => toggleVoiceHelp(false));

hydrateUserBadge();
initializeVoiceWidget();
refreshStatus();

function hydrateUserBadge() {
  if (!userInfoShell || typeof isLoggedIn !== 'function' || typeof getLoggedInUser !== 'function') return;
  if (!isLoggedIn()) return;
  const user = getLoggedInUser();
  if (!user) return;
  userInfoShell.style.display = 'block';
  userAvatar.src = user.avatar;
  userAvatar.style.borderColor = user.color;
  userName.textContent = user.name;
}

function clearFilters(notify = false) {
  stateInput.value = '';
  countyInput.value = '';
  loanFolderSelect.value = 'My Pipeline';
  loanTypeSelect.value = '';
  limitInput.value = '25';
  activeFilters.innerHTML = '<small class="text-muted">No filters</small>';
  if (notify) {
    speak('Filters cleared');
  }
}

function toggleVoiceHelp(forceShow) {
  if (!voiceHelpPanel) return;
  const show = typeof forceShow === 'boolean' ? forceShow : !voiceHelpPanel.classList.contains('show');
  voiceHelpPanel.classList.toggle('show', show);
}

function initializeVoiceWidget() {
  if (typeof initVoiceWidget !== 'function') return;
  voiceWidgetInstance = initVoiceWidget({
    position: 'bottom-right',
    theme: 'blue',
    onCommand: handleVoiceCommand,
  });
}

function handleVoiceCommand(rawCommand = '') {
  const command = rawCommand.toLowerCase().trim();
  console.log('Voice command:', command);

  if (!command) return;

  if (command.includes('refresh status')) {
    speak('Refreshing Encompass status');
    refreshStatus();
    return;
  }

  if (command.includes('load pipeline') || command.includes('run pipeline') || command.includes('fetch loans')) {
    speak('Loading pipeline');
    loadPipeline();
    return;
  }

  if (command.includes('clear filters') || command.includes('reset filters')) {
    clearFilters(true);
    return;
  }

  if (command.includes('show commands') || command.includes('voice help')) {
    toggleVoiceHelp(true);
    speak('Showing voice commands');
    return;
  }

  if (command.includes('hide commands') || command.includes('close help')) {
    toggleVoiceHelp(false);
    speak('Closing voice help');
    return;
  }

  const stateMatch = command.match(/state(?: to)? ([a-z]+)/);
  if (stateMatch) {
    const stateValue = stateMatch[1].slice(0, 2).toUpperCase();
    stateInput.value = stateValue;
    speak(`State set to ${stateValue}`);
    return;
  }

  const countyMatch = command.match(/count(?:y|ies)(?: to)? (.+)/);
  if (countyMatch) {
    const countyValue = countyMatch[1]
      .replace(/\band\b/gi, ',')
      .replace(/[^a-z,\s]/gi, '')
      .trim();
    countyInput.value = countyValue;
    speak('Counties updated');
    return;
  }

  const limitMatch = command.match(/limit(?: to)? (\d{1,3})/);
  if (limitMatch) {
    const limitValue = Math.min(100, Math.max(1, Number(limitMatch[1])));
    limitInput.value = String(limitValue);
    speak(`Limit set to ${limitValue}`);
    return;
  }

  const selectMatch = command.match(/select (?:loan )?(first|second|third|fourth|fifth|\d+)/);
  if (selectMatch) {
    const ordinal = selectMatch[1];
    const map = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    const index = map[ordinal] || Number(ordinal);
    if (Number.isFinite(index)) {
      selectLoanByIndex(index);
    } else {
      speak('Please specify a valid loan number');
    }
    return;
  }

  speak('Command not recognized for Encompass Hub');
}

function selectLoanByIndex(index) {
  if (!currentLoans.length) {
    speak('No pipeline data loaded yet');
    return;
  }
  const normalized = index - 1;
  if (normalized < 0 || normalized >= currentLoans.length) {
    speak('That loan number is outside the result set');
    return;
  }
  const loan = currentLoans[normalized];
  if (!loan?.loanGuid) {
    speak('Unable to locate that loan');
    return;
  }
  const rows = pipelineTableBody.querySelectorAll('tr[data-guid]');
  rows.forEach((row) => row.classList.remove('selected'));
  const targetRow = Array.from(rows).find((row) => row.dataset.guid === loan.loanGuid);
  if (targetRow) {
    targetRow.classList.add('selected');
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  speak(`Opening loan ${index}`);
  handleLoanSelection(loan.loanGuid);
}

function speak(text) {
  if (typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(text, 'en-US-Standard-D', { speakingRate: 0.95 })
      .then((success) => {
        if (!success) {
          speakWithBrowser(text);
        }
      })
      .catch(() => speakWithBrowser(text));
    return;
  }

  speakWithBrowser(text);
}

function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
