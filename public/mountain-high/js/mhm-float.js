/**
 * Floating flower-power layer — leaves (canvas) + peace, bears, daisies (DOM)
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const PEACE_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 12v40M32 32L14 44M32 32l18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  const BEAR_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="38" rx="16" ry="18" fill="currentColor"/><circle cx="22" cy="20" r="7" fill="currentColor"/><circle cx="42" cy="20" r="7" fill="currentColor"/><path d="M18 36c-6 4-8 14-2 20M46 36c6 4 8 14 2 20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M26 44h12" stroke="#050010" stroke-width="2" stroke-linecap="round"/></svg>';
  const FLOWER_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="#ff7a2d"/><g fill="currentColor"><ellipse cx="32" cy="14" rx="7" ry="12"/><ellipse cx="32" cy="50" rx="7" ry="12"/><ellipse cx="14" cy="32" rx="12" ry="7"/><ellipse cx="50" cy="32" rx="12" ry="7"/><ellipse cx="18" cy="18" rx="7" ry="12" transform="rotate(-45 18 18)"/><ellipse cx="46" cy="18" rx="7" ry="12" transform="rotate(45 46 18)"/><ellipse cx="18" cy="46" rx="7" ry="12" transform="rotate(45 18 46)"/><ellipse cx="46" cy="46" rx="7" ry="12" transform="rotate(-45 46 46)"/></g></svg>';
  const LEAF_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M32 8c4 14 18 20 10 32 20-2 22 14 8 18 12 10 2 18-10 12 4 14-10 18-12 10-4 14-24 8-20-12-14 8-22-2-14-20 6-16-6-10 5-16 8-32z"/></svg>';

  const KINDS = [
    { kind: 'peace', html: PEACE_SVG, colors: ['#9dffc4', '#c8ff4a', '#ff7a2d'] },
    { kind: 'bear', html: BEAR_SVG, colors: ['#7b3cff', '#e8d5a3', '#ff7a2d', '#9dffc4'] },
    { kind: 'flower', html: FLOWER_SVG, colors: ['#ff7a2d', '#c8ff4a', '#ff6eb4', '#9dffc4'] },
    { kind: 'leaf', html: LEAF_SVG, colors: ['#3d8f4a', '#6bcf6b', '#9dffc4', '#c8ff4a'] },
  ];

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function spawnDomFloat(layer) {
    const pick = KINDS[(Math.random() * KINDS.length) | 0];
    const el = document.createElement('span');
    el.className = `mhm-float mhm-float--${pick.kind}`;
    el.innerHTML = pick.html;
    const color = pick.colors[(Math.random() * pick.colors.length) | 0];
    el.style.color = color;
    el.style.left = `${Math.random() * 100}%`;
    el.style.setProperty('--mhm-drift-x', `${(Math.random() - 0.5) * 120}px`);
    el.style.setProperty('--mhm-float-dur', `${14 + Math.random() * 18}s`);
    el.style.setProperty('--mhm-float-delay', `${Math.random() * 12}s`);
    el.style.setProperty('--mhm-float-size', `${18 + Math.random() * 28}px`);
    el.style.setProperty('--mhm-spin', `${(Math.random() - 0.5) * 720}deg`);
    layer.appendChild(el);
    el.addEventListener('animationend', () => {
      el.remove();
      spawnDomFloat(layer);
    });
  }

  function mountDom(layer, count) {
    if (!layer || prefersReduced()) return;
    for (let i = 0; i < count; i++) spawnDomFloat(layer);
  }

  function mount(opts) {
    const canvas = opts?.canvas;
    const layer = opts?.layer;
    if (root.MhmLeaves?.mount) root.MhmLeaves.mount(canvas);
    const n = window.innerWidth < 700 ? 7 : 22;
    mountDom(layer, n);
  }

  root.MhmFloat = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
