/**
 * Daily US disaster briefing — Google TTS via /shared/tts.js (browser fallback).
 */

function $(id) {
  return document.getElementById(id);
}

function setBriefingStatus(el, message, tone = 'muted') {
  if (!el) return;
  el.textContent = message;
  el.className = `du-daily-briefing-status small text-${tone === 'muted' ? 'muted' : tone}`;
}

export function initDisasterDailyBriefingTts(options = {}) {
  const listenBtn = $(options.listenBtnId || 'duDailyBriefingListenBtn');
  const stopBtn = $(options.stopBtnId || 'duDailyBriefingStopBtn');
  const statusEl = $(options.statusId || 'duDailyBriefingStatus');
  if (!listenBtn) return null;

  let runId = 0;

  function setPlaying(playing) {
    listenBtn.disabled = playing;
    if (stopBtn) stopBtn.hidden = !playing;
  }

  async function fetchBriefing() {
    const res = await fetch('/api/disasters/daily-briefing?includeWebCrawl=true');
    const json = await res.json();
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || json?.details || `Briefing request failed (${res.status})`);
    }
    return json.data;
  }

  async function speakScript(script) {
    const text = String(script || '').trim();
    if (!text) throw new Error('Briefing script was empty');

    if (typeof window.primeSpeechSynthesis === 'function') {
      window.primeSpeechSynthesis();
    }

    if (typeof window.speakNarrationAwaitEnd === 'function') {
      const myRun = runId;
      await window.speakNarrationAwaitEnd(text, {
        isCancelled: () => myRun !== runId,
        speakingRate: 1.02,
        volume: 0.88,
      });
      return;
    }

    if (typeof window.speakWithGoogle === 'function') {
      const ok = await window.speakWithGoogle(text, 'en-US-Standard-D', { speakingRate: 1.02, volume: 0.88 });
      if (!ok) throw new Error('Speech playback failed');
      return;
    }

    throw new Error('TTS helpers not loaded — include /shared/tts.js');
  }

  async function playDailyBriefing() {
    const myRun = ++runId;
    setPlaying(true);
    setBriefingStatus(statusEl, 'Fetching live hazard feeds…', 'info');
    try {
      const data = await fetchBriefing();
      if (myRun !== runId) return;
      setBriefingStatus(statusEl, `Playing: ${data.spokenTitle || 'Daily briefing'}…`, 'info');
      await speakScript(data.spokenScript);
      if (myRun !== runId) return;
      setBriefingStatus(statusEl, 'Daily briefing complete.', 'success');
    } catch (err) {
      if (myRun !== runId) return;
      console.error('Daily briefing TTS error:', err);
      setBriefingStatus(statusEl, err.message || 'Failed to play briefing', 'danger');
    } finally {
      if (myRun === runId) setPlaying(false);
    }
  }

  function stopBriefing() {
    runId += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    setPlaying(false);
    setBriefingStatus(statusEl, 'Briefing stopped.', 'muted');
  }

  listenBtn.addEventListener('click', () => {
    void playDailyBriefing();
  });
  stopBtn?.addEventListener('click', stopBriefing);

  return { playDailyBriefing, stopBriefing };
}
