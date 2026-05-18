/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
(function () {
  const LEGACY_PLACEHOLDER_FRONT_IMAGE = '/family/assets/lane-genealogies-title-spread.png';
  const DEFAULT_CARD_COVER_IMAGE = '/family/assets/DavidELane.png';
  const DEFAULT_CARD_DATES = 'Unknown - Unknown';
  const state = {
    cards: [],
    filteredCards: [],
    selectedCard: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function normalizeText(text) {
    return String(text || '').toLowerCase().trim();
  }

  function qrEnabled() {
    return Boolean($('ltcIncludeQr')?.checked);
  }

  function getCardQrTargetUrl(card) {
    if (card?.cardId) {
      return new URL(
        `/family/lane-trading-cards.html?cardId=${encodeURIComponent(String(card.cardId))}`,
        window.location.origin
      ).href;
    }
    return new URL('/family/lane-trading-cards.html', window.location.origin).href;
  }

  function generateTradingCardQr(url, size = 108) {
    if (!window.QRCode || !url) return null;
    const node = document.createElement('div');
    node.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${size}px;height:${size}px;`;
    document.body.appendChild(node);
    try {
      new window.QRCode(node, { text: url, width: size, height: size });
      const canvas = node.querySelector('canvas');
      const img = node.querySelector('img');
      const dataUrl = canvas ? canvas.toDataURL('image/png') : img ? img.src : null;
      document.body.removeChild(node);
      return dataUrl;
    } catch (_) {
      if (node.parentNode) document.body.removeChild(node);
      return null;
    }
  }

  function setOptions(selectEl, options, placeholder) {
    const values = Array.isArray(options) ? options : [];
    selectEl.innerHTML = `<option value="">${placeholder}</option>${values
      .map((value) => `<option value="${esc(value)}">${esc(value)}</option>`)
      .join('')}`;
  }

  function isLegacyPlaceholderFrontImage(url) {
    const raw = String(url || '').trim().toLowerCase();
    if (!raw) return false;
    const fallback = LEGACY_PLACEHOLDER_FRONT_IMAGE.toLowerCase();
    return raw === fallback || raw.endsWith(fallback);
  }

  function isMissingOrPlaceholderFront(url) {
    const raw = String(url || '').trim();
    if (!raw) return true;
    return isLegacyPlaceholderFrontImage(raw);
  }

  function resolveCardFrontSrc(card) {
    const raw = String(card?.frontImage || '').trim();
    return isMissingOrPlaceholderFront(raw) ? DEFAULT_CARD_COVER_IMAGE : raw;
  }

  function cardUsesDefaultCoverImage(card) {
    return isMissingOrPlaceholderFront(card?.frontImage);
  }

  function getCardDates(card) {
    const raw = String(card?.personDisplay?.dates || '').trim();
    return raw || DEFAULT_CARD_DATES;
  }

  function getCardFaceCaption(card) {
    if (card?.timelineYear != null && Number.isFinite(Number(card.timelineYear))) {
      return `${card.era} · ${card.timelineYear}`;
    }
    return `${card.era} · ${card.branch}`;
  }

  function buildCardFaceMarkup(card, options = {}) {
    const opts = options || {};
    const useDefaultCover = cardUsesDefaultCoverImage(card);
    const imageUrl = resolveCardFrontSrc(card);
    const qrDataUrl = String(opts.qrDataUrl || '').trim();
    const qrSlot = opts.qrSlot !== false;
    const qrSize = Number(opts.qrSize) > 0 ? Number(opts.qrSize) : 58;
    const qrBoxSize = Number(opts.qrBoxSize) > 0 ? Number(opts.qrBoxSize) : Math.max(44, qrSize + 4);
    const classes = [
      'ltc-card-face',
      useDefaultCover ? 'ltc-card-face--default-cover' : '',
      opts.compact ? 'ltc-card-face--compact' : '',
      opts.exportFace ? 'ltc-card-face--export' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const qrMarkup = qrDataUrl
      ? `<img src="${esc(qrDataUrl)}" alt="QR code to card" style="width:${qrSize}px;height:${qrSize}px;" />`
      : qrSlot
        ? `<span class="ltc-card-qr-slot" data-card-id="${esc(card.cardId)}"></span>`
        : '';
    const faceStyle = opts.aspectRatio ? ` style="aspect-ratio:${esc(opts.aspectRatio)};"` : '';
    return `
      <div class="${classes}" data-card-id="${esc(card.cardId)}"${faceStyle}>
        <div class="ltc-card-art">
          <img class="ltc-card-image" src="${esc(imageUrl)}" alt="" loading="lazy"
               onerror="this.onerror=null;this.closest('.ltc-card-face')?.classList.add('ltc-card-face--cover');" />
          <div class="ltc-card-cover">
            <div class="ltc-card-cover-kicker">Lane Legacy Museum</div>
            <div class="ltc-card-cover-title">${esc(card.title)}</div>
            <div class="ltc-card-cover-dates">${esc(getCardDates(card))}</div>
            <div class="ltc-card-cover-meta">${esc(getCardFaceCaption(card))}</div>
          </div>
        </div>
        <div class="ltc-card-footer">
          <div class="ltc-card-footer-copy">
            <div class="ltc-card-footer-title">${esc(card.title)}</div>
            <div class="ltc-card-footer-dates">${esc(getCardDates(card))}</div>
          </div>
          <div class="ltc-card-qr" style="width:${qrBoxSize}px;height:${qrBoxSize}px;">${qrMarkup}</div>
        </div>
      </div>
    `;
  }

  function renderGridQrs(cards) {
    const grid = $('ltcGrid');
    if (!grid) return;
    const includeQr = qrEnabled();
    const byCardId = new Map((Array.isArray(cards) ? cards : []).map((card) => [String(card.cardId), card]));
    grid.querySelectorAll('.ltc-card').forEach((node) => {
      if (includeQr) node.classList.remove('ltc-card--qr-off');
      else node.classList.add('ltc-card--qr-off');
    });
    if (!includeQr) {
      grid.querySelectorAll('.ltc-card-qr-slot').forEach((slot) => {
        slot.innerHTML = '';
      });
      return;
    }
    grid.querySelectorAll('.ltc-card-qr-slot').forEach((slot) => {
      const cardId = String(slot.getAttribute('data-card-id') || '');
      const card = byCardId.get(cardId);
      if (!card) return;
      const dataUrl = generateTradingCardQr(getCardQrTargetUrl(card), 70);
      slot.innerHTML = dataUrl ? `<img src="${esc(dataUrl)}" alt="QR code to card" style="width:58px;height:58px;" />` : '';
    });
  }

  function renderGrid(cards) {
    const grid = $('ltcGrid');
    $('ltcCount').textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;
    if (!cards.length) {
      grid.innerHTML = '<div class="text-muted">No cards match these filters.</div>';
      return;
    }
    grid.innerHTML = cards
      .map((card) => {
        const tags = (card.tags || []).slice(0, 3);
        return `
          <article class="ltc-card ltc-card--clickable" data-card-id="${esc(card.cardId)}" role="button" tabindex="0" aria-label="Open card ${esc(
            card.title
          )}">
            ${buildCardFaceMarkup(card, { qrSlot: true, qrSize: 58 })}
            <div class="ltc-card-body">
              <div class="ltc-card-meta">${esc(card.era)} · ${esc(card.branch)}</div>
              <h3 class="h6 mb-1 mt-1">${esc(card.title)}</h3>
              <p class="ltc-card-summary">${esc(card.summary)}</p>
              <div class="ltc-tag-row mb-2">${tags.map((tag) => `<span class="ltc-tag">${esc(tag)}</span>`).join('')}</div>
              <button class="btn btn-sm btn-outline-light ltc-open-card" type="button" data-card-id="${esc(card.cardId)}">Open card</button>
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('.ltc-open-card').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const cardId = btn.getAttribute('data-card-id');
        openCard(cardId, true);
      });
    });

    grid.querySelectorAll('.ltc-card').forEach((cardNode) => {
      cardNode.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
        const cardId = cardNode.getAttribute('data-card-id');
        openCard(cardId, true);
      });
      cardNode.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const cardId = cardNode.getAttribute('data-card-id');
        openCard(cardId, true);
      });
    });
    renderGridQrs(cards);
  }

  function applyFilters() {
    const q = normalizeText($('ltcSearch').value);
    const era = normalizeText($('ltcEra').value);
    const branch = normalizeText($('ltcBranch').value);
    const tag = normalizeText($('ltcTag').value);
    state.filteredCards = state.cards.filter((card) => {
      if (era && normalizeText(card.era) !== era) return false;
      if (branch && normalizeText(card.branch) !== branch) return false;
      if (tag && !(card.tags || []).map(normalizeText).includes(tag)) return false;
      if (!q) return true;
      const haystack = [
        card.title,
        card.summary,
        card.era,
        card.branch,
        (card.tags || []).join(' '),
        card.personDisplay?.name || ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    renderGrid(state.filteredCards);
  }

  function setCardParam(cardId) {
    const url = new URL(window.location.href);
    if (cardId) url.searchParams.set('cardId', cardId);
    else url.searchParams.delete('cardId');
    window.history.replaceState({}, '', url.toString());
  }

  function renderCardDetail(card) {
    const related = Array.isArray(card.relatedCards) ? card.relatedCards : [];
    const citations = Array.isArray(card.citations) ? card.citations : [];
    const facts = Array.isArray(card.facts) ? card.facts : [];
    const qrDataUrl = qrEnabled() ? generateTradingCardQr(getCardQrTargetUrl(card), 86) : null;
    const relatedHtml = related.length
      ? `<div class="ltc-related-list">${related
          .map(
            (entry) =>
              `<button type="button" class="btn btn-sm btn-outline-secondary ltc-related-open" data-card-id="${esc(entry.cardId)}">${esc(
                entry.title
              )}</button>`
          )
          .join('')}</div>`
      : '<p class="small text-muted mb-0">No related cards listed.</p>';
    $('ltcDetailModalTitle').textContent = `${card.title} · Card detail`;
    $('ltcDetailBody').innerHTML = `
      <div class="row g-3">
        <div class="col-md-4">
          ${buildCardFaceMarkup(card, { qrDataUrl, qrSlot: false, qrSize: 70 })}
          <p class="small text-muted mt-2 mb-0">${esc(card.era)} · ${esc(card.branch)}</p>
        </div>
        <div class="col-md-8">
          <p class="mb-2">${esc(card.summary)}</p>
          <p class="history-context-evidence-note small"><strong>Context:</strong> era/branch framing. <strong>Evidence:</strong> facts and citations below.</p>
          <h3 class="h6 mb-1">Evidence facts</h3>
          <ul>${facts.map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>
          <h3 class="h6 mb-1">Citations</h3>
          <ul>
            ${citations
              .map((citation) => {
                const href = String(citation.url || '').trim();
                const label = esc(citation.label || 'Citation');
                const suffix = citation.pageRef ? ` (${esc(citation.pageRef)})` : '';
                if (!href) return `<li>${label}${suffix}</li>`;
                return `<li><a href="${esc(href)}" ${href.startsWith('/') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${label}</a>${suffix}</li>`;
              })
              .join('')}
          </ul>
          <h3 class="h6 mb-1">Related cards</h3>
          ${relatedHtml}
        </div>
      </div>
    `;
    $('ltcDetailBody').querySelectorAll('.ltc-related-open').forEach((btn) => {
      btn.addEventListener('click', () => openCard(btn.getAttribute('data-card-id'), true));
    });
  }

  async function openCard(cardId, updateUrl) {
    if (!cardId) return;
    try {
      const detail = await getJson(`/api/genealogy/lane-cards/${encodeURIComponent(cardId)}`);
      state.selectedCard = detail.card;
      renderCardDetail(detail.card);
      if (updateUrl) setCardParam(cardId);
      const modal = bootstrap.Modal.getOrCreateInstance($('ltcDetailModal'));
      modal.show();
    } catch (error) {
      $('ltcError').textContent = `Unable to open card: ${error.message}`;
    }
  }

  async function renderCanvasFromMarkup(className, innerHtml) {
    const host = $('ltcExportMount');
    host.innerHTML = `<div class="${className}">${innerHtml}</div>`;
    if (!window.posterUtils) throw new Error('Poster utilities unavailable');
    return window.posterUtils.renderPosterCanvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff' });
  }

  async function exportSingleCard(asPdf) {
    if (!state.selectedCard) return;
    const card = state.selectedCard;
    const qrDataUrl = qrEnabled() ? generateTradingCardQr(getCardQrTargetUrl(card), 140) : null;
    const html = `
      <h1 style="margin:0 0 10px;font-size:22px;">${esc(card.title)}</h1>
      ${buildCardFaceMarkup(card, { qrDataUrl, qrSlot: false, qrSize: 96, exportFace: true, aspectRatio: '2.5 / 3.5' })}
      <p style="margin:12px 0 6px;font-size:14px;">${esc(card.summary)}</p>
      <div style="font-size:13px;margin-top:8px;">
        <strong>Evidence facts</strong>
        <ul>${(card.facts || []).map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>
      </div>
    `;
    const canvas = await renderCanvasFromMarkup('ltc-export-single', html);
    if (asPdf) await window.posterUtils.downloadPdfFromCanvas(canvas, `lane-card-${card.cardId}.pdf`);
    else window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(canvas), `lane-card-${card.cardId}.png`);
  }

  function getBackFieldValue(card, key) {
    if (!card || !card.back || typeof card.back !== 'object') return '';
    return String(card.back[key] || '').trim();
  }

  function getBackParagraphs(card) {
    const back = card?.back;
    if (typeof back === 'string' && back.trim()) return [back.trim()];

    const objectFields = [
      getBackFieldValue(card, 'title'),
      getBackFieldValue(card, 'subtitle'),
      getBackFieldValue(card, 'summary'),
      getBackFieldValue(card, 'description'),
      getBackFieldValue(card, 'text'),
      getBackFieldValue(card, 'bio')
    ].filter(Boolean);
    if (objectFields.length) return objectFields;

    if (String(card?.backText || '').trim()) return [String(card.backText).trim()];
    if (String(card?.backSummary || '').trim()) return [String(card.backSummary).trim()];

    return [
      `Context: ${String(card?.summary || 'Lane family record').trim()}`,
      `Evidence: ${(card?.facts || []).slice(0, 2).join(' · ') || 'Genealogy compilation references and timeline context.'}`
    ];
  }

  function buildCardBackMarkup(card) {
    const paragraphs = getBackParagraphs(card);
    const citations = Array.isArray(card?.citations) ? card.citations : [];
    const facts = Array.isArray(card?.facts) ? card.facts : [];
    return `
      <div class="ltc-card-face ltc-card-face--export" style="aspect-ratio:2.5 / 3.5;">
        <div class="ltc-card-art" style="padding:0.58rem;background:linear-gradient(160deg,#f5ecd4 0%,#f8f2e1 35%,#eee5cf 100%);border:1px solid rgba(122,100,42,0.26);display:flex;flex-direction:column;">
          <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#6d5823;">Lane Trading Card Back</div>
          <div style="margin-top:4px;font-size:15px;font-weight:700;line-height:1.2;color:#1d1a12;">${esc(card.title)}</div>
          <div style="margin-top:4px;font-size:11px;color:#3d3320;">${esc(card.era)} · ${esc(card.branch)}</div>
          <div style="margin-top:8px;font-size:10px;line-height:1.35;color:#2b2418;">
            ${paragraphs.slice(0, 3).map((line) => `<p style="margin:0 0 6px;">${esc(line)}</p>`).join('')}
          </div>
          <div style="margin-top:auto;font-size:9px;color:#433824;border-top:1px solid rgba(91,74,30,0.3);padding-top:5px;">
            <div><strong>Facts:</strong> ${esc(String(facts.length || 0))}</div>
            <div><strong>Citations:</strong> ${esc(String(citations.length || 0))}</div>
          </div>
        </div>
        <div class="ltc-card-footer">
          <div class="ltc-card-footer-copy">
            <div class="ltc-card-footer-title">${esc(card.title)}</div>
            <div class="ltc-card-footer-dates">${esc(getCardDates(card))}</div>
          </div>
          <div class="ltc-card-qr" style="width:46px;height:46px;background:#ece4ce;color:#564a2f;font-size:10px;border-color:#b39d6b;">BACK</div>
        </div>
      </div>
    `;
  }

  function buildSheetTiles(cards, options = {}) {
    const side = String(options.side || 'front');
    return cards
      .slice(0, 9)
      .map((card) => {
        if (side === 'back') {
          return `
            <article class="ltc-export-tile">
              ${buildCardBackMarkup(card)}
              <div style="font-size:10px;color:#333;margin-top:6px;line-height:1.3;">Associated back · ${esc(card.cardId)}</div>
            </article>
          `;
        }
        const qrDataUrl = qrEnabled() ? generateTradingCardQr(getCardQrTargetUrl(card), 64) : null;
        return `
          <article class="ltc-export-tile">
            ${buildCardFaceMarkup(card, { qrDataUrl, qrSlot: false, qrSize: 42, compact: true, exportFace: true, aspectRatio: '2.5 / 3.5' })}
            <div style="font-size:10px;color:#333;margin-top:6px;line-height:1.3;">${esc(card.summary)}</div>
          </article>
        `
      })
      .join('');
  }

  async function downloadPdfFromCanvases(canvases, filename) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF is not available');
    }
    const validCanvases = (Array.isArray(canvases) ? canvases : []).filter(Boolean);
    if (!validCanvases.length) {
      throw new Error('No canvases available for PDF export');
    }
    const { jsPDF } = window.jspdf;
    const first = validCanvases[0];
    const pdf = new jsPDF({
      orientation: first.height >= first.width ? 'portrait' : 'landscape',
      unit: 'pt',
      format: [first.width, first.height]
    });

    validCanvases.forEach((canvas, index) => {
      if (index > 0) {
        pdf.addPage([canvas.width, canvas.height], canvas.height >= canvas.width ? 'portrait' : 'landscape');
      }
      const imageData = window.posterUtils.canvasToDataUrl(canvas);
      pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
    });
    pdf.save(filename);
  }

  async function exportNineCardSheet(asPdf) {
    const cards = state.filteredCards.length ? state.filteredCards : state.cards;
    if (!cards.length) return;
    const sheetCards = cards.slice(0, 9);
    const frontHtml = `
      <h2 style="margin:0 0 10px;font-size:20px;">Lane Trading Cards · 9-card sheet (Fronts)</h2>
      <div class="ltc-export-sheet-grid">${buildSheetTiles(sheetCards, { side: 'front' })}</div>
    `;
    const backHtml = `
      <h2 style="margin:0 0 10px;font-size:20px;">Lane Trading Cards · 9-card sheet (Associated backs)</h2>
      <div style="font-size:12px;color:#444;margin:0 0 8px;">Print duplex and flip on the long edge to align backs.</div>
      <div class="ltc-export-sheet-grid">${buildSheetTiles(sheetCards, { side: 'back' })}</div>
    `;

    if (asPdf) {
      const frontCanvas = await renderCanvasFromMarkup('ltc-export-sheet', frontHtml);
      const backCanvas = await renderCanvasFromMarkup('ltc-export-sheet', backHtml);
      await downloadPdfFromCanvases([frontCanvas, backCanvas], 'lane-trading-cards-fronts-backs-sheet.pdf');
      return;
    }

    const combinedHtml = `
      ${frontHtml}
      <div style="height:20px;"></div>
      <div style="border-top:2px dashed #c8c8c8;margin:8px 0 14px;"></div>
      ${backHtml}
    `;
    const canvas = await renderCanvasFromMarkup('ltc-export-sheet', combinedHtml);
    window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(canvas), 'lane-trading-cards-fronts-backs-sheet.png');
  }

  async function exportCatalogPdf() {
    const cards = state.filteredCards.length ? state.filteredCards : state.cards;
    if (!cards.length) return;
    const body = cards
      .map(
        (card, index) => `
          <section style="page-break-inside: avoid; border:1px solid #bbb; padding:10px; margin-bottom:10px;">
            <h3 style="margin:0 0 4px;font-size:16px;">${index + 1}. ${esc(card.title)}</h3>
            <div style="font-size:12px;color:#555;margin-bottom:6px;">${esc(card.era)} · ${esc(card.branch)}</div>
            <p style="font-size:12px;margin:0 0 4px;">${esc(card.summary)}</p>
            <div style="font-size:11px;color:#222;"><strong>Key facts:</strong> ${(card.facts || []).slice(0, 2).map(esc).join(' · ')}</div>
          </section>
        `
      )
      .join('');
    const html = `<h1 style="margin:0 0 12px;font-size:24px;">Lane Trading Cards Catalog · First Edition</h1>${body}`;
    const canvas = await renderCanvasFromMarkup('ltc-export-catalog', html);
    await window.posterUtils.downloadPdfFromCanvas(canvas, 'lane-trading-cards-catalog.pdf');
  }

  async function init() {
    try {
      $('ltcError').textContent = '';
      const data = await getJson('/api/genealogy/lane-cards');
      state.cards = Array.isArray(data.cards) ? data.cards : [];
      state.filteredCards = state.cards.slice();

      setOptions($('ltcEra'), data.eras || [], 'All eras');
      setOptions($('ltcBranch'), data.branches || [], 'All branches');
      setOptions($('ltcTag'), data.tags || [], 'All tags');
      renderGrid(state.cards);

      ['ltcSearch', 'ltcEra', 'ltcBranch', 'ltcTag'].forEach((id) => {
        $(id).addEventListener('input', applyFilters);
        $(id).addEventListener('change', applyFilters);
      });
      $('ltcReset').addEventListener('click', () => {
        $('ltcSearch').value = '';
        $('ltcEra').value = '';
        $('ltcBranch').value = '';
        $('ltcTag').value = '';
        applyFilters();
      });

      $('ltcSinglePng').addEventListener('click', () => exportSingleCard(false));
      $('ltcSinglePdf').addEventListener('click', () => exportSingleCard(true));
      $('ltcSheetPng').addEventListener('click', () => exportNineCardSheet(false));
      $('ltcSheetPdf').addEventListener('click', () => exportNineCardSheet(true));
      $('ltcCatalogPdf').addEventListener('click', () => exportCatalogPdf());
      if ($('ltcSheetPng')) $('ltcSheetPng').textContent = 'Export Front + Back PNG';
      if ($('ltcSheetPdf')) $('ltcSheetPdf').textContent = 'Export Front + Back PDF';
      $('ltcIncludeQr')?.addEventListener('change', () => {
        renderGrid(state.filteredCards);
        if (state.selectedCard) renderCardDetail(state.selectedCard);
      });

      $('ltcDetailModal').addEventListener('hidden.bs.modal', () => {
        state.selectedCard = null;
        setCardParam('');
      });

      const deepLinkCardId = new URLSearchParams(window.location.search).get('cardId');
      if (deepLinkCardId) {
        await openCard(deepLinkCardId, false);
      }
    } catch (error) {
      $('ltcError').textContent = `Failed to load cards: ${error.message}`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
