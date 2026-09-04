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
    if (session.accessToken) return false;
    return /\.m3u8(\?|$)/i.test(String(session.url || ''));
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

  root.HeygenLiveTile = { isHls, attachHls, destroyHls };
})(typeof globalThis !== 'undefined' ? globalThis : window);
