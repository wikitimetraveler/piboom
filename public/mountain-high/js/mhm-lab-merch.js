/**
 * Mountain High lab merch — sticker + t-shirt QR to this page
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const PAGE_PATH = '/mountain-high/';
  const DEFAULT_PUBLIC_ORIGIN = 'https://www.thelanefamily.us';
  const QR_SIZE = 112;

  function pageUrl(catalog) {
    const site = catalog?.brand?.publicSiteUrl;
    if (typeof root.lanePublicUrl === 'function') {
      return root.lanePublicUrl(PAGE_PATH, site);
    }
    const origin = String(site || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, '');
    return `${origin}${PAGE_PATH}`;
  }

  function mountQr(host, url, size) {
    if (!host || !root.QRCode || !url) return null;
    host.innerHTML = '';
    const node = document.createElement('div');
    const opts = {
      text: url,
      width: size,
      height: size,
      colorDark: '#050010',
      colorLight: '#ffffff',
    };
    if (root.QRCode.CorrectLevel) opts.correctLevel = root.QRCode.CorrectLevel.H;
    new root.QRCode(node, opts);
    host.appendChild(node);
    return node;
  }

  function mount(options) {
    const opts = options || {};
    const url = pageUrl(opts.catalog);
    const size = Number(opts.size) || QR_SIZE;
    mountQr(opts.sticker, url, size);
    mountQr(opts.shirt, url, size);
    return { url, path: PAGE_PATH };
  }

  root.MhmLabMerch = {
    PAGE_PATH,
    DEFAULT_PUBLIC_ORIGIN,
    QR_SIZE,
    pageUrl,
    mount,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
