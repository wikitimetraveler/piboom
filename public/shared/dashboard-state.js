/**
 * Command Center dashboard state manager.
 * Stores recent tools, last actions, favorites, and resume state in localStorage.
 * All data is scoped per signed-in user (loggedInUserId). When not logged in,
 * falls back to currentUserId (e.g. from user-selector) or 'anon'.
 */
(function (global) {
  'use strict';

  const KEYS = {
    recentTools: 'dashboardRecentTools',
    favorites: 'dashboardFavorites',
    lastActions: 'dashboardLastActions',
    resumeState: 'dashboardResumeState'
  };

  const LIMITS = {
    recentTools: 20,
    lastActions: 5,
    favorites: 50
  };

  /**
   * Returns the user scope for dashboard persistence.
   * Prefers loggedInUserId (authenticated user) so dashboard items persist per signed-in user.
   * Never uses currentUserId when logged in (that may be "viewing as" from user-selector).
   */
  function getUserScope() {
    try {
      const loggedIn = localStorage.getItem('loggedInUserId');
      if (loggedIn && String(loggedIn).trim()) return String(loggedIn).trim();
      const current = localStorage.getItem('currentUserId');
      const userId = String(current || 'anon').trim();
      return userId || 'anon';
    } catch (_) {
      return 'anon';
    }
  }

  function keyFor(baseKey) {
    return `${baseKey}:${getUserScope()}`;
  }

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // no-op
    }
  }

  function slugFromUrl(url) {
    const normalized = String(url || '/').toLowerCase().replace(/[?#].*$/, '');
    return normalized
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'home';
  }

  function toolKey(tool) {
    return String(tool?.id || slugFromUrl(tool?.url || '/'));
  }

  function normalizeTool(tool) {
    const now = Date.now();
    return {
      id: toolKey(tool),
      label: String(tool?.label || tool?.name || 'Unknown Tool'),
      url: String(tool?.url || '/'),
      category: String(tool?.category || 'General'),
      icon: String(tool?.icon || 'bi-grid'),
      timestamp: Number(tool?.timestamp || now)
    };
  }

  function readRecentTools() {
    const key = keyFor(KEYS.recentTools);
    let tools = safeRead(key, []);
    if ((!Array.isArray(tools) || tools.length === 0) && getUserScope() === 'anon') {
      tools = safeRead(KEYS.recentTools, []);
    }
    return Array.isArray(tools) ? tools : [];
  }

  function writeRecentTools(tools) {
    const key = keyFor(KEYS.recentTools);
    safeWrite(key, tools.slice(0, LIMITS.recentTools));
  }

  function readFavorites() {
    const key = keyFor(KEYS.favorites);
    let favorites = safeRead(key, []);
    if ((!Array.isArray(favorites) || favorites.length === 0) && getUserScope() === 'anon') {
      favorites = safeRead(KEYS.favorites, []);
    }
    return Array.isArray(favorites) ? favorites : [];
  }

  function writeFavorites(favorites) {
    const unique = Array.from(new Set((favorites || []).map(String)));
    const key = keyFor(KEYS.favorites);
    safeWrite(key, unique.slice(0, LIMITS.favorites));
  }

  function readLastActions() {
    const key = keyFor(KEYS.lastActions);
    let actions = safeRead(key, []);
    if ((!Array.isArray(actions) || actions.length === 0) && getUserScope() === 'anon') {
      actions = safeRead(KEYS.lastActions, []);
    }
    return Array.isArray(actions) ? actions : [];
  }

  function writeLastActions(actions) {
    const key = keyFor(KEYS.lastActions);
    safeWrite(key, actions.slice(0, LIMITS.lastActions));
  }

  function readResumeMap() {
    const key = keyFor(KEYS.resumeState);
    let map = safeRead(key, {});
    if ((!map || Object.keys(map).length === 0) && getUserScope() === 'anon') {
      map = safeRead(KEYS.resumeState, {});
    }
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  }

  function writeResumeMap(map) {
    const key = keyFor(KEYS.resumeState);
    safeWrite(key, map || {});
  }

  function recordVisit(tool) {
    const normalized = normalizeTool(tool);
    const existing = readRecentTools().filter((item) => item?.id !== normalized.id);
    const next = [normalized].concat(existing);
    writeRecentTools(next);
    recordAction({
      type: 'visit',
      label: normalized.label,
      toolId: normalized.id,
      url: normalized.url,
      category: normalized.category
    });
    return normalized;
  }

  function recordAction(action) {
    const now = Date.now();
    const entry = {
      type: String(action?.type || 'action'),
      label: String(action?.label || 'Action'),
      toolId: String(action?.toolId || ''),
      url: String(action?.url || '/'),
      category: String(action?.category || 'General'),
      timestamp: now
    };
    const current = readLastActions();
    current.unshift(entry);
    writeLastActions(current);
    return entry;
  }

  function recordSearchOpen() {
    return recordAction({
      type: 'search-open',
      label: 'Opened tool search',
      category: 'Navigation',
      url: '#search'
    });
  }

  function getRecentTools(limit) {
    const max = Number.isFinite(limit) ? Math.max(0, limit) : LIMITS.lastActions;
    return readRecentTools().slice(0, max);
  }

  function getLastActions(limit) {
    const max = Number.isFinite(limit) ? Math.max(0, limit) : LIMITS.lastActions;
    return readLastActions().slice(0, max);
  }

  function isFavorite(toolId) {
    return readFavorites().includes(String(toolId || ''));
  }

  function toggleFavorite(toolId) {
    const id = String(toolId || '');
    if (!id) return false;
    const favorites = readFavorites();
    const exists = favorites.includes(id);
    const next = exists ? favorites.filter((v) => v !== id) : favorites.concat(id);
    writeFavorites(next);
    return !exists;
  }

  function getFavorites() {
    return readFavorites();
  }

  function saveResumeState(toolId, state) {
    const id = String(toolId || '');
    if (!id) return;
    const map = readResumeMap();
    map[id] = {
      state: state || {},
      timestamp: Date.now()
    };
    writeResumeMap(map);
  }

  function getResumeState(toolId) {
    const id = String(toolId || '');
    if (!id) return null;
    const map = readResumeMap();
    return map[id] || null;
  }

  function clearAll() {
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(keyFor(k)));
    } catch (_) {
      // no-op
    }
  }

  global.DashboardState = {
    slugFromUrl,
    normalizeTool,
    recordVisit,
    recordAction,
    recordSearchOpen,
    getRecentTools,
    getLastActions,
    toggleFavorite,
    isFavorite,
    getFavorites,
    saveResumeState,
    getResumeState,
    clearAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
