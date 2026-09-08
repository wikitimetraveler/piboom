/**
 * Planetarium soundtrack — Norman Greenbaum, Spirit in the Sky (1969).
 * Hidden YouTube audio (no local copy of the recording).
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const VIDEO_ID = 'YqYN-1vMM9k';
  const ARTIST = 'Norman Greenbaum';
  const TITLE = 'Spirit in the Sky';
  const YEAR = 1969;
  const DEFAULT_VOLUME = 100;
  /** Stay off until Play — Zigzag's first-visit intro needs the speakers. */
  const AUTOPLAY_ON_LOAD = false;
  /** Official MV cold open + extra delay (12s + 2s + 1s) — land on the guitar. */
  const SKIP_SECONDS = 15;
  const DUCK_WHILE_PLAYING = 0;
  const MUTE_KEY = 'planSkySongMuted';
  const VOLUME_KEY = 'planSkySongVolume';
  const TOGGLE_SELECTOR = '#planSkySongToggle, #planAmbienceToggle';
  const VOLUME_SELECTOR = '#planSkySongVolume';
  const HOST_ID = 'planSkySongPlayer';

  let player = null;
  let playing = false;
  let unlocked = false;
  let wantedOn = AUTOPLAY_ON_LOAD;
  let volume = DEFAULT_VOLUME;
  let ytApiReady = null;
  let createSeq = 0;
  let gestureBound = false;
  let skipTimer = null;
  let introCleared = false;

  function clampVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function isMuted() {
    try {
      return root.localStorage.getItem(MUTE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setMuted(on) {
    try {
      root.localStorage.setItem(MUTE_KEY, on ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
  }

  function persistVolume(value) {
    volume = clampVolume(value);
    try {
      root.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch (_) {
      /* ignore */
    }
    return volume;
  }

  function hideIframe(iframe) {
    if (!iframe || typeof iframe.setAttribute !== 'function') return iframe;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    return iframe;
  }

  function applyPlayerVolume(target, value) {
    const vol = clampVolume(value);
    if (!target) return vol;
    // Never unmute while still in the cold-open intro window.
    if (!introCleared || needsIntroSkip(currentTimeOf(target))) {
      silenceUntilSkip(target);
      return vol;
    }
    try {
      if (typeof target.setVolume === 'function') target.setVolume(vol);
      if (vol > 0 && typeof target.unMute === 'function') target.unMute();
    } catch (_) {
      /* ignore */
    }
    return vol;
  }

  function duckAmbience(songOn) {
    const api = root.CelestialAmbience;
    if (!api || typeof api.setDuck !== 'function') return songOn ? DUCK_WHILE_PLAYING : 1;
    return api.setDuck(songOn ? DUCK_WHILE_PLAYING : 1);
  }

  function playerIsActive() {
    const YT = root.YT;
    if (!player || !YT || typeof player.getPlayerState !== 'function') return playing;
    try {
      const state = player.getPlayerState();
      return state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
    } catch (_) {
      return playing;
    }
  }

  function songShouldBeOn() {
    return wantedOn && !isMuted();
  }

  function isToggleEvent(event) {
    const target = event && event.target;
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest(TOGGLE_SELECTOR));
  }

  function syncButtons() {
    if (typeof document === 'undefined') return;
    const on = songShouldBeOn();
    document.querySelectorAll(TOGGLE_SELECTOR).forEach((btn) => {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = on
        ? '<i class="bi bi-pause-fill" aria-hidden="true"></i> Spirit in the Sky'
        : '<i class="bi bi-play-fill" aria-hidden="true"></i> Spirit in the Sky';
      btn.title = on
        ? 'Pause Spirit in the Sky'
        : 'Play Spirit in the Sky — Norman Greenbaum, 1969';
    });
    const slider = document.querySelector(VOLUME_SELECTOR);
    if (slider && String(slider.value) !== String(volume)) {
      slider.value = String(volume);
    }
  }

  function loadYouTubeIframeApi() {
    if (root.YT && root.YT.Player) return Promise.resolve();
    if (ytApiReady) return ytApiReady;
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('No document'));
    }
    ytApiReady = new Promise((resolve, reject) => {
      const done = () => {
        if (root.YT && root.YT.Player) resolve();
      };
      const prev = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev();
        done();
      };
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => reject(new Error('YouTube player script blocked'));
        document.head.appendChild(tag);
      }
      const started = Date.now();
      const timer = root.setInterval(() => {
        if (root.YT && root.YT.Player) {
          root.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 12000) {
          root.clearInterval(timer);
          reject(new Error('YouTube player did not load'));
        }
      }, 80);
    });
    return ytApiReady;
  }

  function ensureHost() {
    if (typeof document === 'undefined') return null;
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    const wrap = document.getElementById('planSkySongHost');
    if (!wrap) return null;
    wrap.setAttribute('aria-hidden', 'true');
    host = document.createElement('div');
    host.id = HOST_ID;
    wrap.appendChild(host);
    return host;
  }

  function currentTimeOf(target) {
    try {
      if (target && typeof target.getCurrentTime === 'function') {
        const n = Number(target.getCurrentTime());
        if (Number.isFinite(n)) return n;
      }
    } catch (_) {
      /* ignore */
    }
    return 0;
  }

  function needsIntroSkip(time) {
    const n = Number(time);
    return !Number.isFinite(n) || n < SKIP_SECONDS - 0.05;
  }

  function silenceUntilSkip(target) {
    if (!target) return SKIP_SECONDS;
    try {
      if (typeof target.mute === 'function') target.mute();
      if (typeof target.setVolume === 'function') target.setVolume(0);
    } catch (_) {
      /* ignore */
    }
    return SKIP_SECONDS;
  }

  function skipIntro(target) {
    if (!target) return SKIP_SECONDS;
    if (!needsIntroSkip(currentTimeOf(target))) {
      introCleared = true;
      return SKIP_SECONDS;
    }
    introCleared = false;
    silenceUntilSkip(target);
    try {
      if (typeof target.seekTo === 'function') target.seekTo(SKIP_SECONDS, true);
    } catch (_) {
      /* ignore */
    }
    return SKIP_SECONDS;
  }

  function stopSkipWatch() {
    if (skipTimer) {
      root.clearInterval(skipTimer);
      skipTimer = null;
    }
  }

  function restoreAmbience() {
    duckAmbience(false);
  }

  function markSongAudible(target) {
    introCleared = true;
    applyPlayerVolume(target, volume);
    duckAmbience(true);
  }

  function startSkipWatch(target) {
    stopSkipWatch();
    if (!target || typeof root.setInterval !== 'function') return;
    let ticks = 0;
    skipTimer = root.setInterval(() => {
      ticks += 1;
      if (!target) {
        stopSkipWatch();
        return;
      }
      const t = currentTimeOf(target);
      if (needsIntroSkip(t)) {
        skipIntro(target);
        try {
          if (typeof target.playVideo === 'function') target.playVideo();
        } catch (_) {
          /* ignore */
        }
        if (ticks > 40) {
          stopSkipWatch();
          restoreAmbience();
        }
        return;
      }
      markSongAudible(target);
      stopSkipWatch();
    }, 100);
  }

  function startAtSkip(target) {
    if (!target) return;
    introCleared = false;
    silenceUntilSkip(target);
    try {
      if (typeof target.loadVideoById === 'function') {
        target.loadVideoById({
          videoId: VIDEO_ID,
          startSeconds: SKIP_SECONDS,
        });
      } else if (typeof target.playVideo === 'function') {
        target.playVideo();
        skipIntro(target);
      }
    } catch (_) {
      try {
        if (typeof target.playVideo === 'function') target.playVideo();
        skipIntro(target);
      } catch (__) {
        /* wait for gesture */
      }
    }
    startSkipWatch(target);
  }

  function kickPlayback(target) {
    startAtSkip(target);
  }

  async function ensurePlayer() {
    if (player) return player;
    const host = ensureHost();
    if (!host) return null;
    await loadYouTubeIframeApi();
    const YT = root.YT;
    if (!YT || !YT.Player) return null;
    const seq = (createSeq += 1);
    const origin = root.location && root.location.origin;
    const playerVars = {
      autoplay: 1,
      start: SKIP_SECONDS,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      enablejsapi: 1,
    };
    if (origin && /^https?:/i.test(origin)) playerVars.origin = origin;
    return new Promise((resolve) => {
      const next = new YT.Player(HOST_ID, {
        videoId: VIDEO_ID,
        width: '200',
        height: '113',
        playerVars,
        events: {
          onReady() {
            if (seq !== createSeq) {
              resolve(player);
              return;
            }
            player = next;
            hideIframe(typeof next.getIframe === 'function' ? next.getIframe() : null);
            kickPlayback(player);
            syncButtons();
            resolve(player);
          },
          onError() {
            playing = false;
            restoreAmbience();
            syncButtons();
            resolve(player);
          },
          onStateChange(event) {
            if (!YT.PlayerState) return;
            hideIframe(typeof next.getIframe === 'function' ? next.getIframe() : null);
            if (event.data === YT.PlayerState.PLAYING) {
              playing = true;
              unlocked = true;
              if (needsIntroSkip(currentTimeOf(player))) {
                skipIntro(player);
                startSkipWatch(player);
              } else {
                markSongAudible(player);
              }
            } else if (event.data === YT.PlayerState.BUFFERING) {
              if (needsIntroSkip(currentTimeOf(player))) {
                skipIntro(player);
                startSkipWatch(player);
              }
            } else if (
              event.data === YT.PlayerState.PAUSED ||
              event.data === YT.PlayerState.ENDED
            ) {
              playing = false;
              if (!isMuted() && event.data === YT.PlayerState.ENDED) {
                startAtSkip(player);
                return;
              }
              restoreAmbience();
            }
            syncButtons();
          },
        },
      });
      player = next;
    });
  }

  async function start() {
    wantedOn = true;
    volume = persistVolume(DEFAULT_VOLUME);
    const yt = await ensurePlayer();
    if (!yt) {
      restoreAmbience();
      return false;
    }
    kickPlayback(yt);
    syncButtons();
    return true;
  }

  function stop() {
    wantedOn = false;
    playing = false;
    introCleared = false;
    stopSkipWatch();
    duckAmbience(false);
    if (player && typeof player.pauseVideo === 'function') {
      try {
        player.pauseVideo();
      } catch (_) {
        /* ignore */
      }
    }
    syncButtons();
  }

  async function toggle() {
    if (songShouldBeOn() && playerIsActive()) {
      setMuted(true);
      stop();
      return;
    }
    setMuted(false);
    await start();
  }

  function setVolume(value) {
    volume = persistVolume(value);
    applyPlayerVolume(player, volume);
    syncButtons();
    return volume;
  }

  function unbindGestureUnlock(onGesture) {
    if (typeof document === 'undefined' || !onGesture) return;
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    document.removeEventListener('touchstart', onGesture, true);
  }

  function bindGestureUnlock() {
    if (gestureBound || typeof document === 'undefined') return;
    gestureBound = true;
    const onGesture = (event) => {
      if (!songShouldBeOn()) {
        unbindGestureUnlock(onGesture);
        return;
      }
      if (isToggleEvent(event)) return;
      if (introCleared && playerIsActive()) {
        unbindGestureUnlock(onGesture);
        return;
      }
      start().catch(() => {});
    };
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    document.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  }

  function init() {
    volume = DEFAULT_VOLUME;
    persistVolume(volume);
    wantedOn = AUTOPLAY_ON_LOAD;
    setMuted(false);
    if (typeof document === 'undefined') return;

    document.querySelectorAll('#planSkySongToggle, #planAmbienceToggle').forEach((btn) => {
      if (btn._skySongBound) return;
      btn._skySongBound = true;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle().catch(() => {});
      });
    });

    const slider = document.querySelector(VOLUME_SELECTOR);
    if (slider && !slider._skySongBound) {
      slider._skySongBound = true;
      slider.value = String(volume);
      slider.addEventListener('input', (event) => {
        setVolume(event.target.value);
      });
    }

    syncButtons();
    if (AUTOPLAY_ON_LOAD) {
      start().catch(() => {});
      bindGestureUnlock();
    }
  }

  root.PlanetariumSkySong = {
    VIDEO_ID,
    ARTIST,
    TITLE,
    YEAR,
    DEFAULT_VOLUME,
    AUTOPLAY_ON_LOAD,
    SKIP_SECONDS,
    DUCK_WHILE_PLAYING,
    clampVolume,
    applyPlayerVolume,
    needsIntroSkip,
    skipIntro,
    duckAmbience,
    start,
    stop,
    toggle,
    setVolume,
    getVolume: () => volume,
    isMuted,
    isPlaying: () => playing,
    init,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
