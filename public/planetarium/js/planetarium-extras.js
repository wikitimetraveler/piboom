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
      });
      host.appendChild(li);
    });
  }

  async function refreshDeepSky() {
    const host = document.getElementById('planDeepSky');
    const live = root.Planetarium?._live;
    if (!host || !live?.getState) return;
    const state = live.getState();
    const Sky = root.FunHomeSky;
    let sunAlt = -20;
    if (Sky) {
      const sky = Sky.projectSky(state.date, state.observer, { forceTime: true });
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
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.alt - a.alt)
      .slice(0, 8);
    renderDeepSky(up, host, root.Planetarium.isDarkSky(sunAlt));
  }

  async function refreshIss() {
    const host = document.getElementById('planIssList');
    const live = root.Planetarium?._live;
    if (!host || !live?.getState) return;
    const obs = live.getState().observer;
    host.innerHTML = '<li class="plan-empty">Loading ISS passes…</li>';
    try {
      const res = await fetch(
        '/api/planetarium/iss-passes?lat=' +
          encodeURIComponent(obs.lat) +
          '&lon=' +
          encodeURIComponent(obs.lon)
      );
      const data = await res.json();
      host.replaceChildren();
      if (!data.success || !data.passes?.length) {
        host.innerHTML = '<li class="plan-empty">No ISS passes in the next ~2 weeks.</li>';
        return;
      }
      data.passes.slice(0, 4).forEach((pass) => {
        const li = document.createElement('li');
        li.innerHTML =
          '<strong>' +
          fmtPassTime(pass.start) +
          '</strong><br><small>' +
          fmtDuration(pass.duration) +
          (pass.maxElev != null ? ' · max ' + Math.round(pass.maxElev) + '°' : '') +
          '</small>';
        host.appendChild(li);
      });
    } catch (_) {
      host.innerHTML = '<li class="plan-empty">ISS feed unavailable — try again later.</li>';
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
      const data = await res.json();
      host.replaceChildren();
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
        });
      });
      rows.sort((a, b) => String(a.when).localeCompare(String(b.when)));
      if (!rows.length) {
        host.innerHTML = '<li class="plan-empty">No upcoming events in range.</li>';
        return;
      }
      rows.slice(0, 8).forEach((row) => {
        const li = document.createElement('li');
        li.innerHTML =
          '<span class="plan-event-kind plan-event-kind--' +
          row.kind +
          '">' +
          row.kind +
          '</span> <strong>' +
          row.when +
          '</strong> ' +
          row.title +
          '<br><small>' +
          row.note +
          '</small>';
        host.appendChild(li);
      });
    } catch (_) {
      host.innerHTML = '<li class="plan-empty">Events unavailable.</li>';
    }
  }

  function refreshAllPanels() {
    refreshIss();
    refreshEvents();
    refreshDeepSky();
  }

  function initExtras() {
    document.getElementById('planCompassToggle')?.addEventListener('click', () => {
      toggleCompass().catch(() => {});
    });

    const search = document.getElementById('planCatalogSearch');
    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => onCatalogSearch(search.value), 220);
    });

    const live = root.Planetarium?._live;
    if (live?.refresh) {
      const orig = live.refresh;
      live.refresh = function (fromControls) {
        orig(fromControls);
        refreshAllPanels();
      };
    }

    refreshAllPanels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initExtras, 50));
  } else {
    setTimeout(initExtras, 50);
  }

  root.PlanetariumExtras = { refreshAllPanels, stopCompass };
})(typeof globalThis !== 'undefined' ? globalThis : window);
