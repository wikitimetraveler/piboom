/**
 * Processor assignment tool — config in localStorage + PostgreSQL, calls /api/encompass-hub/processor-assignment/run
 */
(function () {
  'use strict';

  const LS_PROCESSORS = 'processorAssignment_processorsJson';
  const LS_RULES = 'processorAssignment_rulesJson';
  const LS_ROLE = 'processorAssignment_roleConfigJson';
  const LS_PIPELINE = 'processorAssignment_pipelineLimit';
  const LS_DELAY_MS = 'processorAssignment_delayMs';
  const LS_COMPLEXITY_MODE = 'processorAssignment_complexityMode';
  const LS_AI_MODEL = 'processorAssignment_complexityAiModel';
  const LS_COMPLEXITY_MAX = 'processorAssignment_complexityMaxPoints';

  const DEFAULT_PROCESSORS = `[
  { "userId": "YOUR_ENCOMPASS_USER_ENTITY_ID", "displayName": "Processor A", "maxPoints": 40 },
  { "userId": "YOUR_ENCOMPASS_USER_ENTITY_ID_2", "displayName": "Processor B", "maxPoints": 40 }
]`;

  const DEFAULT_RULES = `[
  { "id": "high_balance", "points": 10, "when": { "field": "Loan.LoanAmount", "op": "gte", "value": 500000 } },
  { "id": "high_dti", "points": 8, "when": { "field": "Loan.TotalDTI", "op": "gte", "value": 45 } },
  { "id": "fha_va", "points": 5, "when": { "field": "Fields.4000", "op": "in", "values": ["FHA", "VA"] } },
  { "id": "low_fico", "points": 7, "when": { "field": "Loan.BorrowerScore", "op": "lt", "value": 640 } },
  { "id": "nonstandard_property", "points": 4, "when": { "field": "Loan.PropertyType", "op": "in", "values": ["Condominium", "Co-Operative", "Manufactured Housing", "Mixed Use Residential"] } },
  { "id": "investor_assigned", "points": 3, "when": { "field": "Loan.InvestorName", "op": "isnotempty" } },
  { "id": "self_employed_cx_placeholder", "points": 6, "when": { "field": "Fields.CX.BORROWER.SELF.EMPLOYED", "op": "in", "values": ["Y", "Yes", "true", "TRUE"] } },
  { "id": "uw_condition_count_cx_placeholder", "points": 1, "when": { "field": "Fields.CX.UW.CONDITION.COUNT", "op": "gte", "value": 5 } },
  { "id": "income_type_bankstmt_cx_placeholder", "points": 5, "when": { "field": "Fields.CX.BORROWER.INCOME.TYPE", "op": "contains", "value": "Bank" } },
  { "id": "investor_program_cx_placeholder", "points": 3, "when": { "field": "Fields.CX.INVESTOR.PROGRAM", "op": "isnotempty" } }
]`;

  const DEFAULT_ROLE = `{
  "roleNameIncludes": "processor"
}`;

  function $(id) {
    return document.getElementById(id);
  }

  function getFetch() {
    return window.encompassApi?.encompassFetch || fetch;
  }

  function buildConfigPayloadForSave() {
    return {
      processorsJson: $('processorsJson').value,
      rulesJson: $('rulesJson').value,
      roleConfigJson: $('roleConfigJson').value,
      pipelineLimit: $('pipelineLimit').value,
      delayMs: $('delayMs').value,
      complexityMode: $('complexityMode').value,
      complexityAiModel: $('complexityAiModel').value.trim(),
      complexityMaxPoints: $('complexityMaxPoints').value.trim(),
    };
  }

  function applyConfigFromObject(c) {
    if (!c || typeof c !== 'object') return;
    if (typeof c.processorsJson === 'string') $('processorsJson').value = c.processorsJson;
    if (typeof c.rulesJson === 'string') $('rulesJson').value = c.rulesJson;
    if (typeof c.roleConfigJson === 'string') $('roleConfigJson').value = c.roleConfigJson;
    if (c.pipelineLimit != null && `${c.pipelineLimit}`.trim() !== '') $('pipelineLimit').value = `${c.pipelineLimit}`;
    if (c.delayMs != null && `${c.delayMs}`.trim() !== '') $('delayMs').value = `${c.delayMs}`;
    if (typeof c.complexityMode === 'string' && ['rules', 'ai', 'both'].includes(c.complexityMode)) {
      $('complexityMode').value = c.complexityMode;
    }
    if (typeof c.complexityAiModel === 'string') $('complexityAiModel').value = c.complexityAiModel;
    if (c.complexityMaxPoints != null && `${c.complexityMaxPoints}`.trim() !== '') {
      $('complexityMaxPoints').value = `${c.complexityMaxPoints}`;
    }
  }

  async function loadFromDatabase() {
    const st = $('paConfigDbStatus');
    try {
      const res = await getFetch()('/api/encompass-hub/processor-assignment/config');
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text || res.statusText);
      }
      if (!res.ok) throw new Error(json.details || json.error || res.statusText);
      const c = json.config;
      if (c && typeof c === 'object' && Object.keys(c).length > 0) {
        applyConfigFromObject(c);
        saveStorage();
      }
      if (json.updatedAt) {
        st.textContent = `Database: last saved ${json.updatedAt} (${json.encompassEnv}).`;
      } else {
        st.textContent = `Database: no saved config for ${json.encompassEnv} yet — Save config will create one.`;
      }
    } catch (e) {
      st.textContent = `Database: ${e.message} (using browser storage only).`;
    }
  }

  async function saveToDatabase() {
    const res = await getFetch()('/api/encompass-hub/processor-assignment/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfigPayloadForSave()),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(text || res.statusText);
    }
    if (!res.ok) throw new Error(json.details || json.error || res.statusText);
    const st = $('paConfigDbStatus');
    if (json.updatedAt) {
      st.textContent = `Database: saved ${json.updatedAt} (${json.encompassEnv}).`;
    }
  }

  function loadStorage() {
    try {
      const p = localStorage.getItem(LS_PROCESSORS);
      const r = localStorage.getItem(LS_RULES);
      const rc = localStorage.getItem(LS_ROLE);
      const lim = localStorage.getItem(LS_PIPELINE);
      const dms = localStorage.getItem(LS_DELAY_MS);
      if (p) $('processorsJson').value = p;
      else $('processorsJson').value = DEFAULT_PROCESSORS;
      if (r) $('rulesJson').value = r;
      else $('rulesJson').value = DEFAULT_RULES;
      if (rc) $('roleConfigJson').value = rc;
      else $('roleConfigJson').value = DEFAULT_ROLE;
      if (lim) $('pipelineLimit').value = lim;
      if (dms) $('delayMs').value = dms;
      const cm = localStorage.getItem(LS_COMPLEXITY_MODE);
      if (cm && ['rules', 'ai', 'both'].includes(cm)) $('complexityMode').value = cm;
      const am = localStorage.getItem(LS_AI_MODEL);
      if (am) $('complexityAiModel').value = am;
      const cmax = localStorage.getItem(LS_COMPLEXITY_MAX);
      if (cmax != null) $('complexityMaxPoints').value = cmax;
    } catch (e) {
      console.warn(e);
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem(LS_PROCESSORS, $('processorsJson').value);
      localStorage.setItem(LS_RULES, $('rulesJson').value);
      localStorage.setItem(LS_ROLE, $('roleConfigJson').value);
      localStorage.setItem(LS_PIPELINE, $('pipelineLimit').value);
      localStorage.setItem(LS_DELAY_MS, $('delayMs').value);
      localStorage.setItem(LS_COMPLEXITY_MODE, $('complexityMode').value);
      localStorage.setItem(LS_AI_MODEL, $('complexityAiModel').value.trim());
      localStorage.setItem(LS_COMPLEXITY_MAX, $('complexityMaxPoints').value.trim());
    } catch (e) {
      console.warn(e);
    }
  }

  function parseJson(text, label) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`${label} must be valid JSON: ${e.message}`);
    }
  }

  function isPlaceholderProcessor(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const id = `${entry.userId ?? ''}`.trim();
    if (!id) return true;
    return /YOUR_ENCOMPASS|PLACEHOLDER/i.test(id);
  }

  function parseProcessorsArray() {
    const arr = parseJson($('processorsJson').value, 'Processors');
    if (!Array.isArray(arr)) throw new Error('Processors must be a JSON array');
    return arr;
  }

  function setProcessorsArray(arr) {
    $('processorsJson').value = JSON.stringify(arr, null, 2);
    saveStorage();
  }

  /**
   * @param {{ userId: string, displayName?: string }} user
   */
  function addProcessorFromPick(user) {
    const uid = `${user.userId ?? ''}`.trim();
    if (!uid) {
      alert('User has no userId from Encompass.');
      return;
    }
    const maxPoints = Math.max(0, parseInt($('paAddMaxPoints').value, 10) || 0);
    const mode = $('paAddMode').value;
    const displayName = (user.displayName && `${user.displayName}`.trim()) || uid;

    let list;
    try {
      list = parseProcessorsArray();
    } catch (e) {
      alert(e.message);
      return;
    }

    const entry = { userId: uid, displayName, maxPoints };

    if (mode === 'replace_placeholder') {
      const idx = list.findIndex((p) => isPlaceholderProcessor(p));
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        const existing = list.findIndex((p) => `${p.userId}` === uid);
        if (existing >= 0) list[existing] = entry;
        else list.push(entry);
      }
      setProcessorsArray(list);
      return;
    }

    if (mode === 'replace_userid') {
      const needle = $('paReplaceUserId').value.trim();
      if (!needle) {
        alert('Enter the userId to replace (e.g. test.processor).');
        return;
      }
      const idx = list.findIndex((p) => `${p.userId}` === needle);
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }
      setProcessorsArray(list);
      return;
    }

    const existing = list.findIndex((p) => `${p.userId}` === uid);
    if (existing >= 0) {
      list[existing] = { ...list[existing], ...entry };
    } else {
      list.push(entry);
    }
    setProcessorsArray(list);
  }

  function bindAddModeVisibility() {
    const sel = $('paAddMode');
    const row = $('paReplaceUserIdRow');
    if (!sel || !row) return;
    const sync = () => {
      row.classList.toggle('d-none', sel.value !== 'replace_userid');
    };
    sel.addEventListener('change', sync);
    sync();
  }

  async function searchUsersForPicker() {
    const tbody = $('paUserPickBody');
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center text-muted py-3">Loading…</td></tr>';
    const limit = Math.min(200, Math.max(1, parseInt($('paUserLimit').value, 10) || 40));
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const q = $('paUserSearch').value.trim();
    if (q) params.set('search', q);
    try {
      const res = await getFetch()(`/api/encompass-hub/users?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      const users = json.items || [];
      tbody.innerHTML = '';
      if (!users.length) {
        tbody.innerHTML =
          '<tr><td colspan="3" class="text-center text-muted py-3">No users match.</td></tr>';
        return;
      }
      users.forEach((u) => {
        const uid = u.userId || u.id || '';
        const tr = document.createElement('tr');
        const nameTd = document.createElement('td');
        nameTd.textContent = u.name || '—';
        const idTd = document.createElement('td');
        const code = document.createElement('code');
        code.className = 'small';
        code.textContent = uid || '—';
        idTd.appendChild(code);
        const actTd = document.createElement('td');
        actTd.className = 'text-end';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm btn-outline-success';
        b.textContent = 'Add';
        b.disabled = !uid;
        b.addEventListener('click', () =>
          addProcessorFromPick({ userId: uid, displayName: u.name || uid }),
        );
        actTd.appendChild(b);
        tr.appendChild(nameTd);
        tr.appendChild(idTd);
        tr.appendChild(actTd);
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-danger small py-3">${escapeHtml(e.message)}</td></tr>`;
    }
  }

  function buildPipelineFilters() {
    const limit = Math.min(100, Math.max(1, parseInt($('pipelineLimit').value, 10) || 50));
    return { limit };
  }

  function renderResults(data) {
    const tbody = $('resultsBody');
    const meta = $('resultsMeta');
    tbody.innerHTML = '';
    if (!data || !Array.isArray(data.results)) {
      meta.textContent = 'No results.';
      return;
    }
    const mode = data.complexityMode ?? 'rules';
    const upBasis = data.usedPointsBasis ?? 'rules';
    meta.textContent = `Mode: ${mode} | used-points basis: ${upBasis} | dry run: ${data.dryRun} | proposed: ${data.summary?.proposed ?? 0} assigned: ${data.summary?.assigned ?? 0} skipped: ${data.summary?.skipped ?? 0} errors: ${data.summary?.errors ?? 0}`;
    data.results.forEach((row) => {
      const tr = document.createElement('tr');
      const hits = (row.ruleHits || [])
        .map((h) => (h.ruleId ? `${h.ruleId}(+${h.points})` : `+${h.points}`))
        .join(', ');
      tr.innerHTML = `
        <td>${escapeHtml(row.loanNumber ?? '')}</td>
        <td>${escapeHtml(row.borrowerName ?? '')}</td>
        <td>${escapeHtml(row.loanGuid ?? '')}</td>
        <td class="text-end">${row.score ?? ''}</td>
        <td class="text-end text-muted">${row.rulesScore != null ? row.rulesScore : '—'}</td>
        <td class="text-end text-muted">${row.aiPoints != null ? row.aiPoints : '—'}</td>
        <td class="small text-muted">${escapeHtml(row.aiRationale ?? '')}</td>
        <td class="small" title="${escapeAttr(hits)}">${escapeHtml(hits || '—')}</td>
        <td>${escapeHtml(row.processorUserId ?? '')}</td>
        <td><span class="badge bg-${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td class="small text-muted">${escapeHtml(row.reason ?? '')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function statusClass(s) {
    if (s === 'assigned' || s === 'proposed') return 'success';
    if (s === 'skipped') return 'warning';
    if (s === 'error') return 'danger';
    return 'secondary';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  async function runAssignment(dryRun) {
    const statusEl = $('runStatus');
    statusEl.textContent = 'Running…';
    saveStorage();

    let processors;
    let complexityRules;
    let roleConfig;
    try {
      processors = parseJson($('processorsJson').value, 'Processors');
      complexityRules = parseJson($('rulesJson').value, 'Complexity rules');
      roleConfig = parseJson($('roleConfigJson').value, 'Role config');
    } catch (e) {
      statusEl.textContent = e.message;
      return;
    }

    const body = {
      dryRun,
      pipelineFilters: buildPipelineFilters(),
      processors,
      complexityRules,
      roleConfig,
      assignOnlyUnassigned: $('assignOnlyUnassigned').checked,
      sortOrder: $('sortDesc').checked ? 'desc' : 'asc',
      delayMsBetweenAssign: Math.max(0, parseInt($('delayMs').value, 10) || 0),
    };
    const maxPts = $('complexityMaxPoints').value.trim();
    if (maxPts !== '') {
      const n = Number(maxPts);
      if (Number.isFinite(n)) body.complexityMaxPoints = n;
    }
    body.complexityMode = $('complexityMode').value || 'rules';
    const aim = $('complexityAiModel').value.trim();
    if (aim) body.complexityAiModel = aim;

    try {
      const res = await getFetch()('/api/encompass-hub/processor-assignment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text || res.statusText);
      }
      if (!res.ok) {
        throw new Error(json.details || json.error || res.statusText);
      }
      renderResults(json);
      statusEl.textContent = dryRun ? 'Dry run complete.' : 'Apply complete.';
    } catch (e) {
      statusEl.textContent = 'Error: ' + e.message;
    }
  }

  function addSimpleRule() {
    const field = $('simpleField').value.trim();
    const op = $('simpleOp').value;
    const points = Number($('simplePoints').value);
    const valRaw = $('simpleValue').value.trim();
    if (!field || !Number.isFinite(points)) {
      alert('Field and numeric points are required.');
      return;
    }
    let when;
    if (op === 'between') {
      const parts = valRaw.split(',').map((s) => s.trim());
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        alert('For between, use min,max (two numbers).');
        return;
      }
      when = { field, op: 'between', min, max };
    } else if (op === 'in') {
      const values = valRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (!values.length) {
        alert('For in, use comma-separated values.');
        return;
      }
      when = { field, op: 'in', values };
    } else if (op === 'isempty' || op === 'isnotempty') {
      when = { field, op };
    } else {
      const num = Number(valRaw);
      const value = Number.isFinite(num) && valRaw !== '' && !Number.isNaN(num) ? num : valRaw;
      when = { field, op, value };
    }
    let rules;
    try {
      rules = parseJson($('rulesJson').value, 'Rules');
      if (!Array.isArray(rules)) throw new Error('rules must be array');
    } catch (e) {
      alert(e.message);
      return;
    }
    rules.push({
      id: $('simpleRuleId').value.trim() || `rule_${rules.length + 1}`,
      points,
      when,
    });
    $('rulesJson').value = JSON.stringify(rules, null, 2);
    saveStorage();
  }

  function bindEnvSelect() {
    const sel = $('paEnvSelect');
    if (!sel || !window.encompassApi) return;
    sel.value = window.encompassApi.getEncompassEnv();
    sel.addEventListener('change', () => {
      window.encompassApi.setEncompassEnv(sel.value);
    });
    window.addEventListener('encompassEnvChanged', () => {
      sel.value = window.encompassApi.getEncompassEnv();
      loadFromDatabase();
    });
  }

  function init() {
    loadStorage();
    bindEnvSelect();
    bindAddModeVisibility();
    loadFromDatabase();

    $('btnSaveConfig').addEventListener('click', async () => {
      saveStorage();
      const statusEl = $('runStatus');
      try {
        await saveToDatabase();
        statusEl.textContent = 'Config saved to browser and database.';
      } catch (e) {
        statusEl.textContent = 'Saved to browser only. Database: ' + e.message;
      }
    });
    $('btnReloadDbConfig').addEventListener('click', () => {
      loadFromDatabase();
      $('runStatus').textContent = 'Reloaded config from database (if any).';
    });
    $('btnPaLoadUsers')?.addEventListener('click', () => searchUsersForPicker());

    $('btnLoadDefaults').addEventListener('click', () => {
      $('processorsJson').value = DEFAULT_PROCESSORS;
      $('rulesJson').value = DEFAULT_RULES;
      $('roleConfigJson').value = DEFAULT_ROLE;
      $('complexityMode').value = 'rules';
      $('complexityAiModel').value = '';
      $('complexityMaxPoints').value = '';
      saveStorage();
      $('runStatus').textContent = 'Defaults loaded (replace user IDs and CX.* field ids before apply).';
    });
    $('btnAddRule').addEventListener('click', addSimpleRule);
    $('btnDryRun').addEventListener('click', () => runAssignment(true));
    $('btnApply').addEventListener('click', () => {
      const modal = new bootstrap.Modal($('applyConfirmModal'));
      modal.show();
    });
    $('btnConfirmApply').addEventListener('click', async () => {
      const modalEl = $('applyConfirmModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();
      await runAssignment(false);
    });
    $('btnPreviewPipeline').addEventListener('click', async () => {
      const st = $('pipelinePreviewStatus');
      st.textContent = 'Loading pipeline…';
      saveStorage();
      try {
        const lim = buildPipelineFilters().limit;
        const res = await getFetch()(`/api/encompass-hub/pipeline?limit=${lim}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.details || json.error);
        st.textContent = `Pipeline: ${json.count ?? 0} loan(s) in snapshot (used as input for dry run / apply).`;
      } catch (e) {
        st.textContent = 'Error: ' + e.message;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
