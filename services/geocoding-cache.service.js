/**
 * Geocoding Cache Service
 * 
 * Uses existing database records as a cache to minimize geocoding API calls.
 * Checks database for existing coordinates before making API requests.
 * 
 * Strategy:
 * 1. Check loans table for existing coordinates by address components
 * 2. Check venues table for existing coordinates
 * 3. Only geocode if no existing coordinates found
 * 4. Store results for future use
 */

import { getPool } from './database.service.js';
import { geocodeAddressFree, reverseGeocodeFree, geocodeCountyStateFree } from './free-geocoding.service.js';

/**
 * Normalize address for cache lookup (remove variations)
 */
function normalizeAddressForCache(address) {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

/**
 * Check if we already have coordinates for an address in loans table
 * @param {string} address - Full address string
 * @param {string} city - City name
 * @param {string} state - State abbreviation
 * @returns {Promise<{latitude: number|null, longitude: number|null}|null>}
 */
async function getCachedLoanCoordinates(address, city, state) {
  const pool = getPool();
  if (!pool) return null;
  
  try {
    // Normalize for comparison
    const normalizedAddress = normalizeAddressForCache(address);
    const normalizedCity = city?.toLowerCase().trim() || '';
    const normalizedState = state?.toUpperCase().trim() || '';
    
    // Try exact match first
    let result = await pool.query(`
      SELECT latitude, longitude 
      FROM loans 
      WHERE LOWER(property_address) = $1 
        AND LOWER(city) = $2 
        AND UPPER(state) = $3
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      LIMIT 1
    `, [normalizedAddress, normalizedCity, normalizedState]);
    
    if (result.rows.length > 0) {
      return {
        latitude: parseFloat(result.rows[0].latitude),
        longitude: parseFloat(result.rows[0].longitude)
      };
    }
    
    // Try city/state match (for county-level geocoding)
    if (normalizedCity && normalizedState) {
      result = await pool.query(`
        SELECT latitude, longitude 
        FROM loans 
        WHERE LOWER(city) = $1 
          AND UPPER(state) = $2
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
        LIMIT 1
      `, [normalizedCity, normalizedState]);
      
      if (result.rows.length > 0) {
        return {
          latitude: parseFloat(result.rows[0].latitude),
          longitude: parseFloat(result.rows[0].longitude)
        };
      }
    }
    
    return null;
  } catch (error) {
    // Silently fail - cache is optional
    return null;
  }
}

/**
 * Check if we already have coordinates for a venue
 * @param {string} venueName - Venue name
 * @param {string} city - City name
 * @param {string} state - State abbreviation
 * @returns {Promise<{latitude: number|null, longitude: number|null}|null>}
 */
async function getCachedVenueCoordinates(venueName, city, state) {
  const pool = getPool();
  if (!pool) return null;
  
  try {
    const normalizedVenue = normalizeAddressForCache(venueName);
    const normalizedCity = city?.toLowerCase().trim() || '';
    const normalizedState = state?.toUpperCase().trim() || '';
    
    // Check venues table
    let result = await pool.query(`
      SELECT latitude, longitude 
      FROM venues 
      WHERE LOWER(name) = $1 
        AND LOWER(city) = $2 
        AND UPPER(state) = $3
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      LIMIT 1
    `, [normalizedVenue, normalizedCity, normalizedState]);
    
    if (result.rows.length > 0) {
      return {
        latitude: parseFloat(result.rows[0].latitude),
        longitude: parseFloat(result.rows[0].longitude)
      };
    }
    
    // Check grateful_dead_shows table
    result = await pool.query(`
      SELECT latitude, longitude 
      FROM grateful_dead_shows 
      WHERE LOWER(venue_name) = $1 
        AND LOWER(city) = $2 
        AND UPPER(state) = $3
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      LIMIT 1
    `, [normalizedVenue, normalizedCity, normalizedState]);
    
    if (result.rows.length > 0) {
      return {
        latitude: parseFloat(result.rows[0].latitude),
        longitude: parseFloat(result.rows[0].longitude)
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if we already have coordinates for a county/state
 * @param {string} county - County name
 * @param {string} state - State abbreviation
 * @returns {Promise<{latitude: number|null, longitude: number|null}|null>}
 */
async function getCachedCountyStateCoordinates(county, state) {
  const pool = getPool();
  if (!pool) return null;
  
  try {
    const normalizedCounty = county?.toLowerCase().replace(/\s*county$/i, '').trim() || '';
    const normalizedState = state?.toUpperCase().trim() || '';
    
    // Check loans table for any loan in this county/state
    const result = await pool.query(`
      SELECT latitude, longitude 
      FROM loans 
      WHERE LOWER(REPLACE(county, ' County', '')) = $1 
        AND UPPER(state) = $2
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      LIMIT 1
    `, [normalizedCounty, normalizedState]);
    
    if (result.rows.length > 0) {
      return {
        latitude: parseFloat(result.rows[0].latitude),
        longitude: parseFloat(result.rows[0].longitude)
      };
    }
    
    // Check disasters table
    const disasterResult = await pool.query(`
      SELECT lat as latitude, lng as longitude 
      FROM disasters 
      WHERE LOWER(REPLACE(county_name, ' County', '')) = $1 
        AND UPPER(state_abbr) = $2
        AND lat IS NOT NULL 
        AND lng IS NOT NULL
      LIMIT 1
    `, [normalizedCounty, normalizedState]);
    
    if (disasterResult.rows.length > 0) {
      return {
        latitude: parseFloat(disasterResult.rows[0].latitude),
        longitude: parseFloat(disasterResult.rows[0].longitude)
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Geocode address with cache lookup
 * @param {string} address - Full address string
 * @param {string} expectedState - Expected state (optional)
 * @param {string} expectedCounty - Expected county (optional)
 * @param {string} city - City name (for cache lookup)
 * @returns {Promise<Object>} Coordinates with validation
 */
export async function geocodeAddressWithCache(address, expectedState = null, expectedCounty = null, city = null) {
  // Step 1: Check cache first (if we have address components)
  if (city && expectedState) {
    const cached = await getCachedLoanCoordinates(address, city, expectedState);
    if (cached && cached.latitude && cached.longitude) {
      console.log(`💾 Using cached coordinates for: ${address.substring(0, 50)}...`);
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        validated: true,
        cached: true
      };
    }
  }
  
  // Step 2: Geocode if not in cache
  const result = await geocodeAddressFree(address, expectedState, expectedCounty);
  
  return {
    ...result,
    cached: false
  };
}

/**
 * Geocode venue with cache lookup
 * @param {string} venueName - Venue name
 * @param {string} city - City name
 * @param {string} state - State abbreviation
 * @param {string} country - Country name
 * @returns {Promise<Object>} Coordinates
 */
export async function geocodeVenueWithCache(venueName, city, state, country) {
  // Step 1: Check cache first
  const cached = await getCachedVenueCoordinates(venueName, city, state);
  if (cached && cached.latitude && cached.longitude) {
    console.log(`💾 Using cached venue coordinates for: ${venueName}, ${city}, ${state}`);
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      cached: true
    };
  }
  
  // Step 2: Geocode if not in cache
  const address = [venueName, city, state, country].filter(Boolean).join(', ');
  const result = await geocodeAddressFree(address);
  
  return {
    ...result,
    cached: false
  };
}

/**
 * Geocode county/state with cache lookup
 * @param {string} county - County name
 * @param {string} state - State abbreviation
 * @returns {Promise<Object>} Coordinates
 */
export async function geocodeCountyStateWithCache(county, state) {
  // Step 1: Check cache first
  const cached = await getCachedCountyStateCoordinates(county, state);
  if (cached && cached.latitude && cached.longitude) {
    console.log(`💾 Using cached county coordinates for: ${county}, ${state}`);
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      cached: true
    };
  }
  
  // Step 2: Geocode if not in cache
  const result = await geocodeCountyStateFree(county, state);
  
  return {
    ...result,
    cached: false
  };
}

/**
 * Reverse geocode - uses cache if coordinates match existing records
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} County/state information
 */
export async function reverseGeocodeWithCache(lat, lng) {
  if (!lat || !lng) return { county: null, state: null, address: null };
  
  const pool = getPool();
  if (pool) {
    try {
      // Check if coordinates match any existing records (within 0.01 degree ~= 1km)
      const tolerance = 0.01;
      
      // Check loans table
      const loanResult = await pool.query(`
        SELECT county, state 
        FROM loans 
        WHERE ABS(latitude - $1) < $3 
          AND ABS(longitude - $2) < $3
          AND county IS NOT NULL 
          AND state IS NOT NULL
        LIMIT 1
      `, [lat, lng, tolerance]);
      
      if (loanResult.rows.length > 0) {
        return {
          county: loanResult.rows[0].county?.replace(/\s*County$/i, '').trim() || null,
          state: loanResult.rows[0].state || null,
          address: null,
          cached: true
        };
      }
      
      // Check disasters table
      const disasterResult = await pool.query(`
        SELECT county_name, state_abbr 
        FROM disasters 
        WHERE ABS(lat - $1) < $3 
          AND ABS(lng - $2) < $3
          AND county_name IS NOT NULL 
          AND state_abbr IS NOT NULL
        LIMIT 1
      `, [lat, lng, tolerance]);
      
      if (disasterResult.rows.length > 0) {
        return {
          county: disasterResult.rows[0].county_name?.replace(/\s*County$/i, '').trim() || null,
          state: disasterResult.rows[0].state_abbr || null,
          address: null,
          cached: true
        };
      }
    } catch (error) {
      // Fall through to API call
    }
  }
  
  // No cache hit - use API
  const result = await reverseGeocodeFree(lat, lng);
  return {
    ...result,
    cached: false
  };
}

export default {
  geocodeAddressWithCache,
  geocodeVenueWithCache,
  geocodeCountyStateWithCache,
  reverseGeocodeWithCache
};

