

/**
 * Disaster Risk Service
 * 
 * @file       disaster-risk.service.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Service module for disaster risk assessment, FEMA API integration, and
 * geographic risk visualization. Calculates disaster risk scores for loan
 * properties based on historical disaster data, generates KML files for
 * Google Earth visualization, and provides county-level risk assessment.
 * 
 * Features:
 * - FEMA API integration for disaster declarations
 * - Disaster risk scoring algorithm
 * - Reverse geocoding for county/state lookup
 * - KML file generation for Google Earth
 * - County-level disaster history analysis
 * - Loan risk assessment and scoring
 * - Geographic coordinate processing
 * 
 * Risk Assessment:
 * - Historical disaster frequency analysis
 * - Disaster severity weighting
 * - Time-based decay for older disasters
 * - County and state-level risk aggregation
 * - Loan property risk scoring
 * 
 * FEMA Integration:
 * - FEMA disaster declaration API
 * - Disaster type categorization
 * - Date range filtering
 * - Geographic region queries
 * 
 * KML Generation:
 * 
 * - Google Earth compatible format
 * - Coordinate plotting
 * - Disaster event markers
 * - Risk heat map visualization
 * 
 * Technical Implementation:
 * - PostgreSQL database integration
 * - Google Maps Geocoding API
 * - HTTP client for FEMA API
 * - XML/KML generation
 * - Coordinate transformation
 * 
 * Integration:
 * - Integrates with database.service.js for data persistence
 * - Uses loan-pipeline.service.js for loan risk updates
 * - FEMA public API endpoints
 * 
 * @dependencies
 * - database.service.js (getPool)
 * - loan-pipeline.service.js (getAllLoans, updateLoanRiskScore)
 * - Google Maps Geocoding API
 * - FEMA Disaster Declarations API
 * 
 * ==============================================================================
 */

import { getPool } from './database.service.js';
import { getAllLoans, updateLoanRiskScore } from './loan-pipeline.service.js';
import { calculateDistance } from './disasters.service.js';
import { geocodeAddressFree, reverseGeocodeFree, geocodeCountyStateFree } from './free-geocoding.service.js';
import { geocodeAddressWithCache, geocodeCountyStateWithCache, reverseGeocodeWithCache } from './geocoding-cache.service.js';

/**
 * Geocode an address using Google Maps API with validation
 * @param {string} address - Full address string
 * @param {string} expectedState - Expected state abbreviation (optional, for validation)
 * @param {string} expectedCounty - Expected county name (optional, for validation)
 * @returns {Promise<Object>} Object with latitude, longitude, and validation info
 */
async function geocodeAddressValidated(address, expectedState = null, expectedCounty = null) {
  // Using cache first, then FREE OpenStreetMap Nominatim API - minimal API calls!
  try {
    // Extract city from address for cache lookup
    const cityMatch = address.match(/,?\s*([^,]+),\s*([A-Z]{2})/i);
    const city = cityMatch ? cityMatch[1].trim() : null;
    
    const result = await geocodeAddressWithCache(address, expectedState, expectedCounty, city);
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      validated: result.validated
    };
  } catch (error) {
    console.error(`❌ Free geocoding error for ${address}:`, error.message);
    return { latitude: null, longitude: null, validated: false };
  }
  
  /* DISABLED - Original Google geocoding code (now using free service)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_API_KEY not set - skipping geocoding');
    return { latitude: null, longitude: null, validated: false };
  }

  try {
    // Always add "USA" to address to ensure we match FEMA data (US-only) and prevent wrong country matches
    // Remove zip code from address if present to avoid zip code mismatches
    const addressWithoutZip = address.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
    const addressWithCountry = addressWithoutZip.endsWith(', USA') || addressWithoutZip.endsWith(', US') 
      ? addressWithoutZip 
      : `${addressWithoutZip}, USA`;
    
    // Always use region=us and components=country:US to ensure US addresses only
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressWithCountry)}&key=${apiKey}&region=us&components=country:US`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      // Try to find a result that matches the expected state/county and is in the US
      let bestResult = null;
      let validated = false;
      
      for (const result of data.results) {
        const addressComponents = result.address_components || [];
        
        // First check: Must be in US (country component)
        const countryComp = addressComponents.find(c => c.types.includes('country'));
        const countryCode = countryComp ? countryComp.short_name : null;
        if (countryCode !== 'US') {
          continue; // Skip non-US results
        }
        
        // If we don't have a best result yet, use this one
        if (!bestResult) {
          bestResult = result;
        }
        
        const stateComp = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
        const stateShort = stateComp ? stateComp.short_name : null;
        
        if (expectedState && stateShort && stateShort.toUpperCase() === expectedState.toUpperCase()) {
          bestResult = result;
          validated = true;
          
          if (expectedCounty) {
            const countyComp = addressComponents.find(c => 
              c.types.includes('administrative_area_level_2')
            );
            if (countyComp) {
              const countyName = countyComp.long_name.replace(/\s*County$/i, '').trim();
              if (countyName.toLowerCase().includes(expectedCounty.toLowerCase()) ||
                  expectedCounty.toLowerCase().includes(countyName.toLowerCase())) {
                validated = true;
              } else {
                validated = false;
              }
            }
          }
          break;
        } else if (!expectedState) {
          // No expected state, but we have a US result - accept it
          validated = true;
          break;
        }
      }
      
      // If no US result found, reject
      if (!bestResult) {
        console.warn(`⚠️  No US geocoding result found for: ${address}`);
        return { latitude: null, longitude: null, validated: false };
      }
      
      // If no match found but we have expected state, reject the result
      if (expectedState && !validated) {
        const addressComponents = bestResult.address_components || [];
        const stateComp = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
        const actualState = stateComp ? stateComp.short_name : 'unknown';
        console.warn(`⚠️  Geocoding mismatch: Expected ${expectedState}, got ${actualState} for: ${address}`);
        console.warn(`   Rejecting this result to prevent incorrect mapping`);
        return { latitude: null, longitude: null, validated: false };
      }
      
      const location = bestResult.geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        validated: validated || !expectedState
      };
    } else {
      console.warn(`⚠️  Geocoding failed for: ${address} (Status: ${data.status})`);
      return { latitude: null, longitude: null, validated: false };
    }
  } catch (error) {
    console.error(`❌ Geocoding error for ${address}:`, error.message);
    return { latitude: null, longitude: null, validated: false };
  }
  */
}

