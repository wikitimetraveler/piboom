const MUSEUM_THEME_KEY = 'laneMuseumTheme';
const HISTORY_STATE_COPY = {
  loading: 'Loading history records...',
  empty: 'No Lane records available for this view.',
  unavailable: 'History records are unavailable right now.'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

/**
 * Hybrid Lane Historians discovery — content from museum JSON (historiansTeaser).
 * @param {Record<string, unknown>} content
 */
function renderHistoriansTeaser(content) {
  const el = document.getElementById('museumHistoriansTeaser');
  if (!el) return;
  const t = content && content.historiansTeaser;
  if (!t || t.enabled === false || !String(t.href || '').trim()) {
    el.innerHTML = '';
    el.setAttribute('hidden', 'hidden');
    return;
  }
  const title = escapeHtml(t.title || 'Honoring the compilers');
  const lede = escapeHtml(t.lede || '');
  const cta = escapeHtml(t.ctaLabel || 'Open Lane Historians');
  const href = String(t.href || '').trim();
  const safeHref = escapeHtml(href);
  const imgUrl = String(t.imageUrl || '').trim();
  const imgBlock = imgUrl
    ? `<div class="museum-historians-teaser__media"><img src="${escapeHtml(
        imgUrl
      )}" alt="" width="240" height="140" loading="lazy" decoding="async" class="museum-historians-teaser__thumb" /></div>`
    : '';
  el.innerHTML = `<div class="museum-historians-teaser__inner">
      ${imgBlock}
      <div class="museum-historians-teaser__body">
        <h2 class="museum-historians-teaser__title">${title}</h2>
        <p class="museum-historians-teaser__lede museum-prose mb-2">${lede}</p>
        <a class="btn btn-sm museum-text-btn" href="${safeHref}"><i class="bi bi-journal-text" aria-hidden="true"></i> ${cta}</a>
      </div>
    </div>`;
  el.removeAttribute('hidden');
}

/** Cached API payloads for exhibit cards (set in initLaneMuseum). */
let cachedMuseumContent = null;
let cachedFeaturedStory = null;
let cachedProminentLanes = [];
let cachedLunarExhibit = null;

let currentMuseumPoster = null;
let museumPosterCanvas = null;
let museumPosterMode = 'simple';
let museumPosterTemplateId = 'single';
let museumPosterUiBound = false;

/** Same-origin raster when no exhibit portrait / proxy fails — never use raw svg+xml in src without encoding (breaks HTML). */
const MUSEUM_EXHIBIT_DEFAULT_IMAGE = '/family/assets/lane-genealogies-title-spread.png';

function svgMarkupToDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup.trim())}`;
}

function museumLunarDefaultCoverDataUrl() {
  return svgMarkupToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#1a1a2e"/><circle cx="320" cy="320" r="210" fill="#d4dce8" opacity="0.28"/><circle cx="320" cy="320" r="180" fill="#b8bcc8" opacity="0.15"/><ellipse cx="250" cy="260" rx="36" ry="28" fill="#8a8793" opacity="0.35"/><ellipse cx="380" cy="360" rx="22" ry="18" fill="#8a8793" opacity="0.3"/><text x="320" y="520" fill="#ece8df" font-size="20" font-family="Georgia,serif" text-anchor="middle">Lane lunar feature</text></svg>`);
}

/** Safe src for HTML attributes (do not escape & in query strings). */
function escapeAttrSrc(src) {
  return String(src || '').replace(/"/g, '%22').replace(/\n/g, '').trim();
}

function exhibitPosterCoverUrl(primaryUrl) {
  const u = String(primaryUrl || '').trim();
  if (!u) return MUSEUM_EXHIBIT_DEFAULT_IMAGE;
  const resolved = resolvePosterImageUrl(u);
  return resolved && String(resolved).trim() ? resolved : MUSEUM_EXHIBIT_DEFAULT_IMAGE;
}

function lunarPosterCoverUrl(primaryUrl) {
  const u = String(primaryUrl || '').trim();
  if (!u) return museumLunarDefaultCoverDataUrl();
  const resolved = resolvePosterImageUrl(u);
  return resolved && String(resolved).trim() ? resolved : museumLunarDefaultCoverDataUrl();
}

function resolvePosterImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/') || url.startsWith(window.location.origin)) return url;
  return `/api/poster-generator/proxy-image?url=${encodeURIComponent(url)}`;
}

function generateMuseumPosterQr(url) {
  if (!window.QRCode || !url) return null;
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;left:-9999px;width:128px;height:128px;';
  document.body.appendChild(div);
  try {
    new window.QRCode(div, { text: url, width: 128, height: 128 });
    const canvas = div.querySelector('canvas');
    const img = div.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : img ? img.src : null;
    document.body.removeChild(div);
    return dataUrl;
  } catch (e) {
    if (div.parentNode) document.body.removeChild(div);
    return null;
  }
}

function truncateMuseumText(raw, maxLen) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function normalizeMuseumPosterPayload(raw) {
  if (raw.kind === 'prominent' && raw.prominentEntry) {
    const entry = raw.prominentEntry;
    const person = entry.person || {};
    const title = entry.displayName || person.name || entry.personQuery || 'Exhibit';
    const idPart = person.id != null ? person.id : entry.personId != null ? entry.personId : 'x';
    const fileSlug = `prominent-${idPart}-${String(title)
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)}`;
    return {
      kind: 'prominent',
      prominentEntry: entry,
      shareTitle: `${title} — Lane Legacy Museum`,
      fileSlug: fileSlug || 'prominent-exhibit'
    };
  }
  if (raw.kind === 'featured') {
    const fs = cachedFeaturedStory || {};
    const t = fs.title || 'Featured exhibit';
    return {
      kind: 'featured',
      shareTitle: `${t} — Lane Legacy Museum`,
      fileSlug: `featured-${String(t)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)}` || 'featured-exhibit'
    };
  }
  if (raw.kind === 'lunar') {
    const lunar = cachedLunarExhibit || {};
    const t = lunar.title || 'Lunar observatory';
    return {
      kind: 'lunar',
      shareTitle: `${t} — Lane Legacy Museum`,
      fileSlug: `lunar-${String(t)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)}` || 'lunar-exhibit'
    };
  }
  return null;
}

