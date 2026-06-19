/**
 * Lane family QR / print links always target https://www.thelanefamily.us
 * Development work by David Lane
 */
(function () {
  'use strict';

  var LANE_PRODUCTION_ORIGIN = 'https://www.thelanefamily.us';
  var LANE_HOST_PATTERN = /(^|\.)thelanefamily\.us$/i;

  function normalizeOrigin(value) {
    var raw = String(value || LANE_PRODUCTION_ORIGIN).trim().replace(/\/$/, '');
    try {
      var parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
      if (LANE_HOST_PATTERN.test(parsed.hostname)) {
        parsed.protocol = 'https:';
        parsed.hostname = 'www.thelanefamily.us';
        return `${parsed.protocol}//${parsed.hostname}`;
      }
    } catch (_) {
      /* fall through */
    }
    return LANE_PRODUCTION_ORIGIN;
  }

  /**
   * @param {string} [catalogPublicSiteUrl] optional brand.publicSiteUrl from lane JSON catalogs
   * @returns {string}
   */
  function lanePublicOrigin(catalogPublicSiteUrl) {
    return normalizeOrigin(catalogPublicSiteUrl || LANE_PRODUCTION_ORIGIN);
  }

  /**
   * @param {string} pathOrUrl path starting with / or absolute URL
   * @param {string} [catalogPublicSiteUrl]
   * @returns {string}
   */
  function lanePublicUrl(pathOrUrl, catalogPublicSiteUrl) {
    var raw = String(pathOrUrl || '').trim();
    if (!raw) return lanePublicOrigin(catalogPublicSiteUrl);
    if (/^https?:\/\//i.test(raw)) {
      try {
        var absolute = new URL(raw);
        if (LANE_HOST_PATTERN.test(absolute.hostname)) {
          absolute.protocol = 'https:';
          absolute.hostname = 'www.thelanefamily.us';
          return absolute.href;
        }
      } catch (_) {
        return raw;
      }
      return raw;
    }
    var path = raw.startsWith('/') ? raw : `/${raw}`;
    return new URL(path, `${lanePublicOrigin(catalogPublicSiteUrl)}/`).href;
  }

  window.LANE_PRODUCTION_ORIGIN = LANE_PRODUCTION_ORIGIN;
  window.lanePublicOrigin = lanePublicOrigin;
  window.lanePublicUrl = lanePublicUrl;
})();
