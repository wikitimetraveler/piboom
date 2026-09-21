/**
 * Rose parlor — shuffle, deal, and reveal ceremony for the birthday spread.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeTl = null;
  let visibilityBound = false;

  function t(key, fallback) {
    const value = window.AstrologyI18N?.t?.(key);
    return value || fallback || '';
  }

  function setStatus(table, message) {
    const el = table?.querySelector?.('[data-spread-status]');
    if (el) el.textContent = message || '';
  }

  function killTimeline() {
    if (activeTl && typeof activeTl.kill === 'function') {
      try {
        activeTl.kill();
      } catch (_) {
        /* ignore */
      }
    }
    activeTl = null;
    document.querySelectorAll('.astro-deck-flyer').forEach((node) => node.remove());
  }

  function finishInstant(table) {
    const pile = table.querySelector('#astroDeckPile');
    if (pile) pile.hidden = true;
    table.classList.remove('is-ceremony');
    table.querySelectorAll('.astro-spread-card--tarot').forEach((card) => {
      card.classList.remove('is-pending');
      card.classList.add('is-dealt', 'is-revealed');
      card.dataset.phase = 'art';
    });
    setStatus(table, t('ceremonyReady', "Tap a card for Rose's reading."));
  }

  function sheetCount() {
    return 12;
  }

  function buildPileMarkup() {
    const n = sheetCount();
    let html = '';
    for (let i = 0; i < n; i += 1) {
      const y = (i - n / 2) * 0.55;
      const r = (i - n / 2) * 0.35;
      html += `<div class="astro-deck-sheet" style="transform: translate(${y * 0.15}px, ${y}px) rotate(${r}deg); z-index: ${i + 1}" aria-hidden="true"></div>`;
    }
    return html;
  }

  function ensureVisibilityPause() {
    if (visibilityBound) return;
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && activeTl && typeof activeTl.pause === 'function') {
        activeTl.pause();
      } else if (!document.hidden && activeTl && typeof activeTl.resume === 'function') {
        activeTl.resume();
      }
    });
  }

  function rectCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  function playCeremony(table, opts) {
    if (!table) return;
    killTimeline();
    ensureVisibilityPause();

    const seed = (Number(opts?.seed) >>> 0) || 1;
    const cards = Array.from(table.querySelectorAll('.astro-spread-card--tarot'));
    const pile = table.querySelector('#astroDeckPile');

    if (reduceMotion || !window.gsap || typeof window.gsap.timeline !== 'function') {
      finishInstant(table);
      return;
    }

    table.classList.add('is-ceremony');
    cards.forEach((card) => {
      card.classList.add('is-pending');
      card.classList.remove('is-dealt', 'is-revealed', 'is-reading');
      card.dataset.phase = 'back';
      const oracle = card.querySelector('.astro-tarot-oracle');
      if (oracle) oracle.hidden = true;
      card.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    });

    if (pile) {
      pile.hidden = false;
      pile.innerHTML = buildPileMarkup();
    }

    setStatus(table, t('ceremonyShuffle', 'Rose shuffles the deck…'));

    const gsap = window.gsap;
    const sheets = pile ? Array.from(pile.querySelectorAll('.astro-deck-sheet')) : [];
    const nudge = ((seed % 7) + 1) * 0.02;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        activeTl = null;
        table.classList.remove('is-ceremony');
        if (pile) pile.hidden = true;
        setStatus(table, t('ceremonyReady', "Tap a card for Rose's reading."));
      },
    });
    activeTl = tl;

    // Beat 1 — riffle shuffle
    sheets.forEach((sheet, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const amp = 18 + (i % 4) * 3;
      tl.to(
        sheet,
        {
          x: side * amp,
          y: -6 - (i % 3) * 2,
          rotation: side * (8 + (i % 5)),
          duration: 0.16 + nudge,
        },
        i * 0.04
      );
      tl.to(
        sheet,
        {
          x: 0,
          y: (i - sheets.length / 2) * 0.55,
          rotation: (i - sheets.length / 2) * 0.35,
          duration: 0.18,
        },
        i * 0.04 + 0.18
      );
    });

    tl.addLabel('dealt', '+=0.12');
    tl.call(() => setStatus(table, t('ceremonyDeal', 'Dealing Situation · Cross · Path…')), null, 'dealt');

    // Beat 2 — deal flyers into slots
    cards.forEach((card, index) => {
      const at = `dealt+=${index * (0.22 + nudge * 0.5)}`;
      tl.call(
        () => {
          if (!pile) {
            card.classList.remove('is-pending');
            card.classList.add('is-dealt');
            return;
          }
          const from = rectCenter(pile);
          const to = rectCenter(card);
          const flyer = document.createElement('div');
          flyer.className = 'astro-deck-flyer';
          flyer.setAttribute('aria-hidden', 'true');
          const fw = Math.max(72, Math.min(to.w * 0.72, 120));
          const fh = fw * (10.4 / 7.2);
          flyer.style.width = `${fw}px`;
          flyer.style.height = `${fh}px`;
          flyer.style.left = `${from.x - fw / 2}px`;
          flyer.style.top = `${from.y - fh / 2}px`;
          document.body.appendChild(flyer);

          gsap.fromTo(
            flyer,
            { left: from.x - fw / 2, top: from.y - fh / 2, rotation: -12 + index * 6, opacity: 1 },
            {
              left: to.x - fw / 2,
              top: to.y - fh / 2,
              rotation: 0,
              duration: 0.45,
              ease: 'power3.out',
              onComplete: () => {
                flyer.remove();
                card.classList.remove('is-pending');
                card.classList.add('is-dealt');
              },
            }
          );
        },
        null,
        at
      );
    });

    // Beat 3 — sequential reveal
    const revealStart = `dealt+=${cards.length * 0.28 + 0.35}`;
    tl.call(() => setStatus(table, t('ceremonyReveal', 'Rose turns the cards…')), null, revealStart);

    cards.forEach((card, index) => {
      tl.call(
        () => {
          card.classList.add('is-revealed');
          card.dataset.phase = 'art';
        },
        null,
        `${revealStart}+=${index * 0.72}`
      );
    });

    tl.to({}, { duration: 0.05 }, `${revealStart}+=${Math.max(cards.length, 1) * 0.72}`);
  }

  function cancelCeremony() {
    killTimeline();
    document.querySelectorAll('.astro-spread.is-ceremony').forEach((table) => {
      table.classList.remove('is-ceremony');
    });
  }

  window.AstrologyTarotCeremony = {
    play: playCeremony,
    cancel: cancelCeremony,
    buildPileMarkup,
    finishInstant,
  };
})();
