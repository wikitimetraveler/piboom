import { calculateDistance } from './disasters.service.js';

/**
 * Loan Pipeline Service
 * 
 * @file       loan-pipeline.service.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Service module for managing loan pipeline data including CRUD operations,
 * address geocoding, test loan generation, and loan risk assessment.
 * Provides comprehensive loan data management with integration to Google Maps
 * API for address validation and geocoding.
 * 
 * Features:
 * - Full CRUD operations for loan records
 * - Address geocoding via Google Maps API
 * - Test loan generation with realistic data
 * - Loan risk assessment and scoring
 * - Database persistence with PostgreSQL
 * - Address validation and normalization
 * 
 * Loan Operations:
 * - Create new loan records
 * - Read/retrieve loan data with filtering
 * - Update existing loan information
 * - Delete loan records
 * - Bulk operations for loan processing
 * 
 * Geocoding:
 * - Google Maps API integration
 * - Address validation
 * - Coordinate extraction (lat/lng)
 * - Reverse geocoding support
 * 
 * Test Data:
 * - Realistic test loan generation
 * - Multiple loan scenarios
 * - Random data variation
 * - Seeded for reproducibility
 * 
 * Technical Implementation:
 * - PostgreSQL database integration
 * - Connection pooling via database.service
 * - Async/await pattern for database operations
 * - Error handling and validation
 * - Transaction support for data integrity
 * 
 * @dependencies
 * - database.service.js (getPool)
 * - Google Maps Geocoding API
 * 
 * ==============================================================================
 */

import { getPool } from './database.service.js';
import { geocodeAddressWithCache } from './geocoding-cache.service.js';

/**
 * Geocode an address using Google Maps API with validation
 * @param {string} address - Full address string
 * @param {string} expectedState - Expected state abbreviation (optional, for validation)
 * @param {string} expectedCounty - Expected county name (optional, for validation)
 * @returns {Promise<Object>} Object with latitude, longitude, and validation info
 */
