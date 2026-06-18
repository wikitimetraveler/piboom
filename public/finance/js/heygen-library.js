/**
 * HeyGen video library UI — /api/heygen/library
 * Development work by David Lane
 */
(function () {
  let activeDomain = '';
  let videos = [];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function domainLabel(domain) {
    if (domain === 'lane') return 'Lane';
    if (domain === 'disasters') return 'Disasters';
    return domain || 'Other';
  }

  function variantLabel(variant) {
    const map = { full: 'Full line', short: 'Short popup', demo: 'Demo', briefing: 'Briefing', generated: 'Generated' };
    return map[variant] || variant || 'Video';
  }

  async function resolvePlayUrl(video) {
    if (video.videoUrl) return video.videoUrl;
    if (!video.videoId) return null;
    try {
      const res = await fetch(`/api/heygen/videos/${encodeURIComponent(video.videoId)}`);
      const json = await res.json();
      return json.videoUrl || json.data?.video_url || null;
    } catch {
      return null;
    }
  }

  function renderCard(video, playUrl) {
    const hasPlay = Boolean(playUrl);
    const media = hasPlay
      ? `<video controls playsinline preload="metadata" src="${esc(playUrl)}"></video>`
      : video.portraitUrl
        ? `<img src="${esc(video.portraitUrl)}" alt="" />`
        : `<div class="hvl-pending"><i class="bi bi-hourglass-split"></i><br/>Rendering… poll with Refresh</div>`;

    const links = [
      video.sourcePage ? `<a class="btn btn-sm btn-outline-primary" href="${esc(video.sourcePage)}">Open page</a>` : '',
      video.studioPage ? `<a class="btn btn-sm btn-outline-secondary" href="${esc(video.studioPage)}">Studio</a>` : '',
      video.videoId
        ? `<button type="button" class="btn btn-sm btn-link p-0 hvl-copy-id" data-id="${esc(video.videoId)}">Copy ID</button>`
        : ''
    ]
      .filter(Boolean)
      .join('');

    return `<article class="hvl-card" data-id="${esc(video.id)}" id="${esc(video.id)}">
      <div class="hvl-card-media">
        <span class="hvl-card-badge hvl-card-badge--${esc(video.domain)}">${esc(domainLabel(video.domain))} · ${esc(variantLabel(video.variant))}</span>
        ${media}
      </div>
      <div class="hvl-card-body">
        <h2 class="hvl-card-title">${esc(video.title)}</h2>
        <p class="hvl-card-meta">${video.hostedLocally ? 'Hosted on site' : playUrl ? 'HeyGen cloud URL' : 'Pending render'}${video.generatedAt ? ` · ${esc(new Date(video.generatedAt).toLocaleDateString())}` : ''}</p>
        ${video.scriptPreview ? `<p class="hvl-card-script">${esc(video.scriptPreview)}</p>` : ''}
        <div class="hvl-card-actions">${links}</div>
      </div>
    </article>`;
  }

  async function loadLibrary() {
    const status = $('hvlStatus');
    const grid = $('hvlGrid');
    if (status) status.textContent = 'Loading library…';
    try {
      const qs = activeDomain ? `?domain=${encodeURIComponent(activeDomain)}` : '';
      const res = await fetch(`/api/heygen/library${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Load failed');
      videos = json.videos || [];
      if (!videos.length) {
        grid.innerHTML = `<div class="hvl-empty col-12">No videos yet. Generate from <a href="/finance/disasters-unified.html#duHeygenPullCard">Unified Disasters</a> or <a href="/family/lane-heygen-print.html">Lane print kit</a>.</div>`;
      } else {
        const cards = await Promise.all(
          videos.map(async (v) => {
            const playUrl = await resolvePlayUrl(v);
            return renderCard(v, playUrl);
          })
        );
        grid.innerHTML = cards.join('');
        grid.querySelectorAll('.hvl-copy-id').forEach((btn) => {
          btn.addEventListener('click', () => {
            navigator.clipboard?.writeText(btn.getAttribute('data-id') || '');
          });
        });
        const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
        if (hash) {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      if (status) {
        status.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}${activeDomain ? ` · ${domainLabel(activeDomain)}` : ''}${json.configured ? '' : ' · HEYGEN_API_KEY not set (cloud poll may fail)'}`;
      }
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not load library.';
      grid.innerHTML = '';
    }
  }

  function bindFilters() {
    document.querySelectorAll('.hvl-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hvl-filter').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('btn-outline-primary', b !== btn);
        });
        activeDomain = btn.getAttribute('data-domain') || '';
        loadLibrary();
      });
    });
    $('hvlRefreshBtn')?.addEventListener('click', loadLibrary);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindFilters();
    loadLibrary();
  });
})();
