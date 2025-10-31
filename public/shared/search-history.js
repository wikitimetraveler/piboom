/**
 * Search History & Quick Access System
 * 
 * @file       search-history.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Search history tracking and quick access system that stores recent searches
 * in localStorage and provides quick access chips for frequently searched terms.
 * Enhances user experience by reducing repetitive typing.
 * 
 * Features:
 * - Automatic search history tracking
 * - localStorage persistence
 * - Quick access chips for recent searches
 * - Configurable maximum history size
 * - Duplicate prevention
 * - Most recent searches shown first
 * 
 * Configuration:
 * - Maximum history: 8 items (configurable)
 * - Storage key: 'piBoom_searchHistory'
 * - Auto-saves on each search
 * 
 * Technical Implementation:
 * - localStorage API for persistence
 * - JSON serialization for storage
 * - Array manipulation (push, slice, filter)
 * - Chip-based UI components
 * - Event handlers for chip clicks
 * 
 * Usage:
 * - addToHistory(searchTerm) - Add search to history
 * - getSearchHistory() - Retrieve history array
 * - clearSearchHistory() - Clear all history
 * - renderSearchHistory(container) - Display history chips
 * 
 * ==============================================================================
 */

const HISTORY_KEY = 'piBoom_searchHistory';
const MAX_HISTORY = 8;

// Get search history
function getSearchHistory() {
  const history = localStorage.getItem(HISTORY_KEY);
  return history ? JSON.parse(history) : [];
}

// Add to search history
function addToSearchHistory(query, type = 'artist') {
  const history = getSearchHistory();
  
  // Create entry
  const entry = {
    query: query.trim(),
    type: type,
    timestamp: Date.now()
  };
  
  // Remove duplicates
  const filtered = history.filter(h => h.query.toLowerCase() !== query.toLowerCase());
  
  // Add to beginning
  filtered.unshift(entry);
  
  // Keep only last MAX_HISTORY items
  const trimmed = filtered.slice(0, MAX_HISTORY);
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  
  // Trigger event for UI update
  window.dispatchEvent(new CustomEvent('searchHistoryUpdated'));
}

// Clear search history
function clearSearchHistory() {
  localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new CustomEvent('searchHistoryUpdated'));
}

// Create search history chips HTML
function createSearchHistoryChips(containerId, onClickHandler) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const history = getSearchHistory();
  
  if (history.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  let html = `
    <div style="background: linear-gradient(135deg, rgba(102,126,234,0.05), rgba(118,75,162,0.05)); padding: 15px 20px; border-radius: 12px; border: 1px solid rgba(135, 206, 250, 0.2); margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h6 style="margin: 0; color: #667eea; font-weight: 600; font-size: 0.9rem;">
          <i class="bi-clock-history"></i> Recent Searches
        </h6>
        <button onclick="clearSearchHistory(); createSearchHistoryChips('${containerId}', ${onClickHandler.name})" 
                style="background: none; border: none; color: #999; cursor: pointer; font-size: 0.8rem; padding: 0;" 
                title="Clear history">
          <i class="bi-x-circle"></i> Clear
        </button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
  `;
  
  history.forEach(item => {
    html += `
      <button class="search-chip" onclick="${onClickHandler.name}('${item.query.replace(/'/g, "\\'")}')"
              style="background: white; border: 2px solid rgba(102, 126, 234, 0.3); color: #667eea; padding: 8px 16px; border-radius: 20px; cursor: pointer; transition: all 0.2s ease; font-size: 0.85rem; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;">
        <i class="bi-${item.type === 'album' ? 'disc' : 'music-note'}"></i> ${item.query}
      </button>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Add hover effects via inline styles
  const chips = container.querySelectorAll('.search-chip');
  chips.forEach(chip => {
    chip.addEventListener('mouseenter', function() {
      this.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      this.style.color = 'white';
      this.style.borderColor = '#667eea';
      this.style.transform = 'translateY(-2px)';
    });
    chip.addEventListener('mouseleave', function() {
      this.style.background = 'white';
      this.style.color = '#667eea';
      this.style.borderColor = 'rgba(102, 126, 234, 0.3)';
      this.style.transform = 'translateY(0)';
    });
  });
}

// Auto-add dark mode support to search chips
if (typeof window !== 'undefined') {
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('dark-mode')) {
      document.querySelectorAll('.search-chip').forEach(chip => {
        if (!chip.classList.contains('dark-adjusted')) {
          chip.classList.add('dark-adjusted');
          chip.style.background = 'rgba(255, 255, 255, 0.05)';
          chip.style.color = '#667eea';
        }
      });
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}

// Export functions
window.getSearchHistory = getSearchHistory;
window.addToSearchHistory = addToSearchHistory;
window.clearSearchHistory = clearSearchHistory;
window.createSearchHistoryChips = createSearchHistoryChips;


