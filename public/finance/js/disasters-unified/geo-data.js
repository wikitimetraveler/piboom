/**
 * Unified Disasters — US state/county geo helpers (Leaflet picker).
 */
(function (global) {
  'use strict';

  const GEO_BASE = '/finance/assets/geo';
  const COUNTIES_BASE = `${GEO_BASE}/counties`;

  /** Postal abbreviation → Census state FIPS */
  const ST_TO_FIPS = {
    AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11',
    FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21',
    LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30',
    NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
    OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
    VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', AS: '60', GU: '66', MP: '69',
    PR: '72', VI: '78',
  };

  const FIPS_TO_ST = Object.fromEntries(Object.entries(ST_TO_FIPS).map(([k, v]) => [v, k]));

  const STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
    LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', AS: 'American Samoa',
    GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
  };

  const geoCache = { statesTopo: null, statesGeo: null, countiesByState: {}, stateStats: null, countySummary: {} };

  function normalizeCountyName(name) {
    return String(name || '').replace(/\s+County$/i, '').trim();
  }

  function stateName(abbr) {
    return STATE_NAMES[String(abbr || '').toUpperCase()] || abbr || '';
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geo fetch failed: ${url} (${res.status})`);
    return res.json();
  }

  async function loadStatesTopo() {
    if (geoCache.statesTopo) return geoCache.statesTopo;
    geoCache.statesTopo = await fetchJson(`${GEO_BASE}/us-states.topojson`);
    return geoCache.statesTopo;
  }

  /** Prefer GeoJSON (no topojson-client required); fall back to TopoJSON conversion. */
  async function loadStatesGeoJson() {
    if (geoCache.statesGeo) return geoCache.statesGeo;
    try {
      geoCache.statesGeo = await fetchJson(`${GEO_BASE}/us-states.geojson`);
      return geoCache.statesGeo;
    } catch (geoErr) {
      console.warn('us-states.geojson unavailable, falling back to TopoJSON:', geoErr.message);
      const topo = await loadStatesTopo();
      const convert = global.topojson?.feature;
      if (!convert) throw new Error('topojson-client not loaded (needed for us-states.topojson fallback)');
      geoCache.statesGeo = convert(topo, topo.objects.states);
      return geoCache.statesGeo;
    }
  }

  async function loadStateCounties(stateAbbr) {
    const st = String(stateAbbr || '').toUpperCase();
    if (geoCache.countiesByState[st]) return geoCache.countiesByState[st];
    const data = await fetchJson(`${COUNTIES_BASE}/${st}.geojson`);
    geoCache.countiesByState[st] = data;
    return data;
  }

  async function loadStateEventStats() {
    if (geoCache.stateStats) return geoCache.stateStats;
    try {
      const res = await fetch('/api/disasters/stats');
      const json = await res.json();
      const map = {};
      (json.data?.byState || []).forEach((row) => {
        const key = String(row.state_abbr || '').toUpperCase();
        if (key) map[key] = Number(row.count) || 0;
      });
      geoCache.stateStats = map;
    } catch (e) {
      console.warn('State stats unavailable for choropleth:', e.message);
      geoCache.stateStats = {};
    }
    return geoCache.stateStats;
  }

  async function loadCountySummary(stateAbbr) {
    const st = String(stateAbbr || '').toUpperCase();
    if (geoCache.countySummary[st]) return geoCache.countySummary[st];
    try {
      const res = await fetch(`/api/disasters/county-summary?state=${encodeURIComponent(st)}`);
      const json = await res.json();
      const map = {};
      (json.data?.counties || []).forEach((row) => {
        const name = normalizeCountyName(row.county_name);
        if (name) map[name.toLowerCase()] = row;
      });
      geoCache.countySummary[st] = map;
    } catch (e) {
      console.warn('County summary unavailable:', e.message);
      geoCache.countySummary[st] = {};
    }
    return geoCache.countySummary[st];
  }

  /** Choropleth fill by event count (states or counties). */
  function heatColor(count, max) {
    if (!count || count <= 0) return '#e2e8f0';
    const t = Math.min(1, count / Math.max(max, 1));
    if (t < 0.33) return '#93c5fd';
    if (t < 0.66) return '#fbbf24';
    return '#ef4444';
  }

  function decorateStatesGeoJson(fc, stateStats) {
    const max = Math.max(1, ...Object.values(stateStats || {}));
    const out = {
      type: 'FeatureCollection',
      features: (fc.features || []).map((f) => {
        const fips = String(f.properties?.state_fips || f.id || '').padStart(2, '0');
        const abbr = f.properties?.state_abbr || FIPS_TO_ST[fips] || '';
        const count = abbr ? (stateStats[abbr] || 0) : 0;
        return {
          ...f,
          properties: {
            ...(f.properties || {}),
            state_fips: fips,
            state_abbr: abbr,
            state_name: stateName(abbr),
            event_count: count,
            fill: heatColor(count, max),
          },
        };
      }),
    };
    return out;
  }

  /** @deprecated Prefer loadStatesGeoJson + decorateStatesGeoJson */
  function statesGeoJson(statesTopo, stateStats) {
    const convert = global.topojson?.feature;
    if (!convert) throw new Error('topojson-client not loaded');
    return decorateStatesGeoJson(convert(statesTopo, statesTopo.objects.states), stateStats);
  }

  global.duGeoData = {
    ST_TO_FIPS,
    FIPS_TO_ST,
    STATE_NAMES,
    stateName,
    normalizeCountyName,
    loadStatesTopo,
    loadStatesGeoJson,
    loadStateCounties,
    loadStateEventStats,
    loadCountySummary,
    heatColor,
    decorateStatesGeoJson,
    statesGeoJson,
  };
})(typeof window !== 'undefined' ? window : globalThis);
