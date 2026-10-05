/**
 * ISS station world page — modules, crew, live nadir, interior HUD.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEFAULT_OBS = { lat: 42.898, lon: -70.864, label: 'Hampton Falls, NH' };
  const PRESSURIZED = new Set(['pressurized']);
  const WALK_ROOMS = new Set(['destiny', 'harmony', 'columbus', 'kibo', 'kibo-ef', 'ida2', 'ida3', 'cupola', 'zvezda']);
  const HUNT_IDS = ['kibo-ef', 'ida2', 'prichal'];
  const OWNERS = {
    NASA: 'USA',
    Roscosmos: 'Russia',
    ESA: 'Europe',
    JAXA: 'Japan',
    CSA: 'Canada',
  };
  const SHUTTER_NAMES = ['Nadir window', 'Side window 1', 'Side window 2', 'Side window 3', 'Side window 4', 'Side window 5', 'Side window 6'];

  const els = {
    status: document.getElementById('stStatus'),
    live: document.getElementById('stLive'),
    dock: document.getElementById('stDock'),
    dockFilters: document.getElementById('stDockFilters'),
    crew: document.getElementById('stCrew'),
    crewLead: document.getElementById('stCrewLead'),
    hud: document.getElementById('stHud'),
    hudKicker: document.getElementById('stHudKicker'),
    hudTitle: document.getElementById('stHudTitle'),
    hudMeta: document.getElementById('stHudMeta'),
    hudBlurb: document.getElementById('stHudBlurb'),
    hudHint: document.getElementById('stHudHint'),
    hudHw: document.getElementById('stHudHw'),
    pickHud: document.getElementById('stPickHud'),
    enter: document.getElementById('stEnterModule'),
    exit: document.getElementById('stExitWalk'),
    modeWalk: document.getElementById('stModeWalk'),
    displayLead: document.getElementById('stDisplayLead'),
    racks: document.getElementById('stRacks'),
    photo: document.getElementById('stPhoto'),
    photoImg: document.getElementById('stPhotoImg'),
    photoCap: document.getElementById('stPhotoCap'),
    passList: document.getElementById('stPassList'),
    passHeading: document.getElementById('stPassHeading'),
    stage: document.getElementById('stStage'),
    stageBlock: document.getElementById('stStageBlock'),
    display: document.getElementById('stDisplay'),
    chromeToggle: document.getElementById('stChromeToggle'),
    fsStage: document.getElementById('stFullscreenStage'),
    fsDisplay: document.getElementById('stFullscreenDisplay'),
    shutters: document.getElementById('stShutters'),
    owners: document.getElementById('stOwners'),
    hudPlain: document.getElementById('stHudPlain'),
    passEf: document.getElementById('stPassEf'),
    photoreal: document.getElementById('stPhotoreal'),
    docking: document.getElementById('stDocking'),
    huntScore: document.getElementById('stHuntScore'),
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
    dockFilter: 'all',
    hoverId: '',
    chromeHidden: false,
    shutters: [false, false, false, false, false, false, false],
    shuttersClosed: false,
    owner: '',
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
      shuttersClosed: String(q.get('shutters') || '').toLowerCase() === 'closed',
    };
  }

  function writeUrl() {
    const q = new URLSearchParams();
    if (state.module) q.set('module', state.module);
    if (state.mode && state.mode !== 'orbit') q.set('mode', state.mode);
    if (state.shuttersClosed) q.set('shutters', 'closed');
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
    const age = tleAgeLabel(now);
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
      '</strong></div>' +
      '<div class="st-stat"><span class="st-stat__kicker">TLE age</span><strong>' +
      escapeHtml(age) +
      '</strong></div>';
  }

  function tleAgeLabel(now) {
    if (!now || !now.date) return 'stale';
    const t = Date.parse(now.date);
    if (!Number.isFinite(t)) return 'stale';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s > 15 * 60) return 'stale';
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h';
  }

  function renderScale() {
    const scale = document.getElementById('stScale');
    const block = els.stageBlock || document.getElementById('stStageBlock');
    if (block) {
      block.classList.toggle('is-walk', state.mode === 'walk');
      block.classList.toggle('is-cupola', state.mode === 'walk' && state.module === 'cupola');
    }
    if (!scale) return;
    if (state.mode === 'walk') {
      scale.textContent =
        state.module === 'cupola'
          ? 'Walk · 1 unit = 1 m · Earth below'
          : 'Walk · 1 unit = 1 m · drag or arrow keys to look';
    } else if (state.mode === 'explode') {
      scale.textContent = 'Schematic · exploded · not to scale';
    } else {
      scale.textContent = 'Schematic view · not to scale · scroll to zoom';
    }
  }

  function findInterior(id) {
    const needle = String(id || '').toLowerCase();
    return (state.interiors.rooms || []).find((r) => r.id === needle) || null;
  }

  function canWalk(id) {
    return WALK_ROOMS.has(String(id || state.module));
  }

  function hatchCue(room) {
    if (!room || !Array.isArray(room.hardware)) return '';
    const names = room.hardware
      .filter((h) => /hatch/i.test(h.name || '') || /hatch/i.test(h.role || ''))
      .map((h) => {
        const m = String(h.name || '').match(/to\s+(.+)$/i);
        return m ? m[1].replace(/\s*[—–-].*$/, '').trim() : '';
      })
      .filter(Boolean);
    const unique = [...new Set(names)].slice(0, 3);
    if (!unique.length) return '';
    return 'Inside ' + room.name + ' · hatches to ' + unique.join(' / ');
  }

  function renderPickHud(id) {
    if (!els.pickHud) return;
    if (!id || id === state.module || state.mode === 'walk') {
      els.pickHud.hidden = true;
      els.pickHud.setAttribute('aria-hidden', 'true');
      els.pickHud.textContent = '';
      return;
    }
    const mod = findModule(id);
    if (!mod) {
      els.pickHud.hidden = true;
      els.pickHud.setAttribute('aria-hidden', 'true');
      return;
    }
    els.pickHud.hidden = false;
    els.pickHud.setAttribute('aria-hidden', 'false');
    els.pickHud.textContent = mod.name + (WALK_ROOMS.has(mod.id) ? ' · walkable' : '');
  }

  function updateWalkControls(mod) {
    const walkable = canWalk(mod?.id);
    if (els.modeWalk) {
      els.modeWalk.disabled = !walkable && state.mode !== 'walk';
      els.modeWalk.title = walkable
        ? 'Look around inside this module (1 unit = 1 meter)'
        : 'Select a walkable module — labs, Cupola, JEM-EF, or an IDA';
    }
    if (els.enter) {
      els.enter.hidden = !walkable || state.mode === 'walk';
      els.enter.disabled = !walkable;
    }
    if (els.exit) {
      els.exit.hidden = state.mode !== 'walk';
    }
  }

  function renderHud(mod) {
    if (!mod) return;
    const room = findInterior(mod.id);
    if (els.hudKicker) {
      els.hudKicker.textContent =
        state.mode === 'walk'
          ? 'Walk · 1:1 m'
          : mod.kind === 'pressurized'
            ? 'Pressurized'
            : mod.kind;
    }
    if (els.hudTitle) els.hudTitle.textContent = mod.name;
    if (els.hudMeta) {
      const bits = [ownerLabel(mod.partner), mod.aka, mod.launched && String(mod.launched).slice(0, 4)];
      if (room) bits.push(room.lengthM + ' × ' + room.diameterM + ' m');
      els.hudMeta.textContent = bits.filter(Boolean).join(' · ');
    }
    if (els.hudBlurb) {
      const cue = state.mode === 'walk' ? hatchCue(room) : '';
      els.hudBlurb.textContent = cue || mod.blurb || mod.function || '';
    }
    if (els.hudPlain) {
      els.hudPlain.hidden = !mod.hint;
      els.hudPlain.textContent = mod.hint || '';
    }
    if (els.passEf) els.passEf.hidden = mod.id !== 'kibo' && mod.id !== 'kibo-ef';
    if (els.hudHint) {
      els.hudHint.hidden = state.mode !== 'walk';
      els.hudHint.textContent = 'Drag or arrow keys to look around · Esc returns to orbit';
    }
    updateWalkControls(mod);
    renderPickHud(state.hoverId);
    renderScale();
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
        ? 'NASA still + named hardware. Look inside for an optional 1:1 look-around (1 unit = 1 meter).'
        : 'Exterior structure. Pick Destiny, Harmony, Columbus, Kibo, the JEM-EF porch, an IDA, Cupola, or Zvezda for interiors.';
    }
    renderPhoto(mod);
    const rows = [];
    if (room && Array.isArray(room.hardware)) {
      room.hardware.forEach((hw) => {
        rows.push({
          k: hw.name,
          v: hw.role + (hw.face ? ' · ' + hw.face : ''),
          hint: hw.hint || '',
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
        const tag = row.hw ? 'button' : 'div';
        const typeAttr = row.hw ? ' type="button"' : '';
        return (
          '<' +
          tag +
          typeAttr +
          ' class="st-rack' +
          hw +
          on +
          '"' +
          (row.id ? ' data-hw="' + escapeHtml(row.id) + '"' : '') +
          '><strong>' +
          escapeHtml(row.k) +
          '</strong>' +
          escapeHtml(row.v) +
          (row.hint ? '<span class="st-hud__plain">' + escapeHtml(row.hint) + '</span>' : '') +
          '</' +
          tag +
          '>'
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

  function isStructureModule(mod) {
    const kind = String(mod?.kind || '');
    return kind === 'truss' || kind === 'array' || kind === 'arm' || kind === 'dock' || kind === 'structure';
  }

  function moduleMatchesFilter(mod) {
    const f = state.dockFilter;
    if (!f || f === 'all') return true;
    if (f === 'walk') return WALK_ROOMS.has(mod.id);
    if (f === 'structure') return isStructureModule(mod);
    return String(mod.partner || '') === f;
  }

  function ownerLabel(partner) {
    const agency = String(partner || '');
    const country = agency
      .split('/')
      .map((p) => OWNERS[p.trim()])
      .filter(Boolean)
      .join(' / ');
    return country ? country + ' · ' + agency : agency;
  }

  function setDockFilter(filter) {
    state.dockFilter = filter || 'all';
    if (els.dockFilters) {
      els.dockFilters.querySelectorAll('[data-dock-filter]').forEach((btn) => {
        const on = btn.getAttribute('data-dock-filter') === state.dockFilter;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    }
    renderDock();
    const owner = OWNERS[state.dockFilter] ? state.dockFilter : '';
    if (owner !== state.owner) setOwner(owner);
  }

  function setOwner(owner) {
    const next = OWNERS[owner] ? owner : '';
    state.owner = next;
    if (els.owners) {
      els.owners.querySelectorAll('[data-owner]').forEach((btn) => {
        const on = btn.getAttribute('data-owner') === next;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    }
    const scene = window.PlanetariumStationScene;
    if (scene && typeof scene.setOwner === 'function') scene.setOwner(next);
    if (next && state.dockFilter !== next) setDockFilter(next);
    else if (!next && OWNERS[state.dockFilter]) setDockFilter('all');
    if (els.status && next) {
      const count = state.modules.filter((m) => String(m.partner || '').split('/').some((p) => p.trim() === next)).length;
      els.status.textContent =
        'Showing ' + OWNERS[next] + ' (' + next + ') · ' + count + (count === 1 ? ' module' : ' modules');
    } else if (els.status && state.statusText && /^Showing /.test(els.status.textContent)) {
      els.status.textContent = state.statusText;
    }
  }

  function setShutterButton() {
    if (!els.shutters) return;
    const closed = state.shuttersClosed;
    els.shutters.setAttribute('aria-pressed', String(closed));
    els.shutters.classList.toggle('is-on', closed);
    els.shutters.title = closed ? 'Open Cupola debris shutters (S)' : 'Close Cupola debris shutters (S)';
    const icon = els.shutters.querySelector('i');
    if (icon) icon.className = closed ? 'bi bi-shield-fill-check' : 'bi bi-shield';
  }

  function showShutterHud(text) {
    if (!els.hudHw) return;
    els.hudHw.hidden = false;
    els.hudHw.textContent = text;
  }

  function onShuttersChanged(payload) {
    const states = Array.isArray(payload?.states) ? payload.states : state.shutters;
    state.shutters = states.slice();
    const closedCount = states.filter(Boolean).length;
    state.shuttersClosed = closedCount === states.length;
    setShutterButton();
    writeUrl();
    const i = payload?.changedIndex;
    if (Number.isInteger(i) && i >= 0) {
      showShutterHud(
        'Window shutters — ' + (SHUTTER_NAMES[i] || 'Window') + ' ' + (states[i] ? 'closed' : 'open') + ' · micrometeoroid / debris protection'
      );
    } else if (closedCount === states.length) {
      showShutterHud('Cupola shutters closed — micrometeoroid / debris protection');
    } else if (closedCount === 0) {
      showShutterHud('Cupola shutters open — Earth view');
    }
  }

  function toggleShutters() {
    const scene = window.PlanetariumStationScene;
    if (!scene || typeof scene.setShutters !== 'function') return;
    scene.setShutters(!state.shuttersClosed);
  }

  function renderDock() {
    if (!els.dock) return;
    els.dock.replaceChildren();
    state.modules.filter(moduleMatchesFilter).forEach((mod) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const walkable = WALK_ROOMS.has(mod.id);
      const structure = isStructureModule(mod);
      btn.className =
        'st-mod' +
        (mod.id === state.module ? ' is-on' : '') +
        (walkable ? ' is-walk' : '') +
        (structure ? ' is-structure' : '');
      btn.dataset.module = mod.id;
      btn.dataset.partner = mod.partner || '';
      const walkChip = walkable ? '<span class="st-mod__walk">Walk</span>' : '';
      btn.innerHTML =
        '<span class="st-mod__partner">' +
        escapeHtml(ownerLabel(mod.partner)) +
        walkChip +
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
      const card = document.createElement('article');
      card.className = 'st-person' + (person.quartersModuleId === state.module ? ' is-on' : '');
      const photo = person.photo
        ? '<img class="st-person__photo" src="' +
          escapeHtml(person.photo) +
          '" alt="' +
          escapeHtml(person.name) +
          '" width="72" height="72"/>'
        : '<span class="st-person__photo" aria-hidden="true"></span>';
      const room = findModule(person.quartersModuleId);
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'st-person__select';
      select.setAttribute('aria-label', 'Show ' + person.name + ' quarters module');
      select.innerHTML =
        photo +
        '<span class="st-person__body"><span class="st-person__name">' +
        escapeHtml(person.name) +
        '</span><span class="st-person__meta">' +
        escapeHtml([person.agency, person.craft, person.role].filter(Boolean).join(' · ')) +
        '</span><span class="st-person__meta">Sleeps in ' +
        escapeHtml(room?.name || person.quartersModuleId) +
        '</span></span>';
      select.addEventListener('click', () => {
        if (person.quartersModuleId) selectModule(person.quartersModuleId);
      });
      card.appendChild(select);
      if (person.wiki) {
        const wiki = document.createElement('a');
        wiki.className = 'st-person__wiki';
        wiki.setAttribute('data-crew-wiki', '');
        wiki.href = person.wiki;
        wiki.target = '_blank';
        wiki.rel = 'noopener noreferrer';
        wiki.textContent = 'Wikipedia';
        card.appendChild(wiki);
      }
      els.crew.appendChild(card);
    });
  }

  function setModeButtons() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      const on = btn.getAttribute('data-mode') === state.mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    updateWalkControls(findModule(state.module));
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
    noteHunt(mod.id);
  }

  function huntFound() {
    try {
      const raw = JSON.parse(sessionStorage.getItem('stHuntFound') || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (err) {
      return new Set();
    }
  }

  function renderHunt() {
    if (!els.huntScore) return;
    const found = huntFound();
    const n = HUNT_IDS.filter((id) => found.has(id)).length;
    els.huntScore.textContent = n + ' / ' + HUNT_IDS.length;
  }

  function noteHunt(id) {
    if (HUNT_IDS.includes(id)) {
      const found = huntFound();
      found.add(id);
      sessionStorage.setItem('stHuntFound', JSON.stringify([...found]));
    }
    renderHunt();
  }

  function passToPorch() {
    if (state.mode === 'walk') setMode('orbit');
    const scene = window.PlanetariumStationScene;
    if (scene && typeof scene.startPassThrough === 'function') scene.startPassThrough();
  }

  function toggleDocking() {
    const scene = window.PlanetariumStationScene;
    if (!scene || typeof scene.setDocking !== 'function') return;
    const on = !scene.getDocking();
    scene.setDocking(on);
    if (els.docking) {
      els.docking.setAttribute('aria-pressed', String(on));
      els.docking.classList.toggle('is-on', on);
    }
  }

  function togglePhotoreal() {
    const scene = window.PlanetariumStationScene;
    if (!scene || typeof scene.setPhotoreal !== 'function') return;
    const next = !(scene.getPhotoreal && scene.getPhotoreal());
    if (els.photoreal) {
      els.photoreal.disabled = true;
      els.photoreal.textContent = 'Loading NASA model…';
    }
    scene.setPhotoreal(next).then(
      () => {
        if (!els.photoreal) return;
        els.photoreal.disabled = false;
        const on = scene.getPhotoreal();
        els.photoreal.setAttribute('aria-pressed', String(on));
        els.photoreal.classList.toggle('is-on', on);
        els.photoreal.textContent = on ? 'Schematic' : 'Photoreal';
      },
      () => {
        if (!els.photoreal) return;
        els.photoreal.disabled = false;
        els.photoreal.textContent = 'Photoreal';
        if (els.status) els.status.textContent = 'NASA ISS model did not load.';
      }
    );
  }

  function stepModule(dir) {
    const list =
      state.mode === 'walk' ? state.modules.filter((m) => canWalk(m.id)) : pressurizedList();
    if (!list.length) return;
    let i = list.findIndex((m) => m.id === state.module);
    if (i < 0) i = 0;
    const next = list[(i + dir + list.length) % list.length];
    selectModule(next.id, { mode: state.mode });
  }

  function setMode(mode) {
    const next = mode === 'explode' || mode === 'walk' ? mode : 'orbit';
    if (next === 'walk' && !canWalk(state.module)) {
      if (els.status) {
        els.status.textContent =
          'Look inside needs a walkable module — a lab, Cupola, JEM-EF, or an IDA.';
      }
      setModeButtons();
      return;
    }
    state.mode = next;
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

  function buildPassSkyUrl(pass, observer) {
    const when = new Date(pass.start);
    const sky = window.FunHomeSky;
    if (sky && typeof sky.buildPlanetariumUrl === 'function') {
      return sky.buildPlanetariumUrl({ date: when, observer: observer });
    }
    const pad = (n) => String(n).padStart(2, '0');
    const params = new URLSearchParams();
    params.set(
      'date',
      when.getFullYear() + '-' + pad(when.getMonth() + 1) + '-' + pad(when.getDate())
    );
    params.set('time', pad(when.getHours()) + ':' + pad(when.getMinutes()));
    if (Number.isFinite(observer.lat) && Number.isFinite(observer.lon)) {
      params.set('lat', String(Number(observer.lat.toFixed(4))));
      params.set('lon', String(Number(observer.lon.toFixed(4))));
    }
    if (observer.label) params.set('label', String(observer.label).slice(0, 80));
    return '/planetarium/?' + params.toString();
  }

  function updatePassHeading() {
    if (!els.passHeading) return;
    const label = state.observer.label || 'your location';
    const base =
      label === 'Your location'
        ? 'Next passes over your location'
        : 'Next passes over ' + label;
    els.passHeading.textContent = base + ' · coarse 30s sampling';
  }

  async function loadPasses() {
    if (!els.passList) return;
    updatePassHeading();
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
        els.passList.innerHTML =
          '<li>No bright passes in the next two days from ' +
          escapeHtml(state.observer.label) +
          '.</li>';
        return;
      }
      data.passes.slice(0, 5).forEach((pass) => {
        const li = document.createElement('li');
        const when = new Date(pass.start);
        const local = when.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-pass';
        btn.title = when.toUTCString() + ' UTC';
        btn.innerHTML =
          '<span><strong>' +
          escapeHtml(local) +
          '</strong> · ' +
          Math.round(pass.duration / 60) +
          ' min' +
          (pass.maxElev != null ? ' · max ' + Math.round(pass.maxElev) + '°' : '') +
          '</span><span class="st-pass__sky">Watch in sky</span>';
        btn.addEventListener('click', () => {
          const url = buildPassSkyUrl(pass, state.observer);
          window.location.href = url;
        });
        li.appendChild(btn);
        els.passList.appendChild(li);
      });
    } catch (_) {
      els.passList.innerHTML = '<li>Pass list unavailable.</li>';
    }
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isFullscreen(el) {
    return Boolean(el && fullscreenElement() === el);
  }

  function syncFullscreenButtons() {
    const stageOn = isFullscreen(els.stageBlock);
    const displayOn = isFullscreen(els.display);
    if (els.fsStage) {
      els.fsStage.setAttribute('aria-pressed', String(stageOn));
      const label = els.fsStage.querySelector('[data-fs-stage-label]');
      if (label) label.textContent = stageOn ? 'Exit' : 'Fullscreen';
      const icon = els.fsStage.querySelector('i');
      if (icon) icon.className = stageOn ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen';
      els.fsStage.title = stageOn ? 'Exit fullscreen' : 'Fullscreen station';
    }
    if (els.fsDisplay) {
      els.fsDisplay.setAttribute('aria-pressed', String(displayOn));
      const label = els.fsDisplay.querySelector('[data-fs-display-label]');
      if (label) label.textContent = displayOn ? 'Exit' : 'Fullscreen';
      const icon = els.fsDisplay.querySelector('i');
      if (icon) icon.className = displayOn ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen';
      els.fsDisplay.title = displayOn ? 'Exit fullscreen' : 'Fullscreen interior display';
    }
  }

  async function toggleFullscreen(el) {
    if (!el) return;
    try {
      if (isFullscreen(el)) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (els.status) {
        els.status.textContent = 'This browser cannot fill the screen.';
      }
    } catch (err) {
      if (els.status) els.status.textContent = err?.message || 'Fullscreen was blocked.';
    }
    syncFullscreenButtons();
    resizeScene();
  }

  function resizeScene() {
    const scene = window.PlanetariumStationScene;
    if (scene && typeof scene.resize === 'function') {
      window.requestAnimationFrame(() => scene.resize());
    }
  }

  function syncChromeToggle() {
    const on = state.chromeHidden;
    document.body.classList.toggle('is-st-chrome-hidden', on);
    if (els.chromeToggle) {
      els.chromeToggle.setAttribute('aria-pressed', String(on));
      const label = els.chromeToggle.querySelector('[data-chrome-label]');
      if (label) label.textContent = on ? 'Show chrome' : 'Hide chrome';
      const icon = els.chromeToggle.querySelector('i');
      if (icon) icon.className = on ? 'bi bi-eye' : 'bi bi-eye-slash';
      els.chromeToggle.title = on ? 'Show chrome (H)' : 'Hide chrome (H)';
    }
  }

  function setChromeHidden(on) {
    state.chromeHidden = Boolean(on);
    syncChromeToggle();
    resizeScene();
    if (state.chromeHidden && !fullscreenElement() && els.stageBlock) {
      els.stageBlock.scrollIntoView({ block: 'start' });
    }
  }

  function toggleChrome() {
    setChromeHidden(!state.chromeHidden);
  }

  function bind() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-mode')));
    });
    if (els.dockFilters) {
      els.dockFilters.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-dock-filter]');
        if (!btn) return;
        setDockFilter(btn.getAttribute('data-dock-filter'));
      });
    }
    if (els.owners) {
      els.owners.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-owner]');
        if (!btn) return;
        const owner = btn.getAttribute('data-owner') || '';
        setOwner(owner && owner === state.owner ? '' : owner);
      });
    }
    if (els.shutters) {
      els.shutters.addEventListener('click', toggleShutters);
    }
    if (els.passEf) els.passEf.addEventListener('click', passToPorch);
    if (els.photoreal) els.photoreal.addEventListener('click', togglePhotoreal);
    if (els.docking) els.docking.addEventListener('click', toggleDocking);
    renderHunt();
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
    if (els.hud) {
      els.hud.addEventListener('click', () => {
        els.hud.classList.toggle('is-expanded');
      });
    }
    if (els.chromeToggle) {
      els.chromeToggle.addEventListener('click', toggleChrome);
    }
    if (els.fsStage) {
      els.fsStage.addEventListener('click', () => toggleFullscreen(els.stageBlock));
    }
    if (els.fsDisplay) {
      els.fsDisplay.addEventListener('click', () => toggleFullscreen(els.display));
    }
    document.addEventListener('fullscreenchange', () => {
      syncFullscreenButtons();
      resizeScene();
    });
    document.addEventListener('webkitfullscreenchange', () => {
      syncFullscreenButtons();
      resizeScene();
    });
    document.addEventListener('keydown', (ev) => {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target?.isContentEditable) return;

      if (ev.key === 'Escape') {
        if (fullscreenElement()) return;
        if (state.chromeHidden) {
          setChromeHidden(false);
          ev.preventDefault();
          return;
        }
        if (state.mode === 'walk') {
          setMode('orbit');
          return;
        }
        return;
      }

      if (ev.key === 'h' || ev.key === 'H') {
        toggleChrome();
        return;
      }
      if (state.mode === 'walk') {
        const scene = window.PlanetariumStationScene;
        const look = { yaw: 0, pitch: 0 };
        if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') look.yaw = 0.12;
        else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') look.yaw = -0.12;
        else if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') look.pitch = 0.08;
        else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') look.pitch = -0.08;
        else return;
        if (scene && typeof scene.nudgeLook === 'function') scene.nudgeLook(look.yaw, look.pitch);
        ev.preventDefault();
        return;
      }
      if (ev.key === 's' || ev.key === 'S') {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        toggleShutters();
        return;
      }
      if (ev.key === 'ArrowLeft') stepModule(-1);
      if (ev.key === 'ArrowRight') stepModule(1);
    });
    syncChromeToggle();
    syncFullscreenButtons();
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
    if (typeof scene.onHover === 'function') {
      scene.onHover((id) => {
        state.hoverId = id || '';
        renderPickHud(state.hoverId);
      });
    }
    if (scene.canvas) {
      scene.canvas.setAttribute('role', 'img');
      scene.canvas.setAttribute('aria-label', 'Interactive International Space Station schematic');
    }
    syncScene();
    if (typeof scene.onShutters === 'function') scene.onShutters(onShuttersChanged);
    if (typeof scene.onPassThrough === 'function') {
      scene.onPassThrough(() => {
        if (state.module !== 'kibo-ef') selectModule('kibo-ef');
      });
    }
    if (state.shuttersClosed && typeof scene.setShutters === 'function') {
      scene.setShutters(true, { instant: true });
    }
    if (typeof scene.setOwner === 'function') scene.setOwner(state.owner);
    return true;
  }

  async function boot() {
    Object.assign(state, parseParams(location.search));
    bind();
    setShutterButton();
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
        state.statusText = stamp
          ? 'Crew snapshot ' + stamp + ' · TLE ' + (state.now ? 'live' : 'offline') + ' · NASA interiors ready'
          : 'Station loaded';
        els.status.textContent = state.statusText;
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
    setOwner,
    toggleShutters,
    getCarlContext,
    getState: () => state,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
