/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
(function () {
  const LEGACY_PLACEHOLDER_FRONT_IMAGE = '/family/assets/lane-genealogies-title-spread.png';
  const DEFAULT_CARD_COVER_IMAGE = '/family/assets/DavidELane.png';
  const CURATED_CARD_FRONT_IMAGE_BY_ID = Object.freeze({
    'samuel-lane-ii': '/family/assets/samuel-lane.png',
    'mary-brewer-lane': '/family/assets/mary-brewer-lane.png',
    'sarah-dickinson-lane': '/family/assets/sarah-dickinson-lane.png',
    'cornet-john-lane-iv': '/family/assets/cornet-john-lane.png',
    'jonathan-homer-lane': '/family/assets/jonathan-homer-lane.png',
    'captain-aaron-g-lane': '/family/assets/aaron-g-lane.png',
    'event-king-philips-war': '/family/assets/lane-genealogies-title-spread.png',
    'event-french-indian-frontier': '/family/assets/cornet-john-lane.png',
    'event-hampton-settlement': '/family/assets/lane-genealogies-title-spread.png',
    'event-boston-migration': '/family/assets/william-e-lane-boston-hero.png',
    'event-captivity-canada-1704': '/family/assets/sarah-dickinson-lane.png',
    'artifact-lane-genealogies-title-1891': '/family/assets/lane-genealogies-title-spread.png',
    'artifact-plate-p4-i0': '/family/assets/lane-pdf/p4-i0.jpg',
    'artifact-plate-opening-boston': '/family/assets/william-e-lane-boston-hero.png',
    'museum-frontispiece-context': '/family/assets/lane-historians/frontispiece-title-1891.png'
  });
  const VIEW_STORAGE_KEY = 'laneTradingCardsView';
  const DEFAULT_CARD_DATES = 'Unknown - Unknown';
  const DEFAULT_PUBLIC_ORIGIN = 'https://www.thelanefamily.us';
  const state = {
    cards: [],
    filteredCards: [],
    filteredTimeline: [],
    timelineSpine: [],
    taxonomy: null,
    selectedCard: null,
    viewMode: 'cards'
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

  function tierLabel(rarity) {
    const key = normalizeText(rarity);
    const fromTaxonomy = state.taxonomy?.tiers?.[key]?.label;
    if (fromTaxonomy) return fromTaxonomy;
    if (!key) return '';
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function kindLabel(cardKind) {
    const key = normalizeText(cardKind || 'person');
    const fromTaxonomy = state.taxonomy?.kinds?.[key]?.label;
    if (fromTaxonomy) return fromTaxonomy;
    if (key === 'artifact') return 'Artifact';
    if (key === 'event') return 'Event';
    return '';
  }

  function tierDefinition(rarity) {
    const key = normalizeText(rarity);
    return state.taxonomy?.tiers?.[key]?.definition || '';
  }

  function buildMetaPills() {
    return '';
  }

  function cardArticleClass(card) {
    const kind = normalizeText(card?.cardKind || 'person');
    const rarity = normalizeText(card?.rarity || '');
    return ['ltc-card', 'ltc-card--clickable', kind !== 'person' ? `ltc-card--${kind}` : '', rarity ? `ltc-card--${rarity}` : '']
      .filter(Boolean)
      .join(' ');
  }

  function renderCatalogKey() {
    const host = $('ltcCatalogKeyBody');
    if (!host || !state.taxonomy) return;
    const tiers = state.taxonomy.tiers || {};
    const kinds = state.taxonomy.kinds || {};
    const tierRows = Object.entries(tiers)
      .map(
        ([key, entry]) =>
          `<dt class="ltc-catalog-key__term ltc-tier--${esc(key)}">${esc(entry.label || key)}</dt><dd class="ltc-catalog-key__def">${esc(entry.definition || '')}</dd>`
      )
      .join('');
    const kindRows = Object.entries(kinds)
      .filter(([key]) => key !== 'person')
      .map(
        ([key, entry]) =>
          `<dt class="ltc-catalog-key__term ltc-kind--${esc(key)}">${esc(entry.label || key)}</dt><dd class="ltc-catalog-key__def">${esc(entry.definition || '')}</dd>`
      )
      .join('');
    host.innerHTML = `<dl class="ltc-catalog-key__list">${tierRows}${kindRows}</dl>`;
  }

  function qrEnabled() {
    return Boolean($('ltcIncludeQr')?.checked);
  }

  function getCardQrTargetUrl(card) {
    const origin =
      typeof window.lanePublicOrigin === 'function'
        ? window.lanePublicOrigin()
        : DEFAULT_PUBLIC_ORIGIN;
    if (card?.cardId) {
      return new URL(
        `/family/lane-trading-cards.html?cardId=${encodeURIComponent(String(card.cardId))}`,
        `${origin}/`
      ).href;
    }
    return new URL('/family/lane-trading-cards.html', `${origin}/`).href;
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
    const curated = CURATED_CARD_FRONT_IMAGE_BY_ID[String(card?.cardId || '')];
    if (curated) return curated;
    const raw = String(card?.frontImage || '').trim();
    return isMissingOrPlaceholderFront(raw) ? DEFAULT_CARD_COVER_IMAGE : raw;
  }

  function cardUsesDefaultCoverImage(card) {
    if (CURATED_CARD_FRONT_IMAGE_BY_ID[String(card?.cardId || '')]) return false;
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
          <article class="${cardArticleClass(card)}" data-card-id="${esc(card.cardId)}" role="button" tabindex="0" aria-label="Open card ${esc(
            card.title
          )}">
            ${buildCardFaceMarkup(card, { qrSlot: true, qrSize: 58 })}
            <div class="ltc-card-body">
              ${buildMetaPills(card)}
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

  function filterCardsClient(cards) {
    const q = normalizeText($('ltcSearch')?.value);
    const era = normalizeText($('ltcEra')?.value);
    const branch = normalizeText($('ltcBranch')?.value);
    const tag = normalizeText($('ltcTag')?.value);
    const kind = normalizeText($('ltcKind')?.value);
    const rarity = normalizeText($('ltcRarity')?.value);
    const filteredCardIds = new Set();

    const filtered = (Array.isArray(cards) ? cards : []).filter((card) => {
      if (era && normalizeText(card.era) !== era) return false;
      if (branch && normalizeText(card.branch) !== branch) return false;
      if (tag && !(card.tags || []).map(normalizeText).includes(tag)) return false;
      if (kind && normalizeText(card.cardKind || 'person') !== kind) return false;
      if (rarity && normalizeText(card.rarity) !== rarity) return false;
      if (!q) {
        filteredCardIds.add(card.cardId);
        return true;
      }
      const haystack = [
        card.title,
        card.summary,
        card.era,
        card.branch,
        card.rarity,
        card.cardKind,
        (card.tags || []).join(' '),
        card.personDisplay?.name || ''
      ]
        .join(' ')
        .toLowerCase();
      const match = haystack.includes(q);
      if (match) filteredCardIds.add(card.cardId);
      return match;
    });

    const spineBeats = (state.timelineSpine || []).filter((beat) => {
      if (beat.cardId && !filteredCardIds.has(beat.cardId)) return false;
      if (!q) return true;
      return `${beat.year} ${beat.label} ${beat.notes || ''}`.toLowerCase().includes(q);
    });
    const filteredTimeline = buildMergedTimeline(spineBeats, filtered);

    return { filtered, filteredTimeline };
  }

  /** Curated spine beats win copy; add filtered cards with timelineYear not already on spine. */
  function buildMergedTimeline(spineBeats, filteredCards) {
    const spineCardIds = new Set((spineBeats || []).map((beat) => beat.cardId).filter(Boolean));
    const merged = (spineBeats || []).map((beat) => ({ ...beat }));
    (filteredCards || []).forEach((card) => {
      if (!Number.isFinite(card.timelineYear) || spineCardIds.has(card.cardId)) return;
      merged.push({
        year: card.timelineYear,
        label: card.title,
        cardId: card.cardId,
        cardRarity: card.rarity,
        cardKind: card.cardKind || 'person',
        beatKind: 'catalog'
      });
    });
    merged.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return String(a.label).localeCompare(String(b.label));
    });
    return merged;
  }

  function applyFilters() {
    const { filtered, filteredTimeline } = filterCardsClient(state.cards);
    state.filteredCards = filtered;
    state.filteredTimeline = filteredTimeline;
    renderActiveView();
  }

  function renderTimeline(beats) {
    const host = $('ltcTimeline');
    if (!host) return;
    const rows = Array.isArray(beats) ? beats : [];
    $('ltcCount').textContent =
      state.viewMode === 'timeline'
        ? `${rows.length} timeline beat${rows.length === 1 ? '' : 's'}`
        : `${state.filteredCards.length} card${state.filteredCards.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      host.innerHTML = '<div class="text-muted">No timeline beats match these filters.</div>';
      return;
    }
    host.innerHTML = rows
      .map((beat) => {
        const clickable = Boolean(beat.cardId);
        const note = beat.notes ? `<div class="ltc-timeline-note">${esc(beat.notes)}</div>` : '';
        return `
          <article class="ltc-timeline-row${clickable ? ' ltc-timeline-row--clickable' : ''}"
            ${clickable ? `data-card-id="${esc(beat.cardId)}" role="button" tabindex="0"` : ''}>
            <div class="ltc-timeline-track" aria-hidden="true"><span class="ltc-timeline-dot"></span></div>
            <div class="ltc-timeline-year">${esc(String(beat.year))}</div>
            <div class="ltc-timeline-body">
              <div class="ltc-timeline-label">${esc(beat.label)}</div>
              ${note}
            </div>
          </article>
        `;
      })
      .join('');

    host.querySelectorAll('.ltc-timeline-row--clickable').forEach((row) => {
      const open = () => openCard(row.getAttribute('data-card-id'), true);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      });
    });
  }

  function setViewMode(mode, updateUrl = true) {
    const next = mode === 'timeline' ? 'timeline' : 'cards';
    state.viewMode = next;
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch (_) {
      /* ignore */
    }
    $('ltcViewCards')?.classList.toggle('active', next === 'cards');
    $('ltcViewTimeline')?.classList.toggle('active', next === 'timeline');
    $('ltcViewCards')?.setAttribute('aria-pressed', next === 'cards' ? 'true' : 'false');
    $('ltcViewTimeline')?.setAttribute('aria-pressed', next === 'timeline' ? 'true' : 'false');
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (next === 'timeline') url.searchParams.set('view', 'timeline');
      else url.searchParams.delete('view');
      window.history.replaceState({}, '', url.toString());
    }
    renderActiveView();
  }

  function renderActiveView() {
    const isTimeline = state.viewMode === 'timeline';
    $('ltcGrid')?.toggleAttribute('hidden', isTimeline);
    $('ltcTimeline')?.toggleAttribute('hidden', !isTimeline);
    $('ltcTimelineHint')?.toggleAttribute('hidden', !isTimeline);
    if (isTimeline) renderTimeline(state.filteredTimeline);
    else renderGrid(state.filteredCards);
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
    const tierLine = card.rarity
      ? `<p class="small mb-2"><strong>Catalog tier:</strong> ${esc(tierLabel(card.rarity))} — ${esc(tierDefinition(card.rarity))}</p>`
      : '';
    const kindLine =
      card.cardKind && card.cardKind !== 'person'
        ? `<p class="small mb-2"><strong>Card kind:</strong> ${esc(kindLabel(card.cardKind))}</p>`
        : '';
    $('ltcDetailBody').innerHTML = `
      <div class="row g-3">
        <div class="col-md-4">
          ${buildCardFaceMarkup(card, { qrDataUrl, qrSlot: false, qrSize: 70 })}
          <p class="small text-muted mt-2 mb-0">${esc(card.era)} · ${esc(card.branch)}</p>
          ${buildMetaPills(card)}
        </div>
        <div class="col-md-8">
          ${tierLine}
          ${kindLine}
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
            <div style="font-size:12px;color:#555;margin-bottom:6px;">${esc(card.era)} · ${esc(card.branch)}${
              card.rarity ? ` · ${esc(tierLabel(card.rarity))}` : ''
            }${
              card.cardKind && card.cardKind !== 'person' ? ` · ${esc(kindLabel(card.cardKind))}` : ''
            }</div>
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
      state.timelineSpine = Array.isArray(data.timelineSpine) ? data.timelineSpine : [];
      state.taxonomy = data.taxonomy || null;

      setOptions($('ltcEra'), data.eras || [], 'All eras');
      setOptions($('ltcBranch'), data.branches || [], 'All branches');
      setOptions($('ltcTag'), data.tags || [], 'All tags');
      renderCatalogKey();

      const params = new URLSearchParams(window.location.search);
      const viewParam = normalizeText(params.get('view'));
      let initialView = 'cards';
      try {
        const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
        if (viewParam === 'timeline') initialView = 'timeline';
        else if (viewParam === 'cards') initialView = 'cards';
        else if (stored === 'timeline' || stored === 'cards') initialView = stored;
      } catch (_) {
        if (viewParam === 'timeline') initialView = 'timeline';
      }
      setViewMode(initialView, false);
      applyFilters();

      ['ltcSearch', 'ltcEra', 'ltcBranch', 'ltcTag', 'ltcKind', 'ltcRarity'].forEach((id) => {
        $(id)?.addEventListener('input', applyFilters);
        $(id)?.addEventListener('change', applyFilters);
      });
      $('ltcReset')?.addEventListener('click', () => {
        $('ltcSearch').value = '';
        $('ltcEra').value = '';
        $('ltcBranch').value = '';
        $('ltcTag').value = '';
        $('ltcKind').value = '';
        $('ltcRarity').value = '';
        applyFilters();
      });
      $('ltcViewCards')?.addEventListener('click', () => setViewMode('cards'));
      $('ltcViewTimeline')?.addEventListener('click', () => setViewMode('timeline'));

      $('ltcSinglePng').addEventListener('click', () => exportSingleCard(false));
      $('ltcSinglePdf').addEventListener('click', () => exportSingleCard(true));
      $('ltcSheetPng').addEventListener('click', () => exportNineCardSheet(false));
      $('ltcSheetPdf').addEventListener('click', () => exportNineCardSheet(true));
      $('ltcCatalogPdf').addEventListener('click', () => exportCatalogPdf());
      if ($('ltcSheetPng')) $('ltcSheetPng').textContent = 'Export Front + Back PNG';
      if ($('ltcSheetPdf')) $('ltcSheetPdf').textContent = 'Export Front + Back PDF';
      $('ltcIncludeQr')?.addEventListener('change', () => {
        renderActiveView();
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
