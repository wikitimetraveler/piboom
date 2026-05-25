/**
 * Development work by David Lane
 */
/**
 * Encompass loan batch update — env-scoped native/custom field catalogs, AG Grid, Excel/CSV import.
 */
(function () {
  'use strict';

  const DEFAULT_LOAN_IDS_BODY = {
    loanData: {
      customFields: [{ id: 'CUST01FV', stringValue: 'test' }],
    },
    loanIds: [
      '219f88d4-11f0-4f90-bac7-7e63d28aa1ef',
      '3a52b8ac-da28-4f8c-b1b0-a936506cac18',
      'eb33f713-2c87-4d65-9d36-fd31638aae2d',
    ],
  };

  const DEFAULT_FILTER_HINT =
    '{\n  "loanData": { "customFields": [{ "id": "CUST01FV", "stringValue": "test" }] },\n  "filter": { /* paste filter from Postman / ICE docs */ }\n}';

  let loansGridApi = null;
  let fieldsGridApi = null;
  /** @type {Map<string, { id: string, name: string }>} */
  let nativeById = new Map();
  /** @type {Map<string, { id: string, name: string }>} */
  let customById = new Map();
  let nativeIds = [];
  let customIds = [];

  const textareaIds = document.getElementById('batchBodyLoanIds');
  const textareaFilter = document.getElementById('batchBodyFilter');
  const metaEl = document.getElementById('batchResponseMeta');
  const preEl = document.getElementById('batchResponseBody');
  const envSelect = document.getElementById('batchEnvSelect');
  const catalogMetaEl = document.getElementById('batchFieldCatalogMeta');

  function setMeta(text, isError) {
    metaEl.textContent = text;
    metaEl.className = 'small ' + (isError ? 'text-danger' : 'text-muted');
  }

  function setCatalogMeta(text, isError) {
    if (!catalogMetaEl) return;
    catalogMetaEl.textContent = text;
    catalogMetaEl.className = 'small ' + (isError ? 'text-danger' : 'text-muted');
  }

  function syncEnvFromStorage() {
    if (!envSelect || !window.encompassApi) return;
    envSelect.value = window.encompassApi.getEncompassEnv();
  }

  function setGridRows(api, rows) {
    if (!api) return;
    if (typeof api.setGridOption === 'function') {
      api.setGridOption('rowData', rows);
    } else if (typeof api.setRowData === 'function') {
      api.setRowData(rows);
    }
  }

  function getGridRowData(api) {
    const rows = [];
    if (!api) return rows;
    if (typeof api.forEachNode === 'function') {
      api.forEachNode((node) => {
        if (node.data) rows.push({ ...node.data });
      });
    }
    return rows;
  }

  function buildCatalogEntry(item) {
    const id = String(item.id ?? item.fieldId ?? '').trim();
    if (!id) return null;
    const name = String(item.fieldName || item.name || item.description || item.longDescription || '').trim();
    return { id, name };
  }

  async function refreshFieldCatalogs() {
    setCatalogMeta('Loading native + custom fields for this environment…', false);
    if (envSelect && window.encompassApi) {
      window.encompassApi.setEncompassEnv(envSelect.value);
    }
    const fetchFn = window.encompassApi?.encompassFetch || fetch;
    try {
      const [natRes, custRes] = await Promise.all([
        fetchFn('/api/encompass-hub/native-fields'),
        fetchFn('/api/encompass-hub/custom-fields'),
      ]);
      if (!natRes.ok) throw new Error('native-fields HTTP ' + natRes.status);
      if (!custRes.ok) throw new Error('custom-fields HTTP ' + custRes.status);
      const natData = await natRes.json();
      const custData = await custRes.json();
      const nativeItems = Array.isArray(natData) ? natData : natData.items || [];
      const customItems = Array.isArray(custData) ? custData : custData.items || [];

      nativeById = new Map();
      for (const it of nativeItems) {
        const e = buildCatalogEntry(it);
        if (e) nativeById.set(e.id, e);
      }
      customById = new Map();
      for (const it of customItems) {
        const e = buildCatalogEntry(it);
        if (e) customById.set(e.id, e);
      }
      nativeIds = [...nativeById.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      customIds = [...customById.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      const envLabel = envSelect?.value === 'retail' ? 'Retail' : 'Correspondent';
      setCatalogMeta(
        'Catalog: ' + nativeIds.length + ' native, ' + customIds.length + ' custom (' + envLabel + '). fieldId pick-list filters by type.',
        false
      );
      if (fieldsGridApi && typeof fieldsGridApi.refreshCells === 'function') {
        fieldsGridApi.refreshCells({ force: true });
      }
    } catch (e) {
      console.error('batch catalog load', e);
      setCatalogMeta('Catalog load failed: ' + (e.message || String(e)), true);
    }
  }

  function lookupFieldName(src, id) {
    const s = String(id || '').trim();
    if (!s) return '';
    const map = normalizeFieldSource(src) === 'native' ? nativeById : customById;
    const row = map.get(s);
    return row && row.name ? row.name : '';
  }

  function inferSourceForId(fid) {
    const s = String(fid || '').trim();
    if (!s) return 'custom';
    if (customById.has(s)) return 'custom';
    if (nativeById.has(s)) return 'native';
    if (/^CUST|^CX\.|^LR\./i.test(s)) return 'custom';
    if (/^\d+$/.test(s)) return 'native';
    return 'custom';
  }

  function normalizeFieldSource(s) {
    const t = String(s || '').trim().toLowerCase();
    if (t === 'native' || t === 'std' || t === 'standard' || t === 'n') return 'native';
    return 'custom';
  }

  function idsForFieldGridRow(data) {
    const src = normalizeFieldSource(data.fieldSource);
    const list = src === 'native' ? nativeIds : customIds;
    return list.length ? list : [''];
  }

  function emptyFieldRow() {
    return {
      fieldSource: 'custom',
      fieldId: '',
      fieldName: '',
      stringValue: '',
      decimalValue: '',
      dateValue: '',
    };
  }

  function pickNativeValue(r) {
    if (r.stringValue != null && String(r.stringValue).trim() !== '') return String(r.stringValue);
    const dec = r.decimalValue;
    if (dec !== '' && dec != null && String(dec).trim() !== '') {
      const n = Number(dec);
      if (Number.isFinite(n)) return n;
    }
    if (r.dateValue != null && String(r.dateValue).trim() !== '') return String(r.dateValue).trim();
    return undefined;
  }

  function fieldRowToCustomField(r) {
    const id = String(r.fieldId || '').trim();
    if (!id) return null;
    const o = { id };
    let hasValue = false;
    if (r.stringValue != null && String(r.stringValue).trim() !== '') {
      o.stringValue = String(r.stringValue);
      hasValue = true;
    }
    const dec = r.decimalValue;
    if (dec !== '' && dec != null && String(dec).trim() !== '') {
      const n = Number(dec);
      if (Number.isFinite(n)) {
        o.decimalValue = n;
        hasValue = true;
      }
    }
    if (r.dateValue != null && String(r.dateValue).trim() !== '') {
      o.dateValue = String(r.dateValue).trim();
      hasValue = true;
    }
    if (!hasValue) return null;
    return o;
  }

  function sortFields(arr) {
    return [...arr].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function patchSignature(nativeArr, customArr) {
    const n = nativeArr
      .slice()
      .map((x) => ({ id: String(x.id), value: x.value }))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const c = sortFields(customArr);
    return JSON.stringify({ n, c });
  }

  /** @param {Array<object>} jsonRows */
  function longSheetToPayload(jsonRows) {
    const byLoan = new Map();
    for (const r of jsonRows) {
      const lid = String(r.loanId || r.LoanID || r.loan_id || '').trim();
      const fid = String(r.fieldId || r.FieldId || r.field_id || '').trim();
      if (!lid || !fid) continue;
      const src = normalizeFieldSource(r.fieldSource || r.FieldSource || inferSourceForId(fid));
      if (!byLoan.has(lid)) byLoan.set(lid, { native: [], custom: [] });
      const bucket = byLoan.get(lid);
      if (src === 'native') {
        const v = pickNativeValue({
          stringValue: r.stringValue ?? r.StringValue,
          decimalValue: r.decimalValue ?? r.DecimalValue,
          dateValue: r.dateValue ?? r.DateValue,
        });
        if (v === undefined) continue;
        bucket.native.push({ id: fid, value: v });
      } else {
        const cf = fieldRowToCustomField({
          fieldId: fid,
          stringValue: r.stringValue ?? r.StringValue,
          decimalValue: r.decimalValue ?? r.DecimalValue,
          dateValue: r.dateValue ?? r.DateValue,
        });
        if (cf) bucket.custom.push(cf);
      }
    }
    const loanIds = [...byLoan.keys()];
    if (loanIds.length === 0) {
      throw new Error('No rows with both loanId and fieldId found.');
    }
    let canonical = null;
    for (const lid of loanIds) {
      const b = byLoan.get(lid);
      const sig = patchSignature(b.native, b.custom);
      if (canonical === null) canonical = sig;
      else if (canonical !== sig) {
        throw new Error(
          'Long-format rows: each loan must get the same native + custom patch (one batch payload for all IDs).'
        );
      }
    }
    const first = byLoan.get(loanIds[0]);
    const out = { loanIds };
    if (first.custom.length) out.loanData = { customFields: sortFields(first.custom) };
    if (first.native.length) {
      out.loanFields = first.native
        .slice()
        .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    }
    if (!out.loanData && !out.loanFields) {
      throw new Error('No field values found (add stringValue / decimalValue / dateValue).');
    }
    return out;
  }

  function twoSheetsToPayload(loansRows, fieldsRows) {
    const loanIds = [
      ...new Set(
        loansRows.map((r) => String(r.loanId || r.LoanID || r.loan_id || '').trim()).filter(Boolean)
      ),
    ];
    if (loanIds.length === 0) {
      throw new Error('Loans sheet: no loanId values.');
    }
    const nativeMap = new Map();
    const customList = [];
    for (const r of fieldsRows) {
      const fid = String(r.fieldId || r.FieldId || '').trim();
      if (!fid) continue;
      const src = normalizeFieldSource(r.fieldSource || r.FieldSource || inferSourceForId(fid));
      if (src === 'native') {
        const v = pickNativeValue({
          stringValue: r.stringValue ?? r.StringValue,
          decimalValue: r.decimalValue ?? r.DecimalValue,
          dateValue: r.dateValue ?? r.DateValue,
        });
        if (v !== undefined) nativeMap.set(fid, { id: fid, value: v });
      } else {
        const cf = fieldRowToCustomField({
          fieldId: fid,
          stringValue: r.stringValue ?? r.StringValue,
          decimalValue: r.decimalValue ?? r.DecimalValue,
          dateValue: r.dateValue ?? r.DateValue,
        });
        if (cf) customList.push(cf);
      }
    }
    if (nativeMap.size === 0 && customList.length === 0) {
      throw new Error('Fields sheet: add at least one field row with a value.');
    }
    const out = { loanIds };
    if (customList.length) out.loanData = { customFields: sortFields(customList) };
    if (nativeMap.size) {
      out.loanFields = [...nativeMap.values()].sort((a, b) =>
        String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      );
    }
    return out;
  }

  function parseWorkbook(wb) {
    const names = wb.SheetNames || [];
    const loansName = names.find((n) => /^loans$/i.test(String(n).trim()));
    const fieldsName = names.find((n) => /^fields$/i.test(String(n).trim()));
    if (loansName && fieldsName) {
      const loansJson = window.XLSX.utils.sheet_to_json(wb.Sheets[loansName], { defval: '' });
      const fieldsJson = window.XLSX.utils.sheet_to_json(wb.Sheets[fieldsName], { defval: '' });
      return twoSheetsToPayload(loansJson, fieldsJson);
    }
    const first = wb.Sheets[names[0]];
    if (!first) {
      throw new Error('Workbook has no sheets.');
    }
    const rows = window.XLSX.utils.sheet_to_json(first, { defval: '' });
    return longSheetToPayload(rows);
  }

  function applyPayloadToGrids(payload) {
    const ids = payload.loanIds || [];
    setGridRows(
      loansGridApi,
      ids.length ? ids.map((loanId) => ({ loanId })) : [{ loanId: '' }]
    );

    const rows = [];
    for (const f of payload.loanFields || []) {
      const id = String(f.id ?? f.fieldId ?? '').trim();
      if (!id) continue;
      const val = f.value;
      let stringValue = '';
      let decimalValue = '';
      let dateValue = '';
      if (typeof val === 'number' && Number.isFinite(val)) {
        decimalValue = val;
      } else if (val != null && val !== '') {
        stringValue = String(val);
      }
      rows.push({
        fieldSource: 'native',
        fieldId: id,
        fieldName: lookupFieldName('native', id),
        stringValue,
        decimalValue,
        dateValue,
      });
    }
    for (const c of payload.loanData?.customFields || []) {
      rows.push({
        fieldSource: 'custom',
        fieldId: c.id,
        fieldName: lookupFieldName('custom', c.id),
        stringValue: c.stringValue != null ? c.stringValue : '',
        decimalValue: c.decimalValue != null ? c.decimalValue : '',
        dateValue: c.dateValue != null ? c.dateValue : '',
      });
    }
    setGridRows(fieldsGridApi, rows.length ? rows : [emptyFieldRow()]);
  }

  function payloadFromGrids() {
    const loanRows = getGridRowData(loansGridApi);
    const fieldRows = getGridRowData(fieldsGridApi);
    const loanIds = [
      ...new Set(loanRows.map((r) => String(r.loanId || '').trim()).filter(Boolean)),
    ];
    const nativeMap = new Map();
    const customList = [];
    for (const r of fieldRows) {
      const fid = String(r.fieldId || '').trim();
      if (!fid) continue;
      const src = normalizeFieldSource(r.fieldSource || inferSourceForId(fid));
      if (src === 'native') {
        const v = pickNativeValue(r);
        if (v !== undefined) nativeMap.set(fid, { id: fid, value: v });
      } else {
        const cf = fieldRowToCustomField(r);
        if (cf) customList.push(cf);
      }
    }
    if (loanIds.length === 0) {
      throw new Error('Add at least one loanId in the Loan IDs grid.');
    }
    if (nativeMap.size === 0 && customList.length === 0) {
      throw new Error('Add at least one field row with fieldId and a value (native or custom).');
    }
    const out = { loanIds };
    if (customList.length) out.loanData = { customFields: sortFields(customList) };
    if (nativeMap.size) {
      out.loanFields = [...nativeMap.values()].sort((a, b) =>
        String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      );
    }
    return out;
  }

  function gridsToTextarea() {
    try {
      const payload = payloadFromGrids();
      if (textareaIds) {
        textareaIds.value = JSON.stringify(payload, null, 2);
      }
      setMeta('Updated JSON from grids.', false);
    } catch (e) {
      setMeta(e.message || String(e), true);
    }
  }

  function downloadTemplate() {
    if (!window.XLSX) {
      setMeta('Sheet library not loaded.', true);
      return;
    }
    const wb = window.XLSX.utils.book_new();
    const loansSheet = window.XLSX.utils.aoa_to_sheet([
      ['loanId'],
      ['00000000-0000-0000-0000-000000000001'],
      ['00000000-0000-0000-0000-000000000002'],
    ]);
    const fieldsSheet = window.XLSX.utils.aoa_to_sheet([
      ['fieldSource', 'fieldId', 'stringValue', 'decimalValue', 'dateValue'],
      ['custom', 'CUST01FV', 'test', '', ''],
      ['native', '4002', 'Doe', '', ''],
    ]);
    window.XLSX.utils.book_append_sheet(wb, loansSheet, 'Loans');
    window.XLSX.utils.book_append_sheet(wb, fieldsSheet, 'Fields');
    window.XLSX.writeFile(wb, 'encompass-batch-template.xlsx');
  }

  function handleFileImport(file) {
    if (!file || !window.XLSX) {
      setMeta('Choose an .xlsx or .csv file.', true);
      return;
    }
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        let wb;
        if (name.endsWith('.csv')) {
          wb = window.XLSX.read(e.target.result, { type: 'string' });
        } else {
          wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        }
        const payload = parseWorkbook(wb);
        applyPayloadToGrids(payload);
        if (textareaIds) {
          textareaIds.value = JSON.stringify(payload, null, 2);
        }
        setMeta('Imported: ' + file.name + ' → grids + JSON.', false);
      } catch (err) {
        setMeta('Import failed: ' + (err.message || String(err)), true);
      }
    };
    if (name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  function initGrids() {
    const loansEl = document.getElementById('loansGridWrap');
    const fieldsEl = document.getElementById('fieldsGridWrap');
    if (!loansEl || !fieldsEl || typeof agGrid === 'undefined') return;

    const defaultColDef = {
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 1,
      minWidth: 90,
    };

    const loansOptions = {
      columnDefs: [{ field: 'loanId', headerName: 'loanId', flex: 1 }],
      defaultColDef,
      rowData: [{ loanId: '' }],
      animateRows: true,
      singleClickEdit: true,
    };

    const fieldsColumnDefs = [
      {
        field: 'fieldSource',
        headerName: 'Type',
        width: 118,
        maxWidth: 130,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['custom', 'native'],
        },
        valueFormatter: (p) => (p.value === 'native' ? 'Native' : 'Custom'),
      },
      {
        field: 'fieldId',
        headerName: 'fieldId',
        flex: 1,
        minWidth: 120,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params) => ({
          values: idsForFieldGridRow(params.data),
          filterList: true,
          searchType: 'contains',
        }),
      },
      {
        colId: 'fieldName',
        headerName: 'Name (env)',
        flex: 1,
        editable: false,
        valueGetter: (p) => {
          const id = String(p.data.fieldId || '').trim();
          if (!id) return '';
          const src = normalizeFieldSource(p.data.fieldSource || inferSourceForId(id));
          let name = lookupFieldName(src, id);
          if (!name && src === 'custom') name = lookupFieldName('native', id);
          if (!name && src === 'native') name = lookupFieldName('custom', id);
          return name;
        },
      },
      { field: 'stringValue', headerName: 'stringValue', flex: 1 },
      { field: 'decimalValue', headerName: 'decimalValue', flex: 1 },
      { field: 'dateValue', headerName: 'dateValue', flex: 1 },
    ];

    const fieldsOptions = {
      columnDefs: fieldsColumnDefs,
      defaultColDef,
      rowData: [emptyFieldRow()],
      animateRows: true,
      singleClickEdit: true,
      onCellValueChanged: (ev) => {
        if (ev.colDef.field === 'fieldSource') {
          if (typeof ev.node.setDataValue === 'function') {
            ev.node.setDataValue('fieldId', '');
          } else {
            ev.node.data.fieldId = '';
          }
          if (typeof ev.api.refreshCells === 'function') {
            ev.api.refreshCells({ rowNodes: [ev.node], force: true });
          }
          return;
        }
        if (ev.colDef.field === 'fieldId' && typeof ev.api.refreshCells === 'function') {
          ev.api.refreshCells({
            rowNodes: [ev.node],
            columns: ['fieldName'],
            force: true,
          });
        }
      },
    };

    if (typeof agGrid.createGrid === 'function') {
      loansGridApi = agGrid.createGrid(loansEl, loansOptions);
      fieldsGridApi = agGrid.createGrid(fieldsEl, fieldsOptions);
    } else {
      new agGrid.Grid(loansEl, loansOptions);
      new agGrid.Grid(fieldsEl, fieldsOptions);
      loansGridApi = loansOptions.api;
      fieldsGridApi = fieldsOptions.api;
    }
  }

  function addLoanRow() {
    if (!loansGridApi || typeof loansGridApi.applyTransaction !== 'function') {
      const rows = getGridRowData(loansGridApi);
      rows.push({ loanId: '' });
      setGridRows(loansGridApi, rows);
      return;
    }
    loansGridApi.applyTransaction({ add: [{ loanId: '' }] });
  }

  function addFieldRow() {
    if (!fieldsGridApi || typeof fieldsGridApi.applyTransaction !== 'function') {
      const rows = getGridRowData(fieldsGridApi);
      rows.push(emptyFieldRow());
      setGridRows(fieldsGridApi, rows);
      return;
    }
    fieldsGridApi.applyTransaction({ add: [emptyFieldRow()] });
  }

  function initDefaults() {
    if (textareaFilter && !textareaFilter.value.trim()) {
      textareaFilter.value = DEFAULT_FILTER_HINT;
    }
    if (textareaIds && !textareaIds.value.trim()) {
      textareaIds.value = JSON.stringify(DEFAULT_LOAN_IDS_BODY, null, 2);
    }
    try {
      const parsed = JSON.parse(textareaIds.value);
      if (parsed.loanIds && (parsed.loanData || parsed.loanFields)) {
        applyPayloadToGrids(parsed);
      }
    } catch (_) {
      /* keep grid defaults */
    }
  }

  function activeTextarea() {
    const mode = document.querySelector('input[name="batchMode"]:checked');
    const m = mode ? mode.value : 'loanIds';
    return m === 'filter' ? textareaFilter : textareaIds;
  }

  async function submitBatch() {
    const ta = activeTextarea();
    const raw = ta.value.trim();
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      setMeta('Invalid JSON: ' + e.message, true);
      preEl.textContent = '';
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      setMeta('Body must be a JSON object.', true);
      preEl.textContent = '';
      return;
    }

    setMeta('Sending…', false);
    preEl.textContent = '';

    if (envSelect && window.encompassApi) {
      window.encompassApi.setEncompassEnv(envSelect.value);
    }

    try {
      const res = await (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/loan-batch/update-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let display = text;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json') && text) {
        try {
          display = JSON.stringify(JSON.parse(text), null, 2);
        } catch (_) {
          display = text;
        }
      }
      preEl.textContent = display || '(empty body)';
      setMeta('POST /api/encompass-hub/loan-batch/update-requests · HTTP ' + res.status, !res.ok);
    } catch (e) {
      setMeta('Request failed: ' + (e.message || String(e)), true);
      preEl.textContent = '';
    }
  }

  document.getElementById('batchSubmitBtn')?.addEventListener('click', submitBatch);
  document.getElementById('batchGridsToJson')?.addEventListener('click', gridsToTextarea);
  document.getElementById('batchDownloadTemplate')?.addEventListener('click', downloadTemplate);
  document.getElementById('batchAddLoanRow')?.addEventListener('click', addLoanRow);
  document.getElementById('batchAddFieldRow')?.addEventListener('click', addFieldRow);
  document.getElementById('batchRefreshCatalogs')?.addEventListener('click', () => refreshFieldCatalogs());
  document.getElementById('batchFileImport')?.addEventListener('change', function (ev) {
    const f = ev.target.files && ev.target.files[0];
    if (f) handleFileImport(f);
    ev.target.value = '';
  });

  document.getElementById('batchCopyBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preEl.textContent);
      const btn = document.getElementById('batchCopyBtn');
      const prev = btn.innerHTML;
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.innerHTML = prev;
      }, 1500);
    } catch (_) {
      setMeta('Clipboard not available', true);
    }
  });

  envSelect?.addEventListener('change', () => {
    if (window.encompassApi) {
      window.encompassApi.setEncompassEnv(envSelect.value);
    }
    refreshFieldCatalogs();
  });

  document.addEventListener('encompassEnvChanged', () => {
    syncEnvFromStorage();
    refreshFieldCatalogs();
  });

  function boot() {
    initGrids();
    syncEnvFromStorage();
    initDefaults();
    if (loansGridApi && typeof loansGridApi.sizeColumnsToFit === 'function') {
      loansGridApi.sizeColumnsToFit();
    }
    if (fieldsGridApi && typeof fieldsGridApi.sizeColumnsToFit === 'function') {
      fieldsGridApi.sizeColumnsToFit();
    }
    refreshFieldCatalogs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