/**
 * Geocode an address using Google Maps API
 * @param {string} address - Full address string
 * @returns {Promise<Object>} Object with latitude and longitude
 */
async function geocodeAddress(address) {
  // Using FREE OpenStreetMap Nominatim API - no charges!
  try {
    const result = await geocodeAddressFree(address);
    return {
      latitude: result.latitude,
      longitude: result.longitude
    };
  } catch (error) {
    console.error(`❌ Free geocoding error for ${address}:`, error.message);
    return { latitude: null, longitude: null };
  }
  
  /* DISABLED - Original Google geocoding code (now using free service)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_API_KEY not set - skipping geocoding');
    return { latitude: null, longitude: null };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } else {
      console.warn(`⚠️  Geocoding failed for: ${address}`);
      return { latitude: null, longitude: null };
    }
  } catch (error) {
    console.error(`❌ Geocoding error for ${address}:`, error.message);
    return { latitude: null, longitude: null };
  }
  */
}

/**
 * Geocode a county/state location
 * @param {string} county - County name
 * @param {string} state - State abbreviation
 * @returns {Promise<Object>} Object with latitude and longitude
 */
async function geocodeCountyState(county, state) {
  // Using cache first, then FREE OpenStreetMap Nominatim API - minimal API calls!
  return await geocodeCountyStateWithCache(county, state);
}

/**
 * Reverse geocode lat/lng to county and state
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{county: string|null, state: string|null}>}
 */
export async function reverseGeocodeCountyState(lat, lng) {
  // Using cache first, then FREE OpenStreetMap Nominatim API - minimal API calls!
  try {
    const result = await reverseGeocodeWithCache(lat, lng);
    return {
      county: result.county,
      state: result.state
    };
  } catch (error) {
    console.warn('⚠️  Free reverse geocoding error:', error.message);
    return { county: null, state: null };
  }
  
  /* DISABLED - Original Google reverse geocoding code (now using free service)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !lat || !lng) return { county: null, state: null };
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === 'OK' && data.results && data.results.length) {
      const components = data.results[0].address_components || [];
      const countyComp = components.find(c => c.types.includes('administrative_area_level_2'));
      const stateComp = components.find(c => c.types.includes('administrative_area_level_1'));
      const county = countyComp ? countyComp.long_name.replace(/\s*County$/i, '') : null;
      const state = stateComp ? stateComp.short_name : null;
      return { county, state };
    }
  } catch (e) {
    console.warn('⚠️  reverseGeocodeCountyState error:', e.message);
  }
  return { county: null, state: null };
  */
}

function normalizeCountyName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();
  name = name.replace(/\s*\(County\)$/i, '');
  // If pattern like "Some County", strip trailing word County
  const m = name.match(/(.+?)\s+County$/i);
  if (m && m[1]) return m[1].trim();
  return name;
}

function parseCountyFromTitle(title) {
  if (!title) return '';
  // Try patterns like "... in Harris County" or "Harris County ..."
  const inMatch = title.match(/in\s+([A-Za-z\s]+?)\s+County/i);
  if (inMatch && inMatch[1]) return normalizeCountyName(inMatch[1]);
  const anyCounty = title.match(/([A-Za-z\s]+)\s+County/i);
  if (anyCounty && anyCounty[1]) return normalizeCountyName(anyCounty[1]);
  return '';
}

/**
 * Analyze disaster risk for a single loan using FEMA API
 * @param {Object} loan - Loan object with location data
 * @returns {Promise<Object>} Risk analysis result
 */
