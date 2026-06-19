/**
 * Lane family QR / print links always target production (thelanefamily.us).
 * Development work by David Lane
 */
(function () {
  'use strict';

  var DEFAULT_PUBLIC_ORIGIN = 'https://www.thelanefamily.us';

  function normalizeOrigin(value) {
    return String(value || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, '');
  }

  /**
   * @param {string} [catalogPublicSiteUrl] optional brand.publicSiteUrl from lane JSON catalogs
   * @returns {string}
   */
  function lanePublicOrigin(catalogPublicSiteUrl) {
    return normalizeOrigin(catalogPublicSiteUrl || DEFAULT_PUBLIC_ORIGIN);
  }

  /**
   * @param {string} pathOrUrl path starting with / or absolute URL
   * @param {string} [catalogPublicSiteUrl]
   * @returns {string}
   */
  function lanePublicUrl(pathOrUrl, catalogPublicSiteUrl) {
    var raw = String(pathOrUrl || '').trim();
    if (!raw) return lanePublicOrigin(catalogPublicSiteUrl);
    if (/^https?:\/\//i.test(raw)) return raw;
    var path = raw.startsWith('/') ? raw : `/${raw}`;
    return new URL(path, `${lanePublicOrigin(catalogPublicSiteUrl)}/`).href;
  }

  window.lanePublicOrigin = lanePublicOrigin;
  window.lanePublicUrl = lanePublicUrl;
})();