async function geocodeAddress(address, expectedState = null, expectedCounty = null) {
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
        
        // Check if state matches (if expected)
        if (expectedState && stateShort && stateShort.toUpperCase() === expectedState.toUpperCase()) {
          bestResult = result;
          validated = true;
          
          // Also check county if provided
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
                validated = false; // County doesn't match
              }
            }
          }
          break; // Found matching state
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
      
      // If expected state but no match found, try again with full address (including zip)
      if (expectedState && !validated && addressWithoutZip !== address.replace(/\s+\d{5}(-\d{4})?$/, '').trim()) {
        const fullAddressWithCountry = address.endsWith(', USA') || address.endsWith(', US')
          ? address
          : `${address}, USA`;
        console.log(`🔄 Retrying geocoding with full address for: ${fullAddressWithCountry}`);
        const retryUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddressWithCountry)}&key=${apiKey}&region=us&components=country:US`;
        const retryResponse = await fetch(retryUrl);
        const retryData = await retryResponse.json();
        
        if (retryData.status === 'OK' && retryData.results.length > 0) {
          for (const result of retryData.results) {
            const addressComponents = result.address_components || [];
            const countryComp = addressComponents.find(c => c.types.includes('country'));
            if (countryComp && countryComp.short_name !== 'US') continue;
            
            const stateComp = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
            const stateShort = stateComp ? stateComp.short_name : null;
            
            if (stateShort && stateShort.toUpperCase() === expectedState.toUpperCase()) {
              bestResult = result;
              validated = true;
              break;
            }
          }
        }
      }
      
      // If still no match found but we have expected state, log warning and reject
      if (expectedState && !validated) {
        const addressComponents = bestResult.address_components || [];
        const stateComp = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
        const actualState = stateComp ? stateComp.short_name : 'unknown';
        console.warn(`⚠️  Geocoding mismatch: Expected ${expectedState}, got ${actualState} for address: ${address}`);
        console.warn(`   Rejecting this result to prevent incorrect mapping`);
        return { latitude: null, longitude: null, validated: false };
      }
      
      const location = bestResult.geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        validated: validated || !expectedState // Valid if no expected state or if validated
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
 * Generate test loans with realistic addresses across US states
 * @param {number} count - Number of loans to generate (default 100, use 1000 for all 50 states with 20 each)
 * @returns {Promise<Array>} Array of generated loan IDs
 */
export async function generateTestLoans(count = 100) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    console.log(`🔄 Generating ${count} test loans...`);

    // Get the maximum existing loan number to avoid conflicts
    let startLoanNumber = 3000000; // Default safe starting point
    try {
      const maxResult = await pool.query(`
        SELECT loan_number FROM loans 
        WHERE loan_number LIKE 'LN%' 
        ORDER BY CAST(SUBSTRING(loan_number FROM 3) AS INTEGER) DESC 
        LIMIT 1
      `);
      if (maxResult.rows.length > 0) {
        const maxLoanNum = maxResult.rows[0].loan_number;
        const numPart = parseInt(maxLoanNum.replace('LN', ''));
        if (!isNaN(numPart)) {
          startLoanNumber = numPart + 1;
        }
      }
    } catch (error) {
      console.log('⚠️  Could not check existing loan numbers, using default starting number');
    }

    // Realistic test data with REAL addresses that geocode correctly - All 50 US States
    const testData = [
      // High-risk states with REAL addresses
      { state: 'CA', cities: [
        { name: 'Los Angeles', county: 'Los Angeles', zip: '90012', address: '1250 N Spring St' },
        { name: 'San Francisco', county: 'San Francisco', zip: '94102', address: '1 Market St' },
        { name: 'San Diego', county: 'San Diego', zip: '92101', address: '1200 3rd Ave' },
        { name: 'Sacramento', county: 'Sacramento', zip: '95814', address: '1301 I St' },
        { name: 'Fresno', county: 'Fresno', zip: '93721', address: '2600 Fresno St' },
        { name: 'Oakland', county: 'Alameda', zip: '94612', address: '1 Frank H Ogawa Plaza' },
        { name: 'Long Beach', county: 'Los Angeles', zip: '90802', address: '333 W Ocean Blvd' },
        { name: 'Bakersfield', county: 'Kern', zip: '93301', address: '1501 Truxtun Ave' },
        { name: 'Anaheim', county: 'Orange', zip: '92805', address: '200 S Anaheim Blvd' },
        { name: 'Santa Ana', county: 'Orange', zip: '92701', address: '20 Civic Center Plaza' }
      ]},
      { state: 'FL', cities: [
        { name: 'Miami', county: 'Miami-Dade', zip: '33130', address: '1 Biscayne Blvd' },
        { name: 'Tampa', county: 'Hillsborough', zip: '33602', address: '306 E Jackson St' },
        { name: 'Orlando', county: 'Orange', zip: '32801', address: '400 S Orange Ave' },
        { name: 'Jacksonville', county: 'Duval', zip: '32202', address: '117 W Duval St' },
        { name: 'Tallahassee', county: 'Leon', zip: '32301', address: '300 S Adams St' },
        { name: 'St. Petersburg', county: 'Pinellas', zip: '33701', address: '175 5th St N' },
        { name: 'Hialeah', county: 'Miami-Dade', zip: '33010', address: '501 Palm Ave' },
        { name: 'Fort Lauderdale', county: 'Broward', zip: '33301', address: '100 N Andrews Ave' },
        { name: 'Port St. Lucie', county: 'St. Lucie', zip: '34984', address: '121 SW Port St Lucie Blvd' },
        { name: 'Cape Coral', county: 'Lee', zip: '33990', address: '1015 Cultural Park Blvd' }
      ]},
      { state: 'TX', cities: [
        { name: 'Houston', county: 'Harris', zip: '77002', address: '901 Bagby St' },
        { name: 'Dallas', county: 'Dallas', zip: '75201', address: '1500 Marilla St' },
        { name: 'Austin', county: 'Travis', zip: '78701', address: '301 W 2nd St' },
        { name: 'San Antonio', county: 'Bexar', zip: '78205', address: '100 Military Plaza' },
        { name: 'Fort Worth', county: 'Tarrant', zip: '76102', address: '1000 Throckmorton St' },
        { name: 'El Paso', county: 'El Paso', zip: '79901', address: '2 Civic Center Plaza' },
        { name: 'Arlington', county: 'Tarrant', zip: '76010', address: '101 W Abram St' },
        { name: 'Corpus Christi', county: 'Nueces', zip: '78401', address: '1201 Leopard St' },
        { name: 'Plano', county: 'Collin', zip: '75074', address: '1520 K Ave' },
        { name: 'Laredo', county: 'Webb', zip: '78040', address: '1110 Houston St' }
      ]},
      { state: 'LA', cities: [
        { name: 'New Orleans', county: 'Orleans', zip: '70112', address: '1300 Perdido St' },
        { name: 'Baton Rouge', county: 'East Baton Rouge', zip: '70801', address: '222 St Louis St' },
        { name: 'Shreveport', county: 'Caddo', zip: '71101', address: '505 Travis St' },
        { name: 'Lafayette', county: 'Lafayette', zip: '70501', address: '705 W University Ave' },
        { name: 'Lake Charles', county: 'Calcasieu', zip: '70601', address: '326 Pujo St' },
        { name: 'Bossier City', county: 'Bossier', zip: '71111', address: '620 Benton Rd' },
        { name: 'Kenner', county: 'Jefferson', zip: '70062', address: '1801 Williams Blvd' },
        { name: 'Monroe', county: 'Ouachita', zip: '71201', address: '400 Lea Joyner Memorial Expy' },
        { name: 'Alexandria', county: 'Rapides', zip: '71301', address: '915 3rd St' },
        { name: 'Houma', county: 'Terrebonne', zip: '70360', address: '8026 Main St' }
      ]},
      { state: 'NC', cities: [
        { name: 'Charlotte', county: 'Mecklenburg', zip: '28202', address: '600 E 4th St' },
        { name: 'Raleigh', county: 'Wake', zip: '27601', address: '222 W Hargett St' },
        { name: 'Greensboro', county: 'Guilford', zip: '27401', address: '300 W Washington St' },
        { name: 'Durham', county: 'Durham', zip: '27701', address: '101 City Hall Plaza' },
        { name: 'Winston-Salem', county: 'Forsyth', zip: '27101', address: '101 N Main St' },
        { name: 'Fayetteville', county: 'Cumberland', zip: '28301', address: '433 Hay St' },
        { name: 'Cary', county: 'Wake', zip: '27511', address: '316 N Academy St' },
        { name: 'Wilmington', county: 'New Hanover', zip: '28401', address: '102 N 3rd St' },
        { name: 'High Point', county: 'Guilford', zip: '27260', address: '211 W Commerce Ave' },
        { name: 'Concord', county: 'Cabarrus', zip: '28025', address: '35 Cabarrus Ave W' }
      ]},
      
      // Normal-risk states with REAL addresses
      { state: 'NY', cities: [
        { name: 'New York', county: 'New York', zip: '10007', address: '1 Centre St' },
        { name: 'Buffalo', county: 'Erie', zip: '14202', address: '65 Niagara Square' },
        { name: 'Rochester', county: 'Monroe', zip: '14614', address: '30 Church St' },
        { name: 'Yonkers', county: 'Westchester', zip: '10701', address: '40 S Broadway' },
        { name: 'Syracuse', county: 'Onondaga', zip: '13202', address: '233 E Washington St' },
        { name: 'Albany', county: 'Albany', zip: '12207', address: '24 Eagle St' },
        { name: 'New Rochelle', county: 'Westchester', zip: '10801', address: '515 North Ave' },
        { name: 'Mount Vernon', county: 'Westchester', zip: '10550', address: '1 Roosevelt Sq' },
        { name: 'Schenectady', county: 'Schenectady', zip: '12305', address: '105 Jay St' },
        { name: 'Utica', county: 'Oneida', zip: '13501', address: '1 Kennedy Plaza' }
      ]},
      { state: 'IL', cities: [
        { name: 'Chicago', county: 'Cook', zip: '60602', address: '121 N LaSalle St' },
        { name: 'Aurora', county: 'Kane', zip: '60505', address: '44 E Downer Pl' },
        { name: 'Rockford', county: 'Winnebago', zip: '61101', address: '425 E State St' },
        { name: 'Joliet', county: 'Will', zip: '60432', address: '150 W Jefferson St' },
        { name: 'Naperville', county: 'DuPage', zip: '60540', address: '400 S Eagle St' },
        { name: 'Springfield', county: 'Sangamon', zip: '62701', address: '300 S 7th St' },
        { name: 'Peoria', county: 'Peoria', zip: '61602', address: '419 Fulton St' },
        { name: 'Elgin', county: 'Kane', zip: '60120', address: '150 Dexter Ct' },
        { name: 'Waukegan', county: 'Lake', zip: '60085', address: '100 N Martin Luther King Jr Ave' },
        { name: 'Cicero', county: 'Cook', zip: '60804', address: '4949 W Cermak Rd' }
      ]},
      { state: 'PA', cities: [
        { name: 'Philadelphia', county: 'Philadelphia', zip: '19107', address: '1400 John F Kennedy Blvd' },
        { name: 'Pittsburgh', county: 'Allegheny', zip: '15219', address: '414 Grant St' },
        { name: 'Allentown', county: 'Lehigh', zip: '18101', address: '435 Hamilton St' },
        { name: 'Erie', county: 'Erie', zip: '16501', address: '626 State St' },
        { name: 'Reading', county: 'Berks', zip: '19601', address: '815 Washington St' },
        { name: 'Scranton', county: 'Lackawanna', zip: '18503', address: '340 N Washington Ave' },
        { name: 'Bethlehem', county: 'Northampton', zip: '18018', address: '10 E Church St' },
        { name: 'Lancaster', county: 'Lancaster', zip: '17602', address: '120 N Duke St' },
        { name: 'Harrisburg', county: 'Dauphin', zip: '17101', address: '10 N 2nd St' },
        { name: 'Altoona', county: 'Blair', zip: '16601', address: '1301 12th St' }
      ]},
      { state: 'OH', cities: [
        { name: 'Columbus', county: 'Franklin', zip: '43215', address: '90 W Broad St' },
        { name: 'Cleveland', county: 'Cuyahoga', zip: '44114', address: '601 Lakeside Ave' },
        { name: 'Cincinnati', county: 'Hamilton', zip: '45202', address: '801 Plum St' },
        { name: 'Toledo', county: 'Lucas', zip: '43604', address: '1 Government Center' },
        { name: 'Akron', county: 'Summit', zip: '44308', address: '166 S High St' },
        { name: 'Dayton', county: 'Montgomery', zip: '45402', address: '101 W 3rd St' },
        { name: 'Parma', county: 'Cuyahoga', zip: '44129', address: '6611 Ridge Rd' },
        { name: 'Canton', county: 'Stark', zip: '44702', address: '218 Cleveland Ave SW' },
        { name: 'Youngstown', county: 'Mahoning', zip: '44503', address: '26 S Phelps St' },
        { name: 'Lorain', county: 'Lorain', zip: '44052', address: '200 W Erie Ave' }
      ]},
      { state: 'GA', cities: [
        { name: 'Atlanta', county: 'Fulton', zip: '30303', address: '68 Mitchell St SW' },
        { name: 'Augusta', county: 'Richmond', zip: '30901', address: '530 Greene St' },
        { name: 'Columbus', county: 'Muscogee', zip: '31901', address: '100 10th St' },
        { name: 'Savannah', county: 'Chatham', zip: '31401', address: '2 E Bay St' },
        { name: 'Athens', county: 'Clarke', zip: '30601', address: '301 College Ave' },
        { name: 'Sandy Springs', county: 'Fulton', zip: '30328', address: '7840 Roswell Rd' },
        { name: 'Roswell', county: 'Fulton', zip: '30075', address: '38 Hill St' },
        { name: 'Macon', county: 'Bibb', zip: '31201', address: '700 Poplar St' },
        { name: 'Johns Creek', county: 'Fulton', zip: '30022', address: '11360 Lakefield Dr' },
        { name: 'Albany', county: 'Dougherty', zip: '31701', address: '200 N Jackson St' }
      ]},
      { state: 'MI', cities: [
        { name: 'Detroit', county: 'Wayne', zip: '48226', address: '2 Woodward Ave' },
        { name: 'Grand Rapids', county: 'Kent', zip: '49503', address: '300 Monroe Ave NW' },
        { name: 'Warren', county: 'Macomb', zip: '48093', address: '1 City Square' },
        { name: 'Sterling Heights', county: 'Oakland', zip: '48310', address: '40555 Utica Rd' },
        { name: 'Lansing', county: 'Ingham', zip: '48933', address: '124 W Michigan Ave' },
        { name: 'Ann Arbor', county: 'Washtenaw', zip: '48104', address: '301 E Huron St' },
        { name: 'Flint', county: 'Genesee', zip: '48502', address: '1101 Saginaw St' },
        { name: 'Dearborn', county: 'Wayne', zip: '48126', address: '13615 Michigan Ave' },
        { name: 'Livonia', county: 'Wayne', zip: '48154', address: '33000 Civic Center Dr' },
        { name: 'Troy', county: 'Oakland', zip: '48083', address: '500 W Big Beaver Rd' }
      ]},
      { state: 'NJ', cities: [
        { name: 'Newark', county: 'Essex', zip: '07102', address: '920 Broad St' },
        { name: 'Jersey City', county: 'Hudson', zip: '07306', address: '280 Grove St' },
        { name: 'Paterson', county: 'Passaic', zip: '07505', address: '155 Market St' },
        { name: 'Elizabeth', county: 'Union', zip: '07207', address: '50 Winfield Scott Plaza' },
        { name: 'Edison', county: 'Middlesex', zip: '08817', address: '100 Municipal Blvd' },
        { name: 'Woodbridge', county: 'Middlesex', zip: '07095', address: '1 Main St' },
        { name: 'Lakewood', county: 'Ocean', zip: '08701', address: '231 3rd St' },
        { name: 'Toms River', county: 'Ocean', zip: '08753', address: '33 Washington St' },
        { name: 'Hamilton', county: 'Mercer', zip: '08690', address: '2090 Greenwood Ave' },
        { name: 'Trenton', county: 'Mercer', zip: '08608', address: '319 E State St' }
      ]},
      { state: 'VA', cities: [
        { name: 'Virginia Beach', county: 'Virginia Beach', zip: '23451', address: '2401 Courthouse Dr' },
        { name: 'Norfolk', county: 'Norfolk', zip: '23510', address: '810 Union St' },
        { name: 'Chesapeake', county: 'Chesapeake', zip: '23320', address: '306 Cedar Rd' },
        { name: 'Richmond', county: 'Richmond', zip: '23219', address: '900 E Broad St' },
        { name: 'Newport News', county: 'Newport News', zip: '23607', address: '2400 Washington Ave' },
        { name: 'Alexandria', county: 'Alexandria', zip: '22314', address: '301 King St' },
        { name: 'Hampton', county: 'Hampton', zip: '23669', address: '22 Lincoln St' },
        { name: 'Portsmouth', county: 'Portsmouth', zip: '23704', address: '801 Crawford St' },
        { name: 'Suffolk', county: 'Suffolk', zip: '23434', address: '441 Market St' },
        { name: 'Roanoke', county: 'Roanoke', zip: '24011', address: '215 Church Ave SW' }
      ]},
      { state: 'WA', cities: [
        { name: 'Seattle', county: 'King', zip: '98104', address: '600 4th Ave' },
        { name: 'Spokane', county: 'Spokane', zip: '99201', address: '808 W Spokane Falls Blvd' },
        { name: 'Tacoma', county: 'Pierce', zip: '98402', address: '747 Market St' },
        { name: 'Vancouver', county: 'Clark', zip: '98660', address: '415 W 6th St' },
        { name: 'Bellevue', county: 'King', zip: '98004', address: '450 110th Ave NE' },
        { name: 'Everett', county: 'Snohomish', zip: '98201', address: '2930 Wetmore Ave' },
        { name: 'Kent', county: 'King', zip: '98032', address: '220 4th Ave S' },
        { name: 'Renton', county: 'King', zip: '98057', address: '1055 S Grady Way' },
        { name: 'Yakima', county: 'Yakima', zip: '98901', address: '129 N 2nd St' },
        { name: 'Federal Way', county: 'King', zip: '98023', address: '33325 8th Ave S' }
      ]},
      { state: 'AZ', cities: [
        { name: 'Phoenix', county: 'Maricopa', zip: '85003', address: '125 W Washington St' },
        { name: 'Tucson', county: 'Pima', zip: '85701', address: '255 W Alameda St' },
        { name: 'Mesa', county: 'Maricopa', zip: '85201', address: '55 N Center St' },
        { name: 'Chandler', county: 'Maricopa', zip: '85225', address: '88 E Chicago St' },
        { name: 'Scottsdale', county: 'Maricopa', zip: '85251', address: '3939 N Drinkwater Blvd' },
        { name: 'Glendale', county: 'Maricopa', zip: '85301', address: '5850 W Glendale Ave' },
        { name: 'Gilbert', county: 'Maricopa', zip: '85233', address: '50 E Civic Center Dr' },
        { name: 'Tempe', county: 'Maricopa', zip: '85281', address: '31 E 5th St' },
        { name: 'Peoria', county: 'Maricopa', zip: '85381', address: '8401 W Monroe St' },
        { name: 'Surprise', county: 'Maricopa', zip: '85374', address: '16000 N Civic Center Plaza' }
      ]},
      
      // Additional states - All 50 US States
      { state: 'AL', cities: [
        { name: 'Birmingham', county: 'Jefferson', zip: '35203', address: '710 N 20th St' },
        { name: 'Montgomery', county: 'Montgomery', zip: '36104', address: '103 N Perry St' },
        { name: 'Mobile', county: 'Mobile', zip: '36602', address: '205 Government St' },
        { name: 'Huntsville', county: 'Madison', zip: '35801', address: '308 Fountain Circle' },
        { name: 'Tuscaloosa', county: 'Tuscaloosa', zip: '35401', address: '2201 University Blvd' },
        { name: 'Hoover', county: 'Jefferson', zip: '35216', address: '100 Municipal Dr' },
        { name: 'Dothan', county: 'Houston', zip: '36301', address: '126 N Saint Andrews St' },
        { name: 'Auburn', county: 'Lee', zip: '36830', address: '144 Tichenor Ave' },
        { name: 'Decatur', county: 'Morgan', zip: '35601', address: '402 Lee St NE' },
        { name: 'Madison', county: 'Madison', zip: '35758', address: '100 Hughes Rd' }
      ]},
      { state: 'AK', cities: [
        { name: 'Anchorage', county: 'Anchorage', zip: '99501', address: '632 W 6th Ave' },
        { name: 'Fairbanks', county: 'Fairbanks North Star', zip: '99701', address: '800 Cushman St' },
        { name: 'Juneau', county: 'Juneau', zip: '99801', address: '155 S Seward St' },
        { name: 'Wasilla', county: 'Matanuska-Susitna', zip: '99654', address: '290 E Herning Ave' },
        { name: 'Sitka', county: 'Sitka', zip: '99835', address: '100 Lincoln St' },
        { name: 'Ketchikan', county: 'Ketchikan Gateway', zip: '99901', address: '334 Front St' },
        { name: 'Kenai', county: 'Kenai Peninsula', zip: '99611', address: '210 Fidalgo Ave' },
        { name: 'Kodiak', county: 'Kodiak Island', zip: '99615', address: '710 Mill Bay Rd' },
        { name: 'Bethel', county: 'Bethel', zip: '99559', address: '675 3rd Ave' },
        { name: 'Palmer', county: 'Matanuska-Susitna', zip: '99645', address: '231 W Evergreen Ave' }
      ]},
      { state: 'AR', cities: [
        { name: 'Little Rock', county: 'Pulaski', zip: '72201', address: '500 W Markham St' },
        { name: 'Fort Smith', county: 'Sebastian', zip: '72901', address: '623 Garrison Ave' },
        { name: 'Fayetteville', county: 'Washington', zip: '72701', address: '113 W Mountain St' },
        { name: 'Springdale', county: 'Washington', zip: '72764', address: '201 Spring St' },
        { name: 'Jonesboro', county: 'Craighead', zip: '72401', address: '300 S Church St' },
        { name: 'North Little Rock', county: 'Pulaski', zip: '72114', address: '300 Main St' },
        { name: 'Conway', county: 'Faulkner', zip: '72032', address: '1205 Oak St' },
        { name: 'Rogers', county: 'Benton', zip: '72756', address: '301 W Chestnut St' },
        { name: 'Pine Bluff', county: 'Jefferson', zip: '71601', address: '200 E 8th Ave' },
        { name: 'Bentonville', county: 'Benton', zip: '72712', address: '305 SW A St' }
      ]},
      { state: 'CO', cities: [
        { name: 'Denver', county: 'Denver', zip: '80202', address: '1437 Bannock St' },
        { name: 'Colorado Springs', county: 'El Paso', zip: '80903', address: '30 S Nevada Ave' },
        { name: 'Aurora', county: 'Arapahoe', zip: '80012', address: '15151 E Alameda Pkwy' },
        { name: 'Fort Collins', county: 'Larimer', zip: '80521', address: '300 Laporte Ave' },
        { name: 'Lakewood', county: 'Jefferson', zip: '80226', address: '480 S Allison Pkwy' },
        { name: 'Thornton', county: 'Adams', zip: '80241', address: '9500 Civic Center Dr' },
        { name: 'Arvada', county: 'Jefferson', zip: '80004', address: '8101 Ralston Rd' },
        { name: 'Westminster', county: 'Adams', zip: '80031', address: '4800 W 92nd Ave' },
        { name: 'Pueblo', county: 'Pueblo', zip: '81003', address: '1 City Hall Pl' },
        { name: 'Greeley', county: 'Weld', zip: '80631', address: '1000 10th St' }
      ]},
      { state: 'CT', cities: [
        { name: 'Bridgeport', county: 'Fairfield', zip: '06604', address: '45 Lyon Terrace' },
        { name: 'New Haven', county: 'New Haven', zip: '06510', address: '165 Church St' },
        { name: 'Hartford', county: 'Hartford', zip: '06103', address: '550 Main St' },
        { name: 'Stamford', county: 'Fairfield', zip: '06901', address: '888 Washington Blvd' },
        { name: 'Waterbury', county: 'New Haven', zip: '06702', address: '235 Grand St' },
        { name: 'Norwalk', county: 'Fairfield', zip: '06854', address: '125 East Ave' },
        { name: 'Danbury', county: 'Fairfield', zip: '06810', address: '155 Deer Hill Ave' },
        { name: 'New Britain', county: 'Hartford', zip: '06051', address: '27 W Main St' },
        { name: 'West Hartford', county: 'Hartford', zip: '06107', address: '50 S Main St' },
        { name: 'Greenwich', county: 'Fairfield', zip: '06830', address: '101 Field Point Rd' }
      ]},
      { state: 'DE', cities: [
        { name: 'Wilmington', county: 'New Castle', zip: '19801', address: '800 N French St' },
        { name: 'Dover', county: 'Kent', zip: '19901', address: '15 Loockerman Plaza' },
        { name: 'Newark', county: 'New Castle', zip: '19711', address: '220 S Main St' },
        { name: 'Middletown', county: 'New Castle', zip: '19709', address: '19 W Green St' },
        { name: 'Smyrna', county: 'Kent', zip: '19977', address: '27 S Market St' },
        { name: 'Milford', county: 'Sussex', zip: '19963', address: '201 S Walnut St' },
        { name: 'Seaford', county: 'Sussex', zip: '19973', address: '414 High St' },
        { name: 'Georgetown', county: 'Sussex', zip: '19947', address: '10 The Circle' },
        { name: 'Elsmere', county: 'New Castle', zip: '19805', address: '11 New Castle Ave' },
        { name: 'New Castle', county: 'New Castle', zip: '19720', address: '220 Delaware St' }
      ]},
      { state: 'HI', cities: [
        { name: 'Honolulu', county: 'Honolulu', zip: '96813', address: '530 S King St' },
        { name: 'Hilo', county: 'Hawaii', zip: '96720', address: '101 Pauahi St' },
        { name: 'Kailua-Kona', county: 'Hawaii', zip: '96740', address: '75-5706 Kuakini Hwy' },
        { name: 'Kaneohe', county: 'Honolulu', zip: '96744', address: '45-660 Kamehameha Hwy' },
        { name: 'Kahului', county: 'Maui', zip: '96732', address: '200 S High St' },
        { name: 'Ewa Beach', county: 'Honolulu', zip: '96706', address: '91-1001 Renton Rd' },
        { name: 'Mililani', county: 'Honolulu', zip: '96789', address: '95-1001 Ukuwai St' },
        { name: 'Kihei', county: 'Maui', zip: '96753', address: '1881 S Kihei Rd' },
        { name: 'Pearl City', county: 'Honolulu', zip: '96782', address: '850 Kamehameha Hwy' },
        { name: 'Waipahu', county: 'Honolulu', zip: '96797', address: '94-275 Mokuola St' }
      ]},
      { state: 'ID', cities: [
        { name: 'Boise', county: 'Ada', zip: '83702', address: '150 N Capitol Blvd' },
        { name: 'Nampa', county: 'Canyon', zip: '83651', address: '411 3rd St S' },
        { name: 'Meridian', county: 'Ada', zip: '83642', address: '33 E Broadway Ave' },
        { name: 'Idaho Falls', county: 'Bonneville', zip: '83402', address: '308 Constitution Way' },
        { name: 'Pocatello', county: 'Bannock', zip: '83201', address: '911 N 7th Ave' },
        { name: 'Caldwell', county: 'Canyon', zip: '83605', address: '411 Blaine St' },
        { name: 'Coeur d\'Alene', county: 'Kootenai', zip: '83814', address: '710 E Mullan Ave' },
        { name: 'Twin Falls', county: 'Twin Falls', zip: '83301', address: '203 Main Ave E' },
        { name: 'Lewiston', county: 'Nez Perce', zip: '83501', address: '1134 F St' },
        { name: 'Post Falls', county: 'Kootenai', zip: '83854', address: '408 N Spokane St' }
      ]},
      { state: 'IN', cities: [
        { name: 'Indianapolis', county: 'Marion', zip: '46204', address: '200 E Washington St' },
        { name: 'Fort Wayne', county: 'Allen', zip: '46802', address: '1 E Main St' },
        { name: 'Evansville', county: 'Vanderburgh', zip: '47708', address: '1 NW Martin Luther King Jr Blvd' },
        { name: 'South Bend', county: 'St. Joseph', zip: '46601', address: '227 W Jefferson Blvd' },
        { name: 'Carmel', county: 'Hamilton', zip: '46032', address: '1 Civic Square' },
        { name: 'Fishers', county: 'Hamilton', zip: '46038', address: '1 Municipal Dr' },
        { name: 'Bloomington', county: 'Monroe', zip: '47404', address: '401 N Morton St' },
        { name: 'Hammond', county: 'Lake', zip: '46320', address: '5925 Calumet Ave' },
        { name: 'Gary', county: 'Lake', zip: '46402', address: '401 Broadway' },
        { name: 'Muncie', county: 'Delaware', zip: '47305', address: '300 N High St' }
      ]},
      { state: 'IA', cities: [
        { name: 'Des Moines', county: 'Polk', zip: '50309', address: '400 Robert D Ray Dr' },
        { name: 'Cedar Rapids', county: 'Linn', zip: '52401', address: '50 2nd Ave Bridge' },
        { name: 'Davenport', county: 'Scott', zip: '52801', address: '226 W 4th St' },
        { name: 'Sioux City', county: 'Woodbury', zip: '51101', address: '405 6th St' },
        { name: 'Iowa City', county: 'Johnson', zip: '52240', address: '410 E Washington St' },
        { name: 'Waterloo', county: 'Black Hawk', zip: '50701', address: '715 Mulberry St' },
        { name: 'Council Bluffs', county: 'Pottawattamie', zip: '51501', address: '209 Pearl St' },
        { name: 'Ames', county: 'Story', zip: '50010', address: '515 Clark Ave' },
        { name: 'West Des Moines', county: 'Polk', zip: '50265', address: '4200 Mills Civic Pkwy' },
        { name: 'Dubuque', county: 'Dubuque', zip: '52001', address: '50 W 13th St' }
      ]},
      { state: 'KS', cities: [
        { name: 'Wichita', county: 'Sedgwick', zip: '67202', address: '455 N Main St' },
        { name: 'Overland Park', county: 'Johnson', zip: '66212', address: '8500 Santa Fe Dr' },
        { name: 'Kansas City', county: 'Wyandotte', zip: '66101', address: '701 N 7th St' },
        { name: 'Olathe', county: 'Johnson', zip: '66061', address: '100 E Santa Fe St' },
        { name: 'Topeka', county: 'Shawnee', zip: '66603', address: '215 SE 7th St' },
        { name: 'Lawrence', county: 'Douglas', zip: '66044', address: '6 E 6th St' },
        { name: 'Shawnee', county: 'Johnson', zip: '66203', address: '11110 Johnson Dr' },
        { name: 'Manhattan', county: 'Riley', zip: '66502', address: '1101 Poyntz Ave' },
        { name: 'Lenexa', county: 'Johnson', zip: '66219', address: '17101 W 87th St Pkwy' },
        { name: 'Salina', county: 'Saline', zip: '67401', address: '300 W Ash St' }
      ]},
      { state: 'KY', cities: [
        { name: 'Louisville', county: 'Jefferson', zip: '40202', address: '601 W Jefferson St' },
        { name: 'Lexington', county: 'Fayette', zip: '40507', address: '200 E Main St' },
        { name: 'Bowling Green', county: 'Warren', zip: '42101', address: '1001 College St' },
        { name: 'Owensboro', county: 'Daviess', zip: '42301', address: '101 E 4th St' },
        { name: 'Covington', county: 'Kenton', zip: '41011', address: '20 W Pike St' },
        { name: 'Hopkinsville', county: 'Christian', zip: '42240', address: '715 S Virginia St' },
        { name: 'Richmond', county: 'Madison', zip: '40475', address: '239 W Main St' },
        { name: 'Florence', county: 'Boone', zip: '41042', address: '7430 US-42' },
        { name: 'Georgetown', county: 'Scott', zip: '40324', address: '101 E Main St' },
        { name: 'Henderson', county: 'Henderson', zip: '42420', address: '222 1st St' }
      ]},
      { state: 'ME', cities: [
        { name: 'Portland', county: 'Cumberland', zip: '04101', address: '389 Congress St' },
        { name: 'Lewiston', county: 'Androscoggin', zip: '04240', address: '27 Pine St' },
        { name: 'Bangor', county: 'Penobscot', zip: '04401', address: '73 Harlow St' },
        { name: 'South Portland', county: 'Cumberland', zip: '04106', address: '25 Cottage Rd' },
        { name: 'Auburn', county: 'Androscoggin', zip: '04210', address: '60 Court St' },
        { name: 'Biddeford', county: 'York', zip: '04005', address: '205 Main St' },
        { name: 'Saco', county: 'York', zip: '04072', address: '300 Main St' },
        { name: 'Sanford', county: 'York', zip: '04073', address: '919 Main St' },
        { name: 'Augusta', county: 'Kennebec', zip: '04330', address: '16 Cony St' },
        { name: 'Westbrook', county: 'Cumberland', zip: '04092', address: '2 York St' }
      ]},
      { state: 'MD', cities: [
        { name: 'Baltimore', county: 'Baltimore', zip: '21202', address: '100 N Holliday St' },
        { name: 'Frederick', county: 'Frederick', zip: '21701', address: '101 N Court St' },
        { name: 'Rockville', county: 'Montgomery', zip: '20850', address: '111 Maryland Ave' },
        { name: 'Gaithersburg', county: 'Montgomery', zip: '20877', address: '31 S Summit Ave' },
        { name: 'Bowie', county: 'Prince George\'s', zip: '20715', address: '15901 Excalibur Rd' },
        { name: 'Annapolis', county: 'Anne Arundel', zip: '21401', address: '160 Duke of Gloucester St' },
        { name: 'College Park', county: 'Prince George\'s', zip: '20740', address: '4500 Knox Rd' },
        { name: 'Salisbury', county: 'Wicomico', zip: '21801', address: '125 N Division St' },
        { name: 'Laurel', county: 'Prince George\'s', zip: '20707', address: '8103 Sandy Spring Rd' },
        { name: 'Greenbelt', county: 'Prince George\'s', zip: '20770', address: '25 Crescent Rd' }
      ]},
      { state: 'MA', cities: [
        { name: 'Boston', county: 'Suffolk', zip: '02201', address: '1 City Hall Plaza' },
        { name: 'Worcester', county: 'Worcester', zip: '01608', address: '455 Main St' },
        { name: 'Springfield', county: 'Hampden', zip: '01103', address: '36 Court St' },
        { name: 'Lowell', county: 'Middlesex', zip: '01852', address: '50 Arcand Dr' },
        { name: 'Cambridge', county: 'Middlesex', zip: '02139', address: '795 Massachusetts Ave' },
        { name: 'New Bedford', county: 'Bristol', zip: '02740', address: '133 William St' },
        { name: 'Brockton', county: 'Plymouth', zip: '02301', address: '45 School St' },
        { name: 'Quincy', county: 'Norfolk', zip: '02169', address: '1305 Hancock St' },
        { name: 'Lynn', county: 'Essex', zip: '01902', address: '3 City Hall Square' },
        { name: 'Fall River', county: 'Bristol', zip: '02720', address: '1 Government Center' }
      ]},
      { state: 'MN', cities: [
        { name: 'Minneapolis', county: 'Hennepin', zip: '55415', address: '350 S 5th St' },
        { name: 'St. Paul', county: 'Ramsey', zip: '55102', address: '15 W Kellogg Blvd' },
        { name: 'Rochester', county: 'Olmsted', zip: '55904', address: '201 4th St SE' },
        { name: 'Duluth', county: 'St. Louis', zip: '55802', address: '411 W 1st St' },
        { name: 'Bloomington', county: 'Hennepin', zip: '55420', address: '1800 W Old Shakopee Rd' },
        { name: 'Brooklyn Park', county: 'Hennepin', zip: '55443', address: '5200 85th Ave N' },
        { name: 'Plymouth', county: 'Hennepin', zip: '55447', address: '3400 Plymouth Blvd' },
        { name: 'St. Cloud', county: 'Stearns', zip: '56301', address: '400 2nd St S' },
        { name: 'Eagan', county: 'Dakota', zip: '55121', address: '3830 Pilot Knob Rd' },
        { name: 'Woodbury', county: 'Washington', zip: '55125', address: '8301 Valley Creek Rd' }
      ]},
      { state: 'MS', cities: [
        { name: 'Jackson', county: 'Hinds', zip: '39201', address: '219 S President St' },
        { name: 'Gulfport', county: 'Harrison', zip: '39501', address: '2309 15th St' },
        { name: 'Southaven', county: 'DeSoto', zip: '38671', address: '8710 Northwest Dr' },
        { name: 'Hattiesburg', county: 'Forrest', zip: '39401', address: '200 Forrest St' },
        { name: 'Biloxi', county: 'Harrison', zip: '39530', address: '140 Lameuse St' },
        { name: 'Meridian', county: 'Lauderdale', zip: '39301', address: '601 24th Ave' },
        { name: 'Tupelo', county: 'Lee', zip: '38801', address: '71 E Main St' },
        { name: 'Greenville', county: 'Washington', zip: '38701', address: '340 Main St' },
        { name: 'Olive Branch', county: 'DeSoto', zip: '38654', address: '9200 Pigeon Roost Rd' },
        { name: 'Horn Lake', county: 'DeSoto', zip: '38637', address: '3101 Goodman Rd W' }
      ]},
      { state: 'MO', cities: [
        { name: 'Kansas City', county: 'Jackson', zip: '64106', address: '414 E 12th St' },
        { name: 'St. Louis', county: 'St. Louis', zip: '63102', address: '1200 Market St' },
        { name: 'Springfield', county: 'Greene', zip: '65801', address: '840 Boonville Ave' },
        { name: 'Columbia', county: 'Boone', zip: '65201', address: '701 E Broadway' },
        { name: 'Independence', county: 'Jackson', zip: '64050', address: '111 E Maple Ave' },
        { name: 'Lee\'s Summit', county: 'Jackson', zip: '64063', address: '220 SE Green St' },
        { name: 'O\'Fallon', county: 'St. Charles', zip: '63366', address: '100 N Main St' },
        { name: 'St. Joseph', county: 'Buchanan', zip: '64501', address: '1100 Frederick Ave' },
        { name: 'St. Charles', county: 'St. Charles', zip: '63301', address: '200 N 2nd St' },
        { name: 'St. Peters', county: 'St. Charles', zip: '63376', address: '1 St Peters Centre Blvd' }
      ]},
      { state: 'MT', cities: [
        { name: 'Billings', county: 'Yellowstone', zip: '59101', address: '210 N 27th St' },
        { name: 'Missoula', county: 'Missoula', zip: '59801', address: '435 Ryman St' },
        { name: 'Great Falls', county: 'Cascade', zip: '59401', address: '2 Park Dr S' },
        { name: 'Bozeman', county: 'Gallatin', zip: '59715', address: '121 N Rouse Ave' },
        { name: 'Butte', county: 'Silver Bow', zip: '59701', address: '155 W Granite St' },
        { name: 'Helena', county: 'Lewis and Clark', zip: '59601', address: '316 N Park Ave' },
        { name: 'Kalispell', county: 'Flathead', zip: '59901', address: '201 1st Ave E' },
        { name: 'Havre', county: 'Hill', zip: '59501', address: '520 3rd St' },
        { name: 'Anaconda', county: 'Deer Lodge', zip: '59711', address: '401 E Commercial Ave' },
        { name: 'Miles City', county: 'Custer', zip: '59301', address: '1 N 10th St' }
      ]},
      { state: 'NE', cities: [
        { name: 'Omaha', county: 'Douglas', zip: '68102', address: '1819 Farnam St' },
        { name: 'Lincoln', county: 'Lancaster', zip: '68508', address: '555 S 10th St' },
        { name: 'Bellevue', county: 'Sarpy', zip: '68005', address: '210 W Mission Ave' },
        { name: 'Grand Island', county: 'Hall', zip: '68801', address: '100 E 1st St' },
        { name: 'Kearney', county: 'Buffalo', zip: '68847', address: '18 E 22nd St' },
        { name: 'Fremont', county: 'Dodge', zip: '68025', address: '400 E Military Ave' },
        { name: 'Hastings', county: 'Adams', zip: '68901', address: '220 N Hastings Ave' },
        { name: 'North Platte', county: 'Lincoln', zip: '69101', address: '211 W 3rd St' },
        { name: 'Norfolk', county: 'Madison', zip: '68701', address: '309 Madison Ave' },
        { name: 'Columbus', county: 'Platte', zip: '68601', address: '2504 14th St' }
      ]},
      { state: 'NV', cities: [
        { name: 'Las Vegas', county: 'Clark', zip: '89101', address: '495 S Main St' },
        { name: 'Henderson', county: 'Clark', zip: '89009', address: '240 Water St' },
        { name: 'Reno', county: 'Washoe', zip: '89501', address: '1 E 1st St' },
        { name: 'North Las Vegas', county: 'Clark', zip: '89030', address: '2250 Las Vegas Blvd N' },
        { name: 'Sparks', county: 'Washoe', zip: '89431', address: '431 Prater Way' },
        { name: 'Carson City', county: 'Carson City', zip: '89701', address: '201 N Carson St' },
        { name: 'Fernley', county: 'Lyon', zip: '89408', address: '595 Silver Lace Blvd' },
        { name: 'Elko', county: 'Elko', zip: '89801', address: '1751 College Ave' },
        { name: 'Mesquite', county: 'Clark', zip: '89027', address: '10 E Mesquite Blvd' },
        { name: 'Boulder City', county: 'Clark', zip: '89005', address: '401 California Ave' }
      ]},
      { state: 'NH', cities: [
        { name: 'Manchester', county: 'Hillsborough', zip: '03101', address: '1 City Hall Plaza' },
        { name: 'Nashua', county: 'Hillsborough', zip: '03060', address: '229 Main St' },
        { name: 'Concord', county: 'Merrimack', zip: '03301', address: '41 Green St' },
        { name: 'Derry', county: 'Rockingham', zip: '03038', address: '14 Manning St' },
        { name: 'Rochester', county: 'Strafford', zip: '03867', address: '31 Wakefield St' },
        { name: 'Salem', county: 'Rockingham', zip: '03079', address: '33 Geremonty Dr' },
        { name: 'Dover', county: 'Strafford', zip: '03820', address: '288 Central Ave' },
        { name: 'Merrimack', county: 'Hillsborough', zip: '03054', address: '6 Baboosic Lake Rd' },
        { name: 'Londonderry', county: 'Rockingham', zip: '03053', address: '268 Mammoth Rd' },
        { name: 'Hudson', county: 'Hillsborough', zip: '03051', address: '12 School St' }
      ]},
      { state: 'NM', cities: [
        { name: 'Albuquerque', county: 'Bernalillo', zip: '87102', address: '1 Civic Plaza NW' },
        { name: 'Las Cruces', county: 'Doña Ana', zip: '88001', address: '700 N Main St' },
        { name: 'Rio Rancho', county: 'Sandoval', zip: '87124', address: '3200 Civic Center Dr NE' },
        { name: 'Santa Fe', county: 'Santa Fe', zip: '87501', address: '200 Lincoln Ave' },
        { name: 'Roswell', county: 'Chaves', zip: '88201', address: '425 N Richardson Ave' },
        { name: 'Farmington', county: 'San Juan', zip: '87401', address: '800 Municipal Dr' },
        { name: 'Clovis', county: 'Curry', zip: '88101', address: '321 Connelly St' },
        { name: 'Hobbs', county: 'Lea', zip: '88240', address: '200 E Broadway' },
        { name: 'Carlsbad', county: 'Eddy', zip: '88220', address: '101 N Halagueno St' },
        { name: 'Gallup', county: 'McKinley', zip: '87301', address: '110 W Aztec Ave' }
      ]},
      { state: 'ND', cities: [
        { name: 'Fargo', county: 'Cass', zip: '58102', address: '225 4th St N' },
        { name: 'Bismarck', county: 'Burleigh', zip: '58501', address: '221 N 5th St' },
        { name: 'Grand Forks', county: 'Grand Forks', zip: '58201', address: '255 N 4th St' },
        { name: 'Minot', county: 'Ward', zip: '58701', address: '515 2nd Ave SW' },
        { name: 'West Fargo', county: 'Cass', zip: '58078', address: '800 4th Ave E' },
        { name: 'Williston', county: 'Williams', zip: '58801', address: '22 E Broadway' },
        { name: 'Dickinson', county: 'Stark', zip: '58601', address: '99 2nd St E' },
        { name: 'Mandan', county: 'Morton', zip: '58554', address: '205 2nd Ave NW' },
        { name: 'Jamestown', county: 'Stutsman', zip: '58401', address: '210 3rd Ave SE' },
        { name: 'Wahpeton', county: 'Richland', zip: '58075', address: '1900 4th St N' }
      ]},
      { state: 'OK', cities: [
        { name: 'Oklahoma City', county: 'Oklahoma', zip: '73102', address: '200 N Walker Ave' },
        { name: 'Tulsa', county: 'Tulsa', zip: '74103', address: '175 E 2nd St' },
        { name: 'Norman', county: 'Cleveland', zip: '73069', address: '201 W Gray St' },
        { name: 'Broken Arrow', county: 'Tulsa', zip: '74012', address: '220 S 1st St' },
        { name: 'Lawton', county: 'Comanche', zip: '73501', address: '110 SW 4th St' },
        { name: 'Edmond', county: 'Oklahoma', zip: '73034', address: '100 E 1st St' },
        { name: 'Moore', county: 'Cleveland', zip: '73160', address: '301 N Broadway St' },
        { name: 'Midwest City', county: 'Oklahoma', zip: '73110', address: '100 N Midwest Blvd' },
        { name: 'Enid', county: 'Garfield', zip: '73701', address: '401 W Owen K Garriott Rd' },
        { name: 'Stillwater', county: 'Payne', zip: '74074', address: '723 S Lewis St' }
      ]},
      { state: 'OR', cities: [
        { name: 'Portland', county: 'Multnomah', zip: '97204', address: '1221 SW 4th Ave' },
        { name: 'Eugene', county: 'Lane', zip: '97401', address: '777 Pearl St' },
        { name: 'Salem', county: 'Marion', zip: '97301', address: '555 Liberty St SE' },
        { name: 'Gresham', county: 'Multnomah', zip: '97030', address: '1333 NW Eastman Pkwy' },
        { name: 'Hillsboro', county: 'Washington', zip: '97123', address: '150 E Main St' },
        { name: 'Bend', county: 'Deschutes', zip: '97701', address: '710 NW Wall St' },
        { name: 'Medford', county: 'Jackson', zip: '97501', address: '411 W 8th St' },
        { name: 'Springfield', county: 'Lane', zip: '97477', address: '225 5th St' },
        { name: 'Corvallis', county: 'Benton', zip: '97330', address: '501 SW Madison Ave' },
        { name: 'Albany', county: 'Linn', zip: '97321', address: '333 Broadalbin St SW' }
      ]},
      { state: 'RI', cities: [
        { name: 'Providence', county: 'Providence', zip: '02903', address: '25 Dorrance St' },
        { name: 'Warwick', county: 'Kent', zip: '02886', address: '3275 Post Rd' },
        { name: 'Cranston', county: 'Providence', zip: '02910', address: '869 Park Ave' },
        { name: 'Pawtucket', county: 'Providence', zip: '02860', address: '137 Roosevelt Ave' },
        { name: 'East Providence', county: 'Providence', zip: '02914', address: '145 Taunton Ave' },
        { name: 'Woonsocket', county: 'Providence', zip: '02895', address: '169 Main St' },
        { name: 'Newport', county: 'Newport', zip: '02840', address: '43 Broadway' },
        { name: 'Central Falls', county: 'Providence', zip: '02863', address: '580 Broad St' },
        { name: 'Westerly', county: 'Washington', zip: '02891', address: '45 Broad St' },
        { name: 'Cumberland', county: 'Providence', zip: '02864', address: '45 Broad St' }
      ]},
      { state: 'SC', cities: [
        { name: 'Charleston', county: 'Charleston', zip: '29401', address: '80 Broad St' },
        { name: 'Columbia', county: 'Richland', zip: '29201', address: '1737 Main St' },
        { name: 'North Charleston', county: 'Charleston', zip: '29405', address: '2500 City Hall Ln' },
        { name: 'Mount Pleasant', county: 'Charleston', zip: '29464', address: '100 Ann Edwards Ln' },
        { name: 'Rock Hill', county: 'York', zip: '29730', address: '155 Johnston St' },
        { name: 'Greenville', county: 'Greenville', zip: '29601', address: '206 S Main St' },
        { name: 'Summerville', county: 'Dorchester', zip: '29483', address: '200 S Main St' },
        { name: 'Sumter', county: 'Sumter', zip: '29150', address: '21 N Main St' },
        { name: 'Hilton Head Island', county: 'Beaufort', zip: '29928', address: '1 Town Center Ct' },
        { name: 'Spartanburg', county: 'Spartanburg', zip: '29306', address: '145 W Broad St' }
      ]},
      { state: 'SD', cities: [
        { name: 'Sioux Falls', county: 'Minnehaha', zip: '57104', address: '224 W 9th St' },
        { name: 'Rapid City', county: 'Pennington', zip: '57701', address: '300 6th St' },
        { name: 'Aberdeen', county: 'Brown', zip: '57401', address: '123 S Lincoln St' },
        { name: 'Watertown', county: 'Codington', zip: '57201', address: '23 2nd St NE' },
        { name: 'Brookings', county: 'Brookings', zip: '57006', address: '520 3rd St' },
        { name: 'Mitchell', county: 'Davison', zip: '57301', address: '612 N Main St' },
        { name: 'Yankton', county: 'Yankton', zip: '57078', address: '416 Walnut St' },
        { name: 'Pierre', county: 'Hughes', zip: '57501', address: '222 E Capitol Ave' },
        { name: 'Huron', county: 'Beadle', zip: '57350', address: '335 3rd St SW' },
        { name: 'Vermillion', county: 'Clay', zip: '57069', address: '15 Center St' }
      ]},
      { state: 'TN', cities: [
        { name: 'Nashville', county: 'Davidson', zip: '37201', address: '1 Public Square' },
        { name: 'Memphis', county: 'Shelby', zip: '38103', address: '125 N Main St' },
        { name: 'Knoxville', county: 'Knox', zip: '37902', address: '400 Main St' },
        { name: 'Chattanooga', county: 'Hamilton', zip: '37402', address: '101 E 11th St' },
        { name: 'Clarksville', county: 'Montgomery', zip: '37040', address: '1 Public Square' },
        { name: 'Murfreesboro', county: 'Rutherford', zip: '37130', address: '111 W Vine St' },
        { name: 'Franklin', county: 'Williamson', zip: '37064', address: '109 3rd Ave S' },
        { name: 'Jackson', county: 'Madison', zip: '38301', address: '101 E Main St' },
        { name: 'Johnson City', county: 'Washington', zip: '37601', address: '601 E Main St' },
        { name: 'Bartlett', county: 'Shelby', zip: '38134', address: '6400 Stage Rd' }
      ]},
      { state: 'UT', cities: [
        { name: 'Salt Lake City', county: 'Salt Lake', zip: '84111', address: '451 S State St' },
        { name: 'West Valley City', county: 'Salt Lake', zip: '84119', address: '3600 S Constitution Blvd' },
        { name: 'Provo', county: 'Utah', zip: '84601', address: '351 W Center St' },
        { name: 'West Jordan', county: 'Salt Lake', zip: '84088', address: '8000 S Redwood Rd' },
        { name: 'Orem', county: 'Utah', zip: '84057', address: '56 N State St' },
        { name: 'Sandy', county: 'Salt Lake', zip: '84070', address: '10000 Centennial Pkwy' },
        { name: 'Ogden', county: 'Weber', zip: '84401', address: '2549 Washington Blvd' },
        { name: 'St. George', county: 'Washington', zip: '84770', address: '175 E 200 N' },
        { name: 'Layton', county: 'Davis', zip: '84041', address: '437 N Wasatch Dr' },
        { name: 'Taylorsville', county: 'Salt Lake', zip: '84123', address: '2600 Taylorsville Blvd' }
      ]},
      { state: 'VT', cities: [
        { name: 'Burlington', county: 'Chittenden', zip: '05401', address: '149 Church St' },
        { name: 'Essex', county: 'Chittenden', zip: '05452', address: '81 Main St' },
        { name: 'South Burlington', county: 'Chittenden', zip: '05403', address: '180 Market St' },
        { name: 'Colchester', county: 'Chittenden', zip: '05446', address: '781 Blakely Rd' },
        { name: 'Rutland', county: 'Rutland', zip: '05701', address: '1 Strongs Ave' },
        { name: 'Montpelier', county: 'Washington', zip: '05602', address: '39 Main St' },
        { name: 'Barre', county: 'Washington', zip: '05641', address: '6 N Main St' },
        { name: 'St. Albans', county: 'Franklin', zip: '05478', address: '100 N Main St' },
        { name: 'Brattleboro', county: 'Windham', zip: '05301', address: '230 Main St' },
        { name: 'Milton', county: 'Chittenden', zip: '05468', address: '43 Bombardier Rd' }
      ]},
      { state: 'WV', cities: [
        { name: 'Charleston', county: 'Kanawha', zip: '25301', address: '501 Virginia St E' },
        { name: 'Huntington', county: 'Cabell', zip: '25701', address: '800 5th Ave' },
        { name: 'Parkersburg', county: 'Wood', zip: '26101', address: '1 Government Square' },
        { name: 'Morgantown', county: 'Monongalia', zip: '26505', address: '389 Spruce St' },
        { name: 'Wheeling', county: 'Ohio', zip: '26003', address: '1500 Chapline St' },
        { name: 'Martinsburg', county: 'Berkeley', zip: '25401', address: '232 N Queen St' },
        { name: 'Fairmont', county: 'Marion', zip: '26554', address: '200 Jackson St' },
        { name: 'Beckley', county: 'Raleigh', zip: '25801', address: '409 S Kanawha St' },
        { name: 'Clarksburg', county: 'Harrison', zip: '26301', address: '222 W Main St' },
        { name: 'South Charleston', county: 'Kanawha', zip: '25309', address: '4th Ave & D St' }
      ]},
      { state: 'WI', cities: [
        { name: 'Milwaukee', county: 'Milwaukee', zip: '53202', address: '200 E Wells St' },
        { name: 'Madison', county: 'Dane', zip: '53703', address: '215 Martin Luther King Jr Blvd' },
        { name: 'Green Bay', county: 'Brown', zip: '54301', address: '100 N Jefferson St' },
        { name: 'Kenosha', county: 'Kenosha', zip: '53140', address: '625 52nd St' },
        { name: 'Racine', county: 'Racine', zip: '53403', address: '730 Washington Ave' },
        { name: 'Appleton', county: 'Outagamie', zip: '54911', address: '100 N Appleton St' },
        { name: 'Waukesha', county: 'Waukesha', zip: '53186', address: '201 Delafield St' },
        { name: 'Oshkosh', county: 'Winnebago', zip: '54901', address: '215 Church Ave' },
        { name: 'Eau Claire', county: 'Eau Claire', zip: '54701', address: '203 S Farwell St' },
        { name: 'Janesville', county: 'Rock', zip: '53545', address: '18 N Jackson St' }
      ]},
      { state: 'WY', cities: [
        { name: 'Cheyenne', county: 'Laramie', zip: '82001', address: '2101 O\'Neil Ave' },
        { name: 'Casper', county: 'Natrona', zip: '82601', address: '200 N David St' },
        { name: 'Laramie', county: 'Albany', zip: '82070', address: '406 Ivinson Ave' },
        { name: 'Gillette', county: 'Campbell', zip: '82716', address: '201 E 5th St' },
        { name: 'Rock Springs', county: 'Sweetwater', zip: '82901', address: '212 D St' },
        { name: 'Sheridan', county: 'Sheridan', zip: '82801', address: '55 Grinnell Plaza' },
        { name: 'Green River', county: 'Sweetwater', zip: '82935', address: '50 E 2nd N' },
        { name: 'Evanston', county: 'Uinta', zip: '82930', address: '1200 Main St' },
        { name: 'Riverton', county: 'Fremont', zip: '82501', address: '816 E Washington Ave' },
        { name: 'Jackson', county: 'Teton', zip: '83001', address: '150 E Pearl Ave' }
      ]}
    ];

    const milestones = [
      { name: 'Application', count: Math.floor(count * 0.30) },
      { name: 'Processing', count: Math.floor(count * 0.25) },
      { name: 'Underwriting', count: Math.floor(count * 0.25) },
      { name: 'Closing', count: Math.floor(count * 0.15) },
      { name: 'Funded', count: Math.floor(count * 0.05) }
    ];

    // Ensure we have at least 1 loan for each milestone
    milestones.forEach(milestone => {
      if (milestone.count === 0) milestone.count = 1;
    });

    const loanTypes = ['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo'];
    const generatedLoanIds = [];

    let loanCounter = 0;
    let milestoneIndex = 0;
    let milestoneCount = 0;

    for (let i = 0; i < count; i++) {
      // Select state and city - cycle through all states proportionally
      const stateData = testData[i % testData.length];
      const cityIndex = Math.floor(Math.random() * stateData.cities.length);
      const cityInfo = stateData.cities[cityIndex];
      const city = cityInfo.name;
      const county = cityInfo.county;
      const state = stateData.state;
      const propertyAddress = cityInfo.address; // Use REAL address
      const zipCode = cityInfo.zip; // Use REAL zip code

      // Generate realistic loan data with unique loan numbers
      const loanNumber = `LN${String(startLoanNumber + i).padStart(7, '0')}`;
      const borrowerName = `Test Borrower ${startLoanNumber + i}`;
      const loanAmount = Math.floor(Math.random() * 600000) + 200000; // $200K - $800K
      const loanType = loanTypes[Math.floor(Math.random() * loanTypes.length)];

      // Assign milestone
      if (milestoneCount >= milestones[milestoneIndex].count) {
        milestoneIndex++;
        milestoneCount = 0;
      }
      
      // Ensure we don't go out of bounds
      if (milestoneIndex >= milestones.length) {
        milestoneIndex = milestones.length - 1;
      }
      
      const milestone = milestones[milestoneIndex].name;
      milestoneCount++;

      // Geocode the address properly with validation
      let latitude = null;
      let longitude = null;
      
      try {
        const fullAddress = `${propertyAddress}, ${city}, ${state} ${zipCode}`;
        const coords = await geocodeAddress(fullAddress, state, county);
        latitude = coords.latitude;
        longitude = coords.longitude;
        
        if (!coords.validated && coords.latitude) {
          console.warn(`⚠️  Geocoding may be inaccurate for loan ${loanNumber}: ${fullAddress}`);
        }
        
        // Rate limiting for geocoding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`⚠️  Could not geocode ${propertyAddress}, skipping coordinates`);
        // Don't use random fallback - leave as null so it can be fixed later
        latitude = null;
        longitude = null;
      }

      try {
        const result = await pool.query(`
          INSERT INTO loans (
            loan_number, borrower_name, property_address, city, state, county, zip_code,
            latitude, longitude, loan_amount, loan_type, milestone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          loanNumber, borrowerName, propertyAddress, city, state, county, zipCode,
          latitude, longitude, loanAmount, loanType, milestone
        ]);

        generatedLoanIds.push(result.rows[0].id);
        loanCounter++;

        if (loanCounter % 20 === 0) {
          console.log(`🔄 Generated ${loanCounter}/${count} loans...`);
        }
      } catch (error) {
        console.error(`❌ Error generating loan ${i + 1}:`, error.message);
        // Continue with next loan
      }
    }

    console.log(`✅ Generated ${generatedLoanIds.length} test loans successfully`);
    return generatedLoanIds;
  } catch (error) {
    console.error('❌ Error generating test loans:', error.message);
    throw error;
  }
}

