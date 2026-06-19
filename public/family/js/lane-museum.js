/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
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
const MUSEUM_CURATED_PROMINENT_IMAGE_BY_PERSON_ID = Object.freeze({
  3: '/family/assets/mary-brewer-lane.png',
  6: '/family/assets/samuel-lane.png',
  13: '/family/assets/sarah-dickinson-lane.png',
  36: '/family/assets/cornet-john-lane.png',
  94: '/family/assets/jonathan-homer-lane.png',
  1024: '/family/assets/aaron-g-lane.png'
});

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

function resolveProminentImageUrl(entry = {}) {
  const person = entry.person || {};
  const personId = Number(person.id ?? entry.personId);
  const curated = Number.isFinite(personId) ? MUSEUM_CURATED_PROMINENT_IMAGE_BY_PERSON_ID[personId] : '';
  if (curated) return curated;
  return entry.imageUrl != null ? String(entry.imageUrl).trim() : '';
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
  function pub(path) {
    if (typeof window.lanePublicUrl === 'function') return window.lanePublicUrl(path);
    return new URL(path, 'https://www.thelanefamily.us/').href;
  }
  if (!poster) return pub('/family/lane-museum.html');
  if (poster.kind === 'prominent') {
    const entry = poster.prominentEntry || {};
    const person = entry.person || {};
    const pid = person.id != null ? person.id : entry.personId;
    if (pid != null) {
      return pub(`/family/lane-memorial-wall.html?personId=${encodeURIComponent(String(pid))}`);
    }
  }
  if (poster.kind === 'lunar') {
    const lunar = cachedLunarExhibit || {};
    return resolveQuickMapHref(lunar) || pub('/family/lane-museum.html');
  }
  return pub('/family/lane-museum.html#museumFeaturedPanel');
}

