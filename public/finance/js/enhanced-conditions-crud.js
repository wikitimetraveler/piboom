/**
 * Development work by David Lane
 * Form-based CRUD UI for Encompass Enhanced Conditions.
 */
(function () {
  'use strict';

  const tabs = document.getElementById('ecTabs');
  const table = document.getElementById('ecTable');
  const thead = table?.querySelector('thead');
  const tbody = table?.querySelector('tbody');
  const form = document.getElementById('ecForm');
  const statusEl = document.getElementById('ecStatus');
  const countEl = document.getElementById('ecCount');
  const confirmEl = document.getElementById('ecConfirm');
  const confirmLabel = document.querySelector('label[for="ecConfirm"]');

  if (!tabs || !form) return;

  const LOAN_FIELDS = [
    ['title', 'Title'],
    ['conditionType', 'Condition type (title)'],
    ['category', 'Category'],
    ['priorTo', 'Prior to'],
    ['source', 'Source'],
    ['recipient', 'Recipient'],
    ['internalDescription', 'Internal description'],
    ['externalDescription', 'External description'],
  ];

  let tab = 'types';
  let rows = [];
  let selected = null;
  let templates = null;

  function encompassFetch(url, options) {
    return (window.encompassApi?.encompassFetch || fetch)(url, options);
  }

  function envLabel() {
    return window.encompassApi?.getEncompassEnv?.() === 'retail' ? 'Retail' : 'Correspondent';
  }

  function syncConfirmLabel() {
    if (confirmLabel) {
      confirmLabel.textContent = `I understand this writes to the live ${envLabel()} Encompass instance.`;
    }
  }

  function typeTitle(value) {
    if (value && typeof value === 'object') return value.title || value.name || value.id || '';
    return value || '';
  }

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function asList(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    return data.items || data.results || data.types || data.templates || data.conditions || data.roles || data.sets || [];
  }

  function rowKey(row) {
    return row ? row.id ?? row.roleID ?? null : null;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = `small ${kind === 'err' ? 'text-danger' : kind === 'ok' ? 'text-success' : 'text-muted'}`;
  }

  function field(name, label, value, extra = '') {
    return `<div class="col-md-6"><label class="form-label small fw-semibold" for="ec-${name}">${escapeHtml(label)}</label><input class="form-control form-control-sm" id="ec-${name}" name="${escapeHtml(name)}" value="${escapeHtml(value || '')}" ${extra} /></div>`;
  }

  function val(name) {
    return form.querySelector(`[name="${name}"]`)?.value?.trim() || '';
  }

  function requireWrite() {
    if (!confirmEl.checked) {
      setStatus('Check the write confirmation box before Create / Update / Delete.', 'err');
      toast('Confirm live writes first', 'warning');
      return false;
    }
    return true;
  }

  function splitTitles(raw) {
    return String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title }));
  }

  function renderForm() {
    const row = selected || {};
    if (tab === 'types') {
      form.innerHTML =
        field('id', 'Type id', row.id) +
        field('title', 'Title', row.title) +
        field('active', 'Active (true/false)', row.active == null ? '' : String(row.active)) +
        field('categories', 'Categories (comma)', (row.definitions?.categoryDefinitions || []).map((d) => d.title).join(', ')) +
        field('recipients', 'Recipients (comma)', (row.definitions?.recipientDefinitions || []).map((d) => d.title).join(', ')) +
        field('sources', 'Sources (comma)', (row.definitions?.sourceDefinitions || []).map((d) => d.title).join(', ')) +
        field('priorTo', 'Prior to (comma)', (row.definitions?.priorToDefinitions || []).map((d) => d.title).join(', ')) +
        field('tracking', 'Tracking (comma)', (row.definitions?.trackingDefinitions || []).map((d) => d.title).join(', '));
    } else if (tab === 'templates') {
      const typeTitle = typeof row.conditionType === 'object' ? row.conditionType?.title || row.conditionType?.id : row.conditionType;
      form.innerHTML =
        field('id', 'Template id', row.id) +
        field('title', 'Title', row.title) +
        field('conditionType', 'Condition type title', typeTitle) +
        field('internalId', 'Internal id', row.internalId) +
        field('internalDescription', 'Internal description', row.internalDescription) +
        field('category', 'Category', row.category) +
        field('source', 'Source', row.source) +
        field('priorTo', 'Prior to', row.priorTo) +
        field('recipient', 'Recipient', row.recipient);
    } else if (tab === 'loan') {
      form.innerHTML =
        envNotice() +
        field('loanId', 'Loan GUID', sessionStorage.getItem('ecLoanId') || '', 'required') +
        templatePicker() +
        field('id', 'Condition id (update / remove)', row.id) +
        LOAN_FIELDS.map(([name, label]) =>
          field(name, label, name === 'conditionType' ? typeTitle(row.conditionType) : row[name]),
        ).join('') +
        field('status', 'Status', row.status);
    } else if (tab === 'sets') {
      form.innerHTML = field('id', 'Set id', row.id) + field('title', 'Title', row.title || row.name);
    } else {
      form.innerHTML =
        field('roleID', 'Role id', row.roleID == null ? '' : String(row.roleID), 'readonly') +
        field('roleName', 'Role name', row.roleName, 'readonly') +
        field('roleAbbr', 'Abbreviation', row.roleAbbr, 'readonly');
    }
  }

  function envNotice() {
    const env = envLabel();
    const retail = env === 'Retail';
    return `<div class="col-12"><div class="alert alert-${retail ? 'warning' : 'info'} py-2 small mb-1">`
      + `<i class="bi bi-bank"></i> Loan conditions go to the <strong>${env}</strong> instance`
      + (retail ? ' — switch Env to Correspondent to work in CL first.' : ' (CL).')
      + '</div></div>';
  }

  function templatePicker() {
    const list = templates || [];
    const placeholder = templates == null
      ? 'Loading templates…'
      : list.length ? '— choose a template to prefill —' : 'No templates found in this instance';
    const options = list
      .map((t, i) => `<option value="${i}">${escapeHtml(t.internalId ? `${t.internalId} — ${t.title}` : t.title)}</option>`)
      .join('');
    return '<div class="col-12"><label class="form-label small fw-semibold" for="ec-templatePick">Add from template</label>'
      + `<select class="form-select form-select-sm" id="ec-templatePick" name="templatePick"><option value="">${placeholder}</option>${options}</select></div>`;
  }

  async function loadTemplates() {
    if (templates) return;
    try {
      templates = asList(await request('/templates'));
    } catch (error) {
      templates = [];
      setStatus(`Could not load templates: ${error.message}`, 'err');
    }
  }

  function applyTemplate(template) {
    for (const [name] of LOAN_FIELDS) {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) continue;
      input.value = name === 'conditionType' ? typeTitle(template.conditionType) : template[name] || '';
    }
    const idInput = form.querySelector('[name="id"]');
    if (idInput) idInput.value = '';
  }

  function columns() {
    if (tab === 'types') return ['id', 'title', 'active'];
    if (tab === 'templates') return ['id', 'title', 'internalId', 'conditionType'];
    if (tab === 'loan') return ['id', 'title', 'status'];
    if (tab === 'sets') return ['id', 'title', 'name'];
    return ['roleID', 'roleName', 'roleAbbr'];
  }

  function cell(row, key) {
    const value = row[key];
    if (key === 'conditionType' && value && typeof value === 'object') return value.title || value.id || '';
    if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 80);
    return value == null ? '' : String(value);
  }

  function renderTable() {
    const cols = columns();
    thead.innerHTML = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}" class="text-muted text-center py-4">No rows. Refresh against the active Encompass env.</td></tr>`;
      countEl.textContent = '';
      return;
    }
    tbody.innerHTML = rows
      .slice(0, 250)
      .map((row, index) => {
        const selectedClass = selected && rowKey(selected) != null && rowKey(selected) === rowKey(row) ? ' is-selected' : '';
        return `<tr class="${selectedClass}" data-index="${index}">${cols.map((c) => `<td>${escapeHtml(cell(row, c).slice(0, 80))}</td>`).join('')}</tr>`;
      })
      .join('');
    countEl.textContent = `${Math.min(rows.length, 250)} of ${rows.length}`;
  }

  async function request(path, options = {}) {
    const res = await encompassFetch(`/api/encompass-conditions${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.details || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  function listPath() {
    if (tab === 'types') return '/types';
    if (tab === 'templates') return '/templates';
    if (tab === 'sets') return '/sets';
    if (tab === 'roles') return '/roles';
    const loanId = val('loanId') || sessionStorage.getItem('ecLoanId') || '';
    if (!loanId) throw new Error('Enter a loan GUID first');
    sessionStorage.setItem('ecLoanId', loanId);
    return `/loans/${encodeURIComponent(loanId)}/conditions`;
  }

  async function refresh() {
    setStatus('Loading…');
    try {
      if (tab === 'loan') renderForm();
      const data = await request(listPath());
      rows = asList(data);
      selected = null;
      renderTable();
      renderForm();
      setStatus(`Loaded ${rows.length} ${tab}.`, 'ok');
    } catch (error) {
      rows = [];
      renderTable();
      setStatus(error.message, 'err');
      toast(error.message, 'error');
    }
  }

  function typePayload(includeId) {
    const payload = {
      title: val('title'),
      definitions: {
        categoryDefinitions: splitTitles(val('categories')),
        recipientDefinitions: splitTitles(val('recipients')),
        sourceDefinitions: splitTitles(val('sources')),
        priorToDefinitions: splitTitles(val('priorTo')),
        trackingDefinitions: splitTitles(val('tracking')),
      },
    };
    if (includeId && val('id')) payload.id = val('id');
    if (val('active') !== '') payload.active = val('active') === 'true';
    return [payload];
  }

  function templatePayload(includeId) {
    const payload = {
      title: val('title'),
      conditionType: val('conditionType'),
      internalId: val('internalId'),
      internalDescription: val('internalDescription'),
      category: val('category'),
      source: val('source'),
      priorTo: val('priorTo'),
      recipient: val('recipient'),
      printDefinitions: ['InternalPrint'],
    };
    if (includeId && val('id')) payload.id = val('id');
    return [payload];
  }

  async function create() {
    if (!requireWrite()) return;
    try {
      if (tab === 'types') {
        await request('/types?action=add&view=entity', { method: 'PATCH', body: JSON.stringify(typePayload(false)) });
      } else if (tab === 'templates') {
        await request('/templates?action=add&view=entity', { method: 'PATCH', body: JSON.stringify(templatePayload(false)) });
      } else if (tab === 'loan') {
        if (!val('title') || !val('conditionType')) {
          setStatus('A loan condition needs a title and a condition type — pick a template to prefill them.', 'err');
          return;
        }
        const payload = {};
        for (const [name] of LOAN_FIELDS) if (val(name)) payload[name] = val(name);
        await request(`${listPath()}?action=add&view=entity`, {
          method: 'PATCH',
          body: JSON.stringify([payload]),
        });
      } else {
        setStatus('Create is only for types, templates, and loan conditions.', 'err');
        return;
      }
      toast(tab === 'loan' ? `Condition added to loan (${envLabel()})` : 'Created', 'success');
      await refresh();
    } catch (error) {
      setStatus(error.message, 'err');
      toast(error.message, 'error');
    }
  }

  async function update() {
    if (!requireWrite()) return;
    try {
      if (tab === 'types') {
        await request('/types?action=update&view=entity', { method: 'PATCH', body: JSON.stringify(typePayload(true)) });
      } else if (tab === 'templates') {
        await request('/templates?action=update&view=entity', { method: 'PATCH', body: JSON.stringify(templatePayload(true)) });
      } else if (tab === 'loan') {
        await request(`${listPath()}?action=update&view=entity`, {
          method: 'PATCH',
          body: JSON.stringify([{ id: val('id'), status: val('status'), title: val('title') }]),
        });
      } else {
        setStatus('Update is only for types, templates, and loan conditions.', 'err');
        return;
      }
      toast('Updated', 'success');
      await refresh();
    } catch (error) {
      setStatus(error.message, 'err');
      toast(error.message, 'error');
    }
  }

  async function remove() {
    if (!requireWrite()) return;
    if (!val('id')) {
      setStatus('Select a row or enter an id to delete.', 'err');
      return;
    }
    if (!window.confirm('Delete this Enhanced Conditions record in Encompass?')) return;
    try {
      if (tab === 'types') {
        await request('/types?action=delete&templateOption=delete&view=entity', {
          method: 'PATCH',
          body: JSON.stringify([{ id: val('id') }]),
        });
      } else if (tab === 'loan') {
        await request(`${listPath()}?action=remove&view=entity`, {
          method: 'PATCH',
          body: JSON.stringify([{ id: val('id') }]),
        });
      } else {
        setStatus('Delete is only for types and loan conditions.', 'err');
        return;
      }
      toast('Deleted', 'success');
      await refresh();
    } catch (error) {
      setStatus(error.message, 'err');
      toast(error.message, 'error');
    }
  }

  tabs.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.getAttribute('data-tab');
    tabs.querySelectorAll('.nav-link').forEach((el) => el.classList.toggle('active', el === btn));
    selected = null;
    rows = [];
    renderTable();
    renderForm();
    setStatus(`${tab} ready. Refresh to load from Encompass.`);
    if (tab === 'loan' && !templates) {
      await loadTemplates();
      if (tab === 'loan') renderForm();
    }
  });

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'templatePick' || event.target.value === '') return;
    const template = templates?.[Number(event.target.value)];
    if (template) applyTemplate(template);
  });

  window.addEventListener('encompassEnvChanged', () => {
    templates = null;
    rows = [];
    selected = null;
    syncConfirmLabel();
    renderTable();
    renderForm();
    setStatus(`Env switched to ${envLabel()}. Refresh to load from that instance.`);
    if (tab === 'loan') loadTemplates().then(() => tab === 'loan' && renderForm());
  });

  tbody.addEventListener('click', (event) => {
    const tr = event.target.closest('tr[data-index]');
    if (!tr) return;
    selected = rows[Number(tr.getAttribute('data-index'))] || null;
    renderTable();
    renderForm();
  });

  document.getElementById('ecRefresh')?.addEventListener('click', refresh);
  document.getElementById('ecCreate')?.addEventListener('click', create);
  document.getElementById('ecUpdate')?.addEventListener('click', update);
  document.getElementById('ecDelete')?.addEventListener('click', remove);

  syncConfirmLabel();
  renderForm();
  renderTable();
})();
