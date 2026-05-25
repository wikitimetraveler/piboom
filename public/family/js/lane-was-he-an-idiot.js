/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function imgFallback(ev) {
  const img = ev.target;
  const wrap = img.closest('.whai-figure');
  if (!wrap) return;
  img.style.display = 'none';
  const ph = document.createElement('div');
  ph.className = 'whai-figure-placeholder';
  ph.textContent = 'Image unavailable.';
  wrap.insertBefore(ph, img);
}

function renderArticle(doc) {
  document.title = `${doc.title || 'Article'} — Lane Family — DevConnect Labs`;
  const h1 = document.getElementById('articleTitle');
  if (h1) h1.textContent = doc.title || '';

  const by = document.getElementById('articleByline');
  if (by) by.textContent = doc.byline || '';

  const src = document.getElementById('articleSource');
  if (src) src.textContent = doc.source || '';

  const rights = document.getElementById('articleRights');
  if (rights) {
    const parts = [];
    if (doc.rightsNote) parts.push(doc.rightsNote);
    if (doc.wikisourceUrl) {
      parts.push(
        `Transcription: ${doc.wikisourceUrl}`
      );
    }
    rights.textContent = parts.join(' ');
  }

  const body = document.getElementById('articleBody');
  if (!body) return;

  const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
  body.innerHTML = blocks
    .map((b) => {
      if (b.type === 'p' && b.text) {
        return `<p>${escapeHtml(b.text)}</p>`;
      }
      if (b.type === 'figure' && b.src) {
        const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
        const alt = escapeHtml(b.alt || '');
        return `<figure class="whai-figure">
  <img src="${escapeHtml(b.src)}" alt="${alt}" loading="lazy" decoding="async" />
  ${cap}
</figure>`;
      }
      return '';
    })
    .join('\n');

  body.querySelectorAll('.whai-figure img').forEach((img) => {
    img.addEventListener('error', imgFallback);
  });
}

async function init() {
  const errEl = document.getElementById('whaiError');
  try {
    const res = await fetch('/data/lane-was-he-an-idiot-article.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    renderArticle(doc);
  } catch (e) {
    console.error(e);
    if (errEl) errEl.textContent = 'Could not load article content. Is the server running?';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
