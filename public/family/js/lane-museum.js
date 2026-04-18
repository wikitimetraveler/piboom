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

function renderProminent(prominent = []) {
  const host = document.getElementById('prominentGrid');
  if (!prominent.length) {
    host.innerHTML = '<div class="text-muted">Prominent lanes list pending.</div>';
    return;
  }
  host.innerHTML = prominent
    .map((entry) => {
      const person = entry.person || {};
      return `
        <article class="prominent-card">
          <div class="small text-muted">Exhibit order ${escapeHtml(entry.order || '?')}</div>
          <h3 class="h6 mb-1">${escapeHtml(person.name || entry.personQuery || 'Pending profile')}</h3>
          <div class="small mb-2">${escapeHtml(entry.eraLabel || '')}</div>
          <div class="small">${escapeHtml(entry.caption || '')}</div>
          <hr />
          <div class="small text-muted">
            ${escapeHtml(person.birthYear || 'Unknown')} - ${escapeHtml(person.deathYear || 'Unknown')}<br>
            ${escapeHtml(person.born || 'Location pending')}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderDocent(docent = {}, featuredStory = {}) {
  document.getElementById('docentName').textContent = docent.personaName || 'American History + Lane Expert';
  document.getElementById('docentIntro').textContent =
    docent.intro || 'Ask about William E Lane of Boston and chronological Lane history.';
  const chipsHost = document.getElementById('promptChips');
  const chips = docent.promptChips || [];
  chipsHost.innerHTML = chips
    .map((chip) => `<button class="prompt-chip" type="button">${escapeHtml(chip)}</button>`)
    .join('');
  chipsHost.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const question = chip.textContent || '';
      const answer = `Guide response preview: ${question}\n\nStart with ${featuredStory.title || 'Exhibit 1'} and then continue through later chronological exhibits with cited sourceRefs.`;
      document.getElementById('docentAnswer').textContent = answer;
    });
  });
}

async function initLaneMuseum() {
  const [contentRes, featuredRes, prominentRes] = await Promise.all([
    getJson('/api/genealogy/museum-content'),
    getJson('/api/genealogy/featured-story'),
    getJson('/api/genealogy/prominent-lanes')
  ]);

  const content = contentRes.content || {};
  const featuredStory = featuredRes.featuredStory || {};
  const prominentLanes = prominentRes.prominentLanes || [];

  renderThemeButtons(content.themes || {});
  renderFeatured(featuredStory, content);
  renderTimeline(content.timelineEvents || []);
  renderProminent(prominentLanes);
  renderDocent(content.aiDocent || {}, featuredStory);
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
