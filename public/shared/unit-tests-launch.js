/**
 * Pure URL-parameter helpers for Unit Test tool page boot (browser + Jest).
 */

/**
 * @param {URLSearchParams | { get: (key: string) => string | null }} params
 * @param {boolean} hasLoadedData
 */
export function shouldAutoOpenGenerate(params, hasLoadedData) {
  if (!params || params.get('generate') !== '1') return false;
  if (hasLoadedData) return false;
  return true;
}

/**
 * @param {URLSearchParams | { get: (key: string) => string | null }} params
 */
export function shouldAutoStartReel(params) {
  return !!(params && params.get('reel') === '1');
}

/**
 * @param {URLSearchParams | { get: (key: string) => string | null }} params
 */
export function shouldLoadOfflineDemo(params) {
  if (!params) return false;
  return params.get('demo') === '1' || params.get('storybook') === '1';
}
