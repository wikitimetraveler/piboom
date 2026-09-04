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

  function mediaHost() {
    return document.getElementById('planHeygenMedia');
  }

  function clearMedia() {
    const media = mediaHost();
    const video = media?.querySelector('video');
    root.HeygenLiveTile?.destroyHls(video);
    if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
      heygenRoom.disconnect().catch(() => {});
    }
    heygenRoom = null;
    if (media) {
      media.replaceChildren();
      media.hidden = true;
    }
    document.getElementById('planHeygenWrap')?.classList.remove('plan-heygen--live');
  }

  async function attachSession(data) {
    const media = mediaHost();
    const wrap = document.getElementById('planHeygenWrap');
    if (!media || !data?.url) return;
    heygenSessionId = data.sessionId;
    if (root.HeygenLiveTile?.isHls(data)) {
      if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
        await heygenRoom.disconnect().catch(() => {});
      }
      heygenRoom = { kind: 'hls' };
      media.hidden = false;
      wrap?.classList.add('plan-heygen--live');
      root.HeygenLiveTile.attachHls(media, data.url, 'plan-heygen__video');
      return;
    }
    const LK = root.LivekitClient;
    if (!LK) throw new Error('LiveKit client missing on page.');
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
  }

  async function stopHeygen() {
    if (heygenSessionId) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: heygenSessionId }),
      }).catch(() => {});
    }
    clearMedia();
    heygenSessionId = null;
    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Show Zed · alien presenter';
    setStatus('');
  }

  function setStatus(msg) {
    const el = document.getElementById('planHeygenStatus');
    if (el) el.textContent = msg || '';
  }

  function facePayload(face, extra) {
    const body = extra && typeof extra === 'object' ? { ...extra } : {};
    if (face?.avatarId) body.avatarId = face.avatarId;
    if (face?.voiceId) body.voiceId = face.voiceId;
    return body;
  }

  async function startHeygen() {
    const face = studioFace || (await loadStudioFace());
    const faceName = String(face?.name || 'Zed').trim() || 'Zed';
    const greeting =
      String(face?.greeting || '').trim() ||
      'Signal acquired. Carl and I are watching the sky with you.';
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload(face, { text: greeting })),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setStatus(
        data.error ||
          (face?.avatarId
            ? 'HeyGen streaming unavailable — check HEYGEN_API_KEY.'
            : `${faceName} needs avatar IDs — see AVATAR-ZED.md.`)
      );
      return;
    }
    await attachSession(data);
    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Hide Zed';
    setStatus(`${faceName} live — Carl speaks through this tile.`);
  }

  async function toggleHeygen() {
    if (heygenRoom || heygenSessionId) {
      await stopHeygen();
      return;
    }
    await startHeygen();
  }

  async function speak(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean || !heygenSessionId) return;
    const res = await fetch('/api/heygen/streaming/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload(studioFace, { sessionId: heygenSessionId, text: clean })),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.url) await attachSession(data);
  }

  function isLive() {
    return Boolean(heygenSessionId);
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
