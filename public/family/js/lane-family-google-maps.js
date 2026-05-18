/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Loads Google Maps JavaScript API for Lane family pages (memorial wall, war history).
 * Geocoding stays on the server (/api/genealogy/geocode-address); this is display only.
 */
(function (global) {
  'use strict';

  const API_BASE = '/api/genealogy';
  let loadPromise = null;
  let loadState = 'idle'; // idle | ready | unavailable

  global.laneFamilyLoadGoogleMaps = async function laneFamilyLoadGoogleMaps() {
    if (global.google && global.google.maps) return true;
    if (loadState === 'unavailable') return false;

    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const res = await fetch(`${API_BASE}/google-api-key`);
          let data = {};
          try {
            data = await res.json();
          } catch (e) {
            global.__laneGoogleMapsUnavailableReason =
              'Could not read Google Maps settings from the server (non-JSON response). Check API routing in production.';
            loadState = 'unavailable';
            return false;
          }
          if (!res.ok) {
            global.__laneGoogleMapsUnavailableReason =
              data.error || `Google API key request failed (HTTP ${res.status}).`;
            loadState = 'unavailable';
            return false;
          }
          if (!data.success || !data.apiKey) {
            global.__laneGoogleMapsUnavailableReason =
              data.error ||
              'Google Maps API key not configured. Set GOOGLE_BROWSER_API_KEY or GOOGLE_API_KEY on the server.';
            loadState = 'unavailable';
            return false;
          }
          if (global.google && global.google.maps) {
            loadState = 'ready';
            return true;
          }

          const key = encodeURIComponent(data.apiKey);
          const ok = await new Promise((resolve) => {
            const cbName =
              '_laneGmCb_' +
              Date.now().toString(36) +
              Math.random().toString(36).slice(2, 11);
            global[cbName] = function () {
              try {
                delete global[cbName];
              } catch (e) {
                global[cbName] = undefined;
              }
              loadState = 'ready';
              resolve(true);
            };
            const script = document.createElement('script');
            script.async = true;
            script.defer = true;
            script.onerror = function () {
              try {
                delete global[cbName];
              } catch (e) {
                /* ignore */
              }
              global.__laneGoogleMapsUnavailableReason =
                'Google Maps script failed to load (network, CSP, or API key referrer restrictions).';
              loadState = 'unavailable';
              resolve(false);
            };
            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=${cbName}`;
            document.head.appendChild(script);
          });
          return ok && !!(global.google && global.google.maps);
        } catch (e) {
          global.__laneGoogleMapsUnavailableReason =
            e && e.message ? e.message : 'Google Maps could not be initialized.';
          loadState = 'unavailable';
          return false;
        }
      })();
    }

    const done = await loadPromise;
    return done === true && !!(global.google && global.google.maps);
  };
})(typeof window !== 'undefined' ? window : globalThis);
