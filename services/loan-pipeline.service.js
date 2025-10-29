import { getPool } from './database.service.js';

/**
 * Loan Pipeline Service
 * Handles CRUD operations for loan data and test loan generation
 */

/**
 * Geocode an address using Google Maps API
 * @param {string} address - Full address string
 * @returns {Promise<Object>} Object with latitude and longitude
 */
async function geocodeAddress(address) {
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

    // Realistic test data with mix of high-risk and normal areas
    const testData = [
      // High-risk states (more loans for testing)
      { state: 'CA', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Fresno'], counties: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Fresno'] },
      { state: 'FL', cities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Tallahassee'], counties: ['Miami-Dade', 'Hillsborough', 'Orange', 'Duval', 'Leon'] },
      { state: 'TX', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'], counties: ['Harris', 'Dallas', 'Travis', 'Bexar', 'Tarrant'] },
      { state: 'LA', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'], counties: ['Orleans', 'East Baton Rouge', 'Caddo', 'Lafayette', 'Calcasieu'] },
      { state: 'NC', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'], counties: ['Mecklenburg', 'Wake', 'Guilford', 'Durham', 'Forsyth'] },
      
      // Normal-risk states
      { state: 'NY', cities: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse'], counties: ['New York', 'Erie', 'Monroe', 'Westchester', 'Onondaga'] },
      { state: 'IL', cities: ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville'], counties: ['Cook', 'Kane', 'Winnebago', 'Will', 'DuPage'] },
      { state: 'PA', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'], counties: ['Philadelphia', 'Allegheny', 'Lehigh', 'Erie', 'Berks'] },
      { state: 'OH', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'], counties: ['Franklin', 'Cuyahoga', 'Hamilton', 'Lucas', 'Summit'] },
      { state: 'GA', cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens'], counties: ['Fulton', 'Richmond', 'Muscogee', 'Chatham', 'Clarke'] },
      { state: 'MI', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Lansing'], counties: ['Wayne', 'Kent', 'Macomb', 'Oakland', 'Ingham'] },
      { state: 'NJ', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'], counties: ['Essex', 'Hudson', 'Passaic', 'Union', 'Middlesex'] },
      { state: 'VA', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News'], counties: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News'] },
      { state: 'WA', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'], counties: ['King', 'Spokane', 'Pierce', 'Clark', 'King'] },
      { state: 'AZ', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'], counties: ['Maricopa', 'Pima', 'Maricopa', 'Maricopa', 'Maricopa'] }
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
      const city = stateData.cities[cityIndex];
      const county = stateData.counties[cityIndex];
      const state = stateData.state;

      // Generate realistic address
      const streetNumbers = ['123', '456', '789', '101', '202', '303', '404', '505', '606', '707'];
      const streetNames = ['Main St', 'Oak Ave', 'Pine Rd', 'Cedar Ln', 'Maple Dr', 'Elm St', 'First Ave', 'Second St', 'Park Rd', 'Center St'];
      const streetNumber = streetNumbers[Math.floor(Math.random() * streetNumbers.length)];
      const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
      const propertyAddress = `${streetNumber} ${streetName}`;

      // Generate realistic loan data with unique loan numbers
      const loanNumber = `LN${String(2000000 + i).padStart(7, '0')}`;
      const borrowerName = `Test Borrower ${i + 1}`;
      const zipCode = `${state === 'CA' ? '90' : state === 'NY' ? '10' : '30'}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
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

      // Geocode the address properly
      let latitude = null;
      let longitude = null;
      
      try {
        const fullAddress = `${propertyAddress}, ${city}, ${state} ${zipCode}`;
        const coords = await geocodeAddress(fullAddress);
        latitude = coords.latitude;
        longitude = coords.longitude;
        
        // Rate limiting for geocoding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`⚠️  Could not geocode ${propertyAddress}, using approximate coordinates`);
        // Fallback to rough approximation if geocoding fails
        latitude = 25 + Math.random() * 25;
        longitude = -125 + Math.random() * 50;
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
        const coords = await geocodeAddress(fullAddress);

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
