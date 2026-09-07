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

  function isFieldApp() {
    return !!(root.__PLANETARIUM_FIELD || (typeof document !== 'undefined' && document.body?.classList.contains('plan-field')));
  }

  /** Parse ?date=&time=&lat=&lon=&face=&body=&select=&view=&app= URL params into partial state. */
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
    const view = String(params.get('view') || '').toLowerCase();
    if (view === 'horizon' || view === 'dome') out.view = view;
    if (String(params.get('app') || '').toLowerCase() === 'field') out.app = 'field';
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
    const field = isFieldApp() || state.app === 'field';
    const base = (origin || '') + (field ? '/planetarium/field.html' : '/planetarium/');
    const params = new URLSearchParams();
    params.set('date', formatDateInput(state.date));
    params.set('time', formatTimeInput(state.date));
    params.set('lat', String(state.observer.lat));
    params.set('lon', String(state.observer.lon));
    if (state.observer.label) params.set('label', String(state.observer.label).slice(0, 80));
    if (state.facing && state.facing !== 'south') params.set('face', state.facing);
    if (state.domeMode === false) params.set('view', 'horizon');
    if (field) params.set('app', 'field');
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

  const SELECTION_KIND = {
    planet: 'Planet',
    star: 'Star',
    constellation: 'Constellation',
    asterism: 'Asterism',
    catalog: 'Catalog',
    deepsky: 'Deep sky',
    iss: 'Satellite',
    radiant: 'Meteor radiant',
  };

  const WORLD_BODY_IDS = new Set([
    'mercury',
    'venus',
    'earth',
    'moon',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ]);

  function worldHomeUrl(bodyId) {
    const Sky = root.FunHomeSky;
    if (Sky && typeof Sky.buildWorldUrl === 'function') {
      return Sky.buildWorldUrl({ id: bodyId });
    }
    return '/planetarium/worlds/body.html?id=' + encodeURIComponent(bodyId);
  }

  function renderPickHud(selection) {
    const doc = typeof document !== 'undefined' ? document : null;
    const hud = doc && doc.getElementById('planPickHud');
    if (!hud) return;
    if (!selection) {
      hud.hidden = true;
      return;
    }
    const name = doc.getElementById('planPickName');
    const meta = doc.getElementById('planPickMeta');
    if (name) name.textContent = selection.name || selection.id || 'Sky object';
    if (meta) {
      const kind = SELECTION_KIND[selection.type] || selection.type || 'Object';
      const where =
        Number.isFinite(selection.alt) && Number.isFinite(selection.az)
          ? formatAltAz(selection.alt, selection.az)
          : '';
      meta.textContent = where ? kind + ' · ' + where : kind;
    }
    const worldLink = doc.getElementById('planPickWorld');
    const worldLabel = doc.getElementById('planPickWorldLabel');
    const bodyId = String(selection.id || selection.name || '')
      .trim()
      .toLowerCase();
    const isWorld =
      (selection.type === 'planet' || selection.type === 'moon') && WORLD_BODY_IDS.has(bodyId);
    if (worldLink) {
      if (isWorld) {
        worldLink.hidden = false;
        worldLink.href = worldHomeUrl(bodyId);
        const label = selection.name || bodyId;
        if (worldLabel) worldLabel.textContent = 'Open ' + label;
        worldLink.setAttribute('aria-label', 'Open ' + label + ' world page');
      } else {
        worldLink.hidden = true;
      }
    }
    hud.hidden = false;
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
        '<td><span class="plan-planets__name">' +
        p.name +
        '</span>' +
        (WORLD_BODY_IDS.has(String(p.id).toLowerCase())
          ? ' <a class="plan-planets__world" href="' +
            worldHomeUrl(p.id) +
            '" title="Open ' +
            p.name +
            ' world page">home</a>'
          : '') +
        '</td><td>' +
        p.alt +
        '°</td><td>' +
        p.az +
        '°</td>';
      tbody.appendChild(tr);
    });
  }

  function renderAsterismList(ul, items, selection) {
    if (!ul) return;
    ul.replaceChildren();
    const selKey = selectionKey(selection);
    (items || []).forEach((a) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-asterism-hit';
      btn.textContent = a.label || a.name;
      btn.setAttribute('data-sky-type', a.type || 'asterism');
      btn.setAttribute('data-sky-id', a.id);
      btn.setAttribute('data-sky-name', a.label || a.name);
      if (Number.isFinite(a.alt)) btn.setAttribute('data-alt', String(a.alt));
      if (Number.isFinite(a.az)) btn.setAttribute('data-az', String(a.az));
      if (selKey === selectionKey({ type: a.type || 'asterism', id: a.id, name: a.label || a.name })) {
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

  function constellationCentroid(Engine, date, observer, constellation) {
    if (!Engine || !constellation || !constellation.lines || !constellation.lines.length) return null;
    let alt = 0;
    let az = 0;
    let n = 0;
    constellation.lines.forEach((seg) => {
      (seg || []).forEach((pt) => {
        if (!pt || pt.length < 2) return;
        const aa = Engine.equatorialToAltAz(pt[0], pt[1], date, observer);
        if (aa.alt < 0) return;
        alt += aa.alt;
        az += aa.az;
        n += 1;
      });
    });
    if (!n) return null;
    return { alt: alt / n, az: az / n };
  }

  function renderDomeCaption(host, snap, state) {
    if (!host) return;
    let caption = host.querySelector('.plan-caption');
    if (!caption) {
      caption = document.createElement('div');
      caption.className = 'plan-caption';
      host.appendChild(caption);
    }
    caption.replaceChildren();
    const disc = document.createElement('span');
    disc.className = 'plan-caption__moon';
    disc.setAttribute('aria-hidden', 'true');
    disc.style.setProperty('--moon-phase', Number(snap.moonPhaseFraction || 0).toFixed(3));
    caption.appendChild(disc);
    const text = document.createElement('p');
    text.className = 'plan-caption__text';
    text.textContent = snap.caption || '';
    caption.appendChild(text);
    if (snap.twilight) {
      const twEl = document.createElement('p');
      twEl.className = 'plan-caption__twilight';
      twEl.textContent = snap.twilight;
      caption.appendChild(twEl);
    }
    if (state.compassMode && Number.isFinite(state.compassAz)) {
      let compass = host.querySelector('.plan-compass');
      if (!compass) {
        compass = document.createElement('div');
        compass.className = 'plan-compass';
        compass.setAttribute('aria-hidden', 'true');
        host.appendChild(compass);
      }
      compass.innerHTML =
        '<div class="plan-compass__ring"><span class="plan-compass__needle" style="--plan-heading:' +
        state.compassAz.toFixed(1) +
        'deg"></span><span class="plan-compass__label">N</span></div>' +
        '<p class="plan-compass__hint">' +
        Math.round(state.compassAz) +
        '° · hold phone level</p>';
    } else {
      host.querySelector('.plan-compass')?.remove();
    }
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
    const Engine = root.CelestialEngine;
    const Sky = root.FunHomeSky;
    if (!_liveState) return {};
    const sky = _liveSky;
    const sel = _liveState.selection;
    const moonPhase =
      (sky && sky.moonPhase) ||
      (Engine && Engine.moonPhaseLabel(_liveState.date)) ||
      (Sky && Sky.moonPhaseLabel(_liveState.date)) ||
      '';
    const caption =
      (sky && sky.caption) ||
      (Sky && sky ? Sky.formatSkyCaption(sky) : '');
    const planets = formatPlanetRows(sky?.planets || sky?.allBodies || []).map((p) => ({
      name: p.name,
      alt: p.alt,
      az: p.az,
    }));
    return {
      observerLabel: _liveState.observer.label,
      lat: _liveState.observer.lat.toFixed(2) + '°',
      lon: _liveState.observer.lon.toFixed(2) + '°',
      dateLocal: formatDateInput(_liveState.date) + ' ' + formatTimeInput(_liveState.date),
      facing: _liveState.facing || 'south',
      view: _liveState.domeMode === false ? 'horizon' : 'dome',
      moonPhase,
      caption,
      planets,
      asterisms: sky?.asterisms || (Sky?.SKY_ASTERISMS || []).map((a) => a.label),
      twilight: sky?.twilight || (sky ? twilightLabel(sky.sunAlt) : ''),
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
      engine: sky?.engine || 'fun-home-sky',
      refreshedAt: new Date().toISOString(),
    };
  }

  function syncDomeSize(stageEl) {
    const stage = stageEl || (typeof document !== 'undefined' ? document.querySelector('.plan-stage') : null);
    if (!stage) return;
    const w = stage.clientWidth || stage.getBoundingClientRect().width;
    const h = stage.clientHeight || stage.getBoundingClientRect().height;
    const px = Math.max(160, Math.floor(Math.min(w, h) - 10));
    stage.style.setProperty('--dome-px', px + 'px');
  }

  function bindFullscreen(els) {
    const stage = document.querySelector('.plan-stage');
    const btn = document.getElementById('planFullscreen');
    if (!stage || !btn) return;

    function isFs() {
      return (
        document.fullscreenElement === stage ||
        document.webkitFullscreenElement === stage ||
        stage.classList.contains('plan-stage--immersive')
      );
    }

    function afterFs(on) {
      stage.classList.toggle('plan-stage--fullscreen', !!document.fullscreenElement || !!document.webkitFullscreenElement);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = on
        ? '<i class="bi bi-fullscreen-exit" aria-hidden="true"></i> Exit'
        : '<i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Full screen';
      if (els.status && on) els.status.textContent = 'Full screen — press Esc to exit';
      else if (els.status && !on && String(els.status.textContent || '').includes('Full screen')) {
        els.status.textContent = '';
      }
      syncDomeSize(stage);
      const GL = root.PlanetariumGL;
      if (GL && typeof GL.forceResize === 'function') {
        requestAnimationFrame(() => GL.forceResize());
      }
    }

    function enterFs() {
      const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
      if (typeof req === 'function') {
        Promise.resolve(req.call(stage)).catch(() => {
          stage.classList.add('plan-stage--immersive');
          afterFs(true);
        });
        return;
      }
      stage.classList.add('plan-stage--immersive');
      afterFs(true);
    }

    function exitFs() {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (document.fullscreenElement === stage || document.webkitFullscreenElement === stage) {
        exit?.call(document).catch(() => {});
      }
      stage.classList.remove('plan-stage--immersive');
      afterFs(false);
    }

    btn.addEventListener('click', () => {
      if (isFs()) exitFs();
      else enterFs();
    });

    document.addEventListener('fullscreenchange', () => afterFs(isFs()));
    document.addEventListener('webkitfullscreenchange', () => afterFs(isFs()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && stage.classList.contains('plan-stage--immersive')) {
        exitFs();
      }
    });
  }

  function paint(state, els) {
    const Engine = root.CelestialEngine;
    const Sky = root.FunHomeSky;
    const GL = root.PlanetariumGL;
    const useGl = !!(GL && GL.ok && GL.ready);
    const opts = projOptsFor(state);
    let sky = null;

    if (useGl && Engine && typeof Engine.skySnapshot === 'function') {
      let centerAz = FACING[state.facing] || 180;
      if (state.compassMode && Number.isFinite(state.compassAz)) centerAz = state.compassAz;
      else if (Number.isFinite(state.centerAzOverride)) centerAz = state.centerAzOverride;
      else if (Number.isFinite(state.cameraAz)) centerAz = state.cameraAz;
      sky = Engine.skySnapshot(
        {
          date: state.date,
          observer: state.observer,
          facing: state.facing,
          selection: state.selection,
          cameraAz: centerAz,
        },
        { constellationLabels: state.constellationLabels || [] }
      );
      sky.scrubbed = true;
    } else if (Sky) {
      // DOM wedge needs FunHomeSky stars — CelestialEngine has planets only.
      sky = Sky.projectSky(state.date, state.observer, {
        ...opts,
        forceTime: true,
      });
      sky.scrubbed = true;
      // Prefer accurate engine planets when available
      if (Engine && typeof Engine.listBodiesAltAz === 'function') {
        const bodies = Engine.listBodiesAltAz(state.date, state.observer, {
          aboveHorizonOnly: false,
        });
        sky.planets = bodies
          .filter((p) => p.alt >= 0)
          .map((p) => {
            const xy = Sky.projectAltAz(p.alt, p.az, opts);
            if (!xy) return null;
            return {
              id: p.id,
              name: p.name,
              alt: p.alt,
              az: p.az,
              x: xy.x,
              y: xy.y,
              size: p.id === 'moon' ? 9 : p.id === 'jupiter' || p.id === 'saturn' ? 8 : 7,
            };
          })
          .filter(Boolean);
        sky.sunAlt = Engine.sunAltAz(state.date, state.observer).alt;
        sky.moonPhase = Engine.moonPhaseLabel(state.date);
        sky.caption = Engine.formatSkyCaption({
          observer: state.observer,
          date: state.date,
          planets: sky.planets,
          moonPhase: sky.moonPhase,
        });
        sky.engine = 'astronomy-engine+fun-home-sky';
      }
    } else {
      return;
    }

    _liveState = state;
    _liveSky = sky;

    const gpuCanvas = document.getElementById('planSkyGpu');
    if (gpuCanvas) {
      gpuCanvas.style.visibility = useGl ? 'visible' : 'hidden';
      gpuCanvas.style.pointerEvents = useGl ? 'auto' : 'none';
    }

    if (useGl) {
      if (els.sky) {
        els.sky.replaceChildren();
        renderDomeCaption(els.sky, sky, state);
      }
      const markers = (state.domeMarkers || []).slice();
      const sel = state.selection;
      if (
        sel &&
        (sel.type === 'catalog' || sel.type === 'deepsky' || sel.type === 'radiant') &&
        Number.isFinite(sel.alt) &&
        Number.isFinite(sel.az)
      ) {
        markers.push({
          type: sel.type,
          id: sel.id,
          name: sel.name,
          alt: sel.alt,
          az: sel.az,
          ra: sel.ra,
          dec: sel.dec,
          color: 0xffd280,
        });
      }
      GL.render(sky, {
        markers,
        iss: state.issPos || null,
      });
    } else if (Sky && els.sky) {
      renderSkyDome(els.sky, sky, Sky, state);
    }

    renderPlanetTable(els.planetBody, sky.planets || sky.allBodies || [], state.selection);

    if (state.constellationItems && state.constellationItems.length) {
      renderAsterismList(els.asterisms, state.constellationItems, state.selection);
    } else if (Sky) {
      renderAsterismList(
        els.asterisms,
        (Sky.SKY_ASTERISMS || []).map((a) => ({ id: a.id, label: a.label, type: 'asterism' })),
        state.selection
      );
    }

    if (els.fovReadout && useGl) {
      const v = GL.getView();
      els.fovReadout.textContent = Math.round(v.fov) + '° FOV';
    }

    renderPickHud(state.selection);

    if (els.status && !document.fullscreenElement && state.selection) {
      const s = state.selection;
      const where =
        Number.isFinite(s.alt) && Number.isFinite(s.az) ? ' · ' + formatAltAz(s.alt, s.az) : '';
      els.status.textContent = 'Selected ' + s.name + where;
    } else if (els.status && !document.fullscreenElement && !state.playing) {
      els.status.textContent = '';
    }
  }

  function initPage() {
    if (root.__PLANETARIUM_PAGE_INIT) return;
    root.__PLANETARIUM_PAGE_INIT = true;
    const Sky = root.FunHomeSky;
    const Engine = root.CelestialEngine;
    if (!Sky && !Engine) return;

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
      play: document.getElementById('planPlay'),
      speed: document.getElementById('planSpeed'),
      fovReadout: document.getElementById('planFov'),
      linesToggle: document.getElementById('planLinesToggle'),
      nightVision: document.getElementById('planNightVision'),
      lookUp: document.getElementById('planLookUp'),
      facingCaption: document.getElementById('planFacingCaption'),
    };

    const urlState = parseParams(root.location && root.location.search);
    const defaultObs = (Engine && Engine.DEFAULT_OBSERVER) || Sky.DEFAULT_OBSERVER;
    const fieldApp = isFieldApp();
    let domeMode;
    if (urlState.view === 'dome') domeMode = true;
    else if (urlState.view === 'horizon') domeMode = false;
    else domeMode = !fieldApp;
    const state = {
      observer: defaultObs,
      date: buildSkyDate(urlState.dateParts, urlState.timeParts, new Date()),
      facing: urlState.facing || 'south',
      compassMode: false,
      compassAz: null,
      centerAzOverride: null,
      cameraAz: FACING[urlState.facing || 'south'] || 180,
      selection: null,
      playing: false,
      playSpeed: 60,
      playRaf: 0,
      lastPlayTs: 0,
      constellationLabels: [],
      constellationItems: [],
      constellationData: [],
      domeMarkers: [],
      issPos: null,
      domeMode,
      app: fieldApp || urlState.app === 'field' ? 'field' : 'theater',
    };
    if (urlState.observer) state.observer = urlState.observer;

    function applyDomeChrome() {
      const stage = document.querySelector('.plan-stage');
      if (stage) {
        stage.classList.toggle('plan-stage--dome', state.domeMode);
        stage.classList.remove('plan-stage--immersive');
        stage.style.setProperty('--dome-az', String(state.cameraAz || 180));
        syncDomeSize(stage);
      }
      if (els.lookUp) {
        els.lookUp.setAttribute('aria-pressed', state.domeMode ? 'true' : 'false');
        els.lookUp.classList.toggle('is-active', state.domeMode);
      }
      if (els.facingCaption) {
        els.facingCaption.textContent = state.domeMode ? 'Bottom' : 'Facing';
      }
      const hint = document.getElementById('planHint');
      if (hint && hint.querySelector('p')) {
        if (isFieldApp()) {
          hint.querySelector('p').textContent =
            'Hold the phone like a window. Drag to pan. Pinch to zoom. Face locks to the real horizon.';
        } else {
          hint.querySelector('p').textContent = state.domeMode
            ? 'Looking up · Drag to spin the dome · Scroll to zoom'
            : 'Horizon view · Drag to look around · Scroll to zoom';
        }
      }
    }

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
        state.cameraAz = state.centerAzOverride;
        const GL = root.PlanetariumGL;
        if (GL && GL.ok) {
          const tilt = Number.isFinite(sel.alt)
            ? Math.max(state.domeMode ? 18 : 5, sel.alt)
            : state.domeMode
              ? 45
              : 25;
          GL.setView(state.centerAzOverride, tilt, true);
        }
        refresh(false);
        return sel;
      }
      // Canvas / sky pick: HUD only — never rebuild the dome (that was the left-shift flash)
      renderPickHud(sel);
      if (els.planetBody && _liveSky) {
        renderPlanetTable(els.planetBody, _liveSky.planets || _liveSky.allBodies || [], sel);
      }
      if (els.status && sel) {
        const where =
          Number.isFinite(sel.alt) && Number.isFinite(sel.az) ? ' · ' + formatAltAz(sel.alt, sel.az) : '';
        els.status.textContent = 'Selected ' + sel.name + where;
      } else if (els.status && !state.playing) {
        els.status.textContent = '';
      }
      const GL = root.PlanetariumGL;
      if (GL && GL.ok && typeof GL.setSelection === 'function') {
        GL.setSelection(sel);
      }
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
      const EngineLive = root.CelestialEngine;
      if (urlState.body) {
        const planet =
          (_liveSky && (_liveSky.planets || _liveSky.allBodies) || []).find(
            (p) => p.id === urlState.body
          ) ||
          (EngineLive && EngineLive.bodyAltAz(urlState.body, state.date, state.observer));
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
        if (EngineLive) {
          // Named bright star via equatorial lookup isn't in snapshot; try constellation match
          const constellation = (state.constellationData || []).find(
            (c) => c.id === key || String(c.name).toLowerCase() === key
          );
          if (constellation) {
            const c = constellationCentroid(EngineLive, state.date, state.observer, constellation);
            selectSkyObject(
              {
                type: 'constellation',
                id: constellation.id,
                name: constellation.name,
                alt: c ? c.alt : null,
                az: c ? c.az : null,
              },
              { center: !!c }
            );
            return;
          }
        }
        if (Sky) {
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
    }

    function stopPlay() {
      state.playing = false;
      if (state.playRaf) cancelAnimationFrame(state.playRaf);
      state.playRaf = 0;
      if (els.play) {
        els.play.setAttribute('aria-pressed', 'false');
        els.play.innerHTML = '<i class="bi bi-play-fill" aria-hidden="true"></i> Play';
      }
    }

    function playTick(ts) {
      if (!state.playing) return;
      if (!state.lastPlayTs) state.lastPlayTs = ts;
      const dt = Math.min(0.1, (ts - state.lastPlayTs) / 1000);
      state.lastPlayTs = ts;
      const reduced =
        root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        // Under reduced motion, Play steps one hour then pauses
        state.date = new Date(state.date.getTime() + 3600 * 1000);
        stopPlay();
        refresh(false);
        return;
      }
      state.date = new Date(state.date.getTime() + dt * state.playSpeed * 1000);
      refresh(false);
      state.playRaf = requestAnimationFrame(playTick);
    }

    function startPlay() {
      state.playing = true;
      state.lastPlayTs = 0;
      if (els.play) {
        els.play.setAttribute('aria-pressed', 'true');
        els.play.innerHTML = '<i class="bi bi-pause-fill" aria-hidden="true"></i> Pause';
      }
      state.playRaf = requestAnimationFrame(playTick);
    }

    async function mountGl() {
      const GL = root.PlanetariumGL;
      if (!GL || typeof GL.mount !== 'function') return false;
      const result = await GL.mount({
        canvas: 'planSkyGpu',
        engine: Engine || root.CelestialEngine,
        // Pick updates the HUD only — no slew (sliding on every star click is distracting)
        onSelect: (hit) => selectSkyObject(hit, { center: false }),
        onViewChange: (v) => {
          state.cameraAz = v.az;
          if (typeof v.domeMode === 'boolean') state.domeMode = v.domeMode;
          if (!state.compassMode) state.centerAzOverride = v.az;
          if (els.fovReadout) els.fovReadout.textContent = Math.round(v.fov) + '° FOV';
          applyDomeChrome();
          // Snap facing select to nearest cardinal when close
          if (els.facing && !state.compassMode) {
            const cards = [
              ['north', 0],
              ['east', 90],
              ['south', 180],
              ['west', 270],
            ];
            let best = null;
            let bestDiff = 25;
            cards.forEach(([name, az]) => {
              let d = Math.abs(((v.az - az + 540) % 360) - 180);
              if (d < bestDiff) {
                bestDiff = d;
                best = name;
              }
            });
            if (best) {
              state.facing = best;
              els.facing.value = best;
            }
          }
        },
      });
      if (result && result.ok) {
        state.constellationLabels = result.constellationLabels || [];
        try {
          const linesRes = await fetch('/data/planetarium/constellation-lines.json', {
            cache: 'force-cache',
          });
          const linesJson = await linesRes.json();
          state.constellationData = linesJson.constellations || [];
          // Sidebar: popular northern figures first, then rest capped
          const preferred = ['ori', 'uma', 'cas', 'cyg', 'sco', 'leo', 'tau', 'gem', 'sgr', 'crux'];
          const ranked = state.constellationData.slice().sort((a, b) => {
            const ia = preferred.indexOf(a.id);
            const ib = preferred.indexOf(b.id);
            if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return a.name.localeCompare(b.name);
          });
          state.constellationItems = ranked.slice(0, 16).map((c) => ({
            id: c.id,
            label: c.name,
            type: 'constellation',
          }));
        } catch (_) {
          /* keep empty */
        }
        document.querySelector('.plan-stage')?.classList.add('plan-stage--gl');
        return true;
      }
      return false;
    }

    function boot(observer) {
      if (observer && !urlState.observer) state.observer = observer;
      refresh(false);
      applyUrlSelection();
      applyDomeChrome();
    }

    async function start() {
      // Paint a usable sky immediately (DOM / CelestialEngine) before WebGL upgrade.
      function afterBoot() {
        // Theater: if sun is up and no URL time, snap to tonight 9 PM.
        // Field defaults to Now — daylight is fine; observers check "is it dark yet?"
        if (isFieldApp()) return;
        if (!urlState.dateParts && !urlState.timeParts && Engine) {
          const sun = Engine.sunAltAz(state.date, state.observer);
          if (sun && sun.alt > -6) {
            if (Sky && Sky.buildLocalSkyDate) state.date = Sky.buildLocalSkyDate(new Date(), 21, 0);
            else {
              const d = new Date();
              d.setHours(21, 0, 0, 0);
              state.date = d;
            }
            refresh(false);
          }
        }
      }

      if (urlState.observer) {
        boot(state.observer);
        afterBoot();
      } else if (Sky && typeof Sky.resolveObserver === 'function') {
        Sky.resolveObserver((obs) => {
          boot(obs);
          afterBoot();
        });
      } else {
        boot(state.observer);
        afterBoot();
      }

      try {
        const glOk = await mountGl();
        if (glOk) {
          refresh(false);
          const GL = root.PlanetariumGL;
          if (GL && GL.ok) {
            const reduced =
              root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (state.domeMode) {
              const sel = state.selection;
              if (sel && Number.isFinite(sel.alt) && Number.isFinite(sel.az)) {
                GL.setDomeMode(true, { reset: false });
                GL.setView(sel.az, Math.max(18, sel.alt), false);
              } else {
                GL.lookUp({ az: state.cameraAz, animate: !reduced, intro: true });
              }
            } else {
              GL.setDomeMode(false);
              GL.setView(state.cameraAz, 38, false);
            }
            applyDomeChrome();
          }
          requestAnimationFrame(() => refresh(false));
        } else if (root.WebGpuPlanetariumSky && typeof root.WebGpuPlanetariumSky.mount === 'function') {
          root.WebGpuPlanetariumSky.mount({ canvasId: 'planSkyGpu' }).catch(() => {});
        }
      } catch (err) {
        console.warn('PlanetariumGL mount failed — using DOM sky', err);
        if (root.WebGpuPlanetariumSky && typeof root.WebGpuPlanetariumSky.mount === 'function') {
          root.WebGpuPlanetariumSky.mount({ canvasId: 'planSkyGpu' }).catch(() => {});
        }
      }
    }

    if (els.sky) {
      els.sky.addEventListener('click', (event) => {
        const hit = event.target.closest('[data-sky-type]');
        if (!hit || !els.sky.contains(hit)) return;
        event.preventDefault();
        selectSkyObject(selectionFromDataset(hit), { center: false });
      });
    }

    if (els.planetBody) {
      els.planetBody.addEventListener('click', (event) => {
        if (event.target.closest('a.plan-planets__world')) return;
        const row = event.target.closest('[data-sky-type="planet"]');
        if (!row) return;
        selectSkyObject(selectionFromDataset(row), { center: true });
      });
      els.planetBody.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('a.plan-planets__world')) return;
        const row = event.target.closest('[data-sky-type="planet"]');
        if (!row) return;
        event.preventDefault();
        selectSkyObject(selectionFromDataset(row), { center: true });
      });
    }

    if (els.asterisms) {
      els.asterisms.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-sky-type]');
        if (!btn) return;
        const type = btn.getAttribute('data-sky-type');
        const id = btn.getAttribute('data-sky-id');
        const name = btn.getAttribute('data-sky-name') || id;
        const EngineLive = root.CelestialEngine;
        if (type === 'constellation' && EngineLive) {
          const constellation = (state.constellationData || []).find((c) => c.id === id);
          const c = constellationCentroid(EngineLive, state.date, state.observer, constellation);
          selectSkyObject(
            {
              type: 'constellation',
              id,
              name,
              alt: c ? c.alt : null,
              az: c ? c.az : null,
            },
            { center: !!c }
          );
          return;
        }
        const c = Sky ? asterismCentroid(Sky, _liveSky, id) : null;
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
      if (els.facing) {
        els.facing.addEventListener(ev, () => {
          state.centerAzOverride = null;
          state.compassMode = false;
          readControls(els, state);
          state.cameraAz = FACING[state.facing] || 180;
          const GL = root.PlanetariumGL;
          if (GL && GL.ok) GL.setView(state.cameraAz, undefined, true);
          refresh(true);
        });
      }
    });

    if (els.now) {
      els.now.addEventListener('click', () => {
        state.date = new Date();
        refresh(false);
      });
    }

    if (els.tonight) {
      els.tonight.addEventListener('click', () => {
        if (Sky && Sky.buildLocalSkyDate) state.date = Sky.buildLocalSkyDate(new Date(), 21, 0);
        else {
          const d = new Date();
          d.setHours(21, 0, 0, 0);
          state.date = d;
        }
        refresh(false);
      });
    }

    if (els.geolocate) {
      els.geolocate.addEventListener('click', () => {
        if (els.status) els.status.textContent = 'Locating…';
        if (Sky && Sky.resolveObserver) {
          try {
            if (root.sessionStorage) root.sessionStorage.removeItem(Sky.OBSERVER_STORAGE_KEY);
          } catch (_) {
            /* ignore */
          }
          Sky.resolveObserver((obs) => {
            state.observer = obs;
            refresh(false);
          });
        }
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

    if (els.play) {
      els.play.addEventListener('click', () => {
        if (state.playing) stopPlay();
        else startPlay();
      });
    }
    if (els.speed) {
      els.speed.addEventListener('change', () => {
        state.playSpeed = Number(els.speed.value) || 60;
      });
      state.playSpeed = Number(els.speed.value) || 60;
    }
    if (els.linesToggle) {
      els.linesToggle.addEventListener('click', () => {
        const GL = root.PlanetariumGL;
        const next = !(GL && GL.getView && GL.getView().showLines);
        GL?.setConstellationLines?.(next);
        els.linesToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        els.linesToggle.classList.toggle('is-active', next);
      });
    }
    if (els.nightVision && !isFieldApp()) {
      els.nightVision.addEventListener('click', () => {
        const on = document.body.classList.toggle('plan-night-vision');
        els.nightVision.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    } else if (els.nightVision && isFieldApp()) {
      document.body.classList.add('plan-night-vision');
      els.nightVision.setAttribute('aria-pressed', 'true');
    }
    if (els.lookUp) {
      els.lookUp.addEventListener('click', () => {
        const GL = root.PlanetariumGL;
        if (state.domeMode && GL && GL.ok) {
          const v = GL.getView();
          const alreadyUp = v.alt >= 80 && v.fov >= 88;
          if (!alreadyUp) {
            GL.lookUp({ az: state.cameraAz, animate: true });
            applyDomeChrome();
            return;
          }
        }
        state.domeMode = !state.domeMode;
        if (GL && GL.ok) {
          if (state.domeMode) GL.lookUp({ az: state.cameraAz, animate: true });
          else GL.setDomeMode(false);
        }
        applyDomeChrome();
        refresh(false);
      });
    }
    applyDomeChrome();

    bindFullscreen(els);
    window.addEventListener('resize', () => {
      syncDomeSize(document.querySelector('.plan-stage'));
      root.PlanetariumGL?.forceResize?.();
    });

    root.Planetarium._live = {
      getState: () => state,
      refresh,
      paint: () => paint(state, els),
      selectSkyObject,
      setDomeMarkers: (markers) => {
        state.domeMarkers = markers || [];
        paint(state, els);
      },
      setIssPos: (pos) => {
        state.issPos = pos || null;
        paint(state, els);
      },
      setDate: (date) => {
        state.date = date instanceof Date ? date : new Date(date);
        refresh(false);
      },
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
      state.cameraAz = state.compassAz;
      const GL = root.PlanetariumGL;
      if (GL && GL.ok) GL.setView(state.compassAz, undefined, false);
      refresh(true);
    };
    root.Planetarium.centerOnAz = function (az) {
      state.compassMode = false;
      state.compassAz = null;
      state.centerAzOverride = ((Number(az) % 360) + 360) % 360;
      state.cameraAz = state.centerAzOverride;
      const GL = root.PlanetariumGL;
      if (GL && GL.ok) GL.setView(state.centerAzOverride, undefined, true);
      refresh(true);
    };
    root.Planetarium.objectAltAz = function (ra, dec) {
      const Eng = root.CelestialEngine;
      if (Eng) return Eng.equatorialToAltAz(ra, dec, state.date, state.observer);
      return objectAltAz(ra, dec, state.observer, state.date, Sky);
    };

    start();
  }

  root.Planetarium = {
    FACING,
    parseParams,
    buildSkyDate,
    buildShareUrl,
    formatPlanetRows,
    formatAltAz,
    twilightLabel,
    renderPickHud,
    projOptsFor,
    getSkyContext,
    objectAltAz,
    isDarkSky,
    normalizeSelection,
    selectionKey,
    initPage,
    _live: null,
    enableCompass: () => {},
    setCompassAz: () => {},
    centerOnAz: () => {},
    selectSkyObject: () => null,
  };

  if (typeof document !== 'undefined' && !root.__PLANETARIUM_DEFER_INIT) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
