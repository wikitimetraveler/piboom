(function () {
  const FALLBACK_IMAGE = '/family/assets/lane-genealogies-title-spread.png';
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
          <article class="ltc-card" data-card-id="${esc(card.cardId)}">
            <img class="ltc-card-image" src="${esc(card.frontImage || FALLBACK_IMAGE)}" alt="" loading="lazy"
              onerror="this.onerror=null;this.src='${esc(FALLBACK_IMAGE)}';" />
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
      btn.addEventListener('click', () => {
        const cardId = btn.getAttribute('data-card-id');
        openCard(cardId, true);
      });
    });
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
          <img src="${esc(card.frontImage || FALLBACK_IMAGE)}" class="img-fluid rounded border" alt="" onerror="this.onerror=null;this.src='${esc(
            FALLBACK_IMAGE
          )}'" />
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
    const qrBlock = qrDataUrl
      ? `<div style="margin-top:10px;display:flex;justify-content:flex-end;align-items:flex-end;gap:10px;">
          <div style="font-size:11px;color:#333;text-align:right;">Scan for live card page</div>
          <img src="${esc(qrDataUrl)}" alt="QR code to Lane card" style="width:92px;height:92px;border:1px solid #555;background:#fff;padding:2px;" />
        </div>`
      : '';
    const html = `
      <h1 style="margin:0 0 8px;font-size:22px;">${esc(card.title)}</h1>
      <div style="font-size:13px;color:#444;margin-bottom:10px;">${esc(card.era)} · ${esc(card.branch)}</div>
      <img src="${esc(card.frontImage || FALLBACK_IMAGE)}" alt="" style="width:100%;max-height:280px;object-fit:cover;border:1px solid #aaa;" />
      <p style="margin:10px 0 6px;font-size:14px;">${esc(card.summary)}</p>
      <div style="font-size:13px;">
        <strong>Evidence facts</strong>
        <ul>${(card.facts || []).map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>
      </div>
      ${qrBlock}
    `;
    const canvas = await renderCanvasFromMarkup('ltc-export-single', html);
    if (asPdf) await window.posterUtils.downloadPdfFromCanvas(canvas, `lane-card-${card.cardId}.pdf`);
    else window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(canvas), `lane-card-${card.cardId}.png`);
  }

  function buildSheetTiles(cards) {
    return cards
      .slice(0, 9)
      .map((card) => {
        const qrDataUrl = qrEnabled() ? generateTradingCardQr(getCardQrTargetUrl(card), 64) : null;
        const qrBlock = qrDataUrl
          ? `<div style="margin-top:6px;display:flex;justify-content:flex-end;">
               <img src="${esc(qrDataUrl)}" alt="QR code to card" style="width:40px;height:40px;border:1px solid #666;background:#fff;padding:1px;" />
             </div>`
          : '';
        return `
          <article class="ltc-export-tile">
            <img src="${esc(card.frontImage || FALLBACK_IMAGE)}" alt="" />
            <div style="font-weight:700;font-size:12px;">${esc(card.title)}</div>
            <div style="font-size:11px;color:#444;">${esc(card.era)}</div>
            <div style="font-size:10px;margin-top:4px;">${esc(card.summary)}</div>
            ${qrBlock}
          </article>
        `
      })
      .join('');
  }

  async function exportNineCardSheet(asPdf) {
    const cards = state.filteredCards.length ? state.filteredCards : state.cards;
    if (!cards.length) return;
    const html = `
      <h2 style="margin:0 0 10px;font-size:20px;">Lane Trading Cards · 9-card sheet</h2>
      <div class="ltc-export-sheet-grid">${buildSheetTiles(cards)}</div>
    `;
    const canvas = await renderCanvasFromMarkup('ltc-export-sheet', html);
    if (asPdf) await window.posterUtils.downloadPdfFromCanvas(canvas, 'lane-trading-cards-sheet.pdf');
    else window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(canvas), 'lane-trading-cards-sheet.png');
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
