import axios from 'axios';
import { getGoogleServerApiKey } from '../lib/google-api-key.js';

/**
 * Geocoding Service
 * 
 * Primary: Google Geocoding API (server key)
 * Fallback: OpenStreetMap Nominatim (free) to avoid downtime
 * 
 * Rate limits:
 * - Google Geocoding: per Google quotas
 * - Nominatim: 1 request per second (only used as fallback)
 * 
 * Alternative Free providers included for last-resort fallback.
 */

function extractComponent(components = [], type) {
  return components.find(c => c.types.includes(type));
}

function normalizeCountyName(name) {
  if (!name) return null;
  return name.replace(/\s*County$/i, '').trim();
}

async function geocodeWithGoogle(address, expectedState, expectedCounty) {
  const apiKey = getGoogleServerApiKey();
  if (!apiKey || !address) return null;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: apiKey,
        region: 'us',
        components: 'country:US'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      return null;
    }

    const candidates = response.data.results;
    let fallbackResult = null;

    for (const candidate of candidates) {
      const geometry = candidate.geometry?.location;
      if (!geometry) continue;

      const state = extractComponent(candidate.address_components, 'administrative_area_level_1')?.short_name;
      const county = normalizeCountyName(
        extractComponent(candidate.address_components, 'administrative_area_level_2')?.long_name
      );

      let stateMatches = true;
      let countyMatches = true;

      if (expectedState) {
        stateMatches = state?.toUpperCase() === expectedState.toUpperCase();
      }

      if (expectedCounty) {
        if (county) {
          countyMatches = county.toLowerCase() === expectedCounty.toLowerCase();
        } else {
          countyMatches = false;
        }
      }

      const resultPayload = {
        latitude: geometry.lat,
        longitude: geometry.lng,
        validated: stateMatches && countyMatches,
        display_name: candidate.formatted_address,
        placeId: candidate.place_id,
        source: 'google',
        address_components: candidate.address_components
      };

      if (!fallbackResult) {
        fallbackResult = resultPayload;
      }

      if (resultPayload.validated || (!expectedState && !expectedCounty)) {
        return resultPayload;
      }
    }

    return fallbackResult;
  } catch (error) {
    console.warn('⚠️  Google geocoding error:', error.message);
    return null;
  }
}

async function reverseGeocodeWithGoogle(lat, lng) {
  const apiKey = getGoogleServerApiKey();
  if (!apiKey || !lat || !lng) return null;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key: apiKey,
        result_type: 'administrative_area_level_2|administrative_area_level_1|locality',
        location_type: 'APPROXIMATE'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      return null;
    }

    const result = response.data.results[0];
    const county = normalizeCountyName(
      extractComponent(result.address_components, 'administrative_area_level_2')?.long_name
    );
    const state = extractComponent(result.address_components, 'administrative_area_level_1')?.short_name;

    return {
      county: county || null,
      state: state ? state.toUpperCase() : null,
      address: result.formatted_address,
      source: 'google'
    };
  } catch (error) {
    console.warn('⚠️  Google reverse geocoding error:', error.message);
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
  // Primary: Google Geocoding API
  const googleResult = await geocodeWithGoogle(address, expectedState, expectedCounty);
  if (googleResult) {
    return googleResult;
  }

  // Fallback: Nominatim (free)
  try {
    // Use Nominatim - completely free, no API key needed
    // Rate limit: 1 request per second (be respectful!)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&countrycodes=us`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevConnectLabs-Research/1.0 (research project)' // Required by Nominatim
      }
    });
    
    if (!response.ok) {
      console.warn(`⚠️  Nominatim geocoding failed for: ${address} (Status: ${response.status})`);
      return { latitude: null, longitude: null, validated: false };
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.warn(`⚠️  No geocoding results found for: ${address}`);
      return { latitude: null, longitude: null, validated: false };
    }
    
    // Try to find a result that matches expected state/county
    let bestResult = null;
    let validated = false;
    
    for (const result of data) {
      const addressParts = result.display_name || '';
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      if (isNaN(lat) || isNaN(lon)) continue;
      
      // Check if it's in the US (Nominatim countrycodes filter helps, but verify)
      if (!addressParts.toLowerCase().includes('united states') && 
          !addressParts.toLowerCase().includes(', usa') &&
          !addressParts.toLowerCase().includes(', us')) {
        continue;
      }
      
      // If no expected state, use first US result
      if (!expectedState) {
        bestResult = { lat, lon, display_name: addressParts };
        validated = true;
        break;
      }
      
      // Check if state matches
      const stateMatch = new RegExp(`\\b${expectedState}\\b`, 'i').test(addressParts);
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
      console.warn(`⚠️  No valid geocoding result found for: ${address}`);
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

  const googleResult = await reverseGeocodeWithGoogle(lat, lng);
  if (googleResult) {
    return googleResult;
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

