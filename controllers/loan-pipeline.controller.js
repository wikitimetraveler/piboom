/**
 * Development work by David Lane
 */
import * as loanPipelineService from '../services/loan-pipeline.service.js';
import * as disasterRiskService from '../services/disaster-risk.service.js';
import { getPool } from '../services/database.service.js';

/**
 * Loan Pipeline Controller
 * Handles all API endpoints for loan pipeline disaster risk analysis
 */

/**
 * Generate test loans
 * POST /api/loan-pipeline/generate
 */
export async function generateTestLoans(req, res) {
  try {
    const { count = 100 } = req.body;
    
    if (count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Count must be between 1 and 1000'
      });
    }
    
    console.log(`🔄 Generating ${count} test loans...`);
    const loanIds = await loanPipelineService.generateTestLoans(count);
    
    res.json({
      success: true,
      message: `Generated ${loanIds.length} test loans`,
      data: {
        count: loanIds.length,
        loanIds: loanIds.slice(0, 10) // Return first 10 IDs for reference
      }
    });
  } catch (error) {
    console.error('❌ Error generating test loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate test loans',
      details: error.message
    });
  }
}

/**
 * Get all loans with optional filters
 * GET /api/loan-pipeline/loans
 */
export async function getAllLoans(req, res) {
  try {
    const filters = {
      milestone: req.query.milestone,
      state: req.query.state,
      county: req.query.county,
      riskLevel: req.query.riskLevel
    };

    const nearLat = parseFloat(req.query.nearLat);
    const nearLng = parseFloat(req.query.nearLng);
    const radiusMiles = parseFloat(req.query.radiusMiles);
    if (
      Number.isFinite(nearLat) &&
      Number.isFinite(nearLng) &&
      Number.isFinite(radiusMiles)
    ) {
      filters.nearLat = nearLat;
      filters.nearLng = nearLng;
      filters.radiusMiles = Math.min(500, Math.max(1, radiusMiles));
    }

    // Remove undefined / empty filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    const lite = req.query.lite === '1' || req.query.lite === 'true';

    const loans = await loanPipelineService.getAllLoans(filters, { lite });
    
    res.json({
      success: true,
      data: {
        loans,
        count: loans.length,
        filters,
        lite
      }
    });
  } catch (error) {
    console.error('❌ Error getting loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get loans',
      details: error.message
    });
  }
}

/**
 * Get single loan by ID
 * GET /api/loan-pipeline/loans/:id
 */
export async function getLoanById(req, res) {
  try {
    const loanId = parseInt(req.params.id);
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid loan ID'
      });
    }
    
    const loan = await loanPipelineService.getLoanById(loanId);
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    res.json({
      success: true,
      data: { loan }
    });
  } catch (error) {
    console.error('❌ Error getting loan by ID:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get loan',
      details: error.message
    });
  }
}

/**
 * Trigger risk analysis for all loans
 * POST /api/loan-pipeline/analyze
 */
export async function analyzeAllLoans(req, res) {
  try {
    console.log('🔄 Starting risk analysis for all loans...');
    
    const analysisResult = await disasterRiskService.analyzeAllLoans();
    
    res.json({
      success: true,
      message: `Analysis complete: ${analysisResult.successCount} successful, ${analysisResult.errorCount} errors`,
      data: analysisResult
    });
  } catch (error) {
    console.error('❌ Error analyzing all loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze loans',
      details: error.message
    });
  }
}

/**
 * Analyze single loan
 * POST /api/loan-pipeline/analyze/:id
 */
export async function analyzeSingleLoan(req, res) {
  try {
    const loanId = parseInt(req.params.id);
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid loan ID'
      });
    }
    
    const loan = await loanPipelineService.getLoanById(loanId);
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    console.log(`🔄 Analyzing risk for loan ${loan.loan_number}...`);
    const analysisResult = await disasterRiskService.analyzeLoanRisk(loan);
    
    res.json({
      success: true,
      message: `Risk analysis completed for loan ${loan.loan_number}`,
      data: analysisResult
    });
  } catch (error) {
    console.error('❌ Error analyzing single loan:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze loan',
      details: error.message
    });
  }
}