function buildMuseumTemplateData(poster) {
  if (poster.kind === 'prominent') {
    const entry = poster.prominentEntry || {};
    const person = entry.person || {};
    const title = entry.displayName || person.name || entry.personQuery || 'Exhibit';
    const subtitle = entry.eraLabel || '';
    const img = exhibitPosterCoverUrl(resolveProminentImageUrl(entry));
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
    const coverSrc = escapeAttrSrc(exhibitPosterCoverUrl(resolveProminentImageUrl(entry)));
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
  bindMuseumPosterExpand(host);
}

function bindMuseumPosterExpand(host) {
  if (!host) return;
  host.classList.add('lane-poster-expandable');
  host.setAttribute('role', 'button');
  host.setAttribute('tabindex', '0');
  const title = currentMuseumPoster?.title || currentMuseumPoster?.shareTitle || 'Exhibit card';
  host.setAttribute('aria-label', `Enlarge exhibit card: ${title}`);

  const enlarge = () => {
    if (!window.LaneImageLightbox?.openElement) return;
    window.LaneImageLightbox.openElement(host, { caption: title });
  };

  host.onclick = (event) => {
    if (event.target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();
    event.stopPropagation();
    enlarge();
  };
  host.onkeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    enlarge();
  };
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
  const posterModal = document.getElementById('museumPosterModal');
  if (posterModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(posterModal).show();
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
    const shareUrl =
      typeof window.lanePublicUrl === 'function'
        ? window.lanePublicUrl(shareData.shareUrl)
        : new URL(shareData.shareUrl, 'https://www.thelanefamily.us/').toString();
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

/** Caption/credit under featured secondary tiles (historic maps, period flags, etc.). */
function buildFeaturedSecondaryCaptionHtml(item) {
  const cap = String(item?.caption || '').trim();
  const cred = String(item?.credit || '').trim();
  if (!cap && !cred) return '';
  const line = cap && cred ? `${cap} · ${cred}` : cap || cred;
  return `<div class="museum-media-caption">${escapeHtml(line)}</div>`;
}

/** Wrap secondary tile image in a new-tab link when media JSON includes openUrl (e.g. Wikimedia Commons). */
function wrapFeaturedSecondaryImageHtml(imgHtml, item) {
  const raw = String(item?.openUrl || '').trim();
  if (!raw) return imgHtml;
  const id = String(item?.id || '');
  const capLower = String(item?.caption || '').toLowerCase();
  const ariaLabel =
    id.includes('map') || capLower.includes('map') || capLower.includes('peninsula')
      ? 'Open map source on Wikimedia Commons (new tab)'
      : 'Open image source on Wikimedia Commons (new tab)';
  return `<a class="museum-media-open-source" href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ariaLabel)}">${imgHtml}</a>`;
}

function renderFeatured(featuredStory = {}, museum = {}) {
  const person = featuredStory.featuredPerson || {};
  document.getElementById('featuredTitle').textContent =
    featuredStory.title || 'William E Lane of Boston';
  document.getElementById('featuredSubtitle').textContent =
    featuredStory.subtitle || 'Exhibit 1 · Opening exhibit';
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
          const capHtml = buildFeaturedSecondaryCaptionHtml(item);
          const altRaw = String(item.caption || item.credit || 'Media item').trim() || 'Media item';
          const alt = escapeHtml(altRaw);
          const imgHtml = `<img src="${escapeHtml(item.url)}" alt="${alt}" onerror="var n=this.closest('.museum-media-item');if(n)n.innerHTML='<div class=&quot;museum-placeholder&quot;>Media unavailable</div>';" />`;
          const inner = wrapFeaturedSecondaryImageHtml(imgHtml, item);
          return `<div class="museum-media-item"><div class="museum-media-item__visual">${inner}</div>${capHtml}</div>`;
        }
        return `<div class="museum-media-item"><div class="museum-placeholder">${escapeHtml(item.type || 'media')}<br>${escapeHtml(
          item.caption || ''
        )}</div>${buildFeaturedSecondaryCaptionHtml(item)}</div>`;
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
      const imgUrl = resolveProminentImageUrl(entry);
      const lifeSpanLine = `${person.birthYear || 'Unknown'} - ${person.deathYear || 'Unknown'}`;
      const coverMetaLine = person.born || entry.eraLabel || 'Lane family records';
      const coverMarkup = `
        <div class="prominent-card-cover" aria-hidden="true">
          <div class="prominent-card-cover__kicker">Lane Legacy Museum</div>
          <div class="prominent-card-cover__name">${escapeHtml(title)}</div>
          <div class="prominent-card-cover__dates">${escapeHtml(lifeSpanLine)}</div>
          <div class="prominent-card-cover__meta">${escapeHtml(coverMetaLine)}</div>
        </div>
      `;
      const mediaBlock =
        imgUrl !== ''
          ? `<figure class="prominent-card-media">
               <img src="${escapeHtml(imgUrl)}" alt="" loading="lazy"
                 onerror="this.closest('figure')?.classList.add('prominent-card-media--missing');" />
               ${coverMarkup}
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
          : `<figure class="prominent-card-media prominent-card-media--cover">
               ${coverMarkup}
             </figure>`;
      const cardMods = [imgUrl ? 'prominent-card--hero' : ''].filter(Boolean).join(' ');
      const orderLine =
        entry.order === 1
          ? 'Exhibit 1'
          : `Exhibit order ${escapeHtml(entry.order != null ? String(entry.order) : '?')}`;
      return `
        <article class="prominent-card ${cardMods}" data-person-id="${escapeHtml(String(pid ?? ''))}" data-museum-accent="${accentIndex}">
          ${mediaBlock}
          <div class="prominent-card-body">
          <div class="small text-muted">${orderLine}</div>
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
    out.textContent = `The docent could not answer right now (${err.message}). Check POST /api/chat/chat and OpenAI on the server. You can still browse exhibits and timelines offline.`;
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

/* --- Museum HyperFrames story mode --- */
const GEORGE_LANE_PROMINENT_PERSON_ID = 2898;
const STORAGE_MUSEUM_STORY_CHAPTERS = 'laneMuseumStoryChapters';
const STORAGE_MUSEUM_STORY_NARRATE = 'laneMuseumStoryNarrate';
const MUSEUM_STORY_SCENE_MS = 4600;
const MUSEUM_STORY_CHAPTER_MS = 3400;
const MUSEUM_STORY_GAP_MS = 200;

let museumSpeakToken = 0;
const museumStoryState = {
  running: false,
  playbackToken: 0,
  scenes: []
};
let museumStoryFloatResolveAnchor = null;
let museumStoryFloatScrollBound = false;
let museumStoryFloatReflowScheduled = false;
let museumStoryListenersBound = false;

function normalizeMuseumNarrationSpace(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function truncateMuseumNarration(raw, max) {
  const t = normalizeMuseumNarrationSpace(raw);
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}\u2026`;
}

function escapeMuseumCssAttr(val) {
  const text = String(val ?? '');
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(text);
  }
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function museumStoryChaptersEnabled() {
  const el = document.getElementById('museumStoryChapters');
  return !el || el.checked;
}

function museumStoryNarrationEnabled() {
  const el = document.getElementById('museumStoryNarrate');
  return !!(el && el.checked);
}

function persistMuseumStoryOptions() {
  const ch = document.getElementById('museumStoryChapters');
  const na = document.getElementById('museumStoryNarrate');
  try {
    if (ch) localStorage.setItem(STORAGE_MUSEUM_STORY_CHAPTERS, ch.checked ? '1' : '0');
    if (na) localStorage.setItem(STORAGE_MUSEUM_STORY_NARRATE, na.checked ? '1' : '0');
  } catch (_) {}
}

function loadMuseumStoryOptions() {
  const ch = document.getElementById('museumStoryChapters');
  const na = document.getElementById('museumStoryNarrate');
  try {
    if (ch) {
      const v = localStorage.getItem(STORAGE_MUSEUM_STORY_CHAPTERS);
      if (v === '0') ch.checked = false;
      else if (v === '1') ch.checked = true;
      else ch.checked = true;
    }
    if (na) {
      const v = localStorage.getItem(STORAGE_MUSEUM_STORY_NARRATE);
      if (v === '1') na.checked = true;
      else if (v === '0') na.checked = false;
      else na.checked = true; /* default: narrate on for Story Mode / HyperFrames */
    }
  } catch (_) {}
}

function findGeorgeLaneProminentEntry(entries) {
  const id = GEORGE_LANE_PROMINENT_PERSON_ID;
  const list = Array.isArray(entries) ? entries : [];
  return (
    list.find((e) => {
      const a = e?.personId != null ? Number(e.personId) : NaN;
      const b = e?.person?.id != null ? Number(e.person.id) : NaN;
      return a === id || b === id;
    }) || null
  );
}

function historiansTeaserVisible() {
  const el = document.getElementById('museumHistoriansTeaser');
  if (!el || el.hasAttribute('hidden')) return false;
  return !!normalizeMuseumNarrationSpace(el.innerText || el.textContent);
}

function lunarObservatoryVisible() {
  const mount = document.getElementById('lunarObservatoryMount');
  return !!(mount && !mount.classList.contains('d-none') && normalizeMuseumNarrationSpace(mount.innerText || ''));
}

function rebuildMuseumStoryScenesAfterContent() {
  museumStoryState.scenes = buildMuseumStoryScenes();
  updateMuseumStoryToggleButton();
}

function buildMuseumStoryScenes() {
  const chapters = museumStoryChaptersEnabled();
  const scenes = [];
  const fs = cachedFeaturedStory || {};
  const cms = cachedMuseumContent || {};
  const teaser = cms.historiansTeaser || {};
  const lunar = cachedLunarExhibit || {};

  /** @typedef {{ scrollEl?: () => Element | null, floatEl?: () => Element | null, kicker: string, title: string, copy: string, narration: string, durationMs: number }} MuseumScene */

  /** @type {Array<MuseumScene & { scrollEl?: () => Element | null, floatEl?: () => Element | null }>} */
  const add = (s) => scenes.push(s);

  if (chapters) {
    add({
      scrollEl: () => document.getElementById('museumHero'),
      floatEl: () => document.getElementById('museumHero'),
      kicker: 'Welcome',
      title: 'Lane Legacy Museum · guided reel',
      copy: 'Quiet chronological gallery—from Boston onward through later Lane generations.',
      narration: normalizeMuseumNarrationSpace(
        'Welcome to the Lane Legacy Museum. This guided reel highlights curated exhibits across the gallery: Boston origins, compilers and sources, nineteenth-century Popular Science-era coverage of a Hampton Falls figure, astronomy naming honors, then a chronological sampler of prominent Lanes.'
      ),
      durationMs: MUSEUM_STORY_CHAPTER_MS
    });
  }

  const ft = document.getElementById('featuredTitle')?.textContent || '';
  const fsub = document.getElementById('featuredSubtitle')?.textContent || '';
  const fsumEl = document.getElementById('featuredSummary');
  const fsumRaw = normalizeMuseumNarrationSpace((fsumEl?.textContent || fsumEl?.innerText || '').trim());

  add({
    scrollEl: () => document.getElementById('museumFeaturedPanel'),
    floatEl: () => document.getElementById('museumFeaturedPanel'),
    kicker: 'Opening exhibit',
    title: truncateMuseumText(ft || fs.title || 'Featured exhibit', 120),
    copy: truncateMuseumText(fsub || fs.subtitle || '', 160),
    narration: truncateMuseumNarration(
      normalizeMuseumNarrationSpace(
        `${ft || fs.title || 'The opening exhibit'}, ${normalizeMuseumNarrationSpace(fsub || fs.subtitle || '')}. ` +
          (fsumRaw ||
            normalizeMuseumNarrationSpace(fs.summary || '') ||
            'This panel anchors colonial New England chronology for Lane lines preserved in cited records.')
      ),
      780
    ),
    durationMs: MUSEUM_STORY_SCENE_MS
  });

  if (historiansTeaserVisible()) {
    const hTitleEl = document.querySelector('.museum-historians-teaser__title');
    const ledeEl = document.querySelector('.museum-historians-teaser__lede');
    const ht = truncateMuseumText(
      normalizeMuseumNarrationSpace(hTitleEl?.textContent || teaser.title || 'Honoring the compilers'),
      100
    );
    const hledeRaw = normalizeMuseumNarrationSpace(ledeEl?.textContent || teaser.lede || '');
    add({
      scrollEl: () => document.getElementById('museumHistoriansTeaser'),
      floatEl: () => document.getElementById('museumHistoriansTeaser'),
      kicker: 'Historians · compilers',
      title: ht,
      copy: truncateMuseumText(hledeRaw, 240),
      narration: truncateMuseumNarration(
        normalizeMuseumNarrationSpace(
          `Behind the plaques and printed volumes stand compilers and trustees. ${hledeRaw || 'Lane Historians links frontispieces, timelines, and the editorial labor that condensed centuries into book form.'}`
        ),
        620
      ),
      durationMs: MUSEUM_STORY_SCENE_MS
    });
  }

  const geoEntry = findGeorgeLaneProminentEntry(cachedProminentLanes);
  const geoPid = geoEntry?.personId != null ? String(geoEntry.personId) : String(GEORGE_LANE_PROMINENT_PERSON_ID);
  const geoSel = `.prominent-grid .prominent-card[data-person-id="${escapeMuseumCssAttr(geoPid)}"]`;
  if (geoEntry) {
    const display = geoEntry.displayName || 'George G. Lane';
    const cap = normalizeMuseumNarrationSpace(geoEntry.caption || '');
    const blurb = normalizeMuseumNarrationSpace(geoEntry.blurb || '');
    add({
      scrollEl: () =>
        document.querySelector(geoSel) || document.getElementById('museumProminentPanel'),
      floatEl: () =>
        document.querySelector(geoSel) || document.getElementById('museumProminentPanel'),
      kicker: 'Popular Science Monthly · May 1884',
      title: truncateMuseumText(`${display}`, 80),
      copy: truncateMuseumText(`${cap}`, 260),
      narration: truncateMuseumNarration(
        normalizeMuseumNarrationSpace(
          `${display}, in Popular Science Monthly, May eighteen eighty-four. ${cap}${blurb ? ` ${blurb}` : ''} ` +
            `The companion read-along Was He an Idiot is on this Lane family site, with figures and fuller context. Period language overlaps today's idea of idiot savant, used here strictly as historical wording.`
        ),
        960
      ),
      durationMs: MUSEUM_STORY_SCENE_MS
    });
  }

  if (lunarObservatoryVisible()) {
    const lt = normalizeMuseumNarrationSpace(lunar.title || '');
    const lst = normalizeMuseumNarrationSpace(lunar.subtitle || '');
    const lb = normalizeMuseumNarrationSpace(lunar.body || '');
    const nomen = normalizeMuseumNarrationSpace(lunar.nomenclatureOrigin || '');
    const lunarNarrPieces = [];
    if (lt) lunarNarrPieces.push(`${lt}.`);
    if (lst) lunarNarrPieces.push(lst);
    if (nomen) lunarNarrPieces.push(nomen);
    else
      lunarNarrPieces.push(
        'Jonathan Homer Lane helped model gaseous stars; Mare Cognitum holds Lane crater honoring that astronomical work.'
      );
    if (lb) lunarNarrPieces.push(truncateMuseumNarration(lb, 420));
    add({
      scrollEl: () => document.getElementById('lunarObservatoryMount'),
      floatEl: () => document.getElementById('lunarObservatoryMount'),
      kicker: 'Lunar nomenclature',
      title: lt || 'Lane crater observatory',
      copy: truncateMuseumText(`${lst}`, 200),
      narration: truncateMuseumNarration(normalizeMuseumNarrationSpace(lunarNarrPieces.join(' ')), 980),
      durationMs: MUSEUM_STORY_SCENE_MS
    });
  }

  const timelineHeading = document.getElementById('prominentTimelineHeading');
  add({
    scrollEl: () => timelineHeading || document.getElementById('museumProminentPanel'),
    floatEl: () => timelineHeading || document.getElementById('museumProminentPanel'),
    kicker: 'Prominent Lanes · chronology',
    title: 'Chronological highlights',
    copy: 'Milestones from museum content—inscription lines on the memorial wall expand many of these vignettes.',
    narration: truncateMuseumNarration(
      `Here concludes the highlighted circle: chronological milestones under Prominent Lanes. Continue to the memorial wall entry lines for births, deaths, places, and book-sourced excerpts when you want deeper evidence.`,
      720
    ),
    durationMs: MUSEUM_STORY_CHAPTER_MS
  });

  return scenes;
}

