/**
 * 2D canvas fallback when Three.js is unavailable.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('iceCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let floes = [];
  let rafId = 0;
  let t0 = 0;

  function resize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = wrap.clientWidth;
    height = wrap.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedFloes();
  }

  function seedFloes() {
    const count = Math.max(8, Math.floor((width * height) / 45000));
    floes = [];
    for (let i = 0; i < count; i += 1) {
      floes.push(makeFloe(Math.random() * width, Math.random() * height));
    }
  }

  function makeFloe(x, y) {
    const size = 28 + Math.random() * 64;
    return {
      x,
      y,
      size,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.00015,
      driftX: (Math.random() - 0.5) * 0.06,
      driftY: 0.015 + Math.random() * 0.035,
      alpha: 0.04 + Math.random() * 0.07,
      points: polygonPoints(6 + Math.floor(Math.random() * 2), size),
    };
  }

  function polygonPoints(n, radius) {
    const pts = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const r = radius * (0.75 + Math.random() * 0.3);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  function drawBackground(elapsed) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#1a4a6e');
    g.addColorStop(0.45, '#145878');
    g.addColorStop(1, '#0a2848');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const lightX = width * 0.5 + Math.sin(elapsed * 0.0002) * width * 0.15;
    const light = ctx.createRadialGradient(lightX, height * 0.1, 0, lightX, height * 0.3, width * 0.7);
    light.addColorStop(0, 'rgba(160, 210, 240, 0.12)');
    light.addColorStop(1, 'transparent');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFloe(floe) {
    ctx.save();
    ctx.translate(floe.x, floe.y);
    ctx.rotate(floe.rot);
    ctx.beginPath();
    floe.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 225, 245, ' + floe.alpha + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + floe.alpha * 1.2 + ')';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }

  function drawWaves(elapsed) {
    for (let i = 0; i < 4; i += 1) {
      const yBase = height * (0.06 + i * 0.18) + Math.sin(elapsed * 0.0003 + i * 1.4) * 5;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= width; x += 28) {
        const y = yBase + Math.sin(x * 0.006 + elapsed * 0.0004 + i) * 4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(120, 190, 230, ' + (0.04 + i * 0.02) + ')';
      ctx.fill();
    }
  }

  function tick(time) {
    if (!t0) t0 = time;
    const elapsed = time - t0;
    drawBackground(elapsed);
    drawWaves(elapsed);
    floes.forEach((f) => {
      f.x += f.driftX;
      f.y += f.driftY;
      f.rot += f.rotSpeed;
      if (f.y > height + f.size) {
        f.y = -f.size;
        f.x = Math.random() * width;
      }
      drawFloe(f);
    });
    if (!prefersReduced) rafId = requestAnimationFrame(tick);
  }

  function start() {
    resize();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  start();
})();