/**
 * Download KML file
 * GET /api/loan-pipeline/kml
 */
export async function downloadKML(req, res) {
  try {
    const filters = {
      milestone: req.query.milestone,
      state: req.query.state,
      riskLevel: req.query.riskLevel
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const loans = await loanPipelineService.getAllLoans(filters);
    
    if (loans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No loans found for KML generation'
      });
    }
    
    console.log(`🗺️  Generating KML for ${loans.length} loans...`);
    const kmlContent = await disasterRiskService.generateKMLForLoans(loans);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="loan-pipeline-risk.kml"');
    
    res.send(kmlContent);
  } catch (error) {
    console.error('❌ Error generating KML:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate KML file',
      details: error.message
    });
  }
}

/**
 * Get pipeline statistics
 * GET /api/loan-pipeline/stats
 */
export async function getPipelineStats(req, res) {
  try {
    const stats = await loanPipelineService.getPipelineStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting pipeline stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipeline statistics',
      details: error.message
    });
  }
}

/**
 * Get loans by milestone
 * GET /api/loan-pipeline/milestones/:milestone
 */
export async function getLoansByMilestone(req, res) {
  try {
    const milestone = req.params.milestone;
    const loans = await loanPipelineService.getLoansByMilestone(milestone);
    
    res.json({
      success: true,
      data: {
        milestone,
        loans,
        count: loans.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting loans by milestone:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get loans by milestone',
      details: error.message
    });
  }
}

/**
 * Get risk analysis summary
 * GET /api/loan-pipeline/risk-summary
 */
export async function getRiskSummary(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Get risk distribution
    const riskDistribution = await pool.query(`
      SELECT 
        CASE 
          WHEN disaster_risk_score BETWEEN 0 AND 2 THEN 'Low Risk'
          WHEN disaster_risk_score BETWEEN 3 AND 5 THEN 'Medium Risk'
          WHEN disaster_risk_score >= 6 THEN 'High Risk'
          ELSE 'Not Analyzed'
        END as risk_level,
        COUNT(*) as count,
        AVG(disaster_declaration_count) as avg_declarations
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
    
    // Get top risk states
    const topRiskStates = await pool.query(`
      SELECT 
        state,
        COUNT(*) as total_loans,
        AVG(disaster_risk_score) as avg_risk_score,
        SUM(disaster_declaration_count) as total_declarations
      FROM loans 
      WHERE disaster_risk_score > 0
      GROUP BY state 
      ORDER BY avg_risk_score DESC 
      LIMIT 10
    `);
    
    // Get analysis status
    const analysisStatus = await pool.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN last_risk_analysis IS NOT NULL THEN 1 END) as analyzed_loans,
        COUNT(CASE WHEN last_risk_analysis IS NULL THEN 1 END) as pending_analysis
      FROM loans
    `);
    
    res.json({
      success: true,
      data: {
        riskDistribution: riskDistribution.rows,
        topRiskStates: topRiskStates.rows,
        analysisStatus: analysisStatus.rows[0]
      }
    });
  } catch (error) {
    console.error('❌ Error getting risk summary:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get risk summary',
      details: error.message
    });
  }
}

/**
 * Per-county ops triage rollup for hazard-lens choropleth.
 * GET /api/loan-pipeline/county-risk-summary?state=CA
 * Scores are ops triage ranks (0–15), not loss probabilities.
 */
export async function countyRiskSummaryByState(req, res) {
  try {
    const state = String(req.query.state || '').trim().toUpperCase();
    if (!state) {
      return res.status(400).json({ success: false, error: 'state query parameter is required' });
    }
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');

    const { rows } = await pool.query(
      `SELECT county AS county_name,
              COUNT(*)::int AS loan_count,
              COALESCE(AVG(disaster_risk_score), 0)::float AS avg_ops_triage,
              COALESCE(MAX(disaster_risk_score), 0)::float AS max_ops_triage
       FROM loans
       WHERE UPPER(TRIM(COALESCE(state, ''))) = $1
         AND COALESCE(TRIM(county), '') <> ''
       GROUP BY county
       ORDER BY county`,
      [state]
    );

    res.json({
      success: true,
      data: {
        state,
        metric: 'ops_triage',
        note: 'Ops triage rank (FEMA + flood weights) — not a loss probability',
        counties: rows
      }
    });
  } catch (error) {
    console.error('❌ Error getting county risk summary:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get county risk summary',
      details: error.message
    });
  }
}

