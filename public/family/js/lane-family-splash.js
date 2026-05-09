/**
 * Lane Family hub — first-visit splash with historian plate background and optional YouTube embed.
 */
(function () {
  'use strict';

  /** Set to an 11-character YouTube video id when the “gem” clip is ready; leave empty to show placeholder copy only. */
  const LANE_FAMILY_SPLASH_VIDEO_ID = '';

  const LANE_FAMILY_SPLASH_BG = '/family/assets/lane-historians/frontispiece-title-1891.png';
  /** Bump suffix when splash copy/behavior changes so testers see it again without clearing all site data. */
  const LANE_FAMILY_SPLASH_LS_KEY = 'laneFamilyHubSplashSeen_v2';
  const SPLASH_AUTO_MS = 5200;

  function init() {
    const flash = document.getElementById('lfHubSplash');
    const skip = document.getElementById('lfHubSplashSkip');
    const bg = document.getElementById('lfHubSplashBg');
    const vignette = document.getElementById('lfHubSplashVignette');
    const iframe = document.getElementById('lfHubSplashIframe');
    const embedWrap = document.getElementById('lfHubSplashEmbedWrap');
    const placeholder = document.getElementById('lfHubSplashPlaceholder');
    if (!flash || !skip || !bg) return;

    const params = new URLSearchParams(window.location.search);
    const forceSplash = params.get('splash') === '1';
    const hasSeen = localStorage.getItem(LANE_FAMILY_SPLASH_LS_KEY) === '1';

    if (hasSeen && !forceSplash) {
      flash.classList.add('lf-hub-splash--hidden');
      flash.setAttribute('aria-hidden', 'true');
      return;
    }

    flash.setAttribute('aria-hidden', 'false');

    const videoId = String(LANE_FAMILY_SPLASH_VIDEO_ID || '').trim();
    if (videoId && embedWrap && iframe) {
      embedWrap.removeAttribute('hidden');
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`;
      if (placeholder) placeholder.setAttribute('hidden', 'hidden');
    } else if (placeholder) {
      if (embedWrap) embedWrap.setAttribute('hidden', 'hidden');
      if (iframe) iframe.removeAttribute('src');
      placeholder.removeAttribute('hidden');
    }

    bg.style.backgroundImage = `url("${LANE_FAMILY_SPLASH_BG}")`;
    const probe = new Image();
    probe.onerror = function () {
      flash.classList.add('lf-hub-splash--fallback');
    };
    probe.src = LANE_FAMILY_SPLASH_BG;

    const reducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      flash.classList.add('lf-hub-splash--reduced-motion');
    }

    let timerId = null;

    function close() {
      if (flash.classList.contains('lf-hub-splash--closing')) return;
      flash.classList.add('lf-hub-splash--closing');
      localStorage.setItem(LANE_FAMILY_SPLASH_LS_KEY, '1');
      if (timerId != null) {
        clearTimeout(timerId);
        timerId = null;
      }
      window.setTimeout(function () {
        flash.classList.add('lf-hub-splash--hidden');
        flash.setAttribute('aria-hidden', 'true');
        if (iframe) iframe.src = 'about:blank';
      }, 900);
    }

    skip.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });

    flash.addEventListener('click', function (event) {
      const t = event.target;
      if (t === flash || t === bg || t === vignette) {
        close();
      }
    });

    timerId = window.setTimeout(close, SPLASH_AUTO_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
