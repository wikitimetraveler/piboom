/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
let directStory = null;
let descendantDraft = [];
/** Same anchor as server default for direct-line / direct-descendant APIs */
const LINE_ANCHOR_ID = 112;
const DESC_STORAGE_KEY = 'lane.direct.descendants.draft.v1';
const HISTORY_STATE_COPY = {
  loading: 'Loading history records...',
  empty: 'No Lane records available for this view.',
  unavailable: 'History records are unavailable right now.'
};
const STORAGE_DIRECT_STORY_CHAPTERS = 'laneDirectAncestorStoryChapters';
/** Narration prefs bumped so prior “silent” saves don’t silently block voice for new sessions. */
const STORAGE_DIRECT_STORY_NARRATE = 'laneDirectAncestorStoryNarrateV2';
const STORAGE_DIRECT_STORY_NARRATE_LEGACY = 'laneDirectAncestorStoryNarrate';
const DIRECT_STORY_SCENE_DURATION_MS = 4200;
const DIRECT_STORY_CHAPTER_DURATION_MS = 3200;
const DIRECT_STORY_SCENE_GAP_MS = 200;

/** @type {Record<number, { title: string, chapterCopy: string }>} */
const DIRECT_STORY_ERA_COPY = {
  1500: {
    title: 'Sixteenth century and earlier',
    chapterCopy:
      'Rare lines this early rest on slender evidence—names point forward into the fuller parish and town registers of New England settlement.'
  },
  1600: {
    title: 'Seventeenth century',
    chapterCopy:
      'Colonial footing: earliest preserved generations condensed before the Revolutionary era reshapes civic and family geography.'
  },
  1700: {
    title: 'Eighteenth century',
    chapterCopy:
      'Republic and homestead rhythm—town centers thicken the braid of ancestor lines later compiled into the Lane volume.'
  },
  1800: {
    title: 'Nineteenth century',
    chapterCopy:
      'Steam, print, migration—and sharper occupations and wartime echoes in compiled vital lines.'
  },
  1900: {
    title: 'Twentieth century',
    chapterCopy:
      'Registers and descendants carry this direct path toward familiar recent anchor generations.'
  }
};

let directStorySpeakToken = 0;
let directStoryFloatResolveAnchor = null;
let directStoryFloatScrollBound = false;
let directStoryFloatReflowScheduled = false;
const directStoryState = { running: false, playbackToken: 0, scenes: [] };

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function loadDescendantDraft() {
  try {
    const raw = window.localStorage.getItem(DESC_STORAGE_KEY);
    descendantDraft = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(descendantDraft)) descendantDraft = [];
  } catch {
    descendantDraft = [];
  }
}

