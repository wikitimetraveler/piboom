/**
 * Planetarium extras — compass, catalog search, ISS, events, deep sky
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  let catalogIndex = null;
  let compassHandler = null;

  function fmtPassTime(iso) {
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

  function fmtDuration(sec) {
    const m = Math.round(Number(sec) / 60);
    return m + ' min';
  }

  async function loadCatalogIndex() {
    if (catalogIndex) return catalogIndex;
    const res = await fetch('/data/planetarium/catalog-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Catalog unavailable');
    catalogIndex = await res.json();
    return catalogIndex;
  }

  function readCompassHeading(event) {
    if (Number.isFinite(event.webkitCompassHeading)) return event.webkitCompassHeading;
    if (Number.isFinite(event.alpha)) return (360 - event.alpha + 360) % 360;
    return null;
  }

  async function requestCompassPermission() {
    const DO = root.DeviceOrientationEvent;
    if (DO && typeof DO.requestPermission === 'function') {
      const result = await DO.requestPermission();
      if (result !== 'granted') throw new Error('Compass permission denied');
    }
  }

  function stopCompass() {
    if (compassHandler) {
      root.removeEventListener('deviceorientation', compassHandler, true);
      compassHandler = null;
    }
    root.Planetarium?.enableCompass?.(false);
    const btn = document.getElementById('planCompassToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = 'Compass / AR facing';
    }
    const status = document.getElementById('planCompassStatus');
    if (status) status.textContent = '';
  }

  async function startCompass() {
    await requestCompassPermission();
    stopCompass();
    root.Planetarium?.enableCompass?.(true);
    compassHandler = (e) => {
      const heading = readCompassHeading(e);
      if (heading == null) return;
      root.Planetarium?.setCompassAz?.(heading);
      const status = document.getElementById('planCompassStatus');
      if (status) status.textContent = 'Facing ' + Math.round(heading) + '° — move phone to pan sky';
    };
    root.addEventListener('deviceorientation', compassHandler, true);
    const btn = document.getElementById('planCompassToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = 'Stop compass';
    }
  }

  async function toggleCompass() {
    const btn = document.getElementById('planCompassToggle');
    const on = btn?.getAttribute('aria-pressed') === 'true';
    if (on) {
      stopCompass();
      return;
    }
    try {
      await startCompass();
    } catch (err) {
      const status = document.getElementById('planCompassStatus');
      if (status) status.textContent = err.message || 'Compass unavailable on this device';
    }
  }

  function positionCatalogItem(item) {
    const P = root.Planetarium;
    if (!P?.objectAltAz || !item) return null;
    return P.objectAltAz(item.ra, item.dec);
  }

  function renderCatalogResults(items, host) {
    if (!host) return;
    host.replaceChildren();
    if (!items.length) {
      host.innerHTML = '<li class="plan-empty">No matches</li>';
      return;
    }
    items.forEach((item) => {
      const pos = positionCatalogItem(item);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-catalog-hit';
      const alt = pos ? Math.round(pos.alt) + '° alt' : 'below horizon';
      btn.innerHTML =
        '<strong>' +
        item.id +
        '</strong> ' +
        item.name +
        (item.nick ? ' <span class="text-muted">· ' + item.nick + '</span>' : '') +
        '<br><small>' +
        alt +
        (pos && pos.alt > 0 ? ' · ' + Math.round(pos.az) + '° az' : '') +
        '</small>';
      btn.addEventListener('click', () => {
        if (pos && pos.alt > 0) root.Planetarium?.centerOnAz?.(pos.az);
        if (typeof root.Planetarium?.selectSkyObject === 'function') {
          root.Planetarium.selectSkyObject(
            {
              type: 'catalog',
              id: item.id,
              name: item.name,
              alt: pos ? pos.alt : null,
              az: pos ? pos.az : null,
              ra: item.ra,
              dec: item.dec,
            },
            { center: false }
          );
        }
        stopCompass();
        const status = document.getElementById('planStatus');
        if (status) status.textContent = 'Centered on ' + item.name;
      });
      li.appendChild(btn);
      host.appendChild(li);
    });
  }

  let searchTimer = null;
  async function onCatalogSearch(q) {
    const host = document.getElementById('planCatalogHits');
    const query = String(q || '').trim();
    if (!query) {
      if (host) host.replaceChildren();
      return;
    }
    try {
      const res = await fetch('/api/planetarium/catalog/search?q=' + encodeURIComponent(query));
      const data = await res.json();
      renderCatalogResults(data.results || [], host);
    } catch (_) {
      const index = await loadCatalogIndex();
      const lower = query.toLowerCase();
      const hits = index.filter((item) => {
        const hay = [item.id, item.name, item.nick, item.hip].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(lower);
      });
      renderCatalogResults(hits.slice(0, 12), host);
    }
  }

  function renderDeepSky(items, host, dark) {
    if (!host) return;
    host.replaceChildren();
    if (!dark) {
      host.innerHTML = '<li class="plan-empty">Wait for twilight — deep sky needs a darker sky.</li>';
      return;
    }
    if (!items.length) {
      host.innerHTML = '<li class="plan-empty">No Messier targets above 15° right now.</li>';
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<button type="button" class="plan-deepsky-hit" data-az="' +
        item.az +
        '"><strong>' +
        item.id +
        '</strong> ' +
        item.name +
        '<br><small>' +
        item.alt +
        '° alt · mag ' +
        item.mag +
        '</small></button>';
      li.querySelector('button')?.addEventListener('click', () => {
        root.Planetarium?.centerOnAz?.(item.az);
        if (typeof root.Planetarium?.selectSkyObject === 'function') {
          root.Planetarium.selectSkyObject(
            {
              type: 'deepsky',
              id: item.id,
              name: item.name,
              alt: item.alt,
              az: item.az,
              ra: item.ra,
              dec: item.dec,
            },
            { center: false }
          );
        }
      });
      host.appendChild(li);
    });
  }

  async function refreshDeepSky() {
    const host = document.getElementById('planDeepSky');
    const live = root.Planetarium?._live;
    if (!host || !live?.getState) return;
    const state = live.getState();
    let sunAlt = -20;
    if (root.CelestialEngine?.sunAltAz) {
      sunAlt = root.CelestialEngine.sunAltAz(state.date, state.observer).alt;
    } else if (root.FunHomeSky) {
      const sky = root.FunHomeSky.projectSky(state.date, state.observer, { forceTime: true });
      sunAlt = sky.sunAlt;
    }
    const index = await loadCatalogIndex();
    const messier = index.filter((x) => x.type === 'messier');
    const up = messier
      .map((item) => {
        const pos = positionCatalogItem(item);
        if (!pos || pos.alt < 15) return null;
        return {
          id: item.id,
          name: item.name,
          mag: item.mag,
          alt: Math.round(pos.alt),
          az: Math.round(pos.az),
          ra: item.ra,
          dec: item.dec,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.alt - a.alt)
      .slice(0, 8);
    renderDeepSky(up, host, root.Planetarium.isDarkSky(sunAlt));
    live.setDomeMarkers?.(
      up.map((m) => ({
        type: 'deepsky',
        id: m.id,
        name: m.name,
        alt: m.alt,
        az: m.az,
        ra: m.ra,
        dec: m.dec,
        color: 0xa0c8ff,
      }))
    );
  }

  async function refreshIss() {
    const host = document.getElementById('planIssList');
    const live = root.Planetarium?._live;
    if (!host || !live?.getState) return;
    const st = live.getState();
    const obs = st.observer;
    host.innerHTML = '<li class="plan-empty">Loading ISS passes…</li>';
    try {
      const res = await fetch(
        '/api/planetarium/iss-passes?lat=' +
          encodeURIComponent(obs.lat) +
          '&lon=' +
          encodeURIComponent(obs.lon) +
          '&at=' +
          encodeURIComponent(st.date.toISOString())
      );
      const data = await res.json().catch(() => ({}));
      host.replaceChildren();
      if (!res.ok || data.success === false) {
        host.innerHTML =
          '<li class="plan-empty">' +
          (data.error
            ? 'ISS feed unavailable — ' + String(data.error).slice(0, 120)
            : 'ISS feed unavailable — try again later.') +
          '</li>';
        live.setIssPos?.(null);
        return;
      }
      if (data.position && Number.isFinite(data.position.alt)) {
        live.setIssPos?.({ alt: data.position.alt, az: data.position.az });
      } else {
        live.setIssPos?.(null);
      }
      if (!data.passes?.length) {
        host.innerHTML =
          '<li class="plan-empty">No ISS passes predicted for this location in the next couple of days. Check back after changing location or date.</li>';
        return;
      }
      data.passes.slice(0, 4).forEach((pass) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'plan-iss-hit';
        btn.innerHTML =
          '<strong>' +
          fmtPassTime(pass.start) +
          '</strong><br><small>' +
          fmtDuration(pass.duration) +
          (pass.maxElev != null ? ' · max ' + Math.round(pass.maxElev) + '°' : '') +
          '</small>';
        btn.addEventListener('click', () => {
          live.setDate?.(new Date(pass.start));
          const status = document.getElementById('planStatus');
          if (status) status.textContent = 'Sky time set to ISS pass start';
        });
        li.appendChild(btn);
        host.appendChild(li);
      });
    } catch (_) {
      host.innerHTML =
        '<li class="plan-empty">ISS feed unavailable — network or upstream error. Try again later.</li>';
      live.setIssPos?.(null);
    }
  }

  async function refreshEvents() {
    const host = document.getElementById('planEventsList');
    const live = root.Planetarium?._live;
    if (!host || !live?.getState) return;
    const from = live.getState().date.toISOString().slice(0, 10);
    host.innerHTML = '<li class="plan-empty">Loading events…</li>';
    try {
      const res = await fetch('/api/planetarium/events?from=' + encodeURIComponent(from));
      const data = await res.json().catch(() => ({}));
      host.replaceChildren();
      if (!res.ok || data.success === false) {
        host.innerHTML =
          '<li class="plan-empty">' +
          (data.error ? 'Events unavailable — ' + String(data.error).slice(0, 120) : 'Events unavailable.') +
          '</li>';
        return;
      }
      const rows = [];
      (data.events || []).forEach((ev) => {
        rows.push({ when: ev.date, title: ev.title, note: ev.note, kind: ev.type });
      });
      (data.meteorShowers || []).slice(0, 3).forEach((sh) => {
        rows.push({
          when: sh.peakDate,
          title: sh.name + ' peak',
          note: 'ZHR ~' + sh.zhr + ' · ' + sh.radiant,
          kind: 'meteor',
          radiant: sh.radiant,
          ra: sh.ra,
          dec: sh.dec,
        });
      });
      rows.sort((a, b) => String(a.when).localeCompare(String(b.when)));
      if (!rows.length) {
        host.innerHTML =
          '<li class="plan-empty">No eclipses, conjunctions, or meteor peaks near ' +
          from +
          '. Try <strong>Tonight 9 PM</strong> or pick another date.</li>';
        return;
      }
      rows.slice(0, 8).forEach((row) => {
        const li = document.createElement('li');
        const kind = row.kind;
        const title = row.title;
        li.innerHTML =
          '<span class="plan-event-kind plan-event-kind--' +
          kind +
          '">' +
          kind +
          '</span> <strong>' +
          row.when +
          '</strong> ' +
          title +
          '<br><small>' +
          (row.note || '') +
          '</small>';
        if (kind === 'meteor' && Number.isFinite(row.ra) && Number.isFinite(row.dec)) {
          li.style.cursor = 'pointer';
          li.title = 'Show radiant on dome';
          li.addEventListener('click', () => {
            const pos = root.Planetarium?.objectAltAz?.(row.ra, row.dec);
            root.Planetarium?.selectSkyObject?.(
              {
                type: 'radiant',
                id: row.title,
                name: row.title + ' radiant',
                alt: pos?.alt ?? null,
                az: pos?.az ?? null,
                ra: row.ra,
                dec: row.dec,
              },
              { center: true }
            );
          });
        }
        host.appendChild(li);
      });
    } catch (_) {
      host.innerHTML = '<li class="plan-empty">Events unavailable — try again later.</li>';
    }
  }

  function refreshAllPanels() {
    refreshIss();
    refreshEvents();
    refreshDeepSky();
  }

  function hookLiveRefresh() {
    const live = root.Planetarium?._live;
    if (!live?.refresh || live.__extrasHooked) return false;
    const orig = live.refresh;
    live.refresh = function (fromControls) {
      orig(fromControls);
      refreshAllPanels();
    };
    live.__extrasHooked = true;
    return true;
  }

  function setDeskTab(id) {
    const next = id === 'tonight' || id === 'discover' ? id : 'guide';
    document.querySelectorAll('[data-plan-tab]').forEach((tab) => {
      const on = tab.getAttribute('data-plan-tab') === next;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-plan-pane]').forEach((pane) => {
      const on = pane.getAttribute('data-plan-pane') === next;
      pane.classList.toggle('is-active', on);
      pane.hidden = !on;
    });
    try {
      sessionStorage.setItem('planDeskTab', next);
    } catch (_) {
      /* private mode */
    }
  }

  function setDeskOpen(open) {
    const sidebar = document.getElementById('planSidebar');
    const backdrop = document.getElementById('planSidebarBackdrop');
    const dock = document.getElementById('planDockDesk');
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', !!open);
    document.body.classList.toggle('plan-desk-open', !!open);
    if (backdrop) backdrop.hidden = !open;
    if (dock) dock.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncDockPlay() {
    const src = document.getElementById('planPlay');
    const dock = document.getElementById('planDockPlay');
    if (!src || !dock) return;
    const on = src.getAttribute('aria-pressed') === 'true';
    dock.setAttribute('aria-pressed', on ? 'true' : 'false');
    dock.innerHTML = on
      ? '<i class="bi bi-pause-fill" aria-hidden="true"></i>Pause'
      : '<i class="bi bi-play-fill" aria-hidden="true"></i>Play';
  }

  function dismissHint() {
    const hint = document.getElementById('planHint');
    if (!hint || hint.classList.contains('is-gone')) return;
    hint.classList.add('is-gone');
    try {
      sessionStorage.setItem('planHintSeen', '1');
    } catch (_) {
      /* private mode */
    }
  }

  function bindDeskChrome() {
    document.querySelectorAll('[data-plan-tab]').forEach((tab) => {
      tab.addEventListener('click', () => setDeskTab(tab.getAttribute('data-plan-tab')));
    });
    try {
      const saved = sessionStorage.getItem('planDeskTab');
      if (saved) setDeskTab(saved);
    } catch (_) {
      /* private mode */
    }

    document.getElementById('planDockDesk')?.addEventListener('click', () => {
      const sidebar = document.getElementById('planSidebar');
      setDeskOpen(!sidebar?.classList.contains('is-open'));
    });
    document.getElementById('planSidebarClose')?.addEventListener('click', () => setDeskOpen(false));
    document.getElementById('planSidebarBackdrop')?.addEventListener('click', () => setDeskOpen(false));
    document.getElementById('planDockCarl')?.addEventListener('click', () => {
      document.getElementById('planAskCarl')?.click();
    });
    document.getElementById('planDockPlay')?.addEventListener('click', () => {
      document.getElementById('planPlay')?.click();
      setTimeout(syncDockPlay, 0);
    });
    document.getElementById('planPlay')?.addEventListener('click', () => {
      setTimeout(syncDockPlay, 0);
    });
    document.getElementById('planPickAsk')?.addEventListener('click', () => {
      const sel = root.Planetarium?._live?.getState?.()?.selection;
      const name = sel?.name;
      if (typeof root.PlanetariumAskCarl === 'function') {
        root.PlanetariumAskCarl(name ? 'Tell me about ' + name : null);
      } else {
        document.getElementById('planAskCarl')?.click();
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') setDeskOpen(false);
      if (ev.key === '/' && !/input|textarea|select/i.test(ev.target.tagName)) {
        ev.preventDefault();
        setDeskTab('discover');
        if (window.matchMedia('(max-width: 991.98px)').matches) setDeskOpen(true);
        document.getElementById('planCatalogSearch')?.focus();
      }
    });

    try {
      if (sessionStorage.getItem('planHintSeen')) dismissHint();
    } catch (_) {
      /* private mode */
    }
    ['pointerdown', 'wheel'].forEach((ev) => {
      document.getElementById('planSkyGpu')?.addEventListener(ev, dismissHint, { once: true, passive: true });
    });
    setTimeout(dismissHint, 7000);
  }

  function initExtras() {
    bindDeskChrome();
    document.getElementById('planCompassToggle')?.addEventListener('click', () => {
      toggleCompass().catch(() => {});
    });

    const search = document.getElementById('planCatalogSearch');
    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => onCatalogSearch(search.value), 220);
    });

    let tries = 0;
    const wait = () => {
      if (hookLiveRefresh()) {
        refreshAllPanels();
        return;
      }
      tries += 1;
      if (tries < 40) setTimeout(wait, 100);
    };
    wait();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initExtras, 50));
  } else {
    setTimeout(initExtras, 50);
  }

  root.PlanetariumExtras = { refreshAllPanels, stopCompass };
})(typeof globalThis !== 'undefined' ? globalThis : window);
