/**
 * Wolfman Dave LiveKit booth — voice + data-packet chat.
 * Development work by David Lane
 */
(function () {
  const els = {
    name: document.getElementById('wbName'),
    join: document.getElementById('wbJoin'),
    mic: document.getElementById('wbMic'),
    status: document.getElementById('wbStatus'),
    log: document.getElementById('wbLog'),
    form: document.getElementById('wbForm'),
    text: document.getElementById('wbText'),
  };

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let room = null;
  let micOn = false;

  function line(text) {
    if (!els.log) return;
    const p = document.createElement('p');
    p.textContent = text;
    els.log.appendChild(p);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function displayName() {
    return String(els.name?.value || 'Listener').trim() || 'Listener';
  }

  async function publishChat(text) {
    if (!room?.localParticipant) return;
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'chat', text })), {
      reliable: true,
      topic: 'wolfman',
    });
  }

  function onData(payload) {
    try {
      const msg = JSON.parse(decoder.decode(payload));
      if (msg?.type === 'chat' && msg.text) line(msg.text);
    } catch {
      /* ignore */
    }
  }

  async function join() {
    const LK = window.LivekitClient;
    if (!LK) {
      els.status.textContent = 'LiveKit client missing';
      return;
    }
    const res = await fetch('/api/wolfman/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: displayName() }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      els.status.textContent = data.error || 'LiveKit keys needed';
      line('Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Classic Voice DJ still works without them.');
      return;
    }
    if (room) await room.disconnect();
    room = new LK.Room(
      window.LivekitTalkAudio
        ? window.LivekitTalkAudio.roomOptions()
        : { adaptiveStream: true, dynacast: true }
    );
    room.on(LK.RoomEvent.DataReceived, onData);
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (window.LivekitTalkAudio?.skipAttach(track, participant) || participant?.isLocal) return;
      if (track.kind === 'audio') track.attach();
    });
    await room.connect(data.url, data.token);
    micOn = false;
    els.mic.disabled = false;
    els.mic.textContent = 'Mic off';
    els.mic.setAttribute('aria-pressed', 'false');
    els.status.textContent = `Live ${data.roomName} · agent ${data.agentName || 'WolfmanDave'} · mic off`;
    line('Joined muted. Click Mic when you want to talk.');
  }

  function syncMicUi() {
    els.status.textContent = micOn ? 'Mic on' : 'Mic off';
    if (els.mic) {
      els.mic.textContent = micOn ? 'Mic on' : 'Mic off';
      els.mic.setAttribute('aria-pressed', micOn ? 'true' : 'false');
    }
  }

  async function toggleMic() {
    if (!room) {
      await join();
      if (!room) return;
    }
    const want = !micOn;
    try {
      if (window.LivekitTalkAudio?.setTalkMic) {
        micOn = Boolean(await window.LivekitTalkAudio.setTalkMic(room.localParticipant, want));
      } else {
        await room.localParticipant.setMicrophoneEnabled(want);
        micOn = want;
      }
      syncMicUi();
    } catch (err) {
      micOn = false;
      syncMicUi();
      els.status.textContent = 'Mic did not start — allow the microphone and try again';
    }
  }

  els.join?.addEventListener('click', () => join().catch((err) => {
    els.status.textContent = err.message || 'Join failed';
  }));
  els.mic?.addEventListener('click', () => toggleMic().catch(() => {}));
  els.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = String(els.text?.value || '').trim();
    if (!text) return;
    line(`${displayName()}: ${text}`);
    publishChat(`${displayName()}: ${text}`).catch(() => {});
    els.text.value = '';
  });

  fetch('/api/wolfman/health')
    .then((res) => res.json())
    .then((status) => {
      els.status.textContent = status.livekitConfigured
        ? `LiveKit ready · ${status.roomName}`
        : 'LiveKit unset — classic Voice DJ still works';
    })
    .catch(() => {});
})();
