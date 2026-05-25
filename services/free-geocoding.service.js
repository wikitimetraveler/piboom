/**
 * Development work by David Lane
 */
import axios from 'axios';

/**
 * Geocoding Service
 *
 * Primary: Mapbox Geocoding API (100k free/month, then $0.75/1k)
 * Fallback: OpenStreetMap Nominatim (free, 1 req/sec)
 * Last resort: geocode.maps.co (free)
 *
 * Set MAPBOX_ACCESS_TOKEN in .env for Mapbox. Without it, uses Nominatim.
 */

function getMapboxAccessToken() {
  return (process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_API_KEY || '').trim();
}

function normalizeCountyName(name) {
  if (!name) return null;
  return name.replace(/\s*County$/i, '').trim();
}

/** US state abbreviation → full name (for matching "KY" vs "Kentucky") */
const US_STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

function stateMatchesInAddress(expectedState, addressParts) {
  if (!expectedState || !addressParts) return false;
  const abbr = expectedState.toUpperCase().trim();
  const lower = addressParts.toLowerCase();
  if (new RegExp(`\\b${abbr}\\b`, 'i').test(addressParts)) return true;
  const fullName = US_STATE_NAMES[abbr];
  return fullName ? lower.includes(fullName.toLowerCase()) : false;
}

/** Infer ISO country code from address hints (for Mapbox/Nominatim country filter) */
function inferCountryFromAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const lower = address.toLowerCase();
  if (/\b(uk|united kingdom|england|scotland|wales|northern ireland)\b/.test(lower)) return 'gb';
  if (/\b(usa|united states|u\.?s\.?a?)\b/.test(lower)) return 'us';
  if (/\b(south korea|korea)\b/.test(lower)) return 'kr';
  if (/\bjapan\b/.test(lower)) return 'jp';
  if (/\bcanada\b/.test(lower)) return 'ca';
  if (/\baustralia\b/.test(lower)) return 'au';
  if (/\b(germany|deutschland)\b/.test(lower)) return 'de';
  if (/\bfrance\b/.test(lower)) return 'fr';
  if (/\bireland\b/.test(lower)) return 'ie';
  return null;
}

/** Cap "no results" warnings to avoid log spam */
const NO_RESULTS_WARN_LIMIT = 5;
let noResultsWarnCount = 0;

/** Nominatim rate limit: 1 request per second. Global lock for all Nominatim calls. */
let lastNominatimRequest = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

/** Log Mapbox token status once per process */
let mapboxTokenLogged = false;
let mapboxNoResultsCount = 0;
let mapboxReverse422Logged = false;
const MAPBOX_NO_RESULTS_LOG_MAX = 5;

async function waitForNominatimRateLimit() {
  const elapsed = Date.now() - lastNominatimRequest;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  lastNominatimRequest = Date.now();
}

function warnNoResults(address) {
  if (noResultsWarnCount < NO_RESULTS_WARN_LIMIT) {
    noResultsWarnCount += 1;
    console.warn(`⚠️  No geocoding results found for: ${address}`);
  } else if (noResultsWarnCount === NO_RESULTS_WARN_LIMIT) {
    noResultsWarnCount += 1;
    console.warn(`⚠️  (Further geocoding "no results" warnings suppressed)`);
  }
}

/** Extract state/county from Mapbox feature context array */
function extractFromMapboxContext(context = []) {
  let state = null;
  let county = null;
  for (const c of context) {
    const id = (c.id || '').toLowerCase();
    const shortCode = (c.short_code || '').toUpperCase();
    const text = (c.text || '').trim();
    if (id.includes('region') && shortCode.startsWith('US-')) {
      state = shortCode.replace('US-', '');
    }
    if (id.includes('district') || id.includes('county')) {
      county = normalizeCountyName(text) || text;
    }
  }
  return { state, county };
}

