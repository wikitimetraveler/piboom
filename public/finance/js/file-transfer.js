/**
 * File Transfer UI — upload / list / download / delete
 * Development work by David Lane
 */
(() => {
  'use strict';

  const API = '/api/file-transfer';
  const els = {
    status: document.getElementById('ftStatus'),
    drop: document.getElementById('ftDropZone'),
    input: document.getElementById('ftFileInput'),
    note: document.getElementById('ftNote'),
    uploadBtn: document.getElementById('ftUploadBtn'),
    pending: document.getElementById('ftPendingList'),
    tbody: document.getElementById('ftFileTableBody'),
    refresh: document.getElementById('ftRefreshBtn'),
    limits: document.getElementById('ftLimitsMeta'),
  };

  /** @type {File[]} */
  let pending = [];

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || '';
    els.status.classList.remove('is-ok', 'is-err');
    if (kind === 'ok') els.status.classList.add('is-ok');
    if (kind === 'err') els.status.classList.add('is-err');
  }

  function formatBytes(n) {
    const bytes = Number(n) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatWhen(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return iso;
    }
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPending() {
    if (!els.pending || !els.uploadBtn) return;
    if (!pending.length) {
      els.pending.hidden = true;
      els.pending.innerHTML = '';
      els.uploadBtn.disabled = true;
      return;
    }
    els.pending.hidden = false;
    els.pending.innerHTML = pending
      .map(
        (f, i) =>
          `<li>
            <span class="ft-pending-name" title="${esc(f.name)}">${esc(f.name)} · ${formatBytes(f.size)}</span>
            <button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove="${i}" aria-label="Remove">Remove</button>
          </li>`
      )
      .join('');
    els.uploadBtn.disabled = false;
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    pending = pending.concat(files);
    renderPending();
    setStatus(`${pending.length} file(s) ready to upload.`, 'ok');
  }

  function kindClass(kind) {
    if (kind === 'spreadsheet') return 'ft-kind ft-kind--spreadsheet';
    if (kind === 'archive') return 'ft-kind ft-kind--archive';
    return 'ft-kind';
  }

  async function loadList() {
    if (!els.tbody) return;
    try {
      const res = await fetch(`${API}/files`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not load files');
      }
      const files = data.files || [];
      if (!files.length) {
        els.tbody.innerHTML =
          '<tr><td colspan="6" class="ft-empty">No files yet — drop a doc or spreadsheet above.</td></tr>';
        return;
      }
      els.tbody.innerHTML = files
        .map(
          (f) => `<tr>
            <td><strong title="${esc(f.originalName)}">${esc(f.originalName)}</strong></td>
            <td><span class="${kindClass(f.kind)}">${esc(f.kind || 'file')}</span></td>
            <td>${formatBytes(f.bytes)}</td>
            <td>${esc(formatWhen(f.createdAt))}</td>
            <td class="text-muted small">${esc(f.note || '—')}</td>
            <td class="text-end text-nowrap">
              <a class="btn btn-sm btn-outline-primary" href="${API}/files/${encodeURIComponent(f.id)}" download="${esc(f.originalName)}">
                <i class="bi-download"></i>
              </a>
              <button type="button" class="btn btn-sm btn-outline-danger" data-delete="${esc(f.id)}" title="Delete">
                <i class="bi-trash"></i>
              </button>
            </td>
          </tr>`
        )
        .join('');
    } catch (err) {
      els.tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${esc(err.message || 'Load failed')}</td></tr>`;
      setStatus(err.message || 'Load failed', 'err');
    }
  }

  async function uploadAll() {
    if (!pending.length) return;
    els.uploadBtn.disabled = true;
    const note = (els.note?.value || '').trim();
    let ok = 0;
    let fail = 0;
    for (const file of pending) {
      const form = new FormData();
      form.append('file', file, file.name);
      if (note) form.append('note', note);
      try {
        const res = await fetch(`${API}/files`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const detail =
            data.error ||
            (res.status === 413
              ? 'File too large for the server/proxy (413).'
              : `Upload failed for ${file.name} (HTTP ${res.status})`);
          throw new Error(detail);
        }
        ok += 1;
      } catch (err) {
        fail += 1;
        setStatus(err.message || 'Upload failed', 'err');
      }
    }
    pending = [];
    renderPending();
    if (els.note) els.note.value = '';
    await loadList();
    if (ok && !fail) setStatus(`Uploaded ${ok} file(s).`, 'ok');
    else if (ok && fail) setStatus(`Uploaded ${ok}; ${fail} failed.`, 'err');
    else if (!ok) setStatus('Upload failed.', 'err');
  }

  async function deleteFile(id) {
    if (!id || !window.confirm('Delete this file from the server?')) return;
    try {
      const res = await fetch(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Delete failed');
      }
      setStatus('Deleted.', 'ok');
      await loadList();
    } catch (err) {
      setStatus(err.message || 'Delete failed', 'err');
    }
  }

  async function loadMeta() {
    try {
      const res = await fetch(`${API}/meta`);
      const data = await res.json();
      if (!res.ok || !data.success || !els.limits) return;
      const mb = Math.round((data.maxFileBytes || 0) / (1024 * 1024));
      const exts = (data.allowedExtensions || []).join(' ');
      els.limits.textContent = `${exts} · up to ${mb} MB each`;
    } catch (_) {
      /* keep default label */
    }
  }

  function wireDrop() {
    if (!els.drop || !els.input) return;

    const openPicker = () => els.input.click();
    els.drop.addEventListener('click', openPicker);
    els.drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });
    els.input.addEventListener('change', () => {
      addFiles(els.input.files);
      els.input.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      els.drop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.drop.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      els.drop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.drop.classList.remove('is-dragover');
      });
    });
    els.drop.addEventListener('drop', (e) => {
      addFiles(e.dataTransfer?.files);
    });
  }

  function wireActions() {
    els.uploadBtn?.addEventListener('click', () => uploadAll());
    els.refresh?.addEventListener('click', () => {
      loadList();
      setStatus('Refreshed.', 'ok');
    });
    els.pending?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      const i = Number(btn.getAttribute('data-remove'));
      if (!Number.isFinite(i)) return;
      pending.splice(i, 1);
      renderPending();
    });
    els.tbody?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delete]');
      if (!btn) return;
      deleteFile(btn.getAttribute('data-delete'));
    });
  }

  wireDrop();
  wireActions();
  loadMeta();
  loadList();
})();