/**
 * Normalize county name for ILIKE matching (strip FEMA " (County)" suffix).
 * @param {string} name
 * @returns {string}
 */
export function normalizeCountyName(name) {
  return String(name || '').replace(/\s*\(County\)$/i, '').trim();
}

/**
 * Filter loans within radius (miles) of a point; excludes rows without coordinates.
 * @param {Array} loans
 * @param {number} nearLat
 * @param {number} nearLng
 * @param {number} radiusMiles
 * @returns {Array}
 */
export function filterLoansByDistance(loans, nearLat, nearLng, radiusMiles) {
  const radiusKm = radiusMiles * 1.60934;
  return loans.filter((loan) => {
    const lat = parseFloat(loan.latitude);
    const lng = parseFloat(loan.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    const km = calculateDistance(nearLat, nearLng, lat, lng);
    return km !== null && km <= radiusKm;
  });
}

/**
 * Get all loans with risk data
 * @param {Object} filters - Optional filters (milestone, state, county, riskLevel, nearLat, nearLng, radiusMiles)
 * @returns {Promise<Array>} Array of loan objects
 */
export async function getAllLoans(filters = {}) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    let query = `
      SELECT 
        id, loan_number, borrower_name, property_address, city, state, county, zip_code,
        latitude, longitude, loan_amount, loan_type, milestone,
        disaster_risk_score, disaster_declaration_count, fema_data,
        flood_zone, flood_zone_type, dfirm_id, base_flood_elevation, flood_zone_data, last_flood_zone_check,
        last_risk_analysis, encompass_loan_guid, created_at, updated_at
      FROM loans
    `;
    
    const conditions = [];
    const params = [];
    let paramCount = 0;

    if (filters.milestone) {
      paramCount++;
      conditions.push(`milestone = $${paramCount}`);
      params.push(filters.milestone);
    }

    if (filters.state) {
      paramCount++;
      conditions.push(`state = $${paramCount}`);
      params.push(filters.state);
    }

    if (filters.county) {
      const normalizedCounty = normalizeCountyName(filters.county);
      if (normalizedCounty) {
        paramCount++;
        conditions.push(`county ILIKE $${paramCount}`);
        params.push(`%${normalizedCounty}%`);
      }
    }

    if (filters.riskLevel) {
      paramCount++;
      switch (filters.riskLevel) {
        case 'low':
          conditions.push(`disaster_risk_score BETWEEN 0 AND 2`);
          break;
        case 'medium':
          conditions.push(`disaster_risk_score BETWEEN 3 AND 5`);
          break;
        case 'high':
          conditions.push(`disaster_risk_score >= 6`);
          break;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    let rows = result.rows;

    if (
      filters.nearLat != null &&
      filters.nearLng != null &&
      filters.radiusMiles != null
    ) {
      rows = filterLoansByDistance(
        rows,
        filters.nearLat,
        filters.nearLng,
        filters.radiusMiles
      );
    }

    return rows;
  } catch (error) {
    console.error('❌ Error getting all loans:', error.message);
    throw error;
  }
}

/**
 * Get loans filtered by milestone
 * @param {string} milestone - Pipeline milestone
 * @returns {Promise<Array>} Array of loan objects
 */
export async function getLoansByMilestone(milestone) {
  return getAllLoans({ milestone });
}

/**
 * Geocode existing loans that don't have coordinates
 * @param {number} limit - Maximum number of loans to geocode
 * @returns {Promise<Object>} Results with geocoded count
 */
export async function geocodeMissingLoans(limit = 100) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    // Get loans without coordinates
    const result = await pool.query(`
      SELECT id, property_address, city, state, county, zip_code
      FROM loans
      WHERE (latitude IS NULL OR longitude IS NULL)
        AND property_address IS NOT NULL
        AND city IS NOT NULL
        AND state IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    if (result.rows.length === 0) {
      return {
        success: true,
        message: 'All loans already have coordinates',
        geocoded: 0,
        total: 0
      };
    }

    console.log(`🌍 Geocoding ${result.rows.length} loans...`);
    let geocoded = 0;
    let failed = 0;

    for (const loan of result.rows) {
      try {
        const fullAddress = `${loan.property_address}, ${loan.city}, ${loan.state} ${loan.zip_code || ''}`;
        const coords = await geocodeAddress(fullAddress, loan.state, loan.county);

        if (coords.latitude && coords.longitude) {
          await pool.query(
            'UPDATE loans SET latitude = $1, longitude = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [coords.latitude, coords.longitude, loan.id]
          );
          geocoded++;
        } else {
          failed++;
        }

        // Rate limiting for geocoding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error geocoding loan ${loan.id}:`, error.message);
        failed++;
      }
    }

    return {
      success: true,
      message: `Geocoded ${geocoded} loans`,
      geocoded,
      failed,
      total: result.rows.length
    };
  } catch (error) {
    console.error('❌ Error geocoding loans:', error.message);
    throw error;
  }
}