function getFeaturedMainMedia(cms, featuredStory) {
  const media = (cms?.media || []).filter((item) => item.storySlug === featuredStory?.slug);
  return media[0] || null;
}

function getMuseumQrTargetUrl(poster) {
  if (!poster) return window.location.href;
  if (poster.kind === 'prominent') {
    const entry = poster.prominentEntry || {};
    const person = entry.person || {};
    const pid = person.id != null ? person.id : entry.personId;
    if (pid != null) {
      return new URL(`/family/lane-memorial-wall.html?personId=${encodeURIComponent(String(pid))}`, window.location.origin).href;
    }
  }
  if (poster.kind === 'lunar') {
    const lunar = cachedLunarExhibit || {};
    return resolveQuickMapHref(lunar) || window.location.href;
  }
  return `${window.location.origin}/family/lane-museum.html#museumFeaturedPanel`;
}

function buildMuseumTemplateData(poster) {
  if (poster.kind === 'prominent') {
    const entry = poster.prominentEntry || {};
    const person = entry.person || {};
    const title = entry.displayName || person.name || entry.personQuery || 'Exhibit';
    const subtitle = entry.eraLabel || '';
    const img = exhibitPosterCoverUrl(entry.imageUrl);
    const venue = person.born || '';
    const date = `${person.birthYear || '?'} – ${person.deathYear || '?'}`;
    return { imageUrl: img, title, subtitle, album: title, artist: subtitle || 'Lane Legacy Museum', venue, date };
  }
  if (poster.kind === 'featured') {
    const fs = cachedFeaturedStory || {};
    const person = fs.featuredPerson || {};
    const main = getFeaturedMainMedia(cachedMuseumContent, fs);
    const img = exhibitPosterCoverUrl(main?.url || '');
    const title = fs.title || 'Featured exhibit';
    const subtitle = fs.subtitle || '';
    const venue = person.born || '';
    const date = `${person.birthYear || '?'} – ${person.deathYear || '?'}`;
    return { imageUrl: img, title, subtitle, album: title, artist: subtitle || 'Lane Legacy Museum', venue, date };
  }
  const lunar = cachedLunarExhibit || {};
  const galleryItems = Array.isArray(lunar.gallery)
    ? lunar.gallery.map((item) => ({ url: item?.url != null ? String(item.url).trim() : '' })).filter((item) => item.url)
    : [];
  const mainImageUrl =
    (lunar.mainImageUrl != null ? String(lunar.mainImageUrl).trim() : '') ||
    (lunar.imageUrl != null ? String(lunar.imageUrl).trim() : '') ||
    (galleryItems[0] ? galleryItems[0].url : '');
  const img = lunarPosterCoverUrl(mainImageUrl);
  const lat = lunar.latitude != null ? Number(lunar.latitude) : null;
  const lon = lunar.longitude != null ? Number(lunar.longitude) : null;
  const coordLine =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
      : '';
  const diam = lunar.diameterKm != null ? `~${lunar.diameterKm} km` : '';
  const title = lunar.title || 'Lane crater';
  const subtitle = lunar.subtitle || '';
  return {
    imageUrl: img,
    title,
    subtitle,
    album: title,
    artist: subtitle || 'Lunar observatory',
    venue: coordLine || lunar.featureName || '',
    date: diam
  };
}

