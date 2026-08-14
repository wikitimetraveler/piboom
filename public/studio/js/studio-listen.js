/**
 * Studio listening room
 * Development work by David Lane
 */
(function () {
  const form = document.getElementById('stUnlock');
  const password = document.getElementById('stPassword');
  const msg = document.getElementById('stUnlockMsg');
  const list = document.getElementById('stReleases');
  const unlocked = sessionStorage.getItem('studioListen') === '1';

  async function loadReleases() {
    const res = await fetch('/api/studio/releases', {
      headers: { 'x-studio-listen': '1' },
    });
    if (!res.ok) throw new Error('Still locked');
    const data = await res.json();
    list.hidden = false;
    const releases = data.releases || [];
    if (!releases.length) {
      list.innerHTML = '<p class="st-status">Nothing bounced yet. Record on the desk, then Release.</p>';
      return;
    }
    list.innerHTML = '';
    for (const item of releases) {
      const article = document.createElement('article');
      article.className = 'st-release';
      const copy = document.createElement('div');
      copy.innerHTML = `<strong>${escapeHtml(item.title)}</strong>
        <div class="st-status">${escapeHtml(item.artist || 'Unknown')} · ${escapeHtml(item.reelCode || '')}</div>`;
      const audio = document.createElement('audio');
      audio.controls = true;
      article.appendChild(copy);
      article.appendChild(audio);
      list.appendChild(article);
      fetch(item.audioUrl, { headers: { 'x-studio-listen': '1' } })
        .then((r) => r.blob())
        .then((blob) => {
          audio.src = URL.createObjectURL(blob);
        })
        .catch(() => {
          copy.insertAdjacentHTML('beforeend', '<div class="st-status">Audio missing</div>');
        });
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = '';
    const res = await fetch('/api/studio/listen/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    const data = await res.json();
    if (!data.valid) {
      msg.textContent = 'Wrong password.';
      return;
    }
    sessionStorage.setItem('studioListen', '1');
    form.hidden = true;
    loadReleases().catch((err) => {
      msg.textContent = err.message;
    });
  });

  if (unlocked) {
    form.hidden = true;
    loadReleases().catch(() => {
      form.hidden = false;
      sessionStorage.removeItem('studioListen');
    });
  }

  if (window.io) {
    const socket = window.io('/studio');
    socket.on('connect', () => {
      socket.emit('studio:join', { reelCode: sessionStorage.getItem('studioReel') || 'lobby', name: 'Listener' });
    });
    socket.on('studio:now-playing', (payload) => {
      if (msg) msg.textContent = `Now out: ${payload.title || 'a bounce'} (${payload.by || 'desk'})`;
      if (sessionStorage.getItem('studioListen') === '1') loadReleases().catch(() => {});
    });
  }
})();