function updateMuseumStoryToggleButton() {
  const toggle = document.getElementById('museumStoryToggle');
  if (!toggle) return;
  const hasPlaylist = museumStoryState.scenes.length > 0;
  toggle.disabled = !hasPlaylist && !museumStoryState.running;
  toggle.setAttribute('aria-pressed', museumStoryState.running ? 'true' : 'false');
  toggle.textContent = museumStoryState.running ? 'Pause highlight reel' : 'Play highlight reel';
}

function unbindMuseumStoryFloatListeners() {
  if (!museumStoryFloatScrollBound) return;
  window.removeEventListener('scroll', onMuseumStoryFloatingReflow, true);
  window.removeEventListener('resize', onMuseumStoryFloatingReflow);
  museumStoryFloatScrollBound = false;
}

function onMuseumStoryFloatingReflow() {
  if (!museumStoryState.running) return;
  const overlay = document.getElementById('museumStoryOverlay');
  if (!overlay || overlay.classList.contains('d-none')) return;
  if (museumStoryFloatReflowScheduled) return;
  museumStoryFloatReflowScheduled = true;
  window.requestAnimationFrame(() => {
    museumStoryFloatReflowScheduled = false;
    repositionMuseumFloatingNugget();
  });
}

function bindMuseumStoryFloatListeners() {
  if (museumStoryFloatScrollBound) return;
  window.addEventListener('scroll', onMuseumStoryFloatingReflow, true);
  window.addEventListener('resize', onMuseumStoryFloatingReflow);
  museumStoryFloatScrollBound = true;
}

