/**
 * NASA space-to-ground player. Click to start. Ducks while Zigzag speaks.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const URL = '/data/planetarium/iss-comms.json';

  function mount(host, opts) {
    if (!host) return;
    const gallery = opts && opts.gallery;
    const audio = new Audio();
    audio.preload = 'none';
    let clips = [];
    let index = 0;
    let wanted = false;
    let ducked = false;

    host.innerHTML =
      '<p class="st-comms__kicker">Space-to-ground</p>' +
      '<p class="st-comms__title" data-title>NASA Houston Audio Control Room</p>' +
      '<p class="st-comms__who" data-who></p>' +
      '<p class="st-comms__transcript" data-transcript></p>' +
      '<div class="st-comms__controls">' +
      '<button type="button" class="pw-btn pw-btn--primary" data-play>Play</button>' +
      '<button type="button" class="pw-btn" data-next>Next</button>' +
      '<a class="pw-btn" data-source href="https://archive.org/details/STS-135" target="_blank" rel="noopener noreferrer">Source</a>' +
      '</div>' +
      '<p class="st-comms__credit" data-credit></p>';

    const titleEl = host.querySelector('[data-title]');
    const whoEl = host.querySelector('[data-who]');
    const textEl = host.querySelector('[data-transcript]');
    const playBtn = host.querySelector('[data-play]');
    const sourceEl = host.querySelector('[data-source]');
    const creditEl = host.querySelector('[data-credit]');

    function clip() {
      return clips[index] || null;
    }

    function show() {
      const row = clip();
      if (!row) {
        titleEl.textContent = 'No confirmed NASA file for this gallery.';
        return;
      }
      titleEl.textContent = row.title + (row.date ? ' · ' + row.date : '');
      whoEl.textContent = row.speaker || '';
      textEl.textContent = row.transcript || '';
      sourceEl.href = row.sourcePage || row.audioUrl || '#';
    }

    function loadCurrent() {
      const row = clip();
      if (!row || !row.audioUrl) return;
      if (audio.src !== row.audioUrl) {
        audio.src = row.audioUrl;
      }
    }

    function play() {
      const row = clip();
      if (!row || !row.audioUrl) return;
      wanted = true;
      loadCurrent();
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          wanted = false;
          playBtn.textContent = 'Play';
          textEl.textContent = (row.transcript || '') + ' The file did not play. The source link is still the NASA archive page.';
        });
      }
      playBtn.textContent = 'Pause';
    }

    function pause() {
      wanted = false;
      audio.pause();
      playBtn.textContent = 'Play';
    }

    playBtn.addEventListener('click', () => {
      if (wanted && !audio.paused) pause();
      else play();
    });
    host.querySelector('[data-next]').addEventListener('click', () => {
      if (!clips.length) return;
      pause();
      index = (index + 1) % clips.length;
      show();
    });
    audio.addEventListener('ended', () => {
      wanted = false;
      playBtn.textContent = 'Play';
    });
    document.addEventListener('planetarium-voice', (ev) => {
      const speaking = Boolean(ev.detail && ev.detail.speaking);
      if (speaking && !audio.paused) {
        ducked = true;
        audio.pause();
      } else if (!speaking && ducked && wanted) {
        ducked = false;
        audio.play().catch(() => {});
      } else if (!speaking) {
        ducked = false;
      }
    });

    fetch(URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const all = (data && data.clips) || [];
        clips = all.filter((row) => row && row.audioUrl && (!gallery || row.gallery === gallery));
        creditEl.textContent = (data && data.credit) || '';
        show();
      })
      .catch(() => {
        titleEl.textContent = 'Space-to-ground catalog did not load.';
      });
  }

  root.PlanetariumComms = { mount };
})(window);
