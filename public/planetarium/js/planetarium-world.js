/**
 * Planet world page — globe + research desk + Carl context.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const BODY_ORDER = [
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
  ];

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function resolveBodyId() {
    const raw = String(qs('id') || qs('body') || 'mars')
      .trim()
      .toLowerCase();
    return BODY_ORDER.includes(raw) ? raw : 'mars';
  }

  function fmtNum(n, digits) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString(undefined, {
      maximumFractionDigits: digits == null ? 1 : digits,
    });
  }

  function dayLabel(hours) {
    const h = Number(hours);
    if (!Number.isFinite(h)) return '—';
    const abs = Math.abs(h);
    const dir = h < 0 ? ' (retrograde)' : '';
    if (abs >= 48) {
      return fmtNum(abs / 24, 1) + ' Earth days' + dir;
    }
    return fmtNum(abs, 1) + ' hours' + dir;
  }

  function yearLabel(days) {
    const d = Number(days);
    if (!Number.isFinite(d)) return '—';
    if (d >= 400) return fmtNum(d / 365.25, 1) + ' Earth years';
    return fmtNum(d, 1) + ' Earth days';
  }

  function worldUrl(id) {
    const Sky = window.FunHomeSky;
    if (Sky && typeof Sky.buildWorldUrl === 'function') {
      return Sky.buildWorldUrl({ id });
    }
    return '/planetarium/worlds/body.html?id=' + encodeURIComponent(id);
  }

  function skyUrl(id) {
    const Sky = window.FunHomeSky;
    const obs = Sky && Sky.DEFAULT_OBSERVER;
    if (Sky && typeof Sky.buildPlanetariumUrl === 'function') {
      return Sky.buildPlanetariumUrl({
        date: new Date(),
        observer: obs,
        body: id === 'earth' ? undefined : id,
      });
    }
    const params = new URLSearchParams();
    if (id && id !== 'earth') params.set('body', id);
    const q = params.toString();
    return '/planetarium/' + (q ? '?' + q : '');
  }

  function dossierExcerpt(d) {
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      kicker: d.kicker,
      lede: d.lede,
      credit: d.credit,
      physical: d.physical,
      landmark: d.landmark
        ? {
            label: d.landmark.label,
            lat: d.landmark.lat,
            lon: d.landmark.lon,
            blurb: d.landmark.blurb,
          }
        : null,
      missions: (d.missions || []).slice(0, 4).map((m) => ({
        name: m.name,
        year: m.year,
        note: m.note,
      })),
      researchNotes: (d.researchNotes || []).slice(0, 3),
      folklore: d.folklore || '',
      carlFocus: d.carlFocus || '',
    };
  }

  function liveSkySnippet(bodyId) {
    const Engine = window.CelestialEngine;
    const Sky = window.FunHomeSky;
    if (!Engine || !Sky) return {};
    const obs = Sky.DEFAULT_OBSERVER;
    const date = new Date();
    if (bodyId === 'earth') {
      return {
        observerLabel: obs.label,
        lat: obs.lat,
        lon: obs.lon,
        dateLocal: date.toLocaleString(),
        caption: 'Visitor is on Earth — open the dome for tonight\'s sky.',
      };
    }
    try {
      const body = Engine.bodyAltAz(bodyId, date, obs);
      if (!body) return { dateLocal: date.toLocaleString(), observerLabel: obs.label };
      return {
        observerLabel: obs.label,
        lat: obs.lat,
        lon: obs.lon,
        dateLocal: date.toLocaleString(),
        selection: {
          type: 'planet',
          id: body.id,
          name: body.name,
          alt: body.alt,
          az: body.az,
        },
        planets: [{ name: body.name, alt: Math.round(body.alt), az: Math.round(body.az) }],
        caption: body.name + ' from ' + (obs.label || 'default observer'),
      };
    } catch (_) {
      return { dateLocal: date.toLocaleString() };
    }
  }

  /** Extra named sites for the interactive surface map (beyond dossier landmark). */
  const EXTRA_SITES = {
    mercury: [
      { label: 'Caloris Basin', lat: 30.5, lon: -170.4, zoom: 2.15, blurb: 'Giant impact basin.' },
      { label: 'Mercury north pole', lat: 85, lon: 0, zoom: 2.0, blurb: 'Permanently shadowed ice.' },
    ],
    venus: [
      { label: 'Maxwell Montes', lat: 65.2, lon: 3.0, zoom: 2.2, blurb: 'Highest Venusian range.' },
      { label: 'Aphrodite Terra', lat: -5, lon: 100, zoom: 1.7, blurb: 'Vast highland region.' },
    ],
    earth: [
      { label: 'Hampton Falls, NH', lat: 42.898, lon: -70.864, zoom: 2.15, blurb: 'Default sky desk.' },
      { label: 'Pacific basin', lat: 0, lon: -150, zoom: 1.5, blurb: 'Largest ocean basin.' },
    ],
    moon: [
      { label: 'Lane crater', lat: -9.5, lon: 132.36, zoom: 2.35, blurb: 'Far-side crater · J. H. Lane.' },
      { label: 'Tycho', lat: -43.3, lon: -11.2, zoom: 2.2, blurb: 'Bright rayed crater.' },
      { label: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4, zoom: 2.0, blurb: 'Apollo 11 landing region.' },
    ],
    mars: [
      { label: 'Olympus Mons', lat: 18.65, lon: -133.8, zoom: 2.2, blurb: 'Tallest known volcano.' },
      { label: 'Valles Marineris', lat: -14, lon: -59, zoom: 1.75, blurb: 'Vast canyon system.' },
      { label: 'Jezero crater', lat: 18.4, lon: 77.5, zoom: 2.35, blurb: 'Perseverance landing site.' },
    ],
    jupiter: [
      { label: 'Great Red Spot', lat: -22, lon: 106, zoom: 2.05, blurb: 'Persistent anticyclone.' },
      { label: 'Equatorial zone', lat: 0, lon: 0, zoom: 1.6, blurb: 'Fast belts and zones.' },
    ],
    saturn: [
      { label: 'Ring plane · Cassini gap', lat: 0, lon: 0, zoom: 1.55, blurb: 'A–B ring division.' },
      { label: 'North pole hexagon', lat: 78, lon: 0, zoom: 2.0, blurb: 'Polar jet stream pattern.' },
    ],
    uranus: [
      { label: 'Equator · ring plane', lat: 0, lon: 0, zoom: 1.85, blurb: 'Sideways ice giant.' },
      { label: 'South pole', lat: -80, lon: 0, zoom: 1.9, blurb: 'Extreme seasonal sun.' },
    ],
    neptune: [
      { label: 'Great Dark Spot · Voyager', lat: -22, lon: 60, zoom: 2.05, blurb: '1989 storm complex.' },
      { label: 'South pole', lat: -70, lon: 0, zoom: 1.9, blurb: 'Active polar region.' },
    ],
    pluto: [
      { label: 'Sputnik Planitia', lat: 18, lon: 178, zoom: 2.2, blurb: 'Heart-shaped nitrogen plain.' },
      { label: 'Tenzing Montes', lat: -10, lon: 180, zoom: 2.15, blurb: 'Water-ice mountains.' },
    ],
  };

  function sitesFor(dossier) {
    const extras = EXTRA_SITES[dossier.id] || [];
    const out = [];
    const seen = new Set();
    function push(site) {
      if (!site || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) return;
      const key = site.label || site.lat + ',' + site.lon;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        label: site.label || 'Site',
        lat: site.lat,
        lon: site.lon,
        zoom: site.zoom || 2.1,
        blurb: site.blurb || '',
      });
    }
    if (dossier.landmark) push(dossier.landmark);
    extras.forEach(push);
    return out;
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function fmtCoord(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(1) + '°' + ns + ' · ' + Math.abs(lon).toFixed(1) + '°' + ew;
  }

  /** Equirectangular: sheet x/y → lat/lon (lon −180…180, lat −90…90). */
  function sheetXyToLatLon(x, y, sheetW, sheetH) {
    const lon = (x / sheetW) * 360 - 180;
    const lat = 90 - (y / sheetH) * 180;
    return { lat: clamp(lat, -90, 90), lon: ((lon + 540) % 360) - 180 };
  }

  function latLonToSheetPct(lat, lon) {
    const u = ((Number(lon) + 180) / 360 + 1) % 1;
    const v = (90 - Number(lat)) / 180;
    return {
      left: (u < 0 ? u + 1 : u) * 100,
      top: clamp(v, 0, 1) * 100,
    };
  }

  function mountInteractiveMap(dossier, globeApi) {
    const map = document.getElementById('pwMap');
    const scroller = document.getElementById('pwMapScroller');
    const sheet = document.getElementById('pwMapSheet');
    const tex = document.getElementById('pwMapTex');
    const pins = document.getElementById('pwMapPins');
    const cross = document.getElementById('pwMapCross');
    const readout = document.getElementById('pwMapReadout');
    const sitesEl = document.getElementById('pwMapSites');
    const lead = document.getElementById('pwMapLead');
    if (!map || !scroller || !sheet || !tex) return null;

    const sites = sitesFor(dossier);
    const name = dossier.name || dossier.id;
    if (lead) {
      lead.textContent = 'Drag to pan · click to aim the ' + name + ' globe';
    }
    tex.src = dossier.texture || '';
    tex.alt = name + ' surface map';

    let activeLabel = sites[0] ? sites[0].label : '';
    let panX = 0;
    let dragging = false;
    let dragMoved = false;
    let startClientX = 0;
    let startPanX = 0;
    let sheetW = 0;
    let sheetH = 0;

    function maxPan() {
      return Math.max(0, sheet.offsetWidth - scroller.clientWidth);
    }

    function applyPan() {
      panX = clamp(panX, -maxPan(), 0);
      sheet.style.transform = 'translateX(' + panX + 'px)';
    }

    function measure() {
      sheetW = sheet.offsetWidth || 1;
      sheetH = sheet.offsetHeight || 1;
      applyPan();
    }

    function setReadout(text) {
      if (readout) readout.textContent = text || '';
    }

    function setCross(lat, lon) {
      if (!cross) return;
      const pct = latLonToSheetPct(lat, lon);
      cross.hidden = false;
      cross.style.left = pct.left + '%';
      cross.style.top = pct.top + '%';
    }

    function flyTo(lat, lon, zoom, label) {
      if (globeApi && typeof globeApi.lookAt === 'function') {
        globeApi.lookAt(lat, lon, zoom || 2.1);
      }
      setCross(lat, lon);
      activeLabel = label || '';
      setReadout(
        (label ? label + ' · ' : 'Aim · ') + fmtCoord(lat, lon)
      );
      const status = document.getElementById('pwStatus');
      if (status) {
        status.textContent = label ? 'Looking at ' + label : 'Map aim · ' + fmtCoord(lat, lon);
      }
      if (sitesEl) {
        sitesEl.querySelectorAll('.pw-btn').forEach((btn) => {
          btn.classList.toggle('is-active', btn.getAttribute('data-label') === activeLabel);
        });
      }
      if (pins) {
        pins.querySelectorAll('.pw-map__pin').forEach((pin) => {
          pin.classList.toggle('is-active', pin.getAttribute('data-label') === activeLabel);
        });
      }
      // Center map on target longitude
      const pct = latLonToSheetPct(lat, lon);
      const targetX = (pct.left / 100) * sheetW - scroller.clientWidth / 2;
      panX = -clamp(targetX, 0, maxPan());
      applyPan();
    }

    function renderPins() {
      if (!pins) return;
      pins.replaceChildren();
      sites.forEach((site) => {
        const pct = latLonToSheetPct(site.lat, site.lon);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-map__pin' + (site.label === activeLabel ? ' is-active' : '');
        btn.style.left = pct.left + '%';
        btn.style.top = pct.top + '%';
        btn.setAttribute('data-label', site.label);
        btn.title = site.label + (site.blurb ? ' — ' + site.blurb : '');
        btn.setAttribute('aria-label', 'Fly globe to ' + site.label);
        btn.innerHTML = '<i class="bi bi-geo-alt-fill" aria-hidden="true"></i><span>' + site.label + '</span>';
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          flyTo(site.lat, site.lon, site.zoom, site.label);
        });
        pins.appendChild(btn);
      });
    }

    function renderSiteButtons() {
      if (!sitesEl) return;
      sitesEl.replaceChildren();
      sites.forEach((site) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-btn' + (site.label === activeLabel ? ' is-active' : '');
        btn.setAttribute('data-label', site.label);
        btn.textContent = site.label;
        btn.title = site.blurb || site.label;
        btn.addEventListener('click', () => flyTo(site.lat, site.lon, site.zoom, site.label));
        sitesEl.appendChild(btn);
      });
    }

    function pointerToLatLon(clientX, clientY) {
      const rect = sheet.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return sheetXyToLatLon(x, y, rect.width, rect.height);
    }

    map.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.pw-map__pin')) return;
      dragging = true;
      dragMoved = false;
      startClientX = ev.clientX;
      startPanX = panX;
      map.classList.add('is-dragging');
      map.setPointerCapture?.(ev.pointerId);
    });

    map.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startClientX;
      if (Math.abs(dx) > 4) dragMoved = true;
      panX = startPanX + dx;
      applyPan();
      const ll = pointerToLatLon(ev.clientX, ev.clientY);
      setReadout('Pan · ' + fmtCoord(ll.lat, ll.lon));
    });

    function endDrag(ev) {
      if (!dragging) return;
      dragging = false;
      map.classList.remove('is-dragging');
      try {
        map.releasePointerCapture?.(ev.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (!dragMoved) {
        const ll = pointerToLatLon(ev.clientX, ev.clientY);
        flyTo(ll.lat, ll.lon, 2.15, '');
      }
    }

    map.addEventListener('pointerup', endDrag);
    map.addEventListener('pointercancel', endDrag);

    map.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 80 : 40;
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        panX += step;
        applyPan();
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        panX -= step;
        applyPan();
      }
    });

    window.addEventListener('resize', measure);
    tex.addEventListener('load', () => {
      measure();
      renderPins();
      if (sites[0]) flyTo(sites[0].lat, sites[0].lon, sites[0].zoom, sites[0].label);
    });
    if (tex.complete) {
      measure();
    }
    renderPins();
    renderSiteButtons();
    if (sites[0]) {
      // Defer until layout so pan centers correctly
      requestAnimationFrame(() => {
        measure();
        flyTo(sites[0].lat, sites[0].lon, sites[0].zoom, sites[0].label);
      });
    } else {
      setReadout('Click the map to aim the globe');
    }

    return { flyTo, sites };
  }

  function fillDesk(d) {
    document.title = (d.name || 'Planet') + ' · Planet world | DevConnect Labs';
    const kicker = document.getElementById('pwKicker');
    const title = document.getElementById('pwTitle');
    const lede = document.getElementById('pwLede');
    const credit = document.getElementById('pwCredit');
    const fallback = document.getElementById('pwFallback');
    const canvas = document.getElementById('pwGlobeCanvas');

    if (kicker) kicker.textContent = d.kicker || 'Planet world';
    if (title) title.textContent = d.name || d.id;
    if (lede) lede.textContent = d.lede || '';
    if (credit) credit.textContent = d.credit || '';
    if (fallback && d.texture) {
      fallback.src = d.texture;
      fallback.alt = '';
      fallback.hidden = false;
    }
    if (canvas) canvas.setAttribute('aria-label', (d.name || 'Planet') + ' globe');

    const facts = document.getElementById('pwFacts');
    if (facts && d.physical) {
      const p = d.physical;
      facts.innerHTML =
        '<div><dt>Radius</dt><dd>' +
        fmtNum(p.radiusKm, 0) +
        ' km</dd></div>' +
        '<div><dt>Day</dt><dd>' +
        dayLabel(p.dayHours) +
        '</dd></div>' +
        '<div><dt>Year</dt><dd>' +
        yearLabel(p.yearDays) +
        '</dd></div>' +
        '<div><dt>Moons</dt><dd>' +
        fmtNum(p.moons, 0) +
        '</dd></div>' +
        '<div><dt>Axial tilt</dt><dd>' +
        fmtNum(p.tiltDeg, 1) +
        '°</dd></div>';
    }

    const landmarkEl = document.getElementById('pwLandmark');
    const landmarkActions = document.getElementById('pwLandmarkActions');
    if (landmarkEl && d.landmark) {
      landmarkEl.textContent =
        (d.landmark.label || 'Landmark') +
        (d.landmark.blurb ? ' — ' + d.landmark.blurb : '');
    }
    if (landmarkActions) {
      landmarkActions.replaceChildren();
      if (d.landmark && d.landmark.href) {
        const a = document.createElement('a');
        a.className = 'pw-btn';
        a.href = d.landmark.href;
        a.textContent = d.landmark.linkLabel || 'Related page';
        landmarkActions.appendChild(a);
        landmarkActions.hidden = false;
      } else {
        landmarkActions.hidden = true;
      }
    }

    const missions = document.getElementById('pwMissions');
    if (missions) {
      missions.replaceChildren();
      (d.missions || []).forEach((m) => {
        const li = document.createElement('li');
        const href = String(m.href || '');
        const name =
          href.startsWith('/') && !href.startsWith('//')
            ? '<a href="' + href + '">' + (m.name || 'Mission') + '</a>'
            : m.name || 'Mission';
        li.innerHTML =
          '<strong>' +
          name +
          '</strong> (' +
          (m.year || '?') +
          ') — ' +
          (m.note || '');
        missions.appendChild(li);
      });
    }

    const notes = document.getElementById('pwNotes');
    if (notes) {
      notes.replaceChildren();
      (d.researchNotes || []).forEach((text) => {
        const p = document.createElement('p');
        p.textContent = text;
        notes.appendChild(p);
      });
    }

    const folklore = document.getElementById('pwFolklore');
    if (folklore) {
      if (d.folklore) {
        folklore.hidden = false;
        folklore.textContent = 'Folklore note: ' + d.folklore;
      } else {
        folklore.hidden = true;
      }
    }

    const openSky = document.getElementById('pwOpenSky');
    if (openSky) {
      openSky.href = skyUrl(d.id);
      openSky.setAttribute('aria-label', 'Open planetarium focused on ' + (d.name || d.id));
    }

    const idx = BODY_ORDER.indexOf(d.id);
    const prev = document.getElementById('pwPrev');
    const next = document.getElementById('pwNext');
    if (prev) {
      const pid = BODY_ORDER[(idx - 1 + BODY_ORDER.length) % BODY_ORDER.length];
      prev.href = worldUrl(pid);
      prev.setAttribute('aria-label', 'Previous world');
    }
    if (next) {
      const nid = BODY_ORDER[(idx + 1) % BODY_ORDER.length];
      next.href = worldUrl(nid);
      next.setAttribute('aria-label', 'Next world');
    }

    const carlLead = document.getElementById('pwCarlLead');
    if (carlLead) {
      carlLead.textContent =
        'Ask Carl about ' + (d.name || 'this world') + ' — voice is on by default.';
    }
  }

  async function mountGlobe(bodyId, landmark) {
    const status = document.getElementById('pwStatus');
    const canvas = document.getElementById('pwGlobeCanvas');
    const Globe = window.WebGpuGlobe;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canvas || !Globe || !window.WebGpuRuntime) {
      if (status) status.textContent = 'Globe texture shown — WebGPU unavailable.';
      return null;
    }

    try {
      if (typeof Globe.ensureHeroSync === 'function') {
        const sync = Globe.ensureHeroSync();
        if (typeof Globe.applySunFromDate === 'function') {
          Globe.applySunFromDate(new Date());
        } else if (Globe.DEFAULT_SUN_DIR && sync) {
          sync.sunDir = { ...Globe.DEFAULT_SUN_DIR };
        }
      }
      const mounted = await Globe.mount({
        canvas,
        body: bodyId,
        prefersReducedMotion: reduced,
      });
      if (!mounted) {
        if (status) status.textContent = 'Using static NASA texture (WebGPU mount skipped).';
        return null;
      }
      if (typeof mounted.resize === 'function') mounted.resize();
      window.addEventListener('resize', () => mounted.resize?.());
      if (landmark && typeof mounted.lookAt === 'function') {
        mounted.lookAt(landmark.lat, landmark.lon, landmark.zoom || 2.2);
      }
      if (status) {
        status.textContent = landmark?.label
          ? 'Looking at ' + landmark.label
          : 'Globe ready';
      }
      const fallback = document.getElementById('pwFallback');
      if (fallback) fallback.hidden = true;
      return mounted;
    } catch (err) {
      console.warn('World globe failed', err);
      if (status) status.textContent = 'Static NASA texture (globe failed to start).';
      return null;
    }
  }

  async function init() {
    const bodyId = resolveBodyId();
    const status = document.getElementById('pwStatus');
    if (status) status.textContent = 'Loading dossier…';

    let dossier;
    try {
      const res = await fetch(
        '/data/planetarium/worlds/' + encodeURIComponent(bodyId) + '.json',
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      dossier = await res.json();
    } catch (err) {
      console.warn(err);
      if (status) status.textContent = 'Could not load world dossier.';
      return;
    }

    fillDesk(dossier);

    window.__PLANETARIUM_WORLD = {
      id: dossier.id,
      name: dossier.name,
      dossier: dossierExcerpt(dossier),
      getSkyContext() {
        return {
          ...liveSkySnippet(dossier.id),
          world: dossierExcerpt(dossier),
          worldId: dossier.id,
        };
      },
    };

    const globeApi = await mountGlobe(dossier.id, dossier.landmark);
    mountInteractiveMap(dossier, globeApi);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
