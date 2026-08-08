/**
 * Oman hero atmosphere — sandstorm grit + desert dusk/night sky sparkle.
 * Canvas 2D only; reduced-motion → static paint; RAF pauses when hidden/offscreen.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DESKTOP_GRIT = 70;
  const MOBILE_GRIT = 36;
  const DESKTOP_STARS = 320;
  const MOBILE_STARS = 180;
  const DESKTOP_MOTES = 22;
  const MOBILE_MOTES = 12;
  const VENUS_COUNT = 3;
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
    const atmos = document.getElementById('omHeroAtmos');
    if (atmos) {
      atmos.querySelectorAll(
        '.om-hero-sky, .om-hero-heat, .om-hero-horizon-glow, .om-hero-sand, .om-hero-arch, .om-hero-dune, .om-hero-city, .om-hero-silhouettes'
      ).forEach((el) => {
        el.style.animationPlayState = state;
      });
    }
    const portrait = document.querySelector('#omGuide:not(.is-speaking) .om-guide-portrait');
    if (portrait) portrait.style.animationPlayState = state;
  }

  function seedFallbackMotes(root, count) {
    root.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const mote = document.createElement('span');
      mote.className = 'om-hero-mote' + (i % 2 === 0 ? ' is-grain' : '');
      mote.style.left = `${Math.random() * 100}%`;
      mote.style.top = `${20 + Math.random() * 70}%`;
      mote.style.animationDuration = `${5 + Math.random() * 6}s`;
      mote.style.animationDelay = `${Math.random() * 5}s`;
      mote.style.setProperty('--om-drift-x', `${(-160 - Math.random() * 100).toFixed(0)}px`);
      mote.style.setProperty('--om-spin', `${(Math.random() * 40 - 20).toFixed(0)}deg`);
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
      return isMobile() ? MOBILE_GRIT : DESKTOP_GRIT;
    }

    function spawn(partial) {
      const fromRight = Math.random() > 0.2;
      const gold = Math.random() > 0.78;
      return {
        x: partial ? Math.random() * w : fromRight ? w + Math.random() * 12 : Math.random() * w,
        y: Math.random() * h,
        vx: WIND.x * (0.7 + Math.random() * 0.9),
        vy: WIND.y * (0.4 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.15,
        size: 0.4 + Math.random() * 0.55,
        len: 2 + Math.random() * 5,
        alpha: 0.16 + Math.random() * 0.28,
        streak: Math.random() > 0.35,
        gold,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.04,
        glintPhase: Math.random() * Math.PI * 2,
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
      const t = (now - t0) / 1000;

      ctx.clearRect(0, 0, w, h);

      const grain = dark ? 'rgba(232, 205, 155,' : 'rgba(105, 75, 40,';
      const streak = dark ? 'rgba(215, 175, 110,' : 'rgba(125, 90, 50,';
      const goldFill = dark ? 'rgba(212, 162, 76,' : 'rgba(180, 130, 55,';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.wobble += p.wobbleSpeed;
        p.x += p.vx * windMul + Math.sin(p.wobble) * 0.3;
        p.y += p.vy * windMul + Math.cos(p.wobble) * 0.12;

        if (p.x < -20 || p.y > h + 8 || p.y < -8) {
          particles[i] = spawn(false);
          continue;
        }

        let a = Math.min(0.45, p.alpha * (0.7 + g * 0.3));
        if (p.gold) {
          // Occasional sand-gold catch-light — wind sparkle, not Christmas blink
          a = Math.min(0.55, a * (0.85 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.1 + p.glintPhase))));
        }

        if (p.streak) {
          ctx.strokeStyle = `${p.gold ? goldFill : streak}${a})`;
          ctx.lineWidth = Math.max(0.35, p.size * (p.gold ? 0.55 : 0.4));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.len * windMul, p.y + p.len * 0.08);
          ctx.stroke();
        } else {
          ctx.fillStyle = `${p.gold ? goldFill : grain}${a})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * (p.gold ? 1.05 : 0.85), p.size * 0.35, -0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      hero.style.setProperty('--om-gust', g.toFixed(3));
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

  /**
   * Sparse desert sky: star twinkle, slow Venus pulses, fine gold dust.
   * Upper sky denser; fades toward horizon so copy stays clear.
   */
  function createSkySparkle(canvas, hero, options) {
    const staticOnly = !!(options && options.staticOnly);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    let stars = [];
    let motes = [];
    let planets = [];
    let raf = 0;
    let running = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t0 = performance.now();
    let ownsPause = !(options && options.sharedPause);

    function counts() {
      const mobile = isMobile();
      return {
        stars: mobile ? MOBILE_STARS : DESKTOP_STARS,
        motes: mobile ? MOBILE_MOTES : DESKTOP_MOTES,
        planets: VENUS_COUNT,
      };
    }

    function seedStar() {
      // Bias toward upper sky; mostly tiny faint pinpricks, few brighter anchors
      const u = Math.random();
      const yNorm = u * u * 0.78;
      const tier = Math.random();
      let r;
      let base;
      if (tier < 0.72) {
        // Distant dust — dense field, soft
        r = 0.2 + Math.random() * 0.35;
        base = 0.08 + Math.random() * 0.18;
      } else if (tier < 0.93) {
        // Mid stars
        r = 0.35 + Math.random() * 0.55;
        base = 0.16 + Math.random() * 0.28;
      } else {
        // Occasional brighter gem
        r = 0.55 + Math.random() * 0.75;
        base = 0.28 + Math.random() * 0.35;
      }
      return {
        x: Math.random(),
        y: yNorm,
        r,
        base,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.75,
        warm: Math.random() > 0.62,
      };
    }

    function seedMote() {
      return {
        x: Math.random(),
        y: 0.15 + Math.random() * 0.7,
        vx: -0.008 - Math.random() * 0.018,
        vy: (Math.random() - 0.5) * 0.006,
        r: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        alpha: 0.12 + Math.random() * 0.28,
      };
    }

    function seedPlanet(i) {
      // Brighter “Venus” anchors — sparse, slow pulse
      const slots = [
        { x: 0.78, y: 0.12 },
        { x: 0.18, y: 0.2 },
        { x: 0.55, y: 0.08 },
      ];
      const s = slots[i % slots.length];
      return {
        x: s.x + (Math.random() - 0.5) * 0.06,
        y: s.y + (Math.random() - 0.5) * 0.04,
        r: 1.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.22 + Math.random() * 0.18,
        base: 0.35 + Math.random() * 0.25,
      };
    }

    function reseed() {
      const c = counts();
      stars = Array.from({ length: c.stars }, () => seedStar());
      motes = Array.from({ length: c.motes }, () => seedMote());
      planets = Array.from({ length: c.planets }, (_, i) => seedPlanet(i));
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stars.length || stars.length !== counts().stars) reseed();
    }

    function paint(now) {
      const dark = isDark();
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      // Light mode: warm dusk pinpricks; dark: clearer night stars
      const starCool = dark ? '255, 244, 220' : '255, 236, 200';
      const starWarm = dark ? '212, 162, 76' : '180, 120, 50';
      const moteRgb = dark ? '212, 162, 76' : '168, 120, 55';
      const venusRgb = dark ? '246, 230, 196' : '212, 162, 76';
      const starMul = dark ? 1 : 0.42;
      const moteMul = dark ? 1 : 0.55;

      // Horizon vignette so sparkle stays atmospheric, not on copy
      // (stars already biased up; soft alpha falloff by y)

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const tw = staticOnly
          ? s.base
          : s.base * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)));
        const falloff = 1 - Math.max(0, (s.y - 0.45) / 0.4);
        const a = Math.max(0, tw * starMul * falloff);
        if (a < 0.02) continue;
        const px = s.x * w;
        const py = s.y * h;
        const rgb = s.warm ? starWarm : starCool;
        // Soft halo — ~2× glow on every star
        const glowR = Math.max(2.2, s.r * 4.4);
        const glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        glow.addColorStop(0, `rgba(${rgb},${Math.min(0.95, a * 0.85).toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(${rgb},${(a * 0.28).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${rgb},${Math.min(1, a * 1.15).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
        // Cross glint only on the brightest gems — keep the dense field calm
        if (a > 0.38 && s.r > 0.85) {
          ctx.strokeStyle = `rgba(${rgb},${(a * 0.4).toFixed(3)})`;
          ctx.lineWidth = 0.45;
          ctx.beginPath();
          ctx.moveTo(px - s.r * 2.6, py);
          ctx.lineTo(px + s.r * 2.6, py);
          ctx.moveTo(px, py - s.r * 2.6);
          ctx.lineTo(px, py + s.r * 2.6);
          ctx.stroke();
        }
      }

      for (let i = 0; i < planets.length; i += 1) {
        const p = planets[i];
        const pulse = staticOnly
          ? p.base
          : p.base * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase)));
        const a = pulse * (dark ? 0.85 : 0.4);
        const px = p.x * w;
        const py = p.y * h;
        const soft = ctx.createRadialGradient(px, py, 0, px, py, p.r * 10);
        soft.addColorStop(0, `rgba(${venusRgb},${(a * 0.85).toFixed(3)})`);
        soft.addColorStop(0.35, `rgba(${venusRgb},${(a * 0.36).toFixed(3)})`);
        soft.addColorStop(1, `rgba(${venusRgb},0)`);
        ctx.fillStyle = soft;
        ctx.beginPath();
        ctx.arc(px, py, p.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${venusRgb},${Math.min(0.95, a + 0.15).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i];
        if (!staticOnly) {
          m.x += m.vx / Math.max(w, 1);
          m.y += m.vy / Math.max(h, 1) + Math.sin(t * m.speed + m.phase) * 0.00035;
          if (m.x < -0.02) m.x = 1.02;
          if (m.y < 0.05) m.y = 0.05;
          if (m.y > 0.85) m.y = 0.85;
        }
        const shimmer = staticOnly
          ? m.alpha
          : m.alpha * (0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * m.speed * 1.4 + m.phase)));
        const a = shimmer * moteMul;
        const px = m.x * w;
        const py = m.y * h;
        ctx.fillStyle = `rgba(${moteRgb},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(px, py, m.r, m.r * 0.45, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick(now) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      paint(now);
    }

    function start() {
      if (staticOnly || running) return;
      running = true;
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!staticOnly) ctx.clearRect(0, 0, w, h);
    }

    function sync() {
      const shouldRun = visible && !document.hidden;
      if (ownsPause) setCssPaused(!shouldRun);
      if (staticOnly) {
        if (shouldRun) paint(performance.now());
        return;
      }
      if (shouldRun) start();
      else stop();
    }

    function onResize() {
      const prevW = w;
      resize();
      if (staticOnly || Math.abs(prevW - w) > 40) {
        reseed();
        if (staticOnly || !running) paint(performance.now());
      }
    }

    resize();
    reseed();
    paint(performance.now());

    window.addEventListener('resize', onResize);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.05 }
    );
    io.observe(hero);

    document.addEventListener('visibilitychange', sync);

    // Dark-mode toggle: repaint so star brightness matches theme
    const themeObs = new MutationObserver(() => {
      if (visible && !document.hidden) paint(performance.now());
    });
    themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (!staticOnly) sync();

    return {
      dispose() {
        stop();
        io.disconnect();
        themeObs.disconnect();
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', sync);
        ctx.clearRect(0, 0, w, h);
      },
    };
  }

  function init() {
    const hero = document.getElementById('omHero');
    const motes = document.getElementById('omHeroMotes');
    const stormCanvas = document.getElementById('omSandstorm');
    const sparkleCanvas = document.getElementById('omSkySparkle');
    if (!hero) return;

    hero.classList.add('is-sandstorm');

    if (prefersReducedMotion()) {
      if (motes) motes.innerHTML = '';
      if (stormCanvas) stormCanvas.hidden = true;
      hero.classList.add('is-sandstorm-static');
      // Single static starfield + horizon glow (CSS); no idle loops
      if (sparkleCanvas) {
        createSkySparkle(sparkleCanvas, hero, { staticOnly: true, sharedPause: true });
      }
      return;
    }

    let stormOk = false;
    if (stormCanvas) {
      const storm = createStorm(stormCanvas, hero);
      if (storm) {
        stormOk = true;
        if (motes) motes.innerHTML = '';
      }
    }

    // Storm owns CSS pause when present; otherwise sparkle (or mote fallback) does.
    if (sparkleCanvas) {
      createSkySparkle(sparkleCanvas, hero, { sharedPause: stormOk });
    }

    if (stormOk) return;

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
