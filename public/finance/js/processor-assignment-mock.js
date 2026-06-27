/**
 * Development work by David Lane
 */
/**
 * Processor assignment mock demo — synthetic loans/processors only; no Encompass pipeline or PUT.
 */
(function () {
  'use strict';

  const LS_PROCESSORS = 'processorAssignmentMock_processorsJson';
  const LS_LOANS = 'processorAssignmentMock_loansJson';
  const LS_RULES = 'processorAssignmentMock_rulesJson';
  const LS_ROLE = 'processorAssignmentMock_roleConfigJson';

  const { MOCK_PROCESSORS, MOCK_LOANS } = window.processorAssignmentMockData || {};

  const DEFAULT_RULES = `[
  { "id": "progression_multiple_processors", "points": 0.5, "when": { "field": "Fields.CX.PROGRESSION.MULTIPLE_PROCESSORS", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "progression_product_change", "points": 1, "when": { "field": "Fields.CX.PROGRESSION.PRODUCT_CHANGE", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "progression_suspended", "points": 0.5, "when": { "field": "Fields.CX.PROGRESSION.SUSPENDED", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "progression_title_hold", "points": 0.5, "when": { "field": "Fields.CX.PROGRESSION.TITLE_HOLD", "op": "in", "values": ["2H", "Y", "Yes", "true", "TRUE"] } },
  { "id": "progression_subject_to_appraisal", "points": 0.5, "when": { "field": "Fields.CX.PROGRESSION.SUBJECT_TO_APPRAISAL", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "initial_borrower_count", "points": 0.25, "when": { "field": "Fields.CX.INITIAL.BORROWER_PAIR_COUNT", "op": "gt", "value": 1 } },
  { "id": "initial_cema", "points": 0.5, "when": { "field": "Loan.MortgageType", "op": "contains", "value": "CEMA" } },
  { "id": "initial_condo", "points": 0.5, "when": { "field": "Loan.PropertyType", "op": "contains", "value": "Condo" } },
  { "id": "initial_dti_gt_45", "points": 0.5, "when": { "field": "Loan.TotalDTI", "op": "gt", "value": 45 } },
  { "id": "initial_fico_lt_680", "points": 0.25, "when": { "field": "Loan.BorrowerScore", "op": "lt", "value": 680 } },
  { "id": "initial_job_tenure_lt_12m", "points": 0.5, "when": { "field": "Fields.CX.INITIAL.JOB_TENURE_MONTHS", "op": "lt", "value": 12 } },
  { "id": "initial_jumbo_non_agency", "points": 0.5, "when": { "field": "Loan.LoanProgramName", "op": "contains", "value": "Jumbo" } },
  { "id": "initial_occupancy_investor", "points": 1, "when": { "field": "Loan.PropertyOccupancyType", "op": "contains", "value": "Investment" } },
  { "id": "initial_occupancy_second_home", "points": 0.5, "when": { "field": "Loan.PropertyOccupancyType", "op": "contains", "value": "Second" } },
  { "id": "initial_other_income_used", "points": 0.5, "when": { "field": "Fields.CX.INITIAL.OTHER_INCOME_USED", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "initial_re_liabilities_gt_2", "points": 0.5, "when": { "field": "Fields.CX.INITIAL.RE_LIABILITIES_COUNT", "op": "gt", "value": 2 } },
  { "id": "initial_self_employed", "points": 0.5, "when": { "field": "Fields.CX.BORROWER.SELF.EMPLOYED", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "initial_subordination", "points": 1, "when": { "field": "Fields.CX.INITIAL.SUBORDINATION", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } },
  { "id": "initial_trust", "points": 0.5, "when": { "field": "Loan.BorrowerType", "op": "contains", "value": "Trust" } },
  { "id": "initial_tx50a6", "points": 0.25, "when": { "field": "Loan.State", "op": "eq", "value": "TX" } },
  { "id": "initial_va_full_doc", "points": 0.5, "when": { "field": "Loan.LoanProgramName", "op": "contains", "value": "VA" } },
  { "id": "initial_variable_income", "points": 0.25, "when": { "field": "Fields.CX.INITIAL.VARIABLE_INCOME_USED", "op": "in", "values": ["Y", "Yes", "true", "TRUE", "1"] } }
]`;

  const DEFAULT_ROLE = `{
  "roleNameIncludes": "processor"
}`;

  let lastRunPayload = null;
  let lastResultsData = null;
  let lastResultsMockApplied = false;

  function $(id) {
    return document.getElementById(id);
  }

  function norm(s) {
    return `${s ?? ''}`.trim().toLowerCase();
  }

  function loanFieldsFromItem(item) {
    return item?.fields || {};
  }

  function loanProcessorId(fields) {
    return fields['Loan.LoanProcessorID'] ?? fields['Loan.LoanProcessorId'] ?? '';
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter((v) => v != null && `${v}`.trim() !== ''))].sort((a, b) =>
      `${a}`.localeCompare(`${b}`),
    );
  }

  function refillSelect(selectEl, values, allLabel) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = allLabel;
    selectEl.appendChild(allOpt);
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = `${v}`;
      opt.textContent = `${v}`;
      selectEl.appendChild(opt);
    });
    if (current && values.some((v) => `${v}` === current)) {
      selectEl.value = current;
    }
  }

  function getLoanPreviewFilters() {
    return {
      search: norm($('loanFilterSearch')?.value),
      product: $('loanFilterProduct')?.value || '',
      assignment: $('loanFilterAssignment')?.value || '',
    };
  }

  function matchesLoanPreviewFilters(item, filters) {
    const fields = loanFieldsFromItem(item);
    const guid = item.loanGuid || item.loanId || fields['Loan.LoanGuid'] || '';
    const procId = loanProcessorId(fields);
    const assigned = `${procId}`.trim() !== '';

    if (filters.assignment === 'unassigned' && assigned) return false;
    if (filters.assignment === 'assigned' && !assigned) return false;

    if (filters.product) {
      const product = `${fields['Loan.MortgageType'] ?? ''}`;
      if (product !== filters.product) return false;
    }

    if (filters.search) {
      const hay = [
        fields['Loan.LoanNumber'],
        fields['Loan.BorrowerName'],
        guid,
        procId,
        fields['Loan.LoanProcessorName'],
        fields['Loan.MortgageType'],
        fields['Loan.LoanProgramName'],
      ]
        .map(norm)
        .join(' ');
      if (!hay.includes(filters.search)) return false;
    }

    return true;
  }

  function getResultsFilters() {
    const minRaw = $('resultsFilterMinScore')?.value.trim();
    const minScore = minRaw === '' ? null : Number(minRaw);
    return {
      search: norm($('resultsFilterSearch')?.value),
      status: $('resultsFilterStatus')?.value || '',
      processor: $('resultsFilterProcessor')?.value || '',
      minScore: Number.isFinite(minScore) ? minScore : null,
    };
  }

  function matchesResultsFilters(row, filters) {
    if (filters.status && `${row.status ?? ''}` !== filters.status) return false;
    if (filters.processor && `${row.processorUserId ?? ''}` !== filters.processor) return false;
    if (filters.minScore != null) {
      const score = Number(row.score);
      if (!Number.isFinite(score) || score < filters.minScore) return false;
    }
    if (filters.search) {
      const hits = (row.ruleHits || [])
        .map((h) => (h.ruleId ? `${h.ruleId}(+${h.points})` : `+${h.points}`))
        .join(', ');
      const hay = [
        row.loanNumber,
        row.borrowerName,
        row.loanGuid,
        row.processorUserId,
        row.currentProcessorId,
        row.currentProcessorName,
        row.status,
        row.reason,
        row.eligibilityNote,
        hits,
        ...(row.loanProductTags || []),
      ]
        .map(norm)
        .join(' ');
      if (!hay.includes(filters.search)) return false;
    }
    return true;
  }

  function clearLoanFilters() {
    if ($('loanFilterSearch')) $('loanFilterSearch').value = '';
    if ($('loanFilterProduct')) $('loanFilterProduct').value = '';
    if ($('loanFilterAssignment')) $('loanFilterAssignment').value = '';
    renderLoanPreview();
  }

  function clearResultsFilters() {
    if ($('resultsFilterSearch')) $('resultsFilterSearch').value = '';
    if ($('resultsFilterStatus')) $('resultsFilterStatus').value = '';
    if ($('resultsFilterProcessor')) $('resultsFilterProcessor').value = '';
    if ($('resultsFilterMinScore')) $('resultsFilterMinScore').value = '';
    if (lastResultsData) renderResults(lastResultsData, lastResultsMockApplied);
  }

  function parseJson(text, label) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`${label} must be valid JSON: ${e.message}`);
    }
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

  function statusClass(s) {
    if (s === 'assigned' || s === 'proposed' || s === 'assigned_mock') return 'success';
    if (s === 'skipped') return 'warning';
    if (s === 'error') return 'danger';
    return 'secondary';
  }

  function processorDisplayName(userId, processors) {
    const match = processors.find((p) => `${p.userId}` === `${userId}`);
    return match?.displayName || userId;
  }

  function loadStorage() {
    const processorsDefault = JSON.stringify(MOCK_PROCESSORS || [], null, 2);
    const loansDefault = JSON.stringify(MOCK_LOANS || [], null, 2);
    try {
      $('processorsJson').value = localStorage.getItem(LS_PROCESSORS) || processorsDefault;
      $('loansJson').value = localStorage.getItem(LS_LOANS) || loansDefault;
      $('rulesJson').value = localStorage.getItem(LS_RULES) || DEFAULT_RULES;
      $('roleConfigJson').value = localStorage.getItem(LS_ROLE) || DEFAULT_ROLE;
    } catch (e) {
      console.warn(e);
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem(LS_PROCESSORS, $('processorsJson').value);
      localStorage.setItem(LS_LOANS, $('loansJson').value);
      localStorage.setItem(LS_RULES, $('rulesJson').value);
      localStorage.setItem(LS_ROLE, $('roleConfigJson').value);
    } catch (e) {
      console.warn(e);
    }
  }

  function resetMockData() {
    $('processorsJson').value = JSON.stringify(MOCK_PROCESSORS || [], null, 2);
    $('loansJson').value = JSON.stringify(MOCK_LOANS || [], null, 2);
    $('rulesJson').value = DEFAULT_RULES;
    $('roleConfigJson').value = DEFAULT_ROLE;
    saveStorage();
    renderLoanPreview();
    $('runStatus').textContent = 'Mock loans and processors reset to defaults.';
  }

  function renderLoanPreview() {
    const tbody = $('loanPreviewBody');
    const card = $('loanPreviewCard');
    if (!tbody) return;
    let loans;
    try {
      loans = parseJson($('loansJson').value, 'Mock loans');
      if (!Array.isArray(loans)) throw new Error('Mock loans must be a JSON array');
    } catch (e) {
      $('loanPreviewStatus').textContent = e.message;
      return;
    }

    const products = uniqueSorted(loans.map((item) => loanFieldsFromItem(item)['Loan.MortgageType']));
    refillSelect($('loanFilterProduct'), products, 'All products');

    const filters = getLoanPreviewFilters();
    const filtered = loans.filter((item) => matchesLoanPreviewFilters(item, filters));

    tbody.innerHTML = '';
    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted small py-3">No loans match the current filters.</td></tr>';
    } else {
      filtered.forEach((item) => {
        const fields = loanFieldsFromItem(item);
        const guid = item.loanGuid || item.loanId || fields['Loan.LoanGuid'] || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${escapeHtml(fields['Loan.LoanNumber'] ?? '')}</td>
        <td>${escapeHtml(fields['Loan.BorrowerName'] ?? '')}</td>
        <td><code class="small">${escapeHtml(guid)}</code></td>
        <td><code class="small">${escapeHtml(loanProcessorId(fields))}</code></td>
        <td class="small">${escapeHtml(fields['Loan.LoanProcessorName'] ?? '')}</td>
        <td class="small">${escapeHtml(fields['Loan.MortgageType'] ?? '')}</td>
      `;
        tbody.appendChild(tr);
      });
    }
    if (card) card.style.display = '';
    const filterNote =
      filtered.length === loans.length
        ? `${loans.length} mock loan(s)`
        : `${filtered.length} of ${loans.length} loan(s) shown`;
    $('loanPreviewStatus').textContent = `${filterNote} — edit JSON above and click Preview to refresh.`;
  }

  function renderResults(data, mockApplied) {
    const tbody = $('resultsBody');
    const meta = $('resultsMeta');
    tbody.innerHTML = '';
    if (!data || !Array.isArray(data.results)) {
      meta.textContent = 'No results.';
      lastResultsData = null;
      return;
    }

    lastResultsData = data;
    lastResultsMockApplied = Boolean(mockApplied);

    const statuses = uniqueSorted(data.results.map((row) => row.status));
    const processors = uniqueSorted(data.results.map((row) => row.processorUserId));
    refillSelect($('resultsFilterStatus'), statuses, 'All statuses');
    refillSelect($('resultsFilterProcessor'), processors, 'All processors');

    const filters = getResultsFilters();
    const filtered = data.results.filter((row) => matchesResultsFilters(row, filters));

    const mode = data.complexityMode ?? 'rules';
    const routing = data.routingConfig || {};
    const targetTxt = routing.globalTargetUtilization != null ? routing.globalTargetUtilization : 'auto';
    const filterNote =
      filtered.length === data.results.length
        ? `${data.results.length} row(s)`
        : `${filtered.length} of ${data.results.length} row(s)`;
    meta.textContent = `Mock demo | mode: ${mode} | target utilization: ${targetTxt} | proposed: ${data.summary?.proposed ?? 0} mock-assigned: ${data.summary?.assigned ?? 0} skipped: ${data.summary?.skipped ?? 0} | showing ${filterNote}${mockApplied ? ' (mock apply applied to JSON)' : ''}`;

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="text-center text-muted small py-3">No results match the current filters.</td></tr>';
      return;
    }

    filtered.forEach((row) => {
      const tr = document.createElement('tr');
      const hits = (row.ruleHits || [])
        .map((h) => (h.ruleId ? `${h.ruleId}(+${h.points})` : `+${h.points}`))
        .join(', ');
      const curId = row.currentProcessorId != null && `${row.currentProcessorId}`.trim() !== '' ? row.currentProcessorId : '';
      const curName = row.currentProcessorName != null && `${row.currentProcessorName}`.trim() !== '' ? row.currentProcessorName : '';
      const curCell = curId || curName ? `${curId}${curId && curName ? ' · ' : ''}${curName}` : '—';
      tr.innerHTML = `
        <td>${escapeHtml(row.loanNumber ?? '')}</td>
        <td>${escapeHtml(row.borrowerName ?? '')}</td>
        <td>${escapeHtml(row.loanGuid ?? '')}</td>
        <td class="text-end">${row.score ?? ''}</td>
        <td class="small" title="${escapeAttr(hits)}">${escapeHtml(hits || '—')}</td>
        <td class="small text-muted">${escapeHtml(curCell)}</td>
        <td><code class="small">${escapeHtml(row.processorUserId ?? '')}</code></td>
        <td class="small">${escapeHtml(row.eligibilityNote ?? '—')}</td>
        <td><span class="badge bg-${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td class="small text-muted">${escapeHtml(row.reason ?? '')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function buildRunBody() {
    const processors = parseJson($('processorsJson').value, 'Processors');
    const complexityRules = parseJson($('rulesJson').value, 'Complexity rules');
    const roleConfig = parseJson($('roleConfigJson').value, 'Role config');
    const loans = parseJson($('loansJson').value, 'Mock loans');
    if (!Array.isArray(loans)) throw new Error('Mock loans must be a JSON array');

    const body = {
      dryRun: true,
      loans,
      processors,
      complexityRules,
      roleConfig,
      assignOnlyUnassigned: $('assignOnlyUnassigned').checked,
      allowIneligibleOverride: $('allowIneligibleOverride').checked,
      sortOrder: $('sortDesc').checked ? 'desc' : 'asc',
      complexityMode: 'rules',
    };
    const maxPts = $('complexityMaxPoints').value.trim();
    if (maxPts !== '') {
      const n = Number(maxPts);
      if (Number.isFinite(n)) body.complexityMaxPoints = n;
    }
    const globalTargetUtilization = $('globalTargetUtilization').value.trim();
    if (globalTargetUtilization !== '') {
      const n = Number(globalTargetUtilization);
      if (Number.isFinite(n)) body.globalTargetUtilization = n;
    }
    body.capacityWeightingMode = $('capacityWeightingMode').value || 'linear';
    const capacityWeightEl = $('capacityWeightFactor');
    const capacityWeightFactor = capacityWeightEl ? capacityWeightEl.value.trim() : '';
    if (capacityWeightFactor !== '') {
      const n = Number(capacityWeightFactor);
      if (Number.isFinite(n)) body.capacityWeightFactor = n;
    }
    return body;
  }

  async function runAssignment() {
    const statusEl = $('runStatus');
    statusEl.textContent = 'Running mock dry run…';
    saveStorage();

    let body;
    try {
      body = buildRunBody();
    } catch (e) {
      statusEl.textContent = e.message;
      return null;
    }

    try {
      const res = await fetch('/api/encompass-hub/processor-assignment/run', {
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
      lastRunPayload = { body, result: json };
      renderResults(json, false);
      statusEl.textContent = 'Dry run complete (mock data only — no Encompass writes).';
      return json;
    } catch (e) {
      statusEl.textContent = 'Error: ' + e.message;
      return null;
    }
  }

  function applyMockAssignments() {
    const statusEl = $('runStatus');
    if (!lastRunPayload?.result?.results?.length) {
      statusEl.textContent = 'Run a dry run first.';
      return;
    }

    const { body, result } = lastRunPayload;
    const processors = body.processors || [];
    let loans;
    try {
      loans = parseJson($('loansJson').value, 'Mock loans');
      if (!Array.isArray(loans)) throw new Error('Mock loans must be a JSON array');
    } catch (e) {
      statusEl.textContent = e.message;
      return;
    }

    const proposals = result.results.filter((r) => r.status === 'proposed' && r.processorUserId);
    if (!proposals.length) {
      statusEl.textContent = 'No proposed assignments to apply.';
      return;
    }

    const byGuid = new Map();
    proposals.forEach((r) => {
      if (r.loanGuid) byGuid.set(`${r.loanGuid}`, r.processorUserId);
    });

    let applied = 0;
    loans.forEach((loan) => {
      const guid = loan.loanGuid || loan.loanId || loan.fields?.['Loan.LoanGuid'];
      const procId = byGuid.get(`${guid}`);
      if (!procId) return;
      loan.fields = loan.fields || {};
      loan.fields['Loan.LoanProcessorID'] = procId;
      loan.fields['Loan.LoanProcessorName'] = processorDisplayName(procId, processors);
      applied += 1;
    });

    $('loansJson').value = JSON.stringify(loans, null, 2);
    saveStorage();
    renderLoanPreview();

    const patched = {
      ...result,
      summary: {
        ...result.summary,
        proposed: 0,
        assigned: applied,
      },
      results: result.results.map((row) => {
        if (row.status !== 'proposed') return row;
        return { ...row, status: 'assigned_mock' };
      }),
    };
    try {
      lastRunPayload = { body: buildRunBody(), result: patched };
    } catch {
      lastRunPayload = { body, result: patched };
    }
    renderResults(patched, true);
    statusEl.textContent = `Mock apply complete — updated ${applied} loan(s) in the JSON dataset (no Encompass PUT).`;
  }

  function bindFilterEvents() {
    ['loanFilterSearch', 'loanFilterProduct', 'loanFilterAssignment'].forEach((id) => {
      $(id)?.addEventListener('input', renderLoanPreview);
      $(id)?.addEventListener('change', renderLoanPreview);
    });
    $('btnClearLoanFilters')?.addEventListener('click', clearLoanFilters);

    ['resultsFilterSearch', 'resultsFilterStatus', 'resultsFilterProcessor', 'resultsFilterMinScore'].forEach(
      (id) => {
        $(id)?.addEventListener('input', () => {
          if (lastResultsData) renderResults(lastResultsData, lastResultsMockApplied);
        });
        $(id)?.addEventListener('change', () => {
          if (lastResultsData) renderResults(lastResultsData, lastResultsMockApplied);
        });
      },
    );
    $('btnClearResultsFilters')?.addEventListener('click', clearResultsFilters);
  }

  function init() {
    loadStorage();
    renderLoanPreview();
    bindFilterEvents();

    $('btnResetMock').addEventListener('click', resetMockData);
    $('btnPreviewLoans').addEventListener('click', () => {
      saveStorage();
      renderLoanPreview();
    });
    $('btnDryRun').addEventListener('click', () => runAssignment());
    $('btnApplyMock').addEventListener('click', () => applyMockAssignments());
    $('btnHideLoanPreview')?.addEventListener('click', () => {
      const card = $('loanPreviewCard');
      if (card) card.style.display = 'none';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
