/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
(function () {
  const DATA_URL = '/data/lane-major-achievers.json';

  const ACHIEVER_PORTRAIT_BY_SLUG = Object.freeze({
    'james-h-fitts': '/family/assets/portrait_2_top_right.png',
    'deacon-samuel-lane-stratham': '/family/assets/samuel-lane.png',
    'william-lane-i-boston': '/family/assets/william-e-lane-boston-hero.png',
    'jonathan-homer-lane': '/family/assets/jonathan-homer-lane.png',
    'george-g-lane': '/family/assets/DavidELane.png',
    'levi-e-lane': '/family/assets/DavidELane.png',
    'aaron-g-lane': '/family/assets/aaron-g-lane.png',
    'hampton-monument-committee': '/family/assets/lane-pdf/p4-i0.jpg',
    'cornet-john-lane-chester': '/family/assets/cornet-john-lane.png',
    'sarah-dickinson-captivity': '/family/assets/sarah-dickinson-lane.png',
    'lane-genealogies-volume-i': '/family/assets/lane-genealogies-title-spread.png'
  });

  const gridEl = document.getElementById('lmaGrid');
  const subtitleEl = document.getElementById('lmaSubtitle');
  const statsEl = document.getElementById('lmaStats');
  const tierTabsEl = document.getElementById('lmaTierTabs');
  const categoryChipsEl = document.getElementById('lmaCategoryChips');

  let allAchievers = [];
  let activeTier = 'all';
  let activeCategory = 'all';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCategoryLabel(cat) {
    return String(cat || '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function readInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const tier = String(params.get('tier') || '').trim().toUpperCase();
    if (['A', 'B', 'C'].includes(tier)) activeTier = tier;
    const slug = String(params.get('slug') || '').trim();
    return slug;
  }

  function filteredAchievers() {
    return allAchievers.filter((a) => {
      const tierOk = activeTier === 'all' || a.tier === activeTier;
      const catOk =
        activeCategory === 'all' ||
        (Array.isArray(a.categories) && a.categories.includes(activeCategory));
      return tierOk && catOk;
    });
  }

  function renderPortrait(slug, name) {
    const url = ACHIEVER_PORTRAIT_BY_SLUG[slug];
    if (!url) {
      return `<div class="lma-card__portrait-wrap"><div class="lma-card__portrait lma-card__portrait--placeholder" aria-hidden="true"><i class="bi bi-person"></i></div></div>`;
    }
    return `<div class="lma-card__portrait-wrap"><img class="lma-card__portrait" src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async" /></div>`;
  }

  function renderLinks(achiever) {
    const parts = [];
    const pid = Number(achiever.personId);
    if (Number.isFinite(pid)) {
      parts.push(
        `<a class="btn btn-outline-primary btn-sm" href="/family/lane-memorial-wall.html?personId=${encodeURIComponent(String(pid))}">Memorial wall</a>`
      );
    }
    (Array.isArray(achiever.siteLinks) ? achiever.siteLinks : []).forEach((link) => {
      const primary = link.primary === true;
      parts.push(
        `<a class="btn ${primary ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" href="${esc(link.url)}">${esc(link.label || link.url)}</a>`
      );
    });
    (Array.isArray(achiever.externalLinks) ? achiever.externalLinks : []).forEach((link) => {
      parts.push(
        `<a class="btn btn-outline-secondary btn-sm" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.url)}</a>`
      );
    });
    return parts.length ? `<div class="lma-card__links">${parts.join('')}</div>` : '';
  }

  function renderExpandedBody(achiever) {
    if (!achiever.expandedCard) return '';
    const parts = [];
    if (achiever.detailLead) {
      parts.push(`<p class="lma-card__detail-lead">${esc(achiever.detailLead)}</p>`);
    }
    const bullets = Array.isArray(achiever.detailBullets) ? achiever.detailBullets : [];
    if (bullets.length) {
      parts.push(
        `<ul class="lma-card__detail-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      );
    }
    const routes = Array.isArray(achiever.routeCorridors) ? achiever.routeCorridors : [];
    if (routes.length) {
      parts.push(
        `<div class="lma-card__routes" aria-label="Settlement routes"><span class="lma-card__routes-label">Routes:</span> ${routes.map((r) => `<span class="lma-route-chip">${esc(r)}</span>`).join('')}</div>`
      );
    }
    if (achiever.bookQuote) {
      parts.push(
        `<blockquote class="lma-card__quote"><strong>Evidence:</strong> ${esc(achiever.bookQuote)}</blockquote>`
      );
    }
    const gallery = Array.isArray(achiever.galleryImages) ? achiever.galleryImages : [];
    if (gallery.length) {
      const thumbs = gallery
        .map(
          (g) =>
            `<figure class="lma-card__gallery-item"><img src="${esc(g.url)}" alt="${esc(g.alt || achiever.displayName)}" loading="lazy" decoding="async" /><figcaption>${esc(g.caption || '')}</figcaption></figure>`
        )
        .join('');
      parts.push(`<div class="lma-card__gallery">${thumbs}</div>`);
    }
    return parts.length ? `<div class="lma-card__expanded">${parts.join('')}</div>` : '';
  }

  function renderCard(achiever, highlightSlug) {
    const tierClass = `lma-badge--tier-${String(achiever.tier || 'b').toLowerCase()}`;
    const categories = Array.isArray(achiever.categories) ? achiever.categories : [];
    const catMarkup = categories.length
      ? `<div class="lma-card__categories">${categories.map((c) => `<span class="lma-cat-chip">${esc(formatCategoryLabel(c))}</span>`).join('')}</div>`
      : '';
    const verify = achiever.verificationStatus
      ? `<span class="lma-badge lma-badge--verify">${esc(achiever.verificationStatus)}</span>`
      : '';
    const highlight = highlightSlug && achiever.slug === highlightSlug ? ' is-highlight' : '';
    const expandedClass = achiever.expandedCard ? ' lma-card--expanded' : '';

    return `
      <article class="lma-card${expandedClass}${highlight}" id="achiever-${esc(achiever.slug)}" data-slug="${esc(achiever.slug)}" data-tier="${esc(achiever.tier)}">
        ${renderPortrait(achiever.slug, achiever.displayName)}
        <div class="lma-card__body">
          <div class="lma-card__head">
            <h2 class="lma-card__name">${esc(achiever.displayName)}</h2>
            <span class="lma-badge ${tierClass}">Tier ${esc(achiever.tier)}</span>
            ${verify}
          </div>
          <p class="lma-card__meta">${esc(achiever.eraLabel || '')}${achiever.branch ? ` · ${esc(achiever.branch)}` : ''}</p>
          <p class="lma-card__summary">${esc(achiever.achievementSummary || '')}</p>
          ${renderExpandedBody(achiever)}
          ${catMarkup}
          ${renderLinks(achiever)}
        </div>
      </article>
    `;
  }

  function renderGrid(highlightSlug) {
    if (!gridEl) return;
    const list = filteredAchievers();
    if (!list.length) {
      gridEl.innerHTML = '<p class="text-muted small mb-0">No achievers match the current filters.</p>';
      return;
    }
    gridEl.innerHTML = list.map((a) => renderCard(a, highlightSlug)).join('');
    if (highlightSlug) {
      const el = document.getElementById(`achiever-${highlightSlug}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function bindTierTabs(stats) {
    if (!tierTabsEl) return;
    const tiers = [
      { id: 'all', label: `All (${stats.totalAchievers || allAchievers.length})` },
      { id: 'A', label: `Tier A (${stats.tierA || 0})` },
      { id: 'B', label: `Tier B (${stats.tierB || 0})` },
      { id: 'C', label: `Tier C (${stats.tierC || 0})` }
    ];
    tierTabsEl.innerHTML = tiers
      .map(
        (t) =>
          `<button type="button" class="btn btn-outline-secondary${activeTier === t.id ? ' active' : ''}" data-tier="${esc(t.id)}" aria-pressed="${activeTier === t.id}">${esc(t.label)}</button>`
      )
      .join('');
    tierTabsEl.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTier = btn.getAttribute('data-tier') || 'all';
        tierTabsEl.querySelectorAll('[data-tier]').forEach((b) => {
          const on = b.getAttribute('data-tier') === activeTier;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderGrid();
      });
    });
  }

  function bindCategoryChips() {
    if (!categoryChipsEl) return;
    const cats = new Set();
    allAchievers.forEach((a) => {
      (Array.isArray(a.categories) ? a.categories : []).forEach((c) => cats.add(c));
    });
    const sorted = [...cats].sort();
    categoryChipsEl.innerHTML = [
      `<button type="button" class="btn btn-sm btn-outline-secondary${activeCategory === 'all' ? ' active' : ''}" data-cat="all">All categories</button>`,
      ...sorted.map(
        (c) =>
          `<button type="button" class="btn btn-sm btn-outline-secondary${activeCategory === c ? ' active' : ''}" data-cat="${esc(c)}">${esc(formatCategoryLabel(c))}</button>`
      )
    ].join('');
    categoryChipsEl.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.getAttribute('data-cat') || 'all';
        categoryChipsEl.querySelectorAll('[data-cat]').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-cat') === activeCategory);
        });
        renderGrid();
      });
    });
  }

  async function load() {
    const highlightSlug = readInitialFilters();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load achievers (${res.status})`);
      const data = await res.json();
      allAchievers = Array.isArray(data.achievers) ? data.achievers : [];
      const stats = data.stats || {};

      if (subtitleEl) {
        const book = esc(data.sourceBook || 'Lane Genealogies Vol. I');
        const bookUrl = esc(data.sourceBookUrl || 'https://archive.org/details/lanegenealogies01chap');
        subtitleEl.innerHTML = `Curated from <a href="${bookUrl}" target="_blank" rel="noopener noreferrer">${book}</a> and existing site curation.`;
      }
      if (statsEl) {
        statsEl.textContent = `${stats.totalAchievers || allAchievers.length} documented · Tier A ${stats.tierA || 0} · Tier B ${stats.tierB || 0} · Tier C ${stats.tierC || 0}`;
      }

      bindTierTabs(stats);
      bindCategoryChips();
      renderGrid(highlightSlug);
    } catch (err) {
      if (gridEl) {
        gridEl.innerHTML = `<p class="text-danger small mb-0" role="alert">${esc(err.message || 'Failed to load achievers')}</p>`;
      }
    }
  }

  load();
})();
