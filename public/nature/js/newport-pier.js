/**
 * Newport Beach Pier — HyperFrame fish guide (story mode + HeyGen studio).
 */
(function () {
  const DATA_URL = '/data/newport-pier-fish.json';
  const API_CATALOG = '/api/newport-pier/catalog';
  const API_SAVE = '/api/newport-pier/stops/save';
  const API_EXPORT = '/api/newport-pier/stops/export';
  const API_CACHE_CLIP = '/api/newport-pier/stops/cache-clip';
  const API_HEALTH = '/api/newport-pier/health';
  const API_REEL_RENDER = '/api/newport-pier/reel/render';
  const API_REEL_STATUS = '/api/newport-pier/reel/render/status';
  const STORAGE_AVATAR = 'np-heygen-avatar-id';
  const STORAGE_VOICE = 'np-heygen-voice-id';
  const STORAGE_CLIPS = 'np-heygen-stop-clips';
  const STORAGE_PIP_MODE = 'np-heygen-pip-mode';
  const STORAGE_SAVED_STOPS = 'np-saved-stops';
  const POLL_MS = 5000;
  const POLL_TIMEOUT_MS = 600000;
  const STORY_HOLD_MS = 12000;

  let catalog = null;
  let fishById = new Map();
  let avatarCatalog = [];
  let activeStopIndex = 0;
  let storyRunning = false;
  let storyToken = 0;
  let narrateOn = true;
  let pollTimer = null;
  let serverSaveReady = false;
  let reelRenderReady = false;
  let activeVideoId = null;
  let activeLibraryId = null;
  let lastHeygenVideoId = null;
  let generateAllRunning = false;
  let studioReady = false;
  let studioInitPromise = null;
  let reelPollTimer = null;
  let reelSkipNarration = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function storyRequested() {
    const q = new URLSearchParams(window.location.search);
    return q.get('story') === '1' || q.get('story') === 'true' || q.get('reel') === '1';
  }

  function readClipOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_CLIPS) || '{}');
    } catch {
      return {};
    }
  }

  function writeClipOverride(stopId, url) {
    const clips = readClipOverrides();
    if (url) clips[stopId] = url;
    else delete clips[stopId];
    localStorage.setItem(STORAGE_CLIPS, JSON.stringify(clips));
  }

  function clipUrlForStop(stop) {
    const overrides = readClipOverrides();
    const saved = readSavedStops();
    return (
      overrides[stop.id] ||
      saved[stop.id]?.heygenVideoUrl ||
      saved[stop.id]?.heygenVideoAlphaUrl ||
      stop.heygenVideoAlphaUrl ||
      stop.heygenVideoUrl ||
      null
    );
  }

  function clipFieldForUrl(url) {
    if (!url) return null;
    if (/\.webm(\?|$)/i.test(url)) return 'heygenVideoAlphaUrl';
    return 'heygenVideoUrl';
  }

  function pipStyleForUrl(url) {
    if (!url) return 'window';
    if (/\.webm(\?|$)/i.test(url) || url.includes('-pip.webm')) return 'alpha';
    return catalog?.avatar?.pipStyle === 'circle' ? 'circle' : 'window';
  }

  function applyPipClasses(pip, url) {
    if (!pip) return;
    const style = pipStyleForUrl(url);
    pip.classList.toggle('np-avatar-pip--alpha', style === 'alpha');
    pip.classList.toggle('np-avatar-pip--circle', style === 'circle' || style === 'alpha');
  }

  function readPipMode() {
    try {
      return localStorage.getItem(STORAGE_PIP_MODE) || catalog?.avatar?.pipMode || 'webm';
    } catch {
      return catalog?.avatar?.pipMode || 'webm';
    }
  }

  function readHeygenGenerateOptions(stop) {
    const pipMode = $('npStudioPipMode')?.value || readPipMode();
    const avatarId = $('npStudioAvatar')?.value;
    const voiceId = $('npStudioVoice')?.value || undefined;
    const script = ($('npStudioScript')?.value || stop?.heygenScript || '').trim();
    const title =
      ($('npStudioTitle')?.value || '').trim() || `Newport Pier — ${stop?.label || 'Stop'}`;
    const resolution = $('npStudioResolution')?.value || '1080p';
    const aspectRatio = $('npStudioAspect')?.value || '16:9';
    const motionPrompt = ($('npStudioMotion')?.value || '').trim() || undefined;
    const expressiveness = $('npStudioExpressiveness')?.value || undefined;
    const base = {
      avatarId,
      voiceId,
      script,
      title,
      resolution,
      aspectRatio,
      motionPrompt,
      expressiveness
    };
    if (pipMode === 'webm') {
      const removeBg = $('npStudioRemoveBg')?.checked !== false;
      return { ...base, outputFormat: 'webm', ...(removeBg ? { removeBackground: true } : {}) };
    }
    if (pipMode === 'greenscreen') {
      const color = $('npStudioBgColor')?.value || '#00FF00';
      return { ...base, outputFormat: 'mp4', background: { type: 'color', value: color } };
    }
    return { ...base, outputFormat: 'mp4' };
  }

  function updatePipModeUi() {
    const mode = $('npStudioPipMode')?.value || readPipMode();
    const removeWrap = $('npStudioRemoveBgWrap');
    const bgWrap = $('npStudioBgColorWrap');
    if (removeWrap) removeWrap.hidden = mode !== 'webm';
    if (bgWrap) bgWrap.hidden = mode !== 'greenscreen';
  }

  function setStudioGenerating(on) {
    const ids = [
      'npStudioGenerateBtn',
      'npStudioGenerateAllBtn',
      'npStudioSaveUrlBtn',
      'npStudioAvatar',
      'npStudioVoice',
      'npStudioStop',
      'npPresenterGenerateBtn'
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!on;
    });
    const progress = $('npStudioProgress');
    if (progress) progress.hidden = !on;
  }

  function showStudioResult(videoUrl, libraryId, videoId) {
    const wrap = $('npStudioResult');
    const video = $('npStudioResultVideo');
    if (!wrap || !video) return;
    wrap.hidden = false;
    video.src = videoUrl;
    const dl = $('npStudioDownloadLink');
    if (dl) {
      dl.href = videoUrl;
      dl.hidden = false;
    }
    const lib = $('npStudioLibraryLink');
    if (lib) {
      lib.href = libraryId
        ? `/heygen-hub.html#${encodeURIComponent(libraryId)}`
        : '/heygen-hub.html?domain=nature';
      lib.hidden = false;
    }
    const copyBtn = $('npStudioCopyVideoId');
    if (copyBtn) {
      copyBtn.dataset.videoId = videoId || '';
      copyBtn.hidden = !videoId;
    }
  }

  function syncAvatarThumb() {
    const thumb = $('npStudioAvatarThumb');
    if (!thumb) return;
    const avatar = findAvatar($('npStudioAvatar')?.value);
    const url = avatarPreviewUrl(avatar);
    if (url) {
      thumb.src = url;
      thumb.hidden = false;
    } else {
      thumb.hidden = true;
      thumb.removeAttribute('src');
    }
  }

  function labelAvatar(a) {
    return a?.avatar_name || a?.name || a?.avatar_id || a?.id || 'Avatar';
  }

  function labelVoice(v) {
    const name = v?.name || v?.display_name || v?.voice_id || v?.id || 'Voice';
    const lang = v?.language ? ` · ${v.language}` : '';
    return `${name}${lang}`;
  }

  function avatarIdOf(a) {
    return a?.avatar_id || a?.id || '';
  }

  function voiceIdOf(v) {
    return v?.voice_id || v?.id || '';
  }

  function populateSelect(select, items, idFn, labelFn, savedId) {
    if (!select) return;
    select.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— pick —';
    select.appendChild(blank);
    items.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = idFn(item);
      opt.textContent = labelFn(item);
      select.appendChild(opt);
    });
    if (savedId && items.some((item) => idFn(item) === savedId)) {
      select.value = savedId;
    } else if (savedId) {
      select.value = savedId;
    }
  }

  function populateAvatarSelect(select, avatars, savedId) {
    populateSelect(select, avatars, avatarIdOf, labelAvatar, '');
    const catalogId = (catalog.avatar?.avatarId || '').trim();
    const useId = savedId || catalogId;
    if (useId && !avatars.some((a) => avatarIdOf(a) === useId)) {
      const opt = document.createElement('option');
      opt.value = useId;
      opt.textContent = catalog.avatar?.label || 'My avatar (saved)';
      const blank = select.querySelector('option[value=""]');
      if (blank?.nextSibling) select.insertBefore(opt, blank.nextSibling);
      else select.appendChild(opt);
    }
    if (useId) select.value = useId;
  }

  async function parseJsonResponse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (text.trimStart().startsWith('<')) {
        const err = new Error(
          `Server returned HTML (${res.status}) — restart npm run dev to load API routes, or run: npm run render:newport-pier-reel:local`
        );
        err.code = 'HTML_RESPONSE';
        throw err;
      }
      throw new Error(`Invalid JSON from server (${res.status})`);
    }
  }

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const json = await parseJsonResponse(res);
    if (!res.ok || json.success === false) {
      throw new Error(json.error || json.message || `Request failed (${res.status})`);
    }
    return json;
  }

  function setStatus(msg, tone) {
    const el = $('npStudioStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `np-status small text-${tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'muted'}`;
  }

  function pipDismissed() {
    try {
      return sessionStorage.getItem('np-pip-dismissed') === '1';
    } catch {
      return false;
    }
  }

  function setPipDismissed(dismissed) {
    try {
      if (dismissed) sessionStorage.setItem('np-pip-dismissed', '1');
      else sessionStorage.removeItem('np-pip-dismissed');
    } catch (_) {}
  }

  function readSavedStops() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SAVED_STOPS) || '{}');
    } catch {
      return {};
    }
  }

  function writeSavedStop(stopId, data) {
    const saved = readSavedStops();
    if (data) saved[stopId] = data;
    else delete saved[stopId];
    localStorage.setItem(STORAGE_SAVED_STOPS, JSON.stringify(saved));
  }

  function applySavedStops() {
    const saved = readSavedStops();
    (catalog.stops || []).forEach((stop) => {
      const row = saved[stop.id];
      if (row?.heygenScript) stop.heygenScript = row.heygenScript;
      if (row?.heygenVideoUrl) stop.heygenVideoUrl = row.heygenVideoUrl;
      if (row?.heygenVideoAlphaUrl) stop.heygenVideoAlphaUrl = row.heygenVideoAlphaUrl;
    });
    if (saved._avatar?.avatarId) {
      catalog.avatar = catalog.avatar || {};
      catalog.avatar.avatarId = saved._avatar.avatarId;
      if (saved._avatar.label) catalog.avatar.label = saved._avatar.label;
    }
  }

  function presenterSaveStatus(stop) {
    const el = $('npPresenterSaveStatus');
    if (!el || !stop) return;
    const clip = clipUrlForStop(stop);
    const saved = readSavedStops()[stop.id];
    const hasAvatar = Boolean(saved?.avatarId || activeAvatarId());
    if (saved && clip && hasAvatar) {
      el.textContent = 'Saved on server + this browser: avatar, script, and clip.';
      el.className = 'small text-success mb-0 mt-1';
    } else if (saved && hasAvatar) {
      el.textContent = 'Saved on server + browser. Generate a clip, then Save stop again.';
      el.className = 'small text-success mb-0 mt-1';
    } else if (clip) {
      el.textContent = 'Video clip in browser — click Save stop to keep avatar + script too.';
      el.className = 'small text-warning mb-0 mt-1';
    } else if (hasAvatar) {
      el.textContent = 'Avatar photo + TTS ready — Save stop or Generate clip for video.';
      el.className = 'small text-muted mb-0 mt-1';
    } else {
      el.textContent = 'Pick an avatar in HeyGen studio below.';
      el.className = 'small text-muted mb-0 mt-1';
    }
  }

  function buildStopSaveSnippet(stop, { avatarId, label, script, clipUrl }) {
    const avatarBlock = JSON.stringify(
      {
        avatarId,
        voiceId: localStorage.getItem(STORAGE_VOICE) || catalog.avatar?.voiceId || '',
        label: label || catalog.avatar?.label || 'My avatar',
        pipMode: readPipMode(),
        pipStyle: catalog.avatar?.pipStyle || 'circle'
      },
      null,
      2
    );
    const stopPayload = { id: stop.id, heygenScript: script };
    const clipField = clipFieldForUrl(clipUrl);
    if (clipField && clipUrl) stopPayload[clipField] = clipUrl;
    const stopBlock = JSON.stringify(stopPayload, null, 2);
    const clipNote = clipUrl
      ? ''
      : '\n/* No video yet — heygenVideoUrl stays null until you generate or paste a clip */';
    return `/* Paste into data/newport-pier-fish.json — avatar (top level) */\n${avatarBlock}\n\n/* Stop "${stop.label}" */\n${stopBlock}${clipNote}`;
  }

  async function saveStop() {
    const stop = catalog.stops?.[activeStopIndex];
    if (!stop) return;
    const avatarId = $('npStudioAvatar')?.value || activeAvatarId();
    const script = ($('npStudioScript')?.value || stop.heygenScript || '').trim();
    const clipUrl = ($('npStudioClipUrl')?.value || clipUrlForStop(stop) || '').trim();
    if (!avatarId) {
      setPresenterSaveStatus('Pick an avatar in HeyGen studio first.', 'warning');
      return;
    }
    if (!script) {
      setPresenterSaveStatus('Script is empty.', 'warning');
      return;
    }
    const avatar = findAvatar(avatarId);
    const label = avatar ? labelAvatar(avatar) : catalog.avatar?.label || 'My avatar';
    const previewUrl = avatarPreviewUrl(avatar);
    stop.heygenScript = script;
    if (clipUrl) {
      writeClipOverride(stop.id, clipUrl);
      const clipField = clipFieldForUrl(clipUrl);
      if (clipField === 'heygenVideoAlphaUrl') {
        stop.heygenVideoAlphaUrl = clipUrl;
        stop.heygenVideoUrl = null;
      } else {
        stop.heygenVideoUrl = clipUrl;
      }
      setPipDismissed(false);
    }
    try {
      localStorage.setItem(STORAGE_AVATAR, avatarId);
      const voiceId = $('npStudioVoice')?.value;
      if (voiceId) localStorage.setItem(STORAGE_VOICE, voiceId);
    } catch (_) {}
    const savedRow = {
      avatarId,
      label,
      heygenScript: script,
      avatarPreviewUrl: previewUrl || undefined,
      savedAt: new Date().toISOString()
    };
    if (clipUrl) {
      const clipField = clipFieldForUrl(clipUrl);
      savedRow[clipField] = clipUrl;
    }
    writeSavedStop(stop.id, savedRow);
    const saved = readSavedStops();
    saved._avatar = { avatarId, label, previewUrl: previewUrl || undefined };
    localStorage.setItem(STORAGE_SAVED_STOPS, JSON.stringify(saved));
    catalog.avatar = catalog.avatar || {};
    catalog.avatar.avatarId = avatarId;
    catalog.avatar.label = label;
    const voiceId = $('npStudioVoice')?.value || localStorage.getItem(STORAGE_VOICE) || '';
    let serverMsg = '';
    try {
      const apiRes = await fetchJson(API_SAVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopId: stop.id,
          heygenScript: script,
          clipUrl: clipUrl || null,
          avatar: {
            avatarId,
            voiceId,
            label,
            pipMode: readPipMode(),
            pipStyle: catalog.avatar?.pipStyle || 'circle'
          }
        })
      });
      serverMsg = apiRes.message || 'Saved to server for everyone.';
      if (apiRes.stop) {
        Object.assign(stop, apiRes.stop);
      }
      if (apiRes.avatar) {
        catalog.avatar = { ...catalog.avatar, ...apiRes.avatar };
      }
    } catch (e) {
      const snippet = buildStopSaveSnippet(stop, { avatarId, label, script, clipUrl });
      try {
        await navigator.clipboard.writeText(snippet);
      } catch {
        console.log(snippet);
      }
      const restartHint =
        e.message && e.message.includes('404')
          ? ' Restart the app server (npm run dev) so /api/newport-pier is loaded.'
          : '';
      setPresenterSaveStatus(
        `Browser only — server save failed: ${e.message}.${restartHint}`,
        'warning'
      );
      setStatus(`Browser only — server save failed: ${e.message}.${restartHint}`, 'warning');
      renderAvatarPanel(stop);
      syncStudioFields();
      return;
    }
    const msg = clipUrl
      ? `${serverMsg} Avatar + script + clip.`
      : `${serverMsg} Avatar + script (no clip yet).`;
    setPresenterSaveStatus(msg, 'success');
    setStatus(msg, 'success');
    renderAvatarPanel(stop);
    syncStudioFields();
  }

  async function cacheClipOnServer(stop, clipUrl, videoId) {
    if (!stop?.id || !clipUrl) return null;
    try {
      const res = await fetchJson(API_CACHE_CLIP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId: stop.id, clipUrl, videoId: videoId || null })
      });
      if (res.stop) Object.assign(stop, res.stop);
      if (res.localClipUrl) {
        writeClipOverride(stop.id, res.localClipUrl);
        $('npStudioClipUrl').value = res.localClipUrl;
      }
      return res;
    } catch (e) {
      console.warn('Clip cache failed (bake may still work with fresh URL):', e.message);
      return null;
    }
  }

  function bakeErrorHint(message, stopId) {
    const m = String(message || '');
    if (/403|CLIP_DOWNLOAD|expired|Signature|Key-Pair-Id|Forbidden/i.test(m)) {
      return ' Re-generate the HeyGen clip (Generate clip), wait until it finishes — the clip is cached locally for baking.';
    }
    if (/CLIP_NOT_FOUND|not found/i.test(m) && !/403/i.test(m)) {
      return ' Save a clip URL or generate a new HeyGen clip for this stop.';
    }
    if (/NO_AVATAR/i.test(m)) {
      return ' Generate a clip or pick an avatar with a preview photo.';
    }
    if (/COMPOSITE_FAILED|ffmpeg/i.test(m) && !/403|Signature|Key-Pair-Id/i.test(m)) {
      return ` Try: npm run composite:newport-pier-stop -- --stop ${stopId}`;
    }
    return '';
  }

  async function bakeStopVideo() {
    const stop = catalog.stops?.[activeStopIndex];
    if (!stop) return;
    const clipUrl = ($('npStudioClipUrl')?.value || clipUrlForStop(stop) || '').trim();
    const avatar = findAvatar($('npStudioAvatar')?.value || activeAvatarId());
    const avatarImageUrl = avatarPreviewUrl(avatar) || '';
    if (!clipUrl && !avatarImageUrl) {
      setPresenterSaveStatus(
        'Need a HeyGen clip URL or avatar photo to bake. Generate a clip or save with an avatar preview.',
        'warning'
      );
      return;
    }
    const btn = $('npBakeVideoBtn');
    if (btn) btn.disabled = true;
    setPresenterSaveStatus('Baking pier walk + avatar with ffmpeg…', 'muted');
    try {
      const apiRes = await fetchJson(API_EXPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopId: stop.id,
          clipUrl: clipUrl || null,
          avatarImageUrl: avatarImageUrl || null,
          videoId: lastHeygenVideoId || null,
          durationSec: 12
        })
      });
      if (apiRes.stop) Object.assign(stop, apiRes.stop);
      const url = apiRes.videoUrl;
      const statusEl = $('npPresenterSaveStatus');
      if (statusEl) {
        statusEl.innerHTML = `${apiRes.message || 'Baked.'} <a href="${esc(url)}" download>Download MP4</a>`;
        statusEl.className = 'small text-success mb-0 mt-1';
      }
      setStatus(`Baked composite → ${url}`, 'success');
    } catch (e) {
      const hint = bakeErrorHint(e.message, stop.id);
      setPresenterSaveStatus(`Bake failed: ${e.message}.${hint}`, 'warning');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function setPresenterSaveStatus(msg, tone) {
    const el = $('npPresenterSaveStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `small mb-0 mt-1 text-${tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'muted'}`;
  }

  function avatarImageForPresenter() {
    const saved = readSavedStops()._avatar?.previewUrl;
    if (saved) return saved;
    const avatarId = activeAvatarId();
    const avatar = findAvatar(avatarId);
    return avatarPreviewUrl(avatar);
  }

  function syncPipPresenter(stop) {
    const pip = $('npAvatarPip');
    const pipVideo = $('npAvatarPipVideo');
    const pipImg = $('npAvatarPipImg');
    const pipBadge = $('npAvatarPipBadge');
    if (!pip || !pipVideo || !pipImg || !stop) return;

    const clipUrl = clipUrlForStop(stop);
    const avatarImg = avatarImageForPresenter();

    if (pipDismissed()) {
      pip.hidden = true;
      pip.classList.add('is-hidden');
      pipVideo.hidden = true;
      pipImg.hidden = true;
      if (pipBadge) pipBadge.hidden = true;
      pipVideo.removeAttribute('src');
      pipImg.removeAttribute('src');
      if (pipBadge) pipBadge.removeAttribute('src');
      return;
    }

    if (clipUrl) {
      pipImg.hidden = true;
      pipImg.removeAttribute('src');
      pipVideo.hidden = false;
      if (pipVideo.getAttribute('src') !== clipUrl) pipVideo.src = clipUrl;
      applyPipClasses(pip, clipUrl);
      if (pipBadge && avatarImg) {
        pipBadge.hidden = false;
        if (pipBadge.getAttribute('src') !== avatarImg) pipBadge.src = avatarImg;
        pip.classList.add('np-avatar-pip--dual');
      } else if (pipBadge) {
        pipBadge.hidden = true;
        pip.classList.remove('np-avatar-pip--dual');
      }
    } else if (avatarImg) {
      if (pipBadge) {
        pipBadge.hidden = true;
        pipBadge.removeAttribute('src');
      }
      pip.classList.remove('np-avatar-pip--dual');
      pipVideo.hidden = true;
      pipVideo.removeAttribute('src');
      pipVideo.pause();
      pipImg.hidden = false;
      if (pipImg.getAttribute('src') !== avatarImg) pipImg.src = avatarImg;
      pip.classList.add('np-avatar-pip--circle');
      pip.classList.remove('np-avatar-pip--alpha');
    } else {
      pip.hidden = true;
      pip.classList.add('is-hidden');
      pipVideo.hidden = true;
      pipImg.hidden = true;
      if (pipBadge) pipBadge.hidden = true;
      return;
    }

    pip.hidden = false;
    pip.classList.remove('is-hidden');
  }

  function hidePip() {
    const pip = $('npAvatarPip');
    const pipVideo = $('npAvatarPipVideo');
    const pipImg = $('npAvatarPipImg');
    if (pipVideo && !pipVideo.paused) pipVideo.pause();
    if (pip) {
      pip.hidden = true;
      pip.classList.add('is-hidden');
    }
    if (pipVideo) pipVideo.hidden = true;
    if (pipImg) pipImg.hidden = true;
  }

  function stopNarration() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    const av = $('npAvatarVideo');
    if (av && !av.paused) av.pause();
    const pipVideo = $('npAvatarPipVideo');
    if (pipVideo && !pipVideo.paused) pipVideo.pause();
  }

  function renderHero() {
    const h = catalog.hero || {};
    $('npKicker').textContent = h.kicker || 'Newport Beach Pier';
    $('npTitle').textContent = h.title || 'Pier walk & catch guide';
    $('npSubtitle').textContent = h.subtitle || '';
    document.title = `${h.title || 'Newport Pier'} — School of Fish`;
  }

  function renderStopNav() {
    const nav = $('npStopNav');
    if (!nav) return;
    nav.innerHTML = (catalog.stops || [])
      .map(
        (stop, i) =>
          `<button type="button" class="btn btn-sm btn-outline-primary np-stop-btn${i === activeStopIndex ? ' active' : ''}" data-stop="${i}">${esc(stop.label)}</button>`
      )
      .join('');
    nav.querySelectorAll('[data-stop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToStop(Number(btn.dataset.stop), { playClip: true });
      });
    });
  }

  function renderFishRail(highlightId) {
    const rail = $('npFishRail');
    if (!rail) return;
    rail.innerHTML = (catalog.fish || [])
      .map((fish) => {
        const stops = (catalog.stops || [])
          .filter((s) => (s.fish || []).includes(fish.id))
          .map((s) => s.label)
          .join(', ');
        const active = fish.id === highlightId ? ' is-active' : '';
        return `<article class="np-fish-item${active}" data-fish-id="${esc(fish.id)}" tabindex="0">
          <img src="${esc(fish.imageUrl)}" alt="${esc(fish.commonName)}" loading="lazy" />
          <div class="np-fish-body">
            <p class="np-fish-name">${esc(fish.commonName)}</p>
            <p class="np-fish-sci">${esc(fish.scientific)}</p>
            <p class="np-fish-meta">${esc(fish.season)} · ${esc(fish.bait)}</p>
            ${stops ? `<p class="np-fish-meta">Stops: ${esc(stops)}</p>` : ''}
          </div>
        </article>`;
      })
      .join('');

    rail.querySelectorAll('.np-fish-item').forEach((card) => {
      const activate = () => highlightFishStops(card.dataset.fishId);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  function highlightFishStops(fishId) {
    renderFishRail(fishId);
    const idx = (catalog.stops || []).findIndex((s) => (s.fish || []).includes(fishId));
    if (idx >= 0) goToStop(idx, { playClip: false });
  }

  function fishNamesForStop(stop) {
    return (stop.fish || [])
      .map((id) => fishById.get(id)?.commonName || id)
      .filter(Boolean);
  }

  function setOverlay(stop) {
    const overlay = $('npOverlay');
    if (!overlay || !stop) {
      if (overlay) overlay.classList.remove('is-visible');
      return;
    }
    $('npOverlayKicker').textContent = stop.kicker || stop.label;
    $('npOverlayTitle').textContent = stop.label;
    const chips = fishNamesForStop(stop)
      .map((name) => `<span class="np-fish-chip">${esc(name)}</span>`)
      .join('');
    $('npOverlayChips').innerHTML = chips;
    overlay.classList.add('is-visible');
  }

  function updateStudioStopSelect() {
    const sel = $('npStudioStop');
    if (!sel) return;
    sel.innerHTML = (catalog.stops || [])
      .map((s, i) => `<option value="${i}">${esc(s.label)}</option>`)
      .join('');
    sel.value = String(activeStopIndex);
  }

  function syncStudioFields() {
    const stop = catalog.stops?.[activeStopIndex];
    if (!stop) return;
    const scriptEl = $('npStudioScript');
    const urlEl = $('npStudioClipUrl');
    const titleEl = $('npStudioTitle');
    if (scriptEl) scriptEl.value = stop.heygenScript || '';
    if (urlEl) urlEl.value = clipUrlForStop(stop) || '';
    if (titleEl) titleEl.value = `Newport Pier — ${stop.label}`;
    updateStudioStopSelect();
  }

  function avatarPreviewUrl(avatar) {
    if (!avatar) return null;
    return (
      avatar.preview_image_url ||
      avatar.preview_url ||
      avatar.image_url ||
      avatar.thumbnail_url ||
      avatar.avatar_url ||
      null
    );
  }

  function findAvatar(avatarId) {
    if (!avatarId) return null;
    return avatarCatalog.find((a) => avatarIdOf(a) === avatarId) || null;
  }

  function activeAvatarId() {
    return (
      $('npStudioAvatar')?.value ||
      localStorage.getItem(STORAGE_AVATAR) ||
      catalog?.avatar?.avatarId ||
      ''
    );
  }

  function renderAvatarPanel(stop) {
    const mount = $('npAvatarMount');
    const scriptEl = $('npAvatarScript');
    const genBtn = $('npPresenterGenerateBtn');
    if (!mount || !stop) return;
    const clipUrl = clipUrlForStop(stop);
    syncPipPresenter(stop);
    if (clipUrl) {
      const avatarId = activeAvatarId();
      const avatar = findAvatar(avatarId);
      const preview = avatarPreviewUrl(avatar);
      const label = avatar ? labelAvatar(avatar) : catalog?.avatar?.label || 'Your presenter';
      const thumb = preview
        ? `<img class="np-presenter-thumb" src="${esc(preview)}" alt="${esc(label)}" />`
        : '';
      mount.innerHTML = `${thumb}<video class="np-avatar-video" id="npAvatarVideo" controls playsinline preload="metadata" src="${esc(clipUrl)}"></video>
        <p class="small text-muted mb-0 mt-2"><i class="bi bi-pip"></i> Avatar + clip on pier video. No clip? TTS uses your photo.</p>`;
      if (genBtn) genBtn.hidden = true;
    } else {
      const avatarId = activeAvatarId();
      const avatar = findAvatar(avatarId);
      const preview = avatarPreviewUrl(avatar);
      const label = avatar ? labelAvatar(avatar) : catalog?.avatar?.label || 'Your presenter';
      if (preview) {
        mount.innerHTML = `<div class="np-avatar-preview">
          <img src="${esc(preview)}" alt="${esc(label)}" />
          <div class="np-avatar-preview-cap">
            <strong>${esc(label)}</strong><br>
            No clip for this stop yet — click <em>Narrate stop</em> for voice, or generate below.
          </div>
        </div>`;
      } else if (avatarId) {
        mount.innerHTML = `<div class="np-avatar-placeholder">
          <i class="bi bi-person-check"></i><br>
          Avatar saved (${esc(avatarId.slice(0, 8))}…)<br>
          <span class="small">Generate a clip below to see video here.</span>
        </div>`;
      } else {
        mount.innerHTML = `<div class="np-avatar-placeholder"><i class="bi bi-person-video3"></i><br>Pick your avatar in HeyGen studio below.</div>`;
      }
      if (genBtn) {
        genBtn.hidden = !avatarId;
      }
    }
    if (scriptEl) scriptEl.textContent = stop.heygenScript || '';
    syncStudioFields();
    presenterSaveStatus(stop);
  }

  async function playNarrationForStop(stop) {
    if (!narrateOn || !stop) return;
    stopNarration();
    const clipUrl = clipUrlForStop(stop);
    syncPipPresenter(stop);
    const av = $('npAvatarVideo');
    const pipVideo = $('npAvatarPipVideo');
    if (clipUrl && (av || pipVideo)) {
      try {
        if (av) {
          av.currentTime = 0;
          await av.play();
        }
        if (pipVideo) {
          pipVideo.currentTime = 0;
          await pipVideo.play();
        }
        const endedOn = av || pipVideo;
        await new Promise((resolve) => {
          endedOn.onended = resolve;
          endedOn.onerror = resolve;
        });
        return;
      } catch {
        /* fall through to TTS */
      }
    }
    const text = stop.heygenScript || '';
    if (!text) return;
    syncPipPresenter(stop);
    if (typeof window.speakNarrationAwaitEnd === 'function') {
      await window.speakNarrationAwaitEnd(text, { voice: 'en-US-Standard-D' });
    } else if (typeof window.speakWithGoogle === 'function') {
      await window.speakWithGoogle(text);
    }
  }

  function goToStop(index, { playClip } = {}) {
    const stops = catalog.stops || [];
    if (!stops.length) return;
    activeStopIndex = Math.max(0, Math.min(index, stops.length - 1));
    const stop = stops[activeStopIndex];
    const video = $('npWalkVideo');
    if (video) {
      video.pause();
      video.currentTime = Number(stop.timeSec) || 0;
    }
    $('npVideoWrap')?.classList.add('is-story');
    setOverlay(stop);
    renderStopNav();
    renderAvatarPanel(stop);
    if (playClip) playNarrationForStop(stop);
  }

  async function runStory() {
    storyToken += 1;
    const token = storyToken;
    storyRunning = true;
    $('npStoryBtn')?.setAttribute('disabled', 'disabled');
    const stops = catalog.stops || [];
    for (let i = 0; i < stops.length; i += 1) {
      if (!storyRunning || token !== storyToken) break;
      goToStop(i, { playClip: false });
      const narrPromise = playNarrationForStop(stops[i]);
      const holdPromise = new Promise((r) => setTimeout(r, STORY_HOLD_MS));
      await Promise.race([narrPromise, holdPromise]);
      if (!storyRunning || token !== storyToken) break;
    }
    storyRunning = false;
    $('npStoryBtn')?.removeAttribute('disabled');
  }

  function stopStory() {
    storyRunning = false;
    storyToken += 1;
    stopNarration();
    $('npVideoWrap')?.classList.remove('is-story');
    $('npOverlay')?.classList.remove('is-visible');
    $('npStoryBtn')?.removeAttribute('disabled');
  }

  function bindVideo() {
    const video = $('npWalkVideo');
    if (!video || !catalog?.video?.src) return;
    video.src = catalog.video.src;
    if (catalog.video.poster) video.poster = catalog.video.poster;
    $('npCopyTimeBtn')?.addEventListener('click', () => {
      const t = video.currentTime.toFixed(2);
      console.log(`Stop timeSec: ${t} (stop: ${catalog.stops?.[activeStopIndex]?.id || 'unknown'})`);
      navigator.clipboard?.writeText(t).catch(() => {});
      setStatus(`Copied ${t}s to clipboard — paste into data/newport-pier-fish.json`, 'success');
    });
  }

  function bindPip() {
    $('npAvatarPipClose')?.addEventListener('click', () => {
      setPipDismissed(true);
      hidePip();
    });
  }

  function bindControls() {
    $('npStoryBtn')?.addEventListener('click', () => {
      if (storyRunning) {
        stopStory();
        return;
      }
      runStory();
    });
    $('npPrevBtn')?.addEventListener('click', () => goToStop(activeStopIndex - 1, { playClip: true }));
    $('npNextBtn')?.addEventListener('click', () => goToStop(activeStopIndex + 1, { playClip: true }));
    $('npNarrateToggle')?.addEventListener('change', (e) => {
      narrateOn = e.target.checked;
      if (!narrateOn) stopNarration();
    });
    $('npPlayClipBtn')?.addEventListener('click', () => {
      const stop = catalog.stops?.[activeStopIndex];
      if (stop) playNarrationForStop(stop);
    });
    $('npSaveStopBtn')?.addEventListener('click', () => saveStop());
    $('npBakeVideoBtn')?.addEventListener('click', () => bakeStopVideo());
  }

  function renderHyperframeSection() {
    const card = $('npHyperframeCard');
    const hfUrl = catalog.reel?.hyperframeUrl;
    if (!card || !hfUrl) return;
    card.hidden = false;
    const iframe = $('npHyperframePreview');
    if (iframe && !iframe.src) iframe.src = hfUrl;
  }

  function renderReel() {
    const reel = catalog.reel || {};
    const mp4 = reel.videoUrl;
    const hf = reel.hyperframeUrl;
    const wrap = $('npReelWrap');
    if (!wrap || (!mp4 && !hf)) return;
    wrap.hidden = false;
    const title = esc(reel.title || 'HyperFrame reel');
    const parts = [];
    if (mp4) {
      parts.push(`<video class="np-reel-video" controls playsinline preload="metadata" src="${esc(mp4)}"></video>`);
    }
    if (hf && !mp4) {
      parts.push(
        `<iframe class="np-hyperframe-preview np-reel-iframe" title="HyperFrame reel" src="${esc(hf)}" loading="lazy"></iframe>`
      );
    }
    const compositeNote = reel.videoUrl
      ? '<p class="small text-muted mt-2 mb-0">Rendered MP4 — click <strong>Render HyperFrame reel</strong> above to refresh.</p>'
      : '<p class="small text-warning mt-2 mb-0">MP4 not published yet — click <strong>Render HyperFrame reel</strong> (needs HyperFrames CLI + ffmpeg on the server).</p>';
    wrap.innerHTML = `
      <div class="np-side-card">
        <h2 class="h6 mb-2"><i class="bi bi-film"></i> ${title}</h2>
        ${parts.join('')}
        ${compositeNote}
      </div>`;
  }

  function clearReelPoll() {
    if (reelPollTimer) {
      clearTimeout(reelPollTimer);
      reelPollTimer = null;
    }
  }

  function setReelProgress(phase, message) {
    const wrap = $('npReelProgress');
    const bar = $('npReelProgressBar');
    const text = $('npReelProgressText');
    if (!wrap || !bar || !text) return;
    wrap.hidden = false;
    const pct =
      phase === 'narration' ? 20 : phase === 'render' ? 55 : phase === 'copy' ? 85 : phase === 'complete' ? 100 : 10;
    bar.style.width = `${pct}%`;
    bar.classList.toggle('progress-bar-animated', phase !== 'complete' && phase !== 'failed');
    text.textContent = message || phase || '';
  }

  function finishReelRender(success, message, videoUrl) {
    clearReelPoll();
    const btn = $('npReelRenderBtn');
    const skipBtn = $('npReelSkipNarrationBtn');
    if (btn) btn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
    setReelProgress(success ? 'complete' : 'failed', message);
    if (success && videoUrl && catalog?.reel) {
      catalog.reel.videoUrl = videoUrl;
      renderReel();
    }
    setStatus(message, success ? 'success' : 'danger');
  }

  async function pollReelRenderStatus() {
    try {
      const data = await fetchJson(API_REEL_STATUS);
      const status = data.status || 'idle';
      if (status === 'running') {
        setReelProgress(data.phase, data.message);
        reelPollTimer = setTimeout(pollReelRenderStatus, 2500);
        return;
      }
      if (status === 'complete') {
        finishReelRender(true, data.message || 'HyperFrame reel published.', data.videoUrl);
        return;
      }
      if (status === 'failed') {
        finishReelRender(false, data.error || 'HyperFrame render failed.');
        return;
      }
      finishReelRender(false, 'Render ended without output.');
    } catch (e) {
      finishReelRender(false, e.message || 'Could not poll render status.');
    }
  }

  async function startReelRender() {
    const btn = $('npReelRenderBtn');
    const skipBtn = $('npReelSkipNarrationBtn');
    if (btn?.disabled) return;
    if (btn) btn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    setReelProgress('starting', 'Starting local HyperFrame render (no HeyGen)…');
    try {
      const res = await fetch(API_REEL_RENDER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipNarration: reelSkipNarration })
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Render request failed (${res.status})`);
      }
      setReelProgress('running', data.message || 'Render queued…');
      reelPollTimer = setTimeout(pollReelRenderStatus, 1500);
    } catch (e) {
      finishReelRender(
        false,
        `${e.message || 'Render failed.'} Try: npm run render:newport-pier-reel:local`
      );
    }
  }

  function bindReelRender() {
    $('npReelRenderBtn')?.addEventListener('click', () => {
      reelSkipNarration = false;
      startReelRender();
    });
    $('npReelSkipNarrationBtn')?.addEventListener('click', () => {
      reelSkipNarration = true;
      startReelRender();
    });
  }

  function ensureStudioReady() {
    if (studioReady) return Promise.resolve();
    if (!studioInitPromise) {
      studioInitPromise = initStudio().then(() => {
        studioReady = true;
      });
    }
    return studioInitPromise;
  }

  function bindStudioLazy() {
    const details = $('npStudioDetails');
    details?.addEventListener('toggle', () => {
      if (details.open) ensureStudioReady();
    });
    $('npPresenterGenerateBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      ensureStudioReady().then(() => {
        $('npStudioDetails') && ($('npStudioDetails').open = true);
        $('npStudioGenerateBtn')?.click();
        $('npStudioGenerateBtn')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  function clearPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function pollVideo(videoId, { autoSave = true } = {}) {
    const started = Date.now();
    clearPoll();
    return new Promise((resolve) => {
      const tick = async () => {
        try {
          const data = await fetchJson(`/api/heygen/videos/${encodeURIComponent(videoId)}`);
          const status = data.status || data.data?.status;
          if (status === 'completed' && data.videoUrl) {
            setStudioGenerating(false);
            lastHeygenVideoId = videoId;
            activeVideoId = null;
            $('npStudioGenerateBtn')?.removeAttribute('disabled');
            $('npStudioGenerateAllBtn')?.removeAttribute('disabled');
            showStudioResult(data.videoUrl, activeLibraryId, videoId);
            const stop = catalog.stops?.[activeStopIndex];
            if (stop && autoSave) {
              writeClipOverride(stop.id, data.videoUrl);
              setPipDismissed(false);
              $('npStudioClipUrl').value = data.videoUrl;
              await cacheClipOnServer(stop, data.videoUrl, videoId);
              await saveStop();
              renderAvatarPanel(stop);
            } else if (stop) {
              $('npStudioClipUrl').value = data.videoUrl;
              await cacheClipOnServer(stop, data.videoUrl, videoId);
            }
            if (/\.webm(\?|$)/i.test(data.videoUrl)) {
              setStatus('Transparent WebM ready — floats over pier video.', 'success');
            } else if (readPipMode() === 'greenscreen') {
              setStatus(
                'Green screen MP4 ready — download, then: npm run postprocess:heygen-pip -- --input clip.mp4',
                'warning'
              );
            } else {
              setStatus(`Clip ready${autoSave ? ' — saved for this stop' : ''}.`, 'success');
            }
            resolve(true);
            return;
          }
          if (status === 'failed') {
            setStudioGenerating(false);
            activeVideoId = null;
            $('npStudioGenerateBtn')?.removeAttribute('disabled');
            $('npStudioGenerateAllBtn')?.removeAttribute('disabled');
            setStatus('HeyGen render failed — try a shorter script or different avatar.', 'danger');
            resolve(false);
            return;
          }
          if (Date.now() - started > POLL_TIMEOUT_MS) {
            setStudioGenerating(false);
            $('npStudioGenerateBtn')?.removeAttribute('disabled');
            $('npStudioGenerateAllBtn')?.removeAttribute('disabled');
            setStatus(`Still rendering — poll GET /api/heygen/videos/${videoId}`, 'warning');
            resolve(false);
            return;
          }
          setStatus(`Rendering… ${status || 'pending'} (id ${videoId})`, 'info');
          pollTimer = setTimeout(tick, POLL_MS);
        } catch (e) {
          setStudioGenerating(false);
          activeVideoId = null;
          $('npStudioGenerateBtn')?.removeAttribute('disabled');
          $('npStudioGenerateAllBtn')?.removeAttribute('disabled');
          setStatus(e.message || 'Poll failed.', 'danger');
          resolve(false);
        }
      };
      tick();
    });
  }

  async function queueHeygenClipForStop(stopIndex, { autoSave = true } = {}) {
    const stop = catalog.stops?.[stopIndex];
    if (!stop) throw new Error('Invalid stop');
    activeStopIndex = stopIndex;
    syncStudioFields();
    const opts = readHeygenGenerateOptions(stop);
    if (!opts.avatarId) throw new Error('Pick an avatar first.');
    if (!opts.script) throw new Error(`Script empty for ${stop.label}`);
    if (opts.avatarId) localStorage.setItem(STORAGE_AVATAR, opts.avatarId);
    if (opts.voiceId) localStorage.setItem(STORAGE_VOICE, opts.voiceId);
    stop.heygenScript = opts.script;
    const pipMode = $('npStudioPipMode')?.value || readPipMode();
    try {
      localStorage.setItem(STORAGE_PIP_MODE, pipMode);
    } catch (_) {}
    const json = await fetchJson('/api/heygen/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...opts,
        libraryDomain: 'nature',
        libraryId: `nature-pier-${stop.id}`
      })
    });
    const videoId = json.videoId || json.data?.video_id;
    if (!videoId) throw new Error('No video id returned');
    activeVideoId = videoId;
    activeLibraryId = json.libraryId || `nature-pier-${stop.id}`;
    setStatus(`Queued ${stop.label} — video ${videoId}`, 'info');
    const done = await pollVideo(videoId, { autoSave });
    return done;
  }

  async function initStudio() {
    const prefs = {
      avatarId: catalog.avatar?.avatarId || localStorage.getItem(STORAGE_AVATAR) || '',
      voiceId: localStorage.getItem(STORAGE_VOICE) || catalog.avatar?.voiceId || ''
    };
    let avatars = [];
    let voices = [];
    try {
      const [health, aRes, vRes] = await Promise.all([
        fetchJson('/api/heygen/health'),
        fetchJson('/api/heygen/avatars'),
        fetchJson('/api/heygen/voices')
      ]);
      const healthEl = $('npStudioHealth');
      if (healthEl) {
        healthEl.hidden = false;
        healthEl.textContent = health.configured ? 'HeyGen API ready' : 'API key missing';
        healthEl.className = `badge ${health.configured ? 'text-bg-success' : 'text-bg-warning'} np-studio-health`;
      }
      if (!health.configured) {
        $('npStudioConfigured')?.setAttribute('hidden', '');
        $('npStudioUnconfigured')?.removeAttribute('hidden');
        return;
      }
      avatars = aRes.avatars || [];
      voices = vRes.voices || [];
      avatarCatalog = avatars;
      if (catalog.avatar?.avatarId && !localStorage.getItem(STORAGE_AVATAR)) {
        localStorage.setItem(STORAGE_AVATAR, catalog.avatar.avatarId);
      }
      $('npStudioUnconfigured')?.setAttribute('hidden', '');
      $('npStudioConfigured')?.removeAttribute('hidden');
    } catch {
      $('npStudioConfigured')?.setAttribute('hidden', '');
      $('npStudioUnconfigured')?.removeAttribute('hidden');
      setStatus('HeyGen API offline — use TTS or paste clip URLs manually.', 'warning');
      return;
    }
    populateAvatarSelect($('npStudioAvatar'), avatars, prefs.avatarId);
    populateSelect($('npStudioVoice'), voices, voiceIdOf, labelVoice, prefs.voiceId);
    const pipSelect = $('npStudioPipMode');
    if (pipSelect) pipSelect.value = readPipMode();
    updatePipModeUi();
    syncAvatarThumb();
    pipSelect?.addEventListener('change', () => {
      try {
        localStorage.setItem(STORAGE_PIP_MODE, pipSelect.value);
      } catch (_) {}
      updatePipModeUi();
    });
    $('npStudioAvatar')?.addEventListener('change', syncAvatarThumb);

    $('npStudioStop')?.addEventListener('change', (e) => {
      activeStopIndex = Number(e.target.value) || 0;
      syncStudioFields();
      goToStop(activeStopIndex, { playClip: false });
    });

    $('npStudioSaveUrlBtn')?.addEventListener('click', () => saveStop());

    $('npStudioRefreshScriptBtn')?.addEventListener('click', () => {
      const stop = catalog.stops?.[activeStopIndex];
      if (stop && $('npStudioScript')) {
        $('npStudioScript').value = stop.heygenScript || '';
        setStatus('Script reset from catalog.', 'muted');
      }
    });

    $('npStudioCopyVideoId')?.addEventListener('click', () => {
      const id = $('npStudioCopyVideoId')?.dataset.videoId || activeVideoId || '';
      if (!id) return;
      navigator.clipboard?.writeText(id).then(() => setStatus(`Copied video id ${id}`, 'success'));
    });

    $('npStudioGenerateBtn')?.addEventListener('click', async () => {
      setStudioGenerating(true);
      $('npStudioResult') && ($('npStudioResult').hidden = true);
      if ($('npStudioResultVideo')) $('npStudioResultVideo').removeAttribute('src');
      try {
        await queueHeygenClipForStop(activeStopIndex, { autoSave: true });
      } catch (e) {
        setStudioGenerating(false);
        setStatus(e.message || 'Generate failed.', 'danger');
      }
    });

    $('npStudioGenerateAllBtn')?.addEventListener('click', async () => {
      if (generateAllRunning) return;
      const stops = catalog.stops || [];
      if (!stops.length) return;
      if (
        !window.confirm(
          `Generate HeyGen clips for all ${stops.length} stops? This queues ${stops.length} renders and may take several minutes.`
        )
      ) {
        return;
      }
      generateAllRunning = true;
      setStudioGenerating(true);
      let ok = 0;
      for (let i = 0; i < stops.length; i += 1) {
        setStatus(`Batch ${i + 1}/${stops.length}: ${stops[i].label}…`, 'info');
        try {
          const success = await queueHeygenClipForStop(i, { autoSave: true });
          if (success) ok += 1;
        } catch (e) {
          setStatus(`Stopped at ${stops[i].label}: ${e.message}`, 'danger');
          break;
        }
      }
      generateAllRunning = false;
      setStudioGenerating(false);
      setStatus(`Batch complete — ${ok}/${stops.length} clips saved.`, ok ? 'success' : 'warning');
    });

    setStatus('Pick avatar + voice, tune advanced options, then Generate clip or batch all stops.', 'muted');
  }

  async function probeServerSave() {
    try {
      const json = await fetchJson(API_HEALTH);
      serverSaveReady = true;
      reelRenderReady = json.capabilities?.reelRender === true;
    } catch {
      serverSaveReady = false;
      reelRenderReady = false;
    }
    const banner = $('npServerSaveBanner');
    if (banner) {
      if (serverSaveReady && reelRenderReady) {
        banner.hidden = true;
      } else if (!serverSaveReady) {
        banner.hidden = false;
        banner.textContent =
          'Server save is offline — data stays in this browser only. Restart npm run dev (or redeploy) to write data/newport-pier-fish.json for everyone.';
      } else {
        banner.hidden = false;
        banner.className = 'alert alert-warning py-2 small mb-2';
        banner.textContent =
          'Server is running an older build — restart npm run dev for HyperFrame reel render, or run: npm run render:newport-pier-reel:local';
      }
    }
    const hint = $('npReelRenderHint');
    if (hint && !reelRenderReady) {
      hint.innerHTML =
        'Reel API not loaded on this server — <strong>restart npm run dev</strong> or run <code>npm run render:newport-pier-reel:local</code> in a terminal.';
      hint.className = 'small text-warning';
    }
  }

  async function loadCatalog() {
    try {
      const json = await fetchJson(API_CATALOG);
      if (json.catalog) return json.catalog;
    } catch (_) {
      /* fall through to static file */
    }
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Could not load pier catalog (${res.status})`);
    return res.json();
  }

  async function init() {
    catalog = await loadCatalog();
    fishById = new Map((catalog.fish || []).map((f) => [f.id, f]));
    applySavedStops();
    renderHero();
    bindVideo();
    bindControls();
    bindPip();
    renderStopNav();
    renderFishRail();
    renderHyperframeSection();
    renderReel();
    bindReelRender();
    bindStudioLazy();
    await probeServerSave();
    goToStop(activeStopIndex, { playClip: false });
    if (storyRequested()) runStory();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((e) => {
      const el = $('npLoadError');
      if (el) {
        el.hidden = false;
        el.textContent = e.message || 'Could not load pier guide.';
      }
    });
  });
})();
