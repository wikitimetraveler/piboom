/**
 * Zigzag + Elon hangar conversation on the SpaceX rockets page.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const SCRIPT_URL = '/data/planetarium/spacex-hangar-chat.json';
  const FALLBACK = {
    title: 'Hangar chat',
    subtitle: 'Zigzag pulls Elon onto the pad.',
    disclaimer: 'Stylized planetarium dialogue — not an official SpaceX interview.',
    voices: {
      zigzag: { voice: 'en-US-Neural2-I', pitch: 2.4, speakingRate: 0.96, label: 'Zigzag' },
      elon: { voice: 'en-US-Neural2-D', pitch: -1.2, speakingRate: 1.02, label: 'Elon' },
    },
    beats: [
      {
        id: 'open',
        who: 'zigzag',
        text: 'Elon. I flew in from the Magellanic Cloud. Your metal tubes keep punching the sky. Walk me through the family.',
      },
    ],
  };

  const els = {
    root: document.getElementById('sxHangar'),
    line: document.getElementById('sxHangarLine'),
    speaker: document.getElementById('sxHangarSpeaker'),
    play: document.getElementById('sxHangarPlay'),
    pause: document.getElementById('sxHangarPause'),
    next: document.getElementById('sxHangarNext'),
    zigzag: document.getElementById('sxWhoZigzag'),
    elon: document.getElementById('sxWhoElon'),
    status: document.getElementById('sxHangarStatus'),
  };

  let script = FALLBACK;
  let index = 0;
  let playing = false;
  let runId = 0;

  function beats() {
    return Array.isArray(script.beats) ? script.beats : [];
  }

  function voiceFor(who) {
    const voices = script.voices || FALLBACK.voices;
    return voices[who] || voices.zigzag || FALLBACK.voices.zigzag;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cuePad(rocketId) {
    const pad = window.PlanetariumSpacexPad;
    if (rocketId && pad && typeof pad.setVehicle === 'function') {
      pad.setVehicle(rocketId);
    }
  }

  function showBeat(beat) {
    const who = beat && beat.who === 'elon' ? 'elon' : 'zigzag';
    const voice = voiceFor(who);
    if (els.speaker) els.speaker.textContent = voice.label || (who === 'elon' ? 'Elon' : 'Zigzag');
    if (els.line) els.line.textContent = beat && beat.text ? beat.text : '';
    if (els.zigzag) els.zigzag.classList.toggle('is-speaking', who === 'zigzag');
    if (els.elon) els.elon.classList.toggle('is-speaking', who === 'elon');
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
    const who = beat.who === 'elon' ? 'elon' : 'zigzag';
    const voice = voiceFor(who);
    if (typeof window.speakNarrationAwaitEnd === 'function') {
      await window.speakNarrationAwaitEnd(text, {
        voice: voice.voice,
        pitch: voice.pitch,
        speakingRate: voice.speakingRate,
        gender: 'male',
        isCancelled: isCancelled,
      });
      return;
    }
    if (typeof window.speakWithGoogle === 'function') {
      await window.speakWithGoogle(text, voice.voice, {
        pitch: voice.pitch,
        speakingRate: voice.speakingRate,
      });
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
    for (let i = index; i < list.length; i++) {
      if (runId !== myId || !playing) return;
      index = i;
      const beat = list[i];
      showBeat(beat);
      cuePad(beat.rocket);
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
    cuePad(list[index].rocket);
  }

  function cueRocket(rocketId) {
    const id = String(rocketId || '').trim();
    if (!id) return;
    const list = beats();
    const found = list.findIndex((beat) => beat.rocket === id);
    if (found < 0) return;
    index = found;
    if (playing) {
      playFrom(found);
      return;
    }
    showBeat(list[found]);
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
    if (els.play) {
      els.play.addEventListener('click', () => {
        play();
      });
    }
    if (els.pause) els.pause.addEventListener('click', pause);
    if (els.next) els.next.addEventListener('click', next);
    if (new URLSearchParams(location.search).get('talk') === '1') {
      els.root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  window.PlanetariumSpacexHangar = {
    play: play,
    pause: pause,
    next: next,
    cueRocket: cueRocket,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
