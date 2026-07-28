/**
 * Glazed gallery — donuts + smoothies, flip cards, Pip guide
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DATA_URL = '/data/donuts-gallery.json';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Pip = young / playful baker — NOT matron Standard-F.
   * Neural2-H is brighter; server falls back to Wavenet-H then pitched Standard-F.
   */
  const PIP_TTS_VOICE = 'en-US-Neural2-H';
  const PIP_TTS_OPTS = {
    preferFemale: true,
    gender: 'female',
    youngFemale: true,
    pitch: 6.5,
    speakingRate: 0.95
  };

  function speak(text) {
    if (!text) return;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    if (typeof window.speakWithGoogle === 'function') {
      window.speakWithGoogle(text, PIP_TTS_VOICE, PIP_TTS_OPTS);
      return;
    }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.15;
    const voices = window.speechSynthesis.getVoices();
    const label = (v) => `${v.name || ''} ${v.voiceURI || ''}`;
    const young =
      voices.find((v) => /jenny|aria|samantha|nova|karen|google.*female/i.test(label(v))) ||
      voices.find(
        (v) =>
          /en(-|_)?us/i.test(v.lang) &&
          /female/i.test(label(v)) &&
          !/susan|victoria|zira|hazel|mature|grandma/i.test(label(v))
      );
    if (young) u.voice = young;
    window.speechSynthesis.speak(u);
  }
  }

  function stopSpeak() {
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  window.gzSpeakPip = speak;
  window.gzStopPipSpeak = stopSpeak;

  function setSpeaking(on) {
    document.getElementById('gzGuide')?.classList.toggle('is-speaking', !!on);
  }

  function sparkleSvg(uid) {
    const pts = [
      [18, 22],
      [78, 18],
      [88, 48],
      [72, 82],
      [22, 78],
      [12, 48],
      [50, 12],
      [58, 88]
    ];
    return pts
      .map(([x, y], i) => {
        const delay = (i * 0.18).toFixed(2);
        return `<g class="gz-sparkle" style="animation-delay:${delay}s" transform="translate(${x} ${y})">
          <path d="M0-5 L1.2-1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2-1.2 Z" fill="#ffd98a" opacity="0.9"/>
        </g>`;
      })
      .join('');
  }

  function buildDonutSvg(visual, idSuffix) {
    const v = visual || {};
    const dough = v.dough || '#d4a574';
    const icing = v.icing || '#fff6e8';
    const shine = v.icingShine || '#ffffff';
    const sprinkle = v.sprinkle;
    const craggy = !!v.craggy;
    const cruller = !!v.cruller;
    const powdered = !!v.powdered;
    const nuts = !!v.nuts;
    const uid = idSuffix || `d${Math.random().toString(36).slice(2, 8)}`;
    const holeId = `gzHole-${uid}`;
    const icingId = `gzIcing-${uid}`;

    const outer = craggy
      ? 'M50 12c10-2 18 4 22 10 6-2 14 2 16 10 8 2 12 12 8 20 6 6 4 16-2 22 4 8-2 16-10 18-2 8-12 14-22 12-6 6-16 4-22-2-8 2-16-4-18-12-8 0-14-10-10-18-6-4-6-14 0-20-2-8 4-16 12-18 2-8 12-14 26-12z'
      : cruller
        ? 'M50 14c20 0 36 14 36 32 0 18-16 32-36 32S14 64 14 46 30 14 50 14zm0 14c-12 0-22 8-22 18s10 18 22 18 22-8 22-18-10-18-22-18z'
        : 'M50 16c18.8 0 34 15.2 34 34S68.8 84 50 84 16 68.8 16 50s15.2-34 34-34zm0 18c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16-7.2-16-16-16z';

    let sprinkles = '';
    if (sprinkle && !powdered) {
      const pts = [
        [32, 34],
        [44, 28],
        [58, 30],
        [68, 40],
        [70, 54],
        [60, 66],
        [42, 68],
        [30, 58],
        [28, 46]
      ];
      sprinkles = pts
        .map(([x, y], i) => {
          const rot = (i * 37) % 90;
          return `<rect x="${x}" y="${y}" width="5" height="2.2" rx="1" fill="${esc(sprinkle)}" transform="rotate(${rot} ${x} ${y})"/>`;
        })
        .join('');
    }
    if (nuts) {
      sprinkles += `
        <ellipse cx="38" cy="40" rx="5" ry="3.5" fill="#6b4423" transform="rotate(-20 38 40)"/>
        <ellipse cx="62" cy="48" rx="5.5" ry="3.2" fill="#5a381c" transform="rotate(25 62 48)"/>
        <ellipse cx="48" cy="62" rx="4.5" ry="3" fill="#7a5230" transform="rotate(-10 48 62)"/>`;
    }
    if (powdered) {
      sprinkles += `
        <g fill="rgba(255,255,255,0.85)">
          <circle cx="34" cy="36" r="1.4"/><circle cx="48" cy="30" r="1.2"/>
          <circle cx="64" cy="38" r="1.5"/><circle cx="70" cy="52" r="1.1"/>
          <circle cx="58" cy="66" r="1.3"/><circle cx="40" cy="68" r="1.2"/>
          <circle cx="28" cy="54" r="1.4"/><circle cx="36" cy="48" r="1"/>
        </g>`;
    }

    const hole = craggy || cruller ? '' : `<circle cx="50" cy="50" r="14" fill="url(#${holeId})"/>`;

    return `
      <svg class="gz-donut-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="${holeId}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(26,16,12,0.15)"/>
            <stop offset="100%" stop-color="rgba(26,16,12,0)"/>
          </radialGradient>
          <linearGradient id="${icingId}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${esc(shine)}"/>
            <stop offset="45%" stop-color="${esc(icing)}"/>
            <stop offset="100%" stop-color="${esc(icing)}"/>
          </linearGradient>
        </defs>
        <ellipse cx="52" cy="56" rx="34" ry="10" fill="rgba(0,0,0,0.18)"/>
        <path d="${outer}" fill="${esc(dough)}"/>
        <g transform="translate(0 -2)">
          <path d="${outer}" fill="url(#${icingId})" opacity="0.9"/>
        </g>
        ${hole}
        ${sprinkles}
        ${v.sparkle !== false ? sparkleSvg(uid) : ''}
      </svg>`;
  }

  function buildSubmarineSvg(visual, idSuffix) {
    const v = visual || {};
    const bread = v.bread || '#e8c89a';
    const filling = v.filling || '#c4423a';
    const uid = idSuffix || `s${Math.random().toString(36).slice(2, 8)}`;
    return `
      <svg class="gz-donut-svg gz-sub-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="gzSubBread-${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6e8"/>
            <stop offset="55%" stop-color="${esc(bread)}"/>
            <stop offset="100%" stop-color="#c9a06a"/>
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="72" rx="38" ry="8" fill="rgba(0,0,0,0.16)"/>
        <path d="M14 58c2-18 18-30 36-30s34 12 36 30c0 8-10 14-36 14S14 66 14 58z" fill="url(#gzSubBread-${uid})"/>
        <path d="M18 52c4-10 14-16 32-16s28 6 32 16" fill="none" stroke="#b88955" stroke-width="1.2" opacity="0.55"/>
        <rect x="22" y="48" width="56" height="10" rx="4" fill="${esc(filling)}" opacity="0.92"/>
        <rect x="26" y="50" width="18" height="3" rx="1.5" fill="#f4e4c8" opacity="0.85"/>
        <rect x="48" y="51" width="14" height="2.5" rx="1" fill="#6fbf73" opacity="0.9"/>
        <rect x="64" y="50" width="10" height="3" rx="1" fill="#f0c14a" opacity="0.9"/>
        ${sparkleSvg(uid)}
      </svg>`;
  }

  function productArt(item) {
    if (item.image) {
      return `
        <div class="gz-product-photo">
          <img src="${esc(item.image)}" alt="" loading="lazy" width="220" height="220"/>
          <div class="gz-sparkle-overlay" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>`;
    }
    const kind = item.visual?.kind || item.kind;
    if (kind === 'submarine') {
      return buildSubmarineSvg(item.visual, item.id);
    }
    return buildDonutSvg(item.visual, item.id);
  }

  function recipeHtml(recipe, { lightbox = false } = {}) {
    if (!recipe) return '';
    const ingredients = (recipe.ingredients || []).map((item) => `<li>${esc(item)}</li>`).join('');
    const steps = (recipe.steps || []).map((item) => `<li>${esc(item)}</li>`).join('');
    const meta = `
      <div class="gz-meta-row">
        <span><i class="bi bi-egg-fried"></i> ${esc(recipe.yield || '')}</span>
        <span><i class="bi bi-clock"></i> ${esc(recipe.time || '')}</span>
      </div>`;
    if (lightbox) {
      return `
        ${meta}
        <div class="gz-recipe-sheet-cols">
          <div class="gz-back-block">
            <h4>Ingredients</h4>
            <ul>${ingredients}</ul>
          </div>
          <div class="gz-back-block">
            <h4>Steps</h4>
            <ol class="gz-recipe-steps">${steps}</ol>
          </div>
        </div>`;
    }
    return `
      ${meta}
      <div class="gz-back-block">
        <h4>Recipe</h4>
        <ul>${ingredients}</ul>
      </div>
      <div class="gz-back-block">
        <h4>Steps</h4>
        <ul>${steps}</ul>
      </div>`;
  }

  const PAIRINGS = {
    'classic-glazed': 'mango-sunrise',
    'boston-cream': 'cookies-cream',
    'raspberry-jelly': 'berry-blast',
    'old-fashioned': 'strawberry-banana',
    'maple-walnut': 'pb-banana',
    'french-cruller': 'mango-sunrise',
    'chocolate-frosted': 'cookies-cream',
    'strawberry-sprinkle': 'strawberry-banana',
    'lemon-poppy': 'tropical-green',
    'apple-fritter': 'pb-banana',
    'cinnamon-sugar': 'mango-sunrise',
    'matcha-white-chocolate': 'tropical-green',
    'blueberry-cake': 'berry-blast',
    'mango-sunrise': 'classic-glazed',
    'berry-blast': 'raspberry-jelly',
    'tropical-green': 'lemon-poppy',
    'strawberry-banana': 'strawberry-sprinkle',
    'cookies-cream': 'boston-cream',
    'pb-banana': 'maple-walnut'
  };

  function originHtml(origin) {
    if (!origin || !origin.place) return '';
    return `
      <div class="gz-back-block gz-origin-block">
        <h4>Where it began</h4>
        <p class="gz-origin-place">
          <i class="bi bi-geo-alt-fill"></i>
          ${esc(origin.place)}${origin.year ? ` · ${esc(String(origin.year))}` : ''}
        </p>
        ${origin.note ? `<p>${esc(origin.note)}</p>` : ''}
        ${
          Number.isFinite(Number(origin.lat)) && Number.isFinite(Number(origin.lng))
            ? `<button type="button" class="gz-text-link gz-origin-jump" data-origin-id="">Show on invention map</button>`
            : ''
        }
      </div>`;
  }

  function cardHtml(item, kind) {
    const tags = (item.flavorTags || [])
      .slice(0, 2)
      .map((t) => `<span class="gz-tag">${esc(t)}</span>`)
      .join('');
    const isSmoothie = kind === 'smoothie';
    const isSubmarine = kind === 'submarine';
    const isRecipeBased = isSmoothie || isSubmarine;
    const kicker = isSubmarine ? 'Submarine' : isSmoothie ? 'Smoothie' : 'Donut';
    const pairLabel = isRecipeBased ? 'Pair with a donut' : 'Pair with a smoothie';
    const flipHint = isRecipeBased ? 'Flip for recipe &amp; history' : 'Flip for history &amp; origins';
    const backKicker = isRecipeBased ? 'Recipe &amp; story' : 'History &amp; origins';
    const openLabel = isRecipeBased ? 'Open full recipe' : 'Open full story';
    const openIcon = isSubmarine ? 'bi-basket2' : isSmoothie ? 'bi-cup-straw' : 'bi-book-half';
    const bodyBits = isRecipeBased
      ? `${recipeHtml(item.recipe)}
              <div class="gz-back-block">
                <h4>History</h4>
                <p>${esc(item.history || '')}</p>
              </div>`
      : `<div class="gz-back-block">
                <h4>History</h4>
                <p>${esc(item.history || '')}</p>
              </div>
              ${originHtml(item.origin).replace('data-origin-id=""', `data-origin-id="${esc(item.id)}"`)}`;
    return `
      <article class="gz-card" data-id="${esc(item.id)}" data-kind="${esc(kind)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(item.name)} — flip for ${isRecipeBased ? 'recipe and history' : 'history and origins'}">
        <div class="gz-card-inner">
          <div class="gz-face gz-face--front">
            <div class="gz-donut-stage">${productArt(item)}</div>
            <div class="gz-front-body">
              <p class="gz-card-kicker">${kicker}</p>
              <h3>${esc(item.name)}</h3>
              <p class="gz-tagline">${esc(item.tagline || '')}</p>
              <div class="gz-tags">${tags}</div>
              <p class="gz-flip-hint"><i class="bi bi-arrow-repeat"></i> ${flipHint}</p>
            </div>
          </div>
          <div class="gz-face gz-face--back">
            <div class="gz-back-scroll">
              <p class="gz-back-kicker">${backKicker}</p>
              <h3 class="gz-back-title">${esc(item.name)}</h3>
              ${bodyBits}
            </div>
            <div class="gz-back-actions">
              <button type="button" class="gz-btn gz-btn-sm gz-btn-frost gz-hear" data-hear="${esc(item.id)}">
                <i class="bi bi-soundwave"></i> Hear Pip
              </button>
              <button type="button" class="gz-btn gz-btn-sm gz-btn-ink gz-pair" data-pair="${esc(item.id)}">
                <i class="bi bi-hearts"></i> ${pairLabel}
              </button>
              <button type="button" class="gz-btn gz-btn-sm gz-btn-ink gz-flip-back">
                <i class="bi bi-arrow-counterclockwise"></i> Flip back
              </button>
            </div>
          </div>
        </div>
      </article>`;
  }

  function openStorySheet(item) {
    const sheet = document.getElementById('gzRecipeSheet');
    const title = document.getElementById('gzRecipeSheetTitle');
    const body = document.getElementById('gzRecipeSheetBody');
    if (!sheet || !body || !item) return;
    const isSmoothie = item.kind === 'smoothie' || !!item.recipe;
    if (title) title.textContent = item.name || (isSmoothie ? 'Blend & story' : 'History & origins');
    const originBlock = item.origin
      ? `<div class="gz-back-block gz-recipe-sheet-history">
          <h4>Where it began</h4>
          <p class="gz-origin-place"><i class="bi bi-geo-alt-fill"></i> ${esc(item.origin.place || '')}${
          item.origin.year ? ` · ${esc(String(item.origin.year))}` : ''
        }</p>
          ${item.origin.note ? `<p>${esc(item.origin.note)}</p>` : ''}
        </div>`
      : '';
    body.innerHTML = `
      <p class="gz-recipe-sheet-tagline">${esc(item.tagline || '')}</p>
      ${isSmoothie ? recipeHtml(item.recipe, { lightbox: true }) : ''}
      <div class="gz-back-block ${isSmoothie ? 'gz-recipe-sheet-history' : ''}">
        <h4>History</h4>
        <p>${esc(item.history || '')}</p>
      </div>
      ${isSmoothie ? '' : originBlock}`;
    sheet.hidden = false;
    document.body.classList.add('gz-recipe-open');
    document.getElementById('gzRecipeSheetClose')?.focus?.();
  }

  function closeRecipeSheet() {
    const sheet = document.getElementById('gzRecipeSheet');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('gz-recipe-open');
  }

  function jumpToOrigin(id) {
    document.getElementById('gzOrigins')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (typeof window.GlazedOriginsMap?.focusPin === 'function') {
        window.GlazedOriginsMap.focusPin(id);
      }
    }, 400);
  }

  function askPipPairing(item) {
    const catalog = window.GlazedCatalog || { byId: {} };
    const pairId = PAIRINGS[item.id];
    const pair = pairId ? catalog.byId[pairId] : null;
    const pairName = pair?.name || (item.kind === 'smoothie' || catalog.byId[item.id]?.kind === 'smoothie' ? 'a classic glazed' : 'a mango smoothie');
    const msg = `What pairs well with ${item.name}? I’d love something like ${pairName} — any tips?`;
    if (typeof window.GlazedAskPip === 'function') {
      window.GlazedAskPip(msg);
    } else if (window.aiChatWidget?.sendMessage) {
      window.aiChatWidget.open?.();
      window.aiChatWidget.sendMessage(msg);
    }
  }

  function collapsePipDock() {
    document.getElementById('gzGuide')?.classList.add('is-compact');
    try {
      sessionStorage.setItem('glazedPipDockCompact', '1');
    } catch (_) {}
  }

  function expandPipDock() {
    document.getElementById('gzGuide')?.classList.remove('is-compact');
    try {
      sessionStorage.removeItem('glazedPipDockCompact');
    } catch (_) {}
  }

  window.GlazedCollapsePipDock = collapsePipDock;
  window.GlazedExpandPipDock = expandPipDock;

  function updateCardScrollCue(card) {
    const scroll = card?.querySelector('.gz-back-scroll');
    const cue = card?.querySelector('.gz-scroll-cue');
    const face = card?.querySelector('.gz-face--back');
    if (!scroll || !cue || !face) return;
    const overflows = scroll.scrollHeight > scroll.clientHeight + 12;
    cue.hidden = !overflows;
    face.classList.toggle('has-scroll', overflows);
  }

  const SPRINKLE_COLORS = ['#ff7a9a', '#fff4e8', '#5c3a2a', '#f5c76a', '#7ec8e3', '#e85a7a', '#ffd98a', '#c4f0c2'];

  function wireSugar() {
    const root = document.getElementById('gzSugar');
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.innerHTML = '';

    const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
    const dustCount = isMobile ? 22 : 36;
    const rodCount = isMobile ? 40 : 64;
    const chipCount = isMobile ? 14 : 24;
    const starCount = isMobile ? 10 : 18;

    // Soft sugar dust
    for (let i = 0; i < dustCount; i += 1) {
      const span = document.createElement('span');
      span.style.left = `${Math.random() * 100}%`;
      span.style.animationDuration = `${10 + Math.random() * 16}s`;
      span.style.animationDelay = `${Math.random() * 12}s`;
      span.style.width = `${2 + Math.random() * 3.5}px`;
      span.style.height = span.style.width;
      span.style.setProperty('--drift-x', `${(Math.random() * 80 - 40).toFixed(0)}px`);
      root.appendChild(span);
    }

    // Classic rod sprinkles
    for (let i = 0; i < rodCount; i += 1) {
      const rod = document.createElement('span');
      rod.className = 'gz-sugar-sprinkle';
      rod.style.left = `${Math.random() * 100}%`;
      rod.style.background = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      rod.style.animationDuration = `${8 + Math.random() * 14}s`;
      rod.style.animationDelay = `${Math.random() * 10}s`;
      rod.style.width = `${7 + Math.random() * 6}px`;
      rod.style.height = `${2.2 + Math.random() * 1.8}px`;
      rod.style.setProperty('--spin', `${(Math.random() * 420 - 210).toFixed(0)}deg`);
      rod.style.setProperty('--drift-x', `${(Math.random() * 90 - 45).toFixed(0)}px`);
      root.appendChild(rod);
    }

    // Square glaze chips
    for (let i = 0; i < chipCount; i += 1) {
      const chip = document.createElement('span');
      chip.className = 'gz-sugar-chip';
      chip.style.left = `${Math.random() * 100}%`;
      chip.style.background = SPRINKLE_COLORS[(i + 3) % SPRINKLE_COLORS.length];
      chip.style.animationDuration = `${9 + Math.random() * 13}s`;
      chip.style.animationDelay = `${Math.random() * 9}s`;
      chip.style.setProperty('--spin', `${(Math.random() * 520 - 260).toFixed(0)}deg`);
      chip.style.setProperty('--drift-x', `${(Math.random() * 100 - 50).toFixed(0)}px`);
      root.appendChild(chip);
    }

    // Tiny star sparkles
    for (let i = 0; i < starCount; i += 1) {
      const star = document.createElement('span');
      star.className = 'gz-sugar-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.background = SPRINKLE_COLORS[(i + 5) % SPRINKLE_COLORS.length];
      star.style.animationDuration = `${11 + Math.random() * 12}s`;
      star.style.animationDelay = `${Math.random() * 11}s`;
      star.style.setProperty('--spin', `${(Math.random() * 360).toFixed(0)}deg`);
      star.style.setProperty('--drift-x', `${(Math.random() * 110 - 55).toFixed(0)}px`);
      root.appendChild(star);
    }
  }

  function wireOrbSprinkles() {
    // Canvas orb particles (orb-particles-canvas.js) replace CSS sprinkles when available
    if (window.GlazedOrbParticles || document.querySelector('.gz-orb-particle-canvas')) return;
    const root = document.getElementById('gzOrbSprinkles');
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.innerHTML = '';
    for (let i = 0; i < 22; i += 1) {
      const s = document.createElement('span');
      s.className = 'gz-orb-sprinkle';
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 38 + Math.random() * 48;
      s.style.setProperty('--sx', `${(50 + Math.cos(angle) * radius).toFixed(1)}%`);
      s.style.setProperty('--sy', `${(50 + Math.sin(angle) * radius).toFixed(1)}%`);
      s.style.setProperty('--rot', `${(Math.random() * 360).toFixed(0)}deg`);
      s.style.background = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      s.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
      s.style.animationDuration = `${2.8 + Math.random() * 2.4}s`;
      root.appendChild(s);
    }
  }

  function burstSprinkles(host, count = 28) {
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'gz-burst-sprinkles';
    layer.setAttribute('aria-hidden', 'true');
    const n = count;
    for (let i = 0; i < n; i += 1) {
      const s = document.createElement('span');
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.35;
      const dist = 90 + Math.random() * 110;
      s.style.setProperty('--bx', `${Math.round(Math.cos(angle) * dist)}px`);
      s.style.setProperty('--by', `${Math.round(Math.sin(angle) * dist)}px`);
      s.style.setProperty('--brot', `${(Math.random() * 520 - 260).toFixed(0)}deg`);
      s.style.background = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      s.style.animationDelay = `${(i * 0.012).toFixed(2)}s`;
      layer.appendChild(s);
    }
    host.appendChild(layer);
    window.setTimeout(() => layer.remove(), 1200);
  }

  function cardFlipSparkle(card) {
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stage = card.querySelector('.gz-donut-stage') || card;
    burstSprinkles(stage, 8);
  }

  function renderHeroDonut() {
    const el = document.getElementById('gzHeroDonut');
    const orb = document.getElementById('gzHeroOrb');
    if (!el) return;

    // Product rotation — always start with classic glazed, then cycle through others
    let rotationIndex = 0;
    let productRotation = [];

    function buildRotation() {
      const catalog = window.GlazedCatalog;
      if (!catalog) return;
      
      // Always start with classic glazed
      const glazed = catalog.byId['classic-glazed'];
      productRotation = [glazed];
      
      // Add one smoothie
      if (catalog.smoothies?.length) {
        const randomSmoothie = catalog.smoothies[Math.floor(Math.random() * catalog.smoothies.length)];
        productRotation.push({ ...randomSmoothie, kind: 'smoothie' });
      }
      
      // Add one submarine
      if (catalog.submarines?.length) {
        const randomSub = catalog.submarines[Math.floor(Math.random() * catalog.submarines.length)];
        productRotation.push({ ...randomSub, kind: 'submarine' });
      }
      
      // Add another random donut (not glazed)
      const otherDonuts = catalog.donuts?.filter(d => d.id !== 'classic-glazed') || [];
      if (otherDonuts.length) {
        const randomDonut = otherDonuts[Math.floor(Math.random() * otherDonuts.length)];
        productRotation.push({ ...randomDonut, kind: 'donut' });
      }
    }

    function getCurrentProduct() {
      if (!productRotation.length) {
        return {
          image: '/donuts/assets/products/classic-glazed-cutout.png',
          name: 'Classic Glazed',
          kind: 'donut'
        };
      }
      return productRotation[rotationIndex % productRotation.length];
    }

    function updateHeroImage() {
      const product = getCurrentProduct();
      const src = product.image || '/donuts/assets/products/classic-glazed-cutout.png';
      const whole = el.querySelector('.gz-hero-whole');
      
      if (whole) {
        whole.src = src;
        whole.alt = product.name || 'Product';
      }
      
      el.setAttribute('aria-label', `${product.name || 'Product'} — click to explode`);
      
      el.querySelectorAll('.gz-hero-piece').forEach((piece) => {
        piece.style.backgroundImage = `url("${src}")`;
      });
    }

    const initialSrc = '/donuts/assets/products/classic-glazed-cutout.png';
    const pieces = Array.from({ length: 9 }, () => '<span class="gz-hero-piece"></span>').join('');
    const crumbs = Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 85 + (i % 6) * 28;
      const cx = Math.round(Math.cos(angle) * dist);
      const cy = Math.round(Math.sin(angle) * dist);
      const delay = (i * 0.03).toFixed(2);
      return `<span class="gz-hero-crumb" style="--cx:${cx}px;--cy:${cy}px;left:50%;top:50%;animation-delay:${delay}s"></span>`;
    }).join('');

    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Glazed donut — click to explode');
    el.innerHTML = `
      <div class="gz-hero-stage">
        <img class="gz-hero-whole" src="${initialSrc}" alt="Classic glazed donut" width="220" height="220" draggable="false"/>
        <div class="gz-hero-pieces" aria-hidden="true">${pieces}</div>
        ${crumbs}
        <div class="gz-sparkle-overlay" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>`;

    el.querySelectorAll('.gz-hero-piece').forEach((piece) => {
      piece.style.backgroundImage = `url("${initialSrc}")`;
    });

    // Build rotation once catalog is ready
    window.addEventListener('glazed-catalog-ready', buildRotation);
    buildRotation(); // Try immediately in case already loaded

    let exploding = false;
    let explodeToken = 0;

    // With no clicks the hero would sit on the classic glazed forever, so it
    // advances itself through the rotation while the visitor is idle.
    const AUTO_CYCLE_MS = 7000;
    let autoCycleTimer = 0;
    let heroInView = true;
    let hovered = false;

    function canAutoCycle() {
      return (
        heroInView
        && !hovered
        && !exploding
        && !document.hidden
        // The story reel clicks the hero itself; two drivers would collide.
        && !window.GlazedStoryReel?.isRunning?.()
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }

    function scheduleAutoCycle() {
      window.clearTimeout(autoCycleTimer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      autoCycleTimer = window.setTimeout(() => {
        if (canAutoCycle()) explode();
        else scheduleAutoCycle();
      }, AUTO_CYCLE_MS);
    }

    function finishExplode(token) {
      if (token !== explodeToken) return;
      el.classList.remove('is-exploding', 'is-exploding-3d', 'is-winding');
      orb?.classList.remove('is-shockwave');
      exploding = false;
      rotationIndex++;
      updateHeroImage();
      scheduleAutoCycle();
    }

    function explodeCssFallback(stage, token) {
      el.classList.add('is-winding');
      orb?.classList.add('is-shockwave');
      window.setTimeout(() => {
        if (token !== explodeToken) return;
        el.classList.remove('is-winding');
        el.classList.add('is-exploding');
        burstSprinkles(stage || el);
      }, 160);
      window.setTimeout(() => finishExplode(token), 1350);
    }

    async function explode() {
      if (exploding) return;
      exploding = true;
      const token = ++explodeToken;
      const stage = el.querySelector('.gz-hero-stage') || el;
      const product = getCurrentProduct();
      const src = product.image || '/donuts/assets/products/classic-glazed-cutout.png';
      const Explosion = window.DonutExplosion3D;
      const use3d =
        Explosion &&
        typeof Explosion.isSupported === 'function' &&
        Explosion.isSupported();

      if (use3d) {
        el.classList.add('is-winding');
        orb?.classList.add('is-shockwave');
        window.setTimeout(async () => {
          if (token !== explodeToken) return;
          el.classList.remove('is-winding');
          el.classList.add('is-exploding-3d');
          const fx = new Explosion(stage, src);
          const ok = await fx.explode();
          if (!ok) {
            el.classList.remove('is-exploding-3d');
            // Invalidate the 3D finish timer; CSS path owns the lifecycle
            const fallbackToken = ++explodeToken;
            exploding = true;
            explodeCssFallback(stage, fallbackToken);
            return;
          }
          burstSprinkles(stage, 36);
        }, 140);
        window.setTimeout(() => finishExplode(token), 1550);
        return;
      }

      explodeCssFallback(stage, token);
    }

    el.addEventListener('click', () => {
      window.clearTimeout(autoCycleTimer);
      explode();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.clearTimeout(autoCycleTimer);
        explode();
      }
    });

    // Don't detonate the hero out from under someone who is reaching for it.
    el.addEventListener('pointerenter', () => {
      hovered = true;
      window.clearTimeout(autoCycleTimer);
    });
    el.addEventListener('pointerleave', () => {
      hovered = false;
      scheduleAutoCycle();
    });
    el.addEventListener('focus', () => {
      hovered = true;
      window.clearTimeout(autoCycleTimer);
    });
    el.addEventListener('blur', () => {
      hovered = false;
      scheduleAutoCycle();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearTimeout(autoCycleTimer);
      else scheduleAutoCycle();
    });

    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(
        (entries) => {
          heroInView = entries.some((entry) => entry.isIntersecting);
          if (heroInView) scheduleAutoCycle();
          else window.clearTimeout(autoCycleTimer);
        },
        { threshold: 0.25 },
      ).observe(el);
    }

    scheduleAutoCycle();
  }

  function bindGuide(brand) {
    const nameEl = document.getElementById('gzGuideName');
    const titleEl = document.getElementById('gzGuideTitle');
    const portrait = document.getElementById('gzGuidePortrait');
    const statusEl = document.getElementById('gzGuideStatus') || document.querySelector('.gz-guide-status');
    if (nameEl) nameEl.textContent = brand.guideName || 'Pip';
    if (titleEl) titleEl.textContent = brand.guideTitle || 'Head baker';
    if (portrait && brand.guidePortrait) {
      portrait.src = brand.guidePortrait;
      portrait.alt = `${brand.guideName || 'Pip'} — bakery guide`;
    }

    try {
      if (sessionStorage.getItem('glazedPipDockCompact') === '1') collapsePipDock();
    } catch (_) {}

    document.getElementById('gzGuideCollapse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      collapsePipDock();
    });
    document.getElementById('gzGuideExpand')?.addEventListener('click', () => {
      if (document.getElementById('gzGuide')?.classList.contains('is-compact')) {
        expandPipDock();
      }
    });

    async function playWelcome() {
      setSpeaking(true);
      if (statusEl) statusEl.textContent = 'Playing HeyGen welcome…';
      const played = window.GlazedHeygen ? await window.GlazedHeygen.playIntro() : false;
      if (!played) {
        if (statusEl) statusEl.textContent = 'HeyGen clip unavailable — using Pip’s voice instead.';
        speak(brand.welcomeScript || '');
        setTimeout(() => {
          setSpeaking(false);
          if (statusEl) statusEl.textContent = 'Tap Hear welcome for the clip, or Play reel for the tour.';
        }, Math.min(14000, (brand.welcomeScript || '').length * 55));
        return;
      }
      const video = document.getElementById('gzHeygenDemoVideo');
      if (video) {
        video.addEventListener(
          'ended',
          () => {
            setSpeaking(false);
            if (statusEl) statusEl.textContent = 'Welcome done · try Play reel for the page tour.';
          },
          { once: true }
        );
        video.addEventListener('pause', () => {
          if (video.ended || video.paused) setSpeaking(false);
        });
      } else {
        setSpeaking(false);
      }
    }

    document.getElementById('gzMeetPip')?.addEventListener('click', playWelcome);
    document.getElementById('gzStopPip')?.addEventListener('click', () => {
      stopSpeak();
      window.GlazedHeygen?.stopIntro();
      setSpeaking(false);
      if (statusEl) statusEl.textContent = 'Stopped · Hear welcome = clip · Play reel = tour.';
    });

    document.getElementById('gzRecipeSheetClose')?.addEventListener('click', closeRecipeSheet);
    document.getElementById('gzRecipeSheetBackdrop')?.addEventListener('click', closeRecipeSheet);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRecipeSheet();
    });

    fetch('/data/donuts-heygen-demo.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((demo) => {
        if (!statusEl) return;
        if (demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort) {
          statusEl.textContent = 'HeyGen ready · Hear welcome = clip · Play reel = tour';
        }
      })
      .catch(() => {
        if (statusEl) statusEl.textContent = 'Clip may be offline · Play reel still works.';
      });
  }

  function setCardFlipped(card, flipped) {
    if (!card) return;
    const wasFlipped = card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    if (flipped) {
      if (!wasFlipped) cardFlipSparkle(card);
      window.requestAnimationFrame(() => {
        updateCardScrollCue(card);
        // Auto-open popup disabled - user can manually click "Open full story" button if needed
      });
    }
  }

  function bindCards(items, gridId) {
    const byId = Object.fromEntries(items.map((d) => [d.id, d]));
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const hear = e.target.closest('.gz-hear');
      if (hear) {
        e.preventDefault();
        e.stopPropagation();
        const item = byId[hear.getAttribute('data-hear')];
        if (item) {
          setSpeaking(true);
          speak(item.avatarScript || `${item.name}. ${item.history || ''}`);
          setTimeout(() => setSpeaking(false), 10000);
        }
        return;
      }

      const originJump = e.target.closest('.gz-origin-jump');
      if (originJump) {
        e.preventDefault();
        e.stopPropagation();
        jumpToOrigin(
          originJump.getAttribute('data-origin-id') ||
            originJump.closest('.gz-card')?.getAttribute('data-id')
        );
        return;
      }

      const recipeBtn = e.target.closest('.gz-recipe-open');
      if (recipeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const itemId = recipeBtn.getAttribute('data-recipe');
        const item = byId[itemId];
        if (item) {
          openStorySheet(item);
        }
        return;
      }

      const pairBtn = e.target.closest('.gz-pair');
      if (pairBtn) {
        e.preventDefault();
        e.stopPropagation();
        const item = byId[pairBtn.getAttribute('data-pair')];
        if (item) askPipPairing(item);
        return;
      }

      const flipBack = e.target.closest('.gz-flip-back');
      if (flipBack) {
        e.preventDefault();
        e.stopPropagation();
        setCardFlipped(flipBack.closest('.gz-card'), false);
        return;
      }

      const card = e.target.closest('.gz-card');
      if (!card || e.target.closest('button')) return;
      grid.querySelectorAll('.gz-card.is-flipped').forEach((c) => {
        if (c !== card) setCardFlipped(c, false);
      });
      setCardFlipped(card, !card.classList.contains('is-flipped'));
    });

    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.gz-hear, .gz-flip-back, .gz-recipe-open, .gz-pair, .gz-origin-jump')) return;
      const card = e.target.closest('.gz-card');
      if (!card || e.target !== card) return;
      e.preventDefault();
      grid.querySelectorAll('.gz-card.is-flipped').forEach((c) => {
        if (c !== card) setCardFlipped(c, false);
      });
      setCardFlipped(card, !card.classList.contains('is-flipped'));
    });

    grid.addEventListener('scroll', (e) => {
      const scroll = e.target.closest?.('.gz-back-scroll');
      if (!scroll) return;
      const cue = scroll.parentElement?.querySelector('.gz-scroll-cue');
      if (!cue) return;
      cue.hidden = scroll.scrollTop > 12 || scroll.scrollHeight <= scroll.clientHeight + 12;
    }, true);
  }

  async function init() {
    wireSugar();
    wireOrbSprinkles();
    renderHeroDonut();
    const yearEl = document.getElementById('gzFooterYear');
    if (yearEl) yearEl.textContent = `© ${new Date().getFullYear()}`;

    const grid = document.getElementById('gzGrid');
    const smoothieGrid = document.getElementById('gzSmoothieGrid');
    const submarineGrid = document.getElementById('gzSubmarineGrid');
    const loading = document.getElementById('gzLoading');

    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const brand = data.brand || {};
      const donuts = Array.isArray(data.donuts) ? data.donuts : [];
      const smoothies = Array.isArray(data.smoothies) ? data.smoothies : [];
      const submarines = Array.isArray(data.submarines) ? data.submarines : [];

      document.getElementById('gzHeroLine').textContent =
        brand.tagline || 'Flip a treat. Hear the history. Meet Savy Donuts and Smoothies on Harbor.';
      bindGuide(brand);

      if (data.shop && window.GlazedShopMap?.initMap) {
        window.GlazedShopMap.initMap(data.shop);
      }
      if (window.GlazedShopMap?.initOriginsMap) {
        window.GlazedShopMap.initOriginsMap(donuts);
      }

      if (loading) loading.hidden = true;

      const byId = {};
      donuts.forEach((d) => {
        byId[d.id] = { ...d, kind: 'donut' };
      });
      smoothies.forEach((s) => {
        byId[s.id] = { ...s, kind: 'smoothie' };
      });
      submarines.forEach((sub) => {
        byId[sub.id] = { ...sub, kind: 'submarine' };
      });
      window.GlazedCatalog = { donuts, smoothies, submarines, byId, shop: data.shop || null };
      
      // Notify hero donut rotation is ready
      window.dispatchEvent(new CustomEvent('glazed-catalog-ready'));

      if (grid) {
        grid.innerHTML = donuts.length
          ? donuts.map((d) => cardHtml(d, 'donut')).join('')
          : '<p class="gz-empty">The case is empty right now — refresh in a moment.</p>';
        bindCards(donuts, 'gzGrid');
      }

      if (smoothieGrid) {
        smoothieGrid.innerHTML = smoothies.length
          ? smoothies.map((s) => cardHtml(s, 'smoothie')).join('')
          : '<p class="gz-empty">Smoothie board is warming up — try again shortly.</p>';
        bindCards(smoothies, 'gzSmoothieGrid');
      }

      if (submarineGrid) {
        submarineGrid.innerHTML = submarines.length
          ? submarines.map((sub) => cardHtml(sub, 'submarine')).join('')
          : '<p class="gz-empty">Submarine menu coming soon — check back shortly.</p>';
        bindCards(submarines, 'gzSubmarineGrid');
      }
    } catch (err) {
      console.error('Glazed gallery failed to load', err);
      if (loading) {
        loading.hidden = false;
        loading.textContent =
          'Couldn’t load the baker’s dozen (network hiccup). Refresh the page — Pip’s still here.';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
