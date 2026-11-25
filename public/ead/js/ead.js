/**
 * FHA EAD 3.6 appraisal ZIP viewer.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const els = {
    drop: document.getElementById('eadDropZone'),
    input: document.getElementById('eadFileInput'),
    status: document.getElementById('eadStatus'),
    limits: document.getElementById('eadLimitsMeta'),
    results: document.getElementById('eadResults'),
    summary: document.getElementById('eadSummary'),
    findings: document.getElementById('eadFindings'),
    findingsEmpty: document.getElementById('eadFindingsEmpty'),
    photos: document.getElementById('eadPhotos'),
    photosEmpty: document.getElementById('eadPhotosEmpty'),
    pdf: document.getElementById('eadPdf'),
    pdfEmpty: document.getElementById('eadPdfEmpty'),
    pdfLink: document.getElementById('eadPdfLink'),
    sampleSelect: document.getElementById('eadSampleSelect'),
    sampleLoadBtn: document.getElementById('eadSampleLoadBtn'),
    sampleHint: document.getElementById('eadSampleHint'),
  };

  function setStatus(message, kind) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.remove('is-error', 'is-ok');
    if (kind === 'error') els.status.classList.add('is-error');
    if (kind === 'ok') els.status.classList.add('is-ok');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function field(label, value) {
    const v = value == null || value === '' ? '—' : String(value);
    return (
      '<div class="ead-field">' +
      '<span class="ead-field-label">' +
      esc(label) +
      '</span>' +
      '<div class="ead-field-value">' +
      esc(v) +
      '</div></div>'
    );
  }

  function renderSummary(summary, pkg) {
    if (!els.summary) return;
    if (!summary) {
      els.summary.innerHTML = '<p class="ead-empty">No summary — fix fatal findings and try again.</p>';
      return;
    }
    els.summary.innerHTML =
      '<div class="ead-summary-grid">' +
      field('Document type', summary.documentType) +
      field('Subject', summary.subjectAddress) +
      field('Opinion of value', summary.opinionOfValue) +
      field('Market value condition', summary.marketValueCondition) +
      field('Effective date', summary.effectiveDate) +
      field('Appraiser', summary.appraiserName) +
      field('Borrower', summary.borrowerName) +
      field('XML', summary.xmlFileName) +
      field('PDF', summary.pdfFileName) +
      field(
        'Images in ZIP',
        pkg ? String(pkg.imageCount) : summary.imageCount != null ? String(summary.imageCount) : '—'
      ) +
      '</div>';
  }

  function renderFindings(findings) {
    if (!els.findings || !els.findingsEmpty) return;
    const list = Array.isArray(findings) ? findings : [];
    if (!list.length) {
      els.findings.hidden = true;
      els.findings.innerHTML = '';
      els.findingsEmpty.hidden = false;
      return;
    }
    els.findingsEmpty.hidden = true;
    els.findings.hidden = false;
    els.findings.innerHTML = list
      .map(function (f) {
        const sev = f.severity === 'Warning' ? 'Warning' : 'Fatal';
        return (
          '<li class="sev-' +
          sev +
          '"><span class="code">' +
          esc(f.code) +
          '</span>' +
          esc(f.message) +
          '</li>'
        );
      })
      .join('');
  }

  const NOTES_KEY = 'eadPhotoNotes:v1';
  let photoNotePackageKey = 'anon';

  function readAllNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function noteStorageId(img) {
    return photoNotePackageKey + '::' + (img.zipPath || img.location || img.name || img.id || '');
  }

  function getNote(img) {
    const all = readAllNotes();
    return all[noteStorageId(img)] || '';
  }

  function saveNote(img, text) {
    const all = readAllNotes();
    const id = noteStorageId(img);
    const trimmed = String(text || '');
    if (!trimmed) delete all[id];
    else all[id] = trimmed;
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  }

  function metaRows(img) {
    const rows = [
      ['Title', img.displayTitle || img.caption || img.category || img.name],
      ['Category', img.category],
      ['Caption', img.caption],
      ['Room', img.roomType],
      ['Level', img.levelType],
      ['Section', img.section],
      ['File', img.name || img.zipPath],
      ['Path', img.location],
      ['MIME', img.mime],
      ['Size', img.bytes ? Math.round(img.bytes / 1024) + ' KB' : ''],
    ];
    return rows.filter(function (r) {
      return r[1] != null && String(r[1]).trim() !== '';
    });
  }

  function renderPhotos(images, packageKey) {
    if (!els.photos || !els.photosEmpty) return;
    const list = Array.isArray(images) ? images : [];
    photoNotePackageKey = packageKey || 'anon';
    if (!list.length) {
      els.photos.innerHTML = '';
      els.photos.hidden = true;
      els.photosEmpty.hidden = false;
      return;
    }
    els.photosEmpty.hidden = true;
    els.photos.hidden = false;
    els.photos.innerHTML = list
      .map(function (img, index) {
        const title = img.displayTitle || img.caption || img.category || img.name || 'Photo';
        const note = getNote(img);
        const rows = metaRows(img)
          .map(function (r) {
            return (
              '<li><span class="k">' +
              esc(r[0]) +
              '</span><span class="v">' +
              esc(r[1]) +
              '</span></li>'
            );
          })
          .join('');
        return (
          '<article class="ead-flip" tabindex="0" role="button" data-flip-index="' +
          index +
          '" aria-pressed="false" aria-label="Flip photo card: ' +
          esc(title) +
          '">' +
          '<div class="ead-flip-inner">' +
          '<div class="ead-flip-face ead-flip-front">' +
          '<img src="' +
          esc(img.url) +
          '" alt="' +
          esc(title) +
          '" loading="lazy" />' +
          '<div class="ead-flip-front-bar">' +
          '<span class="ead-flip-front-title">' +
          esc(title) +
          '</span>' +
          '<span class="ead-flip-hint">Flip for details</span>' +
          '</div></div>' +
          '<div class="ead-flip-face ead-flip-back">' +
          '<h3>' +
          esc(title) +
          '</h3>' +
          '<ul class="ead-flip-meta">' +
          rows +
          '</ul>' +
          '<p class="ead-flip-note-label">Your note</p>' +
          '<textarea class="ead-flip-note" data-note-for="' +
          esc(noteStorageId(img)) +
          '" rows="3" placeholder="Add a note for this photo…">' +
          esc(note) +
          '</textarea>' +
          '<div class="ead-flip-note-status" aria-live="polite"></div>' +
          '</div></div></article>'
        );
      })
      .join('');

    bindFlipCards(list);
  }

  function bindFlipCards(list) {
    const cards = els.photos.querySelectorAll('.ead-flip');
    cards.forEach(function (card, index) {
      const img = list[index];
      function toggle() {
        const on = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      card.addEventListener('click', function (ev) {
        if (ev.target.closest('.ead-flip-note')) return;
        toggle();
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.target.closest('.ead-flip-note')) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggle();
        }
      });
      const ta = card.querySelector('.ead-flip-note');
      const status = card.querySelector('.ead-flip-note-status');
      if (!ta || !img) return;
      let timer = null;
      ta.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });
      ta.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
      });
      ta.addEventListener('input', function () {
        if (status) status.textContent = 'Saving…';
        clearTimeout(timer);
        timer = setTimeout(function () {
          saveNote(img, ta.value);
          if (status) status.textContent = 'Saved';
        }, 250);
      });
    });
  }

  function renderPdf(pdf) {
    if (!els.pdf || !els.pdfEmpty || !els.pdfLink) return;
    if (!pdf || !pdf.url) {
      els.pdf.hidden = true;
      els.pdf.removeAttribute('src');
      els.pdfLink.hidden = true;
      els.pdfEmpty.hidden = false;
      return;
    }
    els.pdfEmpty.hidden = true;
    els.pdf.hidden = false;
    els.pdf.src = pdf.url;
    els.pdfLink.hidden = false;
    els.pdfLink.href = pdf.url;
  }

  function applyParseResult(data, label) {
    if (els.results) els.results.hidden = false;
    renderSummary(data.summary, data.package);
    renderFindings(data.findings);
    const packageKey =
      (data.sample && data.sample.fileName) ||
      data.originalName ||
      (data.summary && data.summary.xmlFileName) ||
      label ||
      'package';
    renderPhotos(data.images, packageKey);
    renderPdf(data.pdf);
    const fatal = (data.findings || []).filter(function (f) {
      return f.severity !== 'Warning';
    }).length;
    const warn = (data.findings || []).length - fatal;
    const name = label || (data.sample && data.sample.fileName) || data.originalName || 'ZIP';
    if (data.ok) {
      setStatus(
        'Package OK' + (warn ? ' · ' + warn + ' warning(s)' : '') + ' — ' + name,
        'ok'
      );
    } else {
      setStatus(
        'Parsed with ' + fatal + ' fatal finding(s)' + (warn ? ' and ' + warn + ' warning(s)' : '') + ' — ' + name,
        'error'
      );
    }
  }

  async function loadMeta() {
    try {
      const res = await fetch('/api/ead/meta');
      const data = await res.json();
      if (data && data.maxMb && els.limits) {
        els.limits.textContent = 'One .zip · up to ' + data.maxMb + ' MB · XML + PDF + Images/';
      }
    } catch {
      /* keep default label */
    }
  }

  function formatMb(bytes) {
    if (!bytes) return '';
    return (bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2) + ' MB';
  }

  async function loadSampleCatalog() {
    if (!els.sampleSelect || !els.sampleLoadBtn) return;
    try {
      const res = await fetch('/api/ead/samples');
      const data = await res.json();
      const samples = (data && data.samples) || [];
      els.sampleSelect.innerHTML = '';
      if (!samples.length) {
        els.sampleSelect.disabled = true;
        els.sampleLoadBtn.disabled = true;
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No local samples — see docs/EAD.md';
        els.sampleSelect.appendChild(opt);
        if (els.sampleHint) {
          els.sampleHint.innerHTML =
            'Copy Appendix D-1 nested <code>*_Appraisal.zip</code> files into <code>fixtures/ead/appendix-d-1/</code>, then refresh.';
        }
        return;
      }
      samples.forEach(function (s) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.label + (s.bytes ? ' (' + formatMb(s.bytes) + ')' : '');
        if (s.recommended) opt.selected = true;
        els.sampleSelect.appendChild(opt);
      });
      if (![...els.sampleSelect.options].some(function (o) { return o.selected && o.value; })) {
        els.sampleSelect.selectedIndex = 0;
      }
      els.sampleSelect.disabled = false;
      els.sampleLoadBtn.disabled = false;
      if (els.sampleHint) {
        els.sampleHint.textContent =
          samples.length +
          ' GSE scenario' +
          (samples.length === 1 ? '' : 's') +
          ' ready. SF5 is the typical single-family pick.';
      }
    } catch (err) {
      els.sampleSelect.disabled = true;
      els.sampleLoadBtn.disabled = true;
      els.sampleSelect.innerHTML = '<option value="">Samples unavailable</option>';
      setStatus(err.message || 'Could not load sample list', 'error');
    }
  }

  async function loadSelectedSample() {
    const id = els.sampleSelect && els.sampleSelect.value;
    if (!id) {
      setStatus('Pick a scenario from the dropdown.', 'error');
      return;
    }
    const label =
      (els.sampleSelect.options[els.sampleSelect.selectedIndex] &&
        els.sampleSelect.options[els.sampleSelect.selectedIndex].textContent) ||
      id;
    setStatus('Parsing ' + label + '…');
    if (els.results) els.results.hidden = true;
    els.sampleLoadBtn.disabled = true;
    try {
      const res = await fetch('/api/ead/samples/' + encodeURIComponent(id) + '/parse', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(data.error || 'Sample parse failed', 'error');
        return;
      }
      applyParseResult(data, label);
    } catch (err) {
      setStatus(err.message || 'Network error', 'error');
    } finally {
      els.sampleLoadBtn.disabled = !els.sampleSelect || !els.sampleSelect.value;
    }
  }

  async function uploadZip(file) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setStatus('Choose a .zip appraisal package.', 'error');
      return;
    }
    setStatus('Parsing ' + file.name + '…');
    if (els.results) els.results.hidden = true;

    const body = new FormData();
    body.append('file', file, file.name);

    try {
      const res = await fetch('/api/ead/parse', { method: 'POST', body: body });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(data.error || 'Parse failed', 'error');
        return;
      }
      applyParseResult(data, file.name);
    } catch (err) {
      setStatus(err.message || 'Network error', 'error');
    }
  }

  function bindDrop() {
    if (!els.drop || !els.input) return;

    els.drop.addEventListener('click', function () {
      els.input.click();
    });
    els.drop.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        els.input.click();
      }
    });
    els.input.addEventListener('change', function () {
      const file = els.input.files && els.input.files[0];
      uploadZip(file);
      els.input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (evt) {
      els.drop.addEventListener(evt, function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        els.drop.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      els.drop.addEventListener(evt, function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        els.drop.classList.remove('is-dragover');
      });
    });
    els.drop.addEventListener('drop', function (ev) {
      const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      uploadZip(file);
    });
  }

  function bindSamples() {
    if (els.sampleLoadBtn) {
      els.sampleLoadBtn.addEventListener('click', function () {
        loadSelectedSample();
      });
    }
    if (els.sampleSelect) {
      els.sampleSelect.addEventListener('change', function () {
        els.sampleLoadBtn.disabled = !els.sampleSelect.value;
      });
    }
  }

  loadMeta();
  loadSampleCatalog();
  bindDrop();
  bindSamples();
})();
