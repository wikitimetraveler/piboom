/**
 * Falling cannabis leaves — canvas, multiple leaf shapes, reduced motion aware
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function strokeLeaf(ctx, size) {
    ctx.strokeStyle = 'rgba(10, 20, 8, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.88);
    ctx.lineTo(0, size * 0.32);
    ctx.stroke();
  }

  /** Classic 7-finger */
  function drawLeafClassic(ctx, size, color) {
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
    strokeLeaf(ctx, size);
  }

  /** Narrow sativa-style */
  function drawLeafSativa(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.05);
    ctx.bezierCurveTo(size * 0.08, -size * 0.5, size * 0.22, -size * 0.2, size * 0.1, size * 0.05);
    ctx.bezierCurveTo(size * 0.35, -size * 0.05, size * 0.28, size * 0.35, size * 0.06, size * 0.22);
    ctx.bezierCurveTo(size * 0.2, size * 0.55, size * 0.04, size * 0.72, 0, size * 0.38);
    ctx.bezierCurveTo(-size * 0.04, size * 0.72, -size * 0.2, size * 0.55, -size * 0.06, size * 0.22);
    ctx.bezierCurveTo(-size * 0.28, size * 0.35, -size * 0.35, -size * 0.05, -size * 0.1, size * 0.05);
    ctx.bezierCurveTo(-size * 0.22, -size * 0.2, -size * 0.08, -size * 0.5, 0, -size * 1.05);
    ctx.closePath();
    ctx.fill();
    strokeLeaf(ctx, size);
  }

  /** Broad indica-style 5-lobe */
  function drawLeafBroad(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.92);
    ctx.bezierCurveTo(size * 0.42, -size * 0.55, size * 0.55, -size * 0.08, size * 0.28, size * 0.12);
    ctx.bezierCurveTo(size * 0.62, size * 0.08, size * 0.52, size * 0.48, size * 0.18, size * 0.32);
    ctx.bezierCurveTo(size * 0.32, size * 0.68, size * 0.1, size * 0.82, 0, size * 0.48);
    ctx.bezierCurveTo(-size * 0.1, size * 0.82, -size * 0.32, size * 0.68, -size * 0.18, size * 0.32);
    ctx.bezierCurveTo(-size * 0.52, size * 0.48, -size * 0.62, size * 0.08, -size * 0.28, size * 0.12);
    ctx.bezierCurveTo(-size * 0.55, -size * 0.08, -size * 0.42, -size * 0.55, 0, -size * 0.92);
    ctx.closePath();
    ctx.fill();
    strokeLeaf(ctx, size);
  }

  const DRAWERS = [drawLeafClassic, drawLeafSativa, drawLeafBroad];

  function mount(canvas, opts) {
    if (!canvas || prefersReduced()) return null;
    const leafCount = Math.max(0, Number(opts?.count) || 5);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const colors = ['#3d8f4a', '#6bcf6b', '#9dffc4', '#2d6a38', '#c8ff4a', '#5a9e48'];
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
        size: 9 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.03,
        vy: 0.28 + Math.random() * 0.65,
        vx: (Math.random() - 0.5) * 0.45,
        color: colors[(Math.random() * colors.length) | 0],
        draw: DRAWERS[(Math.random() * DRAWERS.length) | 0],
      };
    }

    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      for (const leaf of leaves) {
        leaf.y += leaf.vy;
        leaf.x += leaf.vx + Math.sin(leaf.y * 0.01) * 0.32;
        leaf.rot += leaf.spin;
        if (leaf.y > h + 40) {
          leaf.y = -30;
          leaf.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.rot);
        ctx.globalAlpha = 0.68;
        leaf.draw(ctx, leaf.size, leaf.color);
        ctx.restore();
      }
    }

    resize();
    const count = leafCount;
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
