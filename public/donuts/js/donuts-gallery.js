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

  /** Pip HeyGen voice (Radiant Riley) — same ID as avatar intro video */
  const PIP_HEYGEN_VOICE_FALLBACK = '0ed165284d1c4dc9b600d3129821146a';
  /** Google female fallback only if HeyGen TTS fails */
  const PIP_TTS_VOICE = 'en-US-Standard-F';
  const PIP_TTS_OPTS = { preferFemale: true, gender: 'female', pitch: 0.05, speakingRate: 1.02 };

  let pipVoiceId = PIP_HEYGEN_VOICE_FALLBACK;
  let pipAudio = null;

  async function loadPipVoiceId() {
    try {
      const res = await fetch('/data/donuts-heygen-demo.json', { cache: 'no-store' });
      const demo = await res.json();
      if (demo?.heygenVoiceId) pipVoiceId = demo.heygenVoiceId;
    } catch (_) {
      /* keep fallback */
    }
  }

  function stopPipAudio() {
    if (pipAudio) {
      try {
        pipAudio.pause();
        pipAudio = null;
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function speakWithHeygenPip(text) {
    const res = await fetch('/api/heygen/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: pipVoiceId, speed: 1 })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.audioUrl) {
      throw new Error(data.error || 'HeyGen speech failed');
    }
    stopPipAudio();
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    pipAudio = new Audio(data.audioUrl);
    pipAudio.volume = 0.9;
    await pipAudio.play();
    return true;
  }

  async function speak(text) {
    if (!text) return;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    try {
      await speakWithHeygenPip(text);
      return;
    } catch (err) {
      console.warn('Pip HeyGen voice unavailable, falling back to female Google TTS', err);
    }
    if (typeof window.speakWithGoogle === 'function') {
      window.speakWithGoogle(text, PIP_TTS_VOICE, PIP_TTS_OPTS);
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const female =
        voices.find((v) =>
          /female|samantha|karen|zira|susan|victoria|moira|fiona|siri/i.test(`${v.name} ${v.voiceURI || ''}`)
        ) ||
        voices.find((v) => /en(-|_)?us/i.test(v.lang) && !/male|david|daniel|alex|mark|george/i.test(v.name));
      if (female) u.voice = female;
      window.speechSynthesis.speak(u);
    }
  }

  function stopSpeak() {
    stopPipAudio();
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

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
    return buildDonutSvg(item.visual, item.id);
  }

  function recipeHtml(recipe) {
    if (!recipe) return '';
    const ingredients = (recipe.ingredients || []).map((item) => `<li>${esc(item)}</li>`).join('');
    const steps = (recipe.steps || []).map((item) => `<li>${esc(item)}</li>`).join('');
    return `
      <div class="gz-meta-row">
        <span><i class="bi bi-egg-fried"></i> ${esc(recipe.yield || '')}</span>
        <span><i class="bi bi-clock"></i> ${esc(recipe.time || '')}</span>
      </div>
      <div class="gz-back-block">
        <h4>Recipe</h4>
        <ul>${ingredients}</ul>
      </div>
      <div class="gz-back-block">
        <h4>Steps</h4>
        <ul>${steps}</ul>
      </div>`;
  }

  function cardHtml(item, kind) {
    const tags = (item.flavorTags || []).map((t) => `<span class="gz-tag">${esc(t)}</span>`).join('');
    const kicker = kind === 'smoothie' ? 'Smoothie' : 'Donut';
    return `
      <button type="button" class="gz-card" data-id="${esc(item.id)}" data-kind="${esc(kind)}" aria-label="${esc(item.name)} — click to flip for recipe and history">
        <div class="gz-card-inner">
          <div class="gz-face gz-face--front">
            <div class="gz-donut-stage">${productArt(item)}</div>
            <div class="gz-front-body">
              <p class="gz-card-kicker">${kicker}</p>
              <h3>${esc(item.name)}</h3>
              <p class="gz-tagline">${esc(item.tagline || '')}</p>
              <div class="gz-tags">${tags}</div>
              <p class="gz-flip-hint"><i class="bi bi-arrow-repeat"></i> Flip for recipe &amp; history</p>
            </div>
          </div>
          <div class="gz-face gz-face--back">
            <div class="gz-back-scroll">
              <p class="gz-back-kicker">Other side</p>
              <h3 class="gz-back-title">${esc(item.name)}</h3>
              ${recipeHtml(item.recipe)}
              <div class="gz-back-block">
                <h4>History</h4>
                <p>${esc(item.history || '')}</p>
              </div>
            </div>
            <div class="gz-back-actions">
              <span class="gz-btn gz-btn-sm gz-btn-frost gz-hear" data-hear="${esc(item.id)}" role="button" tabindex="0">
                <i class="bi bi-soundwave"></i> Hear Pip
              </span>
              <span class="gz-btn gz-btn-sm gz-btn-ink gz-flip-back" role="button" tabindex="0">
                <i class="bi bi-arrow-counterclockwise"></i> Flip back
              </span>
            </div>
          </div>
        </div>
      </button>`;
  }

  function wireSugar() {
    const root = document.getElementById('gzSugar');
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 36; i += 1) {
      const span = document.createElement('span');
      span.style.left = `${Math.random() * 100}%`;
      span.style.animationDuration = `${8 + Math.random() * 14}s`;
      span.style.animationDelay = `${Math.random() * 10}s`;
      span.style.width = `${2 + Math.random() * 4}px`;
      span.style.height = span.style.width;
      root.appendChild(span);
    }
  }

  function renderHeroDonut() {
    const el = document.getElementById('gzHeroDonut');
    if (!el) return;
    el.innerHTML = `
      <div class="gz-product-photo gz-hero-photo">
        <img src="/donuts/assets/products/classic-glazed.png" alt="" width="320" height="320"/>
        <div class="gz-sparkle-overlay" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>`;
  }

  function bindGuide(brand) {
    const nameEl = document.getElementById('gzGuideName');
    const titleEl = document.getElementById('gzGuideTitle');
    const portrait = document.getElementById('gzGuidePortrait');
    const statusEl = document.querySelector('.gz-guide-status');
    if (nameEl) nameEl.textContent = brand.guideName || 'Pip';
    if (titleEl) titleEl.textContent = brand.guideTitle || 'Head baker';
    if (portrait && brand.guidePortrait) {
      portrait.src = brand.guidePortrait;
      portrait.alt = `${brand.guideName || 'Pip'} — bakery guide`;
    }

    async function playWelcome() {
      setSpeaking(true);
      const played = window.GlazedHeygen ? await window.GlazedHeygen.playIntro() : false;
      if (!played) {
        speak(brand.welcomeScript || '');
        setTimeout(() => setSpeaking(false), Math.min(14000, (brand.welcomeScript || '').length * 55));
        return;
      }
      const video = document.getElementById('gzHeygenDemoVideo');
      if (video) {
        video.addEventListener('ended', () => setSpeaking(false), { once: true });
        video.addEventListener('pause', () => {
          if (video.ended || video.paused) setSpeaking(false);
        });
      } else {
        setSpeaking(false);
      }
    }

    document.getElementById('gzMeetPip')?.addEventListener('click', playWelcome);
    document.getElementById('gzMeetPipHero')?.addEventListener('click', () => {
      document.getElementById('gzGuide')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      playWelcome();
    });

    document.getElementById('gzStopPip')?.addEventListener('click', () => {
      stopSpeak();
      window.GlazedHeygen?.stopIntro();
      setSpeaking(false);
    });

    fetch('/data/donuts-heygen-demo.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((demo) => {
        if (!statusEl) return;
        if (demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort) {
          statusEl.textContent = 'HeyGen avatar ready · tap Hear welcome';
        }
      })
      .catch(() => {});
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

      const flipBack = e.target.closest('.gz-flip-back');
      if (flipBack) {
        e.preventDefault();
        e.stopPropagation();
        flipBack.closest('.gz-card')?.classList.remove('is-flipped');
        return;
      }

      const card = e.target.closest('.gz-card');
      if (!card) return;
      grid.querySelectorAll('.gz-card.is-flipped').forEach((c) => {
        if (c !== card) c.classList.remove('is-flipped');
      });
      card.classList.toggle('is-flipped');
    });

    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.gz-card');
      if (!card || e.target.closest('.gz-hear, .gz-flip-back')) return;
      e.preventDefault();
      card.click();
    });
  }

  async function init() {
    wireSugar();
    renderHeroDonut();
    await loadPipVoiceId();

    const grid = document.getElementById('gzGrid');
    const smoothieGrid = document.getElementById('gzSmoothieGrid');
    const loading = document.getElementById('gzLoading');

    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const brand = data.brand || {};
      const donuts = Array.isArray(data.donuts) ? data.donuts : [];
      const smoothies = Array.isArray(data.smoothies) ? data.smoothies : [];

      document.getElementById('gzHeroLine').textContent =
        brand.tagline || 'Flip a treat. Steal a recipe. Meet Savy Donuts and Smoothies on Harbor.';
      bindGuide(brand);

      if (data.shop && window.GlazedShopMap?.initMap) {
        window.GlazedShopMap.initMap(data.shop);
      }

      if (loading) loading.hidden = true;

      if (grid) {
        grid.innerHTML = donuts.length
          ? donuts.map((d) => cardHtml(d, 'donut')).join('')
          : '<p class="gz-empty">No donuts in the case yet.</p>';
        bindCards(donuts, 'gzGrid');
      }

      if (smoothieGrid) {
        smoothieGrid.innerHTML = smoothies.length
          ? smoothies.map((s) => cardHtml(s, 'smoothie')).join('')
          : '<p class="gz-empty">Smoothie board coming soon.</p>';
        bindCards(smoothies, 'gzSmoothieGrid');
      }
    } catch (err) {
      console.error('Glazed gallery failed to load', err);
      if (loading) {
        loading.hidden = false;
        loading.textContent = 'Could not load the case. Refresh and try again.';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
