/**
 * Development work by David Lane
 */
/**
 * Test Library accordion — Excel library, BR / Tool 8 library, field search.
 * Depends on callbacks from unit-tests.js (grid load, toast, generated data).
 */
(function () {
  let showToast = () => {};
  let handleFileUpload = async () => {};
  let loadGeneratedTestData = () => {};
  let buildEncompassFieldMetadataLookupForUnitTests = async () => ({});

  const els = {};

  function cacheElements() {
    els.uploadToLibraryBtn = document.getElementById('uploadToLibraryBtn');
    els.libraryFileInput = document.getElementById('libraryFileInput');
    els.testLibraryList = document.getElementById('testLibraryList');
    els.fieldIdSearchInput = document.getElementById('fieldIdSearchInput');
    els.fieldIdSearchBtn = document.getElementById('fieldIdSearchBtn');
    els.fieldSearchResults = document.getElementById('fieldSearchResults');
    els.fieldSearchTerm = document.getElementById('fieldSearchTerm');
    els.fieldSearchResultsList = document.getElementById('fieldSearchResultsList');
    els.uploadBrRuleLibraryBtn = document.getElementById('uploadBrRuleLibraryBtn');
    els.brRuleLibraryFileInput = document.getElementById('brRuleLibraryFileInput');
    els.brRuleLibraryList = document.getElementById('brRuleLibraryList');
  }

  async function loadTestLibrary() {
    if (!els.testLibraryList) return;
    try {
      const res = await fetch('/api/unit-tests/files');
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(res.ok ? 'Invalid response from server' : `Server error (${res.status})`);
      }
      if (!res.ok) {
        const msg = data?.message || data?.error || `Server error (${res.status})`;
        throw new Error(msg);
      }
      if (!data.success || !Array.isArray(data.files)) {
        els.testLibraryList.innerHTML = '<p class="text-muted mb-0">No tests in library.</p>';
        return;
      }
      if (data.files.length === 0) {
        els.testLibraryList.innerHTML =
          '<p class="text-muted mb-0">No tests in library. Use "Save to Library" to add Excel files.</p>';
        return;
      }
      els.testLibraryList.innerHTML = data.files
        .map(
          (f) =>
            `<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
            <span class="text-truncate" style="max-width: 200px;" title="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}">${(f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
            <span class="text-muted small ml-2">${f.row_count || 0} rows, ${Array.isArray(f.field_ids) ? f.field_ids.length : 0} fields</span>
            <span class="ml-2">
              <button class="btn btn-sm btn-outline-primary load-from-library" data-id="${f.id}" data-name="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}" title="Load into grid"><i class="bi-folder2"></i> Load</button>
              <button class="btn btn-sm btn-outline-danger delete-from-library ml-1" data-id="${f.id}" title="Remove from library"><i class="bi-trash"></i></button>
            </span>
          </div>`,
        )
        .join('');
      els.testLibraryList.querySelectorAll('.load-from-library').forEach((btn) => {
        btn.addEventListener('click', () => loadFileFromLibrary(btn.dataset.id, btn.dataset.name));
      });
      els.testLibraryList.querySelectorAll('.delete-from-library').forEach((btn) => {
        btn.addEventListener('click', () => deleteFileFromLibrary(btn.dataset.id));
      });
    } catch (err) {
      const msg = err?.message || 'Failed to load library.';
      els.testLibraryList.innerHTML = `<p class="text-danger mb-0">${msg.replace(/</g, '&lt;')}</p><button class="btn btn-sm btn-outline-secondary mt-1" id="retryLoadLibrary">Retry</button>`;
      document.getElementById('retryLoadLibrary')?.addEventListener('click', () => loadTestLibrary());
    }
  }

  async function loadFileFromLibrary(id, originalName) {
    const btn = document.querySelector(`.load-from-library[data-id="${id}"]`);
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`/api/unit-tests/files/${id}`);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) {
        let errMsg = `Failed to load (${res.status})`;
        if (contentType.includes('application/json')) {
          try {
            const errData = await res.json();
            errMsg = errData?.message || errData?.error || errMsg;
          } catch (_) {}
        }
        throw new Error(errMsg);
      }
      if (
        !contentType.includes('spreadsheet') &&
        !contentType.includes('excel') &&
        !contentType.includes('octet-stream')
      ) {
        const text = await res.text();
        let errMsg = 'Server returned non-Excel response';
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed?.message || parsed?.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const file = new File([blob], originalName || 'unit-test.xlsx', {
        type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await handleFileUpload(file);
      showToast('Loaded from library', 'ok');
    } catch (err) {
      showToast(err?.message || 'Failed to load from library', 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteFileFromLibrary(id) {
    if (!confirm('Remove this test from the library?')) return;
    try {
      const res = await fetch(`/api/unit-tests/files/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await loadTestLibrary();
      if (els.fieldSearchResults && els.fieldSearchResults.style.display !== 'none') {
        const term = els.fieldIdSearchInput?.value?.trim();
        if (term) searchByFieldId(term);
      }
      showToast('Removed from library', 'ok');
    } catch (err) {
      showToast('Failed to remove', 'err');
    }
  }

  async function applyBrRulePayloadToGrid(sourceName, bodyText, sourceFormat) {
    if (!window.brRuleParser) {
      showToast('BR parser not loaded', 'err');
      return;
    }
    let metaLookup = {};
    try {
      metaLookup = await buildEncompassFieldMetadataLookupForUnitTests();
    } catch (_) {
      /* Hub offline — still load grid */
    }
    if (sourceFormat === 'tool8_field_matrix_json') {
      if (!window.tool8FieldMatrix) {
        showToast('Tool 8 parser not loaded', 'err');
        return;
      }
      const p = window.tool8FieldMatrix.parseTool8FieldMatrixJson(bodyText);
      if (p.error) {
        showToast(p.error, 'err');
        return;
      }
      const result = window.tool8FieldMatrix.generateUnitTestFromTool8FieldMatrix(p, {
        fieldMetadataLookup: metaLookup,
      });
      if (!result || !result.rows || result.rows.length === 0) {
        showToast('No rows from Tool 8 JSON', 'warn');
        return;
      }
      loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
        fieldId: '',
        calculation: '',
        description: 'Tool 8 (Alchemist) field matrix',
      });
      return;
    }
    if (sourceFormat === 'encompass_br_vb_snippet') {
      const parsed = window.brRuleParser.parseBRConditionSnippet(bodyText);
      if (parsed.error) {
        showToast(parsed.error, 'err');
        return;
      }
      const result = window.brRuleParser.generateUnitTestFromBRRule(parsed, { fieldMetadataLookup: metaLookup });
      if (!result || !result.rows || result.rows.length === 0) {
        showToast('No rows generated from VB snippet', 'warn');
        return;
      }
      loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
        fieldId: '',
        calculation: String(bodyText).slice(0, 400),
        description: 'BR VB snippet',
      });
      return;
    }
    const parsed = window.brRuleParser.parseBRXml(bodyText);
    if (parsed.error) {
      showToast(parsed.error, 'err');
      return;
    }
    const result = window.brRuleParser.generateUnitTestFromBRRule(parsed, { fieldMetadataLookup: metaLookup });
    if (!result || !result.rows || result.rows.length === 0) {
      showToast('No rows from BR XML (needs advanced conditions)', 'warn');
      return;
    }
    loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
      fieldId: '',
      calculation: parsed.mainCondition ? parsed.mainCondition.expression : '',
      description: 'BR Rule: ' + (parsed.rule ? parsed.rule.name : ''),
    });
  }

  async function loadBrRuleLibrary() {
    if (!els.brRuleLibraryList) return;
    try {
      const res = await fetch('/api/unit-tests/br-rules');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Server error (${res.status})`);
      }
      if (!data.success || !Array.isArray(data.files)) {
        els.brRuleLibraryList.innerHTML = '<p class="text-muted mb-0">No saved rules.</p>';
        return;
      }
      if (data.files.length === 0) {
        els.brRuleLibraryList.innerHTML =
          '<p class="text-muted mb-0">No BR / Tool 8 files yet. Use <strong>Save to BR library</strong> in Generate from BR Rule, or upload here.</p>';
        return;
      }
      const fmtLabel = (f) => {
        const s = f.source_format || '';
        if (s === 'tool8_field_matrix_json') return 'Tool 8';
        if (s === 'encompass_br_vb_snippet') return 'VB';
        return 'XML';
      };
      els.brRuleLibraryList.innerHTML = data.files
        .map((f) => {
          const title = (f.display_name || f.original_name || f.file_name || 'Untitled').replace(/"/g, '&quot;');
          const safeTitle = (f.display_name || f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;');
          const nf = Array.isArray(f.field_ids) ? f.field_ids.length : 0;
          return `<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
            <span class="text-truncate" style="max-width: 160px;" title="${title}">${safeTitle}</span>
            <span class="badge bg-secondary ms-1">${fmtLabel(f)}</span>
            <span class="text-muted small ms-1">${nf} fields</span>
            <span class="ms-2">
              <button type="button" class="btn btn-sm btn-outline-primary load-br-rule-library" data-id="${f.id}" data-title="${title}" title="Load into grid"><i class="bi-folder2"></i> Load</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-br-rule-library ms-1" data-id="${f.id}" title="Delete"><i class="bi-trash"></i></button>
            </span>
          </div>`;
        })
        .join('');
      els.brRuleLibraryList.querySelectorAll('.load-br-rule-library').forEach((btn) => {
        btn.addEventListener('click', () => loadBrRuleFromLibrary(btn.dataset.id, btn.dataset.title));
      });
      els.brRuleLibraryList.querySelectorAll('.delete-br-rule-library').forEach((btn) => {
        btn.addEventListener('click', () => deleteBrRuleFromLibrary(btn.dataset.id));
      });
    } catch (err) {
      const msg = err?.message || 'Failed to load BR library.';
      els.brRuleLibraryList.innerHTML = `<p class="text-danger mb-0">${String(msg).replace(/</g, '&lt;')}</p>`;
    }
  }

  async function loadBrRuleFromLibrary(id, displayTitle) {
    const btn = document.querySelector(`.load-br-rule-library[data-id="${id}"]`);
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`/api/unit-tests/br-rules/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      const f = data.file;
      if (!f || !f.body_text) throw new Error('Invalid response');
      const sourceName = 'Library: ' + (f.display_name || displayTitle || f.original_name || 'BR');
      await applyBrRulePayloadToGrid(sourceName, f.body_text, f.source_format);
      showToast('Loaded from BR library', 'ok');
    } catch (err) {
      showToast(err?.message || 'Failed to load rule', 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteBrRuleFromLibrary(id) {
    if (!confirm('Remove this business rule from the server library?')) return;
    try {
      const res = await fetch(`/api/unit-tests/br-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await loadBrRuleLibrary();
      if (els.fieldSearchResults && els.fieldSearchResults.style.display !== 'none') {
        const term = els.fieldIdSearchInput?.value?.trim();
        if (term) searchByFieldId(term);
      }
      showToast('Removed BR rule', 'ok');
    } catch (err) {
      showToast('Failed to remove', 'err');
    }
  }

  async function searchByFieldId(fieldId) {
    if (!fieldId || !els.fieldSearchResults || !els.fieldSearchTerm || !els.fieldSearchResultsList) return;
    try {
      const [resExcel, resBr, resCoverage] = await Promise.all([
        fetch(`/api/unit-tests/search?fieldId=${encodeURIComponent(fieldId)}`),
        fetch(`/api/unit-tests/br-rules/search?fieldId=${encodeURIComponent(fieldId)}`),
        fetch(`/api/unit-tests/coverage?fieldId=${encodeURIComponent(fieldId)}`),
      ]);
      const dataExcel = await resExcel.json();
      const dataBr = await resBr.json();
      const dataCoverage = resCoverage.ok ? await resCoverage.json() : null;

      els.fieldSearchResults.style.display = 'block';
      els.fieldSearchTerm.textContent = fieldId;

      const excelFiles = resExcel.ok && dataExcel.success && Array.isArray(dataExcel.files) ? dataExcel.files : [];
      const brFiles = resBr.ok && dataBr.success && Array.isArray(dataBr.files) ? dataBr.files : [];

      const coFields =
        dataCoverage?.success && Array.isArray(dataCoverage.coFields) ? dataCoverage.coFields : [];

      if (excelFiles.length === 0 && brFiles.length === 0) {
        let emptyMsg = '<p class="text-muted mb-0">No Excel tests or BR / Tool 8 rules reference this field.</p>';
        if (coFields.length) {
          emptyMsg += `<p class="small text-muted mb-0 mt-1">Related fields in library: ${coFields
            .slice(0, 12)
            .map((f) => `<code>${String(f).replace(/</g, '&lt;')}</code>`)
            .join(', ')}${coFields.length > 12 ? '…' : ''}</p>`;
        }
        els.fieldSearchResultsList.innerHTML = emptyMsg;
        return;
      }

      let html = '';
      if (coFields.length > 0) {
        html += `<div class="small text-muted mb-2">Also tested with: ${coFields
          .slice(0, 8)
          .map((f) => `<code>${String(f).replace(/</g, '&lt;')}</code>`)
          .join(', ')}${coFields.length > 8 ? ` (+${coFields.length - 8} more)` : ''}</div>`;
      }
      if (excelFiles.length > 0) {
        html += '<div class="small fw-bold mb-1">Excel unit tests</div>';
        html += excelFiles
          .map(
            (f) =>
              `<div class="d-flex justify-content-between align-items-center py-1">
              <span class="text-truncate" style="max-width: 180px;">${(f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
              <button type="button" class="btn btn-sm btn-outline-primary load-from-library" data-id="${f.id}" data-name="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}"><i class="bi-folder2"></i> Load</button>
            </div>`,
          )
          .join('');
      }
      if (brFiles.length > 0) {
        html += '<div class="small fw-bold mt-2 mb-1">BR / Tool 8</div>';
        html += brFiles
          .map(
            (f) =>
              `<div class="d-flex justify-content-between align-items-center py-1">
              <span class="text-truncate" style="max-width: 160px;">${(f.display_name || f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
              <button type="button" class="btn btn-sm btn-outline-primary load-br-rule-search" data-id="${f.id}" data-title="${(f.display_name || f.original_name || '').replace(/"/g, '&quot;')}"><i class="bi-folder2"></i> Load</button>
            </div>`,
          )
          .join('');
      }
      els.fieldSearchResultsList.innerHTML = html;
      els.fieldSearchResultsList.querySelectorAll('.load-from-library').forEach((btn) => {
        btn.addEventListener('click', () => loadFileFromLibrary(btn.dataset.id, btn.dataset.name));
      });
      els.fieldSearchResultsList.querySelectorAll('.load-br-rule-search').forEach((btn) => {
        btn.addEventListener('click', () => loadBrRuleFromLibrary(btn.dataset.id, btn.dataset.title));
      });
    } catch (err) {
      els.fieldSearchResults.style.display = 'block';
      els.fieldSearchTerm.textContent = fieldId;
      els.fieldSearchResultsList.innerHTML = '<p class="text-danger mb-0">Search failed.</p>';
    }
  }

  function wireEventListeners() {
    els.uploadToLibraryBtn?.addEventListener('click', () => {
      els.libraryFileInput?.click();
    });

    els.libraryFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/unit-tests/files', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Upload failed');
        await loadTestLibrary();
        showToast('Saved to library', 'ok');
      } catch (err) {
        showToast(err.message || 'Failed to save to library', 'err');
      }
    });

    els.uploadBrRuleLibraryBtn?.addEventListener('click', () => {
      els.brRuleLibraryFileInput?.click();
    });

    els.brRuleLibraryFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/unit-tests/br-rules/file', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || data.message || 'Upload failed');
        await loadBrRuleLibrary();
        showToast('Saved BR / Tool 8 to library', 'ok');
      } catch (err) {
        showToast(err.message || 'Failed to upload rule', 'err');
      }
    });

    els.fieldIdSearchBtn?.addEventListener('click', () => {
      const term = els.fieldIdSearchInput?.value?.trim();
      if (term) searchByFieldId(term);
    });

    els.fieldIdSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const term = els.fieldIdSearchInput?.value?.trim();
        if (term) searchByFieldId(term);
      }
    });
  }

  function init(deps) {
    if (deps) {
      if (typeof deps.showToast === 'function') showToast = deps.showToast;
      if (typeof deps.handleFileUpload === 'function') handleFileUpload = deps.handleFileUpload;
      if (typeof deps.loadGeneratedTestData === 'function') loadGeneratedTestData = deps.loadGeneratedTestData;
      if (typeof deps.buildEncompassFieldMetadataLookupForUnitTests === 'function') {
        buildEncompassFieldMetadataLookupForUnitTests = deps.buildEncompassFieldMetadataLookupForUnitTests;
      }
    }
    cacheElements();
    wireEventListeners();
  }

  window.unitTestsLibrary = {
    init,
    loadTestLibrary,
    loadBrRuleLibrary,
    searchByFieldId,
    applyBrRulePayloadToGrid,
  };
})();
