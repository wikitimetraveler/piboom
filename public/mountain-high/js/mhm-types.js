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
    return root.MhmLeafIcon?.svgMarkup({ className: 'mhm-leaf-mark' })
      || `<svg class="mhm-leaf-mark" viewBox="0 0 100 100" aria-hidden="true">
      <path fill="currentColor" d="M50 4C51.5 14 53 20 50 26C58 16 68 18 76 28C71 34 66 40 69 48C79 46 87 54 90 64C80 64 70 67 64 74C62 81 57 88 50 96C43 88 38 81 36 74C30 67 20 64 10 64C13 54 21 46 31 48C34 40 29 34 24 28C32 18 42 16 50 26C47 20 48.5 14 50 4Z"/>
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