function clearMuseumFloatingOverlayStyles() {
  const overlay = document.getElementById('museumStoryOverlay');
  if (!overlay) return;
  overlay.classList.remove('museum-story-overlay--floating');
  overlay.style.left = '';
  overlay.style.right = '';
  overlay.style.top = '';
  overlay.style.bottom = '';
  overlay.style.transform = '';
  overlay.style.width = '';
  overlay.style.maxWidth = '';
}

function museumStoryClamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function positionMuseumStoryFloatingNear(anchorEl) {
  const overlay = document.getElementById('museumStoryOverlay');
  if (!overlay || overlay.classList.contains('d-none')) return;

  const pad = 10;
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  overlay.classList.add('museum-story-overlay--floating');

  const anchor = anchorEl instanceof Element ? anchorEl : null;

  function placeFallbackCenter() {
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.left = '50%';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
    overlay.style.top = `${Math.round(museumStoryClamp(Math.min(vh * 0.2, Math.max(vh * 0.12, pad + 76)), pad, vh * 0.35))}px`;
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
    left = museumStoryClamp(left, pad, vw - w - pad);
    let top = r.bottom + gap;
    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.right = 'auto';
    overlay.style.width = `${w}px`;
    overlay.style.bottom = 'auto';
    overlay.style.top = `${Math.round(top)}px`;

    window.requestAnimationFrame(() => {
      const ob = overlay.getBoundingClientRect();
      if (ob.bottom > vh - pad) {
        const aboveTop = museumStoryClamp(Math.round(r.top - gap - ob.height), pad, vh - ob.height - pad);
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
  const midY = r.top + r.height / 2;
  overlay.style.top = `${Math.round(midY)}px`;
  overlay.style.left = `${leftGuess}px`;

  window.requestAnimationFrame(() => {
    const ob = overlay.getBoundingClientRect();
    if (leftGuess + ob.width > vw - pad) {
      leftGuess = Math.round(r.left - gap - ob.width);
    }
    leftGuess = museumStoryClamp(leftGuess, pad, vw - ob.width - pad);
    overlay.style.left = `${leftGuess}px`;

    const ob2 = overlay.getBoundingClientRect();
    const half = ob2.height / 2;
    const centerY = museumStoryClamp(r.top + r.height / 2, pad + half, vh - half - pad);
    overlay.style.top = `${Math.round(centerY)}px`;
  });
}

function repositionMuseumFloatingNugget() {
  let anchor = typeof museumStoryFloatResolveAnchor === 'function' ? museumStoryFloatResolveAnchor() : null;
  if (!anchor || !(anchor instanceof Element))
    anchor = document.querySelector('.museum-story-spotlight');
  positionMuseumStoryFloatingNear(anchor || null);
}

function scheduleMuseumRepositionNugget() {
  const slots = [0, 48, 200, 450];
  for (let i = 0; i < slots.length; i++) {
    window.setTimeout(() => repositionMuseumFloatingNugget(), slots[i]);
  }
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => repositionMuseumFloatingNugget())
  );
}

function setMuseumStoryOverlay(scene) {
  const overlay = document.getElementById('museumStoryOverlay');
  const kickerEl = document.getElementById('museumStorySceneKicker');
  const titleEl = document.getElementById('museumStorySceneTitle');
  const copyEl = document.getElementById('museumStorySceneCopy');
  if (!overlay || !kickerEl || !titleEl || !copyEl) return;
  if (!scene) {
    unbindMuseumStoryFloatListeners();
    museumStoryFloatResolveAnchor = null;
    clearMuseumFloatingOverlayStyles();
    overlay.classList.add('d-none');
    kickerEl.textContent = '';
    titleEl.textContent = '';
    copyEl.textContent = '';
    return;
  }
  bindMuseumStoryFloatListeners();
  overlay.classList.remove('d-none');
  kickerEl.textContent = scene.kicker || '';
  titleEl.textContent = scene.title || '';
  copyEl.textContent = scene.copy || '';
  scheduleMuseumRepositionNugget();
}

function clearMuseumStorySpotlights() {
  document.querySelectorAll('.museum-story-spotlight').forEach((el) => {
    el.classList.remove('museum-story-spotlight');
  });
}

function stopMuseumStoryNarration() {
  museumSpeakToken += 1;
  if (typeof window.stopSpeech === 'function') window.stopSpeech();
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function sleepMuseumStory(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function applyMuseumStoryScene(scene) {
  clearMuseumStorySpotlights();
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reducedMotion ? 'auto' : 'smooth';

  const scrollTarget = typeof scene.scrollEl === 'function' ? scene.scrollEl() : null;
  const floatTarget =
    typeof scene.floatEl === 'function' ? scene.floatEl() || scrollTarget : scrollTarget;

  museumStoryFloatResolveAnchor = function museumStoryFloatAnchorResolver() {
    return floatTarget instanceof Element ? floatTarget : null;
  };

  setMuseumStoryOverlay(scene);

  if (floatTarget instanceof Element) floatTarget.classList.add('museum-story-spotlight');
  const elScroll = scrollTarget instanceof Element ? scrollTarget : floatTarget;
  if (elScroll && typeof elScroll.scrollIntoView === 'function')
    elScroll.scrollIntoView({ behavior, block: 'center' });
}

function stopMuseumStoryMode(preserveOverlay) {
  const keep = !!preserveOverlay;
  stopMuseumStoryNarration();
  museumStoryState.running = false;
  museumStoryState.playbackToken += 1;
  clearMuseumStorySpotlights();
  if (!keep) setMuseumStoryOverlay(null);
  updateMuseumStoryToggleButton();
}

async function museumStoryPlaybackLoop(playbackToken) {
  if (!museumStoryState.scenes.length) {
    stopMuseumStoryNarration();
    museumStoryState.running = false;
    updateMuseumStoryToggleButton();
    return;
  }
  let idx = 0;
  while (
    museumStoryState.running &&
    playbackToken === museumStoryState.playbackToken &&
    museumStoryState.scenes.length
  ) {
    stopMuseumStoryNarration();
    const scene = museumStoryState.scenes[idx];
    if (!scene) break;
    applyMuseumStoryScene(scene);
    const narrToken = museumSpeakToken;
    const narrationText = normalizeMuseumNarrationSpace(scene.narration || '');
    const narrPromise =
      museumStoryNarrationEnabled() && narrationText && typeof window.speakNarrationAwaitEnd === 'function'
        ? window.speakNarrationAwaitEnd(narrationText, {
            volume: 0.85,
            isCancelled: () => narrToken !== museumSpeakToken
          })
        : Promise.resolve();
    const minMs = Number(scene.durationMs) || MUSEUM_STORY_SCENE_MS;
    await Promise.all([narrPromise, sleepMuseumStory(minMs)]);
    if (!museumStoryState.running || playbackToken !== museumStoryState.playbackToken) break;
    if (idx + 1 >= museumStoryState.scenes.length) {
      stopMuseumStoryMode(true);
      break;
    }
    await sleepMuseumStory(MUSEUM_STORY_GAP_MS);
    idx += 1;
  }
  if (!museumStoryState.running) {
    updateMuseumStoryToggleButton();
  }
}

function museumStoryRestartKeepPlaying() {
  stopMuseumStoryNarration();
  museumStoryState.playbackToken += 1;
  museumStoryState.running = true;
  const token = museumStoryState.playbackToken;
  if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
  if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  updateMuseumStoryToggleButton();
  void museumStoryPlaybackLoop(token);
}

function startMuseumStoryMode() {
  if (!museumStoryState.scenes.length) return;
  if (typeof window.laneTtsStopPlayback === 'function') window.laneTtsStopPlayback();
  stopMuseumStoryNarration();
  museumStoryState.playbackToken += 1;
  museumStoryState.running = true;
  const token = museumStoryState.playbackToken;
  if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
  if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  updateMuseumStoryToggleButton();
  void museumStoryPlaybackLoop(token);
}

function initMuseumStoryMode() {
  if (museumStoryListenersBound) return;
  museumStoryListenersBound = true;
  loadMuseumStoryOptions();

  document.getElementById('museumStoryToggle')?.addEventListener('click', () => {
    if (museumStoryState.running) {
      stopMuseumStoryMode();
    } else {
      museumStoryState.scenes = buildMuseumStoryScenes();
      if (!museumStoryState.scenes.length) {
        updateMuseumStoryToggleButton();
        return;
      }
      startMuseumStoryMode();
    }
  });

  ['museumStoryChapters', 'museumStoryNarrate'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      persistMuseumStoryOptions();
      museumStoryState.scenes = buildMuseumStoryScenes();
      if (!museumStoryState.scenes.length) stopMuseumStoryMode();
      else if (museumStoryState.running) museumStoryRestartKeepPlaying();
      updateMuseumStoryToggleButton();
    });
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !museumStoryState.running) return;
      stopMuseumStoryMode();
    },
    true
  );

  updateMuseumStoryToggleButton();
}

document.addEventListener('DOMContentLoaded', async () => {
  initMuseumStoryMode();
  try {
    const errEl = document.getElementById('museumError');
    if (errEl) errEl.textContent = HISTORY_STATE_COPY.loading;
    await initLaneMuseum();
    rebuildMuseumStoryScenesAfterContent();
    if (errEl) errEl.textContent = '';
  } catch (error) {
    console.error('Failed to initialize Lane museum page:', error);
    document.getElementById('museumError').textContent =
      `${HISTORY_STATE_COPY.unavailable} Check GET /api/genealogy/museum-content, featured-story, and prominent-lanes.`;
    rebuildMuseumStoryScenesAfterContent();
  }
});