async function geocodeWithMapbox(address, expectedState, expectedCounty, options = {}) {
  const token = getMapboxAccessToken();
  if (!token || !address) {
    if (!token && !mapboxTokenLogged) {
      mapboxTokenLogged = true;
      console.log('📍 Mapbox skipped: MAPBOX_ACCESS_TOKEN (or MAPBOX_API_KEY) not set in .env');
    }
    return null;
  }

  const countryHint = inferCountryFromAddress(address);
  const params = {
    access_token: token,
    limit: 5,
    ...(options.omitTypes ? {} : { types: 'address,place,locality,region,district' })
  };
  if (countryHint) params.country = countryHint;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`;
    const response = await axios.get(url, {
      params,
      timeout: 10000
    });

    const features = response.data?.features || [];
    if (features.length === 0 && !options.omitTypes && /County,\s*[A-Z]{2}/i.test(address)) {
      // County-style query: retry without types filter (Mapbox may return region/district)
      return geocodeWithMapbox(address, expectedState, expectedCounty, { omitTypes: true });
    }
    if (features.length === 0) {
      if (mapboxNoResultsCount < MAPBOX_NO_RESULTS_LOG_MAX) {
        mapboxNoResultsCount++;
        console.log(`📍 Mapbox returned no results for: ${address}`);
      } else if (mapboxNoResultsCount === MAPBOX_NO_RESULTS_LOG_MAX) {
        mapboxNoResultsCount++;
        console.log(`📍 Mapbox: (further "no results" logs suppressed)`);
      }
      return null;
    }

    let fallbackResult = null;

    for (const f of features) {
      const coords = f.geometry?.coordinates || f.center;
      if (!coords || coords.length < 2) continue;

      const [lng, lat] = coords;
      const context = f.context || [];
      const { state, county } = extractFromMapboxContext(context);

      let stateMatches = true;
      let countyMatches = true;
      if (expectedState) {
        stateMatches = state?.toUpperCase() === expectedState.toUpperCase();
      }
      if (expectedCounty) {
        countyMatches = county
          ? county.toLowerCase() === expectedCounty.toLowerCase().replace(/\s*County$/i, '').trim()
          : false;
      }

      const result = {
        latitude: lat,
        longitude: lng,
        validated: stateMatches && countyMatches,
        display_name: f.place_name || f.text,
        source: 'mapbox'
      };

      if (!fallbackResult) fallbackResult = result;
      if (result.validated || (!expectedState && !expectedCounty)) {
        console.log(`✅ Mapbox geocoded: ${address} → ${result.latitude}, ${result.longitude}`);
        return result;
      }
    }

    if (fallbackResult) {
      console.log(`✅ Mapbox geocoded: ${address} → ${fallbackResult.latitude}, ${fallbackResult.longitude}`);
    }
    return fallbackResult;
  } catch (error) {
    console.warn('⚠️  Mapbox geocoding error:', error.message);
    return null;
  }
}

async function reverseGeocodeWithMapbox(lat, lng) {
  const token = getMapboxAccessToken();
  if (!token || !lat || !lng) return null;

  // Validate coordinates - Mapbox returns 422 for out-of-range values
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngNum},${latNum}.json`;
    const response = await axios.get(url, {
      params: {
        access_token: token
      },
      timeout: 10000
    });

    const features = response.data?.features || [];
    if (features.length === 0) return null;

    // Use first feature; it has context with region (state) and district (county)
    const f = features[0];
    const context = f.context || [];
    const { state, county } = extractFromMapboxContext(context);

    console.log(`✅ Mapbox reverse geocoded: ${lat},${lng} → ${county || '?'}, ${state || '?'}`);
    return {
      county: county || null,
      state: state ? state.toUpperCase() : null,
      address: f.place_name || f.text || null,
      source: 'mapbox'
    };
  } catch (error) {
    const status = error.response?.status;
    if (status === 422 && !mapboxReverse422Logged) {
      mapboxReverse422Logged = true;
      console.log('📍 Mapbox reverse 422 (invalid coords or limit+types) - falling back to Nominatim');
    } else if (status !== 422) {
      console.warn('⚠️  Mapbox reverse geocoding error:', error.message);
    }
    return null;
  }
}

/**
 * Geocode an address using FREE OpenStreetMap Nominatim API
 * @param {string} address - Full address string
 * @param {string} expectedState - Expected state abbreviation (optional, for validation)
 * @param {string} expectedCounty - Expected county name (optional, for validation)
 * @returns {Promise<Object>} Object with latitude, longitude, and validation info
 */