/**
 * Check if coordinates are suspicious (likely incorrect)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} expectedState - Expected state abbreviation
 * @returns {boolean} True if coordinates seem incorrect
 */
function areCoordinatesSuspicious(lat, lng, expectedState) {
  if (!lat || !lng || !expectedState) return false;
  
  // Approximate US state boundaries (simplified)
  const stateBounds = {
    'NC': { latMin: 33.8, latMax: 36.6, lngMin: -84.3, lngMax: -75.4 },
    'CA': { latMin: 32.5, latMax: 42.0, lngMin: -124.5, lngMax: -114.1 },
    'TX': { latMin: 25.8, latMax: 36.5, lngMin: -106.6, lngMax: -93.5 },
    'FL': { latMin: 24.4, latMax: 31.0, lngMin: -87.6, lngMax: -80.0 },
    'NY': { latMin: 40.5, latMax: 45.0, lngMin: -79.8, lngMax: -71.8 },
    'IL': { latMin: 36.9, latMax: 42.5, lngMin: -91.5, lngMax: -87.0 },
    'PA': { latMin: 39.7, latMax: 42.3, lngMin: -80.5, lngMax: -74.7 },
    'OH': { latMin: 38.4, latMax: 42.0, lngMin: -84.8, lngMax: -80.5 },
    'GA': { latMin: 30.3, latMax: 35.0, lngMin: -85.6, lngMax: -80.8 },
    'MI': { latMin: 41.7, latMax: 48.3, lngMin: -90.4, lngMax: -82.1 },
    'AZ': { latMin: 31.3, latMax: 37.0, lngMin: -114.8, lngMax: -109.0 },
    'WA': { latMin: 45.5, latMax: 49.0, lngMin: -124.8, lngMax: -116.9 },
    'MA': { latMin: 41.2, latMax: 42.9, lngMin: -73.5, lngMax: -69.9 },
    'TN': { latMin: 35.0, latMax: 36.7, lngMin: -90.3, lngMax: -81.6 },
    'IN': { latMin: 37.7, latMax: 41.8, lngMin: -88.1, lngMax: -84.8 },
    'MO': { latMin: 36.0, latMax: 40.6, lngMin: -95.8, lngMax: -89.1 },
    'MD': { latMin: 37.9, latMax: 39.7, lngMin: -79.5, lngMax: -75.0 },
    'WI': { latMin: 42.4, latMax: 47.1, lngMin: -92.9, lngMax: -86.8 },
    'CO': { latMin: 36.9, latMax: 41.0, lngMin: -109.1, lngMax: -102.0 },
    'MN': { latMin: 43.5, latMax: 49.4, lngMin: -97.2, lngMax: -89.5 }
  };
  
  const bounds = stateBounds[expectedState.toUpperCase()];
  if (!bounds) return false; // Unknown state, can't validate
  
  // Check if coordinates are outside state bounds
  const isOutsideBounds = lat < bounds.latMin || lat > bounds.latMax || 
                          lng < bounds.lngMin || lng > bounds.lngMax;
  
  // Also check if coordinates are in Pacific (common error for NC addresses)
  const isInPacific = (lng < -130 || lng > -110) && lat > 20 && lat < 50;
  
  return isOutsideBounds || isInPacific;
}

