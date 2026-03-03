const filtersForm = document.getElementById('userFilters');
const searchInput = document.getElementById('userSearch');
const personaInput = document.getElementById('personaId');
const limitInput = document.getElementById('userLimit');
const statusRadios = document.querySelectorAll('input[name="statusFilter"]');
const tableBody = document.querySelector('#usersTable tbody');
const errorAlert = document.getElementById('usersError');
const metaCount = document.getElementById('usersMeta');
const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statDisabled = document.getElementById('statDisabled');

filtersForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  loadUsers();
});

document.getElementById('resetFilters')?.addEventListener('click', (event) => {
  event.preventDefault();
  filtersForm?.reset();
  document.getElementById('statusAll').checked = true;
  loadUsers();
});

loadUsers();

async function loadUsers() {
  setLoading(true);
  hideError();

  const query = buildQuery();

  try {
    const payload = await fetchJSON(`/api/encompass-hub/users${query}`);
    const users = payload?.items || [];
    renderUsers(users);
    updateStats(users);
    metaCount.textContent = `${payload?.count ?? users.length} users`;
  } catch (error) {
    renderUsers([]);
    showError(error.message || 'Unable to fetch Encompass users.');
  } finally {
    setLoading(false);
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = searchInput?.value?.trim();
  const personaId = personaInput?.value?.trim();
  const limit = limitInput?.value;
  const status = getStatusFilter();

  if (search) params.append('search', search);
  if (personaId) params.append('personaId', personaId);
  if (limit) params.append('limit', limit);
  if (status === 'active') params.append('enabled', 'true');
  if (status === 'disabled') params.append('enabled', 'false');

  const query = params.toString();
  return query ? `?${query}` : '';
}

function getStatusFilter() {
  const activeRadio = Array.from(statusRadios).find((radio) => radio.checked);
  return activeRadio?.value || 'all';
}

async function fetchJSON(url) {
  const response = await (window.encompassApi?.encompassFetch || fetch)(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function renderUsers(users = []) {
  if (!tableBody) return;

  if (!users.length) {
    tableBody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted py-4">No users found for current filters.</td></tr>';
    return;
  }

  const rows = users.map((user) => {
    const personas =
      formatList(user.personaNames) || (user.personaIds?.length ? user.personaIds.join(', ') : '—');
    const folders = formatList(user.workingFolders);
    const org = user.organization?.name || '—';
    const lastLogin = formatDate(user.lastLogin) || '—';
    const email = user.email || '—';
    const login = user.loginName || '—';

    return `
      <tr>
        <td>
          <div class="font-weight-semibold">${user.name || 'Unknown'}</div>
          <small class="text-muted d-block">ID: ${user.userId || user.id || '—'}</small>
          <small class="text-muted">${user.title || '—'}</small>
        </td>
        <td>${login}</td>
        <td>${email}</td>
        <td>${personas}</td>
        <td>${folders}</td>
        <td>${org}</td>
        <td>${renderStatus(user)}</td>
        <td>${lastLogin}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = rows.join('');
}

function renderStatus(user) {
  const badges = [];
  if (user.enabled) {
    badges.push('<span class="badge badge-success">Active</span>');
  } else {
    badges.push('<span class="badge badge-secondary">Disabled</span>');
  }
  if (Array.isArray(user.indicators) && user.indicators.includes('Locked')) {
    badges.push('<span class="badge badge-warning">Locked</span>');
  }
  const accessParts = [];
  if (user.access?.subordinate) accessParts.push(`Sub: ${user.access.subordinate}`);
  if (user.access?.peer) accessParts.push(`Peer: ${user.access.peer}`);
  if (user.personalStatusOnline) {
    badges.push('<span class="badge badge-info">Online</span>');
  }
  if (accessParts.length) {
    badges.push(`<div class="text-muted small">${accessParts.join(' | ')}</div>`);
  }
  return badges.join('<br/>');
}

function updateStats(users = []) {
  const total = users.length;
  const active = users.filter((u) => u.enabled).length;
  const disabled = total - active;

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = active;
  if (statDisabled) statDisabled.textContent = disabled;
}

function formatList(list) {
  if (!Array.isArray(list) || !list.length) {
    return '—';
  }
  return list.join(', ');
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function setLoading(isLoading) {
  if (!tableBody || !isLoading) return;
  tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-muted py-4">
        <div class="spinner-border text-primary spinner-border-sm mr-2" role="status"></div>
        Loading users...
      </td>
    </tr>
  `;
}

function showError(message) {
  if (!errorAlert) return;
  errorAlert.textContent = message;
  errorAlert.style.display = 'block';
}

function hideError() {
  if (!errorAlert) return;
  errorAlert.style.display = 'none';
  errorAlert.textContent = '';
}