export async function geocodeAddressFree(address, expectedState = null, expectedCounty = null) {
  // Primary: Mapbox Geocoding API (when MAPBOX_ACCESS_TOKEN is set)
  const mapboxResult = await geocodeWithMapbox(address, expectedState, expectedCounty);
  if (mapboxResult) {
    console.log(`✅ Mapbox geocoding succeeded for: ${address}`);
    return mapboxResult;
  }

  // Fallback: Nominatim (free) with rate limiting and 429 retry
  const countryHint = inferCountryFromAddress(address);
  const countryParam = countryHint ? `&countrycodes=${countryHint}` : '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5${countryParam}`;
  const retries = 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForNominatimRateLimit();

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DevConnectLabs-Research/1.0 (research project)' // Required by Nominatim
        }
      });

      if (response.status === 429 || response.status >= 500) {
        // On rate limit: try alternative service immediately (avoids more Nominatim hammering)
        const alt = await geocodeAddressAlternative(address);
        if (alt.latitude && alt.longitude) {
          return { latitude: alt.latitude, longitude: alt.longitude, validated: false };
        }
        if (attempt < retries) {
          const waitMs = (attempt + 1) * 3000;
          console.warn(`⚠️  Nominatim rate limited (${response.status}), retrying in ${waitMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        console.warn(`⚠️  Nominatim geocoding failed for: ${address} (Status: ${response.status})`);
        return { latitude: null, longitude: null, validated: false };
      }

      if (!response.ok) {
        console.warn(`⚠️  Nominatim geocoding failed for: ${address} (Status: ${response.status})`);
        return { latitude: null, longitude: null, validated: false };
      }

      const data = await response.json();
    
    if (!data || data.length === 0) {
      warnNoResults(address);
      return { latitude: null, longitude: null, validated: false };
    }
    
    // Try to find a result that matches expected state/county
    let bestResult = null;
    let validated = false;
    
    const isUsSearch = expectedState || countryHint === 'us';

    for (const result of data) {
      const addressParts = result.display_name || '';
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      if (isNaN(lat) || isNaN(lon)) continue;
      
      // When US-specific search, verify result is in US (Nominatim countrycodes helps but verify)
      if (isUsSearch) {
        const lower = addressParts.toLowerCase();
        if (!lower.includes('united states') && !lower.includes(', usa') && !lower.includes(', us')) {
          continue;
        }
      }
      
      // If no expected state, use first matching result
      if (!expectedState) {
        bestResult = { lat, lon, display_name: addressParts };
        validated = true;
        break;
      }
      
      // Check if state matches (abbreviation or full name, e.g. KY or Kentucky)
      const stateMatch = stateMatchesInAddress(expectedState, addressParts);
      if (stateMatch) {
        bestResult = { lat, lon, display_name: addressParts };
        validated = true;
        
        // If county provided, try to validate it
        if (expectedCounty) {
          const countyMatch = new RegExp(expectedCounty.replace(/\s+/g, '\\s+'), 'i').test(addressParts);
          if (countyMatch) {
            validated = true;
          } else {
            // County not found, but state matches - still valid
            validated = true;
          }
        }
        break;
      }
      
      // If no best result yet, save it as fallback
      if (!bestResult) {
        bestResult = { lat, lon, display_name: addressParts };
      }
    }
    
    if (!bestResult) {
      warnNoResults(address);
      return { latitude: null, longitude: null, validated: false };
    }
    
    // If expected state but no match found, warn but don't fail
    if (expectedState && !validated) {
      console.warn(`⚠️  Geocoding mismatch: Expected ${expectedState}, got result for: ${bestResult.display_name}`);
      // Still return the result, but mark as not validated
      return {
        latitude: bestResult.lat,
        longitude: bestResult.lon,
        validated: false,
        display_name: bestResult.display_name
      };
    }
    
    // Rate limiting - be respectful to Nominatim (1 req/sec max)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      latitude: bestResult.lat,
      longitude: bestResult.lon,
      validated: validated || !expectedState,
      display_name: bestResult.display_name
    };
    } catch (error) {
      console.error(`❌ Free geocoding error for ${address}:`, error.message);
      return { latitude: null, longitude: null, validated: false };
    }
  }
}

/**
 * Reverse geocode lat/lng to county and state using FREE API
 * @param {number} lat
 * @param {number} lng
 * @param {number} retries - Number of retry attempts (default: 2)
 * @returns {Promise<{county: string|null, state: string|null, address: string|null}>}
 */
export async function reverseGeocodeFree(lat, lng, retries = 2) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return { county: null, state: null, address: null };
  }

  const mapboxResult = await reverseGeocodeWithMapbox(lat, lng);
  if (mapboxResult) {
    return mapboxResult;
  }

  // Rate limiting - be respectful to Nominatim (1 req/sec)
  // Wait before attempting (helps with bulk operations)
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use Nominatim reverse geocoding - completely free
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DevConnectLabs-Research/1.0 (research project)' // Required by Nominatim
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // If rate limited (429) or server error (5xx), retry
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          const waitTime = (attempt + 1) * 2000; // Exponential backoff
          console.warn(`⚠️  Nominatim rate limited (Status: ${response.status}), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        // For other errors, try alternative service
        if (attempt === retries) {
          return await reverseGeocodeAlternative(lat, lng);
        }
        continue;
      }
      
      const data = await response.json();
      
      if (!data || !data.address) {
        // Try alternative if Nominatim returns no data
        if (attempt === retries) {
          return await reverseGeocodeAlternative(lat, lng);
        }
        continue;
      }
      
      const addr = data.address;
      
      // Extract county and state from Nominatim response
      // Nominatim uses different field names than Google
      const county = addr.county || addr.municipality || addr.city_district || null;
      const state = addr.state_code || addr.state || null;
      const address = data.display_name || null;
      
      // Clean county name (remove "County" suffix)
      const cleanCounty = county ? county.replace(/\s*County$/i, '').trim() : null;
      
      return {
        county: cleanCounty,
        state: state ? state.toUpperCase() : null,
        address: address
      };
    } catch (error) {
      // Handle timeout, network errors, etc.
      if (error.name === 'AbortError') {
        console.warn(`⚠️  Reverse geocoding timeout for ${lat},${lng}`);
      } else if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        // Network error - try alternative service on last attempt
        if (attempt === retries) {
          console.warn(`⚠️  Nominatim network error, trying alternative service...`);
          return await reverseGeocodeAlternative(lat, lng);
        }
        // Retry with exponential backoff
        const waitTime = (attempt + 1) * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else {
        // Other errors - log and return null
        if (attempt === retries) {
          console.warn(`⚠️  Reverse geocoding error after ${retries + 1} attempts:`, error.message);
        }
      }
    }
  }
  
  return { county: null, state: null, address: null };
}

