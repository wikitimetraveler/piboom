/**
 * Glazed hero orb — canvas 2D orbital sprinkles (mouse-reactive)
 * Development work by David Lane
 */
(function () {
  'use strict';

  const SPRINKLE_COLORS = [
    '#ff7a9a',
    '#fff4e8',
    '#5c3a2a',
    '#f5c76a',
    '#7ec8e3',
    '#e85a7a',
    '#ffd98a',
    '#c4f0c2'
  ];

  const PARTICLE_COUNT = 40;
  const FLEE_RADIUS = 80;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initOrbParticles(orbEl) {
    if (!orbEl || prefersReducedMotion()) return null;

    const host = document.getElementById('gzOrbSprinkles') || orbEl;
    // Hide CSS sprinkles — canvas takes over
    host.innerHTML = '';
    host.classList.add('gz-orb-canvas-host');

    const canvas = document.createElement('canvas');
    canvas.className = 'gz-orb-particle-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    let visible = true;
    const mouse = { x: -9999, y: -9999, active: false };
    const particles = [];

    function resize() {
      const rect = orbEl.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const baseAngle = (i / PARTICLE_COUNT) * Math.PI * 2;
        particles.push({
          angle: baseAngle + Math.random() * 0.35,
          radius: 0.32 + Math.random() * 0.38,
          speed: 0.35 + Math.random() * 0.55,
          wobble: 0.4 + Math.random() * 0.8,
          phase: Math.random() * Math.PI * 2,
          length: 7 + Math.random() * 7,
          thickness: 2 + Math.random() * 2,
          rot: Math.random() * Math.PI,
          color: SPRINKLE_COLORS[i % SPRINKLE_COLORS.length],
          ox: 0,
          oy: 0,
          fleeX: 0,
          fleeY: 0
        });
      }
    }

    function onPointer(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    }

    function onLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    orbEl.addEventListener('pointermove', onPointer, { passive: true });
    orbEl.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('resize', resize, { passive: true });

    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible && running && !raf) tick();
    });

    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            visible = entries.some((en) => en.isIntersecting);
            if (visible && running && !raf) tick();
          },
          { threshold: 0.05 }
        )
      : null;
    if (io) io.observe(orbEl);

    let last = performance.now();

    function tick(now) {
      if (!running) return;
      raf = 0;
      if (!visible) return;
      raf = requestAnimationFrame(tick);
      const t = (now || performance.now()) / 1000;
      const dt = Math.min(0.05, ((now || performance.now()) - last) / 1000);
      last = now || performance.now();

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.5;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.angle += p.speed * dt * 0.55;
        const depth = 0.7 + 0.3 * Math.sin(t * p.wobble + p.phase);
        const rx = p.radius * baseR * (0.92 + 0.12 * Math.sin(t * 0.7 + p.phase));
        const ry = p.radius * baseR * 0.78 * depth;
        let x = cx + Math.cos(p.angle) * rx;
        let y = cy + Math.sin(p.angle) * ry;

        // Mouse flee (elastic spring)
        if (mouse.active) {
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < FLEE_RADIUS) {
            const force = ((FLEE_RADIUS - dist) / FLEE_RADIUS) * 18;
            p.fleeX += (dx / dist) * force;
            p.fleeY += (dy / dist) * force;
          }
        }
        p.fleeX *= 0.86;
        p.fleeY *= 0.86;
        x += p.fleeX;
        y += p.fleeY;

        p.ox = x;
        p.oy = y;
        p.rot += dt * 0.8;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.angle);
        ctx.globalAlpha = 0.55 + 0.4 * depth;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const hw = p.length / 2;
        const hh = p.thickness / 2;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-hw, -hh, p.length, p.thickness, 99);
        } else {
          ctx.rect(-hw, -hh, p.length, p.thickness);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    resize();
    seed();
    tick();

    return {
      dispose() {
        running = false;
        cancelAnimationFrame(raf);
        orbEl.removeEventListener('pointermove', onPointer);
        orbEl.removeEventListener('pointerleave', onLeave);
        window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        canvas.remove();
      }
    };
  }

  function boot() {
    const orb = document.getElementById('gzHeroOrb');
    if (!orb) return;
    window.GlazedOrbParticles = initOrbParticles(orb);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