function buildMuseumPosterHtmlSimple(poster) {
  const imgFallbackQuoted = escapeAttrSrc(MUSEUM_EXHIBIT_DEFAULT_IMAGE);
  const kicker = '<div class="poster-kicker">Lane Legacy Museum</div>';
  const coverOnError = ` onerror="this.onerror=null;this.src='${imgFallbackQuoted}'"`;

  if (poster.kind === 'prominent') {
    const entry = poster.prominentEntry || {};
    const person = entry.person || {};
    const title = entry.displayName || person.name || entry.personQuery || 'Exhibit';
    const coverSrc = escapeAttrSrc(exhibitPosterCoverUrl(entry.imageUrl));
    const metaRows = [
      entry.eraLabel ? `Era: ${entry.eraLabel}` : null,
      `${person.birthYear || '?'} – ${person.deathYear || '?'}`,
      person.born ? `Born / context: ${person.born}` : null
    ].filter(Boolean);
    const caption = entry.caption ? truncateMuseumText(entry.caption, 360) : '';
    const blurb = entry.blurb ? truncateMuseumText(entry.blurb, 280) : '';
    const metaHtml = metaRows.map((row) => `<div>${escapeHtml(row)}</div>`).join('');
    const captionHtml = caption
      ? `<div class="poster-section"><h6>Caption</h6><div>${escapeHtml(caption)}</div></div>`
      : '';
    const blurbHtml = blurb
      ? `<div class="poster-section"><h6>Curator note</h6><div>${escapeHtml(blurb)}</div></div>`
      : '';
    return `
    ${kicker}
    <img class="poster-cover" src="${coverSrc}" alt="" crossorigin="anonymous"${coverOnError} />
    <div class="poster-body">
      <div class="poster-title">${escapeHtml(title)}</div>
      <div class="poster-subtitle">${escapeHtml(entry.eraLabel || '')}</div>
      <div class="poster-meta">${metaHtml}</div>
      ${captionHtml}
      ${blurbHtml}
    </div>`;
  }
  if (poster.kind === 'featured') {
    const fs = cachedFeaturedStory || {};
    const person = fs.featuredPerson || {};
    const main = getFeaturedMainMedia(cachedMuseumContent, fs);
    const coverSrc = escapeAttrSrc(exhibitPosterCoverUrl(main?.url || ''));
    const metaRows = [
      person.name ? `Name: ${person.name}` : null,
      person.birthYear ? `Born: ${person.birthYear}` : null,
      person.born ? `Place: ${person.born}` : null
    ].filter(Boolean);
    const summary = fs.summary ? truncateMuseumText(fs.summary, 420) : '';
    const metaHtml = metaRows.map((row) => `<div>${escapeHtml(row)}</div>`).join('');
    const sumHtml = summary
      ? `<div class="poster-section"><h6>Summary</h6><div>${escapeHtml(summary)}</div></div>`
      : '';
    return `
    ${kicker}
    <img class="poster-cover" src="${coverSrc}" alt="" crossorigin="anonymous"${coverOnError} />
    <div class="poster-body">
      <div class="poster-title">${escapeHtml(fs.title || 'Featured exhibit')}</div>
      <div class="poster-subtitle">${escapeHtml(fs.subtitle || '')}</div>
      <div class="poster-meta">${metaHtml || '<div>Exhibit details</div>'}</div>
      ${sumHtml}
    </div>`;
  }
  const lunar = cachedLunarExhibit || {};
  const galleryItems = Array.isArray(lunar.gallery)
    ? lunar.gallery
        .map((item) => ({
          url: item?.url != null ? String(item.url).trim() : ''
        }))
        .filter((item) => item.url)
    : [];
  const mainImageUrl =
    (lunar.mainImageUrl != null ? String(lunar.mainImageUrl).trim() : '') ||
    (lunar.imageUrl != null ? String(lunar.imageUrl).trim() : '') ||
    (galleryItems[0] ? galleryItems[0].url : '');
  const coverSrc = escapeAttrSrc(lunarPosterCoverUrl(mainImageUrl));
  const lunarCoverOnError = ` onerror="this.onerror=null;this.src='${imgFallbackQuoted}'"`;
  const lat = lunar.latitude != null ? Number(lunar.latitude) : null;
  const lon = lunar.longitude != null ? Number(lunar.longitude) : null;
  const coordLine =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)}°, ${lon.toFixed(2)}° (lunar)`
      : 'Coordinates on chart';
  const diam = lunar.diameterKm != null ? `Diameter ~${lunar.diameterKm} km` : '';
  const body = lunar.body ? truncateMuseumText(lunar.body, 320) : '';
  const nom = lunar.nomenclatureOrigin ? truncateMuseumText(lunar.nomenclatureOrigin, 200) : '';
  const metaHtml = [`Feature: ${lunar.featureName || 'Lane'}`, coordLine, diam]
    .filter(Boolean)
    .map((row) => `<div>${escapeHtml(row)}</div>`)
    .join('');
  const bodyHtml = body
    ? `<div class="poster-section"><h6>About</h6><div>${escapeHtml(body)}</div></div>`
    : '';
  const nomHtml = nom
    ? `<div class="poster-section"><h6>Nomenclature</h6><div>${escapeHtml(nom)}</div></div>`
    : '';
  return `
  ${kicker}
  <img class="poster-cover" src="${coverSrc}" alt="" crossorigin="anonymous"${lunarCoverOnError} />
  <div class="poster-body">
    <div class="poster-title">${escapeHtml(lunar.title || 'Lane crater')}</div>
    <div class="poster-subtitle">${escapeHtml(lunar.subtitle || '')}</div>
    <div class="poster-meta">${metaHtml}</div>
    ${bodyHtml}
    ${nomHtml}
  </div>`;
}

function rebuildMuseumPoster() {
  if (!currentMuseumPoster) return;
  museumPosterCanvas = null;
  const host = document.getElementById('museumPosterContent');
  if (!host) return;

  if (museumPosterMode === 'template' && window.posterTemplates) {
    const data = buildMuseumTemplateData(currentMuseumPoster);
    const fontFamily = document.getElementById('museumPosterFont')?.value || 'Georgia, serif';
    const frame = document.getElementById('museumPosterFrame')?.value || 'none';
    const addQr = Boolean(document.getElementById('museumPosterQr')?.checked);
    const qrUrl = getMuseumQrTargetUrl(currentMuseumPoster);
    const qrDataUrl = addQr ? generateMuseumPosterQr(qrUrl) : undefined;
    host.innerHTML = window.posterTemplates.render(museumPosterTemplateId, {
      ...data,
      fontFamily,
      frame,
      qrDataUrl
    });
  } else {
    host.innerHTML = buildMuseumPosterHtmlSimple(currentMuseumPoster);
  }
}

function setMuseumPosterMode(mode) {
  museumPosterMode = mode;
  const simpleBtn = document.getElementById('museumPosterModeSimple');
  const tplBtn = document.getElementById('museumPosterModeTemplate');
  const opts = document.getElementById('museumPosterTemplateOpts');
  if (simpleBtn) simpleBtn.classList.toggle('active', mode === 'simple');
  if (tplBtn) tplBtn.classList.toggle('active', mode === 'template');
  if (opts) opts.style.display = mode === 'template' ? 'block' : 'none';
  rebuildMuseumPoster();
}

function selectMuseumPosterTemplate(id) {
  museumPosterTemplateId = id;
  document.querySelectorAll('.museum-template-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-id') === id);
  });
  rebuildMuseumPoster();
}

function openMuseumExhibitPoster(rawPayload) {
  const normalized = normalizeMuseumPosterPayload(rawPayload);
  if (!normalized) return;
  currentMuseumPoster = normalized;
  museumPosterCanvas = null;
  museumPosterMode = 'simple';
  museumPosterTemplateId = 'single';

  const simpleBtn = document.getElementById('museumPosterModeSimple');
  const tplBtn = document.getElementById('museumPosterModeTemplate');
  const opts = document.getElementById('museumPosterTemplateOpts');
  const qr = document.getElementById('museumPosterQr');
  if (simpleBtn) simpleBtn.classList.add('active');
  if (tplBtn) tplBtn.classList.remove('active');
  if (opts) opts.style.display = 'none';
  if (qr) qr.checked = false;
  document.querySelectorAll('.museum-template-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-id') === 'single');
  });
  const shareInput = document.getElementById('museumPosterShareLink');
  if (shareInput) shareInput.value = '';

  rebuildMuseumPoster();
  if (typeof $ !== 'undefined' && $('#museumPosterModal').modal) {
    $('#museumPosterModal').modal('show');
  }
}

function waitForPosterImages(container) {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    images.map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })
    )
  );
}

async function getMuseumPosterCanvas() {
  if (museumPosterCanvas) return museumPosterCanvas;
  const el = document.getElementById('museumPosterContent');
  await waitForPosterImages(el);
  if (!window.posterUtils) throw new Error('posterUtils unavailable');
  museumPosterCanvas = await window.posterUtils.renderPosterCanvas(el);
  return museumPosterCanvas;
}

async function downloadMuseumPosterPng() {
  if (!currentMuseumPoster || !window.posterUtils || !window.html2canvas) return;
  try {
    const canvas = await getMuseumPosterCanvas();
    const dataUrl = window.posterUtils.canvasToDataUrl(canvas);
    const slug = currentMuseumPoster.fileSlug || 'lane-museum-exhibit';
    window.posterUtils.downloadDataUrl(dataUrl, `lane-museum-${slug}.png`);
  } catch (e) {
    console.error(e);
  }
}

async function downloadMuseumPosterPdf() {
  if (!currentMuseumPoster || !window.posterUtils || !window.jspdf) return;
  try {
    const canvas = await getMuseumPosterCanvas();
    const slug = currentMuseumPoster.fileSlug || 'lane-museum-exhibit';
    await window.posterUtils.downloadPdfFromCanvas(canvas, `lane-museum-${slug}.pdf`);
  } catch (e) {
    console.error(e);
  }
}

async function shareMuseumPoster() {
  if (!currentMuseumPoster || !window.posterUtils || !window.html2canvas) return;
  try {
    const canvas = await getMuseumPosterCanvas();
    const dataUrl = window.posterUtils.canvasToDataUrl(canvas);
    const title = currentMuseumPoster.shareTitle || 'Lane Legacy Museum';
    const shareData = await window.posterUtils.uploadPosterShare(dataUrl, title, 'museum');
    const shareUrl = new URL(shareData.shareUrl, window.location.origin).toString();
    const linkEl = document.getElementById('museumPosterShareLink');
    if (linkEl) linkEl.value = shareUrl;
    const slug = (currentMuseumPoster.fileSlug || 'exhibit').replace(/[^a-z0-9-]+/gi, '-');
    const shared = await window.posterUtils.sharePoster({
      canvas,
      title,
      text: 'Lane Legacy Museum exhibit card',
      fileName: `lane-museum-${slug}.png`,
      shareUrl
    });
    if (!shared && typeof window !== 'undefined') {
      window.alert?.('Share link ready — copy from the field if native share is unavailable.');
    }
  } catch (e) {
    console.error(e);
    window.alert?.(`Share failed: ${e.message || e}`);
  }
}

function copyMuseumPosterShareLink() {
  const input = document.getElementById('museumPosterShareLink');
  if (!input || !input.value) return;
  input.select();
  input.setSelectionRange(0, input.value.length);
  try {
    document.execCommand('copy');
  } catch (_) {
    navigator.clipboard?.writeText(input.value);
  }
}

function bindProminentPosterButtons() {
  const grid = document.getElementById('prominentGrid');
  if (!grid) return;
  grid.querySelectorAll('.prominent-card-poster-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.dataset.exhibitIndex);
      if (!Number.isFinite(idx) || !cachedProminentLanes[idx]) return;
      openMuseumExhibitPoster({ kind: 'prominent', prominentEntry: cachedProminentLanes[idx] });
    });
  });
}

function initMuseumPosterUi() {
  if (museumPosterUiBound) return;
  museumPosterUiBound = true;

  document.getElementById('museumPosterModeSimple')?.addEventListener('click', () => setMuseumPosterMode('simple'));
  document.getElementById('museumPosterModeTemplate')?.addEventListener('click', () => setMuseumPosterMode('template'));
  document.querySelectorAll('.museum-template-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectMuseumPosterTemplate(btn.getAttribute('data-id') || 'single'));
  });
  ['museumPosterFont', 'museumPosterFrame'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => rebuildMuseumPoster());
  });
  document.getElementById('museumPosterQr')?.addEventListener('change', () => rebuildMuseumPoster());

  document.getElementById('museumPosterDownloadPng')?.addEventListener('click', () => downloadMuseumPosterPng());
  document.getElementById('museumPosterDownloadPdf')?.addEventListener('click', () => downloadMuseumPosterPdf());
  document.getElementById('museumPosterShare')?.addEventListener('click', () => shareMuseumPoster());
  document.getElementById('museumPosterCopyLink')?.addEventListener('click', () => copyMuseumPosterShareLink());

  document.getElementById('featuredExhibitCardBtn')?.addEventListener('click', () => {
    openMuseumExhibitPoster({ kind: 'featured' });
  });
}

function applyTheme(themeId) {
  document.body.classList.remove('archiveLight');
  if (themeId === 'archiveLight') {
    document.body.classList.add('archiveLight');
  }
  localStorage.setItem(MUSEUM_THEME_KEY, themeId);
  document.querySelectorAll('.museum-theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === themeId);
  });
}

function renderThemeButtons(themes = {}) {
  const host = document.getElementById('themeButtons');
  const options = themes.available || [
    { id: 'museumDark', label: 'Museum Dark' },
    { id: 'archiveLight', label: 'Archival Light' }
  ];
  host.innerHTML = options
    .map((theme) => `<button class="museum-theme-btn" data-theme="${escapeHtml(theme.id)}">${escapeHtml(theme.label)}</button>`)
    .join('');
  host.querySelectorAll('.museum-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });
  const preferred = localStorage.getItem(MUSEUM_THEME_KEY) || themes.defaultTheme || 'museumDark';
  applyTheme(preferred);
}

function renderFeatured(featuredStory = {}, museum = {}) {
  const person = featuredStory.featuredPerson || {};
  document.getElementById('featuredTitle').textContent = featuredStory.title || 'Exhibit 1';
  document.getElementById('featuredSubtitle').textContent =
    featuredStory.subtitle || 'William E Lane of Boston as chronology anchor';
  document.getElementById('featuredSummary').textContent =
    featuredStory.summary || HISTORY_STATE_COPY.empty;

  const meta = document.getElementById('featuredMeta');
  const rows = [
    { label: 'Name', value: person.name || 'William E Lane (pending exact match)' },
    { label: 'Born', value: person.birthYear || 'Unknown' },
    { label: 'Place', value: person.born || 'Boston context pending source detail' },
    { label: 'Generation', value: person.generation ?? 'Unknown' }
  ];
  meta.innerHTML = rows
    .map(
      (row) => `
      <div class="museum-meta-item">
        <div class="museum-meta-label">${escapeHtml(row.label)}</div>
        <div class="museum-meta-value">${escapeHtml(row.value)}</div>
      </div>
    `
    )
    .join('');

  const media = (museum.media || []).filter((item) => item.storySlug === featuredStory.slug);
  const mainMedia = media[0];
  const secondary = media.slice(1, 4);

  const mainHost = document.getElementById('mainMedia');
  if (mainMedia?.url) {
    mainHost.innerHTML = `<img src="${escapeHtml(mainMedia.url)}" alt="${escapeHtml(mainMedia.caption || 'Featured media')}" onerror="this.parentElement.innerHTML='<div class=&quot;museum-placeholder&quot;>Featured media placeholder</div>'" />`;
  } else {
    mainHost.innerHTML = '<div class="museum-placeholder">Featured media placeholder</div>';
  }

  const secondaryHost = document.getElementById('secondaryMedia');
  if (!secondary.length) {
    secondaryHost.innerHTML = '<div class="museum-placeholder">Additional media placeholders</div>';
  } else {
    secondaryHost.innerHTML = secondary
      .map((item) => {
        if (item.type === 'image') {
          return `<div class="museum-media-item"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || 'Media item')}" onerror="this.parentElement.innerHTML='<div class=&quot;museum-placeholder&quot;>Media unavailable</div>'" /></div>`;
        }
        return `<div class="museum-media-item"><div class="museum-placeholder">${escapeHtml(item.type || 'media')}<br>${escapeHtml(item.caption || '')}</div></div>`;
      })
      .join('');
  }

  const featuredCardBtn = document.getElementById('featuredExhibitCardBtn');
  if (featuredCardBtn) {
    featuredCardBtn.classList.remove('d-none');
  }
}