/**
 * Re-geocode loans with incorrect or suspicious coordinates
 * @param {number} limit - Maximum number of loans to re-geocode
 * @param {boolean} forceAll - If true, re-geocode all loans with coordinates; if false, only suspicious ones
 * @returns {Promise<Object>} Results with re-geocoded count
 */
export async function regeocodeIncorrectLoans(limit = 100, forceAll = false) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    let query;
    let params;
    
    if (forceAll) {
      // Re-geocode all loans with coordinates
      query = `
        SELECT id, property_address, city, state, county, zip_code, latitude, longitude
        FROM loans
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND property_address IS NOT NULL
          AND city IS NOT NULL
          AND state IS NOT NULL
        ORDER BY updated_at ASC
        LIMIT $1
      `;
      params = [limit];
    } else {
      // Only re-geocode loans with suspicious coordinates
      // We'll filter in JavaScript since PostgreSQL doesn't have easy state boundary functions
      query = `
        SELECT id, property_address, city, state, county, zip_code, latitude, longitude
        FROM loans
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND property_address IS NOT NULL
          AND city IS NOT NULL
          AND state IS NOT NULL
        ORDER BY updated_at ASC
        LIMIT $1
      `;
      params = [limit * 2]; // Get more to filter suspicious ones
    }
    
    const result = await pool.query(query, params);
    
    // Filter for suspicious coordinates if not forcing all
    let loansToRegeocode = result.rows;
    if (!forceAll) {
      loansToRegeocode = result.rows.filter(loan => 
        areCoordinatesSuspicious(loan.latitude, loan.longitude, loan.state)
      ).slice(0, limit);
    }
    
    if (loansToRegeocode.length === 0) {
      return {
        success: true,
        message: forceAll ? 'No loans to re-geocode' : 'No loans with suspicious coordinates found',
        regeocoded: 0,
        total: 0,
        suspicious: 0
      };
    }

    console.log(`🌍 Re-geocoding ${loansToRegeocode.length} loans${forceAll ? '' : ' with suspicious coordinates'}...`);
    let regeocoded = 0;
    let failed = 0;
    let unchanged = 0;

    for (const loan of loansToRegeocode) {
      try {
        const fullAddress = `${loan.property_address}, ${loan.city}, ${loan.state} ${loan.zip_code || ''}`;
        const coords = await geocodeAddress(fullAddress, loan.state, loan.county);

        if (coords.latitude && coords.longitude && coords.validated) {
          // Check if coordinates actually changed
          const latChanged = Math.abs(parseFloat(coords.latitude) - parseFloat(loan.latitude)) > 0.001;
          const lngChanged = Math.abs(parseFloat(coords.longitude) - parseFloat(loan.longitude)) > 0.001;
          
          if (latChanged || lngChanged) {
            await pool.query(
              'UPDATE loans SET latitude = $1, longitude = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [coords.latitude, coords.longitude, loan.id]
            );
            regeocoded++;
            console.log(`✅ Fixed coordinates for loan ${loan.id}: ${loan.city}, ${loan.state} (was: ${loan.latitude}, ${loan.longitude} → now: ${coords.latitude}, ${coords.longitude})`);
          } else {
            unchanged++;
          }
        } else {
          failed++;
          console.warn(`⚠️  Failed to re-geocode loan ${loan.id}: ${fullAddress}`);
        }

        // Rate limiting for geocoding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error re-geocoding loan ${loan.id}:`, error.message);
        failed++;
      }
    }

    return {
      success: true,
      message: `Re-geocoded ${regeocoded} loans${forceAll ? '' : ' with suspicious coordinates'}`,
      regeocoded,
      failed,
      unchanged,
      total: loansToRegeocode.length
    };
  } catch (error) {
    console.error('❌ Error re-geocoding loans:', error.message);
    throw error;
  }
}