export async function analyzeLoanRisk(loan) {
  try {
    console.log(`🔍 Analyzing risk for loan ${loan.loan_number} in ${loan.city}, ${loan.state}`);

    // Using FREE geocoding - OpenStreetMap Nominatim (no charges!)
    if (!loan.latitude || !loan.longitude) {
      console.log(`🌍 Geocoding loan ${loan.loan_number} using FREE service...`);
      const fullAddress = `${loan.property_address}, ${loan.city}, ${loan.state} ${loan.zip_code || ''}`;
      const coords = await geocodeAddressValidated(fullAddress, loan.state, loan.county);
      if (coords.latitude && coords.longitude) {
        const pool = getPool();
        if (pool) {
          await pool.query(
            'UPDATE loans SET latitude = $1, longitude = $2 WHERE id = $3',
            [coords.latitude, coords.longitude, loan.id]
          );
          loan.latitude = coords.latitude;
          loan.longitude = coords.longitude;
        }
      }
    }

    // Query FEMA API for disaster declarations (last year only, with geocoding)
    const femaData = await queryFEMAApi(loan.state, loan.county);
    
    // Calculate distances to disasters if loan has coordinates
    let disastersWithDistance = femaData.disasters || [];
    if (loan.latitude && loan.longitude) {
      disastersWithDistance = disastersWithDistance.map(disaster => {
        let distanceKm = null;
        if (disaster.latitude && disaster.longitude) {
          distanceKm = calculateDistance(
            parseFloat(loan.latitude),
            parseFloat(loan.longitude),
            parseFloat(disaster.latitude),
            parseFloat(disaster.longitude)
          );
        }
        return {
          ...disaster,
          distanceKm: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null, // Round to 2 decimals
          distanceMiles: distanceKm !== null ? Math.round((distanceKm * 0.621371) * 100) / 100 : null // Convert to miles
        };
      });
      
      // Sort by distance (closest first)
      disastersWithDistance.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    
    // Get flood zone data if not already loaded - query and store it
    let floodZoneData = null;
    if (!loan.flood_zone && loan.latitude && loan.longitude) {
      try {
        // Query flood zone data
        floodZoneData = await queryFloodZoneForPoint(
          parseFloat(loan.latitude),
          parseFloat(loan.longitude)
        );
        
        // Store flood zone data (even if null/not found, record the check)
        await updateLoanFloodZone(loan, floodZoneData);
        
        // Update loan object for risk calculation
        if (floodZoneData) {
          loan.flood_zone = floodZoneData.floodZone;
          loan.flood_zone_type = floodZoneData.zoneType;
        }
      } catch (error) {
        console.warn(`⚠️  Could not query/store flood zone for loan ${loan.loan_number}:`, error.message);
        // Still record that we attempted the check
        try {
          await updateLoanFloodZone(loan, null);
        } catch (storeError) {
          console.error(`❌ Failed to record flood zone check attempt: ${storeError.message}`);
        }
      }
    }
    
    // Calculate risk score (includes flood zone risk)
    const riskScore = calculateRiskScore(femaData, loan);
    
    // Find closest disaster
    const closestDisaster = disastersWithDistance.find(d => d.distanceKm !== null) || null;
    
    // Update loan in database
    await updateLoanRiskScore(loan.id, riskScore, femaData.disasterCount, {
      ...femaData,
      disasters: disastersWithDistance
    });
    
    return {
      loanId: loan.id,
      loanNumber: loan.loan_number,
      riskScore,
      disasterCount: femaData.disasterCount,
      femaData: disastersWithDistance,
      closestDisaster: closestDisaster ? {
        ...closestDisaster,
        distanceKm: closestDisaster.distanceKm,
        distanceMiles: closestDisaster.distanceMiles
      } : null,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Error analyzing risk for loan ${loan.loan_number}:`, error.message);
    throw error;
  }
}

/**
 * Batch analyze risk for multiple loans
 * @param {Array} loans - Array of loan objects
 * @returns {Promise<Array>} Array of analysis results
 */
export async function batchAnalyzeRisk(loans) {
  console.log(`🔄 Starting batch risk analysis for ${loans.length} loans...`);
  
  const results = [];
  const batchSize = 10; // Process in batches to avoid overwhelming FEMA API
  
  for (let i = 0; i < loans.length; i += batchSize) {
    const batch = loans.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (loan) => {
      try {
        return await analyzeLoanRisk(loan);
      } catch (error) {
        console.error(`❌ Error in batch analysis for loan ${loan.loan_number}:`, error.message);
        return {
          loanId: loan.id,
          loanNumber: loan.loan_number,
          error: error.message,
          analyzedAt: new Date().toISOString()
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    console.log(`🔄 Processed ${Math.min(i + batchSize, loans.length)}/${loans.length} loans...`);
    
    // Add delay between batches to be respectful to FEMA API
    if (i + batchSize < loans.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Batch risk analysis completed: ${results.length} loans processed`);
  return results;
}

/**
 * Query FEMA API for disaster declarations
 * @param {string} state - State abbreviation
 * @param {string} county - County name
 * @returns {Promise<Object>} FEMA data with disaster count
 */
async function queryFEMAApi(state, county) {
  try {
    // FEMA API v2 endpoint for disaster declarations (matches mashup logic)
    const baseUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';

    // Calculate date 90 days ago (only show disasters from last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    // designatedArea format example: "Harris (County)"; filter by designatedArea and state
    // Note: FEMA API v2 uses designatedArea instead of county
    const filter = `state eq '${state}' and designatedArea eq '${county} (County)' and incidentBeginDate ge ${ninetyDaysAgoStr}`;
    const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$count=true`;

    console.log(`🌐 Querying FEMA API v2 (last 90 days): ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FEMA API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();

    // Extract disaster information
    let disasters = data.DisasterDeclarationsSummaries || [];

    // Extra guard: ensure only last 90 days
    const lastNinetyDaysDate = new Date(ninetyDaysAgoStr);
    disasters = disasters.filter(disaster => {
      if (disaster.incidentBeginDate) {
        const disasterDate = new Date(disaster.incidentBeginDate);
        return disasterDate >= lastNinetyDaysDate;
      }
      return false;
    });
    
    // Using FREE geocoding - OpenStreetMap Nominatim (no charges!)
    const geocodedDisasters = await Promise.all(disasters.map(async disaster => {
      let latitude = null;
      let longitude = null;

      // Prefer county from designatedArea, fallback to county field, then parse from title
      let countyFromApi = normalizeCountyName(
        disaster.designatedArea || disaster.county || parseCountyFromTitle(disaster.declarationTitle || disaster.title) || county || ''
      );
      let stateFromApi = disaster.state || state || '';

      // Geocode using FREE service (respects 1 req/sec limit)
      if (stateFromApi && countyFromApi) {
        const coords = await geocodeCountyState(countyFromApi, stateFromApi);
        latitude = coords.latitude;
        longitude = coords.longitude;
        // Rate limiting - Nominatim requires 1 req/sec (free service already includes delay)
      }

      return {
        disasterNumber: disaster.disasterNumber,
        state: stateFromApi,
        county: countyFromApi,
        declarationDate: disaster.declarationDate,
        incidentType: disaster.incidentType,
        title: disaster.declarationTitle || disaster.title,
        incidentBeginDate: disaster.incidentBeginDate,
        incidentEndDate: disaster.incidentEndDate,
        ihProgramDeclared: disaster.ihProgramDeclared,
        iaProgramDeclared: disaster.iaProgramDeclared,
        paProgramDeclared: disaster.paProgramDeclared,
        hmProgramDeclared: disaster.hmProgramDeclared,
        latitude,
        longitude
      };
    }));

    // Using FREE reverse geocoding - OpenStreetMap Nominatim (no charges!)
    // Process sequentially with delays to respect rate limits
    for (let i = 0; i < geocodedDisasters.length; i++) {
      const d = geocodedDisasters[i];
      if ((!d.county || !d.state) && d.latitude && d.longitude) {
        try {
          const cg = await reverseGeocodeCountyState(d.latitude, d.longitude);
          if (cg.county && !d.county) d.county = cg.county;
          if (cg.state && !d.state) d.state = cg.state;
        } catch (error) {
          // Silently skip on error - don't break the loop
          console.warn(`⚠️  Skipping reverse geocode for disaster ${d.disasterNumber}:`, error.message);
        }
        // Additional delay between requests to avoid overwhelming the API
        // Free service already includes 1.1 second delay, add 0.5 more for safety
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return {
      disasterCount: geocodedDisasters.length,
      disasters: geocodedDisasters,
      queryInfo: {
        state,
        county,
        queriedAt: new Date().toISOString(),
        totalRecords: geocodedDisasters.length,
        filterSince: ninetyDaysAgoStr
      }
    };
  } catch (error) {
    console.error(`❌ FEMA API query error for ${state}, ${county}:`, error.message);
    
    // Return empty result on API error
    return {
      disasterCount: 0,
      disasters: [],
      queryInfo: {
        state,
        county,
        queriedAt: new Date().toISOString(),
        error: error.message
      }
    };
  }
}

/**
 * Calculate distances between a loan and disasters
 * @param {Object} loan - Loan object with latitude and longitude
 * @param {Array} disasters - Array of disaster objects with latitude and longitude
 * @returns {Array} Array of disasters with distanceKm and distanceMiles added
 */
export function calculateLoanToDisasterDistances(loan, disasters) {
  if (!loan || !loan.latitude || !loan.longitude || !Array.isArray(disasters)) {
    return disasters || [];
  }
  
  const loanLat = parseFloat(loan.latitude);
  const loanLng = parseFloat(loan.longitude);
  
  if (isNaN(loanLat) || isNaN(loanLng)) {
    return disasters;
  }
  
  return disasters.map(disaster => {
    if (!disaster.latitude || !disaster.longitude) {
      return {
        ...disaster,
        distanceKm: null,
        distanceMiles: null
      };
    }
    
    const disasterLat = parseFloat(disaster.latitude);
    const disasterLng = parseFloat(disaster.longitude);
    
    if (isNaN(disasterLat) || isNaN(disasterLng)) {
      return {
        ...disaster,
        distanceKm: null,
        distanceMiles: null
      };
    }
    
    const distanceKm = calculateDistance(loanLat, loanLng, disasterLat, disasterLng);
    
    return {
      ...disaster,
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
      distanceMiles: distanceKm !== null ? Math.round((distanceKm * 0.621371) * 100) / 100 : null
    };
  }).sort((a, b) => {
    // Sort by distance (closest first), nulls last
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

/**
 * Find disasters within a specified radius of a loan
 * @param {Object} loan - Loan object with latitude and longitude
 * @param {Array} disasters - Array of disaster objects
 * @param {number} radiusKm - Radius in kilometers (default: 50km)
 * @returns {Array} Array of disasters within the radius, sorted by distance
 */
export function findDisastersWithinRadius(loan, disasters, radiusKm = 50) {
  const disastersWithDistance = calculateLoanToDisasterDistances(loan, disasters);
  return disastersWithDistance.filter(disaster => 
    disaster.distanceKm !== null && disaster.distanceKm <= radiusKm
  );
}

/**
 * Calculate risk score from FEMA data and flood zone
 * @param {Object} femaData - FEMA API response data
 * @param {Object} loan - Loan object with flood zone data (optional)
 * @returns {number} Risk score (0-10+)
 */
function calculateRiskScore(femaData, loan = null) {
  let baseScore = 0;
  
  // Calculate base score from disaster declarations
  if (femaData && femaData.disasters) {
    const disasterCount = femaData.disasterCount || 0;
    // Simple scoring algorithm:
    // 0-2 disasters: Low risk (0-2)
    // 3-5 disasters: Medium risk (3-5)  
    // 6+ disasters: High risk (6+)
    baseScore = Math.min(disasterCount, 10); // Cap at 10 for display purposes
  }
  
  // Add flood zone risk if loan has flood zone data
  if (loan && loan.flood_zone) {
    const floodZone = loan.flood_zone.toUpperCase();
    
    // High-risk flood zones (A, AE, AO, AH, A99, V, VE, etc.)
    if (floodZone.startsWith('A') || floodZone.startsWith('V')) {
      // Add 2-4 points based on zone type
      if (floodZone.includes('V') || floodZone.includes('AE') || floodZone.includes('AO')) {
        baseScore += 4; // High-risk coastal or riverine flooding
      } else if (floodZone.includes('AH') || floodZone.includes('A99')) {
        baseScore += 3; // Moderate-high risk
      } else {
        baseScore += 2; // Standard high-risk zone
      }
    }
    // Moderate-risk zones (X shaded, D)
    else if (floodZone.includes('X') && loan.flood_zone_type && loan.flood_zone_type.includes('Shaded')) {
      baseScore += 1; // Moderate risk
    }
    // Zone D (undetermined) adds minimal risk
    else if (floodZone === 'D') {
      baseScore += 0.5;
    }
  }
  
  return Math.min(Math.round(baseScore * 10) / 10, 15); // Cap at 15, allow decimals
}

/**
 * Generate KML file for loan pipeline risk visualization
 * @param {Array} loans - Array of loan objects with risk data
 * @returns {Promise<string>} KML content as string
 */
export async function generateKMLForLoans(loans) {
  try {
    console.log(`🗺️  Generating KML for ${loans.length} loans...`);
    
    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Loan Pipeline Disaster Risk Analysis</name>
    <description>Property locations with disaster risk scores based on FEMA data</description>
    <Style id="lowRisk">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/green-dot.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>
    <Style id="mediumRisk">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/yellow-dot.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>
    <Style id="highRisk">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/red-dot.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>
    <Style id="notAnalyzed">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/gray-dot.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>`;

    const kmlFooter = `  </Document>
</kml>`;

    let kmlContent = kmlHeader;
    
    // Group loans by risk level for better organization
    const lowRiskLoans = loans.filter(loan => loan.disaster_risk_score >= 0 && loan.disaster_risk_score <= 2);
    const mediumRiskLoans = loans.filter(loan => loan.disaster_risk_score >= 3 && loan.disaster_risk_score <= 5);
    const highRiskLoans = loans.filter(loan => loan.disaster_risk_score >= 6);
    const notAnalyzedLoans = loans.filter(loan => loan.disaster_risk_score === 0 && !loan.last_risk_analysis);

    // Add folders for each risk level
    if (lowRiskLoans.length > 0) {
      kmlContent += `
    <Folder>
      <name>Low Risk Properties (${lowRiskLoans.length})</name>
      <description>Properties with 0-2 disaster declarations</description>`;
      
      lowRiskLoans.forEach(loan => {
        kmlContent += generateLoanPlacemark(loan, 'lowRisk');
      });
      
      kmlContent += `
    </Folder>`;
    }

    if (mediumRiskLoans.length > 0) {
      kmlContent += `
    <Folder>
      <name>Medium Risk Properties (${mediumRiskLoans.length})</name>
      <description>Properties with 3-5 disaster declarations</description>`;
      
      mediumRiskLoans.forEach(loan => {
        kmlContent += generateLoanPlacemark(loan, 'mediumRisk');
      });
      
      kmlContent += `
    </Folder>`;
    }

    if (highRiskLoans.length > 0) {
      kmlContent += `
    <Folder>
      <name>High Risk Properties (${highRiskLoans.length})</name>
      <description>Properties with 6+ disaster declarations</description>`;
      
      highRiskLoans.forEach(loan => {
        kmlContent += generateLoanPlacemark(loan, 'highRisk');
      });
      
      kmlContent += `
    </Folder>`;
    }

    if (notAnalyzedLoans.length > 0) {
      kmlContent += `
    <Folder>
      <name>Not Analyzed (${notAnalyzedLoans.length})</name>
      <description>Properties not yet analyzed for disaster risk</description>`;
      
      notAnalyzedLoans.forEach(loan => {
        kmlContent += generateLoanPlacemark(loan, 'notAnalyzed');
      });
      
      kmlContent += `
    </Folder>`;
    }

    kmlContent += kmlFooter;
    
    console.log(`✅ Generated KML with ${loans.length} loan placemarks`);
    return kmlContent;
  } catch (error) {
    console.error('❌ Error generating KML:', error.message);
    throw error;
  }
}

/**
 * Generate KML placemark for a single loan
 * @param {Object} loan - Loan object
 * @param {string} styleId - KML style ID
 * @returns {string} KML placemark content
 */
function generateLoanPlacemark(loan, styleId) {
  const riskLevel = getRiskLevelText(loan.disaster_risk_score);
  const lastAnalysis = loan.last_risk_analysis ? new Date(loan.last_risk_analysis).toLocaleDateString() : 'Not analyzed';
  
  return `
    <Placemark>
      <name>${loan.loan_number}</name>
      <description>
        <![CDATA[
          <b>Loan Number:</b> ${loan.loan_number}<br/>
          <b>Borrower:</b> ${loan.borrower_name}<br/>
          <b>Address:</b> ${loan.property_address}, ${loan.city}, ${loan.state} ${loan.zip_code}<br/>
          <b>County:</b> ${loan.county}<br/>
          <b>Loan Amount:</b> $${loan.loan_amount.toLocaleString()}<br/>
          <b>Loan Type:</b> ${loan.loan_type}<br/>
          <b>Milestone:</b> ${loan.milestone}<br/>
          <b>Risk Level:</b> ${riskLevel}<br/>
          <b>Risk Score:</b> ${loan.disaster_risk_score}<br/>
          <b>Disaster Declarations:</b> ${loan.disaster_declaration_count}<br/>
          <b>Last Analysis:</b> ${lastAnalysis}
        ]]>
      </description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${loan.longitude},${loan.latitude},0</coordinates>
      </Point>
    </Placemark>`;
}

/**
 * Get risk level text from score
 * @param {number} score - Risk score
 * @returns {string} Risk level text
 */
function getRiskLevelText(score) {
  if (score === 0) return 'Not Analyzed';
  if (score <= 2) return 'Low Risk';
  if (score <= 5) return 'Medium Risk';
  return 'High Risk';
}

/**
 * Analyze all loans in the pipeline
 * @returns {Promise<Object>} Analysis summary
 */
export async function analyzeAllLoans() {
  try {
    console.log('🔄 Starting analysis of all loans in pipeline...');
    
    // Get all loans that haven't been analyzed recently (within last 24 hours)
    const pool = getPool();
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    const result = await pool.query(`
      SELECT * FROM loans 
      WHERE last_risk_analysis IS NULL 
         OR last_risk_analysis < NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);
    
    const loansToAnalyze = result.rows;
    
    if (loansToAnalyze.length === 0) {
      console.log('ℹ️  No loans need analysis at this time');
      return {
        totalAnalyzed: 0,
        results: []
      };
    }
    
    console.log(`🔄 Found ${loansToAnalyze.length} loans to analyze...`);
    
    const results = await batchAnalyzeRisk(loansToAnalyze);
    
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;
    
    console.log(`✅ Analysis complete: ${successCount} successful, ${errorCount} errors`);
    
    return {
      totalAnalyzed: loansToAnalyze.length,
      successCount,
      errorCount,
      results
    };
  } catch (error) {
    console.error('❌ Error analyzing all loans:', error.message);
    throw error;
  }
}

export default {
  analyzeLoanRisk,
  batchAnalyzeRisk,
  calculateRiskScore,
  generateKMLForLoans,
  analyzeAllLoans,
  calculateLoanToDisasterDistances,
  findDisastersWithinRadius
};

/**
 * Query FEMA NFHL for flood zone at specific coordinates (includes boundaries)
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object|null>} Flood zone data with boundaries or null
 */
export async function queryFloodZoneForPoint(latitude, longitude) {
  try {
    if (!latitude || !longitude) {
      return null;
    }
    
    // Multiple FEMA NFHL REST API endpoints to try (in order of preference)
    // Updated endpoint URLs based on FEMA's current service structure
    // Layer 28 = "Flood Hazard Zones" - contains FLD_ZONE data
    const endpoints = [
      'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', // Updated endpoint (WORKING)
      'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer', // Original endpoint (deprecated)
      'https://hazards.fema.gov/gis/nfhl/rest/services?f=pjson' // Services directory
    ];
    
    // Create a small bounding box around the point (0.01 degree ~= 1km)
    const buffer = 0.01;
    const geometry = {
      xmin: longitude - buffer,
      ymin: latitude - buffer,
      xmax: longitude + buffer,
      ymax: latitude + buffer,
      spatialReference: { wkid: 4326 }
    };
    
    // Try each endpoint
    for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
      const baseUrl = endpoints[endpointIndex];
      
      try {
        // First, try to get service info to find correct layer
        const serviceInfoUrl = `${baseUrl}?f=json`;
        const serviceResponse = await fetch(serviceInfoUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
          }
        });
        
        if (serviceResponse.ok) {
          const serviceInfo = await serviceResponse.json();
          
          // Handle services directory response (list of services)
          if (serviceInfo.services) {
            // Find NFHL service in the directory
            const nfhlService = serviceInfo.services?.find(s => 
              s.name?.toLowerCase().includes('nfhl') || 
              s.url?.toLowerCase().includes('nfhl')
            );
            if (nfhlService && nfhlService.url) {
              // Recursively try the found service URL
              const recursiveResult = await queryFloodZoneAtEndpoint(nfhlService.url, latitude, longitude, geometry);
              if (recursiveResult) return recursiveResult;
              continue;
            }
          }
          
          // Find layer with flood zone data
          // Layer 28 = "Flood Hazard Zones" - this is the correct layer for flood zone data
          const floodLayer = serviceInfo.layers?.find(l => 
            l.id === 28 || // Flood Hazard Zones - PRIMARY
            (l.name?.toLowerCase().includes('flood') && l.name?.toLowerCase().includes('zone')) ||
            l.name?.toLowerCase().includes('flood_hazard_zone')
          );
          
          if (floodLayer) {
            const actualLayerId = floodLayer.id;
            console.log(`🌊 Using FEMA NFHL layer ${actualLayerId}: ${floodLayer.name || 'Unknown'} (endpoint ${endpointIndex + 1})`);
            
            const zoneResult = await queryFloodZoneAtEndpoint(baseUrl, latitude, longitude, geometry, actualLayerId);
            
            // Always query boundaries (Layer 27) when we have zone data, especially on first endpoint
            if (zoneResult) {
              if (endpointIndex === 0) {
                console.log(`🌊 Querying Layer 27 (Flood Hazard Boundaries) for boundaries...`);
                const boundaryResult = await queryFloodBoundariesAtEndpoint(baseUrl, latitude, longitude, geometry, 27);
                
                return {
                  ...zoneResult,
                  boundaries: boundaryResult?.boundaries || null,
                  boundaryGeometry: boundaryResult?.boundaryGeometry || null,
                  boundaryCount: boundaryResult?.boundaryCount || 0
                };
              }
              // Return zone result even without boundaries if not first endpoint
              return zoneResult;
            }
          }
          
          // If no flood layer found but service is accessible, try layer 28 directly
          if (endpointIndex === 0) {
            console.log(`🌊 Trying Layer 28 (Flood Hazard Zones) directly...`);
            const zoneResult = await queryFloodZoneAtEndpoint(baseUrl, latitude, longitude, geometry, 28);
            
            // Also query Layer 27 (Flood Hazard Boundaries) for boundary geometry
            console.log(`🌊 Querying Layer 27 (Flood Hazard Boundaries) for boundaries...`);
            const boundaryResult = await queryFloodBoundariesAtEndpoint(baseUrl, latitude, longitude, geometry, 27);
            
            // Combine zone and boundary data
            if (zoneResult || boundaryResult) {
              return {
                ...(zoneResult || {}),
                boundaries: boundaryResult?.boundaries || null,
                boundaryGeometry: boundaryResult?.boundaryGeometry || null
              };
            }
          }
        } else if (endpointIndex === 0) {
          // Only log warning for first endpoint attempt
          console.warn(`⚠️  FEMA NFHL endpoint ${endpointIndex + 1} returned ${serviceResponse.status}, trying next...`);
        }
      } catch (serviceError) {
        if (endpointIndex === 0) {
          console.warn(`⚠️  Could not get service info from endpoint ${endpointIndex + 1}: ${serviceError.message}`);
        }
      }
      
      // Fallback: try direct query with layer 28 (Flood Hazard Zones) first
      if (endpointIndex === 0) {
        const zoneResult = await queryFloodZoneAtEndpoint(baseUrl, latitude, longitude, geometry, 28);
        const boundaryResult = await queryFloodBoundariesAtEndpoint(baseUrl, latitude, longitude, geometry, 27);
        
        if (zoneResult || boundaryResult) {
          console.log(`🌊 Successfully queried flood data using layers 28/27 on endpoint ${endpointIndex + 1}`);
          return {
            ...(zoneResult || {}),
            boundaries: boundaryResult?.boundaries || null,
            boundaryGeometry: boundaryResult?.boundaryGeometry || null
          };
        }
      }
    }
    
    // All endpoints failed
    console.warn(`⚠️  All FEMA NFHL API endpoints failed for point: ${latitude}, ${longitude}`);
    return null;
  } catch (error) {
    console.error(`❌ Error querying flood zone: ${error.message}`);
    return null;
  }
}

/**
 * Helper function to query flood boundaries at a specific endpoint
 * @param {string} baseUrl - Base URL of the endpoint
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {Object} geometry - Geometry object for query
 * @param {number} layerId - Layer ID (27 for boundaries)
 * @returns {Promise<Object|null>} Boundary data or null
 */
async function queryFloodBoundariesAtEndpoint(baseUrl, latitude, longitude, geometry, layerId = 27) {
  try {
    const queryUrl = `${baseUrl}/${layerId}/query`;
    // Layer 27 (Flood Hazard Boundaries) contains boundary geometry
    const params = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true', // Important: we want the geometry for boundaries
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      returnCountOnly: 'false'
    });
    
    const response = await fetch(`${queryUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Check for error in response
    if (data.error) {
      return null;
    }
    
    // Extract boundary features
    if (data.features && data.features.length > 0) {
      // Return all boundary features with their geometry
      return {
        boundaries: data.features.map(feature => ({
          properties: feature.properties || {},
          geometry: feature.geometry || null
        })),
        boundaryGeometry: data.features.length === 1 ? data.features[0].geometry : null,
        boundaryCount: data.features.length
      };
    }
    
    return null;
  } catch (error) {
    // Silently fail - boundaries are optional
    return null;
  }
}

/**
 * Helper function to query flood zone at a specific endpoint
 * @param {string} baseUrl - Base URL of the endpoint
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {Object} geometry - Geometry object for query
 * @param {number} layerId - Layer ID to query (default: 28 for zones)
 * @returns {Promise<Object|null>} Flood zone data or null
 */
async function queryFloodZoneAtEndpoint(baseUrl, latitude, longitude, geometry, layerId = 28) {
  try {
    const queryUrl = `${baseUrl}/${layerId}/query`;
    // Layer 28 (Flood Hazard Zones) uses these field names
    // Use '*' to get all fields to ensure we don't miss anything
    const params = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      outFields: '*', // Get all fields to ensure we capture FLD_ZONE
      returnGeometry: 'true',
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      returnCountOnly: 'false'
    });
    
    const response = await fetch(`${queryUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Check for error in response
    if (data.error) {
      return null;
    }
    
    if (!data.features || data.features.length === 0) {
      return null;
    }
    
    // Find the feature that contains the point
    if (data.features && data.features.length > 0) {
      // Use the first feature (closest match)
      const feature = data.features[0];
      const props = feature.properties || {};
      
      // Check if we have flood zone data
      // Layer 28 field names: FLD_ZONE, DFIRM_ID, ZONE_SUBTY, STATIC_BFE
      // Note: STATIC_BFE can be -9999 which means "not available"
      const floodZone = props.FLD_ZONE || props.flood_zone || props.ZONE || props.zone || null;
      const zoneType = props.ZONE_SUBTY || props.zone_subty || props.ZONE_TYPE || props.zone_type || null;
      const dfirmId = props.DFIRM_ID || props.dfirm_id || props.DFIRMID || props.dfirmid || null;
      const staticBfe = props.STATIC_BFE;
      const baseFloodElevation = (staticBfe !== undefined && staticBfe !== null && staticBfe !== -9999) 
        ? parseFloat(staticBfe) 
        : null;
      
      // Return data even if flood zone is null, as long as we have some flood-related data
      // Some areas may have DFIRM_ID or FLD_AR_ID even without a zone designation
      // IMPORTANT: Even if FLD_ZONE is empty string or "X" (which is a valid zone), we should return data
      if (!floodZone && !dfirmId && !props.FLD_AR_ID) {
        // No meaningful flood data found
        return null;
      }
      
      // FLOODWAY field may not exist in Layer 28, check SFHA_TF instead
      // SFHA_TF = "T" means floodway, "F" means not floodway
      const floodway = props.FLOODWAY || props.floodway || (props.SFHA_TF === 'T' ? 'Yes' : null) || null;
      
      return {
        floodZone: floodZone,
        zoneType: zoneType,
        dfirmId: dfirmId,
        baseFloodElevation: baseFloodElevation,
        floodway: floodway,
        fullData: props,
        zoneGeometry: feature.geometry || null // Include zone geometry as well
      };
    }
    
    return null;
  } catch (error) {
    // Silently fail - will try next endpoint
    return null;
  }
}

/**
 * Update flood zone for a single loan
 * @param {Object} loan - Loan object with latitude/longitude
 * @returns {Promise<Object|null>} Updated flood zone data
 */
export async function updateLoanFloodZone(loan, floodZoneData = null) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  try {
    if (!loan.latitude || !loan.longitude) {
      console.log(`⚠️  Loan ${loan.loan_number} has no coordinates, skipping flood zone check`);
      return null;
    }
    
    // Query flood zone if not provided
    if (!floodZoneData) {
      floodZoneData = await queryFloodZoneForPoint(
        parseFloat(loan.latitude),
        parseFloat(loan.longitude)
      );
    }
    
    // Always update last_flood_zone_check timestamp, even if API failed
    if (floodZoneData) {
      // Prepare complete flood zone data including boundaries
      const completeFloodData = {
        ...floodZoneData.fullData,
        boundaries: floodZoneData.boundaries || null,
        boundaryGeometry: floodZoneData.boundaryGeometry || null,
        boundaryCount: floodZoneData.boundaryCount || 0,
        zoneGeometry: floodZoneData.zoneGeometry || null
      };
      
      // Update loan with flood zone data (including boundaries)
      await pool.query(`
        UPDATE loans 
        SET 
          flood_zone = $1,
          flood_zone_type = $2,
          dfirm_id = $3,
          base_flood_elevation = $4,
          flood_zone_data = $5,
          last_flood_zone_check = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        floodZoneData.floodZone,
        floodZoneData.zoneType,
        floodZoneData.dfirmId,
        floodZoneData.baseFloodElevation,
        JSON.stringify(completeFloodData),
        loan.id
      ]);
      
      const boundaryInfo = floodZoneData.boundaries ? ` (${floodZoneData.boundaryCount || floodZoneData.boundaries.length} boundaries)` : '';
      console.log(`✅ Stored flood zone for loan ${loan.loan_number}: ${floodZoneData.floodZone || 'None'}${boundaryInfo}`);
      return floodZoneData;
    } else {
      // No flood zone found or API unavailable - still record the check attempt
      await pool.query(`
        UPDATE loans 
        SET 
          flood_zone = NULL,
          flood_zone_type = NULL,
          dfirm_id = NULL,
          base_flood_elevation = NULL,
          flood_zone_data = NULL,
          last_flood_zone_check = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [loan.id]);
      
      console.log(`✅ Recorded flood zone check for loan ${loan.loan_number} (no zone found or API unavailable)`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error storing flood zone for loan ${loan.loan_number}:`, error.message);
    throw error;
  }
}

/**
 * Batch update flood zones for all loans
 * @param {number} limit - Maximum number of loans to process (null for all)
 * @param {boolean} forceUpdate - Force update even if already checked
 * @returns {Promise<Object>} Results with updated count
 */
export async function batchUpdateFloodZones(limit = null, forceUpdate = false) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  try {
    let query = `
      SELECT id, loan_number, latitude, longitude, flood_zone, last_flood_zone_check
      FROM loans
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;
    
    if (!forceUpdate) {
      query += ` AND (flood_zone IS NULL OR last_flood_zone_check IS NULL)`;
    }
    
    query += ` ORDER BY id`;
    
    if (limit) {
      query += ` LIMIT $1`;
    }
    
    const result = await pool.query(query, limit ? [limit] : []);
    const loans = result.rows;
    
    console.log(`🔄 Updating flood zones for ${loans.length} loans...`);
    
    let updated = 0;
    let errors = 0;
    
    // Process in batches with rate limiting
    // Reduced batch size to avoid database connection issues
    const batchSize = 3; // Process 3 at a time to avoid overwhelming API and DB
    for (let i = 0; i < loans.length; i += batchSize) {
      const batch = loans.slice(i, i + batchSize);
      
      // Process sequentially within batch to avoid DB connection issues
      for (const loan of batch) {
        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
          try {
            await updateLoanFloodZone(loan);
            updated++;
            success = true;
            
            // Rate limiting - wait 300ms between requests
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error) {
            retries--;
            if (retries > 0) {
              console.log(`⚠️  Retrying loan ${loan.loan_number} (${3 - retries + 1}/3)...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            } else {
              console.error(`❌ Error updating loan ${loan.loan_number}:`, error.message);
              errors++;
            }
          }
        }
      }
      
      // Progress update
      if ((i + batchSize) % 50 === 0 || i + batchSize >= loans.length) {
        console.log(`🔄 Processed ${Math.min(i + batchSize, loans.length)}/${loans.length} loans...`);
      }
    }
    
    console.log(`✅ Flood zone update complete: ${updated} updated, ${errors} errors`);
    
    return {
      total: loans.length,
      updated,
      errors
    };
  } catch (error) {
    console.error('❌ Error in batch flood zone update:', error.message);
    throw error;
  }
}