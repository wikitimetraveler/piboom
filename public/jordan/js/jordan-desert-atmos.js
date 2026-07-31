/**
 * Jordan hero desert atmosphere — soft sand motes only.
 * CSS handles dunes / heat / arches; this seeds a few floating grains.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const MOTE_COUNT = 7;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function seedMotes(root) {
    root.innerHTML = '';
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const mote = document.createElement('span');
      mote.className = 'jd-hero-mote' + (i % 3 === 0 ? ' is-grain' : '');
      mote.style.left = `${Math.random() * 100}%`;
      mote.style.animationDuration = `${14 + Math.random() * 18}s`;
      mote.style.animationDelay = `${Math.random() * 12}s`;
      mote.style.setProperty('--jd-drift-x', `${(Math.random() * 80 - 40).toFixed(0)}px`);
      mote.style.setProperty('--jd-spin', `${(Math.random() * 200 - 100).toFixed(0)}deg`);
      root.appendChild(mote);
    }
  }

  function setPaused(root, paused) {
    const state = paused ? 'paused' : 'running';
    root.style.animationPlayState = state;
    root.querySelectorAll('.jd-hero-mote').forEach((el) => {
      el.style.animationPlayState = state;
    });
    const atmos = document.getElementById('jdHeroAtmos');
    if (atmos) {
      atmos.querySelectorAll('.jd-hero-sky, .jd-hero-heat, .jd-hero-sand, .jd-hero-arch, .jd-hero-dune').forEach((el) => {
        el.style.animationPlayState = state;
      });
    }
    const portrait = document.querySelector('#jdGuide:not(.is-speaking) .jd-guide-portrait');
    if (portrait) portrait.style.animationPlayState = state;
  }

  function init() {
    const hero = document.getElementById('jdHero');
    const motes = document.getElementById('jdHeroMotes');
    if (!hero || !motes) return;

    if (prefersReducedMotion()) {
      motes.innerHTML = '';
      return;
    }

    seedMotes(motes);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        setPaused(motes, !visible || document.hidden);
      },
      { threshold: 0.05 }
    );
    io.observe(hero);

    document.addEventListener('visibilitychange', () => {
      setPaused(motes, document.hidden || !visible);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
