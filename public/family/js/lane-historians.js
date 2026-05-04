/**
 * Lane Historians page — loads curated copy from GET /data/lane-historians.json
 */
(function () {
  'use strict';

  const DATA_URL = '/data/lane-historians.json';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function paragraphsHtml(arr) {
    if (!Array.isArray(arr)) return '';
    return arr
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('');
  }

  function figureSlug(raw) {
    const s = String(raw || '')
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72);
    return s || '';
  }

  function renderFigures(figures) {
    if (!Array.isArray(figures) || !figures.length) return '';
    const cards = figures
      .map((f) => {
        const name = escapeHtml(f.displayName || '');
        const role = escapeHtml(f.role || '');
        const note = escapeHtml(f.bookNote || '');
        const slug = figureSlug(f.slug);
        const idAttr = slug ? ` id="lh-portrait-${escapeHtml(slug)}"` : '';
        const pUrl = String(f.portraitUrl || '').trim();
        const portraitHtml = pUrl
          ? `<div class="lane-historians-figure-portrait-wrap"><img src="${escapeHtml(pUrl)}" alt="${name}" class="lane-historians-figure-portrait" loading="lazy" decoding="async" /></div>`
          : '';
        const gh = String(f.galleryHref || '').trim();
        const gallHtml = gh
          ? `<p class="lh-figure-gallery small mb-0"><a href="${escapeHtml(gh)}">Open full plate <span class="lh-plate-tag">p4-i0</span> in book gallery</a></p>`
          : '';
        return `<article class="lane-historians-figure-card"${idAttr} tabindex="-1">${portraitHtml}<h3>${name}</h3><p class="role">${role}</p><p class="note">${note}</p>${gallHtml}</article>`;
      })
      .join('');
    return `<div class="lane-historians-figure-grid">${cards}</div>`;
  }

  function renderTimeline(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lis = items
      .map((t) => {
        const y = escapeHtml(t.yearLabel || '');
        const s = escapeHtml(t.summary || '');
        return `<li><div class="year">${y}</div><p class="summary">${s}</p></li>`;
      })
      .join('');
    return `<ul class="lane-historians-timeline">${lis}</ul>`;
  }

  function renderLinks(links) {
    if (!Array.isArray(links) || !links.length) return '';
    const lis = links
      .map((l) => {
        const url = String(l.url || '').trim();
        const label = escapeHtml(l.label || url);
        if (!url) return '';
        const safeUrl = escapeHtml(url);
        return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
      })
      .filter(Boolean)
      .join('');
    if (!lis) return '';
    return `<ul class="lane-historians-links">${lis}</ul>`;
  }

  function renderModern(modern, placeholder) {
    if (Array.isArray(modern) && modern.length) {
      const cards = modern
        .map((m) => {
          const name = escapeHtml(m.displayName || '');
          const role = escapeHtml(m.role || '');
          const bio = escapeHtml(m.bio || '');
          return `<div class="lane-historians-figure-card mb-2"><h3>${name}</h3><p class="role">${role}</p><p class="note">${bio}</p></div>`;
        })
        .join('');
      return `<div class="lane-historians-modern">${cards}</div>`;
    }
    const ph = String(placeholder || '').trim();
    if (!ph) return '';
    return `<div class="lane-historians-modern"><p class="mb-0">${escapeHtml(ph)}</p></div>`;
  }

  function renderPublication(pub) {
    if (!pub || typeof pub !== 'object') return '';
    const vol = escapeHtml(pub.volumeTitle || '');
    const authors = escapeHtml(pub.authors || '');
    const imprint = escapeHtml(pub.imprint || '');
    const lines = Array.isArray(pub.subjectLines)
      ? pub.subjectLines.map((s) => `<div>${escapeHtml(s)}</div>`).join('')
      : '';
    return `<div class="lane-historians-publication"><div class="lh-vol">${vol}</div>${lines}<p class="mb-1 mt-2">${authors}</p><p class="mb-0 small text-muted">${imprint}</p></div>`;
  }

  function render(data) {
    const root = document.getElementById('historiansRoot');
    if (!root) return;

    const title = escapeHtml(data.title || 'Lane historians');
    const subtitle = escapeHtml(data.subtitle || '');
    const heroUrl = escapeHtml(data.heroImageUrl || '');
    const heroAlt = escapeHtml(data.heroImageAlt || '');
    const heroCap = escapeHtml(data.heroCaption || '');
    const lead = paragraphsHtml(data.prefaceLeadParagraphs);
    const more = paragraphsHtml(data.prefaceMoreParagraphs);
    const illNote = data.illustrationsIndexNote ? `<p class="small text-muted">${escapeHtml(data.illustrationsIndexNote)}</p>` : '';
    const notes = data.notes ? `<p class="lane-historians-meta">${escapeHtml(data.notes)}</p>` : '';

    const gFull = String(data.galleryFullPlateHref || '').trim();
    const heroGallery =
      gFull ?
        `<p class="small mt-2 mb-0"><a href="${escapeHtml(gFull)}">Book gallery · full opening plate (filters to PDF page 4)</a></p>`
      : '';

    const heroBlock =
      heroUrl ?
        `<div class="lane-historians-hero"><div class="lane-historians-hero__frame"><img class="lane-historians-hero__img" src="${heroUrl}" alt="${heroAlt}" width="880" height="520" decoding="async" loading="lazy" /></div><p class="lane-historians-hero__caption">${heroCap}</p>${heroGallery}</div>`
      : '';

    const prefaceMoreBlock =
      more ?
        `<details class="mt-2"><summary>Rest of preface (book narrative)</summary><div class="lane-historians-prose mt-2">${more}</div></details>`
      : '';

    root.innerHTML = `
      ${heroBlock}
      <h1 class="lane-historians-title">${title}</h1>
      ${subtitle ? `<p class="lane-historians-subtitle">${subtitle}</p>` : ''}
      <p class="history-context-evidence-note small">Context: general publishing and family-committee history. Evidence: verify names, dates, and quotations in <a href="https://archive.org/details/lanegenealogies01chap" target="_blank" rel="noopener noreferrer">Lane Genealogies Vol. I (facsimile)</a>.</p>
      <section class="lane-historians-section" aria-labelledby="lh-pub-heading"><h2 id="lh-pub-heading">Title page (1891)</h2>${renderPublication(data.publication)}</section>
      <section class="lane-historians-section" aria-labelledby="lh-fig-heading"><h2 id="lh-fig-heading">Portraits & named compilers</h2>${renderFigures(data.figures)}</section>
      <section class="lane-historians-section" aria-labelledby="lh-time-heading"><h2 id="lh-time-heading">Lineage of the work</h2>${renderTimeline(data.timeline)}</section>
      <section class="lane-historians-section" aria-labelledby="lh-pref-heading"><h2 id="lh-pref-heading">From Chapman’s preface</h2><div class="lane-historians-prose">${lead}</div>${prefaceMoreBlock}</section>
      <section class="lane-historians-section" aria-labelledby="lh-link-heading"><h2 id="lh-link-heading">External sources</h2>${renderLinks(data.externalLinks)}${illNote}</section>
      <section class="lane-historians-section" aria-labelledby="lh-mod-heading"><h2 id="lh-mod-heading">Carrying the record forward</h2>${renderModern(data.modernHistorians, data.modernHistoriansPlaceholder)}</section>
      ${notes}
    `;
  }

  function showError(msg) {
    const root = document.getElementById('historiansRoot');
    if (!root) return;
    root.innerHTML = `<div class="lane-historians-error" role="alert">${escapeHtml(msg)}</div>`;
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`Could not load ${DATA_URL} (${res.status})`);
      const data = await res.json();
      render(data);
      document.title = `${data.title || 'Lane historians'} — DevConnect Labs`;
      try {
        const h = window.location.hash;
        if (h && /^#lh-portrait-[a-z0-9-]+$/i.test(h)) {
          requestAnimationFrame(() => {
            const el = document.querySelector(h);
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      console.error(e);
      showError(e.message || 'Historians content is unavailable.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
