/**
 * ISS Station page — catalog, About/Who, live pass schedule
 * Development work by David Lane
 */
import { createStationScene } from './station-scene.js';

const CATALOG_URL = '/data/planetarium/iss-station.json';
const DEFAULT_OBS = { lat: 42.9168, lon: -70.8639, label: 'Hampton Falls, NH' };

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPassWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return iso;
  }
}

function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

async function loadCatalog() {
  const res = await fetch(CATALOG_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  return res.json();
}

function renderAbout(catalog) {
  const about = catalog.about || {};
  const body = document.getElementById('psAboutBody');
  const facts = document.getElementById('psAboutFacts');
  if (body) {
    const parts = [];
    if (about.headline) parts.push(about.headline);
    if (about.body) parts.push(about.body);
    body.textContent = parts.join(' — ');
  }
  if (!facts) return;
  facts.replaceChildren();
  (about.facts || []).forEach((fact) => {
    const dt = document.createElement('dt');
    dt.textContent = fact.label || '';
    const dd = document.createElement('dd');
    dd.textContent = fact.value || '';
    facts.append(dt, dd);
  });
}

function renderAgencies(catalog) {
  const host = document.getElementById('psAgencyList');
  if (!host) return;
  host.replaceChildren();
  (catalog.agencies || []).forEach((agency) => {
    const li = document.createElement('li');
    li.innerHTML =
      '<strong>' +
      esc(agency.name) +
      '</strong><span>' +
      esc(agency.fullName || '') +
      (agency.role ? ' — ' + esc(agency.role) : '') +
      '</span>';
    host.appendChild(li);
  });
}

function renderModuleCard(mod) {
  if (!mod) return;
  const kicker = document.getElementById('psModuleKicker');
  const name = document.getElementById('psModuleName');
  const summary = document.getElementById('psModuleSummary');
  const detail = document.getElementById('psModuleDetail');
  if (kicker) kicker.textContent = (mod.agency || 'Module') + (mod.role ? ' · ' + mod.role : '');
  if (name) name.textContent = mod.name || mod.shortName || mod.id;
  if (summary) summary.textContent = mod.summary || '';
  if (detail) detail.textContent = mod.detail || '';
}

function renderModuleRail(modules, onSelect) {
  const rail = document.getElementById('psModuleRail');
  if (!rail) return;
  rail.replaceChildren();
  modules.forEach((mod) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-module-rail__btn';
    btn.dataset.moduleId = mod.id;
    btn.style.setProperty('--ps-mod', mod.color || '#ffd278');
    btn.textContent = mod.shortName || mod.name || mod.id;
    btn.addEventListener('click', () => onSelect(mod.id));
    li.appendChild(btn);
    rail.appendChild(li);
  });
}

function setActiveRail(moduleId) {
  document.querySelectorAll('.ps-module-rail__btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.moduleId === moduleId);
  });
}

function renderCrew(people, statusText, fromFallback) {
  const list = document.getElementById('psCrewList');
  const status = document.getElementById('psCrewStatus');
  if (status) status.textContent = statusText || '';
  if (!list) return;
  list.replaceChildren();
  if (!people?.length) {
    const li = document.createElement('li');
    li.className = 'ps-empty';
    li.textContent = 'No crew listed right now.';
    list.appendChild(li);
    return;
  }
  people.forEach((person) => {
    const li = document.createElement('li');
    const meta = [person.craft, person.agency].filter(Boolean).join(' · ');
    li.innerHTML =
      '<strong>' +
      esc(person.name) +
      '</strong>' +
      (meta ? '<span>' + esc(meta) + (fromFallback ? ' (cached)' : '') + '</span>' : '');
    list.appendChild(li);
  });
}

async function loadCrew(catalog) {
  try {
    const res = await fetch('/api/planetarium/iss-crew');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || 'Crew feed unavailable');
    const people = Array.isArray(data.people) ? data.people : [];
    renderCrew(
      people,
      people.length
        ? `${people.length} aboard the ISS · ${data.source || 'open-notify'}`
        : 'Crew feed returned an empty list.',
      false
    );
  } catch (_) {
    const fallback = (catalog.crewFallback || []).filter((p) => p && p.name);
    renderCrew(fallback, 'Live crew feed unavailable — showing catalog note.', true);
  }
}

