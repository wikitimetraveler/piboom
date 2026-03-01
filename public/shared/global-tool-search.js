/**
 * Global Tool Search - Ctrl+K or search icon to find tools by name or keyword.
 * Requires tool-search-index.js and modern-navbar.js (for search button).
 */
(function () {
  'use strict';

  if (typeof window.TOOL_INDEX === 'undefined') return;

  const MAX_RESULTS = 12;

  function searchTools(term) {
    const t = (term || '').toLowerCase().trim();
    if (!t) return window.TOOL_INDEX.slice(0, MAX_RESULTS);
    const words = t.split(/\s+/).filter(Boolean);
    return window.TOOL_INDEX.filter((tool) => {
      const name = (tool.name || '').toLowerCase();
      const category = (tool.category || '').toLowerCase();
      const keywords = (tool.keywords || '').toLowerCase();
      const haystack = `${name} ${category} ${keywords}`;
      return words.every((w) => haystack.includes(w));
    }).slice(0, MAX_RESULTS);
  }

  function createOverlay() {
    if (document.getElementById('globalToolSearchOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'globalToolSearchOverlay';
    overlay.innerHTML = `
      <style>
        #globalToolSearchOverlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s, visibility 0.2s;
        }
        #globalToolSearchOverlay.show {
          opacity: 1;
          visibility: visible;
        }
        #globalToolSearchOverlay .search-box {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          width: min(560px, 92vw);
          max-height: 70vh;
          overflow: hidden;
        }
        #globalToolSearchOverlay .search-input-wrap {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        #globalToolSearchOverlay .search-input-wrap i {
          color: #6b7280;
          font-size: 1.25rem;
        }
        #globalToolSearchOverlay .search-input {
          flex: 1;
          border: none;
          font-size: 1.1rem;
          outline: none;
        }
        #globalToolSearchOverlay .search-input::placeholder {
          color: #9ca3af;
        }
        #globalToolSearchOverlay .search-results {
          max-height: 400px;
          overflow-y: auto;
          padding: 0.5rem 0;
        }
        #globalToolSearchOverlay .search-result-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s;
          cursor: pointer;
        }
        #globalToolSearchOverlay .search-result-item:hover,
        #globalToolSearchOverlay .search-result-item.focused {
          background: rgba(102, 126, 234, 0.08);
        }
        #globalToolSearchOverlay .search-result-item .category-badge {
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          background: rgba(102, 126, 234, 0.15);
          color: #667eea;
          flex-shrink: 0;
        }
        #globalToolSearchOverlay .search-result-item .name {
          font-weight: 600;
          flex: 1;
        }
        #globalToolSearchOverlay .search-hint {
          padding: 0.75rem 1.25rem;
          font-size: 0.85rem;
          color: #6b7280;
        }
      </style>
      <div class="search-box">
        <div class="search-input-wrap">
          <i class="bi bi-search"></i>
          <input type="text" class="search-input" placeholder="Search tools..." autocomplete="off" />
        </div>
        <div class="search-results" id="globalToolSearchResults"></div>
        <div class="search-hint" id="globalToolSearchHint">Press <kbd>Esc</kbd> to close • <kbd>↑</kbd><kbd>↓</kbd> to navigate</div>
      </div>
    `;
    overlay.tabIndex = -1;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.search-input');
    const resultsEl = overlay.querySelector('#globalToolSearchResults');
    let selectedIndex = 0;
    let currentResults = [];

    function renderResults(results) {
      currentResults = results;
      selectedIndex = 0;
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search-hint" style="padding: 1rem 1.25rem;">No tools found. Try different keywords.</div>';
        return;
      }
      resultsEl.innerHTML = results.map((tool, i) => `
        <a class="search-result-item ${i === 0 ? 'focused' : ''}" href="${tool.url}" data-index="${i}">
          <span class="category-badge">${escapeHtml(tool.category)}</span>
          <span class="name">${escapeHtml(tool.name)}</span>
        </a>
      `).join('');
    }

    function escapeHtml(s) {
      if (!s) return '';
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function openSearch() {
      overlay.classList.add('show');
      input.value = '';
      renderResults(searchTools(''));
      input.focus();
      selectedIndex = 0;
    }

    function closeSearch() {
      overlay.classList.remove('show');
      input.blur();
    }

    function navigateToSelected() {
      const item = currentResults[selectedIndex];
      if (item) {
        closeSearch();
        window.location.href = item.url;
      }
    }

    function updateSelection() {
      resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
        el.classList.toggle('focused', i === selectedIndex);
      });
    }

    input.addEventListener('input', () => {
      renderResults(searchTools(input.value));
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        updateSelection();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateToSelected();
      }
    });

    resultsEl.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) closeSearch();
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
