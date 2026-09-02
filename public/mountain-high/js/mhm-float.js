/**
 * Floating flower-power layer — leaves (canvas) + peace, Dead bears, daisies (DOM)
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const PEACE_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 12v40M32 32L14 44M32 32l18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  /** Grateful Dead–inspired dancing bears (original silhouettes) */
  const BEAR_ARMS_UP =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="41" rx="13" ry="15" fill="currentColor"/><circle cx="32" cy="21" r="10" fill="currentColor"/><circle cx="25" cy="13" r="3.6" fill="currentColor"/><circle cx="39" cy="13" r="3.6" fill="currentColor"/><ellipse cx="32" cy="23" rx="3.2" ry="2.4" fill="#050010" opacity=".35"/><path d="M17 32 C9 20 11 8 19 5" stroke="currentColor" stroke-width="4.8" stroke-linecap="round" fill="none"/><path d="M47 32 C55 20 53 8 45 5" stroke="currentColor" stroke-width="4.8" stroke-linecap="round" fill="none"/><path d="M25 54 L21 60" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M39 54 L43 48" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg>';

  const BEAR_WAVE =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="34" cy="40" rx="14" ry="15" fill="currentColor"/><circle cx="34" cy="21" r="10" fill="currentColor"/><circle cx="27" cy="13" r="3.5" fill="currentColor"/><circle cx="41" cy="13" r="3.5" fill="currentColor"/><ellipse cx="36" cy="23" rx="3" ry="2.2" fill="#050010" opacity=".35"/><path d="M20 34 C12 24 14 10 24 8" stroke="currentColor" stroke-width="4.8" stroke-linecap="round" fill="none"/><path d="M46 36 L52 44" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M26 54 L24 60" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M42 54 L46 58" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg>';

  const BEAR_KICK =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="30" cy="40" rx="13" ry="14" fill="currentColor"/><circle cx="30" cy="21" r="10" fill="currentColor"/><circle cx="23" cy="13" r="3.5" fill="currentColor"/><circle cx="37" cy="13" r="3.5" fill="currentColor"/><ellipse cx="30" cy="23" rx="3" ry="2.2" fill="#050010" opacity=".35"/><path d="M16 33 C10 26 12 14 20 12" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M44 33 L48 26" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M22 52 L18 58" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M38 52 L46 50" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg>';

  const BEAR_STRUT =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="39" rx="12" ry="14" fill="currentColor"/><circle cx="32" cy="20" r="9.5" fill="currentColor"/><circle cx="26" cy="13" r="3.2" fill="currentColor"/><circle cx="38" cy="13" r="3.2" fill="currentColor"/><ellipse cx="32" cy="22" rx="2.8" ry="2" fill="#050010" opacity=".35"/><path d="M20 32 L14 28" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><path d="M44 32 L50 28" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><path d="M26 52 L22 58" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><path d="M38 52 L42 58" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/></svg>';

  const FLOWER_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="#ff7a2d"/><g fill="currentColor"><ellipse cx="32" cy="14" rx="7" ry="12"/><ellipse cx="32" cy="50" rx="7" ry="12"/><ellipse cx="14" cy="32" rx="12" ry="7"/><ellipse cx="50" cy="32" rx="12" ry="7"/><ellipse cx="18" cy="18" rx="7" ry="12" transform="rotate(-45 18 18)"/><ellipse cx="46" cy="18" rx="7" ry="12" transform="rotate(45 46 18)"/><ellipse cx="18" cy="46" rx="7" ry="12" transform="rotate(45 18 46)"/><ellipse cx="46" cy="46" rx="7" ry="12" transform="rotate(-45 46 46)"/></g></svg>';

  const LEAF_CLASSIC =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M32 6c2 12 14 18 8 28 18-2 20 12 6 16 10 8 0 16-10 10 3 12-8 16-10 8-3 12-22 6-18-10-12 6-20-2-12-18 5-14-4-8 4-14 6-28z"/></svg>';

  const LEAF_SATIVA =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M32 4c1 8 4 12 2 22 14-4 16 8 6 12 8 6-2 14-8 8 2 10-6 14-8 6-1 10-14 8-12-4-10 4-16-4-10-10 2-12-2-8 2-10 4-24z"/><path fill="none" stroke="#050010" stroke-width=".8" opacity=".35" d="M32 8v48"/></svg>';

  const LEAF_BROAD =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M32 10c-8 6-14 14-12 24-10 2-12 12-4 16-6 8 2 14 10 10-2 10 8 12 12 4 6 10 18 4 16-8 8 6 14 14 2 10-10 8-18 4-22-10 10-20 6-26-4z"/></svg>';

  const BEAR_COLORS = ['#e85a7a', '#ff7a2d', '#f5d547', '#9dffc4', '#5eb8ff', '#7b3cff', '#e8d5a3'];
  const LEAF_COLORS = ['#3d8f4a', '#6bcf6b', '#9dffc4', '#2d6a38', '#c8ff4a', '#5a9e48'];

  const BEAR_VARIANTS = [BEAR_ARMS_UP, BEAR_WAVE, BEAR_KICK, BEAR_STRUT];
  const LEAF_VARIANTS = [LEAF_CLASSIC, LEAF_SATIVA, LEAF_BROAD];

  const KINDS = [
    { kind: 'bear', pickHtml: () => BEAR_VARIANTS[(Math.random() * BEAR_VARIANTS.length) | 0], colors: BEAR_COLORS },
    { kind: 'bear', pickHtml: () => BEAR_VARIANTS[(Math.random() * BEAR_VARIANTS.length) | 0], colors: BEAR_COLORS },
    { kind: 'leaf', pickHtml: () => LEAF_VARIANTS[(Math.random() * LEAF_VARIANTS.length) | 0], colors: LEAF_COLORS },
    { kind: 'leaf', pickHtml: () => LEAF_VARIANTS[(Math.random() * LEAF_VARIANTS.length) | 0], colors: LEAF_COLORS },
    { kind: 'peace', pickHtml: () => PEACE_SVG, colors: ['#9dffc4', '#c8ff4a', '#ff7a2d'] },
    { kind: 'flower', pickHtml: () => FLOWER_SVG, colors: ['#ff7a2d', '#c8ff4a', '#ff6eb4', '#9dffc4'] },
  ];

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function spawnDomFloat(layer) {
    const pick = KINDS[(Math.random() * KINDS.length) | 0];
    const el = document.createElement('span');
    el.className = `mhm-float mhm-float--${pick.kind}`;
    el.innerHTML = typeof pick.pickHtml === 'function' ? pick.pickHtml() : pick.html;
    const color = pick.colors[(Math.random() * pick.colors.length) | 0];
    el.style.color = color;
    el.style.left = `${Math.random() * 100}%`;
    el.style.setProperty('--mhm-drift-x', `${(Math.random() - 0.5) * 100}px`);
    el.style.setProperty('--mhm-float-dur', `${22 + Math.random() * 24}s`);
    el.style.setProperty('--mhm-float-delay', `${Math.random() * 10}s`);
    el.style.setProperty('--mhm-float-size', `${20 + Math.random() * 24}px`);
    el.style.setProperty('--mhm-spin', `${(Math.random() - 0.5) * 540}deg`);
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
    const n = window.innerWidth < 700 ? 3 : 11;
    mountDom(layer, n);
  }

  root.MhmFloat = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
