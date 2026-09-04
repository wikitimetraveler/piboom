/**
 * Attach HeyGen Avatar Realtime HLS (or leftover LiveKit tokens) to a media host.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function destroyHls(el) {
    if (el && el._heygenHls) {
      try {
        el._heygenHls.destroy();
      } catch (_) {
        /* ignore */
      }
      el._heygenHls = null;
    }
  }

  function isHls(session) {
    if (!session) return false;
    if (session.playback === 'hls') return true;
    if (session.playback === 'poster') return false;
    if (session.accessToken) return false;
    return /\.m3u8(\?|$)/i.test(String(session.url || ''));
  }

  function isPoster(session) {
    if (!session) return false;
    if (session.playback === 'poster' || session.fallback) return true;
    return /\.(webp|png|jpe?g|gif)(\?|$)/i.test(String(session.url || ''));
  }

  function attachPoster(host, url, className, alt) {
    if (!host || !url) return null;
    const prev = host.querySelector('video');
    destroyHls(prev);
    const img = document.createElement('img');
    img.className = className || '';
    img.alt = alt || 'Presenter';
    img.src = url;
    host.replaceChildren(img);
    return img;
  }

  let audioEl = null;

  function stopAudio() {
    if (!audioEl) return;
    try {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    } catch (_) {
      /* ignore */
    }
    audioEl = null;
  }

  function playAudio(url) {
    if (!url) return null;
    stopAudio();
    audioEl = new Audio(url);
    const play = audioEl.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
    return audioEl;
  }

  function attachHls(host, url, className) {
    if (!host || !url) return null;
    const prev = host.querySelector('video');
    destroyHls(prev);
    const video = document.createElement('video');
    video.className = className || '';
    video.autoplay = true;
    video.muted = false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    host.replaceChildren(video);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else if (root.Hls && typeof root.Hls.isSupported === 'function' && root.Hls.isSupported()) {
      const hls = new root.Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      video._heygenHls = hls;
    } else {
      video.src = url;
    }
    const play = video.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
    return video;
  }

  root.HeygenLiveTile = { isHls, isPoster, attachHls, attachPoster, destroyHls, playAudio, stopAudio };
})(typeof globalThis !== 'undefined' ? globalThis : window);
