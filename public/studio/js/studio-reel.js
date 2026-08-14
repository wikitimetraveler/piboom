/**
 * Landing reel clock + analyser + capability chips
 * Development work by David Lane
 */
(function () {
  const timecode = document.getElementById('stTimecode');
  const canvas = document.getElementById('stAnalyser');
  const enter = document.getElementById('stEnter');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();

  function formatTime(ms) {
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }

  function tick(now) {
    if (timecode) timecode.textContent = formatTime(now - started);
    drawAnalyser(now);
    if (!reduce) requestAnimationFrame(tick);
  }

  function drawAnalyser(now) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const bars = 12;
    const gap = 3;
    const barW = (w - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i += 1) {
      const wave = 0.25 + 0.75 * Math.abs(Math.sin(now / 180 + i * 0.55));
      const bh = Math.max(4, wave * h);
      const hue = 90 + i * 8;
      ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
      ctx.fillRect(i * (barW + gap), h - bh, barW, bh);
    }
  }

  if (reduce) {
    if (timecode) timecode.textContent = '03:53.50';
    drawAnalyser(0);
  } else {
    requestAnimationFrame(tick);
  }

  async function openDesk(event) {
    event.preventDefault();
    try {
      const res = await fetch('/api/studio/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Reel 1' }),
      });
      const data = await res.json();
      const code = data?.session?.code;
      if (code) {
        sessionStorage.setItem('studioReel', code);
        window.location.href = `/studio/desk.html?reel=${encodeURIComponent(code)}`;
        return;
      }
    } catch (_) {
      /* fall through */
    }
    window.location.href = '/studio/desk.html';
  }

  if (enter) enter.addEventListener('click', openDesk);

  fetch('/api/studio/health')
    .then((res) => res.json())
    .then((status) => {
      const socketChip = document.querySelector('[data-cap="socket"]');
      const livekitChip = document.querySelector('[data-cap="livekit"]');
      const openaiChip = document.querySelector('[data-cap="openai"]');
      if (socketChip) socketChip.classList.add('is-on');
      if (livekitChip && status.livekitConfigured) livekitChip.classList.add('is-on');
      if (openaiChip && status.openaiConfigured) openaiChip.classList.add('is-on');
    })
    .catch(() => {});
})();
