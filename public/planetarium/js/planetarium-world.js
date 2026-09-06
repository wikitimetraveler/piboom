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
        li.innerHTML =
          '<strong>' +
          (m.name || 'Mission') +
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

    await mountGlobe(dossier.id, dossier.landmark);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
