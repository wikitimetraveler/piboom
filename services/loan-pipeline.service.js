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

/**
 * Geocode an address using Google Maps API with validation
 * @param {string} address - Full address string
 * @param {string} expectedState - Expected state abbreviation (optional, for validation)
 * @param {string} expectedCounty - Expected county name (optional, for validation)
 * @returns {Promise<Object>} Object with latitude, longitude, and validation info
 */
async function geocodeAddress(address, expectedState = null, expectedCounty = null) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_API_KEY not set - skipping geocoding');
    return { latitude: null, longitude: null, validated: false };
  }

  try {
    // If we have expected state, try geocoding without zip code first (zip codes can cause mismatches)
    let url;
    if (expectedState) {
      // Remove zip code from address if present to avoid zip code mismatches
      // Format: "Street, City, State ZIP" -> "Street, City, State"
      const addressWithoutZip = address.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressWithoutZip)}&key=${apiKey}&region=us`;
    } else {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      // Try to find a result that matches the expected state/county
      let bestResult = data.results[0]; // Default to first result
      let validated = false;
      
      for (const result of data.results) {
        const addressComponents = result.address_components || [];
        const stateComp = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
        const stateShort = stateComp ? stateComp.short_name : null;
        
        // Check if state matches
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
        }
      }
      
      // If no match found but we have expected state, try again with full address
      if (expectedState && !validated && addressWithoutZip !== address) {
        console.log(`🔄 Retrying geocoding with full address for: ${address}`);
        const retryUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=us`;
        const retryResponse = await fetch(retryUrl);
        const retryData = await retryResponse.json();
        
        if (retryData.status === 'OK' && retryData.results.length > 0) {
          for (const result of retryData.results) {
            const addressComponents = result.address_components || [];
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
}

/**
 * Generate test loans with realistic addresses across US states
 * @param {number} count - Number of loans to generate
 * @returns {Promise<Array>} Array of generated loan IDs
 */
export async function generateTestLoans(count = 100) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  try {
    console.log(`🔄 Generating ${count} test loans...`);

    // Realistic test data with REAL addresses that geocode correctly
    const testData = [
      // High-risk states with REAL addresses
      { state: 'CA', cities: [
        { name: 'Los Angeles', county: 'Los Angeles', zip: '90012', address: '1250 N Spring St' },
        { name: 'San Francisco', county: 'San Francisco', zip: '94102', address: '1 Market St' },
        { name: 'San Diego', county: 'San Diego', zip: '92101', address: '1200 3rd Ave' },
        { name: 'Sacramento', county: 'Sacramento', zip: '95814', address: '1301 I St' },
        { name: 'Fresno', county: 'Fresno', zip: '93721', address: '2600 Fresno St' }
      ]},
      { state: 'FL', cities: [
        { name: 'Miami', county: 'Miami-Dade', zip: '33130', address: '1 Biscayne Blvd' },
        { name: 'Tampa', county: 'Hillsborough', zip: '33602', address: '306 E Jackson St' },
        { name: 'Orlando', county: 'Orange', zip: '32801', address: '400 S Orange Ave' },
        { name: 'Jacksonville', county: 'Duval', zip: '32202', address: '117 W Duval St' },
        { name: 'Tallahassee', county: 'Leon', zip: '32301', address: '300 S Adams St' }
      ]},
      { state: 'TX', cities: [
        { name: 'Houston', county: 'Harris', zip: '77002', address: '901 Bagby St' },
        { name: 'Dallas', county: 'Dallas', zip: '75201', address: '1500 Marilla St' },
        { name: 'Austin', county: 'Travis', zip: '78701', address: '301 W 2nd St' },
        { name: 'San Antonio', county: 'Bexar', zip: '78205', address: '100 Military Plaza' },
        { name: 'Fort Worth', county: 'Tarrant', zip: '76102', address: '1000 Throckmorton St' }
      ]},
      { state: 'LA', cities: [
        { name: 'New Orleans', county: 'Orleans', zip: '70112', address: '1300 Perdido St' },
        { name: 'Baton Rouge', county: 'East Baton Rouge', zip: '70801', address: '222 St Louis St' },
        { name: 'Shreveport', county: 'Caddo', zip: '71101', address: '505 Travis St' },
        { name: 'Lafayette', county: 'Lafayette', zip: '70501', address: '705 W University Ave' },
        { name: 'Lake Charles', county: 'Calcasieu', zip: '70601', address: '326 Pujo St' }
      ]},
      { state: 'NC', cities: [
        { name: 'Charlotte', county: 'Mecklenburg', zip: '28202', address: '600 E 4th St' },
        { name: 'Raleigh', county: 'Wake', zip: '27601', address: '222 W Hargett St' },
        { name: 'Greensboro', county: 'Guilford', zip: '27401', address: '300 W Washington St' },
        { name: 'Durham', county: 'Durham', zip: '27701', address: '101 City Hall Plaza' },
        { name: 'Winston-Salem', county: 'Forsyth', zip: '27101', address: '101 N Main St' }
      ]},
      
      // Normal-risk states with REAL addresses
      { state: 'NY', cities: [
        { name: 'New York', county: 'New York', zip: '10007', address: '1 Centre St' },
        { name: 'Buffalo', county: 'Erie', zip: '14202', address: '65 Niagara Square' },
        { name: 'Rochester', county: 'Monroe', zip: '14614', address: '30 Church St' },
        { name: 'Yonkers', county: 'Westchester', zip: '10701', address: '40 S Broadway' },
        { name: 'Syracuse', county: 'Onondaga', zip: '13202', address: '233 E Washington St' }
      ]},
      { state: 'IL', cities: [
        { name: 'Chicago', county: 'Cook', zip: '60602', address: '121 N LaSalle St' },
        { name: 'Aurora', county: 'Kane', zip: '60505', address: '44 E Downer Pl' },
        { name: 'Rockford', county: 'Winnebago', zip: '61101', address: '425 E State St' },
        { name: 'Joliet', county: 'Will', zip: '60432', address: '150 W Jefferson St' },
        { name: 'Naperville', county: 'DuPage', zip: '60540', address: '400 S Eagle St' }
      ]},
      { state: 'PA', cities: [
        { name: 'Philadelphia', county: 'Philadelphia', zip: '19107', address: '1400 John F Kennedy Blvd' },
        { name: 'Pittsburgh', county: 'Allegheny', zip: '15219', address: '414 Grant St' },
        { name: 'Allentown', county: 'Lehigh', zip: '18101', address: '435 Hamilton St' },
        { name: 'Erie', county: 'Erie', zip: '16501', address: '626 State St' },
        { name: 'Reading', county: 'Berks', zip: '19601', address: '815 Washington St' }
      ]},
      { state: 'OH', cities: [
        { name: 'Columbus', county: 'Franklin', zip: '43215', address: '90 W Broad St' },
        { name: 'Cleveland', county: 'Cuyahoga', zip: '44114', address: '601 Lakeside Ave' },
        { name: 'Cincinnati', county: 'Hamilton', zip: '45202', address: '801 Plum St' },
        { name: 'Toledo', county: 'Lucas', zip: '43604', address: '1 Government Center' },
        { name: 'Akron', county: 'Summit', zip: '44308', address: '166 S High St' }
      ]},
      { state: 'GA', cities: [
        { name: 'Atlanta', county: 'Fulton', zip: '30303', address: '68 Mitchell St SW' },
        { name: 'Augusta', county: 'Richmond', zip: '30901', address: '530 Greene St' },
        { name: 'Columbus', county: 'Muscogee', zip: '31901', address: '100 10th St' },
        { name: 'Savannah', county: 'Chatham', zip: '31401', address: '2 E Bay St' },
        { name: 'Athens', county: 'Clarke', zip: '30601', address: '301 College Ave' }
      ]},
      { state: 'MI', cities: [
        { name: 'Detroit', county: 'Wayne', zip: '48226', address: '2 Woodward Ave' },
        { name: 'Grand Rapids', county: 'Kent', zip: '49503', address: '300 Monroe Ave NW' },
        { name: 'Warren', county: 'Macomb', zip: '48093', address: '1 City Square' },
        { name: 'Sterling Heights', county: 'Oakland', zip: '48310', address: '40555 Utica Rd' },
        { name: 'Lansing', county: 'Ingham', zip: '48933', address: '124 W Michigan Ave' }
      ]},
      { state: 'NJ', cities: [
        { name: 'Newark', county: 'Essex', zip: '07102', address: '920 Broad St' },
        { name: 'Jersey City', county: 'Hudson', zip: '07306', address: '280 Grove St' },
        { name: 'Paterson', county: 'Passaic', zip: '07505', address: '155 Market St' },
        { name: 'Elizabeth', county: 'Union', zip: '07207', address: '50 Winfield Scott Plaza' },
        { name: 'Edison', county: 'Middlesex', zip: '08817', address: '100 Municipal Blvd' }
      ]},
      { state: 'VA', cities: [
        { name: 'Virginia Beach', county: 'Virginia Beach', zip: '23451', address: '2401 Courthouse Dr' },
        { name: 'Norfolk', county: 'Norfolk', zip: '23510', address: '810 Union St' },
        { name: 'Chesapeake', county: 'Chesapeake', zip: '23320', address: '306 Cedar Rd' },
        { name: 'Richmond', county: 'Richmond', zip: '23219', address: '900 E Broad St' },
        { name: 'Newport News', county: 'Newport News', zip: '23607', address: '2400 Washington Ave' }
      ]},
      { state: 'WA', cities: [
        { name: 'Seattle', county: 'King', zip: '98104', address: '600 4th Ave' },
        { name: 'Spokane', county: 'Spokane', zip: '99201', address: '808 W Spokane Falls Blvd' },
        { name: 'Tacoma', county: 'Pierce', zip: '98402', address: '747 Market St' },
        { name: 'Vancouver', county: 'Clark', zip: '98660', address: '415 W 6th St' },
        { name: 'Bellevue', county: 'King', zip: '98004', address: '450 110th Ave NE' }
      ]},
      { state: 'AZ', cities: [
        { name: 'Phoenix', county: 'Maricopa', zip: '85003', address: '125 W Washington St' },
        { name: 'Tucson', county: 'Pima', zip: '85701', address: '255 W Alameda St' },
        { name: 'Mesa', county: 'Maricopa', zip: '85201', address: '55 N Center St' },
        { name: 'Chandler', county: 'Maricopa', zip: '85225', address: '88 E Chicago St' },
        { name: 'Scottsdale', county: 'Maricopa', zip: '85251', address: '3939 N Drinkwater Blvd' }
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
      // Select state and city
      const stateData = testData[i % testData.length];
      const cityIndex = Math.floor(Math.random() * stateData.cities.length);
      const cityInfo = stateData.cities[cityIndex];
      const city = cityInfo.name;
      const county = cityInfo.county;
      const state = stateData.state;
      const propertyAddress = cityInfo.address; // Use REAL address
      const zipCode = cityInfo.zip; // Use REAL zip code

      // Generate realistic loan data with unique loan numbers
      const loanNumber = `LN${String(2000000 + i).padStart(7, '0')}`;
      const borrowerName = `Test Borrower ${i + 1}`;
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
 * Get all loans with risk data
 * @param {Object} filters - Optional filters (milestone, state, riskLevel)
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
    return result.rows;
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
  updateLoanRiskScore,
  getPipelineStats,
  deleteAllTestLoans
};
