/**
 * Zigzag ISS module tour on the station world page.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const SCRIPT_URL = '/data/planetarium/iss-station-tour.json';
  const FALLBACK = {
    title: 'Module tour',
    voices: {
      zigzag: { voice: 'en-US-Neural2-I', pitch: 2.4, speakingRate: 0.96, label: 'Zigzag' },
    },
    beats: [
      {
        id: 'open',
        who: 'zigzag',
        module: 'destiny',
        mode: 'orbit',
        text: 'Welcome aboard. I am Zigzag. This kite of metal is your International Space Station.',
      },
    ],
  };

  const els = {
    root: document.getElementById('stTour'),
    line: document.getElementById('stTourLine'),
    play: document.getElementById('stTourPlay'),
    pause: document.getElementById('stTourPause'),
    next: document.getElementById('stTourNext'),
    status: document.getElementById('stTourStatus'),
    zigzag: document.getElementById('stWhoZigzag'),
  };

  let script = FALLBACK;
  let index = 0;
  let playing = false;
  let runId = 0;

  function beats() {
    return Array.isArray(script.beats) ? script.beats : [];
  }

  function voice() {
    return (script.voices && script.voices.zigzag) || FALLBACK.voices.zigzag;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cueStation(beat) {
    const page = window.PlanetariumStation;
    if (!page) return;
    if (beat.mode && typeof page.setMode === 'function') page.setMode(beat.mode);
    if (beat.module && typeof page.selectModule === 'function') {
      page.selectModule(beat.module, { mode: beat.mode });
    }
  }

  function showBeat(beat) {
    if (els.line) els.line.textContent = beat && beat.text ? beat.text : '';
    if (els.zigzag) els.zigzag.classList.toggle('is-speaking', true);
    if (els.status) {
      const n = beats().length;
      els.status.textContent = n ? 'Beat ' + (index + 1) + ' of ' + n : '';
    }
    if (els.play) els.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (els.pause) els.pause.disabled = !playing;
    if (els.next) els.next.disabled = index >= beats().length - 1 && !playing;
  }

  async function speakBeat(beat, isCancelled) {
    const text = String((beat && beat.text) || '').trim();
    if (!text) return;
    const v = voice();
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
  }

  function stopAudio() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
  }

  async function playFrom(start) {
    const list = beats();
    if (!list.length) return;
    index = Math.max(0, Math.min(start, list.length - 1));
    playing = true;
    const myId = ++runId;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    for (let i = index; i < list.length; i += 1) {
      if (runId !== myId || !playing) return;
      index = i;
      const beat = list[i];
      showBeat(beat);
      cueStation(beat);
      await speakBeat(beat, () => runId !== myId || !playing);
      if (runId !== myId || !playing) return;
    }
    playing = false;
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
    cueStation(list[index]);
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
    showBeat(beats()[0]);
    if (els.play) els.play.addEventListener('click', play);
    if (els.pause) els.pause.addEventListener('click', pause);
    if (els.next) els.next.addEventListener('click', next);
    if (new URLSearchParams(location.search).get('tour') === '1') {
      els.root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  window.PlanetariumStationTour = { play, pause, next };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
