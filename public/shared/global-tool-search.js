/**
 * Global Tool Search — Command Palette (Ctrl+K)
 * Requires tool-search-index.js and modern-navbar.js (for search button).
 */
(function () {
  'use strict';

  if (typeof window.TOOL_INDEX === 'undefined') return;

  const MAX_RESULTS = 14;

  const CATEGORY_ICONS = {
    Finance: 'bi-bank',
    Encompass: 'bi-columns-gap',
    Music: 'bi-music-note-beamed',
    Entertainment: 'bi-stars',
    Bike: 'bi-bicycle',
    AI: 'bi-robot',
    Family: 'bi-people-fill',
    Nature: 'bi-tree-fill',
    Local: 'bi-geo-alt-fill',
    Hub: 'bi-house-fill',
  };

  const CATEGORY_COLORS = {
    Finance: '#3498db',
    Encompass: '#2980b9',
    Music: '#9b59b6',
    Entertainment: '#e74c3c',
    Bike: '#27ae60',
    AI: '#f39c12',
    Family: '#16a085',
    Nature: '#229954',
    Local: '#d35400',
    Hub: '#7f8c8d',
  };

  function trackSearchOpen() {
    try { window.DashboardState?.recordSearchOpen?.(); } catch (_) {}
  }

  function trackToolNavigation(tool, source) {
    if (!tool || !tool.url) return;
    try {
      window.DashboardState?.recordVisit?.({
        id: window.DashboardState?.slugFromUrl?.(tool.url),
        label: tool.name || tool.label || 'Tool',
        url: tool.url,
        category: tool.category || 'General',
        icon: CATEGORY_ICONS[tool.category] || 'bi-grid'
      });
      window.DashboardState?.recordAction?.({
        type: source || 'search-select',
        label: `Opened ${tool.name || 'tool'} from search`,
        url: tool.url,
        category: tool.category || 'General'
      });
    } catch (_) {}
  }

  function searchTools(term) {
    const t = (term || '').toLowerCase().trim();
    if (!t) return window.TOOL_INDEX.slice(0, MAX_RESULTS);
    const words = t.split(/\s+/).filter(Boolean);
    return window.TOOL_INDEX.filter((tool) => {
      const haystack = `${(tool.name || '').toLowerCase()} ${(tool.category || '').toLowerCase()} ${(tool.keywords || '').toLowerCase()}`;
      return words.every((w) => haystack.includes(w));
    }).slice(0, MAX_RESULTS);
  }

  function getRecentTools(max) {
    try {
      const recent = window.DashboardState?.getRecentTools?.(max) || [];
      const byUrl = new Map(window.TOOL_INDEX.map(t => [t.url, t]));
      return recent
        .map(r => byUrl.get(r.url) || (r.url ? { name: r.label || r.url, url: r.url, category: r.category || 'General' } : null))
        .filter(Boolean)
        .slice(0, max);
    } catch (_) {
      return [];
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function highlightMatch(text, term) {
    if (!term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${escapedTerm})`, 'gi'), '<mark>$1</mark>');
  }

  function categoryBadge(category) {
    const color = CATEGORY_COLORS[category] || '#6b7280';
    const icon = CATEGORY_ICONS[category] || 'bi-grid';
    return `<span class="cp-badge" style="background:${color}22;color:${color};"><i class="bi ${icon}"></i> ${escapeHtml(category)}</span>`;
  }

  function renderResultItem(tool, index, isFocused, term) {
    const icon = CATEGORY_ICONS[tool.category] || 'bi-grid';
    const color = CATEGORY_COLORS[tool.category] || '#6b7280';
    const name = highlightMatch(tool.name, term);
    return `<a class="cp-result${isFocused ? ' cp-focused' : ''}" href="${tool.url}" data-index="${index}" tabindex="-1">
      <span class="cp-result-icon" style="background:${color}22;color:${color};"><i class="bi ${icon}"></i></span>
      <span class="cp-result-name">${name}</span>
      ${categoryBadge(tool.category)}
    </a>`;
  }

  function renderSection(label, tools, startIndex, focusedIndex, term) {
    if (!tools.length) return '';
    const items = tools.map((tool, i) => renderResultItem(tool, startIndex + i, startIndex + i === focusedIndex, term)).join('');
    return `<div class="cp-section"><div class="cp-section-label">${escapeHtml(label)}</div>${items}</div>`;
  }

  function createOverlay() {
    if (document.getElementById('globalToolSearchOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'globalToolSearchOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Command Palette');
    overlay.innerHTML = `
      <style>
        #globalToolSearchOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 10000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.18s, visibility 0.18s;
        }
        #globalToolSearchOverlay.show {
          opacity: 1;
          visibility: visible;
        }
        @keyframes cpSlideIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        #globalToolSearchOverlay .cp-box {
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 16px;
          box-shadow: 0 24px 80px rgba(15,23,42,0.25), 0 0 0 1px rgba(52,152,219,0.15);
          width: min(600px, 94vw);
          max-height: 72vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transform-origin: top center;
        }
        #globalToolSearchOverlay.show .cp-box {
          animation: cpSlideIn 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        /* Input row */
        .cp-input-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid rgba(135,206,250,0.2);
          flex-shrink: 0;
        }
        .cp-input-icon {
          color: #3498db;
          font-size: 1.2rem;
          flex-shrink: 0;
        }
        .cp-input {
          flex: 1;
          border: none;
          font-size: 1.1rem;
          outline: none;
          background: transparent;
          color: #1f2937;
          font-family: inherit;
        }
        .cp-input::placeholder { color: #9ca3af; }
        .cp-kbd {
          font-size: 0.75rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          padding: 2px 6px;
          color: #6b7280;
          white-space: nowrap;
        }
        /* Results */
        .cp-results {
          overflow-y: auto;
          flex: 1;
          padding: 0.4rem 0;
        }
        .cp-section {
          padding: 0;
        }
        .cp-section-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          font-weight: 600;
          padding: 0.5rem 1.25rem 0.2rem;
        }
        .cp-result {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 1.25rem;
          text-decoration: none;
          color: #1f2937;
          transition: background 0.1s;
          cursor: pointer;
          border-radius: 0;
        }
        .cp-result:hover, .cp-result.cp-focused {
          background: linear-gradient(90deg, rgba(52,152,219,0.08), transparent);
        }
        .cp-result.cp-focused {
          background: linear-gradient(90deg, rgba(52,152,219,0.13), transparent);
        }
        .cp-result-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .cp-result-name {
          flex: 1;
          font-weight: 500;
          font-size: 0.95rem;
        }
        .cp-result-name mark {
          background: rgba(52,152,219,0.18);
          color: #2563eb;
          border-radius: 3px;
          padding: 0 2px;
        }
        .cp-badge {
          font-size: 0.7rem;
          padding: 0.2rem 0.55rem;
          border-radius: 20px;
          font-weight: 600;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        /* Footer */
        .cp-footer {
          padding: 0.55rem 1.25rem;
          font-size: 0.8rem;
          color: #9ca3af;
          border-top: 1px solid rgba(135,206,250,0.15);
          display: flex;
          gap: 1.2rem;
          flex-shrink: 0;
          background: rgba(248,250,252,0.8);
        }
        .cp-footer span {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .cp-empty {
          text-align: center;
          padding: 2rem 1.25rem;
          color: #9ca3af;
          font-size: 0.95rem;
        }
        .cp-divider {
          border: none;
          border-top: 1px solid rgba(135,206,250,0.15);
          margin: 4px 0;
        }
      </style>
      <div class="cp-box" role="combobox" aria-expanded="true" aria-haspopup="listbox">
        <div class="cp-input-row">
          <i class="bi bi-search cp-input-icon"></i>
          <input type="text" class="cp-input" placeholder="Search tools, features, pages…" autocomplete="off" spellcheck="false" aria-label="Search" aria-autocomplete="list" />
          <span class="cp-kbd">Esc</span>
        </div>
        <div class="cp-results" id="cpResults" role="listbox" aria-label="Search results"></div>
        <div class="cp-footer">
          <span><kbd class="cp-kbd">↑</kbd><kbd class="cp-kbd">↓</kbd> navigate</span>
          <span><kbd class="cp-kbd">↵</kbd> open</span>
          <span><kbd class="cp-kbd">Esc</kbd> close</span>
        </div>
      </div>
    `;
    overlay.tabIndex = -1;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.cp-input');
    const resultsEl = overlay.querySelector('#cpResults');
    let selectedIndex = 0;
    let currentResults = [];
    let currentTerm = '';

    function renderResults(results, term) {
      currentResults = results;
      selectedIndex = 0;
      currentTerm = term || '';

      if (results.length === 0) {
        resultsEl.innerHTML = `<div class="cp-empty"><i class="bi bi-search" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No tools found for "<strong>${escapeHtml(term)}</strong>"</div>`;
        return;
      }

      if (!term) {
        const recent = getRecentTools(4);
        const other = results.filter(r => !recent.some(rc => rc.url === r.url));
        let html = '';
        if (recent.length) {
          html += renderSection('Recent', recent, 0, selectedIndex, term);
          html += '<hr class="cp-divider">';
          html += renderSection('All Tools', other, recent.length, selectedIndex, term);
          currentResults = [...recent, ...other];
        } else {
          const grouped = groupByCategory(results);
          let idx = 0;
          grouped.forEach(({ label, tools }) => {
            html += renderSection(label, tools, idx, selectedIndex, term);
            idx += tools.length;
          });
        }
        resultsEl.innerHTML = html;
      } else {
        resultsEl.innerHTML = results.map((tool, i) => renderResultItem(tool, i, i === 0, term)).join('');
      }
    }

    function groupByCategory(tools) {
      const map = new Map();
      tools.forEach(t => {
        const cat = t.category || 'Other';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(t);
      });
      return Array.from(map.entries()).map(([label, tools]) => ({ label, tools }));
    }

    function openSearch() {
      overlay.classList.add('show');
      input.value = '';
      renderResults(searchTools(''), '');
      requestAnimationFrame(() => input.focus());
      selectedIndex = 0;
      trackSearchOpen();
    }

    function closeSearch() {
      overlay.classList.remove('show');
      input.blur();
    }

    function navigateToSelected() {
      const item = currentResults[selectedIndex];
      if (item) {
        trackToolNavigation(item, 'search-enter');
        closeSearch();
        window.location.href = item.url;
      }
    }

    function updateSelection() {
      resultsEl.querySelectorAll('.cp-result').forEach((el, i) => {
        el.classList.toggle('cp-focused', i === selectedIndex);
        if (i === selectedIndex) el.scrollIntoView({ block: 'nearest' });
      });
    }

    input.addEventListener('input', () => {
      const term = input.value;
      renderResults(searchTools(term), term);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        updateSelection(); return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection(); return;
      }
      if (e.key === 'Enter') { e.preventDefault(); navigateToSelected(); }
    });

    resultsEl.addEventListener('click', (e) => {
      const item = e.target.closest('.cp-result');
      if (!item) return;
      const idx = Number(item.getAttribute('data-index'));
      if (Number.isFinite(idx) && currentResults[idx]) {
        trackToolNavigation(currentResults[idx], 'search-click');
      }
      closeSearch();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSearch();
    });

    window.openGlobalToolSearch = openSearch;
    window.closeGlobalToolSearch = closeSearch;
  }

  function init() {
    createOverlay();
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.openGlobalToolSearch?.();
      }
    });
    document.addEventListener('open-tool-search', () => {
      window.openGlobalToolSearch?.();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
