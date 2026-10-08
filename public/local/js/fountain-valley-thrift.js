/**
 * Thrift stores within 30 miles of Fountain Valley — list plus map on Local Spots.
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  var HOME = { name: 'Fountain Valley', lat: 33.7095, lng: -117.9537 };
  var RADIUS_MILES = 30;
  var RADIUS_M = 48280;
  var EARTH_MILES = 3958.7613;
  var SKIP_NAME = /dispensary|cannabis|smoke shop|\bvape\b|liquor store/i;
  var THRIFT_NAME = /thrift|goodwill|savers|resale|consignment|\bvintage\b|closet|re-?store|buffalo exchange|crossroads|value village|deseret|amvets|vincent de paul|assistance league|discovery shop|donation center|2nd\s|uptown cheapskate|habitat|plato|out of the closet|\bsecond (impressions|tyme|time|hand)/i;
  var NOT_A_SHOP = /\b(church|chapel|emergency shelter|rehabilitation center|red shield|town center|wholesale|auction)\b/i;

  var SWEEPS = [
    { keyword: 'thrift store', northMi: 0, eastMi: 0, radiusM: RADIUS_M, pages: 3 },
    { keyword: 'thrift store', northMi: 11, eastMi: 0, radiusM: 16000, pages: 2 },
    { keyword: 'thrift store', northMi: -8, eastMi: 2, radiusM: 14000, pages: 2 },
    { keyword: 'thrift store', northMi: 2, eastMi: 12, radiusM: 14000, pages: 2 },
    { keyword: 'thrift store', northMi: 1, eastMi: -12, radiusM: 14000, pages: 2 },
    { keyword: 'thrift store', northMi: 16, eastMi: 8, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: 14, eastMi: -12, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: -10, eastMi: 14, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: 10, eastMi: 20, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: 22, eastMi: -4, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: 12, eastMi: -20, radiusM: 14000, pages: 1 },
    { keyword: 'thrift store', northMi: -4, eastMi: -16, radiusM: 12000, pages: 1 },
    { keyword: 'goodwill', northMi: 0, eastMi: 0, radiusM: RADIUS_M, pages: 2 },
    { keyword: 'salvation army', northMi: 0, eastMi: 0, radiusM: RADIUS_M, pages: 1 },
    { keyword: 'savers', northMi: 0, eastMi: 0, radiusM: RADIUS_M, pages: 1 },
    { keyword: 'out of the closet', northMi: 0, eastMi: 0, radiusM: RADIUS_M, pages: 1 },
  ];

  var osmStores = [];
  var googleStores = [];
  var stores = [];
  var map = null;
  var markers = new Map();
  var homeMarker = null;
  var infoWindow = null;
  var activeId = '';
  var searching = false;
  var limited = false;
  var listBound = false;
  var attributions = [];
  var drawToken = 0;

  function milesBetween(aLat, aLng, bLat, bLng) {
    var toRad = function (deg) { return (deg * Math.PI) / 180; };
    var dLat = toRad(bLat - aLat);
    var dLng = toRad(bLng - aLng);
    var s1 = Math.sin(dLat / 2);
    var s2 = Math.sin(dLng / 2);
    var h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
    return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function offset(northMi, eastMi) {
    return {
      lat: HOME.lat + northMi / 69,
      lng: HOME.lng + eastMi / (69 * Math.cos(HOME.lat * Math.PI / 180)),
    };
  }

  function nameKey(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function isSame(a, b) {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;
    if (milesBetween(a.lat, a.lng, b.lat, b.lng) > 0.2) return false;
    var na = nameKey(a.name);
    var nb = nameKey(b.name);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  function esc(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(text) {
    var el = document.getElementById('fvThriftStatus');
    if (el) el.textContent = text;
  }

  function statusLine() {
    var n = stores.length;
    var noun = n === 1 ? 'thrift store' : 'thrift stores';
    var base = n + ' ' + noun + ' within 30 miles of Fountain Valley';
    if (searching) return 'Searching… ' + base + '.';
    if (limited) return base + '. Google Places paused early — this is the list so far.';
    if (!n) return 'No thrift stores found within 30 miles of Fountain Valley.';
    return base + '.';
  }

  function mergeAndSort() {
    var out = googleStores.slice();
    osmStores.forEach(function (shop) {
      if (!out.some(function (existing) { return isSame(existing, shop); })) out.push(shop);
    });
    out.sort(function (a, b) { return a.miles - b.miles || a.name.localeCompare(b.name); });
    stores = out;
  }

  function dirUrl(store) {
    return 'https://www.google.com/maps/dir/?api=1&origin=' + HOME.lat + ',' + HOME.lng +
      '&destination=' + store.lat + ',' + store.lng;
  }

  function renderList() {
    var list = document.getElementById('fvThriftList');
    if (!list) return;
    var top = list.scrollTop;
    if (!stores.length) {
      list.innerHTML = '<p class="text-muted small p-3 mb-0">No thrift stores in the list yet.</p>';
    } else {
      list.innerHTML = stores.map(function (store) {
        var miles = store.miles.toFixed(1) + ' mi';
        return (
          '<div class="fv-thrift-row' + (store.id === activeId ? ' is-on' : '') + '" data-id="' + esc(store.id) + '" role="listitem">' +
            '<button type="button" class="fv-thrift-focus">' +
              '<strong>' + esc(store.name) + '</strong>' +
              '<small>' + esc(miles) + (store.address ? ' · ' + esc(store.address) : '') + '</small>' +
            '</button>' +
            '<a href="' + esc(dirUrl(store)) + '" target="_blank" rel="noreferrer">Directions</a>' +
          '</div>'
        );
      }).join('');
    }
    list.scrollTop = top;
    var attrib = document.getElementById('fvThriftAttrib');
    if (attrib) attrib.innerHTML = attributions.join(' ');
    setStatus(statusLine());
  }

  function markerHelpers() {
    return global.googleAdvancedMarkers || null;
  }

  function openInfo(store) {
    if (!map || !store) return;
    var helpers = markerHelpers();
    var marker = markers.get(store.id);
    var html = '<div style="max-width:240px"><strong>' + esc(store.name) + '</strong><br>' +
      esc(store.miles.toFixed(1)) + ' mi from Fountain Valley' +
      (store.address ? '<br>' + esc(store.address) : '') +
      '<br><a href="' + esc(dirUrl(store)) + '" target="_blank" rel="noreferrer">Directions</a></div>';
    if (!infoWindow) infoWindow = new google.maps.InfoWindow();
    infoWindow.setContent(html);
    if (helpers && marker) helpers.openMapInfoWindow(infoWindow, map, marker);
    else infoWindow.open({ map: map });
  }

  function focusStore(id) {
    var store = stores.find(function (s) { return s.id === id; });
    if (!store) return;
    activeId = id;
    renderList();
    var safeId = global.CSS && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '');
    var row = document.querySelector('.fv-thrift-row[data-id="' + safeId + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
    if (map) {
      map.panTo({ lat: store.lat, lng: store.lng });
      if (map.getZoom() < 13) map.setZoom(13);
      openInfo(store);
    }
  }

  function fitAll() {
    if (!map) return;
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(HOME);
    stores.forEach(function (store) { bounds.extend({ lat: store.lat, lng: store.lng }); });
    map.fitBounds(bounds, 48);
  }

  function clearMarkers() {
    var helpers = markerHelpers();
    markers.forEach(function (marker) {
      if (helpers) helpers.removeMapMarker(marker);
      else if (marker.map) marker.map = null;
    });
    markers.clear();
    if (homeMarker) {
      if (helpers) helpers.removeMapMarker(homeMarker);
      else if (homeMarker.map) homeMarker.map = null;
      homeMarker = null;
    }
  }

  async function drawMarkers() {
    if (!map) return;
    var token = ++drawToken;
    var helpers = markerHelpers();
    if (helpers) await helpers.ensureMarkerLibrary();
    if (token !== drawToken || !map) return;
    clearMarkers();
    if (helpers) {
      homeMarker = helpers.createMapMarker({
        map: map,
        position: HOME,
        title: 'Fountain Valley',
        content: helpers.createPinContent({ color: '#4a90a4', label: 'FV' }),
        zIndex: 10,
      });
    }
    stores.forEach(function (store) {
      if (!helpers) return;
      var marker = helpers.createMapMarker({
        map: map,
        position: { lat: store.lat, lng: store.lng },
        title: store.name,
        content: helpers.createPinContent({ color: '#c45c26', label: '' }),
      });
      markers.set(store.id, marker);
      helpers.onMapMarkerClick(marker, function () { focusStore(store.id); });
    });
    if (!activeId) fitAll();
  }

  function render() {
    mergeAndSort();
    renderList();
    drawMarkers();
  }

  function fromGoogleResult(place) {
    var loc = place.geometry && place.geometry.location;
    if (!loc) return null;
    var lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
    var lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
    var name = place.name || '';
    if (!name || SKIP_NAME.test(name) || !THRIFT_NAME.test(name)) return null;
    if (NOT_A_SHOP.test(name) && !/thrift|resale|goodwill|savers|donation center/i.test(name)) return null;
    var types = place.types || [];
    if (!/thrift|resale|goodwill|savers|donation/i.test(name)) {
      var blocked = ['church', 'place_of_worship', 'shopping_mall', 'lodging', 'school', 'hospital'];
      if (types.some(function (type) { return blocked.indexOf(type) !== -1; })) return null;
    }
    var miles = milesBetween(HOME.lat, HOME.lng, lat, lng);
    if (miles > RADIUS_MILES + 0.25) return null;
    return {
      id: place.place_id || nameKey(name) + '@' + lat.toFixed(4),
      name: name,
      address: place.vicinity || place.formatted_address || '',
      lat: lat,
      lng: lng,
      miles: Math.round(miles * 10) / 10,
      source: 'google',
    };
  }

  function absorbGoogle(results) {
    (results || []).forEach(function (place) {
      (place.html_attributions || []).forEach(function (html) {
        if (attributions.indexOf(html) === -1) attributions.push(html);
      });
      var store = fromGoogleResult(place);
      if (!store) return;
      if (googleStores.some(function (existing) { return isSame(existing, store); })) return;
      googleStores.push(store);
    });
    render();
  }

  function nearbySearch(service, request, maxPages) {
    return new Promise(function (resolve) {
      var acc = [];
      var pages = 0;
      var done = false;
      function finish(hitLimit) {
        if (done) return;
        done = true;
        resolve({ results: acc, limited: !!hitLimit });
      }
      var timer = setTimeout(function () { finish(false); }, 20000);
      function handle(results, status, pagination) {
        pages += 1;
        var code = status;
        var ok = code === 'OK' || (google.maps.places && code === google.maps.places.PlacesServiceStatus.OK);
        var limit = code === 'OVER_QUERY_LIMIT' ||
          (google.maps.places && code === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT);
        if (ok && results) acc.push.apply(acc, results);
        if (limit) {
          clearTimeout(timer);
          finish(true);
          return;
        }
        if (pagination && pagination.hasNextPage && pages < maxPages) {
          setTimeout(function () { pagination.nextPage(); }, 2100);
        } else {
          clearTimeout(timer);
          finish(false);
        }
      }
      service.nearbySearch(request, handle);
    });
  }

  async function runSweeps() {
    searching = true;
    setStatus(statusLine());
    var service = new google.maps.places.PlacesService(map);
    for (var i = 0; i < SWEEPS.length; i++) {
      var sweep = SWEEPS[i];
      var center = offset(sweep.northMi, sweep.eastMi);
      var batch;
      try {
        batch = await nearbySearch(service, {
          location: center,
          radius: sweep.radiusM,
          keyword: sweep.keyword,
        }, sweep.pages);
      } catch (_) {
        batch = { results: [], limited: false };
      }
      absorbGoogle(batch.results);
      if (batch.limited) {
        limited = true;
        break;
      }
    }
    searching = false;
    render();
  }

  function ensureMap() {
    if (map || !global.google?.maps) return;
    var el = document.getElementById('fvThriftMap');
    if (!el) return;
    var helpers = markerHelpers();
    map = new google.maps.Map(el, {
      center: HOME,
      zoom: 10,
      mapId: helpers ? helpers.DEFAULT_MAP_ID : 'DEMO_MAP_ID',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    new google.maps.Circle({
      map: map,
      center: HOME,
      radius: RADIUS_M,
      strokeColor: '#4a90a4',
      strokeOpacity: 0.8,
      strokeWeight: 1,
      fillColor: '#4a90a4',
      fillOpacity: 0.05,
      clickable: false,
    });
  }

  function bindList() {
    if (listBound) return;
    var list = document.getElementById('fvThriftList');
    if (!list) return;
    listBound = true;
    list.addEventListener('click', function (event) {
      if (event.target.closest('a')) return;
      var row = event.target.closest('.fv-thrift-row');
      if (!row) return;
      focusStore(row.getAttribute('data-id'));
    });
    var fit = document.getElementById('fvThriftFit');
    if (fit) fit.addEventListener('click', fitAll);
    window.addEventListener('resize', function () {
      if (!map || !global.google?.maps?.event) return;
      google.maps.event.trigger(map, 'resize');
      if (!activeId) fitAll();
    });
  }

  function boot() {
    bindList();
    setStatus('Loading thrift stores within 30 miles of Fountain Valley…');
    fetch('/api/local-spots/thrift-near')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        osmStores = (data && data.stores) || [];
        render();
      })
      .catch(function () { render(); });
  }

  function onMapsReady() {
    bindList();
    ensureMap();
    if (!map || !google.maps.places) {
      setStatus('Map library did not load. The list still fills in when Places is available.');
      return;
    }
    render();
    runSweeps();
  }

  global.FountainValleyThrift = { boot: boot, onMapsReady: onMapsReady };
})(window);
