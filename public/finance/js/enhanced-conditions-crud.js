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

  if (!tabs || !form) return;

  let tab = 'types';
  let rows = [];
  let selected = null;

  function encompassFetch(url, options) {
    return (window.encompassApi?.encompassFetch || fetch)(url, options);
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
    return data.items || data.results || data.types || data.templates || data.conditions || data.personas || data.sets || [];
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
        field('loanId', 'Loan GUID', sessionStorage.getItem('ecLoanId') || '', 'required') +
        field('id', 'Condition id', row.id) +
        field('title', 'Title', row.title) +
        field('conditionTypeId', 'Condition type id', row.conditionType?.id || row.conditionType || '') +
        field('status', 'Status', row.status);
    } else if (tab === 'sets') {
      form.innerHTML = field('id', 'Set id', row.id) + field('title', 'Title', row.title || row.name);
    } else {
      form.innerHTML =
        field('id', 'Persona id', row.id) +
        field('name', 'Name', row.name || row.entityName);
    }
  }

  function columns() {
    if (tab === 'types') return ['id', 'title', 'active'];
    if (tab === 'templates') return ['id', 'title', 'internalId', 'conditionType'];
    if (tab === 'loan') return ['id', 'title', 'status'];
    if (tab === 'sets') return ['id', 'title', 'name'];
    return ['id', 'name', 'entityName'];
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
        const selectedClass = selected && (selected.id === row.id) ? ' is-selected' : '';
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
    if (tab === 'personas') return '/personas';
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
        await request(`${listPath()}?action=add&view=entity`, {
          method: 'PATCH',
          body: JSON.stringify([{ title: val('title'), conditionType: { id: val('conditionTypeId') } }]),
        });
      } else {
        setStatus('Create is only for types, templates, and loan conditions.', 'err');
        return;
      }
      toast('Created', 'success');
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

  tabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.getAttribute('data-tab');
    tabs.querySelectorAll('.nav-link').forEach((el) => el.classList.toggle('active', el === btn));
    selected = null;
    rows = [];
    renderTable();
    renderForm();
    setStatus(`${tab} ready. Refresh to load from Encompass.`);
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

  renderForm();
  renderTable();
})();
