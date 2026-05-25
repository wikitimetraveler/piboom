/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const issueRaw = String(params.get('issue') || '01').trim();
  const issueNum = issueRaw.padStart(2, '0');
  const ISSUE_PATH = `/data/lane-magazine-issue-${issueNum}.json`;

  const root = document.getElementById('laneMagSpreads');
  const titleEl = document.getElementById('laneMagTitle');
  const subtitleEl = document.getElementById('laneMagSubtitle');
  const statusEl = document.getElementById('laneMagStatus');
  const printBtn = document.getElementById('laneMagPrintBtn');
  const downloadJsonBtn = document.getElementById('laneMagDownloadJsonBtn');
  const crumbEl = document.getElementById('laneMagCrumbIssue');
  const introEl = document.getElementById('laneMagIntroCopy');
  const issueSwitchEl = document.getElementById('laneMagIssueSwitch');

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('text-muted', 'text-danger', 'text-success');
    statusEl.classList.add(type === 'err' ? 'text-danger' : type === 'ok' ? 'text-success' : 'text-muted');
  }

  function renderIssueSwitch(currentIssue) {
    if (!issueSwitchEl) return;
    const issues = [
      { num: '01', label: 'Issue 1' },
      { num: '02', label: 'Issue 2' }
    ];
    issueSwitchEl.innerHTML = issues
      .map((item) => {
        const href = item.num === '01' ? '/family/lane-magazine.html' : `/family/lane-magazine.html?issue=${item.num}`;
        const active = item.num === currentIssue;
        return active
          ? `<span class="btn btn-sm btn-primary disabled" aria-current="page">${esc(item.label)}</span>`
          : `<a class="btn btn-sm btn-outline-secondary" href="${esc(href)}">${esc(item.label)}</a>`;
      })
      .join('');
  }

  function renderSpread(spread, index) {
    const links = Array.isArray(spread.links) ? spread.links : [];
    const bullets = Array.isArray(spread.bullets) ? spread.bullets : [];
    const image = spread.imageUrl
      ? `
        <div class="lane-mag-spread__image-wrap">
          <img class="lane-mag-spread__image" src="${esc(spread.imageUrl)}" alt="${esc(spread.title || 'Issue image')}" loading="lazy" />
          ${spread.caption ? `<div class="lane-mag-spread__caption">${esc(spread.caption)}</div>` : ''}
        </div>`
      : '';
    const quote = spread.quote ? `<blockquote class="lane-mag-spread__quote">${esc(spread.quote)}</blockquote>` : '';
    const list = bullets.length
      ? `<ul class="lane-mag-spread__list">${bullets.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '';
    const linkMarkup = links.length
      ? `<div class="lane-mag-spread__links">${links
          .map((link) => `<a class="btn btn-outline-secondary btn-sm" href="${esc(link.url)}">${esc(link.label || link.url)}</a>`)
          .join('')}</div>`
      : '';

    return `
      <article class="lane-mag-spread" data-kind="${esc(spread.kind || '')}" id="spread-${esc(spread.id || index + 1)}">
        <div class="lane-mag-spread__meta">Spread ${index + 1} · ${esc(spread.kind || 'feature')}</div>
        <h2 class="lane-mag-spread__title">${esc(spread.title || `Spread ${index + 1}`)}</h2>
        ${spread.kicker ? `<p class="small text-muted mb-2">${esc(spread.kicker)}</p>` : ''}
        ${spread.summary ? `<p class="lane-mag-spread__summary">${esc(spread.summary)}</p>` : ''}
        ${quote}
        ${image}
        ${list}
        ${linkMarkup}
      </article>
    `;
  }

  async function loadIssue() {
    if (!root) return;
    renderIssueSwitch(issueNum);
    setStatus('Loading issue data...', 'info');
    try {
      const response = await fetch(ISSUE_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load issue JSON (${response.status})`);
      const issue = await response.json();
      const spreads = Array.isArray(issue.spreads) ? issue.spreads : [];
      const subtitle = issue.subtitle || `Issue ${issueNum}`;

      if (titleEl) titleEl.textContent = issue.title || titleEl.textContent;
      if (subtitleEl) subtitleEl.textContent = subtitle;
      if (crumbEl) crumbEl.textContent = subtitle;
      document.title = `Lane Magazine - ${subtitle}`;

      if (introEl) {
        introEl.textContent =
          issueNum === '02'
            ? 'Issue 2 renders achiever-tier spreads from lane-major-achievers.json. Keep Tier B military framing book-only until rolls confirm.'
            : 'This page renders the Issue 1 outline from structured JSON so you can edit copy once and print a shareable family PDF.';
      }

      root.innerHTML = spreads.map(renderSpread).join('');
      setStatus(`${spreads.length} spreads loaded. Use Print / Save PDF when ready.`, 'ok');

      if (downloadJsonBtn) {
        downloadJsonBtn.onclick = () => {
          const blob = new Blob([JSON.stringify(issue, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${issue.issueId || `lane-magazine-issue-${issueNum}`}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        };
      }
    } catch (err) {
      root.innerHTML = `<p class="text-danger small mb-0">${esc(err.message || 'Failed to load issue')}</p>`;
      setStatus('Issue data unavailable.', 'err');
    }
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  loadIssue();
})();
