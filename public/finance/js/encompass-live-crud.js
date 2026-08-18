/**
 * Development work by David Lane
 * Shared live ICE CRUD console — catalog-driven list/get/create/update/delete UI.
 */
(function (global) {
  'use strict';

  const DOMAINS = {
    conditions: {
      catalogUrl: '/api/encompass-conditions/catalog',
      invokeUrl: '/api/encompass-conditions/invoke',
      title: 'Live Enhanced Conditions APIs',
      lead: 'CRUD against condition types, templates, sets, personas, and loan conditions. Condition Manager conversion remains a dry-run; this console writes to Encompass.',
    },
  };

  function encompassFetch(url, options) {
    return (global.encompassApi?.encompassFetch || fetch)(url, options);
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
    return data.items || data.results || data.types || data.templates || data.conditions || data.personas || [];
  }

  function guessId(row) {
    if (!row || typeof row !== 'object') return '';
    return (
      row.id ||
      row.entityId ||
      row.orgId ||
      row.userId ||
      row.tpoId ||
      row.templateId ||
      row.conditionId ||
      row.feeId ||
      row.tradeId ||
      ''
    );
  }

  function previewValue(value) {
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function tableColumns(rows) {
    const keys = ['id', 'entityId', 'entityName', 'name', 'title', 'internalId', 'status', 'email', 'orgId'];
    const present = keys.filter((key) => rows.some((row) => row && row[key] != null && row[key] !== ''));
    if (present.length) return present.slice(0, 6);
    const first = rows.find((row) => row && typeof row === 'object');
    return first ? Object.keys(first).slice(0, 5) : ['id'];
  }

  function showToast(message, type) {
    if (typeof global.showToast === 'function') {
      global.showToast(message, type);
      return;
    }
    console[type === 'error' ? 'error' : 'log'](message);
  }

  function mount(el, domainKey) {
    const config = DOMAINS[domainKey];
    if (!el || !config) return;

    el.classList.add('live-crud');
    el.innerHTML = `
      <div>
        <h2>${escapeHtml(config.title)}</h2>
        <p class="live-crud-lead mb-0">${escapeHtml(config.lead)}</p>
      </div>
      <div class="live-crud-warn mt-3">
        Non-GET calls write to Encompass. Confirm the env (Correspondent vs Retail) before Create / Update / Delete.
      </div>
      <div class="live-crud-toolbar">
        <div style="min-width:12rem;flex:1;">
          <label for="${el.id}-group">Resource</label>
          <select class="form-select form-select-sm" id="${el.id}-group"></select>
        </div>
        <div style="min-width:16rem;flex:2;">
          <label for="${el.id}-op">Operation</label>
          <select class="form-select form-select-sm" id="${el.id}-op"></select>
        </div>
        <button class="btn btn-sm btn-primary" type="button" data-run>Run</button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-sample>Load sample body</button>
      </div>
      <p class="live-crud-path mb-3" data-path></p>
      <div class="live-crud-grid" data-params></div>
      <div class="mb-2" data-query></div>
      <div class="mb-2" data-body-wrap>
        <label class="form-label small fw-semibold" for="${el.id}-body">Request body (JSON)</label>
        <textarea class="form-control" id="${el.id}-body" spellcheck="false"></textarea>
      </div>
      <div class="form-check mb-3" data-confirm-wrap hidden>
        <input class="form-check-input" type="checkbox" id="${el.id}-confirm" />
        <label class="form-check-label small" for="${el.id}-confirm">I understand this writes to the live Encompass instance.</label>
      </div>
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
        <span class="live-crud-status" data-status>Load a catalog, then run List to browse records.</span>
        <span class="small text-muted" data-count></span>
      </div>
      <div class="live-crud-table-wrap mb-3" data-table-wrap hidden>
        <table class="table table-sm mb-0">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
      <pre class="live-crud-result" data-result>{}</pre>
    `;

    if (global.encompassApi?.injectEnvSwitcher) {
      global.encompassApi.injectEnvSwitcher();
    }

    const groupSel = el.querySelector(`#${el.id}-group`);
    const opSel = el.querySelector(`#${el.id}-op`);
    const pathEl = el.querySelector('[data-path]');
    const paramsEl = el.querySelector('[data-params]');
    const queryEl = el.querySelector('[data-query]');
    const bodyWrap = el.querySelector('[data-body-wrap]');
    const bodyEl = el.querySelector(`#${el.id}-body`);
    const confirmWrap = el.querySelector('[data-confirm-wrap]');
    const confirmEl = el.querySelector(`#${el.id}-confirm`);
    const statusEl = el.querySelector('[data-status]');
    const countEl = el.querySelector('[data-count]');
    const tableWrap = el.querySelector('[data-table-wrap]');
    const thead = tableWrap.querySelector('thead');
    const tbody = tableWrap.querySelector('tbody');
    const resultEl = el.querySelector('[data-result]');

    let operations = [];
    let selectedRow = null;

    function setStatus(text, kind) {
      statusEl.textContent = text;
      statusEl.className = `live-crud-status${kind ? ` ${kind}` : ''}`;
    }

    function currentOps() {
      const group = groupSel.value;
      return operations.filter((op) => op.group === group);
    }

    function currentOp() {
      return operations.find((op) => op.id === opSel.value) || currentOps()[0] || null;
    }

    function renderGroups() {
      const groups = [...new Set(operations.map((op) => op.group))];
      groupSel.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      renderOps();
    }

    function renderOps() {
      const ops = currentOps();
      opSel.innerHTML = ops
        .map(
          (op) =>
            `<option value="${escapeHtml(op.id)}">${escapeHtml(op.method)} · ${escapeHtml(op.name)}</option>`
        )
        .join('');
      renderOpDetail();
    }

    function renderOpDetail() {
      const op = currentOp();
      if (!op) return;
      pathEl.innerHTML = `<span class="live-crud-method ${escapeHtml(op.method.toLowerCase())}">${escapeHtml(op.method)}</span> <code>${escapeHtml(op.path)}</code>`;
      paramsEl.innerHTML = (op.pathParams || [])
        .map(
          (name) =>
            `<div><label for="${el.id}-p-${escapeHtml(name)}">${escapeHtml(name)}</label><input class="form-control form-control-sm" id="${el.id}-p-${escapeHtml(name)}" data-param="${escapeHtml(name)}" autocomplete="off" /></div>`
        )
        .join('');
      if (op.queryKeys?.length) {
        queryEl.innerHTML =
          '<div class="live-crud-grid">' +
          op.queryKeys
            .map((name) => {
              const preset = op.defaultQuery?.[name] || '';
              return `<div><label for="${el.id}-q-${escapeHtml(name)}">${escapeHtml(name)}</label><input class="form-control form-control-sm" id="${el.id}-q-${escapeHtml(name)}" data-query-key="${escapeHtml(name)}" value="${escapeHtml(preset)}" autocomplete="off" /></div>`;
            })
            .join('') +
          '</div>';
      } else {
        queryEl.innerHTML = '';
      }
      const needsBody = op.method !== 'GET';
      bodyWrap.hidden = !needsBody;
      confirmWrap.hidden = !op.destructive;
      confirmEl.checked = false;
      if (needsBody && op.sampleBody != null && !bodyEl.value.trim()) {
        bodyEl.value = JSON.stringify(op.sampleBody, null, 2);
      }
    }

    function collectPathParams() {
      const params = {};
      paramsEl.querySelectorAll('[data-param]').forEach((input) => {
        params[input.getAttribute('data-param')] = input.value.trim();
      });
      return params;
    }

    function collectQuery() {
      const query = {};
      queryEl.querySelectorAll('[data-query-key]').forEach((input) => {
        if (input.value.trim()) query[input.getAttribute('data-query-key')] = input.value.trim();
      });
      return query;
    }

    function parseBody(op) {
      if (op.method === 'GET') return undefined;
      const raw = bodyEl.value.trim();
      if (!raw) return undefined;
      return JSON.parse(raw);
    }

    function renderTable(data) {
      const rows = asList(data).filter((row) => row && typeof row === 'object');
      if (!rows.length) {
        tableWrap.hidden = true;
        countEl.textContent = '';
        return;
      }
      const cols = tableColumns(rows);
      thead.innerHTML = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
      tbody.innerHTML = rows
        .slice(0, 200)
        .map((row, index) => {
          const cells = cols.map((c) => `<td>${escapeHtml(previewValue(row[c]).slice(0, 80))}</td>`).join('');
          return `<tr data-index="${index}">${cells}</tr>`;
        })
        .join('');
      tableWrap.hidden = false;
      countEl.textContent = `${Math.min(rows.length, 200)} of ${rows.length} rows`;
      tbody.querySelectorAll('tr').forEach((tr) => {
        tr.addEventListener('click', () => {
          tbody.querySelectorAll('tr').forEach((row) => row.classList.remove('is-selected'));
          tr.classList.add('is-selected');
          selectedRow = rows[Number(tr.getAttribute('data-index'))];
          fillParamsFromRow(selectedRow);
        });
      });
    }

    function fillParamsFromRow(row) {
      const op = currentOp();
      const id = guessId(row);
      if (!op || !id) return;
      (op.pathParams || []).forEach((name) => {
        const input = paramsEl.querySelector(`[data-param="${name}"]`);
        if (!input) return;
        if (row[name] != null) input.value = String(row[name]);
        else if (op.idParam === name || /id$/i.test(name)) input.value = String(id);
      });
    }

    async function loadCatalog() {
      setStatus('Loading catalog…');
      const res = await encompassFetch(config.catalogUrl);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || payload.details || `Catalog failed (${res.status})`);
      operations = payload.operations || [];
      renderGroups();
      setStatus(`${operations.length} operations ready.`);
    }

    async function run() {
      const op = currentOp();
      if (!op) return;
      if (op.destructive && !confirmEl.checked) {
        setStatus('Check the write confirmation box before Create / Update / Delete.', 'err');
        showToast('Confirm live writes first', 'warning');
        return;
      }
      let body;
      try {
        body = parseBody(op);
      } catch (error) {
        setStatus(`Invalid JSON body: ${error.message}`, 'err');
        return;
      }
      setStatus(`Running ${op.method} ${op.name}…`);
      try {
        const res = await encompassFetch(config.invokeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operationId: op.id,
            pathParams: collectPathParams(),
            query: collectQuery(),
            body,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        resultEl.textContent = JSON.stringify(payload.data ?? payload, null, 2);
        if (!res.ok || payload.ok === false) {
          setStatus(`HTTP ${payload.status || res.status} — ${payload.details || payload.error || op.name}`, 'err');
          showToast(payload.details || payload.error || 'Request failed', 'error');
          tableWrap.hidden = true;
          return;
        }
        setStatus(`HTTP ${payload.status || res.status} · ${op.icePath || op.path}`, 'ok');
        renderTable(payload.data);
        showToast(`${op.name} succeeded`, 'success');
      } catch (error) {
        setStatus(error.message || 'Request failed', 'err');
        showToast(error.message || 'Request failed', 'error');
      }
    }

    groupSel.addEventListener('change', renderOps);
    opSel.addEventListener('change', renderOpDetail);
    el.querySelector('[data-run]').addEventListener('click', run);
    el.querySelector('[data-sample]').addEventListener('click', () => {
      const op = currentOp();
      if (!op) return;
      bodyEl.value = op.sampleBody == null ? '' : JSON.stringify(op.sampleBody, null, 2);
    });

    loadCatalog().catch((error) => {
      setStatus(error.message || 'Unable to load catalog. Check Encompass credentials and login.', 'err');
    });

    el.selectOperation = function selectOperation(operationId) {
      const op = operations.find((item) => item.id === operationId);
      if (!op) return;
      groupSel.value = op.group;
      renderOps();
      opSel.value = op.id;
      renderOpDetail();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function boot() {
    document.querySelectorAll('[data-live-crud]').forEach((el) => {
      if (!el.id) el.id = `liveCrud${Math.random().toString(36).slice(2, 8)}`;
      mount(el, el.getAttribute('data-live-crud'));
    });
  }

  global.EncompassLiveCrud = { mount, DOMAINS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