function renderTimeline(events = []) {
  const host = document.getElementById('timelineRows');
  const ordered = events.slice().sort((a, b) => (a.year || 0) - (b.year || 0));
  if (!ordered.length) {
    host.innerHTML = `<div class="text-muted">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = ordered
    .map(
      (event) => `
      <div class="timeline-row">
        <div class="timeline-year">${escapeHtml(event.year)}</div>
        <div><strong>${escapeHtml(event.title || 'Untitled')}</strong></div>
        <div class="text-muted">${escapeHtml(event.description || '')}</div>
      </div>
    `
    )
    .join('');
}

function linkKindIcon(kind) {
  if (kind === 'diary') return '<i class="bi bi-journal-text" aria-hidden="true"></i> ';
  if (kind === 'magazine') return '<i class="bi bi-newspaper" aria-hidden="true"></i> ';
  if (kind === 'moon') return '<i class="bi bi-moon-stars" aria-hidden="true"></i> ';
  if (kind === 'book') return '<i class="bi bi-book" aria-hidden="true"></i> ';
  if (kind === 'article' || kind === 'internal') return '<i class="bi bi-file-earmark-text" aria-hidden="true"></i> ';
  return '<i class="bi bi-link-45deg" aria-hidden="true"></i> ';
}

function getMuseumAccentIndex(entry = {}, fallbackIndex = 0) {
  const rawOrder = Number(entry.order);
  if (Number.isFinite(rawOrder)) return Math.abs(rawOrder) % 8;
  const rawPid = Number(entry.personId ?? entry.person?.id);
  if (Number.isFinite(rawPid)) return Math.abs(rawPid) % 8;
  return Math.abs(fallbackIndex) % 8;
}

function isProminentInternalLink(lnk) {
  if (!lnk || !lnk.url) return false;
  if (lnk.kind === 'article' || lnk.kind === 'internal') return true;
  const u = String(lnk.url);
  return u.startsWith('/') && !u.startsWith('//');
}

function renderProminent(prominent = []) {
  const host = document.getElementById('prominentGrid');
  if (!prominent.length) {
    host.innerHTML = `<div class="text-muted">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = prominent
    .map((entry, index) => {
      const person = entry.person || {};
      const title = entry.displayName || person.name || entry.personQuery || 'Pending profile';
      const accentIndex = getMuseumAccentIndex(entry, index);
      const links = Array.isArray(entry.links) ? entry.links : [];
      const linksHtml = links.length
        ? `<ul class="prominent-links list-unstyled small mb-2">
            ${links
              .map((lnk) => {
                const icon = linkKindIcon(lnk.kind);
                const label = escapeHtml(lnk.label || '');
                const href = lnk.url != null ? String(lnk.url).trim() : '';
                if (!href) {
                  return `<li><span class="prominent-link-cite text-muted">${icon}${label}</span></li>`;
                }
                const internal = isProminentInternalLink(lnk);
                const cls = internal ? 'prominent-internal-link' : 'prominent-external-link';
                const extra = internal ? '' : ' target="_blank" rel="noopener noreferrer"';
                return `<li><a class="${cls}" href="${escapeHtml(href)}"${extra}>${icon}${label}</a></li>`;
              })
              .join('')}
          </ul>`
        : '';
      const blurb = entry.blurb ? `<p class="small prominent-blurb">${escapeHtml(entry.blurb)}</p>` : '';
      const pid = person.id != null ? person.id : entry.personId;
      const memorialUrl =
        pid != null ? `/family/lane-memorial-wall.html?personId=${encodeURIComponent(String(pid))}` : '/family/lane-memorial-wall.html';
      const imgUrl = entry.imageUrl != null ? String(entry.imageUrl).trim() : '';
      const mediaBlock =
        imgUrl !== ''
          ? `<figure class="prominent-card-media">
               <img src="${escapeHtml(imgUrl)}" alt="" loading="lazy"
                 onerror="this.closest('figure')?.classList.add('prominent-card-media--missing');" />
               ${
                 entry.imageCaption || entry.imageCredit
                   ? `<figcaption class="small text-muted">
                        ${entry.imageCaption ? escapeHtml(entry.imageCaption) : ''}
                        ${entry.imageCaption && entry.imageCredit ? ' · ' : ''}
                        ${entry.imageCredit ? escapeHtml(entry.imageCredit) : ''}
                      </figcaption>`
                   : ''
               }
             </figure>`
          : '';
      const cardMods = [imgUrl ? 'prominent-card--hero' : ''].filter(Boolean).join(' ');
      return `
        <article class="prominent-card ${cardMods}" data-person-id="${escapeHtml(String(pid ?? ''))}" data-museum-accent="${accentIndex}">
          ${mediaBlock}
          <div class="prominent-card-body">
          <div class="small text-muted">Exhibit order ${escapeHtml(entry.order || '?')}</div>
          <h3 class="h6 mb-1">${escapeHtml(title)}</h3>
          <div class="small mb-2">${escapeHtml(entry.eraLabel || '')}</div>
          <div class="small">${escapeHtml(entry.caption || '')}</div>
          ${blurb}
          ${linksHtml}
          <hr />
          <div class="small text-muted">
            ${escapeHtml(person.birthYear || 'Unknown')} - ${escapeHtml(person.deathYear || 'Unknown')}<br>
            ${escapeHtml(person.born || 'Location pending')}
          </div>
          <div class="mt-2">
            <a class="small prominent-wall-link" href="${escapeHtml(memorialUrl)}">View on memorial wall</a>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary prominent-card-poster-btn mt-2" data-exhibit-index="${index}">
            <i class="bi bi-image" aria-hidden="true"></i> Exhibit card
          </button>
          </div>
        </article>
      `;
    })
    .join('');
}

/** LROC QuickMap expects extent=minLon,minLat,maxLon,maxLat (degrees). */
function buildLrocQuickMapUrl(lat, lon, padDeg = 1.5) {
  const minLon = lon - padDeg;
  const minLat = lat - padDeg;
  const maxLon = lon + padDeg;
  const maxLat = lat + padDeg;
  const extent = [minLon, minLat, maxLon, maxLat].join(',');
  return `https://quickmap.lroc.im-ldi.com/?extent=${encodeURIComponent(extent)}`;
}

/**
 * Prefer quickMapPermalink when curated; else center on latitude/longitude when valid;
 * else fall back to quickMapUrl (generic QuickMap home).
 */
function resolveQuickMapHref(lunar) {
  const permalink = lunar.quickMapPermalink != null ? String(lunar.quickMapPermalink).trim() : '';
  if (permalink) return permalink;
  const lat = lunar.latitude != null ? Number(lunar.latitude) : null;
  const lon = lunar.longitude != null ? Number(lunar.longitude) : null;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return buildLrocQuickMapUrl(lat, lon);
  }
  const fallback = lunar.quickMapUrl != null ? String(lunar.quickMapUrl).trim() : '';
  return fallback || 'https://quickmap.lroc.im-ldi.com/';
}