function renderPasses(passes, obsLabel) {
  const list = document.getElementById('psPassList');
  const status = document.getElementById('psPassStatus');
  if (status) {
    status.textContent = passes?.length
      ? `Next passes near ${obsLabel}`
      : `No passes predicted near ${obsLabel} in the next couple of days.`;
  }
  if (!list) return;
  list.replaceChildren();
  if (!passes?.length) {
    const li = document.createElement('li');
    li.innerHTML = '<p class="ps-empty mb-0">Try again later or change location.</p>';
    list.appendChild(li);
    return;
  }
  passes.slice(0, 5).forEach((pass) => {
    const li = document.createElement('li');
    const when = pass.start || '';
    const elev =
      Number.isFinite(pass.maxElev) ? ` · max ${Math.round(pass.maxElev)}°` : '';
    const href = '/planetarium/?at=' + encodeURIComponent(when);
    li.innerHTML =
      '<a href="' +
      esc(href) +
      '">' +
      esc(formatPassWhen(when)) +
      '</a><span class="ps-pass-meta">' +
      esc(formatDuration(pass.duration)) +
      esc(elev) +
      ' · open in Theater</span>';
    list.appendChild(li);
  });
}

async function loadPasses(lat, lon, label) {
  const status = document.getElementById('psPassStatus');
  if (status) status.textContent = 'Loading ISS passes…';
  try {
    const res = await fetch(
      '/api/planetarium/iss-passes?lat=' +
        encodeURIComponent(lat) +
        '&lon=' +
        encodeURIComponent(lon)
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Pass feed unavailable');
    }
    renderPasses(data.passes || [], label);
  } catch (err) {
    if (status) status.textContent = 'ISS pass feed unavailable — ' + String(err.message || err).slice(0, 120);
    const list = document.getElementById('psPassList');
    if (list) {
      list.innerHTML = '<li><p class="ps-empty mb-0">Could not load passes. Try Use my location again.</p></li>';
    }
  }
}

function requestLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...DEFAULT_OBS, fromGeo: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'your location',
          fromGeo: true,
        });
      },
      () => resolve({ ...DEFAULT_OBS, fromGeo: false }),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  });
}

async function boot() {
  const catalog = await loadCatalog();
  const title = document.getElementById('psTitle');
  const lede = document.getElementById('psLede');
  const kicker = document.getElementById('psKicker');
  if (title && catalog.title) title.textContent = catalog.title;
  if (lede && catalog.lede) lede.textContent = catalog.lede;
  if (kicker && catalog.kicker) kicker.textContent = catalog.kicker;
  if (catalog.title) document.title = catalog.title + ' | Planetarium | DevConnect Labs';

  renderAbout(catalog);
  renderAgencies(catalog);

  const modules = Array.isArray(catalog.modules) ? catalog.modules : [];
  const byId = new Map(modules.map((m) => [m.id, m]));
  let activeId = modules[0]?.id || null;

  const selectModule = (id) => {
    const mod = byId.get(id);
    if (!mod) return;
    activeId = id;
    setActiveRail(id);
    renderModuleCard(mod);
    scene?.focus?.(id);
  };

  renderModuleRail(modules, selectModule);
  if (activeId) {
    setActiveRail(activeId);
    renderModuleCard(byId.get(activeId));
  }

  const stage = document.getElementById('psStage');
  const fallback = document.getElementById('psFallback');
  let scene = null;
  if (stage) {
    scene = createStationScene(stage, {
      modules,
      onFocus: (id) => {
        if (!byId.has(id)) return;
        activeId = id;
        setActiveRail(id);
        renderModuleCard(byId.get(id));
      },
    });
    if (!scene?.ok) {
      fallback?.classList.add('is-visible');
      if (fallback) fallback.setAttribute('aria-hidden', 'false');
    }
  }

  loadCrew(catalog);

  const obs = await requestLocation();
  const status = document.getElementById('psPassStatus');
  if (status && !obs.fromGeo) {
    status.textContent = `Using default sky near ${obs.label}. Allow location for local passes.`;
  }
  await loadPasses(obs.lat, obs.lon, obs.label);

  document.getElementById('psPassLocate')?.addEventListener('click', async () => {
    const next = await requestLocation();
    await loadPasses(next.lat, next.lon, next.label);
  });

  globalThis.IssStationPage = {
    focus: selectModule,
    getActiveModuleId: () => activeId,
  };
}

boot().catch((err) => {
  const lede = document.getElementById('psLede');
  if (lede) lede.textContent = 'Could not load the station catalog — ' + String(err.message || err);
  console.error(err);
});
