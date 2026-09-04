/**
 * Mountain High bag mockups — concept packaging only
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

  function cardHtml(bag) {
    const tags = (bag.tags || [])
      .map((t) => `<span class="mhm-tag">${esc(t)}</span>`)
      .join('');
    return `<article class="mhm-card mhm-bag" data-id="${esc(bag.id)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(bag.name)} mockup — flip for the story" style="--mhm-type:${esc(bag.swatch || '#9dffc4')}">
      <div class="mhm-card-inner">
        <div class="mhm-face mhm-face--front mhm-bag-face">
          <p class="mhm-bag-stamp" aria-hidden="true">MOCKUP</p>
          <img class="mhm-bag-art lane-lightbox-ignore" src="${esc(bag.image)}" alt="${esc(bag.name)} — concept mockup, not for sale" width="360" height="480" data-lane-lightbox-ignore="1"/>
          <p class="mhm-card-kicker">${esc(bag.kicker || 'Mockup')}</p>
          <h3>${esc(bag.name)}</h3>
          <p class="mhm-tagline">${esc(bag.tagline || '')}</p>
          <div class="mhm-tags">${tags}</div>
          <p class="mhm-flip-hint"><i class="bi bi-arrow-repeat"></i> Flip for cultivation talk</p>
        </div>
        <div class="mhm-face mhm-face--back">
          <div class="mhm-back-scroll">
            <p class="mhm-card-kicker">Mockup · ${esc(bag.grow)} ${esc(bag.kind)}</p>
            <h3>${esc(bag.name)}</h3>
            <p>${esc(bag.story || '')}</p>
            <p class="mhm-tagline">${esc(bag.cultivationNote || '')}</p>
          </div>
          <div class="mhm-back-actions">
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

  function bindGrid(grid) {
    grid.addEventListener('click', (ev) => {
      const card = ev.target.closest('.mhm-card');
      if (!card) return;
      ev.preventDefault();
      flipCard(card);
    });
    grid.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const card = ev.target.closest('.mhm-card');
      if (!card) return;
      ev.preventDefault();
      flipCard(card);
    });
  }

  async function mount(grid, bags) {
    if (!grid) return [];
    let list = Array.isArray(bags) ? bags : null;
    if (!list) {
      const res = await fetch('/data/mountain-high.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load bag mockups');
      const catalog = await res.json();
      list = catalog.bags || [];
    }
    grid.innerHTML = list.map(cardHtml).join('');
    bindGrid(grid);
    return list;
  }

  root.MhmBags = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
