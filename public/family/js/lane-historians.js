/**
 * Lane Historians page — curated copy from GET /data/lane-historians.json + HyperFrames story mode
 */
(function () {
  'use strict';

  const DATA_URL = '/data/lane-historians.json';
  const STORAGE_HISTORIANS_NARRATE_V2 = 'laneHistoriansStoryNarrateV2';
  const STORAGE_HISTORIANS_NARRATE_LEGACY = 'laneHistoriansStoryNarrate';
  const HISTORIANS_SCENE_DURATION_MS = 4200;
  const HISTORIANS_SCENE_GAP_MS = 200;

  let historiansDataRef = null;
  let historiansStorySpeakToken = 0;
  let historiansStoryFloatResolveAnchor = null;
  let historiansStoryFloatScrollBound = false;
  let historiansStoryFloatReflowScheduled = false;
  const historiansStoryState = {
    running: false,
    playbackToken: 0,
    scenes: []
  };

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

  function truncateHistCopy(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1))}…`;
  }

  function archiveUrlFromData(data) {
    const links = Array.isArray(data?.externalLinks) ? data.externalLinks : [];
    const row = links.find((l) => String(l.kind || '').toLowerCase() === 'archive') || links[1] || links[0];
    return String(row?.url || '').trim();
  }

  function renderArchiveCallout(data) {
    const hi = String(data.archiveHighlight || '').trim();
    if (!hi) return '';
    const cite = String(data.preferredCitationExample || '').trim();
    const url = archiveUrlFromData(data);
    const link =
      url ?
        `<p class="small mb-0 mt-2"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">NHHS collection record →</a></p>`
      : '';
    const citeHtml = cite ? `<p class="small text-muted lh-archive-citation mb-0 mt-2"><cite>${escapeHtml(cite)}</cite></p>` : '';
    return `
      <div id="lh-archive-nhhs" class="lh-archive-evidence-callout lh-story-highlight-target" tabindex="-1">
        <p class="small mb-1 lh-archive-evidence-title"><strong>Evidence — manuscript holdings</strong></p>
        <p class="small mb-2">${escapeHtml(hi)}</p>
        ${citeHtml}
        ${link}
      </div>`;
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
          ? `<div class="lane-historians-figure-portrait-wrap"><img src="${escapeHtml(pUrl)}" alt="${name}" class="lane-historians-figure-portrait lh-expandable-image" loading="lazy" decoding="async" tabindex="0" role="button" aria-label="Expand image for ${name}" /></div>`
          : '';
        const gh = String(f.galleryHref || '').trim();
        const gallHtml = gh
          ? `<p class="lh-figure-gallery small mb-0"><a href="${escapeHtml(gh)}">Open full plate <span class="lh-plate-tag">p4-i0</span> in book gallery</a></p>`
          : '';
        return `<article class="lane-historians-figure-card lh-story-highlight-target"${idAttr} tabindex="-1">${portraitHtml}<h3>${name}</h3><p class="role">${role}</p><p class="note">${note}</p>${gallHtml}</article>`;
      })
      .join('');
    return `<div class="lane-historians-figure-grid">${cards}</div>`;
  }

  function renderTimeline(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lis = items
      .map((t, idx) => {
        const y = escapeHtml(t.yearLabel || '');
        const s = escapeHtml(t.summary || '');
        const idAttr = ` id="lh-timeline-${idx}"`;
        return `<li class="lh-story-highlight-target"${idAttr} tabindex="-1"><div class="year">${y}</div><p class="summary">${s}</p></li>`;
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
      const linksHtml = (links) => {
        if (!Array.isArray(links) || !links.length) return '';
        const rows = links
          .map((entry) => {
            const url = String(entry?.url || '').trim();
            const label = String(entry?.label || url).trim();
            if (!url || !label) return '';
            return `<li><a href="${escapeHtml(url)}" ${url.startsWith('/') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${escapeHtml(label)}</a></li>`;
          })
          .filter(Boolean)
          .join('');
        if (!rows) return '';
        return `<ul class="lh-modern-links mb-0 mt-2">${rows}</ul>`;
      };
      const cards = modern
        .map((m) => {
          const name = escapeHtml(m.displayName || '');
          const role = escapeHtml(m.role || '');
          const bio = escapeHtml(m.bio || '');
          const tagline = escapeHtml(m.tagline || '');
          const pUrl = String(m.imageUrl || m.image || '').trim();
          const portraitHtml = pUrl
            ? `<div class="lane-historians-figure-portrait-wrap"><img src="${escapeHtml(pUrl)}" alt="${name}" class="lane-historians-figure-portrait lh-expandable-image" loading="lazy" decoding="async" tabindex="0" role="button" aria-label="Expand image for ${name}" /></div>`
            : '';
          return `<div class="lane-historians-figure-card mb-2 lh-story-highlight-target">${portraitHtml}<h3>${name}</h3><p class="role">${role}</p><p class="note">${bio}</p>${tagline ? `<p class="lh-modern-tagline">${tagline}</p>` : ''}${linksHtml(m.links)}</div>`;
        })
        .join('');
      return `<div class="lane-historians-modern">${cards}</div>`;
    }
    const ph = String(placeholder || '').trim();
    if (!ph) return '';
    return `<div class="lane-historians-modern lh-story-highlight-target"><p class="mb-0">${escapeHtml(ph)}</p></div>`;
  }

  function renderPublication(pub) {
    if (!pub || typeof pub !== 'object') return '';
    const vol = escapeHtml(pub.volumeTitle || '');
    const authors = escapeHtml(pub.authors || '');
    const imprint = escapeHtml(pub.imprint || '');
    const lines = Array.isArray(pub.subjectLines)
      ? pub.subjectLines.map((s) => `<div>${escapeHtml(s)}</div>`).join('')
      : '';
    return `<div class="lane-historians-publication lh-story-highlight-target"><div class="lh-vol">${vol}</div>${lines}<p class="mb-1 mt-2">${authors}</p><p class="mb-0 small text-muted">${imprint}</p></div>`;
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
        `<div class="lane-historians-hero lh-story-highlight-target"><div class="lane-historians-hero__frame"><img class="lane-historians-hero__img lh-expandable-image" src="${heroUrl}" alt="${heroAlt}" width="880" height="520" decoding="async" loading="lazy" tabindex="0" role="button" aria-label="Expand hero image" /></div><p class="lane-historians-hero__caption">${heroCap}</p>${heroGallery}</div>`
      : '';

    const prefaceMoreBlock =
      more ?
        `<details class="mt-2"><summary>Rest of preface (book narrative)</summary><div class="lane-historians-prose mt-2">${more}</div></details>`
      : '';

    root.innerHTML = `
      <div id="lh-story-intro" class="lh-story-anchor lh-story-highlight-target" tabindex="-1" aria-label="Story start"></div>
      ${heroBlock}
      <h1 class="lane-historians-title">${title}</h1>
      ${subtitle ? `<p class="lane-historians-subtitle">${subtitle}</p>` : ''}
      <p class="history-context-evidence-note small">Context: general publishing and family-committee history. Evidence: verify names, dates, and quotations in <a href="https://archive.org/details/lanegenealogies01chap" target="_blank" rel="noopener noreferrer">Lane Genealogies Vol. I (facsimile)</a>.</p>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-pub-heading"><h2 id="lh-pub-heading">Title page (1891)</h2>${renderPublication(data.publication)}</section>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-fig-heading"><h2 id="lh-fig-heading">Portraits & named compilers</h2>${renderFigures(data.figures)}</section>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-time-heading"><h2 id="lh-time-heading">Lineage of the work</h2>${renderTimeline(data.timeline)}</section>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-pref-heading"><h2 id="lh-pref-heading">From Chapman’s preface</h2><div class="lane-historians-prose lh-story-highlight-target">${lead}</div>${prefaceMoreBlock}</section>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-link-heading"><h2 id="lh-link-heading">External sources</h2>${renderLinks(data.externalLinks)}${renderArchiveCallout(data)}${illNote}</section>
      <section class="lane-historians-section lh-story-highlight-parent" aria-labelledby="lh-mod-heading"><h2 id="lh-mod-heading">Carrying the record forward</h2>${renderModern(data.modernHistorians, data.modernHistoriansPlaceholder)}</section>
      ${notes}
    `;
  }

  /* --- HyperFrames story mode --- */

  function buildHistoriansStoryScenes(data) {
    const scenes = [];
    if (!data || typeof data !== 'object') return scenes;

    scenes.push({
      kind: 'intro',
      anchorId: 'lh-story-intro',
      kicker: 'Lane historians',
      title: truncateHistCopy(data.title || 'Historians', 80),
      copy: truncateHistCopy(data.subtitle || '', 220),
      narration: `${data.title || 'Lane historians'}. ${truncateHistCopy(data.subtitle || '', 340)}`,
      durationMs: HISTORIANS_SCENE_DURATION_MS
    });

    const pub = data.publication || {};
    const subj = Array.isArray(pub.subjectLines) ? pub.subjectLines.slice(0, 2).join(' ') : '';
    scenes.push({
      kind: 'section',
      anchorId: 'lh-pub-heading',
      kicker: 'Title page',
      title: truncateHistCopy(pub.volumeTitle || 'Volume I', 120),
      copy: truncateHistCopy(subj, 260),
      narration: `Title page. ${pub.volumeTitle || ''}. ${truncateHistCopy(subj, 300)}`,
      durationMs: HISTORIANS_SCENE_DURATION_MS
    });

    (Array.isArray(data.figures) ? data.figures : []).forEach((f) => {
      const slug = figureSlug(f.slug);
      if (!slug) return;
      const dn = String(f.displayName || 'Portrait');
      scenes.push({
        kind: 'card',
        anchorId: `lh-portrait-${slug}`,
        kicker: 'Portraits · compilers',
        title: truncateHistCopy(dn, 100),
        copy: truncateHistCopy([f.role, f.bookNote].filter(Boolean).join(' '), 220),
        narration: `${dn}. ${truncateHistCopy(`${f.role || ''}. ${f.bookNote || ''}`, 340)}`,
        durationMs: HISTORIANS_SCENE_DURATION_MS
      });
    });

    (Array.isArray(data.timeline) ? data.timeline : []).forEach((t, idx) => {
      const lbl = String(t.yearLabel || 'Era').trim();
      scenes.push({
        kind: 'timeline',
        anchorId: `lh-timeline-${idx}`,
        kicker: 'Lineage of the work',
        title: lbl,
        copy: truncateHistCopy(t.summary || '', 240),
        narration: `${lbl}. ${truncateHistCopy(t.summary || '', 360)}`,
        durationMs: HISTORIANS_SCENE_DURATION_MS
      });
    });

    const pref0 =
      Array.isArray(data.prefaceLeadParagraphs) && data.prefaceLeadParagraphs.length ?
        String(data.prefaceLeadParagraphs[0] || '').trim()
      : '';
    if (pref0) {
      scenes.push({
        kind: 'preface',
        anchorId: 'lh-pref-heading',
        kicker: 'Preface',
        title: 'Chapman opens',
        copy: truncateHistCopy(pref0, 240),
        narration: truncateHistCopy(pref0, 500),
        durationMs: HISTORIANS_SCENE_DURATION_MS + 600
      });
    }

    scenes.push({
      kind: 'sources',
      anchorId: 'lh-link-heading',
      kicker: 'Sources',
      title: 'External sources & citations',
      copy: 'Digital facsimile, repository links, and manuscript context on this screen.',
      narration: 'External sources — use the Lane Genealogies facsimile and repository links beside this passage for evidence.',
      durationMs: 3600
    });

    const ah = String(data.archiveHighlight || '').trim();
    if (ah) {
      const citeLine = String(data.preferredCitationExample || '').trim();
      const narrParts = [truncateHistCopy(ah, citeLine ? 320 : 400)];
      if (citeLine) narrParts.push(citeLine);
      scenes.push({
        kind: 'archive',
        anchorId: 'lh-archive-nhhs',
        kicker: 'NH Historical Society',
        title: 'Lane Family Papers',
        copy: truncateHistCopy(ah, 260),
        narration: narrParts.join(' '),
        durationMs: HISTORIANS_SCENE_DURATION_MS + 400
      });
    }

    scenes.push({
      kind: 'modern',
      anchorId: 'lh-mod-heading',
      kicker: 'Carrying forward',
      title: 'Later compilers on this site',
      copy:
        Array.isArray(data.modernHistorians) && data.modernHistorians.length ?
          truncateHistCopy(
            `${data.modernHistorians[0].displayName || ''}: ${data.modernHistorians[0].role || ''}`,
            220
          )
        : truncateHistCopy(String(data.modernHistoriansPlaceholder || ''), 220),
      narration: truncateHistCopy(String(data.modernHistoriansPlaceholder || 'Space for narrating who carries the Lane record forward today.'), 320),
      durationMs: HISTORIANS_SCENE_DURATION_MS
    });

    return scenes;
  }

  function updateHistoriansStoryToggle() {
    const toggle = document.getElementById('historiansStoryToggle');
    if (!toggle) return;
    const ok = historiansDataRef != null && buildHistoriansStoryScenes(historiansDataRef).length > 0;
    toggle.disabled = !(ok || historiansStoryState.running);
    toggle.setAttribute('aria-pressed', historiansStoryState.running ? 'true' : 'false');
    toggle.textContent = historiansStoryState.running ? 'Pause highlight reel' : 'Play highlight reel';
  }

  function unbindHistoriansStoryFloatListeners() {
    if (!historiansStoryFloatScrollBound) return;
    window.removeEventListener('scroll', onHistoriansStoryFloatingReflow, true);
    window.removeEventListener('resize', onHistoriansStoryFloatingReflow);
    historiansStoryFloatScrollBound = false;
  }

  function onHistoriansStoryFloatingReflow() {
    if (!historiansStoryState.running) return;
    const overlay = document.getElementById('historiansStoryOverlay');
    if (!overlay || overlay.classList.contains('d-none')) return;
    if (historiansStoryFloatReflowScheduled) return;
    historiansStoryFloatReflowScheduled = true;
    window.requestAnimationFrame(() => {
      historiansStoryFloatReflowScheduled = false;
      repositionHistoriansStoryFloatingNugget();
    });
  }

  function bindHistoriansStoryFloatListeners() {
    if (historiansStoryFloatScrollBound) return;
    window.addEventListener('scroll', onHistoriansStoryFloatingReflow, true);
    window.addEventListener('resize', onHistoriansStoryFloatingReflow);
    historiansStoryFloatScrollBound = true;
  }

  function clearHistoriansFloatingOverlayStyles() {
    const overlay = document.getElementById('historiansStoryOverlay');
    if (!overlay) return;
    overlay.classList.remove('lh-story-overlay--floating');
    overlay.style.left = '';
    overlay.style.right = '';
    overlay.style.top = '';
    overlay.style.bottom = '';
    overlay.style.transform = '';
    overlay.style.width = '';
    overlay.style.maxWidth = '';
  }

  function historiansStoryClamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function positionHistoriansStoryFloatingNear(anchorEl) {
    const overlay = document.getElementById('historiansStoryOverlay');
    if (!overlay || overlay.classList.contains('d-none')) return;

    const pad = 10;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    overlay.classList.add('lh-story-overlay--floating');

    const anchor = anchorEl instanceof Element ? anchorEl : null;

    function placeFallbackCenter() {
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.left = '50%';
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      overlay.style.top = `${Math.round(historiansStoryClamp(Math.min(vh * 0.2, Math.max(vh * 0.12, pad + 72)), pad, vh * 0.32))}px`;
      overlay.style.width = `${Math.round(Math.min(340, vw - 2 * pad))}px`;
    }

    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      placeFallbackCenter();
      return;
    }

    const r = anchor.getBoundingClientRect();
    const narrow = vw <= 576;

    if (narrow) {
      overlay.style.transform = '';
      const w = Math.round(Math.min(340, vw - 18));
      let left = r.left + r.width / 2 - w / 2;
      left = historiansStoryClamp(left, pad, vw - w - pad);
      let top = r.bottom + gap;
      overlay.style.left = `${Math.round(left)}px`;
      overlay.style.right = 'auto';
      overlay.style.width = `${w}px`;
      overlay.style.bottom = 'auto';
      overlay.style.top = `${Math.round(top)}px`;
      window.requestAnimationFrame(() => {
        const ob = overlay.getBoundingClientRect();
        if (ob.bottom > vh - pad) {
          const aboveTop = historiansStoryClamp(Math.round(r.top - gap - ob.height), pad, vh - ob.height - pad);
          overlay.style.top = `${aboveTop}px`;
        }
      });
      return;
    }

    overlay.style.transform = 'translateY(-50%)';
    overlay.style.bottom = 'auto';
    overlay.style.right = 'auto';
    overlay.style.width = '';

    let leftGuess = Math.round(r.right + gap);
    overlay.style.top = `${Math.round(r.top + r.height / 2)}px`;
    overlay.style.left = `${leftGuess}px`;

    window.requestAnimationFrame(() => {
      const ob = overlay.getBoundingClientRect();
      if (leftGuess + ob.width > vw - pad) {
        leftGuess = Math.round(r.left - gap - ob.width);
      }
      leftGuess = historiansStoryClamp(leftGuess, pad, vw - ob.width - pad);
      overlay.style.left = `${leftGuess}px`;
      const ob2 = overlay.getBoundingClientRect();
      const half = ob2.height / 2;
      let centerY = historiansStoryClamp(r.top + r.height / 2, pad + half, vh - half - pad);
      overlay.style.top = `${Math.round(centerY)}px`;
    });
  }

  function repositionHistoriansStoryFloatingNugget() {
    let anchor =
      typeof historiansStoryFloatResolveAnchor === 'function' ? historiansStoryFloatResolveAnchor() : null;
    if (!anchor || !(anchor instanceof Element))
      anchor = document.querySelector('.lane-historians-story-active');
    positionHistoriansStoryFloatingNear(anchor || null);
  }

  function scheduleHistoriansStoryReposition() {
    const slots = [0, 48, 200, 450];
    for (let i = 0; i < slots.length; i++) window.setTimeout(() => repositionHistoriansStoryFloatingNugget(), slots[i]);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => repositionHistoriansStoryFloatingNugget()));
  }

  function setHistoriansStoryOverlay(scene) {
    const overlay = document.getElementById('historiansStoryOverlay');
    const kickerEl = document.getElementById('historiansStorySceneKicker');
    const titleEl = document.getElementById('historiansStorySceneTitle');
    const copyEl = document.getElementById('historiansStorySceneCopy');
    if (!overlay || !kickerEl || !titleEl || !copyEl) return;

    if (!scene) {
      unbindHistoriansStoryFloatListeners();
      historiansStoryFloatResolveAnchor = null;
      clearHistoriansFloatingOverlayStyles();
      overlay.classList.add('d-none');
      kickerEl.textContent = '';
      titleEl.textContent = '';
      copyEl.textContent = '';
      return;
    }

    bindHistoriansStoryFloatListeners();
    overlay.classList.remove('d-none');
    kickerEl.textContent = scene.kicker || '';
    titleEl.textContent = scene.title || '';
    copyEl.textContent = scene.copy || '';
    scheduleHistoriansStoryReposition();
  }

  function clearHistoriansStorySpotlight() {
    document.querySelectorAll('.lane-historians-story-active').forEach((el) => {
      el.classList.remove('lane-historians-story-active');
    });
  }

  function historiansNarrateEnabled() {
    const el = document.getElementById('historiansStoryNarrate');
    return !el || el.checked;
  }

  function persistHistoriansStoryNarrate() {
    try {
      const na = document.getElementById('historiansStoryNarrate');
      if (na) localStorage.setItem(STORAGE_HISTORIANS_NARRATE_V2, na.checked ? '1' : '0');
    } catch (_) {}
  }

  function loadHistoriansStoryNarrate() {
    try {
      const na = document.getElementById('historiansStoryNarrate');
      if (!na) return;
      let v = localStorage.getItem(STORAGE_HISTORIANS_NARRATE_V2);
      if (v !== '0' && v !== '1') {
        const legacy = localStorage.getItem(STORAGE_HISTORIANS_NARRATE_LEGACY);
        na.checked = legacy !== '0';
      } else {
        na.checked = v !== '0';
      }
    } catch (_) {}
  }

  function sleepHist(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function stopHistoriansStoryNarration() {
    historiansStorySpeakToken += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function historiansNarrateAsync(text, token) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return Promise.resolve();
    const isCancelled = () => token !== historiansStorySpeakToken;
    if (typeof window.speakNarrationAwaitEnd === 'function') {
      return window.speakNarrationAwaitEnd(t, { volume: 0.85, isCancelled });
    }
    if (!('speechSynthesis' in window)) return Promise.resolve();
    return new Promise((resolve) => {
      if (isCancelled()) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.volume = 0.85;
        u.rate = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch (_) {
        resolve();
      }
    });
  }

  function primeHistoriansAudioFromGesture() {
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  }

  function applyHistoriansStoryScene(scene) {
    clearHistoriansStorySpotlight();
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reducedMotion ? 'auto' : 'smooth';

    if (!scene) {
      setHistoriansStoryOverlay(null);
      return;
    }

    const rawId = scene.anchorId ? String(scene.anchorId).trim() : '';
    let el = rawId ? document.getElementById(rawId) : null;

    if (rawId === 'lh-archive-nhhs' && el) {
      historiansStoryFloatResolveAnchor = () => document.getElementById('lh-archive-nhhs');
    } else if (rawId === 'lh-pref-heading') {
      const prose = document.querySelector('#lh-pref-heading + .lane-historians-prose');
      historiansStoryFloatResolveAnchor = () => prose || document.getElementById('lh-pref-heading');
      el = prose || document.getElementById('lh-pref-heading');
    } else {
      historiansStoryFloatResolveAnchor = () =>
        rawId ?
          document.getElementById(rawId)
        : document.getElementById('lh-story-intro');
    }

    setHistoriansStoryOverlay(scene);

    if (el && el.classList && el.classList.contains('lh-story-highlight-target'))
      el.classList.add('lane-historians-story-active');
    else if (rawId) {
      const byId = document.getElementById(rawId);
      if (byId) {
        const parent = byId.closest('.lh-story-highlight-target') || byId.parentElement?.querySelector('.lh-story-highlight-target');
        if (parent) parent.classList.add('lane-historians-story-active');
        else byId.classList.add('lane-historians-story-active');
      }
    }

    const scrollEl = rawId === 'lh-pref-heading' ? el || document.getElementById('lh-pref-heading') : document.getElementById(rawId);

    if (scrollEl && typeof scrollEl.scrollIntoView === 'function')
      scrollEl.scrollIntoView({ behavior, block: rawId === 'lh-story-intro' ? 'start' : 'center' });
    try {
      if (scrollEl && typeof scrollEl.focus === 'function') scrollEl.focus({ preventScroll: true });
    } catch (_) {}
  }

  function stopHistoriansStoryMode(opts) {
    const preserve = Boolean(opts && opts.preserveOverlay);
    stopHistoriansStoryNarration();
    historiansStoryState.running = false;
    historiansStoryState.playbackToken += 1;
    clearHistoriansStorySpotlight();
    if (!preserve) setHistoriansStoryOverlay(null);
    updateHistoriansStoryToggle();
  }

  async function historiansStoryPlaybackLoop(playbackToken) {
    if (!historiansStoryState.scenes.length) {
      stopHistoriansStoryNarration();
      historiansStoryState.running = false;
      updateHistoriansStoryToggle();
      return;
    }
    let idx = 0;
    while (
      historiansStoryState.running &&
      playbackToken === historiansStoryState.playbackToken &&
      historiansStoryState.scenes.length
    ) {
      stopHistoriansStoryNarration();
      const scene = historiansStoryState.scenes[idx];
      if (!scene) break;
      applyHistoriansStoryScene(scene);
      const narrToken = historiansStorySpeakToken;
      const narrPromise =
        historiansNarrateEnabled() && String(scene.narration || '').trim() ?
          historiansNarrateAsync(String(scene.narration || '').trim(), narrToken)
        : Promise.resolve();
      const ms = Number(scene.durationMs) || HISTORIANS_SCENE_DURATION_MS;
      await Promise.all([narrPromise, sleepHist(ms)]);
      if (!historiansStoryState.running || playbackToken !== historiansStoryState.playbackToken) break;
      if (idx + 1 >= historiansStoryState.scenes.length) {
        stopHistoriansStoryMode({ preserveOverlay: true });
        break;
      }
      await sleepHist(HISTORIANS_SCENE_GAP_MS);
      idx += 1;
    }
    if (!historiansStoryState.running) updateHistoriansStoryToggle();
  }

  function restartHistoriansStoryPlaying() {
    stopHistoriansStoryNarration();
    historiansStoryState.playbackToken += 1;
    historiansStoryState.running = true;
    const token = historiansStoryState.playbackToken;
    primeHistoriansAudioFromGesture();
    updateHistoriansStoryToggle();
    void historiansStoryPlaybackLoop(token);
  }

  function startHistoriansStoryMode() {
    if (!historiansStoryState.scenes.length) return;
    if (typeof window.laneTtsStopPlayback === 'function') window.laneTtsStopPlayback();
    stopHistoriansStoryNarration();
    historiansStoryState.playbackToken += 1;
    historiansStoryState.running = true;
    const token = historiansStoryState.playbackToken;
    primeHistoriansAudioFromGesture();
    updateHistoriansStoryToggle();
    void historiansStoryPlaybackLoop(token);
  }

  function initHistoriansHyperFrameStoryBindings() {
    const toggle = document.getElementById('historiansStoryToggle');
    if (!toggle || toggle.dataset.bound === '1') return;
    toggle.dataset.bound = '1';

    loadHistoriansStoryNarrate();
    persistHistoriansStoryNarrate();

    toggle.addEventListener('click', () => {
      primeHistoriansAudioFromGesture();
      if (historiansStoryState.running) {
        stopHistoriansStoryMode();
      } else if (historiansDataRef) {
        historiansStoryState.scenes = buildHistoriansStoryScenes(historiansDataRef);
        if (!historiansStoryState.scenes.length) {
          updateHistoriansStoryToggle();
          return;
        }
        startHistoriansStoryMode();
      }
    });

    const na = document.getElementById('historiansStoryNarrate');
    if (na && !na.dataset.bound) {
      na.dataset.bound = '1';
      na.addEventListener('change', () => {
        persistHistoriansStoryNarrate();
        historiansStoryState.scenes =
          historiansDataRef ? buildHistoriansStoryScenes(historiansDataRef) : [];
        if (!historiansStoryState.scenes.length) stopHistoriansStoryMode();
        else if (historiansStoryState.running) restartHistoriansStoryPlaying();
        updateHistoriansStoryToggle();
      });
    }

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !historiansStoryState.running) return;
        stopHistoriansStoryMode();
      },
      true
    );

    updateHistoriansStoryToggle();
  }

  function showError(msg) {
    const root = document.getElementById('historiansRoot');
    if (!root) return;
    root.innerHTML = `<div class="lane-historians-error" role="alert">${escapeHtml(msg)}</div>`;
  }

  function initHistoriansImageExpand() {
    const root = document.getElementById('historiansRoot');
    const modal = document.getElementById('lhImageModal');
    const closeBtn = document.getElementById('lhImageModalClose');
    const modalImg = document.getElementById('lhImageModalImg');
    const modalCaption = document.getElementById('lhImageModalCaption');
    if (!root || !modal || !closeBtn || !modalImg || !modalCaption) return;
    if (modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    function closeModal() {
      modal.classList.add('d-none');
      modal.setAttribute('aria-hidden', 'true');
      modalImg.setAttribute('src', '');
      modalCaption.textContent = '';
      document.body.classList.remove('lh-image-modal-open');
    }

    function openFromImage(img) {
      const src = String(img?.getAttribute('src') || '').trim();
      if (!src) return;
      const alt = String(img.getAttribute('alt') || 'Expanded image').trim();
      modalImg.setAttribute('src', src);
      modalImg.setAttribute('alt', alt);
      modalCaption.textContent = alt;
      modal.classList.remove('d-none');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lh-image-modal-open');
    }

    root.addEventListener('click', (event) => {
      const img = event.target?.closest?.('img.lh-expandable-image');
      if (!img) return;
      openFromImage(img);
    });

    root.addEventListener('keydown', (event) => {
      const img = event.target?.closest?.('img.lh-expandable-image');
      if (!img) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openFromImage(img);
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('d-none')) closeModal();
    });
  }

  async function init() {
    initHistoriansHyperFrameStoryBindings();
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`Could not load ${DATA_URL} (${res.status})`);
      const data = await res.json();
      historiansDataRef = data;
      render(data);
      initHistoriansImageExpand();
      updateHistoriansStoryToggle();
      document.title = `${data.title || 'Lane historians'} — DevConnect Labs`;
      try {
        const h = window.location.hash;
        if (h && /^#lh-portrait-[a-z0-9-]+$/i.test(h)) {
          requestAnimationFrame(() => {
            const el = document.querySelector(h);
            if (el && typeof el.scrollIntoView === 'function') {
              const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              el.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
            }
          });
        }
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      console.error(e);
      historiansDataRef = null;
      showError(e.message || 'Historians content is unavailable.');
      updateHistoriansStoryToggle();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
