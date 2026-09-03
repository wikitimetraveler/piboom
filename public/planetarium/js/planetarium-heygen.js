/**
 * Zed HeyGen live tile for planetarium Carl sessions
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  let heygenRoom = null;
  let heygenSessionId = null;
  let studioFace = null;

  async function loadStudioFace() {
    try {
      const res = await fetch('/data/studio-heygen-face.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      studioFace = data && typeof data === 'object' ? data : null;
      const faceName = String(studioFace?.name || 'Zed').trim() || 'Zed';
      const label = document.getElementById('planHeygenLabel');
      if (label) label.textContent = faceName + ' · alien presenter';
      return studioFace;
    } catch (_) {
      studioFace = null;
      return null;
    }
  }

  async function stopHeygen() {
    if (heygenRoom) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: heygenSessionId }),
      }).catch(() => {});
      await heygenRoom.disconnect().catch(() => {});
      heygenRoom = null;
      heygenSessionId = null;
    }
    const media = document.getElementById('planHeygenMedia');
    const wrap = document.getElementById('planHeygenWrap');
    if (media) {
      media.replaceChildren();
      media.hidden = true;
    }
    if (wrap) wrap.classList.remove('plan-heygen--live');
    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Show Zed · alien presenter';
    setStatus('');
  }

  function setStatus(msg) {
    const el = document.getElementById('planHeygenStatus');
    if (el) el.textContent = msg || '';
  }

  async function startHeygen() {
    const LK = root.LivekitClient;
    const face = studioFace || (await loadStudioFace());
    const faceName = String(face?.name || 'Zed').trim() || 'Zed';
    const body = {};
    if (face?.avatarId) body.avatarId = face.avatarId;
    if (face?.voiceId) body.voiceId = face.voiceId;

    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.url || !data.accessToken) {
      setStatus(
        data.error ||
          (face?.avatarId
            ? 'HeyGen streaming unavailable — check HEYGEN_API_KEY.'
            : `${faceName} needs avatar IDs — see AVATAR-ZED.md.`)
      );
      return;
    }
    if (!LK) {
      setStatus('LiveKit client missing on page.');
      return;
    }

    const media = document.getElementById('planHeygenMedia');
    const wrap = document.getElementById('planHeygenWrap');
    if (!media) return;

    const faceRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
    faceRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      media.hidden = false;
      wrap?.classList.add('plan-heygen--live');
      const el = track.attach();
      el.className = 'plan-heygen__video';
      media.replaceChildren(el);
    });
    await faceRoom.connect(data.url, data.accessToken);
    heygenRoom = faceRoom;
    heygenSessionId = data.sessionId;

    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Hide Zed';
    setStatus(`${faceName} live — Carl speaks through this tile.`);

    const greeting =
      String(face?.greeting || '').trim() ||
      'Signal acquired. Carl and I are watching the sky with you.';
    if (data.sessionId) {
      fetch('/api/heygen/streaming/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.sessionId, text: greeting }),
      }).catch(() => {});
    }
  }

  async function toggleHeygen() {
    if (heygenRoom) {
      await stopHeygen();
      return;
    }
    await startHeygen();
  }

  async function speak(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean || !heygenSessionId) return;
    await fetch('/api/heygen/streaming/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: heygenSessionId, text: clean }),
    }).catch(() => {});
  }

  function isLive() {
    return Boolean(heygenRoom && heygenSessionId);
  }

  root.PlanetariumHeygen = { toggle: toggleHeygen, speak, stop: stopHeygen, isLive };

  document.getElementById('planHeygenToggle')?.addEventListener('click', () => {
    toggleHeygen().catch((err) => setStatus(err.message || 'HeyGen failed'));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadStudioFace());
  } else {
    loadStudioFace();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
