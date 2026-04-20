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
    return;
  }
  secondaryHost.innerHTML = secondary
    .map((item) => {
      if (item.type === 'image') {
        return `<div class="museum-media-item"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || 'Media item')}" onerror="this.parentElement.innerHTML='<div class=&quot;museum-placeholder&quot;>Media unavailable</div>'" /></div>`;
      }
      return `<div class="museum-media-item"><div class="museum-placeholder">${escapeHtml(item.type || 'media')}<br>${escapeHtml(item.caption || '')}</div></div>`;
    })
    .join('');
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
      const geneUrl =
        pid != null
          ? `/family/genealogy.html?q=${encodeURIComponent(String(title).replace(/\s+/g, ' ').trim())}`
          : '/family/genealogy.html';
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
            <a class="small prominent-tree-link" href="${escapeHtml(geneUrl)}">Search in family tree</a>
          </div>
          <div class="mt-1">
            <a class="small prominent-wall-link" href="${escapeHtml(memorialUrl)}">View on memorial wall</a>
          </div>
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
    mount.classList.add('d-none');
    return;
  }
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
