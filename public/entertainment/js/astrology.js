/**
 * Astrology page — wheel, gallery, starfield, birthday finder.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const Z = typeof AstrologyZodiac !== 'undefined' ? AstrologyZodiac : null;
  if (!Z) return;

  const MONTHS = [
    ['1', 'January'],
    ['2', 'February'],
    ['3', 'March'],
    ['4', 'April'],
    ['5', 'May'],
    ['6', 'June'],
    ['7', 'July'],
    ['8', 'August'],
    ['9', 'September'],
    ['10', 'October'],
    ['11', 'November'],
    ['12', 'December'],
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selectedId = '';
  let elementFilter = 'all';
  let skyRaf = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function fillSelect(select, items) {
    if (!select) return;
    select.innerHTML = items
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');
  }

  function wheelMarkup() {
    return Z.SIGNS.map((sign, index) => {
      const angle = index * 30;
      return `<div class="astro-slot-arm" style="--angle:${angle}deg">
        <button type="button" class="astro-slot" data-sign="${sign.id}" data-element="${sign.element}" style="--angle:${angle}deg" aria-pressed="false">
          <span class="astro-slot__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
          <span class="astro-slot__label">${sign.name}</span>
        </button>
      </div>`;
    }).join('');
  }

  function galleryMarkup() {
    return Z.SIGNS.map((sign) => `<button type="button" class="astro-card" data-sign="${sign.id}" data-element="${sign.element}" aria-pressed="false">
      <div class="astro-card__top">
        <span class="astro-card__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
        <span class="astro-chip">${sign.element}</span>
      </div>
      <h3>${sign.name}</h3>
      <p>${sign.dates}</p>
      <p>${sign.kicker}</p>
    </button>`).join('');
  }

  function renderDetail(sign) {
    const panel = $('astroDetail');
    const glyph = $('astroCoreGlyph');
    const name = $('astroCoreName');
    if (!panel || !sign) return;
    panel.dataset.element = sign.element;
    panel.innerHTML = `
      <div class="astro-detail__meta">
        <span class="astro-chip">${sign.element}</span>
        <span class="astro-chip">${sign.modality}</span>
        <span class="astro-chip">${sign.ruler}</span>
      </div>
      <h2 id="astroDetailTitle">${Z.textGlyph(sign)} ${sign.name}</h2>
      <p class="astro-detail__dates">${sign.dates} · ${sign.symbol}</p>
      ${Z.constellationSvg(sign)}
      <p>${sign.blurb}</p>
      <ul class="astro-traits">${sign.traits.map((trait) => `<li>${trait}</li>`).join('')}</ul>
    `;
    if (glyph) glyph.textContent = Z.textGlyph(sign);
    if (name) name.textContent = sign.name;
  }

  function applyFilter() {
    document.querySelectorAll('.astro-card').forEach((card) => {
      const show = elementFilter === 'all' || card.dataset.element === elementFilter;
      card.hidden = !show;
    });
  }

  function selectSign(id, opts) {
    const sign = Z.signById(id);
    if (!sign) return;
    selectedId = sign.id;
    renderDetail(sign);
    document.querySelectorAll('[data-sign]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.sign === sign.id));
    });
    if (!opts || opts.syncUrl !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set('sign', sign.id);
      url.hash = '';
      history.replaceState(null, '', url.pathname + url.search);
    }
  }

  function todaysSign() {
    return Z.signForDate(new Date()) || Z.SIGNS[0];
  }

  function bindClicks(root) {
    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-sign]');
      if (!btn || !root.contains(btn)) return;
      selectSign(btn.dataset.sign);
    });
  }

  function startSky() {
    const canvas = $('astroSky');
    if (!canvas || reduceMotion || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = [];
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const count = width < 700 ? 70 : 120;
      stars.length = 0;
      for (let i = 0; i < count; i += 1) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.4 + 0.3,
          tw: Math.random() * Math.PI * 2,
          sp: 0.008 + Math.random() * 0.02,
        });
      }
    }

    function tick() {
      if (document.hidden) {
        skyRaf = requestAnimationFrame(tick);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        star.tw += star.sp;
        const a = 0.25 + Math.abs(Math.sin(star.tw)) * 0.7;
        ctx.fillStyle = `rgba(255, 246, 216, ${a})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      skyRaf = requestAnimationFrame(tick);
    }

    resize();
    seed();
    tick();
    window.addEventListener('resize', () => {
      resize();
      seed();
    });
  }

  function init() {
    const slots = $('astroSlots');
    const gallery = $('astroGallery');
    const month = $('astroMonth');
    const day = $('astroDay');
    const form = $('astroFinder');
    const filters = $('astroFilters');

    fillSelect(month, MONTHS);
    fillSelect(day, Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)]));

    if (slots) slots.innerHTML = wheelMarkup();
    if (gallery) gallery.innerHTML = galleryMarkup();

    const now = new Date();
    if (month) month.value = String(now.getMonth() + 1);
    if (day) day.value = String(now.getDate());

    if (slots) bindClicks(slots);
    if (gallery) bindClicks(gallery);

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const sign = Z.signForMonthDay(Number(month.value), Number(day.value));
      const status = $('astroFinderStatus');
      if (!sign) {
        if (status) status.textContent = 'That date is not on the tropical wheel.';
        return;
      }
      if (status) status.textContent = `${sign.name} · ${sign.dates}`;
      selectSign(sign.id);
    });

    filters?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-element-filter]');
      if (!btn) return;
      elementFilter = btn.dataset.elementFilter;
      filters.querySelectorAll('[data-element-filter]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === btn));
      });
      applyFilter();
    });

    const fromQuery = Z.parseSignQuery(window.location.search) || Z.parseSignQuery(window.location.hash);
    selectSign((fromQuery || todaysSign()).id, { syncUrl: Boolean(fromQuery) });
    startSky();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pagehide', () => {
    if (skyRaf) cancelAnimationFrame(skyRaf);
  });
})();
