/**
 * HeyGen Studio for Unified Disasters — avatar video generation from schema script or live event briefing.
 * Requires HEYGEN_API_KEY on the server (/api/heygen/*).
 */

const STORAGE_AVATAR = 'du-heygen-avatar-id';
const STORAGE_VOICE = 'du-heygen-voice-id';
const POLL_MS = 5000;
const POLL_TIMEOUT_MS = 600000;

function $(id) {
  return document.getElementById(id);
}

function setStatus(el, message, tone = 'muted') {
  if (!el) return;
  el.textContent = message;
  el.className = `du-heygen-status small text-${tone === 'muted' ? 'muted' : tone}`;
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

export function initDisasterHeygenStudio(options = {}) {
  const root = $(options.rootId || 'duHeygenStudio');
  if (!root) return null;

  const els = {
    root,
    configuredWrap: $('duHeygenConfigured'),
    unconfiguredWrap: $('duHeygenUnconfigured'),
    avatarSelect: $('duHeygenAvatar'),
    voiceSelect: $('duHeygenVoice'),
    modeSchema: $('duHeygenModeSchema'),
    modeBriefing: $('duHeygenModeBriefing'),
    scriptPreview: $('duHeygenScriptPreview'),
    generateBtn: $('duHeygenGenerateBtn'),
    previewBtn: $('duHeygenPreviewBtn'),
    status: $('duHeygenStatus'),
    progress: $('duHeygenProgress'),
    resultWrap: $('duHeygenResult'),
    resultVideo: $('duHeygenResultVideo'),
    downloadLink: $('duHeygenDownloadLink')
  };

  let avatars = [];
  let voices = [];
  let schemaPayload = null;
  let pollTimer = null;
  let activeVideoId = null;

  function getMode() {
    return els.modeBriefing?.checked ? 'briefing' : 'schema';
  }

  function readPrefs() {
    return {
      avatarId: localStorage.getItem(STORAGE_AVATAR) || '',
      voiceId: localStorage.getItem(STORAGE_VOICE) || ''
    };
  }

  function savePrefs() {
    const avatarId = els.avatarSelect?.value || '';
    const voiceId = els.voiceSelect?.value || '';
    if (avatarId) localStorage.setItem(STORAGE_AVATAR, avatarId);
    if (voiceId) localStorage.setItem(STORAGE_VOICE, voiceId);
  }

  function getPageBriefingContext() {
    if (typeof options.getBriefingContext === 'function') {
      return options.getBriefingContext();
    }
    return { disaster: null, loanCount: 0, cameraCount: 0, radiusMiles: 50 };
  }

  function populateSelect(select, items, idFn, labelFn, savedId) {
    if (!select) return;
    select.innerHTML = '';
    items.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = idFn(item);
      opt.textContent = labelFn(item);
      select.appendChild(opt);
    });
    if (savedId && items.some((item) => idFn(item) === savedId)) {
      select.value = savedId;
    }
  }

  function setGenerating(on) {
    [els.generateBtn, els.previewBtn, els.avatarSelect, els.voiceSelect, els.modeSchema, els.modeBriefing].forEach(
      (el) => {
        if (el) el.disabled = !!on;
      }
    );
    if (els.progress) els.progress.hidden = !on;
  }

  function clearPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function showResult(videoUrl) {
    if (!els.resultWrap || !els.resultVideo) return;
    els.resultWrap.hidden = false;
    els.resultVideo.src = videoUrl;
    if (els.downloadLink) {
      els.downloadLink.href = videoUrl;
      els.downloadLink.hidden = false;
    }
  }

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    return json;
  }

  async function loadCatalog() {
    const prefs = readPrefs();
    const [avatarRes, voiceRes, schemaRes] = await Promise.all([
      fetchJson('/api/heygen/avatars'),
      fetchJson('/api/heygen/voices'),
      fetchJson('/api/heygen/scripts/schema')
    ]);
    avatars = avatarRes.avatars || [];
    voices = voiceRes.voices || [];
    schemaPayload = schemaRes;
    populateSelect(els.avatarSelect, avatars, avatarIdOf, labelAvatar, prefs.avatarId);
    populateSelect(els.voiceSelect, voices, voiceIdOf, labelVoice, prefs.voiceId);
    if (els.voiceSelect && !els.voiceSelect.value && voices.length) {
      els.voiceSelect.selectedIndex = 0;
    }
    refreshScriptPreview();
  }

  async function buildBriefingPayload() {
    const ctx = getPageBriefingContext();
    if (!ctx?.disaster) {
      throw new Error('Select a disaster in the grid first.');
    }
    return fetchJson('/api/heygen/videos/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ctx, render: false })
    });
  }

  async function refreshScriptPreview() {
    if (!els.scriptPreview) return;
    try {
      if (getMode() === 'schema') {
        if (!schemaPayload) {
          schemaPayload = await fetchJson('/api/heygen/scripts/schema');
        }
        els.scriptPreview.value = schemaPayload.script || '';
        setStatus(els.status, `Schema walkthrough · ~2 min · ${schemaPayload.title || 'Unified Disasters'}`);
      } else {
        const ctx = getPageBriefingContext();
        if (!ctx?.disaster) {
          els.scriptPreview.value = '';
          setStatus(els.status, 'Select a disaster row to preview the live briefing script.', 'warning');
          return;
        }
        const payload = await buildBriefingPayload();
        els.scriptPreview.value = payload.script || '';
        setStatus(els.status, `Event briefing · ${payload.title || 'Selected disaster'}`);
      }
    } catch (e) {
      setStatus(els.status, e.message || 'Could not load script preview.', 'danger');
    }
  }

  async function pollVideo(videoId) {
    const started = Date.now();
    clearPoll();

    const tick = async () => {
      try {
        const data = await fetchJson(`/api/heygen/videos/${encodeURIComponent(videoId)}`);
        const status = data.status || data.data?.status;
        if (status === 'completed' && data.videoUrl) {
          setGenerating(false);
          setStatus(els.status, 'Video ready — playing below.', 'success');
          showResult(data.videoUrl);
          activeVideoId = null;
          return;
        }
        if (status === 'failed') {
          setGenerating(false);
          setStatus(els.status, 'HeyGen reported a failed render. Try a shorter script or different avatar.', 'danger');
          activeVideoId = null;
          return;
        }
        if (Date.now() - started > POLL_TIMEOUT_MS) {
          setGenerating(false);
          setStatus(
            els.status,
            `Still rendering (${status || 'pending'}) — poll GET /api/heygen/videos/${videoId}`,
            'warning'
          );
          return;
        }
        setStatus(els.status, `Rendering… status: ${status || 'pending'}`, 'info');
        pollTimer = setTimeout(tick, POLL_MS);
      } catch (e) {
        setGenerating(false);
        setStatus(els.status, e.message || 'Poll failed.', 'danger');
      }
    };

    await tick();
  }

  async function startGeneration() {
    savePrefs();
    const avatarId = els.avatarSelect?.value;
    if (!avatarId) {
      setStatus(els.status, 'Pick an avatar first.', 'warning');
      return;
    }
    const voiceId = els.voiceSelect?.value || undefined;
    setGenerating(true);
    clearPoll();
    if (els.resultWrap) els.resultWrap.hidden = true;
    if (els.resultVideo) els.resultVideo.removeAttribute('src');

    try {
      let payload;
      if (getMode() === 'schema') {
        if (!schemaPayload) schemaPayload = await fetchJson('/api/heygen/scripts/schema');
        payload = await fetchJson('/api/heygen/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarId,
            voiceId,
            script: schemaPayload.script,
            title: schemaPayload.title,
            aspectRatio: schemaPayload.aspectRatio || '16:9'
          })
        });
      } else {
        const ctx = getPageBriefingContext();
        payload = await fetchJson('/api/heygen/videos/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...ctx,
            avatarId,
            voiceId,
            render: true,
            aspectRatio: '16:9'
          })
        });
      }

      const videoId = payload.videoId || payload.data?.video_id;
      if (!videoId) throw new Error('HeyGen did not return a video id.');
      activeVideoId = videoId;
      setStatus(els.status, `Queued video ${videoId} — waiting for HeyGen…`, 'info');
      await pollVideo(videoId);
    } catch (e) {
      setGenerating(false);
      setStatus(els.status, e.message || 'Video generation failed.', 'danger');
    }
  }

  async function init() {
    try {
      const health = await fetchJson('/api/heygen/health');
      if (!health.configured) {
        if (els.configuredWrap) els.configuredWrap.hidden = true;
        if (els.unconfiguredWrap) els.unconfiguredWrap.hidden = false;
        return null;
      }
      if (els.configuredWrap) els.configuredWrap.hidden = false;
      if (els.unconfiguredWrap) els.unconfiguredWrap.hidden = true;
      await loadCatalog();
      setStatus(els.status, 'Pick avatar + voice, choose a script mode, then Generate.');
    } catch (e) {
      if (els.unconfiguredWrap) {
        els.unconfiguredWrap.hidden = false;
        els.unconfiguredWrap.textContent = e.message || 'HeyGen studio unavailable.';
      }
      if (els.configuredWrap) els.configuredWrap.hidden = true;
    }

    els.modeSchema?.addEventListener('change', refreshScriptPreview);
    els.modeBriefing?.addEventListener('change', refreshScriptPreview);
    els.previewBtn?.addEventListener('click', refreshScriptPreview);
    els.generateBtn?.addEventListener('click', startGeneration);

    return {
      refreshScriptPreview,
      openBriefingMode() {
        if (els.modeBriefing) els.modeBriefing.checked = true;
        const sheet = document.getElementById('duSchemaSheet');
        if (sheet && !sheet.classList.contains('du-schema-sheet--open')) {
          document.getElementById('duSchemaSheetTab')?.click();
        }
        refreshScriptPreview();
        els.root?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      cancelPoll: clearPoll
    };
  }

  return init();
}
