/**
 * Unified Disasters — live web crawl headline panel (RSS/Atom + GDELT).
 */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function sourceBadgeClass(source) {
  const map = {
    nws: 'bg-primary',
    usgs: 'bg-secondary',
    gdelt: 'bg-info text-dark',
    fema: 'bg-warning text-dark',
    news: 'bg-dark',
  };
  return map[source] || 'bg-light text-dark border';
}

function renderHeadlines(container, items, limit) {
  const list = (items || []).slice(0, limit);
  if (!list.length) {
    container.innerHTML = '<p class="small text-muted mb-0">No hazard headlines in the current crawl window.</p>';
    return;
  }
  container.innerHTML = list
    .map((item) => {
      const title = escapeHtml(item.title);
      const publisher = escapeHtml(item.publisher || item.source || 'Web');
      const source = escapeHtml((item.source || 'web').toUpperCase());
      const when = formatRelativeTime(item.publishedAt);
      const url = item.url ? escapeHtml(item.url) : '';
      const titleHtml = url
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="du-crawl-headline-link">${title}</a>`
        : `<span class="du-crawl-headline-link">${title}</span>`;
      return `<li class="du-crawl-headline-item">
        <span class="badge ${sourceBadgeClass(item.source)} du-crawl-source-badge">${source}</span>
        ${titleHtml}
        <span class="du-crawl-headline-meta">${publisher}${when ? ` · ${when}` : ''}</span>
      </li>`;
    })
    .join('');
}

export function initDisasterWebCrawlPanel(options = {}) {
  const root = $(options.rootId || 'duWebCrawlPanel');
  const listEl = $(options.listId || 'duWebCrawlList');
  const statusEl = $(options.statusId || 'duWebCrawlStatus');
  const refreshBtn = $(options.refreshBtnId || 'duWebCrawlRefreshBtn');
  if (!root || !listEl) return null;

  const limit = Number.isFinite(options.limit) ? options.limit : 12;
  let loading = false;

  function setStatus(message, tone = 'muted') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `du-web-crawl-status small text-${tone === 'muted' ? 'muted' : tone}`;
  }

  async function loadHeadlines() {
    if (loading) return;
    loading = true;
    if (refreshBtn) refreshBtn.disabled = true;
    setStatus('Crawling official feeds and GDELT news…', 'info');
    try {
      const res = await fetch('/api/disasters/web-crawl?maxAgeHours=72&includeGdelt=true');
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || json?.details || `Crawl failed (${res.status})`);
      }
      const data = json.data;
      renderHeadlines(listEl, data.items, limit);
      const bySource = data.summary?.bySource || {};
      const parts = Object.entries(bySource).map(([k, v]) => `${k.toUpperCase()}: ${v}`);
      const failCount = data.summary?.failures?.length || 0;
      setStatus(
        `${data.summary?.totalItems || 0} headlines · ${parts.join(' · ')}${failCount ? ` · ${failCount} feed warning(s)` : ''}`,
        failCount ? 'warning' : 'success',
      );
    } catch (err) {
      console.error('Web crawl panel error:', err);
      listEl.innerHTML = '';
      setStatus(err.message || 'Failed to load headlines', 'danger');
    } finally {
      loading = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  refreshBtn?.addEventListener('click', () => {
    void loadHeadlines();
  });

  void loadHeadlines();
  return { refresh: loadHeadlines };
}
