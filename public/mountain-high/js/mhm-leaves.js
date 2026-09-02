/**
 * Falling cannabis leaves — canvas, pause offscreen / reduced motion
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function drawLeaf(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.15, -size * 0.35, size * 0.55, -size * 0.15, size * 0.22, size * 0.08);
    ctx.bezierCurveTo(size * 0.72, size * 0.02, size * 0.62, size * 0.42, size * 0.12, size * 0.28);
    ctx.bezierCurveTo(size * 0.38, size * 0.62, size * 0.08, size * 0.78, 0, size * 0.42);
    ctx.bezierCurveTo(-size * 0.08, size * 0.78, -size * 0.38, size * 0.62, -size * 0.12, size * 0.28);
    ctx.bezierCurveTo(-size * 0.62, size * 0.42, -size * 0.72, size * 0.02, -size * 0.22, size * 0.08);
    ctx.bezierCurveTo(-size * 0.55, -size * 0.15, -size * 0.15, -size * 0.35, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 20, 8, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.85);
    ctx.lineTo(0, size * 0.35);
    ctx.stroke();
  }

  function mount(canvas) {
    if (!canvas || prefersReduced()) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const colors = ['#3d8f4a', '#6bcf6b', '#9dffc4', '#2d6a38', '#c8ff4a'];
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    const leaves = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(fromTop) {
      return {
        x: Math.random() * w,
        y: fromTop ? -30 : Math.random() * h,
        size: 9 + Math.random() * 16,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.04,
        vy: 0.35 + Math.random() * 0.85,
        vx: (Math.random() - 0.5) * 0.6,
        color: colors[(Math.random() * colors.length) | 0],
      };
    }

    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      for (const leaf of leaves) {
        leaf.y += leaf.vy;
        leaf.x += leaf.vx + Math.sin(leaf.y * 0.012) * 0.4;
        leaf.rot += leaf.spin;
        if (leaf.y > h + 40) {
          leaf.y = -30;
          leaf.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.rot);
        ctx.globalAlpha = 0.72;
        drawLeaf(ctx, leaf.size, leaf.color);
        ctx.restore();
      }
    }

    resize();
    const count = w < 700 ? 8 : 28;
    for (let i = 0; i < count; i++) leaves.push(spawn(false));
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && running && !raf) raf = requestAnimationFrame(tick);
    });
    raf = requestAnimationFrame(tick);

    return {
      dispose() {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      },
    };
  }

  root.MhmLeaves = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
