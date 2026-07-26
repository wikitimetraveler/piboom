/**
 * Glazed donut discovery camera — identify unknown donuts (Vision)
 * Development work by David Lane
 */
(function () {
  'use strict';

  let stream = null;
  let imageData = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, kind) {
    const el = $('gzDiscoverStatus');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.dataset.kind = kind || 'info';
  }

  function clearStatus() {
    setStatus('', 'info');
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    const video = $('gzDiscoverVideo');
    if (video) video.srcObject = null;
  }

  async function startCamera() {
    clearStatus();
    try {
      stopCamera();
      const getStream =
        typeof window.getDiscoveryCameraVideoStream === 'function'
          ? window.getDiscoveryCameraVideoStream
          : () =>
              navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } }
              });
      stream = await getStream();
      const video = $('gzDiscoverVideo');
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      $('gzDiscoverLive')?.removeAttribute('hidden');
      $('gzDiscoverPreview')?.setAttribute('hidden', '');
      clearStatus();
    } catch (err) {
      console.warn('Donut camera failed', err);
      setStatus('Camera unavailable — tap Upload photo instead.', 'error');
    }
  }

  function captureFrame() {
    const video = $('gzDiscoverVideo');
    const canvas = $('gzDiscoverCanvas');
    if (!video || !canvas || !video.videoWidth) {
      setStatus('Start the camera first, then Capture.', 'error');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    imageData = canvas.toDataURL('image/jpeg', 0.9);
    const img = $('gzDiscoverShot');
    if (img) {
      img.src = imageData;
      img.hidden = false;
    }
    $('gzDiscoverPreview')?.removeAttribute('hidden');
    clearStatus();
  }

  function onFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Please choose an image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imageData = String(reader.result || '');
      const img = $('gzDiscoverShot');
      if (img) {
        img.src = imageData;
        img.hidden = false;
      }
      $('gzDiscoverPreview')?.removeAttribute('hidden');
      clearStatus();
    };
    reader.readAsDataURL(file);
  }

  async function identify() {
    const out = $('gzDiscoverResult');
    if (!imageData) {
      setStatus('Capture or upload a donut photo first.', 'error');
      return;
    }
    clearStatus();
    if (out) {
      out.hidden = false;
      out.textContent = 'Identifying…';
    }
    try {
      const res = await fetch('/api/donuts/discovery/vision-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      if (out) out.innerHTML = formatMd(data.result || '');
      clearStatus();
      if (typeof window.gzSpeakPip === 'function') {
        const plain = String(data.result || '')
          .replace(/[*_`#]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);
        if (plain) window.gzSpeakPip(plain);
      }
    } catch (err) {
      console.error(err);
      if (out) {
        out.hidden = false;
        out.textContent =
          'Couldn’t identify right now (network or AI hiccup). Try another photo in a moment.';
      }
      setStatus('Identify failed — try again shortly.', 'error');
    }
  }

  function formatMd(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^###? (.+)$/gm, '<h4>$1</h4>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/\n{2,}/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  function bind() {
    $('gzDiscoverStart')?.addEventListener('click', startCamera);
    $('gzDiscoverStop')?.addEventListener('click', () => {
      stopCamera();
      clearStatus();
    });
    $('gzDiscoverCapture')?.addEventListener('click', captureFrame);
    $('gzDiscoverIdentify')?.addEventListener('click', identify);
    $('gzDiscoverFile')?.addEventListener('change', (e) => onFile(e.target.files?.[0]));
    window.addEventListener('pagehide', stopCamera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