/**
 * Geocode a county/state location using FREE API
 * @param {string} county - County name
 * @param {string} state - State abbreviation
 * @returns {Promise<Object>} Object with latitude and longitude
 */
export async function geocodeCountyStateFree(county, state) {
  const address = `${county} County, ${state}, USA`;
  const result = await geocodeAddressFree(address, state, county);
  return {
    latitude: result.latitude,
    longitude: result.longitude
  };
}

/**
 * Alternative: Use geocode.maps.co (also free, no API key)
 * @param {string} address - Full address string
 * @returns {Promise<Object>} Object with latitude and longitude
 */
export async function geocodeAddressAlternative(address) {
  try {
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&api_key=`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return { latitude: null, longitude: null };
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return { latitude: null, longitude: null };
    }
    
    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name
    };
  } catch (error) {
    console.error(`❌ Alternative geocoding error:`, error.message);
    return { latitude: null, longitude: null };
  }
}

/**
 * Alternative reverse geocoding using geocode.maps.co
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{county: string|null, state: string|null, address: string|null}>}
 */
export async function reverseGeocodeAlternative(lat, lng) {
  try {
    const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}`;
    
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { county: null, state: null, address: null };
    }
    
    const data = await response.json();
    
    if (!data || !data.address) {
      return { county: null, state: null, address: null };
    }
    
    const addr = data.address;
    const county = addr.county ? addr.county.replace(/\s*County$/i, '').trim() : null;
    const state = addr.state_code || addr.state || null;
    const address = data.display_name || addr.formatted || null;
    
    return {
      county: county,
      state: state ? state.toUpperCase() : null,
      address: address
    };
  } catch (error) {
    // Silently fail - this is a fallback
    return { county: null, state: null, address: null };
  }
}

export default {
  geocodeAddressFree,
  reverseGeocodeFree,
  geocodeCountyStateFree,
  geocodeAddressAlternative,
  reverseGeocodeAlternative
};

