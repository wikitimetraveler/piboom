/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Shared storybook wall: forward descendants OR ancestor line toward anchor (Line page parity).
 * Data: GET /api/genealogy/direct-descendant-story | GET /api/genealogy/direct-line-story
 */
(function (global) {
  'use strict';

  const DEFAULT_START_ID = 112;

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function snippetFromNarrative(narrative) {
    const s = String(narrative || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const cut = s.length > 220 ? `${s.slice(0, 217)}…` : s;
    return cut;
  }

  function renderCards(line, idPrefix) {
    return line
      .map((entry, idx) => {
        const sid = `${idPrefix}-${idx + 1}`;
        const birth = entry.birthYear ?? '?';
        const death = entry.deathYear ?? '?';
        const snip = snippetFromNarrative(entry.narrative);
        const pid = entry.id != null ? encodeURIComponent(String(entry.id)) : '';
        const wallHref = pid ? `/family/lane-memorial-wall.html?personId=${pid}` : '/family/lane-memorial-wall.html';
        return `
      <article class="ddw-card" id="${esc(sid)}">
        <div class="ddw-card-head">
          <h3 class="ddw-card-title h6 mb-0">${esc(entry.name || 'Unknown')}</h3>
          <span class="ddw-card-years">Step ${idx + 1} · ${esc(birth)} – ${esc(death)}</span>
        </div>
        ${snip ? `<p class="ddw-card-snippet mb-2">${esc(snip)}</p>` : ''}
        <a class="btn btn-sm btn-outline-light" href="${esc(wallHref)}">Open on memorial wall</a>
      </article>`;
      })
      .join('');
  }

  function renderQuickNav(quickNavEl, line, idPrefix, lastLabel) {
    if (!quickNavEl || line.length <= 1) return;

    const first = line[0];
    const middle = line[Math.floor(line.length / 2)];
    const latest = line[line.length - 1];
    const points = [];
    points.push({ label: 'Origin', id: `${idPrefix}-1`, name: first?.name || 'Origin' });
    if (middle && middle !== first && middle !== latest && line.length > 2) {
      points.push({
        label: 'Middle',
        id: `${idPrefix}-${Math.floor(line.length / 2) + 1}`,
        name: middle.name || 'Middle'
      });
    }
    points.push({ label: lastLabel, id: `${idPrefix}-${line.length}`, name: latest?.name || lastLabel });

    quickNavEl.innerHTML = points
      .map(
        (p) =>
          `<a href="#${esc(p.id)}" class="history-quick-link memorial-quick-link direct-quick-link" title="${esc(p.name)}">${esc(
            p.label
          )}</a>`
      )
      .join('');
  }

  /**
   * @param {object} opts
   * @param {'descendants'|'ancestors'} [opts.mode]
   * @param {number} [opts.startId]
   * @param {string} opts.gridId
   * @param {string} opts.metaId
   * @param {string} [opts.errorId]
   * @param {string} [opts.quickNavId]
   * @param {string} [opts.idPrefix] anchor ids for cards / quick nav (default descendant-step)
   */
  async function mount(opts) {
    const mode = opts.mode === 'ancestors' ? 'ancestors' : 'descendants';
    const startId = Number.isFinite(Number(opts.startId)) ? Number(opts.startId) : DEFAULT_START_ID;
    const gridEl = document.getElementById(opts.gridId);
    const metaEl = document.getElementById(opts.metaId);
    const errorEl = opts.errorId ? document.getElementById(opts.errorId) : null;
    const quickNavEl = opts.quickNavId ? document.getElementById(opts.quickNavId) : null;
    const idPrefix = String(opts.idPrefix || 'descendant-step').replace(/\s+/g, '-');

    if (!gridEl) return;

    if (metaEl) metaEl.textContent = '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('d-none');
    }
    if (quickNavEl) quickNavEl.innerHTML = '';
    gridEl.innerHTML =
      mode === 'ancestors'
        ? `<div class="small text-muted">Loading ancestor direct line…</div>`
        : `<div class="small text-muted">Loading direct descendant line…</div>`;

    let data;
    try {
      let res;
      if (mode === 'ancestors') {
        res = await fetch(
          `/api/genealogy/direct-line-story?startId=${encodeURIComponent(String(startId))}&order=oldest-first`
        );
      } else {
        res = await fetch(`/api/genealogy/direct-descendant-story?startId=${encodeURIComponent(String(startId))}`);
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      data = json;
    } catch (e) {
      gridEl.innerHTML = '';
      if (errorEl) {
        errorEl.textContent = String(e.message || e);
        errorEl.classList.remove('d-none');
      }
      return;
    }

    const line = Array.isArray(data.line) ? data.line : [];
    const startName = data.startPerson?.name || 'Anchor';

    if (metaEl) {
      if (mode === 'ancestors') {
        metaEl.textContent = `Anchors at ${startName} (id ${data.startId}) • ${
          data.generations || line.length
        } steps • ancestor direct line (oldest first, ends at this anchor)`;
      } else {
        metaEl.textContent = `Anchor: ${startName} (id ${data.startId}) • ${
          data.generations || line.length
        } generations forward • continues through earliest documented child each generation`;
      }
    }

    if (!line.length) {
      gridEl.innerHTML =
        mode === 'ancestors'
          ? `<div class="small text-muted">No ancestor line data returned for this anchor.</div>`
          : `<div class="small text-muted">No descendant data returned for this anchor.</div>`;
      return;
    }

    if (mode === 'descendants' && line.length === 1) {
      gridEl.innerHTML = `<div class="small text-muted">No descendant chain beyond this anchor in the graph (no linked children), or the line stops here.</div>`;
      return;
    }

    if (mode === 'ancestors' && line.length === 1) {
      gridEl.innerHTML = `<div class="small text-muted">No parent links documented above this anchor in the graph—or the ancestor line stops at this profile.</div>`;
      return;
    }

    gridEl.innerHTML = renderCards(line, idPrefix);

    if (mode === 'ancestors') {
      renderQuickNav(quickNavEl, line, idPrefix, 'Recent anchor');
    } else {
      renderQuickNav(quickNavEl, line, idPrefix, 'Latest');
    }
  }

  global.LaneDirectDescendantWall = {
    DEFAULT_START_ID,
    mount
  };
})(window);
