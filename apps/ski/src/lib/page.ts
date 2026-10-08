export type SkiPage = 'drive' | 'areas' | 'log';

const PATHS: Record<SkiPage, string> = { drive: '/ski/', areas: '/ski/areas', log: '/ski/log' };

export function pageFromPath(pathname = window.location.pathname): SkiPage {
  if (/\/areas\/?$/.test(pathname)) return 'areas';
  if (/\/log\/?$/.test(pathname)) return 'log';
  return 'drive';
}

export function goPage(page: SkiPage) {
  window.history.pushState({ page }, '', PATHS[page]);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