/**
 * Get single loan by ID
 * @param {number} loanId - Loan ID
 * @returns {Promise<Object|null>} Loan object or null
 */
export async function getLoanById(loanId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await pool.query(`
      SELECT 
        id, loan_number, borrower_name, property_address, city, state, county, zip_code,
        latitude, longitude, loan_amount, loan_type, milestone,
        disaster_risk_score, disaster_declaration_count, fema_data,
        flood_zone, flood_zone_type, dfirm_id, base_flood_elevation, flood_zone_data, last_flood_zone_check,
        last_risk_analysis, encompass_loan_guid, created_at, updated_at
      FROM loans
      WHERE id = $1
    `, [loanId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error getting loan by ID:', error.message);
    throw error;
  }
}

/**
 * Update loan risk score and FEMA data
 * @param {number} loanId - Loan ID
 * @param {number} score - Risk score
 * @param {number} declarationCount - Number of disaster declarations
 * @param {Object} femaData - FEMA API response data
 * @returns {Promise<boolean>} Success status
 */
export async function updateLoanRiskScore(loanId, score, declarationCount, femaData = null) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await pool.query(`
      UPDATE loans 
      SET 
        disaster_risk_score = $2,
        disaster_declaration_count = $3,
        fema_data = $4,
        last_risk_analysis = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `, [loanId, score, declarationCount, femaData ? JSON.stringify(femaData) : null]);

    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Error updating loan risk score:', error.message);
    throw error;
  }
}

