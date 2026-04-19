const MUSEUM_THEME_KEY = 'laneMuseumTheme';

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
    featuredStory.summary || 'No featured summary available yet.';

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
    host.innerHTML = '<div class="text-muted">Timeline data pending.</div>';
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

function isProminentInternalLink(lnk) {
  if (!lnk || !lnk.url) return false;
  if (lnk.kind === 'article' || lnk.kind === 'internal') return true;
  const u = String(lnk.url);
  return u.startsWith('/') && !u.startsWith('//');
}

function renderProminent(prominent = []) {
  const host = document.getElementById('prominentGrid');
  if (!prominent.length) {
    host.innerHTML = '<div class="text-muted">Prominent lanes list pending.</div>';
    return;
  }
  host.innerHTML = prominent
    .map((entry) => {
      const person = entry.person || {};
      const title = entry.displayName || person.name || entry.personQuery || 'Pending profile';
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
        <article class="prominent-card ${cardMods}">
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
          </div>
        </article>
      `;
    })
    .join('');
}

function renderLunarObservatory(lunar) {
  const mount = document.getElementById('lunarObservatoryMount');
  if (!mount) return;
  if (!lunar || typeof lunar !== 'object') {
    mount.classList.add('d-none');
    return;
  }
  mount.classList.remove('d-none');
  const lat = lunar.latitude != null ? Number(lunar.latitude) : null;
  const lon = lunar.longitude != null ? Number(lunar.longitude) : null;
  const coordLine =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)}°, ${lon.toFixed(2)}° (lunar)`
      : 'Coordinates on USGS sheet';
  const diam = lunar.diameterKm != null ? `~${escapeHtml(String(lunar.diameterKm))} km` : '—';
  const img = lunar.imageUrl
    ? `<div class="lunar-observatory-visual">
         <img src="${escapeHtml(lunar.imageUrl)}" alt="" class="lunar-observatory-img" loading="lazy"
           onerror="this.style.display='none';this.parentElement.classList.add('lunar-observatory-visual--fallback');" />
       </div>`
    : '<div class="lunar-observatory-visual lunar-observatory-visual--fallback" aria-hidden="true"></div>';

  mount.innerHTML = `
    <div class="lunar-observatory-inner">
      <div class="lunar-observatory-copy">
        <div class="lunar-observatory-kicker"><span class="lunar-badge">Lunar-5</span> observatory</div>
        <h2 class="h4 mb-1">${escapeHtml(lunar.title || 'Lane crater')}</h2>
        <p class="text-muted small mb-2">${escapeHtml(lunar.subtitle || '')}</p>
        <p class="small lunar-observatory-body">${escapeHtml(lunar.body || '')}</p>
        <dl class="lunar-coords row small mb-3">
          <div class="col-sm-4"><dt>Feature</dt><dd>${escapeHtml(lunar.featureName || 'Lane')}</dd></div>
          <div class="col-sm-4"><dt>Approx. coords</dt><dd>${escapeHtml(coordLine)}</dd></div>
          <div class="col-sm-4"><dt>Diameter</dt><dd>${diam}</dd></div>
        </dl>
        <div class="lunar-action-row">
          ${lunar.quickMapUrl ? `<a class="btn btn-sm btn-outline-light lunar-btn" href="${escapeHtml(lunar.quickMapUrl)}" target="_blank" rel="noopener noreferrer">Open LROC QuickMap</a>` : ''}
          ${lunar.moonTrekUrl ? `<a class="btn btn-sm btn-outline-light lunar-btn" href="${escapeHtml(lunar.moonTrekUrl)}" target="_blank" rel="noopener noreferrer">NASA Moon Trek</a>` : ''}
          ${lunar.usgsUrl ? `<a class="btn btn-sm btn-outline-warning lunar-btn" href="${escapeHtml(lunar.usgsUrl)}" target="_blank" rel="noopener noreferrer">USGS nomenclature</a>` : ''}
        </div>
        ${lunar.imageCredit ? `<p class="small text-muted mt-2 mb-0">${escapeHtml(lunar.imageCredit)}</p>` : ''}
      </div>
      ${img}
    </div>
  `;
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
  renderProminent(prominentLanes);
  renderDocent(content.aiDocent || {}, featuredStory, sayingsEntries);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initLaneMuseum();
  } catch (error) {
    console.error('Failed to initialize Lane museum page:', error);
    document.getElementById('museumError').textContent =
      'Could not load museum data right now. Check /api/genealogy/museum-content.';
  }
});