/**
 * Geocode existing loans that don't have coordinates
 * POST /api/loan-pipeline/geocode-loans?limit=100
 */
export async function geocodeLoans(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await loanPipelineService.geocodeMissingLoans(limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error geocoding loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode loans',
      details: error.message
    });
  }
}

/**
 * Re-geocode loans with incorrect coordinates
 * POST /api/loan-pipeline/regeocode-loans?limit=100&forceAll=false
 */
export async function regeocodeLoans(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const forceAll = req.query.forceAll === 'true';
    
    const result = await loanPipelineService.regeocodeIncorrectLoans(limit, forceAll);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error re-geocoding loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to re-geocode loans',
      details: error.message
    });
  }
}

/**
 * Query FEMA API directly for disaster declarations (like tool3)
 * GET /api/loan-pipeline/query-fema?state=TX&county=Harris
 */
export async function queryFEMADirect(req, res) {
  try {
    const { state, county } = req.query;
    
    // Calculate date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Use FEMA API v2 (like tool3) for better compatibility
    // Filter for last 90 days
    const femaDisasterDeclUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
    const filters = [];
    if (state) filters.push(`state eq '${state}'`);
    if (county) filters.push(`designatedArea eq '${county} (County)'`);
    filters.push(`incidentBeginDate ge ${ninetyDaysAgoStr}`);
    const filterParams = `$count=true&$top=1000&$filter=${filters.join(' and ')}`;
    
    console.log(`🌐 Querying FEMA API: state=${state || 'ALL'}, county=${county || 'ALL'}, since=${ninetyDaysAgoStr}`);
    
    const response = await fetch(`${femaDisasterDeclUrl}?${filterParams}`);
    const disasterDeclResults = await response.json();
    
    console.log(`📊 FEMA API returned ${disasterDeclResults.metadata?.count || 0} total records`);

    // Import geocoding function with cache
    // Using cache first, then FREE OpenStreetMap Nominatim API - minimal API calls!
    const { geocodeCountyStateWithCache } = await import('../services/geocoding-cache.service.js');
    const geocodeCountyState = async (county, state) => {
      try {
        const result = await geocodeCountyStateWithCache(county, state);
        return { latitude: result.latitude, longitude: result.longitude };
      } catch (error) {
        console.error('Free geocoding error:', error);
        return { latitude: null, longitude: null };
      }
    };

    if (disasterDeclResults.metadata && disasterDeclResults.metadata.count > 0) {
      let disasters = disasterDeclResults.DisasterDeclarationsSummaries || [];
      
      console.log(`📋 Processing ${disasters.length} disaster records`);
      
      // Additional filter to ensure we only get last 90 days
      const ninetyDaysDate = new Date(ninetyDaysAgoStr);
      disasters = disasters.filter(item => {
        if (item.incidentBeginDate) {
          const disasterDate = new Date(item.incidentBeginDate);
          return disasterDate >= ninetyDaysDate;
        }
        return false;
      });
      
      console.log(`✅ After date filter: ${disasters.length} disasters`);
      
      // Geocode all disasters
      const geocodedDisasters = await Promise.all(disasters.map(async (item, index) => {
        // Rate limit geocoding
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 100));
        // Determine county/state per item
        let itemCounty = county || (item.designatedArea ? item.designatedArea.replace(/\s*\(County\)$/i, '') : '');
        const itemState = item.state || state || '';
        let coords = { latitude: null, longitude: null };
        if (itemCounty && itemState) {
          coords = await geocodeCountyState(itemCounty, itemState);
        }
        
        return {
          declarationType: item.declarationType,
          incidentType: item.incidentType,
          declarationTitle: item.declarationTitle,
          state: itemState,
          county: itemCounty,
          ihProgramDeclared: item.ihProgramDeclared || false,
          iaProgramDeclared: item.iaProgramDeclared || false,
          paProgramDeclared: item.paProgramDeclared || false,
          hmProgramDeclared: item.hmProgramDeclared || false,
          incidentBeginDate: item.incidentBeginDate,
          incidentEndDate: item.incidentEndDate || 'Ongoing',
          disasterCloseoutDate: item.disasterCloseoutDate || null,
          latitude: coords.latitude,
          longitude: coords.longitude
        };
      }));

      res.json({
        success: true,
        data: {
          disasters: geocodedDisasters,
          count: geocodedDisasters.length,
          filterSince: ninetyDaysAgoStr
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          disasters: [],
          count: 0
        }
      });
    }
  } catch (error) {
    console.error('❌ Error querying FEMA API directly:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to query FEMA API',
      details: error.message
    });
  }
}

