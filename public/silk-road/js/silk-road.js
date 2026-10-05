/**
 * Silk Road journey — eight atlas stops, EN/AR, caravan map, guide handoffs, cargo manifest.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DATA_URL = '/silk-road/data/silk-road.json';
  const STORAGE_KEY = 'meAtlasLang';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PLAY_DELAY_MS = 7000;
  const VOICES = {
    en: { voice: 'en-US-Neural2-D', lang: 'en-US', speakingRate: 0.98, pitch: -1, gender: 'male' },
    ar: { voice: 'ar-XA-Wavenet-B', lang: 'ar-XA', speakingRate: 0.95, pitch: -1, gender: 'male' }
  };

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const els = {
    play: $('srPlay'),
    listen: $('srListen'),
    lang: $('srLangToggle'),
    routeBase: $('srRouteBase'),
    routeDone: $('srRouteDone'),
    stops: $('srStops'),
    caravan: $('srCaravan'),
    steps: $('srSteps'),
    count: $('srStopCount'),
    city: $('srStopCity'),
    country: $('srStopCountry'),
    era: $('srStopEra'),
    story: $('srStopStory'),
    goods: $('srStopGoods'),
    guide: $('srStopGuide'),
    handoff: $('srStopHandoff'),
    prev: $('srPrev'),
    next: $('srNext'),
    atlasLink: $('srAtlasLink'),
    atlasLabel: $('srAtlasLabel'),
    cargo: $('srCargo'),
    cargoDone: $('srCargoDone')
  };

  const state = {
    data: null,
    lang: 'en',
    index: 0,
    visited: new Set(),
    playing: false,
    listening: false,
    playTimer: 0,
    speechToken: 0,
    caravanAnim: 0
  };

  function pick(field) {
    if (!field || typeof field !== 'object') return String(field || '');
    return field[state.lang] || field.en || '';
  }

  function t(key, vars) {
    const ui = state.data?.ui || {};
    let text = (ui[state.lang] && ui[state.lang][key]) || (ui.en && ui.en[key]) || '';
    Object.entries(vars || {}).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return text;
  }

  function stops() {
    return state.data?.stops || [];
  }

  function point(p) {
    if (p && p.waypoint) return state.data.waypoints?.[p.waypoint] || { x: 0, y: 0 };
    return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
  }

  /** Points from the previous stop to stop i, including any via waypoints. */
  function segmentPoints(i) {
    const list = stops();
    if (i <= 0 || i >= list.length) return [];
    const from = point(list[i - 1]);
    const via = (list[i].via || []).map(point);
    return [from, ...via, point(list[i])];
  }

  /** Land and sea runs of a segment; `embark` names the via waypoint where the caravan boards ship. */
  function segmentParts(i) {
    const points = segmentPoints(i);
    if (!points.length) return [];
    const stop = stops()[i];
    const via = stop.via || [];
    const k = stop.embark ? via.findIndex((v) => v.waypoint === stop.embark) + 1 : 0;
    if (k > 0) {
      return [
        { points: points.slice(0, k + 1), sea: false },
        { points: points.slice(k), sea: true }
      ];
    }
    return [{ points, sea: stop.leg === 'sea' }];
  }

  function appendParts(group, i) {
    segmentParts(i).forEach((part) => {
      group.appendChild(svg('path', { d: pathD(part.points), class: part.sea ? 'is-sea' : '' }));
    });
  }

  function pathD(points) {
    return points.map((p, k) => `${k ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
  }

  function buildMap() {
    els.routeBase.replaceChildren();
    els.stops.replaceChildren();
    stops().forEach((stop, i) => {
      appendParts(els.routeBase, i);
      const p = point(stop);
      const g = svg('g', {
        class: 'sr-stop-dot',
        transform: `translate(${p.x} ${p.y})`,
        tabindex: 0,
        role: 'button',
        'data-stop': stop.id
      });
      g.appendChild(svg('circle', { r: 7 }));
      const label = svg('text', { x: 12, y: -10 });
      g.appendChild(label);
      g.addEventListener('click', () => goTo(i, { user: true }));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          goTo(i, { user: true });
        }
      });
      els.stops.appendChild(g);
    });

    els.steps.replaceChildren();
    stops().forEach((stop, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.stop = stop.id;
      btn.addEventListener('click', () => goTo(i, { user: true }));
      li.appendChild(btn);
      els.steps.appendChild(li);
    });
  }

  function renderLabels() {
    els.stops.querySelectorAll('.sr-stop-dot').forEach((g, i) => {
      const stop = stops()[i];
      const label = pick(stop.city);
      g.querySelector('text').textContent = label;
      g.setAttribute('aria-label', `${label} · ${pick(stop.country)}`);
    });
    els.steps.querySelectorAll('button').forEach((btn, i) => {
      btn.textContent = `${i + 1} · ${pick(stops()[i].country)}`;
    });
  }

  function renderRouteDone() {
    els.routeDone.replaceChildren();
    for (let i = 1; i <= state.index; i += 1) appendParts(els.routeDone, i);
    els.stops.querySelectorAll('.sr-stop-dot').forEach((g, i) => {
      g.classList.toggle('is-active', i === state.index);
      g.classList.toggle('is-visited', state.visited.has(i));
    });
    els.steps.querySelectorAll('button').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === state.index);
      btn.classList.toggle('is-visited', state.visited.has(i));
      if (i === state.index) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
  }

  function placeCaravan(p) {
    els.caravan.setAttribute('transform', `translate(${p.x} ${p.y})`);
  }

  function animateCaravan(points) {
    window.cancelAnimationFrame(state.caravanAnim);
    if (!points.length) return;
    if (reduced || points.length < 2) {
      placeCaravan(points[points.length - 1]);
      return;
    }
    const lengths = [0];
    for (let k = 1; k < points.length; k += 1) {
      lengths.push(lengths[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y));
    }
    const total = lengths[lengths.length - 1] || 1;
    const duration = Math.min(2600, 700 + total * 4);
    const start = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - start) / duration);
      const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const dist = eased * total;
      let k = 1;
      while (k < lengths.length - 1 && lengths[k] < dist) k += 1;
      const span = lengths[k] - lengths[k - 1] || 1;
      const f = (dist - lengths[k - 1]) / span;
      placeCaravan({
        x: points[k - 1].x + (points[k].x - points[k - 1].x) * f,
        y: points[k - 1].y + (points[k].y - points[k - 1].y) * f
      });
      if (u < 1) state.caravanAnim = window.requestAnimationFrame(step);
    };
    state.caravanAnim = window.requestAnimationFrame(step);
  }

  function renderCargo(newIndex) {
    els.cargo.dataset.empty = t('cargoEmpty');
    els.cargo.replaceChildren();
    let count = 0;
    stops().forEach((stop, i) => {
      if (!state.visited.has(i)) return;
      (stop.goods || []).forEach((good) => {
        const li = document.createElement('li');
        li.textContent = pick(good);
        if (i === newIndex) li.classList.add('is-new');
        els.cargo.appendChild(li);
        count += 1;
      });
    });
    const complete = state.visited.size === stops().length && stops().length > 0;
    els.cargoDone.hidden = !complete;
    if (complete) els.cargoDone.textContent = t('complete', { count, total: stops().length });
  }

  function atlasHref(stop) {
    return state.lang === 'ar' ? `${stop.atlas}?lang=ar` : stop.atlas;
  }

  function renderStop() {
    const stop = stops()[state.index];
    if (!stop) return;
    els.count.textContent = t('stop', { n: state.index + 1, total: stops().length });
    els.city.textContent = pick(stop.city);
    els.country.textContent = pick(stop.country);
    els.era.textContent = pick(stop.era);
    els.story.textContent = pick(stop.story);
    els.goods.replaceChildren(
      ...(stop.goods || []).map((good) => {
        const li = document.createElement('li');
        li.textContent = pick(good);
        return li;
      })
    );
    els.guide.textContent = pick(stop.guide);
    els.handoff.textContent = pick(stop.handoff);
    els.prev.disabled = state.index === 0;
    els.next.disabled = state.index >= stops().length - 1;
    els.atlasLink.href = atlasHref(stop);
    els.atlasLabel.textContent = t('openAtlas', { country: pick(stop.country) });
  }

  function applyLang() {
    const rtl = state.lang === 'ar';
    document.documentElement.lang = state.lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.body.dir = rtl ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-sr-i18n]').forEach((node) => {
      const text = t(node.dataset.srI18n);
      if (text) node.textContent = text;
    });
    els.lang.textContent = t('langToggle');
    els.lang.lang = rtl ? 'en' : 'ar';
    syncPlayLabel();
    renderLabels();
    renderStop();
    renderCargo(-1);
  }

  function syncPlayLabel() {
    els.play.setAttribute('aria-pressed', String(state.playing));
    els.play.querySelector('i').className = state.playing ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    els.play.querySelector('span').textContent = t(state.playing ? 'pause' : 'play');
  }

  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('stop', stops()[state.index].id);
      if (state.lang === 'ar') url.searchParams.set('lang', 'ar');
      else url.searchParams.delete('lang');
      url.searchParams.delete('play');
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  }

  function stopSpeaking() {
    state.speechToken += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else window.speechSynthesis?.cancel();
  }

  async function narrate() {
    const stop = stops()[state.index];
    if (!stop) return;
    const token = ++state.speechToken;
    const text = `${pick(stop.city)}. ${pick(stop.story)} ${pick(stop.guide)}: ${pick(stop.handoff)}`;
    const profile = VOICES[state.lang] || VOICES.en;
    const opts = { ...profile, volume: 0.9, preferFemale: false, isCancelled: () => token !== state.speechToken };
    try {
      if (typeof window.speakNarrationAwaitEnd === 'function') {
        await window.speakNarrationAwaitEnd(text, opts);
      } else if (typeof window.speakWithGoogle === 'function') {
        await window.speakWithGoogle(text, profile.voice, opts);
      }
    } catch (err) {
      console.warn('Silk Road narration failed', err);
    }
    return token === state.speechToken;
  }

  function schedulePlay() {
    window.clearTimeout(state.playTimer);
    if (!state.playing) return;
    if (state.index >= stops().length - 1) {
      setPlaying(false);
      return;
    }
    if (state.listening) {
      narrate().then((finished) => {
        if (finished && state.playing) state.playTimer = window.setTimeout(() => goTo(state.index + 1), 900);
      });
      return;
    }
    state.playTimer = window.setTimeout(() => goTo(state.index + 1), PLAY_DELAY_MS);
  }

  function setPlaying(on) {
    state.playing = Boolean(on);
    window.clearTimeout(state.playTimer);
    syncPlayLabel();
    if (state.playing) {
      if (state.index >= stops().length - 1) goTo(0);
      else schedulePlay();
    } else {
      stopSpeaking();
    }
  }

  function goTo(i, opts = {}) {
    const list = stops();
    if (!list.length) return;
    const next = Math.max(0, Math.min(list.length - 1, Number(i) || 0));
    const forwardOne = next === state.index + 1;
    if (opts.user && state.playing) setPlaying(false);
    stopSpeaking();
    state.index = next;
    const fresh = !state.visited.has(next);
    state.visited.add(next);
    if (forwardOne) animateCaravan(segmentPoints(next));
    else animateCaravan([point(list[next])]);
    renderRouteDone();
    renderStop();
    renderCargo(fresh ? next : -1);
    syncUrl();
    if (state.playing) schedulePlay();
    else if (state.listening && !opts.silent) narrate();
  }

  function setLang(lang) {
    state.lang = lang === 'ar' ? 'ar' : 'en';
    try {
      window.localStorage.setItem(STORAGE_KEY, state.lang);
    } catch {
      /* ignore */
    }
    stopSpeaking();
    applyLang();
    syncUrl();
  }

  function bind() {
    els.prev.addEventListener('click', () => goTo(state.index - 1, { user: true }));
    els.next.addEventListener('click', () => goTo(state.index + 1, { user: true }));
    els.play.addEventListener('click', () => {
      window.primeSpeechSynthesis?.();
      setPlaying(!state.playing);
    });
    els.listen.addEventListener('click', () => {
      window.primeSpeechSynthesis?.();
      state.listening = !state.listening;
      els.listen.setAttribute('aria-pressed', String(state.listening));
      if (state.listening) {
        if (state.playing) schedulePlay();
        else narrate();
      } else {
        stopSpeaking();
        if (state.playing) schedulePlay();
      }
    });
    els.lang.addEventListener('click', () => setLang(state.lang === 'ar' ? 'en' : 'ar'));
    document.addEventListener('keydown', (ev) => {
      if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const rtl = state.lang === 'ar';
      if (ev.key === 'ArrowRight') goTo(state.index + (rtl ? -1 : 1), { user: true });
      else if (ev.key === 'ArrowLeft') goTo(state.index + (rtl ? 1 : -1), { user: true });
    });
  }

  function initialLang(params) {
    const q = params.get('lang');
    if (q === 'ar' || q === 'en') return q;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {
      /* ignore */
    }
    return 'en';
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      els.story.textContent = 'The Silk Road data could not load. Refresh to try again.';
      console.error('Silk Road data failed', err);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    state.lang = initialLang(params);
    buildMap();
    bind();
    applyLang();
    const startId = params.get('stop');
    const startIndex = Math.max(0, stops().findIndex((s) => s.id === startId));
    goTo(startIndex, { silent: true });
    if (params.get('play') === '1') setPlaying(true);
  }

  window.SilkRoad = {
    goTo: (i) => goTo(i, { user: true }),
    setLang,
    getState: () => ({
      lang: state.lang,
      index: state.index,
      stop: stops()[state.index]?.id || '',
      visited: Array.from(state.visited),
      playing: state.playing
    })
  };

  init();
})();
