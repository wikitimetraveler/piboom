/**
 * StarBand listening lounge — gold sleeve, spinning platter, title card
 * Development work by David Lane
 */
(function () {
  const form = document.getElementById('stUnlock');
  const password = document.getElementById('stPassword');
  const msg = document.getElementById('stUnlockMsg');
  const lounge = document.getElementById('stLounge');
  const sleevesEl = document.getElementById('stSleeves');
  const canvas = document.getElementById('stTitleCard');
  const platter = document.getElementById('stPlatter');
  const playBtn = document.getElementById('stLoungePlay');
  const nowTitle = document.getElementById('stNowTitle');
  const nowMeta = document.getElementById('stNowMeta');
  const nowKicker = document.getElementById('stNowKicker');
  const audio = document.getElementById('stLoungeAudio');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const unlocked = sessionStorage.getItem('studioListen') === '1';

  const state = {
    releases: [],
    current: null,
    objectUrl: '',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function wrapTitle(ctx, text, maxWidth) {
    const words = String(text || 'Untitled bounce').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function paintTitleCard(target, item) {
    if (!target || !target.getContext) return;
    const ctx = target.getContext('2d');
    const w = target.width;
    const h = target.height;
    ctx.fillStyle = '#100c08';
    ctx.fillRect(0, 0, w, h);
    const burst = ctx.createRadialGradient(w / 2, h * 0.38, 12, w / 2, h * 0.38, w * 0.62);
    burst.addColorStop(0, 'rgba(232, 200, 114, 0.28)');
    burst.addColorStop(0.45, 'rgba(74, 18, 32, 0.35)');
    burst.addColorStop(1, 'rgba(16, 12, 8, 0)');
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#e8c872';
    ctx.lineWidth = 16;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 42, w - 84, h - 84);

    const chev = 28;
    ctx.fillStyle = '#d4a017';
    [[42, 42], [w - 42, 42], [42, h - 42], [w - 42, h - 42]].forEach(([x, y], i) => {
      ctx.beginPath();
      if (i === 0) {
        ctx.moveTo(x, y); ctx.lineTo(x + chev, y); ctx.lineTo(x, y + chev);
      } else if (i === 1) {
        ctx.moveTo(x, y); ctx.lineTo(x - chev, y); ctx.lineTo(x, y + chev);
      } else if (i === 2) {
        ctx.moveTo(x, y); ctx.lineTo(x + chev, y); ctx.lineTo(x, y - chev);
      } else {
        ctx.moveTo(x, y); ctx.lineTo(x - chev, y); ctx.lineTo(x, y - chev);
      }
      ctx.closePath();
      ctx.fill();
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c872';
    ctx.font = '700 36px "Cinzel Decorative", Cinzel, serif';
    ctx.fillText('STARBAND', w / 2, 118);

    ctx.fillStyle = '#f6eed8';
    ctx.font = '700 48px Cinzel, "Times New Roman", serif';
    const lines = wrapTitle(ctx, item?.title || 'Waiting on a bounce', w - 120);
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, 250 + i * 58);
    });

    ctx.fillStyle = '#c4b48a';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText(item?.artist || 'The desk', w / 2, 250 + lines.length * 58 + 28);

    ctx.fillStyle = '#8a7a58';
    ctx.font = '700 18px Cinzel, serif';
    const reel = item?.reelCode ? `REEL ${item.reelCode}` : 'PALACE LOUNGE';
    ctx.fillText(reel, w / 2, h - 78);
  }

  function formatWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function setPlaying(on) {
    platter?.classList.toggle('is-playing', Boolean(on) && !reduce);
    if (playBtn) {
      playBtn.textContent = on ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function showRelease(item) {
    state.current = item || null;
    paintTitleCard(canvas, item);
    if (nowKicker) nowKicker.textContent = item ? 'Now out' : 'Lounge';
    if (nowTitle) nowTitle.textContent = item?.title || 'The lounge is empty';
    if (nowMeta) {
      const bits = [item?.artist || '', item?.reelCode ? `Reel ${item.reelCode}` : '', formatWhen(item?.createdAt)]
        .filter(Boolean);
      nowMeta.textContent = bits.join(' · ') || 'Record on the desk, then Release.';
    }
    if (playBtn) playBtn.disabled = !item;
    document.querySelectorAll('.st-sleeve-thumb').forEach((btn) => {
      btn.classList.toggle('is-current', Boolean(item) && btn.getAttribute('data-id') === item.id);
    });
  }

  function revokeUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = '';
    }
  }

  async function loadAudio(item) {
    if (!audio || !item?.audioUrl) return false;
    revokeUrl();
    const res = await fetch(item.audioUrl, { headers: { 'x-studio-listen': '1' } });
    if (!res.ok) throw new Error('Audio missing');
    const blob = await res.blob();
    state.objectUrl = URL.createObjectURL(blob);
    audio.src = state.objectUrl;
    return true;
  }

  async function playCurrent() {
    if (!state.current) return;
    if (!audio.src || audio.getAttribute('data-id') !== state.current.id) {
      await loadAudio(state.current);
      audio.setAttribute('data-id', state.current.id);
    }
    await audio.play();
    setPlaying(true);
  }

  async function selectRelease(item, autoplay) {
    showRelease(item);
    audio.pause();
    setPlaying(false);
    audio.removeAttribute('data-id');
    if (autoplay) await playCurrent();
  }

  function renderRack(releases) {
    if (!sleevesEl) return;
    sleevesEl.innerHTML = '';
    if (!releases.length) return;
    const thumb = document.createElement('canvas');
    thumb.width = 240;
    thumb.height = 240;
    releases.forEach((item) => {
      paintTitleCard(thumb, item);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-sleeve-thumb';
      btn.setAttribute('data-id', item.id);
      btn.setAttribute('aria-label', `Play ${item.title || 'bounce'}`);
      const img = document.createElement('img');
      img.alt = '';
      img.src = thumb.toDataURL('image/jpeg', 0.72);
      const cap = document.createElement('span');
      cap.textContent = item.title || 'Untitled';
      btn.appendChild(img);
      btn.appendChild(cap);
      btn.addEventListener('click', () => {
        selectRelease(item, true).catch((err) => {
          if (msg) msg.textContent = err.message;
        });
      });
      sleevesEl.appendChild(btn);
    });
  }

  async function loadReleases() {
    const res = await fetch('/api/studio/releases', {
      headers: { 'x-studio-listen': '1' },
    });
    if (!res.ok) throw new Error('Still locked');
    const data = await res.json();
    const releases = data.releases || [];
    state.releases = releases;
    if (lounge) lounge.hidden = false;
    renderRack(releases);
    const keep = state.current && releases.find((item) => item.id === state.current.id);
    showRelease(keep || releases[0] || null);
    if (msg && !form?.hidden) msg.textContent = '';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (msg) msg.textContent = '';
    const res = await fetch('/api/studio/listen/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    const data = await res.json();
    if (!data.valid) {
      if (msg) msg.textContent = 'Wrong password.';
      return;
    }
    sessionStorage.setItem('studioListen', '1');
    form.hidden = true;
    loadReleases().catch((err) => {
      if (msg) msg.textContent = err.message;
    });
  });

  playBtn?.addEventListener('click', () => {
    if (!state.current) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    playCurrent().catch((err) => {
      if (msg) msg.textContent = err.message;
    });
  });

  audio?.addEventListener('ended', () => setPlaying(false));
  audio?.addEventListener('pause', () => {
    if (audio.ended) return;
    setPlaying(false);
  });

  if (unlocked) {
    if (form) form.hidden = true;
    loadReleases().catch(() => {
      if (form) form.hidden = false;
      sessionStorage.removeItem('studioListen');
    });
  }

  if (window.io) {
    const socket = window.io('/studio');
    socket.on('connect', () => {
      socket.emit('studio:join', {
        reelCode: sessionStorage.getItem('studioReel') || 'lobby',
        name: 'Listener',
      });
    });
    socket.on('studio:now-playing', (payload) => {
      if (msg) msg.textContent = `Now out: ${payload.title || 'a bounce'} (${payload.by || 'desk'})`;
      if (sessionStorage.getItem('studioListen') === '1') {
        loadReleases()
          .then(() => {
            const hit = state.releases.find((item) => item.title === payload.title);
            if (hit) showRelease(hit);
          })
          .catch(() => {});
      }
    });
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (state.current || (lounge && !lounge.hidden)) paintTitleCard(canvas, state.current);
    }).catch(() => {});
  }
})();