/**
 * Moon Trek has no stable public lat/lon URL scheme; optional moonTrekPermalink overrides.
 * Otherwise use moonTrekUrl (generic portal).
 */
function resolveMoonTrekHref(lunar) {
  const permalink = lunar.moonTrekPermalink != null ? String(lunar.moonTrekPermalink).trim() : '';
  if (permalink) return permalink;
  const fallback = lunar.moonTrekUrl != null ? String(lunar.moonTrekUrl).trim() : '';
  return fallback || 'https://moontrek.jpl.nasa.gov/';
}

function openLunarImageLightbox(image) {
  if (!image || !image.url) return;
  let root = document.getElementById('lunarImageLightbox');
  if (!root) {
    root = document.createElement('div');
    root.id = 'lunarImageLightbox';
    root.className = 'lunar-lightbox';
    root.innerHTML = `
      <div class="lunar-lightbox-backdrop" data-lunar-close="1"></div>
      <div class="lunar-lightbox-panel" role="dialog" aria-modal="true" aria-label="Lunar image">
        <button type="button" class="lunar-lightbox-close" data-lunar-close="1" aria-label="Close">&times;</button>
        <img class="lunar-lightbox-image" alt="" />
        <div class="lunar-lightbox-caption small text-light"></div>
      </div>
    `;
    document.body.appendChild(root);
    root.addEventListener('click', (event) => {
      const closeTarget = event.target?.getAttribute?.('data-lunar-close');
      if (closeTarget === '1') {
        root.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root.classList.contains('is-open')) {
        root.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }
  const img = root.querySelector('.lunar-lightbox-image');
  const cap = root.querySelector('.lunar-lightbox-caption');
  if (img) {
    img.src = image.url;
    img.alt = image.caption || 'Lunar image';
  }
  if (cap) {
    const credit = image.credit || '';
    cap.textContent = image.caption && credit ? `${image.caption} · ${credit}` : image.caption || credit;
  }
  root.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function renderLunarObservatory(lunar) {
  const mount = document.getElementById('lunarObservatoryMount');
  if (!mount) return;
  if (!lunar || typeof lunar !== 'object') {
    cachedLunarExhibit = null;
    mount.classList.add('d-none');
    return;
  }
  cachedLunarExhibit = lunar;
  mount.classList.remove('d-none');
  const quickMapHref = resolveQuickMapHref(lunar);
  const moonTrekHref = resolveMoonTrekHref(lunar);
  const lat = lunar.latitude != null ? Number(lunar.latitude) : null;
  const lon = lunar.longitude != null ? Number(lunar.longitude) : null;
  const coordLine =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)}°, ${lon.toFixed(2)}° (lunar)`
      : 'Coordinates on USGS sheet';
  const diam = lunar.diameterKm != null ? `~${escapeHtml(String(lunar.diameterKm))} km` : '—';
  const nomenclatureOrigin = lunar.nomenclatureOrigin != null ? String(lunar.nomenclatureOrigin).trim() : '';
  const usgsFeatures = Array.isArray(lunar.usgsFeatures) ? lunar.usgsFeatures : [];
  const usgsRows = usgsFeatures
    .map((feature) => {
      const fName = feature?.name != null ? String(feature.name) : '';
      if (!fName) return '';
      const fType = feature?.featureType != null ? String(feature.featureType) : 'Feature';
      const fLat = Number(feature?.latitude);
      const fLon = Number(feature?.longitude);
      const fDiam = feature?.diameterKm != null ? String(feature.diameterKm) : '—';
      const coord =
        Number.isFinite(fLat) && Number.isFinite(fLon) ? `${fLat.toFixed(2)}°, ${fLon.toFixed(2)}°` : '—';
      return `<tr>
        <td>${escapeHtml(fName)}</td>
        <td>${escapeHtml(fType)}</td>
        <td>${escapeHtml(coord)}</td>
        <td>${escapeHtml(fDiam)}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join('');
  const galleryItems = Array.isArray(lunar.gallery)
    ? lunar.gallery
        .map((item) => ({
          url: item?.url != null ? String(item.url).trim() : '',
          caption: item?.caption != null ? String(item.caption).trim() : '',
          credit: item?.credit != null ? String(item.credit).trim() : ''
        }))
        .filter((item) => item.url)
    : [];
  const hasGallery = galleryItems.length > 0;
  const mainImageUrl =
    (lunar.mainImageUrl != null ? String(lunar.mainImageUrl).trim() : '') ||
    (lunar.imageUrl != null ? String(lunar.imageUrl).trim() : '') ||
    (hasGallery ? galleryItems[0].url : '');
  const mainImageCaption = lunar.mainImageCaption || '';
  const mainImageCredit = lunar.mainImageCredit || lunar.imageCredit || '';
  const thumbItems = hasGallery
    ? galleryItems.filter((item) => item.url && item.url !== mainImageUrl)
    : [];
  const img = mainImageUrl
    ? `<div class="lunar-observatory-visual lunar-observatory-gallery">
         <img src="${escapeHtml(mainImageUrl)}" alt="${escapeHtml(mainImageCaption || 'Lane crater lunar image')}" class="lunar-observatory-img" loading="lazy"
           onerror="this.style.display='none';this.parentElement.classList.add('lunar-observatory-visual--fallback');" />
         ${
           thumbItems.length
             ? `<div class="lunar-gallery-thumbs" role="list" aria-label="Expandable lunar thumbnails">
                  ${thumbItems
                    .map(
                      (item, index) => `
                        <button
                          type="button"
                          class="lunar-gallery-thumb"
                          data-lunar-expand-index="${index}"
                          aria-label="Expand thumbnail ${index + 1}"
                        >
                          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || `Lunar image ${index + 1}`)}" loading="lazy" />
                        </button>
                      `
                    )
                    .join('')}
                </div>`
             : ''
         }
         <p class="small text-muted lunar-gallery-caption mb-0">
           ${escapeHtml(mainImageCaption)}${mainImageCaption && mainImageCredit ? ' · ' : ''}${escapeHtml(mainImageCredit)}
         </p>
       </div>`
    : '<div class="lunar-observatory-visual lunar-observatory-visual--fallback" aria-hidden="true"></div>';

  mount.innerHTML = `
    <div class="lunar-observatory-inner">
      <div class="lunar-observatory-copy">
        <div class="lunar-observatory-kicker"><span class="lunar-badge">Lunar-5</span> observatory</div>
        <h2 class="h4 mb-1">${escapeHtml(lunar.title || 'Lane crater')}</h2>
        <p class="text-muted small mb-2">${escapeHtml(lunar.subtitle || '')}</p>
        <p class="small lunar-observatory-body">${escapeHtml(lunar.body || '')}</p>
        ${nomenclatureOrigin ? `<p class="lunar-nomenclature-epitaph mb-2">${escapeHtml(nomenclatureOrigin)}</p>` : ''}
        <dl class="lunar-coords row small mb-3">
          <div class="col-sm-4"><dt>Feature</dt><dd>${escapeHtml(lunar.featureName || 'Lane')}</dd></div>
          <div class="col-sm-4"><dt>Approx. coords</dt><dd>${escapeHtml(coordLine)}</dd></div>
          <div class="col-sm-4"><dt>Diameter</dt><dd>${diam}</dd></div>
        </dl>
        <div class="lunar-action-row">
          <a class="btn btn-sm btn-outline-light lunar-btn" href="${escapeHtml(quickMapHref)}" target="_blank" rel="noopener noreferrer">Open LROC QuickMap</a>
          <a class="btn btn-sm btn-outline-light lunar-btn" href="${escapeHtml(moonTrekHref)}" target="_blank" rel="noopener noreferrer">NASA Moon Trek</a>
          ${lunar.usgsUrl ? `<a class="btn btn-sm btn-outline-warning lunar-btn" href="${escapeHtml(lunar.usgsUrl)}" target="_blank" rel="noopener noreferrer">USGS nomenclature</a>` : ''}
        </div>
        ${
          usgsRows
            ? `<div class="lunar-usgs-table-wrap mt-3">
                 <table class="table table-sm lunar-usgs-table mb-0">
                   <thead>
                     <tr><th>Name</th><th>Type</th><th>Coords</th><th>Diameter (km)</th></tr>
                   </thead>
                   <tbody>${usgsRows}</tbody>
                 </table>
               </div>`
            : ''
        }
        ${!hasGallery && lunar.imageCredit ? `<p class="small text-muted mt-2 mb-0">${escapeHtml(lunar.imageCredit)}</p>` : ''}
      </div>
      ${img}
    </div>
  `;

  const thumbButtons = Array.from(mount.querySelectorAll('[data-lunar-expand-index]'));
  thumbButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.lunarExpandIndex);
      if (!Number.isFinite(index)) return;
      const image = thumbItems[index];
      if (!image) return;
      openLunarImageLightbox(image);
    });
  });

  const actionRow = mount.querySelector('.lunar-action-row');
  if (actionRow && !actionRow.querySelector('.lunar-exhibit-card-btn')) {
    const lunarCardBtn = document.createElement('button');
    lunarCardBtn.type = 'button';
    lunarCardBtn.className = 'btn btn-sm btn-outline-info lunar-exhibit-card-btn';
    lunarCardBtn.setAttribute('aria-label', 'Generate exhibit card for lunar observatory');
    lunarCardBtn.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i> Exhibit card';
    lunarCardBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      openMuseumExhibitPoster({ kind: 'lunar' });
    });
    actionRow.appendChild(lunarCardBtn);
  }
}

