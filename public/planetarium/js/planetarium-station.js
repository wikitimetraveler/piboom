/**
 * ISS station world page — modules, crew, live nadir, interior HUD.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEFAULT_OBS = { lat: 42.898, lon: -70.864, label: 'Hampton Falls, NH' };
  const PRESSURIZED = new Set(['pressurized']);
  const WALK_ROOMS = new Set(['destiny', 'harmony', 'columbus', 'kibo', 'cupola', 'zvezda']);

  const els = {
    status: document.getElementById('stStatus'),
    live: document.getElementById('stLive'),
    dock: document.getElementById('stDock'),
    crew: document.getElementById('stCrew'),
    crewLead: document.getElementById('stCrewLead'),
    hudKicker: document.getElementById('stHudKicker'),
    hudTitle: document.getElementById('stHudTitle'),
    hudMeta: document.getElementById('stHudMeta'),
    hudBlurb: document.getElementById('stHudBlurb'),
    hudHint: document.getElementById('stHudHint'),
    hudHw: document.getElementById('stHudHw'),
    enter: document.getElementById('stEnterModule'),
    exit: document.getElementById('stExitWalk'),
    displayLead: document.getElementById('stDisplayLead'),
    racks: document.getElementById('stRacks'),
    photo: document.getElementById('stPhoto'),
    photoImg: document.getElementById('stPhotoImg'),
    photoCap: document.getElementById('stPhotoCap'),
    passList: document.getElementById('stPassList'),
  };

  const state = {
    modules: [],
    crew: { people: [] },
    interiors: { rooms: [] },
    now: null,
    module: 'unity',
    mode: 'orbit',
    hardwareId: '',
    observer: { ...DEFAULT_OBS },
    modulesBound: false,
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseParams(search) {
    const q = new URLSearchParams(String(search || location.search || '').replace(/^\?/, ''));
    const modeRaw = String(q.get('mode') || 'orbit').toLowerCase();
    return {
      module: String(q.get('module') || 'unity').toLowerCase(),
      mode: modeRaw === 'explode' || modeRaw === 'walk' ? modeRaw : 'orbit',
    };
  }

  function writeUrl() {
    const q = new URLSearchParams();
    if (state.module) q.set('module', state.module);
    if (state.mode && state.mode !== 'orbit') q.set('mode', state.mode);
    const tour = new URLSearchParams(location.search).get('tour');
    if (tour === '1') q.set('tour', '1');
    const qs = q.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function findModule(id) {
    const needle = String(id || '').toLowerCase();
    return state.modules.find((m) => m.id === needle) || null;
  }

  function pressurizedList() {
    return state.modules.filter((m) => PRESSURIZED.has(m.kind) || m.interior);
  }

  function crewFor(id) {
    return (state.crew.people || []).filter((p) => p.quartersModuleId === id);
  }

  function fmtCoord(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(1) + '°' + ns + ' · ' + Math.abs(lon).toFixed(1) + '°' + ew;
  }

  function renderLive() {
    if (!els.live) return;
    const now = state.now;
    const aboard = (state.crew.people || []).length;
    const alt = now && Number.isFinite(Number(now.altKm)) ? Math.round(Number(now.altKm)) + ' km' : '—';
    const pos = now && Number.isFinite(Number(now.lat)) ? fmtCoord(now.lat, now.lon) : 'Waiting on TLE';
    els.live.innerHTML =
      '<div class="st-stat"><span class="st-stat__kicker">Over Earth</span><strong>' +
      escapeHtml(pos) +
      '</strong></div>' +
      '<div class="st-stat"><span class="st-stat__kicker">Altitude</span><strong>' +
      escapeHtml(alt) +
      '</strong></div>' +
      '<div class="st-stat"><span class="st-stat__kicker">Aboard</span><strong>' +
      aboard +
      ' crew</strong></div>' +
      '<div class="st-stat"><span class="st-stat__kicker">Modules</span><strong>' +
      state.modules.length +
      '</strong></div>';
  }

  function findInterior(id) {
    const needle = String(id || '').toLowerCase();
    return (state.interiors.rooms || []).find((r) => r.id === needle) || null;
  }

  function canWalk(id) {
    return WALK_ROOMS.has(String(id || state.module));
  }

  function renderHud(mod) {
    if (!mod) return;
    const room = findInterior(mod.id);
    if (els.hudKicker) {
      els.hudKicker.textContent =
        state.mode === 'walk' ? 'Walk · 1:1 m' : mod.kind === 'pressurized' ? 'Pressurized' : mod.kind;
    }
    if (els.hudTitle) els.hudTitle.textContent = mod.name;
    if (els.hudMeta) {
      const bits = [mod.partner, mod.aka, mod.launched && String(mod.launched).slice(0, 4)];
      if (room) bits.push(room.lengthM + ' × ' + room.diameterM + ' m');
      els.hudMeta.textContent = bits.filter(Boolean).join(' · ');
    }
    if (els.hudBlurb) els.hudBlurb.textContent = mod.blurb || mod.function || '';
    if (els.hudHint) {
      els.hudHint.hidden = state.mode !== 'walk';
      els.hudHint.textContent = 'Drag to look · Esc returns to orbit';
    }
    if (els.enter) {
      els.enter.hidden = !canWalk(mod.id) || state.mode === 'walk';
    }
    if (els.exit) {
      els.exit.hidden = state.mode !== 'walk';
    }
  }

  function renderPhoto(mod) {
    const room = findInterior(mod?.id);
    if (!els.photo || !els.photoImg) return;
    if (!room || !room.photo) {
      els.photo.hidden = true;
      return;
    }
    els.photo.hidden = false;
    els.photoImg.src = room.photo;
    els.photoImg.alt = room.name + ' interior — ' + (room.credits || 'NASA');
    if (els.photoCap) els.photoCap.textContent = room.credits || room.source || '';
  }

  function renderDisplay(mod) {
    if (!els.racks) return;
    const room = findInterior(mod?.id);
    const people = crewFor(mod?.id);
    if (els.displayLead) {
      els.displayLead.textContent = room
        ? 'NASA still + named hardware. Enter module for an optional 1:1 walk (1 unit = 1 meter).'
        : 'Exterior structure. Pick Destiny, Harmony, Columbus, Kibo, Cupola, or Zvezda for interiors.';
    }
    renderPhoto(mod);
    const rows = [];
    if (room && Array.isArray(room.hardware)) {
      room.hardware.forEach((hw) => {
        rows.push({
          k: hw.name,
          v: hw.role + (hw.face ? ' · ' + hw.face : ''),
          id: hw.id,
          hw: true,
        });
      });
    } else {
      rows.push(
        { k: 'Function', v: mod?.function || '—' },
        { k: 'Partner', v: mod?.partner || '—' },
        { k: 'Launched', v: mod?.launched || '—' },
        { k: 'Docked to', v: (mod?.dockedTo || []).join(', ') || '—' }
      );
    }
    rows.push({
      k: 'Sleeping here',
      v: people.length ? people.map((p) => p.name).join(', ') : 'No assigned bunks',
    });
    els.racks.innerHTML = rows
      .map((row) => {
        const on = row.id && row.id === state.hardwareId ? ' is-on' : '';
        const hw = row.hw ? ' is-hw' : '';
        return (
          '<div class="st-rack' +
          hw +
          on +
          '"' +
          (row.id ? ' data-hw="' + escapeHtml(row.id) + '"' : '') +
          '><strong>' +
          escapeHtml(row.k) +
          '</strong>' +
          escapeHtml(row.v) +
          '</div>'
        );
      })
      .join('');
  }

  function setHardware(hw) {
    if (!hw) {
      state.hardwareId = '';
      if (els.hudHw) {
        els.hudHw.hidden = true;
        els.hudHw.textContent = '';
      }
      return;
    }
    state.hardwareId = hw.id || '';
    if (els.hudHw) {
      els.hudHw.hidden = false;
      els.hudHw.textContent = (hw.name || '') + ' — ' + (hw.role || '');
    }
    const mod = findModule(state.module);
    renderDisplay(mod);
  }

  function renderDock() {
    if (!els.dock) return;
    els.dock.replaceChildren();
    state.modules.forEach((mod) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-mod' + (mod.id === state.module ? ' is-on' : '');
      btn.dataset.module = mod.id;
      btn.innerHTML =
        '<span class="st-mod__partner">' +
        escapeHtml(mod.partner) +
        '</span><span class="st-mod__name">' +
        escapeHtml(mod.name) +
        '</span><span class="st-mod__fn">' +
        escapeHtml(mod.aka || mod.kind) +
        '</span>';
      btn.addEventListener('click', () => selectModule(mod.id));
      els.dock.appendChild(btn);
    });
  }

  function renderCrew() {
    if (!els.crew) return;
    const people = state.crew.people || [];
    if (els.crewLead && state.crew.note) els.crewLead.textContent = state.crew.note;
    els.crew.replaceChildren();
    people.forEach((person) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-person' + (person.quartersModuleId === state.module ? ' is-on' : '');
      const photo = person.photo
        ? '<img class="st-person__photo" src="' +
          escapeHtml(person.photo) +
          '" alt="" width="72" height="72"/>'
        : '<span class="st-person__photo" aria-hidden="true"></span>';
      const room = findModule(person.quartersModuleId);
      btn.innerHTML =
        photo +
        '<span><span class="st-person__name">' +
        escapeHtml(person.name) +
        '</span><span class="st-person__meta">' +
        escapeHtml([person.agency, person.craft, person.role].filter(Boolean).join(' · ')) +
        '</span><span class="st-person__meta">Sleeps in ' +
        escapeHtml(room?.name || person.quartersModuleId) +
        '</span></span>';
      btn.addEventListener('click', () => {
        if (person.quartersModuleId) selectModule(person.quartersModuleId);
      });
      els.crew.appendChild(btn);
    });
  }

  function setModeButtons() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.getAttribute('data-mode') === state.mode);
    });
  }

  function syncScene() {
    const scene = window.PlanetariumStationScene;
    if (!scene) return;
    if (!state.modulesBound && typeof scene.setModules === 'function' && state.modules.length) {
      scene.setModules(state.modules);
      state.modulesBound = true;
    }
    if (typeof scene.setInteriorsCatalog === 'function' && state.interiors) {
      scene.setInteriorsCatalog(state.interiors);
    }
    if (typeof scene.setNow === 'function') scene.setNow(state.now);
    if (typeof scene.setMode === 'function') scene.setMode(state.mode);
    if (typeof scene.selectModule === 'function') scene.selectModule(state.module);
  }

  function selectModule(id, opts) {
    const mod = findModule(id) || state.modules[0];
    if (!mod) return;
    state.module = mod.id;
    state.hardwareId = '';
    if (opts && opts.mode) state.mode = opts.mode;
    else if (state.mode === 'walk' && !canWalk(mod.id)) state.mode = 'orbit';
    writeUrl();
    renderHud(mod);
    renderDisplay(mod);
    renderDock();
    renderCrew();
    setModeButtons();
    if (els.hudHw) {
      els.hudHw.hidden = true;
      els.hudHw.textContent = '';
    }
    syncScene();
  }

  function stepModule(dir) {
    const list =
      state.mode === 'walk'
        ? state.modules.filter((m) => canWalk(m.id))
        : pressurizedList();
    if (!list.length) return;
    let i = list.findIndex((m) => m.id === state.module);
    if (i < 0) i = 0;
    const next = list[(i + dir + list.length) % list.length];
    selectModule(next.id, { mode: state.mode });
  }

  function setMode(mode) {
    state.mode = mode === 'explode' || mode === 'walk' ? mode : 'orbit';
    if (state.mode === 'walk' && !canWalk(state.module)) {
      const first = state.modules.find((m) => canWalk(m.id));
      if (first) state.module = first.id;
    }
    writeUrl();
    setModeButtons();
    const mod = findModule(state.module);
    renderHud(mod);
    renderDisplay(mod);
    syncScene();
  }

  function getCarlContext() {
    const mod = findModule(state.module);
    const room = findInterior(state.module);
    const names = (state.crew.people || []).map((p) => p.name + ' (' + p.agency + ')').join(', ');
    return {
      surface: 'station',
      station: {
        focusModule: mod ? mod.name : state.module,
        focusBlurb: mod ? mod.blurb || mod.function : '',
        interiorDims: room ? room.lengthM + ' × ' + room.diameterM + ' m' : '',
        hardware: room ? (room.hardware || []).slice(0, 8).map((h) => h.name).join(', ') : '',
        crew: names,
        now: state.now && Number.isFinite(Number(state.now.lat)) ? fmtCoord(state.now.lat, state.now.lon) : '',
        altitudeKm: state.now && Number.isFinite(Number(state.now.altKm)) ? Math.round(Number(state.now.altKm)) : '',
        mode: state.mode,
      },
    };
  }

  async function loadStation() {
    const res = await fetch('/api/planetarium/station?module=' + encodeURIComponent(state.module), {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Station API ' + res.status);
    const json = await res.json();
    if (!json || json.success === false) throw new Error(json.error || 'Station unavailable');
    return json;
  }

  async function loadInteriors() {
    try {
      const res = await fetch('/data/planetarium/iss-interiors.json', { cache: 'no-store' });
      if (!res.ok) return { rooms: [] };
      return res.json();
    } catch (_) {
      return { rooms: [] };
    }
  }

  async function loadPasses() {
    if (!els.passList) return;
    els.passList.innerHTML = '<li class="plan-empty">Loading passes…</li>';
    try {
      const res = await fetch(
        '/api/planetarium/iss-passes?lat=' +
          encodeURIComponent(state.observer.lat) +
          '&lon=' +
          encodeURIComponent(state.observer.lon)
      );
      const data = await res.json().catch(() => ({}));
      els.passList.replaceChildren();
      if (!res.ok || !data.passes || !data.passes.length) {
        els.passList.innerHTML = '<li>No bright passes in the next two days from ' + escapeHtml(state.observer.label) + '.</li>';
        return;
      }
      data.passes.slice(0, 5).forEach((pass) => {
        const li = document.createElement('li');
        const when = new Date(pass.start);
        li.innerHTML =
          '<button type="button" class="st-pass"><strong>' +
          escapeHtml(when.toUTCString()) +
          '</strong> · ' +
          Math.round(pass.duration / 60) +
          ' min' +
          (pass.maxElev != null ? ' · max ' + Math.round(pass.maxElev) + '°' : '') +
          '</button>';
        els.passList.appendChild(li);
      });
    } catch (_) {
      els.passList.innerHTML = '<li>Pass list unavailable.</li>';
    }
  }

  function bind() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-mode')));
    });
    const prev = document.getElementById('stPrevMod');
    const next = document.getElementById('stNextMod');
    if (prev) prev.addEventListener('click', () => stepModule(-1));
    if (next) next.addEventListener('click', () => stepModule(1));
    if (els.enter) {
      els.enter.addEventListener('click', () => {
        if (canWalk(state.module)) setMode('walk');
      });
    }
    if (els.exit) {
      els.exit.addEventListener('click', () => setMode('orbit'));
    }
    if (els.racks) {
      els.racks.addEventListener('click', (ev) => {
        const row = ev.target.closest('[data-hw]');
        if (!row) return;
        const id = row.getAttribute('data-hw');
        const room = findInterior(state.module);
        const hw = (room?.hardware || []).find((h) => h.id === id);
        if (hw) setHardware(hw);
      });
    }
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && state.mode === 'walk') {
        setMode('orbit');
        return;
      }
      if (ev.key === 'ArrowLeft') stepModule(-1);
      if (ev.key === 'ArrowRight') stepModule(1);
    });
  }

  function wireScene() {
    const scene = window.PlanetariumStationScene;
    if (!scene) return false;
    if (typeof scene.onSelect === 'function') {
      scene.onSelect((id) => selectModule(id));
    }
    if (typeof scene.onHardware === 'function') {
      scene.onHardware((hw) => setHardware(hw));
    }
    syncScene();
    return true;
  }

  async function boot() {
    Object.assign(state, parseParams(location.search));
    bind();
    try {
      const [page, interiors] = await Promise.all([loadStation(), loadInteriors()]);
      state.modules = Array.isArray(page.modules) ? page.modules : [];
      state.crew = page.crew || { people: [] };
      state.interiors = interiors || { rooms: [] };
      state.now = page.now || null;
      if (page.focus && page.focus.id) state.module = page.focus.id;
      else if (!findModule(state.module)) state.module = 'unity';
      if (state.mode === 'walk' && !canWalk(state.module)) state.mode = 'orbit';
      if (els.status) {
        const stamp = state.crew.fetchedAt ? String(state.crew.fetchedAt).slice(0, 10) : '';
        els.status.textContent = stamp
          ? 'Crew snapshot ' + stamp + ' · TLE ' + (state.now ? 'live' : 'offline') + ' · NASA interiors ready'
          : 'Station loaded';
      }
      renderLive();
      selectModule(state.module);
      if (!wireScene()) {
        window.setTimeout(() => wireScene(), 250);
      }
    } catch (err) {
      if (els.status) els.status.textContent = 'Could not load the station catalog.';
      console.warn(err);
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.observer = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            label: 'Your location',
          };
          loadPasses();
        },
        () => loadPasses(),
        { maximumAge: 600000, timeout: 4000 }
      );
    } else {
      loadPasses();
    }
  }

  window.PlanetariumStation = {
    parseParams,
    selectModule,
    setMode,
    getCarlContext,
    getState: () => state,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
