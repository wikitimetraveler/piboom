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

  /** Parse ?date=&time=&lat=&lon=&face= URL params into partial state. */
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
    if (state.facing && state.facing !== 'south') params.set('face', state.facing);
    return base + '?' + params.toString();
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
        svg.appendChild(seg);
      });
      host.appendChild(svg);
    }

    const frag = document.createDocumentFragment();
    const mobile = root.matchMedia && root.matchMedia('(max-width: 991.98px)').matches;
    const starCap = mobile ? 48 : 80;
    const ranked = sky.stars.slice().sort((a, b) => a.mag - b.mag).slice(0, starCap);
    let labelsLeft = mobile ? 8 : 14;
    ranked.forEach((s, i) => {
      const el = document.createElement('span');
      el.className = 'plan-sky__star';
      if (s.bright) el.classList.add('plan-sky__star--bright');
      if (s.flare) el.classList.add('plan-sky__star--flare');
      el.title = s.name;
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
      const el = document.createElement('span');
      el.className = 'plan-sky__planet plan-sky__planet--' + p.id;
      el.title = p.name + ' · ' + formatAltAz(p.alt, p.az);
      el.style.left = p.x.toFixed(2) + '%';
      el.style.top = p.y.toFixed(2) + '%';
      frag.appendChild(el);
    });

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

  function renderPlanetTable(tbody, planets) {
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
    rows.forEach((p) => {
      const tr = document.createElement('tr');
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

  function renderAsterismList(ul, Sky) {
    if (!ul || !Sky.SKY_ASTERISMS) return;
    ul.replaceChildren();
    Sky.SKY_ASTERISMS.forEach((a) => {
      const li = document.createElement('li');
      li.textContent = a.label;
      ul.appendChild(li);
    });
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
    renderPlanetTable(els.planetBody, sky.planets);
    if (els.status && !document.fullscreenElement) els.status.textContent = '';
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
    };
    if (urlState.observer) state.observer = urlState.observer;

    renderAsterismList(els.asterisms, Sky);

    function refresh(fromControls) {
      if (fromControls) readControls(els, state);
      syncControls(els, state);
      paint(state, els);
    }

    function boot(observer) {
      if (observer && !urlState.observer) state.observer = observer;
      refresh(false);
    }

    if (urlState.observer) {
      boot(state.observer);
    } else {
      Sky.resolveObserver(boot);
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

    root.Planetarium._live = {
      getState: () => state,
      refresh,
      paint: () => paint(state, els),
    };
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

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
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
    _live: null,
    enableCompass: () => {},
    setCompassAz: () => {},
    centerOnAz: () => {},
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
