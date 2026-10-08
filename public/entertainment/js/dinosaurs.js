/**
 * Dinosaurs page — era strata, amber herd cards, readout, scale parade,
 * and wiring between the WebGL2 sky, WebGPU air sim, and Three.js stage.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const C = window.DinosaursCatalog;
  if (!C) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SOUND_KEY = 'dinoSound';

  let eraId = 'cretaceous';
  let speciesId = 'tyrannosaurus';
  let stage = null;
  let sim = null;
  let audio = null;
  let soundOn = true;
  let impactBusy = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cap(s) {
    const str = String(s || '');
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function gsapFrom(targets, vars) {
    if (reduceMotion || !window.gsap) return;
    try {
      window.gsap.from(targets, vars);
    } catch (_) {
      /* ignore */
    }
  }

  /* ---------- fossil glyphs ---------- */

  function ammoniteSvg() {
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const th = (i / 120) * Math.PI * 5;
      const r = 2.2 * Math.exp(0.17 * th);
      pts.push(`${(32 + Math.cos(th) * r).toFixed(1)},${(32 + Math.sin(th) * r).toFixed(1)}`);
    }
    const ribs = [];
    for (let i = 0; i < 22; i += 1) {
      const th = 1.6 + (i / 22) * Math.PI * 3.4;
      const r1 = 2.2 * Math.exp(0.17 * (th - Math.PI * 2));
      const r2 = 2.2 * Math.exp(0.17 * th);
      ribs.push(`M${(32 + Math.cos(th) * r1).toFixed(1)} ${(32 + Math.sin(th) * r1).toFixed(1)} L${(32 + Math.cos(th) * r2).toFixed(1)} ${(32 + Math.sin(th) * r2).toFixed(1)}`);
    }
    return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><polyline points="${pts.join(' ')}"/><path d="${ribs.join(' ')}" stroke-width="1" opacity="0.7"/></svg>`;
  }

  function trackSvg() {
    return '<svg viewBox="0 0 64 64" fill="currentColor"><ellipse cx="32" cy="44" rx="9" ry="11" opacity="0.9"/><path d="M27 36 C22 26 16 18 12 10 C17 12 24 20 30 33Z"/><path d="M30 34 C30 22 31 12 32 4 C34 12 35 22 34 34Z"/><path d="M37 36 C42 26 48 18 52 10 C47 12 40 20 34 33Z"/></svg>';
  }

  function toothSvg() {
    return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M18 56 C20 38 26 20 44 6 C42 22 44 40 46 56 Z" fill="currentColor" fill-opacity="0.25"/><path d="M44 8 l-2 4 l3 2 l-2 4 l3 2 l-2 4 l3 2 l-2 4 l3 2 l-2 4 l3 2" stroke-width="1.1"/><path d="M16 56 H48"/></svg>';
  }

  const FOSSIL = { triassic: ammoniteSvg, jurassic: trackSvg, cretaceous: toothSvg };

  /* ---------- renderers ---------- */

  function renderStrata() {
    const wrap = $('dinoEras');
    if (!wrap) return;
    const youngestFirst = C.ERAS.slice().reverse();
    wrap.innerHTML = youngestFirst.map((era) => `
      <button type="button" class="dino-stratum" role="radio" aria-checked="false" tabindex="-1" data-era="${esc(era.id)}">
        <span class="dino-stratum__ma">${esc(era.startMa)}–${esc(era.endMa)} Ma</span>
        <span class="dino-stratum__body">
          <span class="dino-stratum__name">${esc(era.name)}</span>
          <span class="dino-stratum__kicker">${esc(era.kicker)}</span>
          <span class="dino-stratum__blurb">${esc(era.blurb)}</span>
          <span class="dino-stratum__cast">${C.speciesForEra(era.id).map((s) => esc(s.name)).join(' · ')}</span>
        </span>
        <span class="dino-stratum__fossil" aria-hidden="true">${FOSSIL[era.id] ? FOSSIL[era.id]() : ''}</span>
      </button>`).join('');
  }

  function renderHerd() {
    const wrap = $('dinoHerd');
    if (!wrap) return;
    wrap.innerHTML = C.SPECIES.map((sp) => {
      const era = C.eraById(sp.era);
      return `
      <button type="button" class="dino-card" data-species="${esc(sp.id)}" aria-pressed="false"
        aria-label="${esc(sp.name)}, ${esc(era ? era.name : '')}. Bring to the stage">
        <span class="dino-card__inner">
          <span class="dino-card__face dino-card__front">
            <span class="dino-card__era">${esc(era ? era.name : '')}</span>
            <span class="dino-card__art" data-art="${esc(sp.id)}"><span class="dino-card__monogram" aria-hidden="true">${esc(sp.name.charAt(0))}</span></span>
            <span class="dino-card__label">
              <span class="dino-card__name">${esc(sp.name)}</span>
              <span class="dino-card__meta"><span>${esc(C.formatLength(sp.lengthM).split(' · ')[0])}</span><span>${esc(cap(sp.diet))}</span></span>
            </span>
          </span>
          <span class="dino-card__face dino-card__back">
            <span class="dino-card__title">${esc(sp.name)}</span>
            <span class="dino-card__facts">
              <span class="k">Meaning</span><span class="v">${esc(sp.meaning)}</span>
              <span class="k">Length</span><span class="v">${esc(C.formatLength(sp.lengthM))}</span>
              <span class="k">Lived</span><span class="v">${esc(C.formatMa(sp.ma))}</span>
              <span class="k">Found</span><span class="v">${esc(sp.found)}</span>
            </span>
            <span class="dino-card__blurb">${esc(sp.blurb)}</span>
            <span class="dino-card__cta">On stage · tap to flip back</span>
          </span>
        </span>
      </button>`;
    }).join('');
  }

  function boneSvg() {
    return '<svg viewBox="0 0 40 20" fill="currentColor"><circle cx="6" cy="6" r="5"/><circle cx="6" cy="14" r="5"/><circle cx="34" cy="6" r="5"/><circle cx="34" cy="14" r="5"/><rect x="6" y="6.5" width="28" height="7" rx="3"/></svg>';
  }

  function humanSvg() {
    return '<svg class="dino-scale__human" viewBox="0 0 12 32" fill="currentColor" aria-hidden="true"><circle cx="6" cy="3.6" r="3.2"/><path d="M2.6 8.4h6.8l1.4 10.2h-2.2l-.8-5.6v18h-2.8v-9.8h-.6v9.8H1.6v-18l-.8 5.6H-1.4z"/></svg>';
  }

  function renderScale(sp) {
    const track = $('dinoScale');
    const bones = $('dinoBones');
    const caption = $('dinoScaleCaption');
    if (!track || !sp) return;

    const maxM = Math.ceil(C.maxLengthM() / 5) * 5;
    const longest = C.SPECIES.reduce((a, b) => (b.lengthM > a.lengthM ? b : a));
    const rows = [
      { label: sp.name, m: sp.lengthM, cls: 'is-hero' },
      { label: 'You', m: C.HUMAN_HEIGHT_M, cls: 'is-human', human: true },
      { label: 'School bus', m: C.SCHOOL_BUS_M, cls: '' },
    ];
    if (longest.id !== sp.id) rows.push({ label: longest.name, m: longest.lengthM, cls: 'is-ghost' });

    const ticks = [];
    for (let m = 0; m <= maxM; m += 5) {
      ticks.push(`<span style="left:${((m / maxM) * 100).toFixed(2)}%">${m} m</span>`);
    }

    track.style.setProperty('--meter-step', `${(100 / maxM).toFixed(3)}%`);
    track.innerHTML = rows.map((r) => {
      const pct = (r.m / maxM) * 100;
      const inside = pct > 32 && r.cls === 'is-hero';
      return `
      <div class="dino-scale__row ${r.cls}">
        <span class="dino-scale__label">${esc(r.label)}</span>
        <span class="dino-scale__lane" style="--meter-step:${(100 / maxM).toFixed(3)}%">
          <span class="dino-scale__bar" data-w="${pct.toFixed(2)}%"></span>
          ${r.human ? humanSvg() : ''}
          <span class="dino-scale__value${inside ? ' is-inside' : ''}" style="--w:${pct.toFixed(2)}%">${esc(C.formatLength(r.m))}</span>
        </span>
      </div>`;
    }).join('') + `<div class="dino-scale__axis" aria-hidden="true">${ticks.join('')}</div>`;

    requestAnimationFrame(() => {
      track.querySelectorAll('.dino-scale__bar').forEach((bar) => {
        bar.style.width = bar.dataset.w;
      });
    });

    const n = C.humansLong(sp.lengthM);
    if (bones) {
      bones.innerHTML = Array.from({ length: n }, () => `<span class="dino-bone">${boneSvg()}</span>`).join('');
      gsapFrom(bones.children, { y: -18, opacity: 0, rotate: -40, duration: 0.5, stagger: 0.05, ease: 'back.out(2)' });
    }
    if (caption) {
      const buses = (sp.lengthM / C.SCHOOL_BUS_M).toFixed(1);
      caption.innerHTML = `<strong>${esc(sp.name)}</strong> ran about <strong>${esc(C.formatLength(sp.lengthM))}</strong> nose to tail — roughly ${n} adult${n === 1 ? '' : 's'} lying head to toe, or ${buses} school buses.`;
    }
  }

  function renderReadout(sp) {
    const era = C.eraById(sp.era);
    $('dinoReadoutEra').textContent = era ? `${era.name} · ${era.startMa}–${era.endMa} Ma` : '';
    $('dinoReadoutName').textContent = sp.name;
    $('dinoReadoutMeaning').textContent = sp.meaning;
    $('dinoStatLength').textContent = C.formatLength(sp.lengthM);
    $('dinoStatMa').textContent = C.formatMa(sp.ma);
    $('dinoStatDiet').textContent = cap(sp.diet);
    $('dinoStatFound').textContent = sp.found;
    $('dinoReadoutBlurb').textContent = sp.blurb;
    $('dinoFallbackGlyph').textContent = sp.name.charAt(0);
    const stageEl = $('dinoStage');
    const mates = C.speciesForEra(sp.era).filter((s) => s.id !== sp.id).map((s) => s.name);
    const behind = mates.length ? `, with ${mates.join(' and ')} behind` : '';
    if (stageEl) stageEl.setAttribute('aria-label', `3D ${sp.name} on a ${era ? era.name : ''} landscape${behind}. Drag or use arrow keys to turn; Enter to roar.`);
    gsapFrom(['#dinoReadoutName', '#dinoReadoutMeaning', '#dinoReadout .dino-stats > div', '#dinoReadoutBlurb'], {
      y: 14, opacity: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out', clearProps: 'all',
    });
  }

  /* ---------- state ---------- */

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set('era', eraId);
    url.searchParams.set('species', speciesId);
    url.searchParams.delete('impact');
    window.history.replaceState(null, '', url.toString());
  }

  function applyEra(id, opts) {
    const era = C.eraById(id);
    if (!era) return;
    const changed = id !== eraId || (opts && opts.force);
    eraId = id;
    document.body.dataset.era = id;
    document.querySelectorAll('.dino-stratum').forEach((btn) => {
      const on = btn.dataset.era === id;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
    if (!changed) return;
    if (window.DinosaursSky) window.DinosaursSky.setEra(id, opts);
    if (sim) sim.setEra(id, opts);
    if (stage) stage.setEra(id);
  }

  function applySpecies(id, opts) {
    const sp = C.speciesById(id);
    if (!sp) return;
    speciesId = id;
    if (sp.era !== eraId) applyEra(sp.era, opts);
    document.querySelectorAll('.dino-card').forEach((card) => {
      const on = card.dataset.species === id;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!on) card.classList.remove('is-flipped');
    });
    renderReadout(sp);
    renderScale(sp);
    if (stage) stage.setSpecies(sp, opts);
    if (!(opts && opts.silentUrl)) syncUrl();
  }

  /* ---------- sound ---------- */

  function audioCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function noiseBuffer(ac, seconds) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function distortion(ac, amount) {
    const ws = ac.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    ws.curve = curve;
    return ws;
  }

  function playRoar(sp) {
    if (!soundOn || !sp) return;
    const ac = audioCtx();
    if (!ac) return;
    const t0 = ac.currentTime + 0.02;
    const big = Math.min(1, sp.lengthM / 22);
    const carn = sp.diet === 'carnivore';
    const base = carn ? 120 - big * 70 : 170 - big * 110;
    const dur = 1.25 + big * 0.6;

    const out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(ac.destination);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.4, t0 + 0.12);
    env.gain.setValueAtTime(0.38, t0 + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    env.connect(out);

    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(ac, dur);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(base * 7, t0);
    bp.frequency.exponentialRampToValueAtTime(base * 2.2, t0 + dur);
    bp.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.value = carn ? 0.9 : 0.35;
    noise.connect(bp).connect(ng).connect(env);

    const osc = ac.createOscillator();
    osc.type = carn ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(base * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(base * 0.65, t0 + dur);
    const lfo = ac.createOscillator();
    lfo.frequency.value = carn ? 24 + Math.random() * 10 : 6;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = base * (carn ? 0.28 : 0.08);
    lfo.connect(lfoGain).connect(osc.frequency);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = carn ? 1100 : 700;
    const og = ac.createGain();
    og.gain.value = carn ? 0.5 : 0.8;
    osc.connect(distortion(ac, carn ? 60 : 8)).connect(lp).connect(og).connect(env);

    [noise, osc, lfo].forEach((node) => {
      node.start(t0);
      node.stop(t0 + dur + 0.05);
    });
  }

  function playImpact() {
    if (!soundOn) return;
    const ac = audioCtx();
    if (!ac) return;
    const t0 = ac.currentTime + 1.45;
    const dur = 4.5;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.9, t0 + 0.05);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(ac.destination);

    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(ac, dur);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(70, t0 + dur);
    noise.connect(lp).connect(out);

    const sub = ac.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, t0);
    sub.frequency.exponentialRampToValueAtTime(24, t0 + dur);
    const sg = ac.createGain();
    sg.gain.value = 0.9;
    sub.connect(sg).connect(out);

    const whoosh = ac.createBufferSource();
    whoosh.buffer = noiseBuffer(ac, 1.5);
    const hp = ac.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(400, t0 - 1.4);
    hp.frequency.exponentialRampToValueAtTime(3200, t0);
    const wg = ac.createGain();
    wg.gain.setValueAtTime(0.0001, t0 - 1.4);
    wg.gain.exponentialRampToValueAtTime(0.25, t0 - 0.05);
    wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    whoosh.connect(hp).connect(wg).connect(ac.destination);

    whoosh.start(t0 - 1.4);
    whoosh.stop(t0 + 0.15);
    noise.start(t0);
    sub.start(t0);
    noise.stop(t0 + dur);
    sub.stop(t0 + dur);
  }

  /* ---------- actions ---------- */

  function roar() {
    const sp = C.speciesById(speciesId);
    if (stage) stage.roar();
    playRoar(sp);
  }

  function impact() {
    if (eraId !== 'cretaceous' || impactBusy) return;
    impactBusy = true;
    setTimeout(() => { impactBusy = false; }, 6000);
    playImpact();
    if (reduceMotion) return;
    if (window.DinosaursSky) window.DinosaursSky.impact();
    if (sim) sim.impact();
    if (stage) stage.impact();
    setTimeout(() => {
      const flash = $('dinoFlash');
      if (flash) {
        flash.classList.remove('is-firing');
        void flash.offsetWidth;
        flash.classList.add('is-firing');
      }
      document.body.classList.add('is-quaking');
      setTimeout(() => document.body.classList.remove('is-quaking'), 950);
      playRoar(C.speciesById(speciesId));
    }, 1500);
  }

  function setPressed(btn, on) {
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ---------- binding ---------- */

  function bindStrata() {
    const wrap = $('dinoEras');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.dino-stratum');
      if (!btn) return;
      const era = C.eraById(btn.dataset.era);
      if (!era) return;
      applyEra(era.id);
      applySpecies(era.defaultSpecies);
    });
    wrap.addEventListener('keydown', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const btns = Array.from(wrap.querySelectorAll('.dino-stratum'));
      const idx = btns.findIndex((b) => b.dataset.era === eraId);
      const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
      const next = btns[(idx + step + btns.length) % btns.length];
      e.preventDefault();
      next.focus();
      next.click();
    });
    wrap.addEventListener('pointermove', (e) => {
      const btn = e.target.closest('.dino-stratum');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    });
  }

  function bindHerd() {
    const wrap = $('dinoHerd');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
      const card = e.target.closest('.dino-card');
      if (!card) return;
      if (card.dataset.species === speciesId) {
        card.classList.toggle('is-flipped');
        return;
      }
      applySpecies(card.dataset.species);
      card.classList.add('is-flipped');
      const stageEl = $('dinoStage');
      if (stageEl && window.innerWidth < 992) stageEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
    if (reduceMotion) return;
    wrap.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.dino-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('is-tilting');
      card.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    });
    wrap.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.dino-card');
      if (!card || card.contains(e.relatedTarget)) return;
      card.classList.remove('is-tilting');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  }

  function bindControls() {
    const spinBtn = $('dinoSpin');
    const soundBtn = $('dinoSound');
    $('dinoRoar').addEventListener('click', roar);
    $('dinoTurnLeft').addEventListener('click', () => stage && stage.turn(-0.6));
    $('dinoTurnRight').addEventListener('click', () => stage && stage.turn(0.6));
    $('dinoImpact').addEventListener('click', impact);

    if (reduceMotion) {
      setPressed(spinBtn, false);
      spinBtn.disabled = true;
    }
    spinBtn.addEventListener('click', () => {
      const on = spinBtn.getAttribute('aria-pressed') !== 'true';
      setPressed(spinBtn, on);
      if (stage) stage.setSpin(on);
    });

    try {
      soundOn = window.localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (_) {
      soundOn = true;
    }
    setPressed(soundBtn, soundOn);
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      setPressed(soundBtn, soundOn);
      try {
        window.localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
      } catch (_) {
        /* ignore */
      }
    });

    const stageEl = $('dinoStage');
    stageEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (stage) stage.turn(-0.4);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (stage) stage.turn(0.4);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        roar();
      }
    });
  }

  function loadThumbnails() {
    const Scene = window.DinosaursScene;
    if (!Scene || !window.THREE) return;
    const run = () => Scene.renderThumbnails(C.SPECIES, (urls) => {
      Object.keys(urls).forEach((id) => {
        const art = document.querySelector(`.dino-card__art[data-art="${id}"]`);
        if (!art) return;
        art.innerHTML = `<img src="${urls[id]}" alt="" width="420" height="300" decoding="async"/>`;
      });
    });
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 400);
  }

  function revealOnScroll() {
    if (reduceMotion || !window.gsap || typeof IntersectionObserver !== 'function') return;
    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting || seen.has(en.target)) return;
        seen.add(en.target);
        const t = en.target;
        if (t.id === 'dinoEras') gsapFrom(t.children, { rotateX: 70, y: 40, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', clearProps: 'transform,opacity' });
        if (t.id === 'dinoHerd') gsapFrom(t.children, { y: 50, opacity: 0, rotateY: -25, duration: 0.7, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
        io.unobserve(t);
      });
    }, { threshold: 0.12 });
    ['dinoEras', 'dinoHerd'].forEach((id) => {
      const el = $(id);
      if (el) io.observe(el);
    });
  }

  function readDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const sp = C.speciesById(params.get('species'));
    const era = C.eraById(params.get('era'));
    if (sp) return { era: sp.era, species: sp.id, impact: params.get('impact') === '1' };
    if (era) return { era: era.id, species: era.defaultSpecies, impact: params.get('impact') === '1' };
    return { era: 'cretaceous', species: 'tyrannosaurus', impact: params.get('impact') === '1' };
  }

  function init() {
    renderStrata();
    renderHerd();
    bindStrata();
    bindHerd();
    bindControls();

    const start = readDeepLink();
    eraId = start.era;
    speciesId = start.species;

    if (window.DinosaursSky) window.DinosaursSky.setEra(start.era, { instant: true });

    const stageEl = $('dinoStage');
    if (window.DinosaursScene && stageEl) {
      stage = window.DinosaursScene.createStage(stageEl, { onTap: roar });
      if (stage) {
        stageEl.classList.add('is-live');
        stage.setEra(start.era);
      }
    }

    applyEra(start.era, { force: true, instant: true });
    applySpecies(start.species, { instant: true, silentUrl: true });

    if (window.DinosaursSim) {
      window.DinosaursSim.mount({ canvas: $('dinoSim'), era: eraId }).then((s) => {
        if (!s) return;
        sim = s;
        sim.setEra(eraId, { instant: true });
        document.body.dataset.sim = 'webgpu';
        if (window.DinosaursSky && window.DinosaursSky.setMotes) window.DinosaursSky.setMotes(0.25);
      }).catch(() => {});
    }

    gsapFrom('.dino-title', { y: 60, opacity: 0, duration: 1.1, ease: 'power4.out' });
    gsapFrom(['.dino-hero__intro .dino-kicker', '.dino-lead', '.dino-controls'], { y: 20, opacity: 0, duration: 0.8, stagger: 0.1, delay: 0.2, ease: 'power3.out', clearProps: 'all' });
    revealOnScroll();
    loadThumbnails();

    if (start.impact && start.era === 'cretaceous') setTimeout(impact, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