export async function cleanupTestLoans(req, res) {
  try {
    const deletedCount = await loanPipelineService.deleteAllTestLoans();
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} test loans`,
      data: { deletedCount }
    });
  } catch (error) {
    console.error('❌ Error cleaning up test loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup test loans',
      details: error.message
    });
  }
}

/**
 * Get FEMA disasters from stored loan data
 * GET /api/loan-pipeline/fema-disasters
 */
export async function getFEMADisasters(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Calculate date one year ago (only show disasters from last year - pipeline loans only)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Get unique FEMA disasters from stored loan data (last year only)
    // Handle both 'title' (v1 API) and 'declarationTitle' (v2 API) field names
    const result = await pool.query(`
      SELECT DISTINCT 
        fema_data->>'disasterNumber' as disaster_number,
        fema_data->>'incidentType' as incident_type,
        COALESCE(
          fema_data->>'title',
          fema_data->>'declarationTitle'
        ) as declaration_title,
        fema_data->>'state' as state,
        fema_data->>'county' as county,
        fema_data->>'declarationDate' as declaration_date,
        fema_data->>'incidentBeginDate' as incident_begin_date,
        fema_data->>'incidentEndDate' as incident_end_date,
        CASE 
          WHEN fema_data->>'ihProgramDeclared' = 'true' OR fema_data->>'ihProgramDeclared'::boolean = true THEN true
          ELSE false
        END as ih_program_declared,
        CASE 
          WHEN fema_data->>'iaProgramDeclared' = 'true' OR fema_data->>'iaProgramDeclared'::boolean = true THEN true
          ELSE false
        END as ia_program_declared,
        CASE 
          WHEN fema_data->>'paProgramDeclared' = 'true' OR fema_data->>'paProgramDeclared'::boolean = true THEN true
          ELSE false
        END as pa_program_declared,
        CASE 
          WHEN fema_data->>'hmProgramDeclared' = 'true' OR fema_data->>'hmProgramDeclared'::boolean = true THEN true
          ELSE false
        END as hm_program_declared,
        latitude,
        longitude
      FROM loans 
      WHERE fema_data IS NOT NULL 
        AND fema_data != 'null'::jsonb
        AND fema_data != '{}'::jsonb
        AND (
          (fema_data->>'incidentBeginDate' IS NOT NULL AND fema_data->>'incidentBeginDate' >= $1)
          OR (fema_data->>'declarationDate' IS NOT NULL AND fema_data->>'declarationDate' >= $1)
        )
      ORDER BY COALESCE(
        fema_data->>'declarationDate',
        fema_data->>'incidentBeginDate'
      ) DESC
    `, [oneYearAgoStr]);
    
    const disasters = result.rows.map(row => ({
      declarationType: row.disaster_number ? row.disaster_number.substring(0, 2) : 'DR',
      incidentType: row.incident_type || 'Unknown',
      declarationTitle: row.declaration_title || 'Disaster Declaration',
      state: row.state || '',
      county: row.county || '',
      ihProgramDeclared: row.ih_program_declared === true || row.ih_program_declared === 'true',
      iaProgramDeclared: row.ia_program_declared === true || row.ia_program_declared === 'true',
      paProgramDeclared: row.pa_program_declared === true || row.pa_program_declared === 'true',
      hmProgramDeclared: row.hm_program_declared === true || row.hm_program_declared === 'true',
      incidentBeginDate: row.incident_begin_date || '',
      incidentEndDate: row.incident_end_date || '',
      disasterCloseoutDate: null,
      latitude: parseFloat(row.latitude) || null,
      longitude: parseFloat(row.longitude) || null
    }));
    
    res.json({
      success: true,
      data: {
        disasters,
        count: disasters.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting FEMA disasters:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get FEMA disasters',
      details: error.message
    });
  }
}

/**
 * Get flood zones from FEMA NFHL (National Flood Hazard Layer)
 * GET /api/loan-pipeline/flood-zones?state=TX&county=Harris&bbox=-95.5,29.5,-95.0,30.0
 */
export async function getFloodZones(req, res) {
  try {
    const { state, county, bbox } = req.query;
    
    // FEMA NFHL REST API endpoints to try (in order of preference)
    // Updated endpoint URLs based on FEMA's current service structure
    const endpoints = [
      'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', // Updated endpoint (WORKING)
      'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer'  // Original endpoint (deprecated, may return 404)
    ];
    
    // If bbox provided, use it; otherwise try to get from state/county
    let geometry = null;
    if (bbox) {
      const [minX, minY, maxX, maxY] = bbox.split(',').map(parseFloat);
      
      // Validate bounding box - FEMA API has limits on query size
      // Limit to reasonable size (approximately 5 degrees = ~500km)
      const maxSize = 5.0;
      const width = Math.abs(maxX - minX);
      const height = Math.abs(maxY - minY);
      
      if (width > maxSize || height > maxSize) {
        return res.status(400).json({
          success: false,
          error: `Bounding box too large. Maximum size is ${maxSize} degrees (approximately 500km).`,
          details: `Your bbox: width=${width.toFixed(2)}°, height=${height.toFixed(2)}°`,
          suggestion: 'Please use a smaller bounding box or query multiple smaller areas.'
        });
      }
      
      // Validate coordinates are reasonable (US bounds approximately)
      if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) {
        return res.status(400).json({
          success: false,
          error: 'Invalid bounding box coordinates',
          details: 'Coordinates must be within valid range: longitude [-180, 180], latitude [-90, 90]'
        });
      }
      
      geometry = {
        xmin: minX,
        ymin: minY,
        xmax: maxX,
        ymax: maxY,
        spatialReference: { wkid: 4326 }
      };
    } else if (state && county) {
      // Try to geocode county to get bounding box
      // For now, return a message suggesting bbox parameter
      return res.status(400).json({
        success: false,
        error: 'Please provide bbox parameter (west,south,east,north) or use state and county with geocoding',
        message: 'Example: ?state=TX&county=Harris&bbox=-95.5,29.5,-95.0,30.0'
      });
    }
    
    // Try each endpoint
    for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
      const baseUrl = endpoints[endpointIndex];
      
      // Use FEMA NFHL REST API to query flood zones
      // Try Layer 28 (Flood Hazard Zones) first - this is the correct layer
      let layerId = 28; // Default to Layer 28 (Flood Hazard Zones)
      
      // Try to get service info to verify layer exists
      try {
        const serviceInfoUrl = `${baseUrl}?f=json`;
        const serviceResponse = await fetch(serviceInfoUrl, {
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
              // Update baseUrl to use the found service URL and continue
              const foundBaseUrl = nfhlService.url;
              // Try querying with the found service URL
              const foundQueryUrl = `${foundBaseUrl}/${layerId}/query`;
              const foundParams = new URLSearchParams({
                f: 'geojson',
                where: '1=1',
                outFields: '*',
                returnGeometry: 'true',
                spatialRel: 'esriSpatialRelIntersects'
              });
              if (geometry) {
                foundParams.append('geometry', JSON.stringify(geometry));
                foundParams.append('geometryType', 'esriGeometryEnvelope');
                foundParams.append('inSR', '4326');
              }
              const foundResponse = await fetch(`${foundQueryUrl}?${foundParams.toString()}`, {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
                }
              });
              if (foundResponse.ok) {
                const foundData = await foundResponse.json();
                return res.json({
                  success: true,
                  data: foundData,
                  count: foundData.features?.length || 0
                });
              }
            }
          }
          
          // Find layer with flood zone data
          const floodLayer = serviceInfo.layers?.find(l => 
            l.id === 28 || // Flood Hazard Zones - PRIMARY
            (l.name?.toLowerCase().includes('flood') && l.name?.toLowerCase().includes('zone')) ||
            l.name?.toLowerCase().includes('flood_hazard_zone')
          );
          
          if (floodLayer) {
            layerId = floodLayer.id;
            console.log(`🌊 Using FEMA NFHL layer ${layerId}: ${floodLayer.name} (endpoint ${endpointIndex + 1})`);
          } else {
            console.log(`🌊 Using default layer ${layerId} (Flood Hazard Zones) (endpoint ${endpointIndex + 1})`);
          }
        } else {
          // If service info fails, try next endpoint
          if (endpointIndex < endpoints.length - 1) {
            console.warn(`⚠️  FEMA NFHL endpoint ${endpointIndex + 1} returned ${serviceResponse.status}, trying next...`);
            continue;
          }
          // On last endpoint, try layer 28 directly anyway
          console.log(`🌊 Service info unavailable, trying layer ${layerId} directly...`);
        }
      } catch (serviceError) {
        // If service info fails, try next endpoint
        if (endpointIndex < endpoints.length - 1) {
          console.warn(`⚠️  FEMA NFHL endpoint ${endpointIndex + 1} error: ${serviceError.message}, trying next...`);
          continue;
        }
        // On last endpoint, try layer 28 directly anyway
        console.log(`🌊 Service info error, trying layer ${layerId} directly...`);
      }
      
      // Query Layer 28 (Flood Hazard Zones) - use '*' to get all fields
      const queryUrl = `${baseUrl}/${layerId}/query`;
      
      const params = new URLSearchParams({
        f: 'geojson',
        where: '1=1', // Get all features in the area
        outFields: '*', // Get all fields to ensure we capture FLD_ZONE
        returnGeometry: 'true',
        spatialRel: 'esriSpatialRelIntersects'
      });
      
      if (geometry) {
        params.append('geometry', JSON.stringify(geometry));
        params.append('geometryType', 'esriGeometryEnvelope');
        params.append('inSR', '4326');
      }
      
      console.log(`🌊 Querying FEMA NFHL flood zones: ${queryUrl}?${params.toString()}`);
      
      const response = await fetch(`${queryUrl}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check for error in response (some APIs return 200 with error object)
        if (data.error) {
          console.error(`❌ FEMA NFHL API error response:`, data.error);
          if (endpointIndex < endpoints.length - 1) {
            console.warn(`⚠️  Trying next endpoint...`);
            continue;
          }
          throw new Error(`FEMA NFHL API error: ${JSON.stringify(data.error)}`);
        }
        
        // Transform to GeoJSON format if needed
        let geojson = data;
        if (data.features) {
          // Already GeoJSON
          geojson = data;
        } else if (data.geometries) {
          // Transform from ArcGIS format
          geojson = {
            type: 'FeatureCollection',
            features: data.geometries.map((geom, idx) => ({
              type: 'Feature',
              geometry: geom,
              properties: data.attributes ? data.attributes[idx] : {}
            }))
          };
        }
        
        // Add loan count for each flood zone if we have state/county
        if (state && county) {
          const pool = getPool();
          if (pool) {
            // Count loans in flood zones (simplified - would need point-in-polygon check)
            const loanResult = await pool.query(`
              SELECT COUNT(*) as count 
              FROM loans 
              WHERE state = $1 AND county = $2
            `, [state, county]);
            
            geojson.properties = geojson.properties || {};
            geojson.properties.loanCount = parseInt(loanResult.rows[0]?.count || 0);
          }
        }
        
        return res.json({
          success: true,
          data: geojson,
          count: geojson.features?.length || 0
        });
      } else {
        // Log the actual error response for debugging
        let errorText = '';
        try {
          const errorData = await response.text();
          errorText = errorData.substring(0, 200); // First 200 chars
          console.error(`❌ FEMA NFHL API error ${response.status}: ${errorText}`);
        } catch (e) {
          console.error(`❌ FEMA NFHL API error ${response.status}: ${response.statusText}`);
        }
        
        // If this endpoint fails, try next one
        if (endpointIndex < endpoints.length - 1) {
          console.warn(`⚠️  FEMA NFHL endpoint ${endpointIndex + 1} returned ${response.status}, trying next...`);
          continue;
        }
        // If layer 28 fails, try layer 27 (Flood Hazard Boundaries) as fallback
        if (layerId === 28) {
          console.warn(`⚠️  Layer ${layerId} failed, trying layer 27 (Boundaries)...`);
          const fallbackUrl = `${baseUrl}/27/query`;
          const fallbackResponse = await fetch(`${fallbackUrl}?${params.toString()}`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'DevConnectLabs-LoanPipeline/1.0'
            }
          });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            return res.json({
              success: true,
              data: fallbackData,
              count: fallbackData.features?.length || 0
            });
          }
        }
      }
    }
    
    // All endpoints failed
    throw new Error(`FEMA NFHL API error: All endpoints failed`);
  } catch (error) {
    console.error('❌ Error getting flood zones:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get flood zones',
      details: error.message
    });
  }
}

