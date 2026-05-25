/**
 * Address + radius search for Hazard Webcams catalog page.
 */
(function (global) {
  'use strict';

  let autocomplete = null;
  let state = { active: false, lat: null, lng: null, label: '' };

  function readUrlParams() {
    const params = new URLSearchParams(global.location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const radius = parseFloat(params.get('radius'));
    const address = params.get('address') || '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      radiusMiles: Number.isFinite(radius) && radius >= 1 ? radius : 50,
      label: address
    };
  }

  function writeUrlParams(geo, radiusMiles) {
    const url = new URL(global.location.href);
    if (geo && geo.active && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      url.searchParams.set('lat', String(geo.lat));
      url.searchParams.set('lng', String(geo.lng));
      url.searchParams.set('radius', String(radiusMiles ?? 50));
      if (geo.label) url.searchParams.set('address', geo.label);
    } else {
      url.searchParams.delete('lat');
      url.searchParams.delete('lng');
      url.searchParams.delete('radius');
      url.searchParams.delete('address');
    }
    global.history.replaceState({}, '', url);
  }

  function getState() {
    return { ...state };
  }

  function setGeo(lat, lng, label) {
    state = {
      active: true,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      label: String(label || '').trim()
    };
    return getState();
  }

  function clearGeo() {
    state = { active: false, lat: null, lng: null, label: '' };
    const input = document.getElementById('hwAddressInput');
    if (input) input.value = '';
    return getState();
  }

  function applyRadiusFromUrl(fromUrl, radiusSelectId, radiusCustomId, radiusCustomWrapId) {
    if (!fromUrl?.radiusMiles) return;
    const radiusSelect = document.getElementById(radiusSelectId);
    if (!radiusSelect) return;
    const presets = [10, 25, 50, 100, 250];
    if (presets.includes(fromUrl.radiusMiles)) {
      radiusSelect.value = String(fromUrl.radiusMiles);
    } else {
      radiusSelect.value = 'custom';
      const custom = document.getElementById(radiusCustomId);
      if (custom) custom.value = String(fromUrl.radiusMiles);
    }
    if (global.DisasterLoanFilters) {
      global.DisasterLoanFilters.syncRadiusCustomVisibility(radiusSelectId, radiusCustomWrapId);
    }
  }

  function geocodeWithGoogle(address) {
    return new Promise((resolve, reject) => {
      if (!global.google?.maps?.Geocoder) {
        reject(new Error('Geocoder unavailable'));
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: String(address).trim(), componentRestrictions: { country: 'us' } },
        (results, status) => {
          if (status !== 'OK' || !results?.[0]?.geometry?.location) {
            reject(new Error('Address not found'));
            return;
          }
          const loc = results[0].geometry.location;
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            label: results[0].formatted_address || address
          });
        }
      );
    });
  }

  async function geocodeWithServer(address) {
    const resp = await fetch('/api/disasters/geocode-address?q=' + encodeURIComponent(String(address).trim()));
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Address not found');
    }
    return {
      lat: json.latitude,
      lng: json.longitude,
      label: json.label || address
    };
  }

  async function geocodeAddress(address) {
    try {
      return await geocodeWithGoogle(address);
    } catch (_) {
      return geocodeWithServer(address);
    }
  }

  /**
   * @param {{ onSearch: Function, onClear: Function, radiusSelectId: string, radiusCustomId: string, radiusCustomWrapId: string }} options
   */
  function initAddressSearch(options) {
    const {
      onSearch,
      onClear,
      radiusSelectId = 'hwRadiusMiles',
      radiusCustomId = 'hwRadiusCustom',
      radiusCustomWrapId = 'hwRadiusCustomWrap'
    } = options || {};

    const input = document.getElementById('hwAddressInput');
    if (input && global.google?.maps?.places) {
      try {
        autocomplete = new google.maps.places.Autocomplete(input, {
          types: ['geocode'],
          componentRestrictions: { country: 'us' }
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place?.geometry?.location) return;
          const label = place.formatted_address || place.name || input.value;
          input.value = label;
          setGeo(place.geometry.location.lat(), place.geometry.location.lng(), label);
          if (typeof onSearch === 'function') onSearch(getState());
        });
      } catch (e) {
        console.warn('Places Autocomplete init failed:', e);
      }
    }

    if (global.DisasterLoanFilters) {
      global.DisasterLoanFilters.syncRadiusCustomVisibility(radiusSelectId, radiusCustomWrapId);
    }

    const fromUrl = readUrlParams();
    if (fromUrl && input) {
      input.value = fromUrl.label;
      setGeo(fromUrl.lat, fromUrl.lng, fromUrl.label);
      applyRadiusFromUrl(fromUrl, radiusSelectId, radiusCustomId, radiusCustomWrapId);
    }

    document.getElementById('hwSearchBtn')?.addEventListener('click', async () => {
      const address = (input?.value || '').trim();
      if (!address) return;
      const current = getState();
      if (current.active && current.label === address) {
        if (typeof onSearch === 'function') onSearch(current);
        return;
      }
      try {
        const result = await geocodeAddress(address);
        input.value = result.label;
        setGeo(result.lat, result.lng, result.label);
        if (typeof onSearch === 'function') onSearch(getState());
      } catch (e) {
        alert(e.message || 'Could not find that address.');
      }
    });

    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('hwSearchBtn')?.click();
      }
    });

    document.getElementById('hwClearAddressBtn')?.addEventListener('click', (event) => {
      event.preventDefault();
      clearGeo();
      writeUrlParams(null);
      if (typeof onClear === 'function') onClear();
    });

    document.getElementById(radiusSelectId)?.addEventListener('change', () => {
      if (global.DisasterLoanFilters) {
        global.DisasterLoanFilters.syncRadiusCustomVisibility(radiusSelectId, radiusCustomWrapId);
      }
      if (state.active && typeof onSearch === 'function') onSearch(getState());
    });

    document.getElementById(radiusCustomId)?.addEventListener('input', () => {
      if (state.active && typeof onSearch === 'function') onSearch(getState());
    });

    return fromUrl ? getState() : null;
  }

  global.HazardWebcamAddressSearch = {
    initAddressSearch,
    readUrlParams,
    writeUrlParams,
    getState,
    setGeo,
    clearGeo,
    geocodeAddress
  };
})(typeof window !== 'undefined' ? window : globalThis);
