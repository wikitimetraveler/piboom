/**
 * Cannabis type flip cards — Glazed-style case at the top
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function leafSvg() {
    return `<svg class="mhm-leaf-mark" viewBox="0 0 72 72" aria-hidden="true">
      <path fill="currentColor" d="M36 6c3 12 14 18 8 28 16-2 18 12 6 16 10 8 2 16-8 10 2 12-8 16-10 8-2 8-12 4-10-8-10 6-18-2-8-10-12-4-10-18 6-16-6-10 5-16 8-28 2 12 13 18 8 28z"/>
    </svg>`;
  }

  function cardHtml(type) {
    const tags = (type.tags || [])
      .slice(0, 3)
      .map((t) => `<span class="mhm-tag">${esc(t)}</span>`)
      .join('');
    const examples = (type.examples || []).join(' · ');
    return `<article class="mhm-card" data-id="${esc(type.id)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(type.name)} — flip for history" style="--mhm-type:${esc(type.swatch || '#9dffc4')}">
      <div class="mhm-card-inner">
        <div class="mhm-face mhm-face--front">
          ${leafSvg()}
          <p class="mhm-card-kicker">${esc(type.kicker || 'Type')}</p>
          <h3>${esc(type.name)}</h3>
          <p class="mhm-tagline">${esc(type.tagline || '')}</p>
          <div class="mhm-tags">${tags}</div>
          <p class="mhm-flip-hint"><i class="bi bi-arrow-repeat"></i> Flip for a bit of history</p>
        </div>
        <div class="mhm-face mhm-face--back">
          <div class="mhm-back-scroll">
            <p class="mhm-card-kicker">History</p>
            <h3>${esc(type.name)}</h3>
            <p>${esc(type.history || '')}</p>
            <p class="mhm-tagline">${esc(type.originNote || '')}</p>
            ${examples ? `<p><strong>On the map:</strong> ${esc(examples)}</p>` : ''}
          </div>
          <div class="mhm-back-actions">
            <button type="button" class="mhm-btn mhm-btn-sm mhm-hear" data-hear="${esc(type.id)}">Hear Sage</button>
            <button type="button" class="mhm-btn mhm-btn-ghost mhm-btn-sm mhm-ask" data-ask="${esc(type.id)}">Ask Sage</button>
            <button type="button" class="mhm-btn mhm-btn-sm mhm-map" data-map="${esc(type.id)}">Show on map</button>
            <button type="button" class="mhm-btn mhm-btn-ghost mhm-btn-sm mhm-flip-back">Flip back</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function flipCard(card, on) {
    const next = typeof on === 'boolean' ? on : !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', next);
    card.setAttribute('aria-pressed', next ? 'true' : 'false');
  }

  function bindGrid(grid, types) {
    grid.addEventListener('click', (ev) => {
      const hear = ev.target.closest('[data-hear]');
      const ask = ev.target.closest('[data-ask]');
      const mapBtn = ev.target.closest('[data-map]');
      const back = ev.target.closest('.mhm-flip-back');
      const card = ev.target.closest('.mhm-card');
      if (hear) {
        ev.stopPropagation();
        const type = types.find((t) => t.id === hear.getAttribute('data-hear'));
        if (type && typeof root.MhmAskSage === 'function') {
          root.MhmSpeakSage?.(type.history);
        }
        return;
      }
      if (ask) {
        ev.stopPropagation();
        const type = types.find((t) => t.id === ask.getAttribute('data-ask'));
        root.MhmAskSage?.(`Tell me about ${type?.name || 'this type'} — history only, no grow tips.`);
        return;
      }
      if (mapBtn) {
        ev.stopPropagation();
        const type = types.find((t) => t.id === mapBtn.getAttribute('data-map'));
        document.getElementById('mhmOrigins')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const first = (type?.examples || [])[0];
        if (first && window.CannabisOriginsMapInstance?.byId) {
          const id = Object.keys(window.CannabisOriginsMapInstance.byId).find((key) => {
            const pin = window.CannabisOriginsMapInstance.byId[key]?.pin;
            return pin && first.toLowerCase().includes(String(pin.name || '').toLowerCase().split('/')[0].trim());
          });
          if (id) window.setTimeout(() => window.CannabisOriginsMapInstance.focusPin(id), 500);
        }
        return;
      }
      if (back) {
        ev.stopPropagation();
        if (card) flipCard(card, false);
        return;
      }
      if (card) flipCard(card);
    });

    grid.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const card = ev.target.closest('.mhm-card');
      if (!card) return;
      ev.preventDefault();
      flipCard(card);
    });
  }

  async function mount(grid) {
    if (!grid) return [];
    const res = await fetch('/data/mountain-high.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load types');
    const catalog = await res.json();
    const types = catalog.types || [];
    grid.innerHTML = types.map(cardHtml).join('');
    bindGrid(grid, types);
    return types;
  }

  root.MhmTypes = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
