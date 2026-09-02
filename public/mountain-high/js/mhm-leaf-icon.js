/**
 * Canonical 5-lobe cannabis leaf — the common icon (center + 2 mid + 2 lower).
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  /** viewBox 0 0 100 100 — filled silhouette, stem at bottom center */
  const PATH_5 =
    'M50 4'
    + 'C51.5 14 53 20 50 26'
    + 'C58 16 68 18 76 28'
    + 'C71 34 66 40 69 48'
    + 'C79 46 87 54 90 64'
    + 'C80 64 70 67 64 74'
    + 'C62 81 57 88 50 96'
    + 'C43 88 38 81 36 74'
    + 'C30 67 20 64 10 64'
    + 'C13 54 21 46 31 48'
    + 'C34 40 29 34 24 28'
    + 'C32 18 42 16 50 26'
    + 'C47 20 48.5 14 50 4Z';

  const VEIN =
    'M50 26V88';

  function svgMarkup(opts) {
    const vb = (opts && opts.viewBox) || '0 0 100 100';
    const cls = (opts && opts.className) ? ` class="${opts.className}"` : '';
    const vein = opts && opts.vein === false
      ? ''
      : `<path fill="none" stroke="#050010" stroke-width="1.6" stroke-linecap="round" opacity=".32" d="${VEIN}"/>`;
    return `<svg${cls} viewBox="${vb}" aria-hidden="true">`
      + `<path fill="currentColor" d="${PATH_5}"/>`
      + vein
      + '</svg>';
  }

  /** Canvas draw — same 5-lobe shape, size = half-height in px */
  function draw(ctx, size, color) {
    const s = size / 50;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -0.92 * size);
    ctx.bezierCurveTo(0.03 * size, -0.72 * size, 0.06 * size, -0.56 * size, 0, -0.48 * size);
    ctx.bezierCurveTo(0.16 * size, -0.68 * size, 0.32 * size, -0.64 * size, 0.52 * size, -0.44 * size);
    ctx.bezierCurveTo(0.42 * size, -0.32 * size, 0.32 * size, -0.2 * size, 0.38 * size, -0.04 * size);
    ctx.bezierCurveTo(0.58 * size, -0.08 * size, 0.74 * size, 0.08 * size, 0.8 * size, 0.28 * size);
    ctx.bezierCurveTo(0.6 * size, 0.28 * size, 0.4 * size, 0.34 * size, 0.28 * size, 0.48 * size);
    ctx.bezierCurveTo(0.24 * size, 0.62 * size, 0.14 * size, 0.72 * size, 0, 0.92 * size);
    ctx.bezierCurveTo(-0.14 * size, 0.72 * size, -0.24 * size, 0.62 * size, -0.28 * size, 0.48 * size);
    ctx.bezierCurveTo(-0.4 * size, 0.34 * size, -0.6 * size, 0.28 * size, -0.8 * size, 0.28 * size);
    ctx.bezierCurveTo(-0.74 * size, 0.08 * size, -0.58 * size, -0.08 * size, -0.38 * size, -0.04 * size);
    ctx.bezierCurveTo(-0.32 * size, -0.2 * size, -0.42 * size, -0.32 * size, -0.52 * size, -0.44 * size);
    ctx.bezierCurveTo(-0.32 * size, -0.64 * size, -0.16 * size, -0.68 * size, 0, -0.48 * size);
    ctx.bezierCurveTo(-0.06 * size, -0.56 * size, -0.03 * size, -0.72 * size, 0, -0.92 * size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 20, 8, 0.35)';
    ctx.lineWidth = Math.max(0.6, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -0.48 * size);
    ctx.lineTo(0, 0.76 * size);
    ctx.stroke();
  }

  root.MhmLeafIcon = {
    PATH_5,
    svgMarkup,
    draw,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
