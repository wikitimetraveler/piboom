export type SkiPage = 'drive' | 'areas';

export function pageFromPath(pathname = window.location.pathname): SkiPage {
  return /\/areas\/?$/.test(pathname) ? 'areas' : 'drive';
}

export function goPage(page: SkiPage) {
  const href = page === 'areas' ? '/ski/areas' : '/ski/';
  window.history.pushState({ page }, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
