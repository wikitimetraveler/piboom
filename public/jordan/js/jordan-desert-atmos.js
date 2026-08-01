/**
 * Jordan hero sandstorm — canvas grains + CSS veils over the cityscape.
 * Gusts surge; particles blow hard across silhouettes. Reduced-motion → static haze.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DESKTOP_COUNT = 320;
  const MOBILE_COUNT = 160;
  const WIND_BASE = { x: -3.8, y: 0.55 };

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function isDark() {
    return document.body.classList.contains('dark-mode');
  }

  function setCssPaused(root, paused) {
    const state = paused ? 'paused' : 'running';
    const atmos = document.getElementById('jdHeroAtmos');
    if (atmos) {
      atmos.querySelectorAll(
        '.jd-hero-sky, .jd-hero-heat, .jd-hero-sand, .jd-hero-arch, .jd-hero-dune, .jd-hero-storm-veil, .jd-hero-city'
      ).forEach((el) => {
        el.style.animationPlayState = state;
      });
    }
    if (root) {
      root.querySelectorAll('.jd-hero-mote').forEach((el) => {
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
      mote.className = 'jd-hero-mote' + (i % 3 === 0 ? ' is-grain' : '');
      mote.style.left = `${Math.random() * 100}%`;
      mote.style.animationDuration = `${8 + Math.random() * 10}s`;
      mote.style.animationDelay = `${Math.random() * 8}s`;
      mote.style.setProperty('--jd-drift-x', `${(-120 - Math.random() * 160).toFixed(0)}px`);
      mote.style.setProperty('--jd-spin', `${(Math.random() * 200 - 100).toFixed(0)}deg`);
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
      const fromRight = Math.random() > 0.15;
      return {
        x: partial ? Math.random() * w : fromRight ? w + Math.random() * 40 : Math.random() * w,
        y: Math.random() * h * 1.1 - h * 0.05,
        vx: WIND_BASE.x * (0.65 + Math.random() * 0.9),
        vy: WIND_BASE.y * (0.4 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.4,
        size: 0.25 + Math.random() * 0.7,
        len: 1 + Math.random() * 4,
        alpha: 0.1 + Math.random() * 0.28,
        streak: Math.random() > 0.82,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.05,
      };
    }

    function resize() {
      const rect = hero.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = particleCount();
      if (particles.length !== n) {
        particles = Array.from({ length: n }, () => spawn(true));
      }
    }

    function gust(now) {
      const elapsed = (now - t0) / 1000;
      // Dual-frequency gust: slow swell + sharper bursts
      const swell = 0.55 + 0.45 * Math.sin(elapsed * 0.55);
      const burst = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 1.7 + 1.2), 3);
      return swell * burst;
    }

    function tick(now) {
      if (!running) return;
      raf = requestAnimationFrame(tick);

      const g = gust(now);
      const dark = isDark();
      const windMul = 1.15 + g * 1.85;

      ctx.clearRect(0, 0, w, h);

      // Soft full-field haze only — no hard-edged sheets
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      if (dark) {
        wash.addColorStop(0, `rgba(60, 42, 22, ${0.04 + g * 0.05})`);
        wash.addColorStop(0.55, `rgba(120, 85, 45, ${0.08 + g * 0.1})`);
        wash.addColorStop(1, `rgba(90, 60, 30, ${0.1 + g * 0.08})`);
      } else {
        wash.addColorStop(0, `rgba(220, 190, 140, ${0.03 + g * 0.04})`);
        wash.addColorStop(0.55, `rgba(200, 160, 100, ${0.06 + g * 0.08})`);
        wash.addColorStop(1, `rgba(160, 110, 55, ${0.08 + g * 0.06})`);
      }
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      const grain = dark ? 'rgba(230, 200, 150,' : 'rgba(120, 85, 45,';
      const streak = dark ? 'rgba(212, 162, 76,' : 'rgba(138, 100, 55,';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.wobble += p.wobbleSpeed;
        p.x += p.vx * windMul + Math.sin(p.wobble) * 0.35;
        p.y += p.vy * windMul + Math.cos(p.wobble * 0.7) * 0.2;

        if (p.x < -30 || p.y > h + 20 || p.y < -30) {
          particles[i] = spawn(false);
          continue;
        }

        const a = Math.min(0.55, p.alpha * (0.45 + g * 0.45));
        if (p.streak) {
          ctx.strokeStyle = `${streak}${a})`;
          ctx.lineWidth = Math.max(0.35, p.size * 0.4);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.len * windMul * 0.4, p.y + p.len * 0.12);
          ctx.stroke();
        } else {
          ctx.fillStyle = `${grain}${a})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 0.9, p.size * 0.45, -0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sync CSS gust intensity for veil layers
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
      setCssPaused(null, !shouldRun);
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

    const themeObs = new MutationObserver(() => {
      /* colors read each frame via isDark() */
    });
    themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    sync();

    return {
      dispose() {
        stop();
        io.disconnect();
        themeObs.disconnect();
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

    // Canvas unavailable — CSS motes still blow sideways
    if (motes) {
      seedFallbackMotes(motes, isMobile() ? 18 : 28);
      let visible = true;
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          setCssPaused(motes, !visible || document.hidden);
        },
        { threshold: 0.05 }
      );
      io.observe(hero);
      document.addEventListener('visibilitychange', () => {
        setCssPaused(motes, document.hidden || !visible);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