function formatSayingsContextBlock(entries = []) {
  const lines = entries
    .filter((e) => e && e.quote)
    .map((e) => {
      const page = e.pdfPage != null ? `p. ${e.pdfPage}` : 'p. ?';
      const desc = e.description ? ` — ${e.description}` : '';
      return `- [${page}] ${e.quote}${desc}`;
    });
  return lines.join('\n').slice(0, 14000) || '(No curated excerpts loaded.)';
}

async function askLaneMuseumDocent(question, ctx) {
  const out = document.getElementById('docentAnswer');
  out.textContent = '…';
  try {
    const res = await fetch('/api/chat/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        context: {
          laneMuseumDocent: true,
          personaName: ctx.personaName,
          docentIntro: ctx.docentIntro,
          featuredTitle: ctx.featuredTitle,
          sayingsContextBlock: ctx.sayingsContextBlock
        }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    out.textContent = data.response || '(Empty response.)';
  } catch (err) {
    out.textContent = `The docent could not answer right now (${err.message}). You can still browse exhibits and timelines offline.`;
  }
}

function renderDocent(docent = {}, featuredStory = {}, sayingsEntries = []) {
  document.getElementById('docentName').textContent = docent.personaName || 'American History + Lane Expert';
  document.getElementById('docentIntro').textContent =
    docent.intro || 'Ask about William E Lane of Boston and chronological Lane history.';
  const sayingsContextBlock = formatSayingsContextBlock(sayingsEntries);
  const ctx = {
    personaName: docent.personaName || 'American History + Lane Expert',
    docentIntro: docent.intro || '',
    featuredTitle: featuredStory.title || '',
    sayingsContextBlock
  };
  const chipsHost = document.getElementById('promptChips');
  const chips = docent.promptChips || [];
  chipsHost.innerHTML = chips
    .map((chip) => `<button class="prompt-chip" type="button">${escapeHtml(chip)}</button>`)
    .join('');
  chipsHost.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const question = chip.textContent || '';
      askLaneMuseumDocent(question, ctx);
    });
  });
}

