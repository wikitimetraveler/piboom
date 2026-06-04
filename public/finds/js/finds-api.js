/**
 * Development work by David Lane
 */
/**
 * Finds API client — passes userId on every request (multi-user collections).
 */
(function (global) {
  'use strict';

  function getUserId() {
    if (typeof getCurrentUser === 'function') {
      const u = getCurrentUser();
      if (u && u.id) return u.id;
    }
    try {
      const v = localStorage.getItem('findsUserId');
      if (v) return v;
    } catch (_) {}
    return 'demo-analyst-1';
  }

  function q(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}userId=${encodeURIComponent(getUserId())}`;
  }

  async function parseJson(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || res.statusText || 'Request failed');
    }
    return data;
  }

  global.findsApi = {
    getUserId,

    async list(limit) {
      let url = q('/api/finds');
      if (limit) url += `&limit=${encodeURIComponent(limit)}`;
      const res = await fetch(url);
      return parseJson(res);
    },

    async get(id) {
      const res = await fetch(q(`/api/finds/${encodeURIComponent(id)}`));
      return parseJson(res);
    },

    async create(body) {
      const res = await fetch(q('/api/finds'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: getUserId() }),
      });
      return parseJson(res);
    },

    async update(id, body) {
      const res = await fetch(q(`/api/finds/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: getUserId() }),
      });
      return parseJson(res);
    },

    async remove(id) {
      const res = await fetch(q(`/api/finds/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      return parseJson(res);
    },

    async analyze(images, notes) {
      const res = await fetch('/api/finds/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, notes: notes || '' }),
      });
      return parseJson(res);
    },

    async scorePreview(payload) {
      const res = await fetch('/api/finds/score-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      return parseJson(res);
    },

    async summaryText(id) {
      const res = await fetch(q(`/api/finds/${encodeURIComponent(id)}/summary-text`));
      return parseJson(res);
    },

    async appendVoiceNote(id, transcript, type, audioUrl) {
      const res = await fetch(q(`/api/finds/${encodeURIComponent(id)}/voice-note`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          transcript,
          type: type || 'note',
          audioUrl: audioUrl || '',
        }),
      });
      return parseJson(res);
    },

    /** Play summary via Google TTS (returns audio base64). */
    async synthesize(text) {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text || '').slice(0, 4500) }),
      });
      return parseJson(res);
    },

    playBase64Mp3(base64) {
      if (!base64) return Promise.reject(new Error('No audio'));
      return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/mp3;base64,${base64}`);
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