/**
 * Get pipeline statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getPipelineStats() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    // Get total counts
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM loans');
    const totalLoans = parseInt(totalResult.rows[0].total);

    // Get milestone breakdown
    const milestoneResult = await pool.query(`
      SELECT milestone, COUNT(*) as count 
      FROM loans 
      GROUP BY milestone 
      ORDER BY count DESC
    `);

    // Get risk level breakdown
    const riskResult = await pool.query(`
      SELECT 
        CASE 
          WHEN disaster_risk_score BETWEEN 0 AND 2 THEN 'Low Risk'
          WHEN disaster_risk_score BETWEEN 3 AND 5 THEN 'Medium Risk'
          WHEN disaster_risk_score >= 6 THEN 'High Risk'
          ELSE 'Not Analyzed'
        END as risk_level,
        COUNT(*) as count
      FROM loans 
      GROUP BY 
        CASE 
          WHEN disaster_risk_score BETWEEN 0 AND 2 THEN 'Low Risk'
          WHEN disaster_risk_score BETWEEN 3 AND 5 THEN 'Medium Risk'
          WHEN disaster_risk_score >= 6 THEN 'High Risk'
          ELSE 'Not Analyzed'
        END
      ORDER BY count DESC
    `);

    // Get state breakdown
    const stateResult = await pool.query(`
      SELECT state, COUNT(*) as count 
      FROM loans 
      GROUP BY state 
      ORDER BY count DESC 
      LIMIT 10
    `);

    return {
      totalLoans,
      milestones: milestoneResult.rows,
      riskLevels: riskResult.rows,
      topStates: stateResult.rows
    };
  } catch (error) {
    console.error('❌ Error getting pipeline stats:', error.message);
    throw error;
  }
}

/**
 * Delete all test loans (for cleanup)
 * @returns {Promise<number>} Number of deleted loans
 */
export async function deleteAllTestLoans() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await pool.query('DELETE FROM loans WHERE loan_number LIKE \'LN%\'');
    console.log(`✅ Deleted ${result.rowCount} test loans`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error deleting test loans:', error.message);
    throw error;
  }
}

export default {
  generateTestLoans,
  getAllLoans,
  getLoansByMilestone,
  getLoanById,
  geocodeMissingLoans,
  regeocodeIncorrectLoans,
  updateLoanRiskScore,
  getPipelineStats,
  deleteAllTestLoans
};

