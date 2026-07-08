/**
 * HeyGen + HyperFrames hub UI — /api/heygen/library
 * Public page: /heygen-hub.html
 * Development work by David Lane
 */
(function () {
  let activeDomain = '';
  let activeKind = '';
  let items = [];

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
    const map = {
      lane: 'Lane',
      music: 'Music',
      disasters: 'Disasters',
      finance: 'Finance',
      nature: 'Nature',
      platform: 'Platform'
    };
    return map[domain] || domain || 'Other';
  }

  function kindLabel(kind) {
    return kind === 'hyperframes' ? 'HyperFrames' : 'HeyGen';
  }

  function variantLabel(variant) {
    const map = {
      full: 'Full line',
      short: 'Short popup',
      demo: 'Demo',
      briefing: 'Briefing',
      generated: 'Generated',
      reel: 'Reel'
    };
    return map[variant] || variant || 'Video';
  }

  async function resolvePlayUrl(item) {
    if (item.videoUrl) return item.videoUrl;
    if (item.kind === 'hyperframes' || !item.videoId) return null;
    try {
      const res = await fetch(`/api/heygen/videos/${encodeURIComponent(item.videoId)}`);
      const json = await res.json();
      return json.videoUrl || json.data?.video_url || null;
    } catch {
      return null;
    }
  }

  function renderCard(item, playUrl) {
    const isHyper = item.kind === 'hyperframes';
    const hasPlay = Boolean(playUrl);
    const media = hasPlay
      ? `<video controls playsinline preload="metadata" src="${esc(playUrl)}"></video>`
      : item.portraitUrl
        ? `<img src="${esc(item.portraitUrl)}" alt="" />`
        : `<div class="hvl-pending"><i class="bi bi-${isHyper ? 'film' : 'hourglass-split'}"></i><br/>${isHyper ? 'Render pending — run npm run render in project dir' : 'Rendering… poll with Refresh'}</div>`;

    const links = [
      item.sourcePage ? `<a class="btn btn-sm btn-outline-primary" href="${esc(item.sourcePage)}">Open page</a>` : '',
      item.studioPage ? `<a class="btn btn-sm btn-outline-secondary" href="${esc(item.studioPage)}">Studio</a>` : '',
      item.projectDir
        ? `<span class="btn btn-sm btn-link p-0 text-muted hvl-project-dir" title="HyperFrames project">${esc(item.projectDir)}</span>`
        : '',
      item.videoId
        ? `<button type="button" class="btn btn-sm btn-link p-0 hvl-copy-id" data-id="${esc(item.videoId)}">Copy ID</button>`
        : ''
    ]
      .filter(Boolean)
      .join('');

    const badgeClass = isHyper ? 'hyperframes' : esc(item.domain);
    const metaParts = [
      kindLabel(item.kind),
      domainLabel(item.domain),
      variantLabel(item.variant),
      item.hostedLocally && hasPlay ? 'Hosted on site' : hasPlay ? 'Cloud URL' : 'Pending',
      item.generatedAt ? new Date(item.generatedAt).toLocaleDateString() : null
    ].filter(Boolean);

    return `<article class="hvl-card" data-id="${esc(item.id)}" id="${esc(item.id)}">
      <div class="hvl-card-media">
        <span class="hvl-card-badge hvl-card-badge--${badgeClass}">${esc(kindLabel(item.kind))} · ${esc(domainLabel(item.domain))}</span>
        ${media}
      </div>
      <div class="hvl-card-body">
        <h2 class="hvl-card-title">${esc(item.title)}</h2>
        ${item.subtitle ? `<p class="hvl-card-subtitle">${esc(item.subtitle)}</p>` : ''}
        <p class="hvl-card-meta">${esc(metaParts.join(' · '))}</p>
        ${item.scriptPreview ? `<p class="hvl-card-script">${esc(item.scriptPreview)}</p>` : ''}
        <div class="hvl-card-actions">${links}</div>
      </div>
    </article>`;
  }

  async function loadLibrary() {
    const status = $('hvlStatus');
    const grid = $('hvlGrid');
    if (status) status.textContent = 'Loading library…';
    try {
      const params = new URLSearchParams();
      if (activeDomain) params.set('domain', activeDomain);
      if (activeKind) params.set('kind', activeKind);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/heygen/library${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Load failed');
      items = json.items || [...(json.videos || []), ...(json.hyperframes || [])];
      if (!items.length) {
        grid.innerHTML =
          '<div class="hvl-empty col-12">Nothing here yet. Generate HeyGen clips from Unified Disasters or Lane print kit, or render HyperFrames reels under <code>video/</code>.</div>';
      } else {
        const cards = await Promise.all(
          items.map(async (item) => {
            const playUrl = await resolvePlayUrl(item);
            return renderCard(item, playUrl);
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
        const heygenCount = json.count ?? 0;
        const hfCount = json.hyperframesCount ?? 0;
        status.textContent = `${items.length} shown · ${heygenCount} HeyGen · ${hfCount} HyperFrames${json.configured ? '' : ' · HEYGEN_API_KEY not set (cloud poll may fail)'}`;
      }
    } catch (err) {
      if (status) status.textContent = err.message || 'Could not load library.';
      grid.innerHTML = '';
    }
  }

  function bindFilterGroup(selector, activeKey, reload) {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(selector).forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('btn-outline-primary', b !== btn);
        });
        reload(btn.getAttribute(activeKey) || '');
        loadLibrary();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindFilterGroup('.hvl-kind-filter', 'data-kind', (value) => {
      activeKind = value;
    });
    bindFilterGroup('.hvl-domain-filter', 'data-domain', (value) => {
      activeDomain = value;
    });
    $('hvlRefreshBtn')?.addEventListener('click', loadLibrary);
    loadLibrary();
  });
})();
