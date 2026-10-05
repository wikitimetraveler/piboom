/**
 * Next ISS arrivals (Launch Library 2) + launch-to-dock replay in the station scene.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const API = '/api/planetarium/iss-arrivals';
  const listEl = document.getElementById('stArrivalList');
  const runEl = document.getElementById('stArrivalRun');
  const stepsEl = document.getElementById('stArrivalSteps');
  const captionEl = document.getElementById('stArrivalCaption');
  const clearBtn = document.getElementById('stArrivalClear');
  const srcEl = document.getElementById('stArrivalSrc');
  if (!listEl) return;

  let arrivals = [];
  let active = null;
  let bound = false;

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isRough(row) {
    const p = String(row.netPrecision || '').toLowerCase();
    return row.status === 'TBD' || /month|quarter|year|half/.test(p);
  }

  function whenLabel(row) {
    if (!row.net) return 'Date to be announced';
    const d = new Date(row.net);
    if (Number.isNaN(d.getTime())) return 'Date to be announced';
    if (isRough(row)) {
      return 'No earlier than ' + d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function countdown(row) {
    if (!row.net || isRough(row)) return '';
    const ms = Date.parse(row.net) - Date.now();
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return 'launch window open';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `T− ${d} d ${h} h`;
    return `T− ${h} h ${m} m`;
  }

  function render() {
    if (!arrivals.length) {
      listEl.innerHTML = '<li class="st-arrivals__empty">No ISS-bound launches on the books right now.</li>';
      return;
    }
    listEl.innerHTML = arrivals
      .map((row, i) => {
        const verb = row.kind === 'berthing' ? 'Watch it berth' : 'Watch it dock';
        const tminus = countdown(row);
        return `
        <li class="st-arrival${i === 0 ? ' is-next' : ''}${active && active.id === row.id ? ' is-active' : ''}">
          <div class="st-arrival__head">
            ${i === 0 ? '<span class="st-arrival__badge">Next</span>' : ''}
            <span class="st-arrival__vehicle">${esc(row.vehicle)}</span>
            <span class="st-arrival__status" title="${esc(row.statusName)}">${esc(row.status)}</span>
          </div>
          <p class="st-arrival__name">${esc(row.name)}</p>
          <p class="st-arrival__when">${esc(whenLabel(row))}${tminus ? ` · <strong data-tminus="${i}">${esc(tminus)}</strong>` : ''}</p>
          <p class="st-arrival__meta">${esc(row.rocket)}${row.padLocation ? ' · ' + esc(row.padLocation) : ''}</p>
          <p class="st-arrival__port"><i class="bi bi-link-45deg" aria-hidden="true"></i> ${esc(row.portLabel)} · ${esc(row.mechanism)}</p>
          <button type="button" class="pw-btn${i === 0 ? ' pw-btn--primary' : ''}" data-arrival="${i}">${verb}</button>
        </li>`;
      })
      .join('');
  }

  function tickCountdowns() {
    listEl.querySelectorAll('[data-tminus]').forEach((el) => {
      const row = arrivals[Number(el.getAttribute('data-tminus'))];
      if (row) el.textContent = countdown(row);
    });
  }

  function renderSteps(evt) {
    if (!stepsEl || !active) return;
    const steps = active.kind === 'berthing'
      ? ['Approach', 'Canadarm2 grapple', 'Berth', 'Hatch open']
      : ['Approach', 'Soft capture', 'Hard capture', 'Hatch open'];
    stepsEl.innerHTML = steps
      .map((label, i) => {
        const state = evt.done || i < evt.index ? 'is-done' : i === evt.index ? 'is-on' : '';
        return `<li class="${state}">${esc(label)}</li>`;
      })
      .join('');
  }

  function onArrival(evt) {
    if (!active) return;
    renderSteps(evt);
    if (!captionEl) return;
    if (evt.done) {
      captionEl.textContent = active.kind === 'berthing'
        ? `${active.vehicle} is berthed at ${active.portLabel}. Hatch open.`
        : `${active.vehicle} is docked at ${active.portLabel}. Hatch open.`;
    } else {
      captionEl.innerHTML = `<strong>${esc(evt.label)}</strong> <span class="st-hud__plain">${esc(evt.hint)}</span>`;
    }
  }

  function scene() {
    const s = window.PlanetariumStationScene;
    if (s && !bound && typeof s.onArrival === 'function') {
      s.onArrival(onArrival);
      bound = true;
    }
    return s;
  }

  function watch(row) {
    const s = scene();
    if (!s || typeof s.startArrival !== 'function') {
      if (captionEl) captionEl.textContent = 'The 3D station is still loading. Try again in a moment.';
      if (runEl) runEl.hidden = false;
      return;
    }
    const station = window.PlanetariumStation;
    if (station) {
      if (typeof station.setMode === 'function' && station.getState?.().mode === 'walk') station.setMode('orbit');
      if (typeof station.selectModule === 'function') station.selectModule(row.port);
    }
    active = row;
    if (runEl) runEl.hidden = false;
    const ok = s.startArrival({ port: row.port, kind: row.kind, vehicle: row.vehicle });
    if (!ok && captionEl) captionEl.textContent = `No 3D port for ${row.portLabel} yet.`;
    render();
    const stage = document.getElementById('stStageBlock');
    if (stage) stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
  }

  listEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-arrival]');
    if (!btn) return;
    const row = arrivals[Number(btn.getAttribute('data-arrival'))];
    if (row) watch(row);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const s = scene();
      if (s && typeof s.clearArrival === 'function') s.clearArrival();
      active = null;
      if (runEl) runEl.hidden = true;
      render();
    });
  }

  fetch(API, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      arrivals = Array.isArray(data.arrivals) ? data.arrivals : [];
      render();
      if (srcEl) {
        const when = data.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : '';
        srcEl.innerHTML = data.source === 'live'
          ? `Live from <a href="https://thespacedevs.com/llapi" rel="noopener noreferrer">Launch Library 2</a>${when ? ' · ' + esc(when) : ''}. Ports are planetarium estimates from each vehicle’s usual berth.`
          : `Snapshot from Launch Library 2${when ? ' · ' + esc(when) : ''}. Ports are planetarium estimates from each vehicle’s usual berth.`;
      }
      window.setInterval(tickCountdowns, 30000);
    })
    .catch(() => {
      listEl.innerHTML = '<li class="st-arrivals__empty">Arrivals are unavailable right now.</li>';
    });
})();