async function initLaneMuseum() {
  const [contentRes, featuredRes, prominentRes, sayingsRes] = await Promise.all([
    getJson('/api/genealogy/museum-content'),
    getJson('/api/genealogy/featured-story'),
    getJson('/api/genealogy/prominent-lanes'),
    getJson('/api/genealogy/lane-book-sayings').catch(() => ({ success: false, entries: [] }))
  ]);

  const content = contentRes.content || {};
  const featuredStory = featuredRes.featuredStory || {};
  const prominentLanes = prominentRes.prominentLanes || [];
  const sayingsEntries = Array.isArray(sayingsRes.entries) ? sayingsRes.entries : [];

  cachedMuseumContent = content;
  cachedFeaturedStory = featuredStory;
  cachedProminentLanes = prominentLanes;
  initMuseumPosterUi();

  renderHistoriansTeaser(content);
  renderThemeButtons(content.themes || {});
  renderFeatured(featuredStory, content);
  renderTimeline(content.timelineEvents || []);
  renderLunarObservatory(content.lunarExhibit);
  if (new URLSearchParams(window.location.search).get('lunar') === '1') {
    const lunarEl = document.getElementById('lunarObservatoryMount');
    if (lunarEl && !lunarEl.classList.contains('d-none')) {
      requestAnimationFrame(() => {
        lunarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
  renderProminent(prominentLanes);
  bindProminentPosterButtons();
  renderDocent(content.aiDocent || {}, featuredStory, sayingsEntries);
  if (typeof window.initHistoryQuickNav === 'function') {
    window.initHistoryQuickNav({ selector: '.history-quick-link[href^="#"]' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const errEl = document.getElementById('museumError');
    if (errEl) errEl.textContent = HISTORY_STATE_COPY.loading;
    await initLaneMuseum();
    if (errEl) errEl.textContent = '';
  } catch (error) {
    console.error('Failed to initialize Lane museum page:', error);
    document.getElementById('museumError').textContent =
      `${HISTORY_STATE_COPY.unavailable} Check /api/genealogy/museum-content.`;
  }
});
