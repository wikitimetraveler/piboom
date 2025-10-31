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
      riskLevel: req.query.riskLevel
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const loans = await loanPipelineService.getAllLoans(filters);
    
    res.json({
      success: true,
      data: {
        loans,
        count: loans.length,
        filters
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
 * Query FEMA API directly for disaster declarations (like tool3)
 * GET /api/loan-pipeline/query-fema?state=TX&county=Harris
 */
export async function queryFEMADirect(req, res) {
  try {
    const { state, county } = req.query;
    
    // Calculate date 6 months ago (expanded from 30 days)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Use FEMA API v2 (like tool3) for better compatibility
    // Filter for last 6 months
    const femaDisasterDeclUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
    const filters = [];
    if (state) filters.push(`state eq '${state}'`);
    if (county) filters.push(`designatedArea eq '${county} (County)'`);
    filters.push(`incidentBeginDate ge ${sixMonthsAgoStr}`);
    const filterParams = `$count=true&$top=1000&$filter=${filters.join(' and ')}`;
    
    console.log(`🌐 Querying FEMA API: state=${state || 'ALL'}, county=${county || 'ALL'}, since=${sixMonthsAgoStr}`);
    
    const response = await fetch(`${femaDisasterDeclUrl}?${filterParams}`);
    const disasterDeclResults = await response.json();
    
    console.log(`📊 FEMA API returned ${disasterDeclResults.metadata?.count || 0} total records`);

    // Import geocoding function
    const geocodeCountyState = async (county, state) => {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) return { latitude: null, longitude: null };
      
      try {
        const address = `${county}, ${state}`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const geoResponse = await fetch(url);
        const geoData = await geoResponse.json();
        
        if (geoData.status === 'OK' && geoData.results.length > 0) {
          const location = geoData.results[0].geometry.location;
          return { latitude: location.lat, longitude: location.lng };
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
      return { latitude: null, longitude: null };
    };

    if (disasterDeclResults.metadata && disasterDeclResults.metadata.count > 0) {
      let disasters = disasterDeclResults.DisasterDeclarationsSummaries || [];
      
      console.log(`📋 Processing ${disasters.length} disaster records`);
      
      // Additional filter to ensure we only get last 6 months
      const sixMonthsDate = new Date(sixMonthsAgoStr);
      disasters = disasters.filter(item => {
        if (item.incidentBeginDate) {
          const disasterDate = new Date(item.incidentBeginDate);
          return disasterDate >= sixMonthsDate;
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
          filterSince: sixMonthsAgoStr
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
  getFEMADisasters,
  queryFEMADirect,
  geocodeLoans,
  cleanupTestLoans
};
