/**
 * Planetarium — full date/time sky dome using FunHomeSky
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const FACING = {
    south: 180,
    east: 90,
    west: 270,
    north: 0,
  };

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatDateInput(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatTimeInput(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** Parse ?date=&time=&lat=&lon=&face=&body=&select= URL params into partial state. */
  function parseParams(search) {
    const params = new URLSearchParams(search || '');
    const out = {};
    if (params.get('date')) {
      const parts = params.get('date').split('-').map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        out.dateParts = { y: parts[0], m: parts[1], d: parts[2] };
      }
    }
    if (params.get('time')) {
      const tp = params.get('time').split(':').map(Number);
      if (tp.length >= 2 && tp.every(Number.isFinite)) {
        out.timeParts = { h: tp[0], m: tp[1] };
      }
    }
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      out.observer = { lat, lon, label: params.get('label') || 'custom location' };
    }
    const face = params.get('face');
    if (face && Object.prototype.hasOwnProperty.call(FACING, face)) {
      out.facing = face;
    }
    const body = params.get('body');
    if (body) out.body = String(body).toLowerCase();
    const select = params.get('select');
    if (select) out.select = String(select);
    return out;
  }

  function buildSkyDate(dateParts, timeParts, fallback) {
    const base = fallback instanceof Date ? new Date(fallback.getTime()) : new Date();
    if (dateParts) {
      base.setFullYear(dateParts.y, dateParts.m - 1, dateParts.d);
    }
    if (timeParts) {
      base.setHours(timeParts.h, timeParts.m, 0, 0);
    }
    return base;
  }

  function buildShareUrl(state, origin) {
    const base = (origin || '') + '/planetarium/';
    const params = new URLSearchParams();
    params.set('date', formatDateInput(state.date));
    params.set('time', formatTimeInput(state.date));
    params.set('lat', String(state.observer.lat));
    params.set('lon', String(state.observer.lon));
    if (state.observer.label) params.set('label', String(state.observer.label).slice(0, 80));
    if (state.facing && state.facing !== 'south') params.set('face', state.facing);
    const sel = state.selection;
    if (sel) {
      if (sel.type === 'planet' && sel.id) params.set('body', sel.id);
      else if (sel.id || sel.name) params.set('select', String(sel.id || sel.name));
    }
    return base + '?' + params.toString();
  }

  function normalizeSelection(sel) {
    if (!sel || typeof sel !== 'object') return null;
    const type = sel.type || 'catalog';
    const id = sel.id != null ? String(sel.id) : sel.name ? String(sel.name) : '';
    if (!id && !sel.name) return null;
    return {
      type,
      id: id || String(sel.name),
      name: String(sel.name || id),
      alt: Number.isFinite(sel.alt) ? sel.alt : null,
      az: Number.isFinite(sel.az) ? sel.az : null,
      ra: Number.isFinite(sel.ra) ? sel.ra : null,
      dec: Number.isFinite(sel.dec) ? sel.dec : null,
    };
  }

  function selectionKey(sel) {
    if (!sel) return '';
    return String(sel.type || '') + ':' + String(sel.id || sel.name || '').toLowerCase();
  }

  function formatAltAz(alt, az) {
    return Math.round(alt) + '° alt · ' + Math.round(az) + '° az';
  }

  function twilightLabel(sunAlt) {
    if (sunAlt < -18) return '';
    if (sunAlt < -12) return 'Astronomical twilight';
    if (sunAlt < -6) return 'Nautical twilight';
    if (sunAlt < 0) return 'Civil twilight';
    return 'Daylight — stars faint';
  }

  function formatPlanetRows(planets) {
    return (planets || [])
      .slice()
      .sort((a, b) => b.alt - a.alt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        alt: Math.round(p.alt),
        az: Math.round(p.az),
        label: formatAltAz(p.alt, p.az),
      }));
  }

  function projOptsFor(state) {
    const mobile = root.matchMedia && root.matchMedia('(max-width: 991.98px)').matches;
    let centerAz = FACING[state.facing] || 180;
    if (state.compassMode && Number.isFinite(state.compassAz)) {
      centerAz = state.compassAz;
    } else if (Number.isFinite(state.centerAzOverride)) {
      centerAz = state.centerAzOverride;
    }
    return {
      fovAz: mobile ? 150 : 175,
      minAlt: 3,
      maxAlt: 89,
      centerAz,
      yScale: 88,
      yMax: 92,
    };
  }

  function objectAltAz(ra, dec, observer, date, Sky) {
    const lst = Sky.localSiderealDegrees(date, observer.lon);
    return Sky.equatorialToAltAz(ra, dec, observer.lat, lst);
  }

  function isDarkSky(sunAlt) {
    return Number(sunAlt) < -6;
  }

  function renderSkyDome(host, sky, Sky, state) {
    if (!host) return;
    host.replaceChildren();
    const opts = projOptsFor(state);

    const horizonSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    horizonSvg.setAttribute('class', 'plan-sky__horizon');
    horizonSvg.setAttribute('aria-hidden', 'true');
    horizonSvg.setAttribute('viewBox', '0 0 100 100');
    horizonSvg.setAttribute('preserveAspectRatio', 'none');
    const hz = Sky.projectHorizon(opts);
    if (hz.points.length >= 2) {
      const d = hz.points
        .map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2))
        .join(' ');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'plan-sky__horizon-arc');
      horizonSvg.appendChild(path);
      hz.cardinals.forEach((c) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', c.x.toFixed(2));
        t.setAttribute('y', (c.y + 2.8).toFixed(2));
        t.setAttribute('class', 'plan-sky__horizon-label');
        t.textContent = c.label;
        horizonSvg.appendChild(t);
      });
      host.appendChild(horizonSvg);
    }

    if (sky.milkyWay && sky.milkyWay.length >= 2) {
      const mw = document.createElement('div');
      mw.className = 'plan-sky__milkyway';
      const mid = sky.milkyWay[Math.floor(sky.milkyWay.length / 2)];
      const first = sky.milkyWay[0];
      const last = sky.milkyWay[sky.milkyWay.length - 1];
      const angle = (Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI;
      mw.style.left = mid.x.toFixed(2) + '%';
      mw.style.top = mid.y.toFixed(2) + '%';
      mw.style.setProperty('--mw-rot', angle.toFixed(1) + 'deg');
      host.appendChild(mw);
    }

    const lines = Sky.projectAsterisms(sky);
    if (lines.length) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'plan-sky__constellations');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      lines.forEach((ln) => {
        const seg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        seg.setAttribute('x1', ln.x1.toFixed(2));
        seg.setAttribute('y1', ln.y1.toFixed(2));
        seg.setAttribute('x2', ln.x2.toFixed(2));
        seg.setAttribute('y2', ln.y2.toFixed(2));
        seg.setAttribute('data-asterism', ln.id);
        if (state.selection && state.selection.type === 'asterism' && state.selection.id === ln.id) {
          seg.setAttribute('class', 'is-selected');
        }
        svg.appendChild(seg);
      });
      host.appendChild(svg);
    }

    const frag = document.createDocumentFragment();
    const mobile = root.matchMedia && root.matchMedia('(max-width: 991.98px)').matches;
    const starCap = mobile ? 48 : 80;
    const ranked = sky.stars.slice().sort((a, b) => a.mag - b.mag).slice(0, starCap);
    let labelsLeft = mobile ? 8 : 14;
    const selKey = selectionKey(state.selection);
    ranked.forEach((s, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'plan-sky__star';
      if (s.bright) el.classList.add('plan-sky__star--bright');
      if (s.flare) el.classList.add('plan-sky__star--flare');
      if (selKey === selectionKey({ type: 'star', id: s.name, name: s.name })) {
        el.classList.add('is-selected');
      }
      el.title = s.name;
      el.setAttribute('aria-label', 'Select ' + s.name);
      el.setAttribute('data-sky-type', 'star');
      el.setAttribute('data-sky-id', s.name);
      el.setAttribute('data-sky-name', s.name);
      el.setAttribute('data-alt', String(s.alt));
      el.setAttribute('data-az', String(s.az));
      if (Number.isFinite(s.ra)) el.setAttribute('data-ra', String(s.ra));
      if (Number.isFinite(s.dec)) el.setAttribute('data-dec', String(s.dec));
      el.style.left = s.x.toFixed(2) + '%';
      el.style.top = s.y.toFixed(2) + '%';
      el.style.width = s.size.toFixed(1) + 'px';
      el.style.height = s.size.toFixed(1) + 'px';
      el.style.setProperty('--twinkle-delay', ((i % 7) * 0.55).toFixed(2) + 's');
      el.style.setProperty('--twinkle-dur', (2.8 + (i % 5) * 0.7).toFixed(2) + 's');
      frag.appendChild(el);
      if (s.mag <= 1.85 && labelsLeft > 0) {
        labelsLeft -= 1;
        const lab = document.createElement('span');
        lab.className = 'plan-sky__star-label';
        lab.textContent = s.name;
        lab.style.left = (s.x + 1).toFixed(2) + '%';
        lab.style.top = (s.y - 0.6).toFixed(2) + '%';
        frag.appendChild(lab);
      }
    });

    sky.planets.forEach((p) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'plan-sky__planet plan-sky__planet--' + p.id;
      if (selKey === selectionKey({ type: 'planet', id: p.id, name: p.name })) {
        el.classList.add('is-selected');
      }
      el.title = p.name + ' · ' + formatAltAz(p.alt, p.az);
      el.setAttribute('aria-label', 'Select ' + p.name);
      el.setAttribute('data-sky-type', 'planet');
      el.setAttribute('data-sky-id', p.id);
      el.setAttribute('data-sky-name', p.name);
      el.setAttribute('data-alt', String(p.alt));
      el.setAttribute('data-az', String(p.az));
      el.style.left = p.x.toFixed(2) + '%';
      el.style.top = p.y.toFixed(2) + '%';
      frag.appendChild(el);
    });

    if (
      state.selection &&
      (state.selection.type === 'catalog' || state.selection.type === 'deepsky') &&
      Number.isFinite(state.selection.alt) &&
      Number.isFinite(state.selection.az)
    ) {
      const xy = Sky.projectAltAz(state.selection.alt, state.selection.az, opts);
      if (xy) {
        const mark = document.createElement('span');
        mark.className = 'plan-sky__marker is-selected';
        mark.setAttribute('aria-hidden', 'true');
        mark.title = state.selection.name;
        mark.style.left = xy.x.toFixed(2) + '%';
        mark.style.top = xy.y.toFixed(2) + '%';
        frag.appendChild(mark);
      }
    }

    host.appendChild(frag);

    const caption = document.createElement('div');
    caption.className = 'plan-caption';
    const phase = Sky.moonPhaseFraction(sky.date);
    const disc = document.createElement('span');
    disc.className = 'plan-caption__moon';
    disc.setAttribute('aria-hidden', 'true');
    disc.style.setProperty('--moon-phase', phase.toFixed(3));
    caption.appendChild(disc);
    const text = document.createElement('p');
    text.className = 'plan-caption__text';
    text.textContent = Sky.formatSkyCaption(sky);
    caption.appendChild(text);
    const tw = twilightLabel(sky.sunAlt);
    if (tw) {
      const twEl = document.createElement('p');
      twEl.className = 'plan-caption__twilight';
      twEl.textContent = tw;
      caption.appendChild(twEl);
    }
    host.appendChild(caption);

    if (state.compassMode && Number.isFinite(state.compassAz)) {
      const compass = document.createElement('div');
      compass.className = 'plan-compass';
      compass.setAttribute('aria-hidden', 'true');
      compass.innerHTML =
        '<div class="plan-compass__ring"><span class="plan-compass__needle" style="--plan-heading:' +
        state.compassAz.toFixed(1) +
        'deg"></span><span class="plan-compass__label">N</span></div>' +
        '<p class="plan-compass__hint">' +
        Math.round(state.compassAz) +
        '° · hold phone level</p>';
      host.appendChild(compass);
    }
  }

  function renderPlanetTable(tbody, planets, selection) {
    if (!tbody) return;
    tbody.replaceChildren();
    const rows = formatPlanetRows(planets);
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'None above horizon';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    const selKey = selectionKey(selection);
    rows.forEach((p) => {
      const tr = document.createElement('tr');
      tr.className = 'plan-planets__row';
      tr.setAttribute('role', 'button');
      tr.tabIndex = 0;
      tr.setAttribute('data-sky-type', 'planet');
      tr.setAttribute('data-sky-id', p.id);
      tr.setAttribute('data-sky-name', p.name);
      tr.setAttribute('data-alt', String(p.alt));
      tr.setAttribute('data-az', String(p.az));
      if (selKey === selectionKey({ type: 'planet', id: p.id, name: p.name })) {
        tr.classList.add('is-selected');
      }
      tr.innerHTML =
        '<td>' +
        p.name +
        '</td><td>' +
        p.alt +
        '°</td><td>' +
        p.az +
        '°</td>';
      tbody.appendChild(tr);
    });
  }

  function renderAsterismList(ul, Sky, selection) {
    if (!ul || !Sky.SKY_ASTERISMS) return;
    ul.replaceChildren();
    const selKey = selectionKey(selection);
    Sky.SKY_ASTERISMS.forEach((a) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-asterism-hit';
      btn.textContent = a.label;
      btn.setAttribute('data-sky-type', 'asterism');
      btn.setAttribute('data-sky-id', a.id);
      btn.setAttribute('data-sky-name', a.label);
      if (selKey === selectionKey({ type: 'asterism', id: a.id, name: a.label })) {
        btn.classList.add('is-selected');
      }
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function asterismCentroid(Sky, sky, asterismId) {
    const a = (Sky.SKY_ASTERISMS || []).find((x) => x.id === asterismId);
    if (!a || !sky) return null;
    const names = new Set();
    (a.pairs || []).forEach((pair) => {
      pair.forEach((n) => names.add(n));
    });
    const hits = (sky.stars || []).filter((s) => names.has(s.name));
    if (!hits.length) return null;
    let alt = 0;
    let az = 0;
    hits.forEach((s) => {
      alt += s.alt;
      az += s.az;
    });
    return { alt: alt / hits.length, az: az / hits.length };
  }

  function syncControls(els, state) {
    if (els.date) els.date.value = formatDateInput(state.date);
    if (els.time) els.time.value = formatTimeInput(state.date);
    if (els.facing) els.facing.value = state.facing || 'south';
    if (els.location) {
      els.location.textContent =
        state.observer.label +
        ' · ' +
        state.observer.lat.toFixed(2) +
        '°, ' +
        state.observer.lon.toFixed(2) + '°';
    }
  }

  function readControls(els, state) {
    if (els.date && els.date.value) {
      const p = els.date.value.split('-').map(Number);
      if (p.length === 3) state.date = buildSkyDate({ y: p[0], m: p[1], d: p[2] }, null, state.date);
    }
    if (els.time && els.time.value) {
      const p = els.time.value.split(':').map(Number);
      if (p.length >= 2) {
        state.date = buildSkyDate(null, { h: p[0], m: p[1] }, state.date);
      }
    }
    if (els.facing) state.facing = els.facing.value || 'south';
  }

  let _liveState = null;
  let _liveSky = null;

  function getSkyContext() {
    const Sky = root.FunHomeSky;
    if (!_liveState || !Sky) return {};
    const sky = _liveSky;
    const sel = _liveState.selection;
    return {
      observerLabel: _liveState.observer.label,
      lat: _liveState.observer.lat.toFixed(2) + '°',
      lon: _liveState.observer.lon.toFixed(2) + '°',
      dateLocal: formatDateInput(_liveState.date) + ' ' + formatTimeInput(_liveState.date),
      facing: _liveState.facing || 'south',
      moonPhase: Sky.moonPhaseLabel(_liveState.date),
      caption: sky ? Sky.formatSkyCaption(sky) : '',
      planets: formatPlanetRows(sky?.planets || []).map((p) => ({
        name: p.name,
        alt: p.alt,
        az: p.az,
      })),
      asterisms: (Sky.SKY_ASTERISMS || []).map((a) => a.label),
      twilight: sky ? twilightLabel(sky.sunAlt) : '',
      compassMode: !!_liveState.compassMode,
      compassAz: Number.isFinite(_liveState.compassAz) ? Math.round(_liveState.compassAz) : null,
      selection: sel
        ? {
            type: sel.type,
            id: sel.id,
            name: sel.name,
            alt: sel.alt != null ? Math.round(sel.alt) : null,
            az: sel.az != null ? Math.round(sel.az) : null,
            ra: sel.ra,
            dec: sel.dec,
          }
        : null,
      refreshedAt: new Date().toISOString(),
    };
  }

  function bindFullscreen(els) {
    const stage = document.querySelector('.plan-stage');
    const btn = document.getElementById('planFullscreen');
    if (!stage || !btn) return;

    btn.addEventListener('click', () => {
      if (document.fullscreenElement === stage) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        stage.requestFullscreen?.().catch(() => {
          if (els.status) els.status.textContent = 'Fullscreen not supported in this browser';
        });
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === stage;
      stage.classList.toggle('plan-stage--fullscreen', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = on
        ? '<i class="bi bi-fullscreen-exit" aria-hidden="true"></i> Exit'
        : '<i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Full screen';
      if (els.status && on) els.status.textContent = 'Full screen — press Esc to exit';
      else if (els.status && !on && els.status.textContent.includes('Full screen')) {
        els.status.textContent = '';
      }
    });
  }

  function paint(state, els) {
    const Sky = root.FunHomeSky;
    if (!Sky) return;
    const sky = Sky.projectSky(state.date, state.observer, {
      ...projOptsFor(state),
      forceTime: true,
    });
    sky.scrubbed = true;
    _liveState = state;
    _liveSky = sky;
    renderSkyDome(els.sky, sky, Sky, state);
    renderPlanetTable(els.planetBody, sky.planets, state.selection);
    renderAsterismList(els.asterisms, Sky, state.selection);
    if (els.status && !document.fullscreenElement && state.selection) {
      const s = state.selection;
      const where =
        Number.isFinite(s.alt) && Number.isFinite(s.az) ? ' · ' + formatAltAz(s.alt, s.az) : '';
      els.status.textContent = 'Selected ' + s.name + where;
    } else if (els.status && !document.fullscreenElement) {
      els.status.textContent = '';
    }
  }

  function initPage() {
    const Sky = root.FunHomeSky;
    if (!Sky) return;

    const els = {
      sky: document.getElementById('planSky'),
      date: document.getElementById('planDate'),
      time: document.getElementById('planTime'),
      facing: document.getElementById('planFacing'),
      location: document.getElementById('planLocation'),
      planetBody: document.getElementById('planPlanetBody'),
      asterisms: document.getElementById('planAsterisms'),
      now: document.getElementById('planNow'),
      tonight: document.getElementById('planTonight'),
      geolocate: document.getElementById('planGeolocate'),
      share: document.getElementById('planShare'),
      status: document.getElementById('planStatus'),
    };

    const urlState = parseParams(root.location && root.location.search);
    const state = {
      observer: Sky.DEFAULT_OBSERVER,
      date: buildSkyDate(urlState.dateParts, urlState.timeParts, new Date()),
      facing: urlState.facing || 'south',
      compassMode: false,
      compassAz: null,
      centerAzOverride: null,
      selection: null,
    };
    if (urlState.observer) state.observer = urlState.observer;

    function refresh(fromControls) {
      if (fromControls) readControls(els, state);
      syncControls(els, state);
      paint(state, els);
    }

    function selectSkyObject(raw, opts) {
      const options = opts || {};
      const sel = normalizeSelection(raw);
      state.selection = sel;
      if (sel && Number.isFinite(sel.az) && options.center !== false) {
        state.compassMode = false;
        state.compassAz = null;
        state.centerAzOverride = ((Number(sel.az) % 360) + 360) % 360;
      }
      refresh(false);
      return sel;
    }

    function selectionFromDataset(el) {
      if (!el || !el.getAttribute) return null;
      const type = el.getAttribute('data-sky-type');
      const id = el.getAttribute('data-sky-id');
      const name = el.getAttribute('data-sky-name') || id;
      if (!type || !id) return null;
      const alt = Number(el.getAttribute('data-alt'));
      const az = Number(el.getAttribute('data-az'));
      const ra = Number(el.getAttribute('data-ra'));
      const dec = Number(el.getAttribute('data-dec'));
      return {
        type,
        id,
        name,
        alt: Number.isFinite(alt) ? alt : null,
        az: Number.isFinite(az) ? az : null,
        ra: Number.isFinite(ra) ? ra : null,
        dec: Number.isFinite(dec) ? dec : null,
      };
    }

    function applyUrlSelection() {
      if (urlState.body) {
        const planet = (_liveSky && _liveSky.planets || []).find((p) => p.id === urlState.body);
        if (planet) {
          selectSkyObject(
            {
              type: 'planet',
              id: planet.id,
              name: planet.name,
              alt: planet.alt,
              az: planet.az,
            },
            { center: true }
          );
          return;
        }
      }
      if (urlState.select) {
        const key = String(urlState.select).toLowerCase();
        const star = (_liveSky && _liveSky.stars || []).find(
          (s) => s.name.toLowerCase() === key
        );
        if (star) {
          selectSkyObject(
            {
              type: 'star',
              id: star.name,
              name: star.name,
              alt: star.alt,
              az: star.az,
              ra: star.ra,
              dec: star.dec,
            },
            { center: true }
          );
          return;
        }
        const aster = (Sky.SKY_ASTERISMS || []).find(
          (a) => a.id === key || a.label.toLowerCase() === key
        );
        if (aster) {
          const c = asterismCentroid(Sky, _liveSky, aster.id);
          selectSkyObject(
            {
              type: 'asterism',
              id: aster.id,
              name: aster.label,
              alt: c ? c.alt : null,
              az: c ? c.az : null,
            },
            { center: !!c }
          );
        }
      }
    }

    function boot(observer) {
      if (observer && !urlState.observer) state.observer = observer;
      refresh(false);
      applyUrlSelection();
    }

    if (urlState.observer) {
      boot(state.observer);
    } else {
      Sky.resolveObserver(boot);
    }

    if (els.sky) {
      els.sky.addEventListener('click', (event) => {
        const hit = event.target.closest('[data-sky-type]');
        if (!hit || !els.sky.contains(hit)) return;
        event.preventDefault();
        selectSkyObject(selectionFromDataset(hit), { center: true });
      });
    }

    if (els.planetBody) {
      els.planetBody.addEventListener('click', (event) => {
        const row = event.target.closest('[data-sky-type="planet"]');
        if (!row) return;
        selectSkyObject(selectionFromDataset(row), { center: true });
      });
      els.planetBody.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-sky-type="planet"]');
        if (!row) return;
        event.preventDefault();
        selectSkyObject(selectionFromDataset(row), { center: true });
      });
    }

    if (els.asterisms) {
      els.asterisms.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-sky-type="asterism"]');
        if (!btn) return;
        const id = btn.getAttribute('data-sky-id');
        const name = btn.getAttribute('data-sky-name') || id;
        const c = asterismCentroid(Sky, _liveSky, id);
        selectSkyObject(
          {
            type: 'asterism',
            id,
            name,
            alt: c ? c.alt : null,
            az: c ? c.az : null,
          },
          { center: !!c }
        );
      });
    }

    ['change', 'input'].forEach((ev) => {
      if (els.date) els.date.addEventListener(ev, () => refresh(true));
      if (els.time) els.time.addEventListener(ev, () => refresh(true));
      if (els.facing) els.facing.addEventListener(ev, () => {
        state.centerAzOverride = null;
        state.compassMode = false;
        refresh(true);
      });
    });

    if (els.now) {
      els.now.addEventListener('click', () => {
        state.date = new Date();
        refresh(false);
      });
    }

    if (els.tonight) {
      els.tonight.addEventListener('click', () => {
        state.date = Sky.buildLocalSkyDate(new Date(), 21, 0);
        refresh(false);
      });
    }

    if (els.geolocate) {
      els.geolocate.addEventListener('click', () => {
        if (els.status) els.status.textContent = 'Locating…';
        try {
          if (root.sessionStorage) root.sessionStorage.removeItem(Sky.OBSERVER_STORAGE_KEY);
        } catch (_) {
          /* ignore */
        }
        Sky.resolveObserver((obs) => {
          state.observer = obs;
          refresh(false);
        });
      });
    }

    if (els.share) {
      els.share.addEventListener('click', async () => {
        const url = buildShareUrl(state, root.location && root.location.origin);
        try {
          if (root.navigator && root.navigator.clipboard) {
            await root.navigator.clipboard.writeText(url);
            if (els.status) els.status.textContent = 'Link copied to clipboard';
            return;
          }
        } catch (_) {
          /* fall through */
        }
        if (els.status) els.status.textContent = url;
      });
    }

    bindFullscreen(els);

    if (root.WebGpuPlanetariumSky && typeof root.WebGpuPlanetariumSky.mount === 'function') {
      root.WebGpuPlanetariumSky.mount({ canvasId: 'planSkyGpu' }).catch(() => {});
    }

    root.Planetarium._live = {
      getState: () => state,
      refresh,
      paint: () => paint(state, els),
      selectSkyObject,
    };
    root.Planetarium.selectSkyObject = selectSkyObject;
    root.Planetarium.enableCompass = function (on) {
      state.compassMode = !!on;
      if (!on) state.compassAz = null;
      refresh(true);
    };
    root.Planetarium.setCompassAz = function (az) {
      if (!state.compassMode) return;
      state.compassAz = ((Number(az) % 360) + 360) % 360;
      refresh(true);
    };
    root.Planetarium.centerOnAz = function (az) {
      state.compassMode = false;
      state.compassAz = null;
      state.centerAzOverride = ((Number(az) % 360) + 360) % 360;
      refresh(true);
    };
    root.Planetarium.objectAltAz = function (ra, dec) {
      return objectAltAz(ra, dec, state.observer, state.date, Sky);
    };
  }

  root.Planetarium = {
    FACING,
    parseParams,
    buildSkyDate,
    buildShareUrl,
    formatPlanetRows,
    formatAltAz,
    twilightLabel,
    projOptsFor,
    getSkyContext,
    objectAltAz,
    isDarkSky,
    normalizeSelection,
    selectionKey,
    _live: null,
    enableCompass: () => {},
    setCompassAz: () => {},
    centerOnAz: () => {},
    selectSkyObject: () => null,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
