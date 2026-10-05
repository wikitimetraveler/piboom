/**
 * Four-beat exhibit hall. Does not autoplay NASA audio.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const URL = '/data/planetarium/iss-hall.json';
  const playBtn = document.getElementById('stHallPlay');
  const pauseBtn = document.getElementById('stHallPause');
  const nextBtn = document.getElementById('stHallNext');
  const lineEl = document.getElementById('stHallLine');
  if (!playBtn || !lineEl) return;

  let beats = [];
  let index = 0;
  let playing = false;
  let timer = 0;

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function show(beat) {
    if (!beat) return;
    lineEl.textContent = beat.title + ' — ' + beat.text;
    const station = window.PlanetariumStation;
    if (beat.module && station && typeof station.selectModule === 'function') {
      station.selectModule(beat.module);
    } else if (beat.module && window.PlanetariumStationScene) {
      window.PlanetariumStationScene.selectModule(beat.module);
    }
    if (beat.action === 'comms') {
      const panel = document.getElementById('stComms');
      if (panel) panel.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
    }
    if (beat.action === 'pass') {
      const scene = window.PlanetariumStationScene;
      if (scene && typeof scene.startPassThrough === 'function') scene.startPassThrough();
    }
    if (beat.action === 'docking') {
      const link = document.getElementById('stHallDock');
      if (link) link.hidden = false;
    }
  }

  function stop() {
    playing = false;
    window.clearTimeout(timer);
    playBtn.setAttribute('aria-pressed', 'false');
    if (pauseBtn) pauseBtn.disabled = true;
  }

  function advance() {
    if (!playing) return;
    index += 1;
    if (index >= beats.length) {
      stop();
      return;
    }
    show(beats[index]);
    timer = window.setTimeout(advance, reduced() ? 400 : 7000);
  }

  function play() {
    if (!beats.length) return;
    if (index >= beats.length) index = 0;
    playing = true;
    playBtn.setAttribute('aria-pressed', 'true');
    if (pauseBtn) pauseBtn.disabled = false;
    show(beats[index]);
    window.clearTimeout(timer);
    timer = window.setTimeout(advance, reduced() ? 400 : 7000);
  }

  playBtn.addEventListener('click', play);
  if (pauseBtn) pauseBtn.addEventListener('click', stop);
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!beats.length) return;
      window.clearTimeout(timer);
      index = (index + 1) % beats.length;
      show(beats[index]);
      if (playing) timer = window.setTimeout(advance, reduced() ? 400 : 7000);
    });
  }

  fetch(URL, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      beats = (data && data.beats) || [];
    })
    .catch(() => {});

  const comms = document.getElementById('stComms');
  if (comms && window.PlanetariumComms) window.PlanetariumComms.mount(comms);
})();
