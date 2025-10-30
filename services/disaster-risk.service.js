import { getPool } from './database.service.js';
import { getAllLoans, updateLoanRiskScore } from './loan-pipeline.service.js';

/**
 * Disaster Risk Service
 * Handles FEMA API integration, risk scoring, and KML generation
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
 * Geocode a county/state location
 * @param {string} county - County name
 * @param {string} state - State abbreviation
 * @returns {Promise<Object>} Object with latitude and longitude
 */
async function geocodeCountyState(county, state) {
  const address = `${county}, ${state}`;
  return geocodeAddress(address);
}

/**
 * Reverse geocode lat/lng to county and state
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{county: string|null, state: string|null}>}
 */
async function reverseGeocodeCountyState(lat, lng) {
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

    // Ensure loan has coordinates (geocode if missing)
    if (!loan.latitude || !loan.longitude) {
      console.log(`🌍 Geocoding loan ${loan.loan_number}...`);
      const fullAddress = `${loan.property_address}, ${loan.city}, ${loan.state} ${loan.zip_code || ''}`;
      const coords = await geocodeAddress(fullAddress);
      
      if (coords.latitude && coords.longitude) {
        // Update loan coordinates
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
    
    // Calculate risk score
    const riskScore = calculateRiskScore(femaData);
    
    // Update loan in database
    await updateLoanRiskScore(loan.id, riskScore, femaData.disasterCount, femaData);
    
    return {
      loanId: loan.id,
      loanNumber: loan.loan_number,
      riskScore,
      disasterCount: femaData.disasterCount,
      femaData: femaData.disasters,
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

    // Calculate date one month ago (only show disasters from last 30 days)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    // designatedArea format example: "Harris (County)"; filter by designatedArea and state
    // Note: FEMA API v2 uses designatedArea instead of county
    const filter = `state eq '${state}' and designatedArea eq '${county} (County)' and incidentBeginDate ge ${oneMonthAgoStr}`;
    const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$count=true`;

    console.log(`🌐 Querying FEMA API v2 (last 30 days): ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'piBoom-LoanPipeline/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FEMA API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();

    // Extract disaster information
    let disasters = data.DisasterDeclarationsSummaries || [];

    // Extra guard: ensure only last 30 days
    const lastMonthDate = new Date(oneMonthAgoStr);
    disasters = disasters.filter(disaster => {
      if (disaster.incidentBeginDate) {
        const disasterDate = new Date(disaster.incidentBeginDate);
        return disasterDate >= lastMonthDate;
      }
      return false;
    });
    
    // Geocode disasters that don't have coordinates
    const geocodedDisasters = await Promise.all(disasters.map(async disaster => {
      let latitude = null;
      let longitude = null;

      // Prefer county from designatedArea, fallback to county field, then parse from title
      let countyFromApi = normalizeCountyName(
        disaster.designatedArea || disaster.county || parseCountyFromTitle(disaster.declarationTitle || disaster.title) || county || ''
      );
      let stateFromApi = disaster.state || state || '';

      // Try to geocode if we have county and state
      if (stateFromApi && countyFromApi) {
        const coords = await geocodeCountyState(countyFromApi, stateFromApi);
        latitude = coords.latitude;
        longitude = coords.longitude;
        // Rate limit geocoding requests
        await new Promise(resolve => setTimeout(resolve, 100));
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

    // Second-pass enhancement: reverse-geocode any items still missing county/state but with coordinates
    for (let i = 0; i < geocodedDisasters.length; i++) {
      const d = geocodedDisasters[i];
      if ((!d.county || !d.state) && d.latitude && d.longitude) {
        const cg = await reverseGeocodeCountyState(d.latitude, d.longitude);
        if (cg.county && !d.county) d.county = cg.county;
        if (cg.state && !d.state) d.state = cg.state;
        // be gentle with rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
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
        filterSince: oneMonthAgoStr
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
 * Calculate risk score from FEMA data
 * @param {Object} femaData - FEMA API response data
 * @returns {number} Risk score (0-10+)
 */
function calculateRiskScore(femaData) {
  if (!femaData || !femaData.disasters) {
    return 0;
  }
  
  const disasterCount = femaData.disasterCount || 0;
  
  // Simple scoring algorithm:
  // 0-2 disasters: Low risk (0-2)
  // 3-5 disasters: Medium risk (3-5)  
  // 6+ disasters: High risk (6+)
  
  // Future enhancement: Weight by recency and severity
  // For now, just use the count as the score
  return Math.min(disasterCount, 10); // Cap at 10 for display purposes
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
  analyzeAllLoans
};
