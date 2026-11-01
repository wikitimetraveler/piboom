/**
 * Zigzag hangar reel — shuttle first, then the main ships.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const SCRIPT_URL = '/data/planetarium/star-wars-tour.json';
  const CAMERAS = {
    approach: 'Approach',
    orbit: 'Orbit',
    pullback: 'Pull back',
    walk: 'Inside',
  };
  const FALLBACK = {
    title: 'Hangar OAV',
    disclaimer: 'Stylized fan mockup — not an official film.',
    ships: [{ id: 'lambda', name: 'Lambda shuttle' }],
    voices: {
      zigzag: { voice: 'en-US-Neural2-I', pitch: 2.4, speakingRate: 0.96, label: 'Zigzag' },
    },
    beats: [
      {
        id: 'lambda',
        who: 'zigzag',
        ship: 'lambda',
        camera: 'approach',
        text: 'Start with the shuttle. Wings fold up in the bay, then they lock open and the hull becomes a dart.',
      },
    ],
  };

  const els = {
    root: document.getElementById('swTour'),
    line: document.getElementById('swTourLine'),
    play: document.getElementById('swTourPlay'),
    pause: document.getElementById('swTourPause'),
    prev: document.getElementById('swTourPrev'),
    next: document.getElementById('swTourNext'),
    beats: document.getElementById('swTourBeats'),
    chips: document.getElementById('swChips'),
    status: document.getElementById('swTourStatus'),
    zigzag: document.getElementById('swWhoZigzag'),
    hudTitle: document.getElementById('swHudTitle'),
    hudCamera: document.getElementById('swHudCamera'),
    fallbackTitle: document.getElementById('swFallbackTitle'),
    fallbackLine: document.getElementById('swFallbackLine'),
    hint: document.getElementById('swHudHint'),
    look: document.getElementById('swLookInside'),
    stage: document.getElementById('swStage'),
  };

  let script = FALLBACK;
  let index = 0;
  let playing = false;
  let runId = 0;

  function beats() {
    return Array.isArray(script.beats) ? script.beats : [];
  }

  function ships() {
    return Array.isArray(script.ships) ? script.ships : [];
  }

  function voice() {
    return (script.voices && script.voices.zigzag) || FALLBACK.voices.zigzag;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function shipName(id) {
    const row = ships().find((ship) => ship.id === id);
    return row && row.name ? row.name : String(id || '');
  }

  function cameraLabel(mode) {
    return CAMERAS[mode] || 'Orbit';
  }

  function beatLabel(beat) {
    if (!beat) return '';
    const name = shipName(beat.ship);
    return beat.label ? name + ' · ' + beat.label : name;
  }

  function setSpeaking(on) {
    if (els.zigzag) els.zigzag.classList.toggle('is-speaking', Boolean(on));
    document.dispatchEvent(new CustomEvent('planetarium-voice', { detail: { speaking: Boolean(on) } }));
  }

  function setSceneKeepAlive(on) {
    const scene = window.PlanetariumStarWarsScene;
    if (scene && typeof scene.setKeepAlive === 'function') scene.setKeepAlive(on);
  }

  function scrollStageIntoView() {
    const stage = document.getElementById('swStage');
    if (!stage) return;
    stage.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  function cue(beat) {
    const scene = window.PlanetariumStarWarsScene;
    if (scene && typeof scene.showShip === 'function' && beat) {
      scene.showShip(beat.ship, beat.camera, beat.room);
    }
    const name = shipName(beat && beat.ship);
    const inside = beat && beat.camera === 'walk';
    if (els.stage) els.stage.classList.toggle('is-walk', inside);
    if (els.hint) els.hint.hidden = !inside;
    if (els.hudTitle) els.hudTitle.textContent = beat && beat.label ? name + ' · ' + beat.label : name;
    if (els.hudCamera) els.hudCamera.textContent = inside && beat.label ? beat.label : cameraLabel(beat && beat.camera);
    if (els.fallbackTitle) els.fallbackTitle.textContent = beatLabel(beat);
    if (els.fallbackLine) els.fallbackLine.textContent = beat && beat.text ? beat.text : '';
  }

  function showBeat(beat) {
    if (els.line) els.line.textContent = beat && beat.text ? beat.text : '';
    if (els.status) {
      const n = beats().length;
      const name = beatLabel(beat);
      const beatPart = n ? 'Beat ' + (index + 1) + ' of ' + n : '';
      els.status.textContent = name ? beatPart + ' · ' + name : beatPart;
    }
    if (els.play) els.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (els.pause) els.pause.disabled = !playing;
    if (els.next) els.next.disabled = index >= beats().length - 1 && !playing;
    if (els.prev) els.prev.disabled = index <= 0 && !playing;
    renderBeats();
    renderChips();
  }

  function renderBeats() {
    if (!els.beats) return;
    const list = beats();
    els.beats.replaceChildren();
    list.forEach((beat, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.beat = String(i);
      const label = beat.label ? shipName(beat.ship) + ' · ' + beat.label : (shipName(beat.ship) || 'Beat ' + (i + 1));
      btn.textContent = label;
      btn.setAttribute('aria-label', 'Go to ' + label + ' (beat ' + (i + 1) + ' of ' + list.length + ')');
      if (i === index) {
        btn.classList.add('is-on');
        btn.setAttribute('aria-current', 'true');
      }
      btn.addEventListener('click', () => goTo(i));
      li.appendChild(btn);
      els.beats.appendChild(li);
    });
  }

  function renderChips() {
    if (!els.chips) return;
    const list = beats();
    const current = list[index];
    const seen = [];
    list.forEach((beat, i) => {
      if (seen.some((row) => row.id === beat.ship)) return;
      seen.push({ id: beat.ship, index: i });
    });
    els.chips.replaceChildren();
    seen.forEach((row) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const on = current && current.ship === row.id;
      btn.className = 'pw-btn' + (on ? ' is-on' : '');
      btn.textContent = shipName(row.id);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.addEventListener('click', () => goTo(row.index));
      els.chips.appendChild(btn);
    });
  }

  function lookInside() {
    const current = beats()[index];
    if (!current) return;
    const found = beats().findIndex((beat) => beat.ship === current.ship && beat.camera === 'walk');
    if (found >= 0) goTo(found);
  }

  async function speakBeat(beat, isCancelled) {
    const text = String((beat && beat.text) || '').trim();
    if (!text) return;
    const v = voice();
    setSpeaking(true);
    try {
      if (typeof window.speakNarrationAwaitEnd === 'function') {
        await window.speakNarrationAwaitEnd(text, {
          voice: v.voice,
          pitch: v.pitch,
          speakingRate: v.speakingRate,
          gender: 'male',
          isCancelled: isCancelled,
        });
        return;
      }
      if (typeof window.speakWithGoogle === 'function') {
        await window.speakWithGoogle(text, v.voice, { pitch: v.pitch, speakingRate: v.speakingRate });
      }
    } finally {
      if (!isCancelled || !isCancelled()) setSpeaking(false);
    }
  }

  function stopAudio() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
  }

  async function playFrom(start) {
    const list = beats();
    if (!list.length) return;
    index = Math.max(0, Math.min(start, list.length - 1));
    playing = true;
    setSceneKeepAlive(true);
    scrollStageIntoView();
    const myId = ++runId;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    for (let i = index; i < list.length; i += 1) {
      if (runId !== myId || !playing) return;
      index = i;
      const beat = list[i];
      showBeat(beat);
      cue(beat);
      await speakBeat(beat, () => runId !== myId || !playing);
      if (runId !== myId || !playing) return;
    }
    playing = false;
    setSpeaking(false);
    setSceneKeepAlive(false);
    showBeat(list[index] || list[0]);
  }

  function play() {
    const list = beats();
    if (!list.length) return;
    const start = index >= list.length - 1 ? 0 : index;
    playFrom(start);
  }

  function pause() {
    playing = false;
    runId += 1;
    stopAudio();
    setSpeaking(false);
    setSceneKeepAlive(false);
    showBeat(beats()[index] || beats()[0]);
  }

  function next() {
    const list = beats();
    if (!list.length) return;
    const wasPlaying = playing;
    const nextIndex = Math.min(index + 1, list.length - 1);
    if (wasPlaying) {
      playFrom(nextIndex);
      return;
    }
    index = nextIndex;
    showBeat(list[index]);
    cue(list[index]);
  }

  function prev() {
    const list = beats();
    if (!list.length) return;
    const wasPlaying = playing;
    const prevIndex = Math.max(index - 1, 0);
    if (wasPlaying) {
      playFrom(prevIndex);
      return;
    }
    index = prevIndex;
    showBeat(list[index]);
    cue(list[index]);
  }

  function goTo(i) {
    const list = beats();
    if (!list.length) return;
    const target = Math.max(0, Math.min(Number(i) || 0, list.length - 1));
    if (playing) {
      playFrom(target);
      return;
    }
    index = target;
    showBeat(list[index]);
    cue(list[index]);
  }

  function indexForShip(id) {
    const found = beats().findIndex((beat) => beat.ship === id);
    return found >= 0 ? found : 0;
  }

  async function loadScript() {
    try {
      const res = await fetch(SCRIPT_URL, { cache: 'no-store' });
      if (!res.ok) return FALLBACK;
      const json = await res.json();
      if (!json || !Array.isArray(json.beats) || !json.beats.length) return FALLBACK;
      return json;
    } catch (err) {
      console.warn(err);
      return FALLBACK;
    }
  }

  async function boot() {
    if (!els.root) return;
    script = await loadScript();
    const params = new URLSearchParams(location.search);
    const ship = params.get('ship');
    const room = params.get('room');
    if (ship) {
      const found = beats().findIndex((beat) => beat.ship === ship && (!room || beat.room === room));
      index = found >= 0 ? found : indexForShip(ship);
    } else {
      index = 0;
    }
    const beat = beats()[index] || beats()[0];
    showBeat(beat);
    cue(beat);
    setSpeaking(false);
    if (els.play) els.play.addEventListener('click', play);
    if (els.pause) els.pause.addEventListener('click', pause);
    if (els.next) els.next.addEventListener('click', next);
    if (els.prev) els.prev.addEventListener('click', prev);
    if (els.look) els.look.addEventListener('click', lookInside);
    if (params.get('tour') === '1') {
      scrollStageIntoView();
      if (!reducedMotion()) {
        try {
          playFrom(index);
        } catch (_) {
          /* autoplay / TTS blocked */
        }
      }
    }
  }

  window.PlanetariumStarWarsTour = { play, pause, next, prev, goTo };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
