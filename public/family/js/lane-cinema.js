/**
 * Development work by David Lane
 * Genealogy source file. Author: Levi Lane.
 *
 * Lane Family Cinema — Live Stage player for The Lane Chronicle
 * (HeyGen ancestor clips + 1891 register cards + Evidence/Context inspector).
 */
(function () {
  'use strict';

  const DATA_URL = '/data/lane-chronicle-movie.json';
  const $ = (id) => document.getElementById(id);

  let catalog = null;
  let beats = [];
  let beatIndex = 0;
  let playing = false;
  let rafId = 0;
  let beatStartedAt = 0;
  let elapsedBeforePause = 0;
  let totalElapsed = 0;
  let renderedAvailable = false;

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function totalDuration() {
    return Number(catalog?.targetDurationSec) || beats.reduce((n, b) => n + (b.durationSec || 0), 0);
  }

  function renderChapters() {
    const nav = $('lcChapters');
    if (!nav) return;
    nav.innerHTML = beats
      .map(
        (b, i) =>
          `<button type="button" data-beat="${i}" class="${i === beatIndex ? 'is-active' : ''}" aria-current="${
            i === beatIndex ? 'true' : 'false'
          }">${esc(b.label || `Beat ${b.index}`)}</button>`
      )
      .join('');
    nav.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-beat'));
        jumpToBeat(i, playing);
      });
    });
  }

  function renderBeatSheet() {
    const el = $('lcBeatSheet');
    if (!el) return;
    el.innerHTML = beats
      .map(
        (b) => `<div class="lane-cinema-beat-row">
          <span>${esc(b.index)}</span>
          <div><strong>${esc(b.title)}</strong><div class="small text-muted">${esc(b.kicker || '')}</div></div>
          <span class="text-muted">${esc(b.durationSec)}s</span>
        </div>`
      )
      .join('');
  }

  function stopMedia() {
    const v = $('lcVideo');
    const v2 = $('lcVideoSecondary');
    if (v) {
      v.pause();
      try {
        v.removeAttribute('src');
        v.load();
      } catch {
        /* ignore */
      }
    }
    if (v2) {
      v2.pause();
      v2.hidden = true;
      try {
        v2.removeAttribute('src');
        v2.load();
      } catch {
        /* ignore */
      }
    }
  }

  function showBeat(beat, { autoplay } = { autoplay: false }) {
    const av = $('lcAv');
    const video = $('lcVideo');
    const video2 = $('lcVideoSecondary');
    const still = $('lcStill');
    const badge = $('lcBadge');
    const stats = $('lcStats');
    const legend = $('lcLegend');
    const quartet = $('lcQuartet');

    $('lcKicker').textContent = beat.kicker || '';
    $('lcTitle').textContent = beat.title || '';
    $('lcDetail').textContent = beat.registerDetail || beat.teleprompter || '';
    $('lcEvidence').textContent = beat.evidence || '';
    $('lcContext').textContent = beat.context || '';
    $('lcTeleprompter').textContent = beat.teleprompter || '';

    if (badge) {
      if (beat.registerCode) {
        badge.hidden = false;
        badge.textContent = beat.registerCode;
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
    }

    const links = $('lcEvidenceLinks');
    if (links) {
      const parts = [];
      if (beat.genealogyUrl) {
        parts.push(`<a class="btn btn-sm btn-outline-primary" href="${esc(beat.genealogyUrl)}">Open graph / chapter</a>`);
      }
      if (beat.platesUrl) {
        parts.push(`<a class="btn btn-sm btn-outline-secondary" href="${esc(beat.platesUrl)}">Book plates</a>`);
      }
      if (beat.personSlug) {
        parts.push(
          `<a class="btn btn-sm btn-outline-dark" href="/family/lane-heygen-line.html?person=${esc(
            beat.personSlug
          )}">HeyGen line</a>`
        );
      }
      links.innerHTML = parts.join(' ');
    }

    const isGraph = beat.id === 'graph';
    const isFinale = beat.id === 'finale';
    const isDiptych = beat.kind === 'heygen-diptych';

    if (stats) stats.hidden = !isGraph;
    if (legend) legend.hidden = !isGraph;
    if (quartet) {
      quartet.hidden = !isFinale;
      if (isFinale && Array.isArray(beat.quartet)) {
        quartet.innerHTML = beat.quartet
          .map((src) => `<img src="${esc(src)}" alt="" loading="lazy" />`)
          .join('');
      } else {
        quartet.innerHTML = '';
      }
    }
    if (isGraph && catalog?.stats) {
      $('lcStatFamilies').textContent = String(catalog.stats.numberedFamilies);
      $('lcStatCoded').textContent = String(catalog.stats.codedPeople);
      $('lcStatLinks').textContent = String(catalog.stats.bookVerifiedLinks);
    }

    av.classList.toggle('is-wide', beat.id === 'hook' || isFinale);
    av.classList.toggle('is-diptych', isDiptych);

    stopMedia();
    still.hidden = true;
    video.hidden = false;

    if (beat.heygenVideoUrl) {
      video.src = beat.heygenVideoUrl;
      video.muted = false;
      video.currentTime = 0;
      if (isDiptych && beat.secondaryVideoUrl && video2) {
        video2.hidden = false;
        video2.src = beat.secondaryVideoUrl;
        video2.muted = true;
        video2.currentTime = 0;
      }
      if (autoplay) {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        if (isDiptych && video2) {
          const p2 = video2.play();
          if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
        }
      }
    } else if (beat.plateUrl || (beat.quartet && beat.quartet[0])) {
      video.hidden = true;
      still.hidden = false;
      still.src = beat.plateUrl || beat.quartet[0];
      still.alt = beat.title || 'Chronicle still';
    } else {
      video.hidden = true;
      still.hidden = false;
      still.removeAttribute('src');
      still.alt = '';
    }

    renderChapters();
  }

  function updateClock() {
    const total = totalDuration();
    const beat = beats[beatIndex];
    const local = playing
      ? elapsedBeforePause + (performance.now() - beatStartedAt) / 1000
      : elapsedBeforePause;
    const global = (beat?.startSec || 0) + Math.min(local, beat?.durationSec || 0);
    totalElapsed = Math.min(global, total);
    const clock = $('lcClock');
    if (clock) clock.textContent = `${fmt(totalElapsed)} / ${fmt(total)}`;
    const bar = $('lcProgress');
    if (bar) bar.style.width = `${(totalElapsed / total) * 100}%`;
  }

  function tick() {
    if (!playing) return;
    const beat = beats[beatIndex];
    if (!beat) return;
    const local = elapsedBeforePause + (performance.now() - beatStartedAt) / 1000;
    updateClock();
    if (local >= (beat.durationSec || 0)) {
      if (beatIndex >= beats.length - 1) {
        pause();
        elapsedBeforePause = beat.durationSec || 0;
        updateClock();
        return;
      }
      jumpToBeat(beatIndex + 1, true);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if ($('lcRenderedMode')?.checked && renderedAvailable) {
      const rv = $('lcRenderedVideo');
      if (rv) {
        rv.play().catch(() => {});
        $('lcPlay').setAttribute('aria-pressed', 'true');
        $('lcPause').disabled = false;
      }
      return;
    }
    if (!beats.length) return;
    playing = true;
    beatStartedAt = performance.now();
    showBeat(beats[beatIndex], { autoplay: true });
    $('lcPlay').setAttribute('aria-pressed', 'true');
    $('lcPause').disabled = false;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(rafId);
    elapsedBeforePause += (performance.now() - beatStartedAt) / 1000;
    const v = $('lcVideo');
    const v2 = $('lcVideoSecondary');
    if (v) v.pause();
    if (v2) v2.pause();
    const rv = $('lcRenderedVideo');
    if (rv) rv.pause();
    $('lcPlay').setAttribute('aria-pressed', 'false');
    $('lcPause').disabled = true;
    updateClock();
  }

  function jumpToBeat(index, resume) {
    const wasPlaying = resume !== undefined ? resume : playing;
    pause();
    beatIndex = Math.max(0, Math.min(beats.length - 1, index));
    elapsedBeforePause = 0;
    showBeat(beats[beatIndex], { autoplay: false });
    updateClock();
    if (wasPlaying) play();
  }

  function restart() {
    pause();
    beatIndex = 0;
    elapsedBeforePause = 0;
    const rv = $('lcRenderedVideo');
    if (rv) {
      rv.currentTime = 0;
    }
    showBeat(beats[0], { autoplay: false });
    updateClock();
  }

  async function probeRendered(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  }

  function setMode(useRendered) {
    const live = $('lcLiveStage');
    const wrap = $('lcRenderedWrap');
    if (useRendered && renderedAvailable) {
      pause();
      live?.classList.add('d-none');
      wrap?.classList.remove('d-none');
    } else {
      wrap?.classList.add('d-none');
      live?.classList.remove('d-none');
      if (useRendered && !renderedAvailable) {
        const hint = $('lcRenderedHint');
        if (hint) {
          hint.textContent =
            'Director’s cut MP4 not found yet. Render video/lane-chronicle and copy to /family/assets/video/lane-chronicle-movie.mp4 — Live Stage remains available.';
        }
        $('lcRenderedMode').checked = false;
      }
    }
  }

  async function init() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
    catalog = await res.json();
    beats = Array.isArray(catalog.beats) ? catalog.beats : [];
    if (!beats.length) throw new Error('Chronicle catalog has no beats');

    renderBeatSheet();
    showBeat(beats[0], { autoplay: false });
    updateClock();

    const movieUrl = catalog.renderedMovieUrl || '/family/assets/video/lane-chronicle-movie.mp4';
    renderedAvailable = await probeRendered(movieUrl);
    const rv = $('lcRenderedVideo');
    if (rv && renderedAvailable) {
      rv.src = movieUrl;
      $('lcRenderedHint').textContent = 'Director’s cut HyperFrames MP4 ready.';
    }

    $('lcPlay')?.addEventListener('click', () => play());
    $('lcPause')?.addEventListener('click', () => pause());
    $('lcRestart')?.addEventListener('click', () => restart());
    $('lcRenderedMode')?.addEventListener('change', (e) => setMode(e.target.checked));

    const params = new URLSearchParams(window.location.search);
    const beatParam = params.get('beat');
    if (beatParam) {
      const byId = beats.findIndex((b) => b.id === beatParam || String(b.index) === beatParam);
      if (byId >= 0) jumpToBeat(byId, false);
    }
    if (params.get('play') === '1' || params.get('autoplay') === '1') {
      play();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init().catch((err) => {
        const stage = $('lcLiveStage');
        if (stage) {
          stage.innerHTML = `<p class="text-danger p-4 mb-0">${esc(err.message || String(err))}</p>`;
        }
      });
    });
  } else {
    init().catch((err) => console.error(err));
  }
})();
