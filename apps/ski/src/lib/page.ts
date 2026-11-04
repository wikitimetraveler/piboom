export type SkiPage = 'drive' | 'areas' | 'cams' | 'log';

const PATHS: Record<SkiPage, string> = { drive: '/ski/', areas: '/ski/areas', cams: '/ski/cams', log: '/ski/log' };

export function pageFromPath(pathname = window.location.pathname): SkiPage {
  if (/\/areas\/?$/.test(pathname)) return 'areas';
  if (/\/cams(\/[\w-]+)?\/?$/.test(pathname)) return 'cams';
  if (/\/log\/?$/.test(pathname)) return 'log';
  return 'drive';
}

/** Resort id from /ski/cams/<id>, or '' on the cams landing path. */
export function camsResortFromPath(pathname = window.location.pathname): string {
  const m = pathname.match(/\/cams\/([\w-]+)\/?$/);
  return m ? m[1] : '';
}

export function camsPath(resortId: string) {
  return resortId ? `${PATHS.cams}/${resortId}` : PATHS.cams;
}

export function goPage(page: SkiPage, resortId?: string) {
  const path = page === 'cams' && resortId ? camsPath(resortId) : PATHS[page];
  window.history.pushState({ page }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
