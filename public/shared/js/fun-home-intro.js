/**
 * Lane AI Labs home splash — one multi-avatar chat when ready,
 * otherwise Zigzag → Summer → Dave clips.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const HEARD_KEY = 'lane_labs_intro_heard_v2';
  const DEMO_RE = /[?&](?:demo=heygen|reel=1|intro=1)(?:&|$)/;
  const CHAT = {
    src: '/shared/assets/video/lane-labs-intro-chat.mp4',
    name: 'Lane AI Labs',
    role: 'Zigzag · Summer · Dave',
  };
  const CLIPS = [
    { src: '/planetarium/assets/video/lane-labs-intro-zigzag.mp4', name: 'Zigzag', role: 'Astronomy' },
    { src: '/mountain-high/assets/video/lane-labs-intro-summer.mp4', name: 'Summer', role: 'Plants' },
    { src: '/family/assets/video/lane-labs-intro-dave.mp4', name: 'Dave', role: 'Family · Music' },
  ];

  let introOn = false;
  let clipIndex = 0;
  let usingChat = false;
  let videoEl = null;
  let captionEl = null;

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function hasHeard() {
    try {
      return root.localStorage.getItem(HEARD_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function markHeard() {
    try {
      root.localStorage.setItem(HEARD_KEY, '1');
    } catch (_) {
      /* ignore */
    }
  }

  function shouldAutoplay() {
    if (typeof location === 'undefined') return false;
    if (DEMO_RE.test(location.search)) return true;
    if (root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return !hasHeard();
  }

  function holdPage() {
    document.documentElement.classList.add('is-intro-splash');
    document.body.classList.add('is-intro-splash');
  }

  function releasePage() {
    document.documentElement.classList.remove('is-intro-splash');
    document.body.classList.remove('is-intro-splash');
  }

  function closeSplash() {
    const modal = document.getElementById('funIntroModal');
    const closeBtn = document.getElementById('funIntroClose');
    const dying = videoEl;
    videoEl = null;
    captionEl = null;
    if (dying) {
      dying.removeEventListener('ended', onClipEnded);
      dying.removeEventListener('error', onVideoError);
      try {
        dying.pause();
        dying.removeAttribute('src');
        dying.load();
      } catch (_) {
        /* ignore */
      }
    }
    modal?.remove();
    closeBtn?.remove();
  }

  function stopIntro() {
    introOn = false;
    markHeard();
    closeSplash();
    releasePage();
  }

  function kickPlayback(video) {
    if (!video || typeof video.play !== 'function') return;
    video.playsInline = true;
    video.playbackRate = 1;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    const tryPlay = () => {
      if (!introOn || !video.isConnected) return;
      try {
        const attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') {
          attempt.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      } catch (_) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };
    video.addEventListener('playing', () => {
      if (!introOn || !video.muted) return;
      video.muted = false;
    }, { once: true });
    tryPlay();
    [80, 400, 1200].forEach((ms) => root.setTimeout(tryPlay, ms));
  }

  function setCaption(clip) {
    if (!captionEl || !clip) return;
    captionEl.innerHTML =
      '<strong>' + esc(clip.name) + '</strong> · ' + esc(clip.role);
  }

  function showClip(index) {
    usingChat = false;
    clipIndex = index;
    const clip = CLIPS[clipIndex];
    if (!videoEl || !clip) {
      stopIntro();
      return;
    }
    setCaption(clip);
    videoEl.src = clip.src;
    videoEl.muted = true;
    kickPlayback(videoEl);
  }

  function showChat() {
    usingChat = true;
    setCaption(CHAT);
    videoEl.src = CHAT.src;
    videoEl.muted = true;
    kickPlayback(videoEl);
  }

  function onClipEnded(ev) {
    if (!introOn || ev.target !== videoEl) return;
    if (usingChat) {
      stopIntro();
      return;
    }
    if (clipIndex + 1 < CLIPS.length) {
      showClip(clipIndex + 1);
      return;
    }
    stopIntro();
  }

  function onVideoError(ev) {
    if (!introOn || ev.target !== videoEl) return;
    if (usingChat) {
      showClip(0);
      return;
    }
    stopIntro();
  }

  function showSplash() {
    closeSplash();
    holdPage();
    introOn = true;
    usingChat = false;
    root.FunHomeSkySong?.stop?.();
    const rootEl = document.createElement('div');
    rootEl.id = 'funIntroModal';
    rootEl.className = 'fun-intro-modal';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-label', 'Lane AI Labs intro');
    rootEl.innerHTML =
      '<video class="fun-intro-video" muted autoplay playsinline webkit-playsinline preload="auto"></video>' +
      '<p class="fun-intro-caption" id="funIntroCaption"></p>';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'funIntroClose';
    closeBtn.className = 'fun-intro-skip';
    closeBtn.textContent = 'Close';
    closeBtn.setAttribute('aria-label', 'Close intro');
    document.body.appendChild(rootEl);
    document.body.appendChild(closeBtn);
    videoEl = rootEl.querySelector('video');
    captionEl = document.getElementById('funIntroCaption');
    const close = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      stopIntro();
    };
    closeBtn.addEventListener('pointerdown', close);
    closeBtn.addEventListener('click', close);
    if (videoEl) {
      videoEl.controls = false;
      videoEl.addEventListener('ended', onClipEnded);
      videoEl.addEventListener('error', onVideoError);
    }
    showChat();
  }

  function playIntro() {
    showSplash();
    return true;
  }

  function boot() {
    if (typeof document === 'undefined') return;
    document.getElementById('funIntroReplay')?.addEventListener('click', () => {
      playIntro();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.getElementById('funIntroModal')) stopIntro();
    });
    if (!shouldAutoplay()) {
      releasePage();
      return;
    }
    playIntro();
  }

  root.FunHomeIntro = { playIntro, stopIntro, shouldAutoplay };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
