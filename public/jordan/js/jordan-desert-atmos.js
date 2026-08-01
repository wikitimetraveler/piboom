/**
 * Jordan hero sandstorm — fine grit across the low skyline strip only.
 * Horizontal wind; reduced-motion → static.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DESKTOP_COUNT = 70;
  const MOBILE_COUNT = 36;
  // Mostly sideways — desert wind, not rain
  const WIND = { x: -2.8, y: 0.18 };

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function isDark() {
    return document.body.classList.contains('dark-mode');
  }

  function setCssPaused(paused) {
    const state = paused ? 'paused' : 'running';
    const atmos = document.getElementById('jdHeroAtmos');
    if (atmos) {
      atmos.querySelectorAll(
        '.jd-hero-sky, .jd-hero-heat, .jd-hero-sand, .jd-hero-arch, .jd-hero-dune, .jd-hero-city, .jd-hero-silhouettes'
      ).forEach((el) => {
        el.style.animationPlayState = state;
      });
    }
    const portrait = document.querySelector('#jdGuide:not(.is-speaking) .jd-guide-portrait');
    if (portrait) portrait.style.animationPlayState = state;
  }

  function seedFallbackMotes(root, count) {
    root.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const mote = document.createElement('span');
      mote.className = 'jd-hero-mote' + (i % 2 === 0 ? ' is-grain' : '');
      mote.style.left = `${Math.random() * 100}%`;
      mote.style.top = `${20 + Math.random() * 70}%`;
      mote.style.animationDuration = `${5 + Math.random() * 6}s`;
      mote.style.animationDelay = `${Math.random() * 5}s`;
      mote.style.setProperty('--jd-drift-x', `${(-160 - Math.random() * 100).toFixed(0)}px`);
      mote.style.setProperty('--jd-spin', `${(Math.random() * 40 - 20).toFixed(0)}deg`);
      root.appendChild(mote);
    }
  }

  function createStorm(canvas, hero) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    let particles = [];
    let raf = 0;
    let running = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t0 = performance.now();

    function particleCount() {
      return isMobile() ? MOBILE_COUNT : DESKTOP_COUNT;
    }

    function spawn(partial) {
      const fromRight = Math.random() > 0.2;
      return {
        x: partial ? Math.random() * w : fromRight ? w + Math.random() * 12 : Math.random() * w,
        y: Math.random() * h,
        vx: WIND.x * (0.7 + Math.random() * 0.9),
        vy: WIND.y * (0.4 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.15,
        size: 0.4 + Math.random() * 0.55,
        len: 2 + Math.random() * 5,
        alpha: 0.16 + Math.random() * 0.28,
        streak: Math.random() > 0.35,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.04,
      };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = particleCount();
      if (particles.length !== n) {
        particles = Array.from({ length: n }, () => spawn(true));
      }
    }

    function gust(now) {
      const t = (now - t0) / 1000;
      return 0.7 + 0.3 * Math.sin(t * 0.85);
    }

    function tick(now) {
      if (!running) return;
      raf = requestAnimationFrame(tick);

      const g = gust(now);
      const dark = isDark();
      const windMul = 1 + g * 0.7;

      ctx.clearRect(0, 0, w, h);

      const grain = dark ? 'rgba(232, 205, 155,' : 'rgba(105, 75, 40,';
      const streak = dark ? 'rgba(215, 175, 110,' : 'rgba(125, 90, 50,';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.wobble += p.wobbleSpeed;
        p.x += p.vx * windMul + Math.sin(p.wobble) * 0.3;
        p.y += p.vy * windMul + Math.cos(p.wobble) * 0.12;

        if (p.x < -20 || p.y > h + 8 || p.y < -8) {
          particles[i] = spawn(false);
          continue;
        }

        const a = Math.min(0.45, p.alpha * (0.7 + g * 0.3));
        if (p.streak) {
          ctx.strokeStyle = `${streak}${a})`;
          ctx.lineWidth = Math.max(0.35, p.size * 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          // Long horizontal streak = wind, not rain
          ctx.lineTo(p.x - p.len * windMul, p.y + p.len * 0.08);
          ctx.stroke();
        } else {
          ctx.fillStyle = `${grain}${a})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 0.85, p.size * 0.35, -0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      hero.style.setProperty('--jd-gust', g.toFixed(3));
    }

    function start() {
      if (running) return;
      running = true;
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, w, h);
    }

    function sync() {
      const shouldRun = visible && !document.hidden;
      setCssPaused(!shouldRun);
      if (shouldRun) start();
      else stop();
    }

    resize();
    window.addEventListener('resize', resize);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.05 }
    );
    io.observe(hero);

    document.addEventListener('visibilitychange', sync);
    sync();

    return {
      dispose() {
        stop();
        io.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', sync);
      },
    };
  }

  function init() {
    const hero = document.getElementById('jdHero');
    const motes = document.getElementById('jdHeroMotes');
    const canvas = document.getElementById('jdSandstorm');
    if (!hero) return;

    hero.classList.add('is-sandstorm');

    if (prefersReducedMotion()) {
      if (motes) motes.innerHTML = '';
      if (canvas) canvas.hidden = true;
      hero.classList.add('is-sandstorm-static');
      return;
    }

    if (canvas) {
      const storm = createStorm(canvas, hero);
      if (storm) {
        if (motes) motes.innerHTML = '';
        return;
      }
    }

    if (motes) {
      seedFallbackMotes(motes, isMobile() ? 12 : 18);
      let visible = true;
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          setCssPaused(!visible || document.hidden);
        },
        { threshold: 0.05 }
      );
      io.observe(hero);
      document.addEventListener('visibilitychange', () => {
        setCssPaused(document.hidden || !visible);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