/**
 * Get loans grouped by flood zones (for unified disasters page)
 * GET /api/loan-pipeline/flood-zones-loans?state=TX&county=Harris
 */
export async function getFloodZonesLoans(req, res) {
  try {
    const { state, county } = req.query;
    const pool = getPool();
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    let query = `
      SELECT 
        state,
        county,
        flood_zone,
        COUNT(*) as loan_count,
        COUNT(CASE WHEN flood_zone LIKE 'A%' OR flood_zone LIKE 'V%' THEN 1 END) as high_risk_count,
        AVG(latitude) as avg_latitude,
        AVG(longitude) as avg_longitude,
        MAX(last_flood_zone_check) as last_flood_zone_check
      FROM loans
      WHERE flood_zone IS NOT NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (state) {
      paramCount++;
      query += ` AND state = $${paramCount}`;
      params.push(state);
    }
    
    if (county) {
      paramCount++;
      query += ` AND county ILIKE $${paramCount}`;
      params.push(`%${county}%`);
    }
    
    query += `
      GROUP BY state, county, flood_zone
      ORDER BY loan_count DESC, state, county
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error getting flood zones loans:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get flood zones loans',
      details: error.message
    });
  }
}

/**
 * Update flood zones for all loans
 * POST /api/loan-pipeline/update-flood-zones
 */
export async function updateFloodZones(req, res) {
  try {
    const { limit, forceUpdate } = req.body;
    
    console.log(`🔄 Starting flood zone update (limit: ${limit || 'all'}, force: ${forceUpdate || false})`);
    
    const results = await disasterRiskService.batchUpdateFloodZones(
      limit || null,
      forceUpdate || false
    );
    
    res.json({
      success: true,
      message: `Updated flood zones for ${results.updated} loans`,
      data: results
    });
  } catch (error) {
    console.error('❌ Error updating flood zones:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update flood zones',
      details: error.message
    });
  }
}

export default {
  generateTestLoans,
  getAllLoans,
  getLoanById,
  analyzeAllLoans,
  analyzeSingleLoan,
  downloadKML,
  getPipelineStats,
  getLoansByMilestone,
  getRiskSummary,
  countyRiskSummaryByState,
  getFEMADisasters,
  queryFEMADirect,
  geocodeLoans,
  cleanupTestLoans,
  getFloodZones,
  updateFloodZones,
  getFloodZonesLoans
};