function persistDescendantDraft() {
  try {
    window.localStorage.setItem(DESC_STORAGE_KEY, JSON.stringify(descendantDraft));
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

function renderDescendantDraft() {
  const host = document.getElementById('descendantDraftList');
  if (!host) return;
  if (!descendantDraft.length) {
    host.innerHTML = `<div class="small text-muted">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = descendantDraft
    .map(
      (d, idx) => `
      <div class="desc-item">
        <div>
          <strong>${esc(d.name || 'Unknown')}</strong>
          <div class="desc-item-meta">${esc(d.birthYear || '?')} • ${esc(d.relation || 'relation not set')}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger" data-remove-desc="${idx}">Remove</button>
      </div>`
    )
    .join('');
  host.querySelectorAll('[data-remove-desc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-remove-desc'), 10);
      if (!Number.isFinite(idx)) return;
      descendantDraft.splice(idx, 1);
      persistDescendantDraft();
      renderDescendantDraft();
    });
  });
}

function renderStory() {
  const host = document.getElementById('directTimeline');
  if (!host || !directStory) return;
  const entries = Array.isArray(directStory.line) ? directStory.line : [];
  host.innerHTML = entries
    .map((entry, idx) => {
      const occ = (entry.occupations || []).slice(0, 5);
      const wars = (entry.warLinks || []).slice(0, 3);
      const spouseNames = (entry.spouses || []).map((s) => s.name).filter(Boolean);
      const childNames = (entry.children || []).map((c) => c.name).filter(Boolean);
      const anchorId = `ancestor-step-${idx + 1}`;
      const quote = String(entry.narrative || '').split(/[.!?]/)[0].trim();
      return `
      <article class="direct-card ancestor-entry" id="${anchorId}" tabindex="-1">
        <div class="ancestor-head">
          <h2 class="h5 mb-0">${esc(entry.name || 'Unknown')}</h2>
          <span class="ancestor-years">${esc(entry.birthYear || '?')} - ${esc(entry.deathYear || '?')} • Step ${idx + 1}</span>
        </div>
        <div class="small text-muted mt-1">${esc(entry.born || 'Birthplace not recorded')}</div>
        <div class="ancestor-tags">
          ${occ.map((o) => `<span class="badge badge-secondary">${esc(o)}</span>`).join('')}
          ${wars.map((w) => `<span class="badge badge-warning">${esc(w.warLabel)} (${esc(w.confidence)})</span>`).join('')}
        </div>
        <div class="ancestor-line">${esc(entry.narrative || '')}</div>
        ${quote ? `<blockquote class="ancestor-quote mb-0">"${esc(quote)}."</blockquote>` : ''}
        <div class="family-context">
          <div><strong>Spouses:</strong> ${esc(spouseNames.join(', ') || 'None listed')}</div>
          <div><strong>Children:</strong> ${esc(childNames.join(', ') || 'None listed')}</div>
        </div>
      </article>`;
    })
    .join('');
}

function renderQuickNav() {
  const host = document.getElementById('directQuickNav');
  if (!host || !directStory) return;
  const entries = Array.isArray(directStory.line) ? directStory.line : [];
  if (!entries.length) {
    host.innerHTML = `<span class="small text-muted">${HISTORY_STATE_COPY.empty}</span>`;
    return;
  }
  const checkpoints = [];
  const first = entries[0];
  const middle = entries[Math.floor(entries.length / 2)];
  const latest = entries[entries.length - 1];
  checkpoints.push({ label: 'Origin', id: 'ancestor-step-1', name: first?.name || 'Origin' });
  if (middle && middle !== first && middle !== latest) {
    checkpoints.push({
      label: 'Middle era',
      id: `ancestor-step-${Math.floor(entries.length / 2) + 1}`,
      name: middle.name || 'Middle era'
    });
  }
  checkpoints.push({ label: 'Recent anchor', id: `ancestor-step-${entries.length}`, name: latest?.name || 'Recent anchor' });

  const jumps = checkpoints
    .map((point) => `<a href="#${esc(point.id)}" class="direct-quick-link history-quick-link" title="${esc(point.name)}">${esc(point.label)}</a>`)
    .join('');
  host.innerHTML = `${jumps}<a href="#directDescendantWall" class="direct-quick-link history-quick-link" title="Direct descendant wall">Descendants</a>`;
}

function renderMeta() {
  if (!directStory) return;
  const meta = document.getElementById('directMeta');
  if (!meta) return;
  const startName = directStory.startPerson?.name || 'Unknown';
  meta.textContent = `Anchor: ${startName} (id ${directStory.startId}) • ${directStory.generations} generations in direct line`;
}

function parseBirthYearForStory(entry) {
  const y = parseInt(String(entry?.birthYear ?? ''), 10);
  return Number.isFinite(y) ? y : null;
}

function centuryBucketFromYear(year) {
  return Math.floor(year / 100) * 100;
}

function truncateStoryCopy(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function updateDirectStoryToggleButton() {
  const toggle = document.getElementById('directAncestorStoryToggle');
  if (!toggle) return;
  const line = Array.isArray(directStory?.line) ? directStory.line : [];
  const hasPlaylist = Boolean(line.length);
  toggle.disabled = !hasPlaylist && !directStoryState.running;
  toggle.setAttribute('aria-pressed', directStoryState.running ? 'true' : 'false');
  toggle.textContent = directStoryState.running ? 'Pause highlight reel' : 'Play highlight reel';
}

function unbindDirectStoryFloatListeners() {
  if (!directStoryFloatScrollBound) return;
  window.removeEventListener('scroll', onDirectStoryFloatingReflow, true);
  window.removeEventListener('resize', onDirectStoryFloatingReflow);
  directStoryFloatScrollBound = false;
}

function onDirectStoryFloatingReflow() {
  if (!directStoryState.running) return;
  const overlay = document.getElementById('directAncestorStoryOverlay');
  if (!overlay || overlay.classList.contains('d-none')) return;
  if (directStoryFloatReflowScheduled) return;
  directStoryFloatReflowScheduled = true;
  window.requestAnimationFrame(() => {
    directStoryFloatReflowScheduled = false;
    repositionDirectStoryFloatingNugget();
  });
}

function bindDirectStoryFloatListeners() {
  if (directStoryFloatScrollBound) return;
  window.addEventListener('scroll', onDirectStoryFloatingReflow, true);
  window.addEventListener('resize', onDirectStoryFloatingReflow);
  directStoryFloatScrollBound = true;
}

function clearDirectFloatingOverlayStyles() {
  const overlay = document.getElementById('directAncestorStoryOverlay');
  if (!overlay) return;
  overlay.classList.remove('direct-story-overlay--floating');
  overlay.style.left = '';
  overlay.style.right = '';
  overlay.style.top = '';
  overlay.style.bottom = '';
  overlay.style.transform = '';
  overlay.style.width = '';
  overlay.style.maxWidth = '';
}

function directStoryClamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function positionDirectStoryFloatingNear(anchorEl) {
  const overlay = document.getElementById('directAncestorStoryOverlay');
  if (!overlay || overlay.classList.contains('d-none')) return;

  const pad = 10;
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  overlay.classList.add('direct-story-overlay--floating');

  const anchor = anchorEl instanceof Element ? anchorEl : null;

  function placeFallbackCenter() {
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.left = '50%';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
    overlay.style.top = `${Math.round(directStoryClamp(Math.min(vh * 0.2, Math.max(vh * 0.12, pad + 76)), pad, vh * 0.35))}px`;
    overlay.style.width = `${Math.round(Math.min(340, vw - 2 * pad))}px`;
  }

  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
    placeFallbackCenter();
    return;
  }

  const r = anchor.getBoundingClientRect();
  const narrow = vw <= 576;

  if (narrow) {
    overlay.style.transform = '';
    const w = Math.round(Math.min(340, vw - 18));
    let left = r.left + r.width / 2 - w / 2;
    left = directStoryClamp(left, pad, vw - w - pad);
    let top = r.bottom + gap;
    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.right = 'auto';
    overlay.style.width = `${w}px`;
    overlay.style.bottom = 'auto';
    overlay.style.top = `${Math.round(top)}px`;

    window.requestAnimationFrame(() => {
      const ob = overlay.getBoundingClientRect();
      if (ob.bottom > vh - pad) {
        const aboveTop = directStoryClamp(Math.round(r.top - gap - ob.height), pad, vh - ob.height - pad);
        overlay.style.top = `${aboveTop}px`;
      }
    });
    return;
  }

  overlay.style.transform = 'translateY(-50%)';
  overlay.style.bottom = 'auto';
  overlay.style.right = 'auto';
  overlay.style.width = '';

  let leftGuess = Math.round(r.right + gap);
  const midY = r.top + r.height / 2;
  overlay.style.top = `${Math.round(midY)}px`;
  overlay.style.left = `${leftGuess}px`;

  window.requestAnimationFrame(() => {
    const ob = overlay.getBoundingClientRect();
    if (leftGuess + ob.width > vw - pad) {
      leftGuess = Math.round(r.left - gap - ob.width);
    }
    leftGuess = directStoryClamp(leftGuess, pad, vw - ob.width - pad);
    overlay.style.left = `${leftGuess}px`;

    const ob2 = overlay.getBoundingClientRect();
    const half = ob2.height / 2;
    let centerY = directStoryClamp(r.top + r.height / 2, pad + half, vh - half - pad);
    overlay.style.top = `${Math.round(centerY)}px`;
  });
}

function repositionDirectStoryFloatingNugget() {
  let anchor =
    typeof directStoryFloatResolveAnchor === 'function' ? directStoryFloatResolveAnchor() : null;
  if (!anchor || !(anchor instanceof Element))
    anchor = document.querySelector('.ancestor-entry--story-active');
  positionDirectStoryFloatingNear(anchor || null);
}

function scheduleDirectStoryReposition() {
  const slots = [0, 48, 200, 450];
  for (let i = 0; i < slots.length; i++) window.setTimeout(() => repositionDirectStoryFloatingNugget(), slots[i]);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => repositionDirectStoryFloatingNugget()));
}

function setDirectAncestorStoryOverlay(scene) {
  const overlay = document.getElementById('directAncestorStoryOverlay');
  const kickerEl = document.getElementById('directAncestorStorySceneKicker');
  const titleEl = document.getElementById('directAncestorStorySceneTitle');
  const copyEl = document.getElementById('directAncestorStorySceneCopy');
  if (!overlay || !kickerEl || !titleEl || !copyEl) return;
  if (!scene) {
    unbindDirectStoryFloatListeners();
    directStoryFloatResolveAnchor = null;
    clearDirectFloatingOverlayStyles();
    overlay.classList.add('d-none');
    kickerEl.textContent = '';
    titleEl.textContent = '';
    copyEl.textContent = '';
    return;
  }
  bindDirectStoryFloatListeners();
  overlay.classList.remove('d-none');
  kickerEl.textContent = scene.kicker;
  titleEl.textContent = scene.title;
  copyEl.textContent = scene.copy;
  scheduleDirectStoryReposition();
}

function clearDirectStoryHighlights() {
  document.querySelectorAll('.ancestor-entry--story-active').forEach((el) => {
    el.classList.remove('ancestor-entry--story-active');
  });
}

function directStoryChaptersEnabled() {
  const el = document.getElementById('directAncestorStoryChapters');
  if (!el) return true;
  return el.checked;
}

function directStoryNarrationEnabled() {
  const el = document.getElementById('directAncestorStoryNarrate');
  if (!el) return true;
  return el.checked;
}

function persistDirectStoryModeOptions() {
  const ch = document.getElementById('directAncestorStoryChapters');
  const na = document.getElementById('directAncestorStoryNarrate');
  try {
    if (ch) localStorage.setItem(STORAGE_DIRECT_STORY_CHAPTERS, ch.checked ? '1' : '0');
    if (na) localStorage.setItem(STORAGE_DIRECT_STORY_NARRATE, na.checked ? '1' : '0');
  } catch (_) {}
}

function loadDirectStoryModeOptions() {
  const ch = document.getElementById('directAncestorStoryChapters');
  const na = document.getElementById('directAncestorStoryNarrate');
  try {
    if (ch) {
      const v = localStorage.getItem(STORAGE_DIRECT_STORY_CHAPTERS);
      if (v === '0') ch.checked = false;
      else if (v === '1') ch.checked = true;
      else ch.checked = true;
    }
    if (na) {
      let v = localStorage.getItem(STORAGE_DIRECT_STORY_NARRATE);
      if (v === null || v === undefined) {
        const legacy = localStorage.getItem(STORAGE_DIRECT_STORY_NARRATE_LEGACY);
        if (legacy === '0') na.checked = false;
        else na.checked = true;
      } else if (v === '1') na.checked = true;
      else na.checked = false;
    }
  } catch (_) {}
}

function sleepDirectStory(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stopDirectStoryNarration() {
  directStorySpeakToken += 1;
  if (typeof window.stopSpeech === 'function') window.stopSpeech();
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function directStoryNarrationText(scene) {
  if (!scene) return '';
  return String(scene.narration || '').trim();
}

function narrateDirectStoryAsync(text, token) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return Promise.resolve();
  const isCancelled = () => token !== directStorySpeakToken;
  if (typeof window.speakNarrationAwaitEnd === 'function') {
    return window.speakNarrationAwaitEnd(t, {
      volume: 0.85,
      isCancelled
    });
  }
  if (!('speechSynthesis' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    if (isCancelled()) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch (_) {}
      const u = new SpeechSynthesisUtterance(t);
      u.volume = 0.85;
      u.rate = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch (_) {
      resolve();
    }
  });
}

/** Run inside the Play button gesture so mobile / autoplay policies allow narration + MP3 synth. */
function primeDirectStoryAudioFromGesture() {
  if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
  if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
}

/**
 * Builds a begin-to-end playlist: optional era chapters on century boundaries, then one scene per ancestor step in order.
 */
function buildDirectAncestorStoryScenes() {
  const line = Array.isArray(directStory?.line) ? directStory.line : [];
  const scenes = [];
  const chaptersOn = directStoryChaptersEnabled();
  const n = line.length;
  if (!n) return scenes;

  const pushChapter = (bucket, title, copy, anchorId) => {
    const eraLabel =
      DIRECT_STORY_ERA_COPY[bucket]?.title ||
      (Number.isFinite(bucket) ? `${bucket}s` : 'New era');
    const body = copy || DIRECT_STORY_ERA_COPY[bucket]?.chapterCopy || 'Following the chain forward generation by generation.';
    const kicker = `Chapter · ${eraLabel}`;
    const narration = `${kicker}. ${title}. ${body}`;
    scenes.push({
      kind: 'chapter',
      anchorId: anchorId || '',
      kicker,
      title,
      copy: body,
      narration,
      durationMs: DIRECT_STORY_CHAPTER_DURATION_MS
    });
  };

  const pushStep = (entry, stepIndexZeroBased, totalSteps) => {
    const anchorId = `ancestor-step-${stepIndexZeroBased + 1}`;
    const by = parseBirthYearForStory(entry);
    const dy = parseInt(String(entry?.deathYear ?? ''), 10);
    const years =
      by == null
        ? `Step ${stepIndexZeroBased + 1} · birth year unclear`
        : `${by}${Number.isFinite(dy) ? ` – ${dy}` : ''}`;
    const title = `${entry?.name || 'Unknown'} (${years})`;
    const snippet = truncateStoryCopy(entry?.narrative || entry?.born || '', 220);
    const kicker = `Direct line · Step ${stepIndexZeroBased + 1} of ${totalSteps}`;
    const narration = `${kicker}. ${title}. ${snippet || 'Continuing the documented parent chain.'}`;
    scenes.push({
      kind: 'step',
      anchorId,
      kicker,
      title,
      copy: snippet || 'Lane-specific snippet appears in the timeline card beside this reel.',
      narration,
      durationMs: DIRECT_STORY_SCENE_DURATION_MS
    });
  };

  /** Last century bucket seen along the line — used only to insert chapter cards on boundary crossings. */
  let lastSeenBucket = null;

  for (let i = 0; i < n; i++) {
    const entry = line[i];
    const y = parseBirthYearForStory(entry);
    const bucket = y == null ? null : centuryBucketFromYear(y);

    if (chaptersOn && bucket != null && DIRECT_STORY_ERA_COPY[bucket]) {
      const anchorId = `ancestor-step-${i + 1}`;
      if (i === 0) {
        const meta = DIRECT_STORY_ERA_COPY[bucket];
        pushChapter(bucket, meta.title, meta.chapterCopy, anchorId);
        lastSeenBucket = bucket;
      } else if (lastSeenBucket !== null && bucket !== lastSeenBucket) {
        const meta = DIRECT_STORY_ERA_COPY[bucket];
        if (meta) pushChapter(bucket, meta.title, meta.chapterCopy, anchorId);
        lastSeenBucket = bucket;
      } else if (lastSeenBucket === null) {
        const meta = DIRECT_STORY_ERA_COPY[bucket];
        pushChapter(bucket, meta.title, meta.chapterCopy, anchorId);
        lastSeenBucket = bucket;
      }
    }

    if (bucket != null) lastSeenBucket = bucket;

    pushStep(entry, i, n);
  }

  return scenes;
}

function applyDirectAncestorStoryScene(scene) {
  clearDirectStoryHighlights();
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reducedMotion ? 'auto' : 'smooth';

  if (!scene) {
    setDirectAncestorStoryOverlay(null);
    return;
  }

  const rawId = scene.anchorId ? String(scene.anchorId).trim() : '';
  const anchorEl = rawId ? document.getElementById(rawId) : null;

  if (scene.kind === 'chapter') {
    directStoryFloatResolveAnchor = function directStoryChapterAnchor() {
      return anchorEl || document.getElementById('ancestor-step-1') || document.querySelector('.ancestor-entry');
    };
    setDirectAncestorStoryOverlay(scene);
    const scrollTarget = anchorEl || directStoryFloatResolveAnchor();
    if (scrollTarget && typeof scrollTarget.scrollIntoView === 'function')
      scrollTarget.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  directStoryFloatResolveAnchor = function directStoryStepAnchor() {
    return anchorEl;
  };

  setDirectAncestorStoryOverlay(scene);
  if (anchorEl) {
    anchorEl.classList.add('ancestor-entry--story-active');
    anchorEl.scrollIntoView({ behavior, block: 'center' });
    try {
      anchorEl.focus({ preventScroll: true });
    } catch (_) {}
  }
}

function stopDirectAncestorStoryMode(options = {}) {
  const preserveOverlay = Boolean(options.preserveOverlay);
  stopDirectStoryNarration();
  directStoryState.running = false;
  directStoryState.playbackToken += 1;
  clearDirectStoryHighlights();
  if (!preserveOverlay) setDirectAncestorStoryOverlay(null);
  updateDirectStoryToggleButton();
}

async function directAncestorStoryPlaybackLoop(playbackToken) {
  if (!directStoryState.scenes.length) {
    stopDirectStoryNarration();
    directStoryState.running = false;
    updateDirectStoryToggleButton();
    return;
  }
  let idx = 0;
  while (
    directStoryState.running &&
    playbackToken === directStoryState.playbackToken &&
    directStoryState.scenes.length
  ) {
    stopDirectStoryNarration();
    const scene = directStoryState.scenes[idx];
    if (!scene) break;
    applyDirectAncestorStoryScene(scene);
    const narrToken = directStorySpeakToken;
    const narrPromise =
      directStoryNarrationEnabled() && directStoryNarrationText(scene)
        ? narrateDirectStoryAsync(directStoryNarrationText(scene), narrToken)
        : Promise.resolve();
    const minMs = Number(scene.durationMs) || DIRECT_STORY_SCENE_DURATION_MS;
    await Promise.all([narrPromise, sleepDirectStory(minMs)]);
    if (!directStoryState.running || playbackToken !== directStoryState.playbackToken) break;
    if (idx + 1 >= directStoryState.scenes.length) {
      stopDirectAncestorStoryMode({ preserveOverlay: true });
      break;
    }
    await sleepDirectStory(DIRECT_STORY_SCENE_GAP_MS);
    idx += 1;
  }
  if (!directStoryState.running) updateDirectStoryToggleButton();
}

function restartDirectAncestorStoryKeepPlaying() {
  stopDirectStoryNarration();
  directStoryState.playbackToken += 1;
  directStoryState.running = true;
  const token = directStoryState.playbackToken;
  primeDirectStoryAudioFromGesture();
  updateDirectStoryToggleButton();
  void directAncestorStoryPlaybackLoop(token);
}

function startDirectAncestorStoryMode() {
  if (!directStoryState.scenes.length) return;
  if (typeof window.laneTtsStopPlayback === 'function') window.laneTtsStopPlayback();
  stopDirectStoryNarration();
  directStoryState.playbackToken += 1;
  directStoryState.running = true;
  const token = directStoryState.playbackToken;
  primeDirectStoryAudioFromGesture();
  updateDirectStoryToggleButton();
  void directAncestorStoryPlaybackLoop(token);
}

function initDirectAncestorHyperFrameStoryMode() {
  const toggle = document.getElementById('directAncestorStoryToggle');
  if (!toggle || toggle.dataset.bound === '1') {
    updateDirectStoryToggleButton();
    return;
  }
  toggle.dataset.bound = '1';
  loadDirectStoryModeOptions();
  persistDirectStoryModeOptions();

  toggle.addEventListener('click', () => {
    primeDirectStoryAudioFromGesture();
    if (directStoryState.running) {
      stopDirectAncestorStoryMode();
    } else {
      directStoryState.scenes = buildDirectAncestorStoryScenes();
      if (!directStoryState.scenes.length) {
        updateDirectStoryToggleButton();
        return;
      }
      startDirectAncestorStoryMode();
    }
  });

  ['directAncestorStoryChapters', 'directAncestorStoryNarrate'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      persistDirectStoryModeOptions();
      directStoryState.scenes = buildDirectAncestorStoryScenes();
      if (!directStoryState.scenes.length) {
        stopDirectAncestorStoryMode();
      } else if (directStoryState.running) {
        restartDirectAncestorStoryKeepPlaying();
      }
      updateDirectStoryToggleButton();
    });
  });

  updateDirectStoryToggleButton();
}

document.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Escape' || !directStoryState.running) return;
    stopDirectAncestorStoryMode();
  },
  true
);

async function boot() {
  directStory = await getJson(
    `/api/genealogy/direct-line-story?startId=${encodeURIComponent(String(LINE_ANCHOR_ID))}&order=oldest-first`
  );
  renderMeta();
  renderStory();
  renderQuickNav();

  if (window.LaneDirectDescendantWall && typeof window.LaneDirectDescendantWall.mount === 'function') {
    await window.LaneDirectDescendantWall.mount({
      startId: LINE_ANCHOR_ID,
      gridId: 'descendantWallGrid',
      metaId: 'descendantWallMeta',
      errorId: 'descendantWallError',
      quickNavId: 'descendantWallQuickNav',
      idPrefix: 'descendant-step'
    });
  }

  if (typeof window.initHistoryQuickNav === 'function') {
    window.initHistoryQuickNav({ selector: '.history-quick-link[href^="#"]' });
  }

  initDirectAncestorHyperFrameStoryMode();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const err = document.getElementById('directError');
    if (err) err.textContent = HISTORY_STATE_COPY.loading;
    loadDescendantDraft();
    await boot();
    if (err) err.textContent = '';
    renderDescendantDraft();
    const form = document.getElementById('descendantForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = document.getElementById('descName');
        const yearInput = document.getElementById('descBirthYear');
        const relationInput = document.getElementById('descRelation');
        const name = String(nameInput?.value || '').trim();
        if (!name) return;
        const birthYear = String(yearInput?.value || '').trim();
        const relation = String(relationInput?.value || '').trim();
        descendantDraft.push({ name, birthYear, relation });
        persistDescendantDraft();
        renderDescendantDraft();
        form.reset();
      });
    }
    const clearBtn = document.getElementById('clearDescendantsBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        descendantDraft = [];
        persistDescendantDraft();
        renderDescendantDraft();
      });
    }
  } catch (error) {
    console.error(error);
    const err = document.getElementById('directError');
    if (err)
      err.textContent = `${HISTORY_STATE_COPY.unavailable} ${error.message}. Verify GET /api/genealogy/direct-line-story parameters.`;
  }
});
