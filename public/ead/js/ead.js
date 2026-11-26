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
    browse: document.getElementById('eadBrowseBtn'),
    photoFilters: document.getElementById('eadPhotoFilters'),
    salesMap: document.getElementById('eadSalesMap'),
    salesList: document.getElementById('eadSalesList'),
    salesLegend: document.getElementById('eadSalesLegend'),
    salesEmpty: document.getElementById('eadSalesEmpty'),
    expertLog: document.getElementById('eadExpertLog'),
    expertForm: document.getElementById('eadExpertForm'),
    expertInput: document.getElementById('eadExpertInput'),
    expertSend: document.getElementById('eadExpertSend'),
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
  const EDITS_KEY = 'eadPhotoEdits:v1';
  let photoCategories = [];
  let photoNotePackageKey = 'anon';
  let photoFilter = 'all';
  let lastPackage = null;
  let expertHistory = [];

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

  function readEdits() {
    try {
      return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function photoEdit(img) {
    const id = noteStorageId(img);
    const stored = readEdits()[id] || {};
    const legacy = readAllNotes()[id] || '';
    return {
      group: stored.group || img.uadCategory || img.group || 'Uncategorized',
      note: stored.note != null ? stored.note : legacy,
    };
  }

  function saveEdit(img, patch) {
    const all = readEdits();
    const id = noteStorageId(img);
    const prev = photoEdit(img);
    const next = {
      group: patch.group != null ? patch.group : prev.group,
      note: patch.note != null ? patch.note : prev.note,
    };
    if ((!next.note || !String(next.note).trim()) && next.group === (img.uadCategory || img.group || 'Uncategorized')) {
      delete all[id];
    } else {
      all[id] = next;
    }
    localStorage.setItem(EDITS_KEY, JSON.stringify(all));
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

  function uadLabel(id) {
    return String(id || 'Uncategorized')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  }

  function categoryChoices(selected) {
    const rows = photoCategories.slice();
    if (selected && !rows.some(function (row) { return row.id === selected; })) {
      rows.unshift({ id: selected, section: 'Current', label: uadLabel(selected) });
    }
    return rows;
  }

  function groupOptions(selected) {
    const rows = categoryChoices(selected);
    if (!rows.length) {
      return '<option value="' + esc(selected || 'Uncategorized') + '" selected>' + esc(uadLabel(selected)) + '</option>';
    }
    const sections = [];
    const bySection = {};
    rows.forEach(function (row) {
      const section = row.section || 'UAD';
      if (!bySection[section]) {
        bySection[section] = [];
        sections.push(section);
      }
      bySection[section].push(row);
    });
    return sections
      .map(function (section) {
        const options = bySection[section]
          .map(function (row) {
            const id = row.id;
            return (
              '<option value="' +
              esc(id) +
              '"' +
              (id === selected ? ' selected' : '') +
              '>' +
              esc(row.label || uadLabel(id)) +
              '</option>'
            );
          })
          .join('');
        return '<optgroup label="' + esc(section) + '">' + options + '</optgroup>';
      })
      .join('');
  }

  function applyPhotoFilter() {
    if (!els.photos) return;
    els.photos.querySelectorAll('.ead-flip').forEach(function (card) {
      const show = photoFilter === 'all' || card.getAttribute('data-group') === photoFilter;
      card.hidden = !show;
    });
    if (!els.photoFilters) return;
    els.photoFilters.querySelectorAll('[data-photo-filter]').forEach(function (btn) {
      const on = btn.getAttribute('data-photo-filter') === photoFilter;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function refreshFilterCounts() {
    if (!els.photos || !els.photoFilters) return;
    const counts = {};
    let total = 0;
    els.photos.querySelectorAll('.ead-flip').forEach(function (card) {
      total += 1;
      const group = card.getAttribute('data-group') || 'Uncategorized';
      counts[group] = (counts[group] || 0) + 1;
    });
    const chips = [{ id: 'all', label: 'All ' + total }].concat(
      Object.keys(counts).map(function (name) {
        return { id: name, label: uadLabel(name) + ' ' + counts[name] };
      })
    );
    if (!counts[photoFilter]) photoFilter = 'all';
    els.photoFilters.innerHTML = chips
      .map(function (chip) {
        return (
          '<button type="button" class="ead-photo-chip" data-photo-filter="' +
          esc(chip.id) +
          '">' +
          esc(chip.label) +
          '</button>'
        );
      })
      .join('');
    els.photoFilters.querySelectorAll('[data-photo-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        photoFilter = btn.getAttribute('data-photo-filter') || 'all';
        applyPhotoFilter();
      });
    });
    applyPhotoFilter();
  }

  function renderPhotoFilters(list) {
    if (!els.photoFilters) return;
    const counts = { all: list.length };
    list.forEach(function (img) {
      const group = photoEdit(img).group;
      counts[group] = (counts[group] || 0) + 1;
    });
    const chips = [{ id: 'all', label: 'All ' + counts.all }].concat(
      Object.keys(counts)
        .filter(function (name) {
          return name !== 'all' && counts[name];
        })
        .map(function (name) {
          return { id: name, label: uadLabel(name) + ' ' + counts[name] };
        })
    );
    els.photoFilters.hidden = false;
    els.photoFilters.innerHTML = chips
      .map(function (chip) {
        return (
          '<button type="button" class="ead-photo-chip" data-photo-filter="' +
          esc(chip.id) +
          '">' +
          esc(chip.label) +
          '</button>'
        );
      })
      .join('');
    els.photoFilters.querySelectorAll('[data-photo-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        photoFilter = btn.getAttribute('data-photo-filter') || 'all';
        applyPhotoFilter();
      });
    });
    applyPhotoFilter();
  }

  function renderPhotos(images, packageKey) {
    if (!els.photos || !els.photosEmpty) return;
    const list = Array.isArray(images) ? images : [];
    photoNotePackageKey = packageKey || 'anon';
    if (!list.length) {
      els.photos.innerHTML = '';
      els.photos.hidden = true;
      els.photosEmpty.hidden = false;
      if (els.photoFilters) els.photoFilters.hidden = true;
      return;
    }
    els.photosEmpty.hidden = true;
    els.photos.hidden = false;
    els.photos.innerHTML = list
      .map(function (img, index) {
        const title = img.displayTitle || img.caption || img.category || img.name || 'Photo';
        const edit = photoEdit(img);
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
          '<article class="ead-flip" tabindex="0" data-group="' +
          esc(edit.group) +
          '" data-flip-index="' +
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
          '<span class="ead-flip-badge">' +
          esc(uadLabel(edit.group)) +
          '</span>' +
          '<span class="ead-flip-front-title">' +
          esc(title) +
          '</span>' +
          '</div></div>' +
          '<div class="ead-flip-face ead-flip-back">' +
          '<h3>' +
          esc(title) +
          '</h3>' +
          '<label class="ead-flip-note-label">UAD category' +
          '<select class="form-select form-select-sm ead-flip-group">' +
          groupOptions(edit.group) +
          '</select></label>' +
          '<ul class="ead-flip-meta">' +
          rows +
          '</ul>' +
          '<label class="ead-flip-note-label">Note' +
          '<textarea class="ead-flip-note" rows="2" placeholder="Edit a note for this photo…">' +
          esc(edit.note) +
          '</textarea></label>' +
          '<div class="ead-flip-note-status" aria-live="polite"></div>' +
          '</div></div></article>'
        );
      })
      .join('');

    renderPhotoFilters(list);
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
        if (ev.target.closest('.ead-flip-note, .ead-flip-group, select, textarea, label')) return;
        toggle();
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.target.closest('.ead-flip-note, .ead-flip-group, select, textarea')) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggle();
        }
      });
      const select = card.querySelector('.ead-flip-group');
      const badge = card.querySelector('.ead-flip-badge');
      const ta = card.querySelector('.ead-flip-note');
      const status = card.querySelector('.ead-flip-note-status');
      if (select && img) {
        select.addEventListener('click', function (ev) {
          ev.stopPropagation();
        });
        select.addEventListener('change', function () {
          saveEdit(img, { group: select.value });
          card.setAttribute('data-group', select.value);
          if (badge) badge.textContent = uadLabel(select.value);
          if (status) status.textContent = 'Category saved';
          refreshFilterCounts();
        });
      }
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
          saveEdit(img, { note: ta.value });
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
    renderSales(data.sales);
    lastPackage = {
      label: packageKey,
      summary: data.summary || null,
      findings: data.findings || [],
      sales: data.sales || [],
      images: (data.images || []).map(function (img) {
        return {
          displayTitle: img.displayTitle,
          category: img.category,
          group: photoEdit(img).group,
          uadCategory: photoEdit(img).group,
          name: img.name,
        };
      }),
    };
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
      if (data && Array.isArray(data.imageCategories)) {
        photoCategories = data.imageCategories;
      }
      renderExpertSkills(data);
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

  function openZipPicker(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (els.input) els.input.click();
  }

  function bindDrop() {
    if (!els.drop || !els.input) return;

    els.drop.addEventListener('click', function (ev) {
      if (ev.target.closest('#eadBrowseBtn')) return;
      openZipPicker(ev);
    });
    els.drop.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') openZipPicker(ev);
    });
    if (els.browse) {
      els.browse.addEventListener('click', openZipPicker);
    }
    els.input.addEventListener('change', function () {
      const file = els.input.files && els.input.files[0];
      uploadZip(file);
      els.input.value = '';
    });

    window.addEventListener('dragover', function (ev) {
      ev.preventDefault();
    });
    window.addEventListener('drop', function (ev) {
      ev.preventDefault();
    });

    ['dragenter', 'dragover'].forEach(function (evt) {
      els.drop.addEventListener(evt, function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        els.drop.classList.add('is-dragover');
      });
    });
    els.drop.addEventListener('dragleave', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      els.drop.classList.remove('is-dragover');
    });
    els.drop.addEventListener('drop', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      els.drop.classList.remove('is-dragover');
      const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      uploadZip(file);
    });
  }

  function money(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    return '$' + Math.round(num).toLocaleString('en-US');
  }

  function priceColor(value, min, max) {
    const t = max === min ? 1 : (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, t));
    const r = Math.round(255 - clamped * 210);
    const g = Math.round(214 - clamped * 120);
    const b = Math.round(102 - clamped * 40);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function renderSales(sales) {
    const rows = (Array.isArray(sales) ? sales : []).filter(function (row) {
      return row && row.latitude != null && row.longitude != null;
    });
    if (els.salesEmpty) els.salesEmpty.hidden = rows.length > 0;
    const priced = rows.filter(function (row) {
      return row.salePrice != null;
    });
    const min = priced.reduce(function (m, row) {
      return Math.min(m, row.salePrice);
    }, priced.length ? priced[0].salePrice : 0);
    const max = priced.reduce(function (m, row) {
      return Math.max(m, row.salePrice);
    }, priced.length ? priced[0].salePrice : 0);
    if (els.salesList) {
      els.salesList.innerHTML = rows
        .map(function (row) {
          const subject = row.role === 'SubjectProperty';
          const price = subject ? '' : money(row.salePrice);
          const adj = row.adjustedPrice != null ? ' · adjusted ' + money(row.adjustedPrice) : '';
          const color = subject ? '#1d4e89' : priceColor(row.salePrice || min, min, max);
          return (
            '<li><span class="ead-swatch" style="background:' +
            color +
            '"></span><div><strong>' +
            esc(row.label || row.role) +
            '</strong><span class="d-block">' +
            esc(row.address || '') +
            '</span><span class="d-block">' +
            esc((price || 'Subject') + adj) +
            '</span></div></li>'
          );
        })
        .join('');
    }
    if (els.salesLegend) {
      if (!priced.length) {
        els.salesLegend.hidden = true;
      } else {
        els.salesLegend.hidden = false;
        els.salesLegend.innerHTML =
          '<span>' +
          esc(money(min)) +
          '</span><span class="ead-sales-scale" aria-hidden="true"></span><span>' +
          esc(money(max)) +
          '</span>';
      }
    }
    paintSalesMap(rows, min, max);
  }

  async function paintSalesMap(rows, min, max) {
    if (!els.salesMap) return;
    els.salesMap.innerHTML = '';
    els.salesMap.classList.remove('is-fallback');
    if (!rows.length) return;
    function showMapFallback(message) {
      els.salesMap.classList.add('is-fallback');
      els.salesMap.textContent = message;
    }
    if (typeof window.laneFamilyLoadGoogleMaps !== 'function') {
      showMapFallback('Map loader is not on this page. The colored sale list is the choropleth.');
      return;
    }
    const ok = await window.laneFamilyLoadGoogleMaps();
    if (!ok || !window.google || !window.google.maps) {
      showMapFallback('Map unavailable. Pins would sit on the list — each swatch is the sale price.');
      return;
    }
    const markersApi = window.googleAdvancedMarkers;
    if (markersApi && typeof markersApi.ensureMarkerLibrary === 'function') {
      await markersApi.ensureMarkerLibrary();
    }
    const map = new window.google.maps.Map(els.salesMap, {
      mapId: (markersApi && markersApi.DEFAULT_MAP_ID) || 'DEMO_MAP_ID',
      center: { lat: rows[0].latitude, lng: rows[0].longitude },
      zoom: 13,
      streetViewControl: false,
      mapTypeControl: false,
    });
    const bounds = new window.google.maps.LatLngBounds();
    rows.forEach(function (row) {
      const pos = { lat: row.latitude, lng: row.longitude };
      bounds.extend(pos);
      const subject = row.role === 'SubjectProperty';
      const color = subject ? '#1d4e89' : priceColor(row.salePrice || min, min, max);
      const label = subject ? 'S' : String(row.ordinal || '');
      const content =
        markersApi && markersApi.createPinContent
          ? markersApi.createPinContent({ color: color, label: label })
          : null;
      const marker =
        markersApi && markersApi.createMapMarker
          ? markersApi.createMapMarker({ map: map, position: pos, title: row.label, content: content })
          : new window.google.maps.Marker({ map: map, position: pos, title: row.label });
      const info = new window.google.maps.InfoWindow({
        content:
          '<strong>' +
          esc(row.label || '') +
          '</strong><br>' +
          esc(row.address || '') +
          (row.salePrice != null ? '<br>' + esc(money(row.salePrice)) : ''),
      });
      const openInfo = function () {
        if (markersApi && markersApi.openMapInfoWindow) {
          markersApi.openMapInfoWindow(info, map, marker);
        } else {
          info.open({ map: map, anchor: marker });
        }
      };
      if (markersApi && markersApi.onMapMarkerClick) markersApi.onMapMarkerClick(marker, openInfo);
      else marker.addListener('click', openInfo);
    });
    if (rows.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
    } else {
      map.fitBounds(bounds, 48);
    }
  }

  function appendExpert(role, text) {
    if (!els.expertLog) return;
    const item = document.createElement('p');
    item.className = role === 'user' ? 'ead-expert-user' : 'ead-expert-desk';
    item.textContent = (role === 'user' ? 'You: ' : 'Dave: ') + text;
    els.expertLog.appendChild(item);
    els.expertLog.scrollTop = els.expertLog.scrollHeight;
  }

  async function askExpert(message) {
    appendExpert('user', message);
    expertHistory.push({ role: 'user', content: message });
    if (els.expertSend) els.expertSend.disabled = true;
    try {
      const res = await fetch('/api/ead/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          history: expertHistory.slice(0, -1),
          package: lastPackage,
          sessionId: 'ead-desk',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        appendExpert('assistant', data.error || 'The desk expert is unavailable.');
        expertHistory.pop();
        return;
      }
      expertHistory.push({ role: 'assistant', content: data.reply });
      appendExpert('assistant', data.reply);
      leviSpeak(data.reply);
    } catch (err) {
      expertHistory.pop();
      appendExpert('assistant', err.message || 'Network error');
    } finally {
      if (els.expertSend) els.expertSend.disabled = false;
    }
  }

  function renderSkillList(title, skills) {
    if (!skills || !skills.length) return '';
    return (
      '<div><h3>' +
      esc(title) +
      '</h3><ul>' +
      skills
        .map(function (skill) {
          return '<li><strong>' + esc(skill.title) + '</strong> ' + esc(skill.detail) + '</li>';
        })
        .join('') +
      '</ul></div>'
    );
  }

  function renderExpertSkills(data) {
    const host = document.getElementById('eadExpertSkills');
    if (!host || !data) return;
    host.innerHTML =
      renderSkillList('Appraisal', data.appraisalSkills) +
      renderSkillList('Underwriting', data.underwritingSkills);
  }

  let leviFace = {
    name: 'Dave',
    avatarId: 'af9577b8a46846c9abafc77ce0043b4b',
    voiceId: '828b59f834fd4c7188da322b6d9b6c75',
    portrait: '/family/assets/DavidELane.png',
    greeting: 'Dave on the desk. I will read the appraisal and the conditions. I will not issue a credit decision.',
  };
  let leviSessionId = null;

  function leviStatus(text) {
    const el = document.getElementById('eadLeviStatus');
    if (el) el.textContent = text || '';
  }

  function leviPayload(extra) {
    const body = extra && typeof extra === 'object' ? Object.assign({}, extra) : {};
    if (leviFace.avatarId) body.avatarId = leviFace.avatarId;
    if (leviFace.voiceId) body.voiceId = leviFace.voiceId;
    return body;
  }

  async function loadLeviFace() {
    try {
      const res = await fetch('/data/ead-heygen-face.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === 'object') leviFace = Object.assign(leviFace, data);
    } catch (_) {
      /* stand-in stays */
    }
  }

  function leviSpeakLocal(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text).slice(0, 500));
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  }

  async function leviSpeak(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean || !leviSessionId) return;
    try {
      const res = await fetch('/api/heygen/streaming/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leviPayload({ sessionId: leviSessionId, text: clean })),
      });
      const data = await res.json().catch(function () { return {}; });
      if (data && data.audioUrl && window.HeygenLiveTile && window.HeygenLiveTile.playAudio) {
        window.HeygenLiveTile.playAudio(data.audioUrl);
        return;
      }
      if (!leviFace.avatarId) leviSpeakLocal(clean);
    } catch (_) {
      leviSpeakLocal(clean);
    }
  }

  async function stopLevi() {
    if (leviSessionId) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: leviSessionId }),
      }).catch(function () {});
    }
    const media = document.getElementById('eadLeviMedia');
    if (media) {
      const video = media.querySelector('video');
      if (window.HeygenLiveTile && window.HeygenLiveTile.destroyHls) window.HeygenLiveTile.destroyHls(video);
      if (window.HeygenLiveTile && window.HeygenLiveTile.stopAudio) window.HeygenLiveTile.stopAudio();
      const portrait = leviFace.portrait || '/family/assets/DavidELane.png';
      media.innerHTML = '<img src="' + portrait + '" alt="Dave" width="220" height="293" />';
    }
    leviSessionId = null;
    const btn = document.getElementById('eadLeviToggle');
    if (btn) btn.textContent = 'Bring Dave on';
    leviStatus('');
  }

  async function startLevi() {
    const media = document.getElementById('eadLeviMedia');
    const btn = document.getElementById('eadLeviToggle');
    const greeting = leviFace.greeting || 'Dave on the desk.';
    if (!leviFace.avatarId) {
      leviSessionId = 'poster';
      if (btn) btn.textContent = 'Dave off';
      leviStatus('Dave is on the desk.');
      leviSpeakLocal(greeting);
      return;
    }
    leviStatus('Opening Dave…');
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leviPayload({ text: greeting })),
    });
    const data = await res.json().catch(function () { return {}; });
    const tile = window.HeygenLiveTile;
    const poster = data && (data.fallback || data.playback === 'poster' || (tile && tile.isPoster && tile.isPoster(data)));
    const hls = data && data.url && tile && tile.isHls && tile.isHls(data);
    if (data && (hls || poster || data.audioUrl)) {
      if (hls && media) {
        tile.attachHls(media, data.url, 'ead-levi-video');
        leviSessionId = data.sessionId;
        if (btn) btn.textContent = 'Dave off';
        leviStatus('Dave live.');
        return;
      }
      if (poster && data.url && media && tile) {
        tile.attachPoster(media, data.url, 'ead-levi-video', 'Dave');
      }
      leviSessionId = data.sessionId || 'poster';
      if (btn) btn.textContent = 'Dave off';
      leviStatus('Dave on voice.');
      if (data.audioUrl && tile && tile.playAudio) tile.playAudio(data.audioUrl);
      else leviSpeakLocal(greeting);
      return;
    }
    leviSessionId = 'poster';
    if (btn) btn.textContent = 'Dave off';
    leviStatus(data.error || 'HeyGen did not open a live tile. Dave still speaks the reply.');
    leviSpeakLocal(greeting);
  }

  function bindLevi() {
    const btn = document.getElementById('eadLeviToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (leviSessionId) stopLevi();
      else startLevi();
    });
    loadLeviFace();
  }

  function bindExpert() {
    if (!els.expertForm) return;
    els.expertForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const text = els.expertInput ? els.expertInput.value.trim() : '';
      if (!text) return;
      if (els.expertInput) els.expertInput.value = '';
      askExpert(text);
    });
    document.querySelectorAll('[data-expert-prompt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const text = btn.getAttribute('data-expert-prompt') || '';
        if (text) askExpert(text);
      });
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
  bindExpert();
  bindLevi();
})();
