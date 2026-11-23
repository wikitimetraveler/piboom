/**
 * Governor Disaster Declarations — editable list UI
 * Development work by David Lane
 */
(function () {
  'use strict';

  const API = '/api/governor-declarations';

  const KIND_LABELS = {
    governor_order: 'Governor order',
    federal_dr: 'Federal DR',
    federal_em: 'Federal EM',
    federal_fm: 'Fire FM',
  };

  const els = {
    since: document.getElementById('gdSince'),
    state: document.getElementById('gdState'),
    kind: document.getElementById('gdKind'),
    status: document.getElementById('gdStatus'),
    tbody: document.getElementById('gdTableBody'),
    refreshBtn: document.getElementById('gdRefreshBtn'),
    syncBtn: document.getElementById('gdSyncBtn'),
    addBtn: document.getElementById('gdAddBtn'),
    form: document.getElementById('gdEditForm'),
    modalLabel: document.getElementById('gdEditModalLabel'),
    editId: document.getElementById('gdEditId'),
    editKind: document.getElementById('gdEditKind'),
    editState: document.getElementById('gdEditState'),
    editDeclared: document.getElementById('gdEditDeclared'),
    editDeclId: document.getElementById('gdEditDeclId'),
    editBegin: document.getElementById('gdEditBegin'),
    editTitle: document.getElementById('gdEditTitle'),
    editAreas: document.getElementById('gdEditAreas'),
    editSource: document.getElementById('gdEditSource'),
    editNotes: document.getElementById('gdEditNotes'),
    editError: document.getElementById('gdEditError'),
    saveBtn: document.getElementById('gdSaveBtn'),
  };

  const modalEl = document.getElementById('gdEditModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  /** @type {Map<string, object>} */
  const byId = new Map();

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function threeMonthsAgoIso() {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('text-danger', Boolean(isError));
  }

  function queryParams() {
    const params = new URLSearchParams();
    const since = (els.since?.value || '').trim();
    if (since) params.set('since', since);
    const state = (els.state?.value || '').trim().toUpperCase();
    if (state) params.set('state', state);
    const kind = (els.kind?.value || '').trim();
    if (kind) params.set('kind', kind);
    return params;
  }

  async function loadList() {
    setStatus('Loading…');
    try {
      const res = await fetch(`${API}?${queryParams().toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      byId.clear();
      for (const row of data.declarations || []) byId.set(row.id, row);
      renderRows(data.declarations || []);
      setStatus(`${data.count} declaration${data.count === 1 ? '' : 's'}`);
    } catch (err) {
      byId.clear();
      renderRows([]);
      setStatus(err.message || 'Load failed', true);
    }
  }

  function renderRows(rows) {
    if (!els.tbody) return;
    if (!rows.length) {
      els.tbody.innerHTML =
        '<tr><td colspan="8" class="text-muted text-center py-4">No declarations match these filters.</td></tr>';
      return;
    }
    els.tbody.innerHTML = rows
      .map((r) => {
        const kind = KIND_LABELS[r.kind] || r.kind;
        const idCell = r.declarationId
          ? r.sourceUrl
            ? `<a href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.declarationId)}</a>`
            : escapeHtml(r.declarationId)
          : '—';
        const areas = r.areaSummary
          ? `<span title="${escapeHtml(r.areaSummary)}">${escapeHtml(r.areaSummary.length > 48 ? `${r.areaSummary.slice(0, 48)}…` : r.areaSummary)}</span>`
          : '—';
        return `<tr data-id="${escapeHtml(r.id)}">
          <td>${escapeHtml(r.declaredDate || '—')}</td>
          <td>${escapeHtml(r.state || '—')}</td>
          <td><span class="badge text-bg-secondary">${escapeHtml(kind)}</span></td>
          <td>${idCell}</td>
          <td>${escapeHtml(r.incidentTitle || '—')}</td>
          <td>${escapeHtml(r.incidentBeginDate || '—')}</td>
          <td class="small">${areas}</td>
          <td class="text-end text-nowrap">
            <button type="button" class="btn btn-outline-primary btn-sm gd-edit" data-id="${escapeHtml(r.id)}" title="Edit"><i class="bi-pencil"></i></button>
            <button type="button" class="btn btn-outline-danger btn-sm gd-del" data-id="${escapeHtml(r.id)}" title="Delete"><i class="bi-trash"></i></button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function openModal(row) {
    if (!modal) return;
    els.editError?.classList.add('d-none');
    if (els.editError) els.editError.textContent = '';
    if (row) {
      els.modalLabel.textContent = 'Edit declaration';
      els.editId.value = row.id;
      els.editKind.value = row.kind;
      els.editState.value = row.state || '';
      els.editDeclared.value = row.declaredDate || '';
      els.editDeclId.value = row.declarationId || '';
      els.editBegin.value = row.incidentBeginDate || '';
      els.editTitle.value = row.incidentTitle || '';
      els.editAreas.value = row.areaSummary || '';
      els.editSource.value = row.sourceUrl || '';
      els.editNotes.value = row.notes || '';
    } else {
      els.modalLabel.textContent = 'Add declaration';
      els.editId.value = '';
      els.editKind.value = 'governor_order';
      els.editState.value = '';
      els.editDeclared.value = '';
      els.editDeclId.value = '';
      els.editBegin.value = '';
      els.editTitle.value = '';
      els.editAreas.value = '';
      els.editSource.value = '';
      els.editNotes.value = '';
    }
    modal.show();
  }

  function formPayload() {
    return {
      kind: els.editKind.value,
      state: (els.editState.value || '').trim().toUpperCase(),
      declaredDate: els.editDeclared.value,
      declarationId: (els.editDeclId.value || '').trim() || null,
      incidentBeginDate: els.editBegin.value || null,
      incidentTitle: (els.editTitle.value || '').trim(),
      areaSummary: (els.editAreas.value || '').trim() || null,
      sourceUrl: (els.editSource.value || '').trim() || null,
      notes: (els.editNotes.value || '').trim() || null,
    };
  }

  async function saveForm(ev) {
    ev.preventDefault();
    els.editError?.classList.add('d-none');
    const id = els.editId.value;
    const payload = formPayload();
    els.saveBtn.disabled = true;
    try {
      const res = await fetch(id ? `${API}/${encodeURIComponent(id)}` : API, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      modal?.hide();
      await loadList();
    } catch (err) {
      if (els.editError) {
        els.editError.textContent = err.message || 'Save failed';
        els.editError.classList.remove('d-none');
      }
    } finally {
      els.saveBtn.disabled = false;
    }
  }

  async function deleteRow(id) {
    const row = byId.get(id);
    const label = row?.declarationId || row?.incidentTitle || id;
    if (!window.confirm(`Delete declaration “${label}”?`)) return;
    try {
      const res = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      await loadList();
    } catch (err) {
      setStatus(err.message || 'Delete failed', true);
    }
  }

  els.tbody?.addEventListener('click', (ev) => {
    const editBtn = ev.target.closest('.gd-edit');
    if (editBtn) {
      openModal(byId.get(editBtn.dataset.id));
      return;
    }
    const delBtn = ev.target.closest('.gd-del');
    if (delBtn) deleteRow(delBtn.dataset.id);
  });

  async function syncOpenFema() {
    setStatus('Syncing live OpenFEMA…');
    if (els.syncBtn) els.syncBtn.disabled = true;
    try {
      const res = await fetch(`${API}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const r = data.result || {};
      setStatus(
        `OpenFEMA sync: ${r.unique ?? 0} declarations (inserted ${r.inserted ?? 0}, updated ${r.updated ?? 0}, removed ${r.removed ?? 0})`
      );
      await loadList();
    } catch (err) {
      setStatus(err.message || 'OpenFEMA sync failed', true);
    } finally {
      if (els.syncBtn) els.syncBtn.disabled = false;
    }
  }

  els.refreshBtn?.addEventListener('click', () => loadList());
  els.syncBtn?.addEventListener('click', () => syncOpenFema());
  els.addBtn?.addEventListener('click', () => openModal(null));
  els.form?.addEventListener('submit', saveForm);
  els.since?.addEventListener('change', () => loadList());
  els.kind?.addEventListener('change', () => loadList());
  els.state?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      loadList();
    }
  });

  if (els.since && !els.since.value) {
    els.since.value = threeMonthsAgoIso();
  }
  loadList();
})();
