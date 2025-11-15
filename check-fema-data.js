import { config } from 'dotenv';
import { initializeDatabase, getPool } from './services/database.service.js';

config();

async function checkFEMAData() {
  try {
    initializeDatabase();
    const pool = getPool();
    
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Check loans with FEMA data
    const femaResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN fema_data IS NOT NULL AND fema_data != 'null'::jsonb AND fema_data != '{}'::jsonb THEN 1 END) as has_fema_data,
        COUNT(CASE WHEN disaster_declaration_count > 0 THEN 1 END) as with_declarations
      FROM loans
    `);
    
    const stats = femaResult.rows[0];
    console.log('\n📊 FEMA Data Status:\n');
    console.log(`Total Loans: ${stats.total}`);
    console.log(`Loans with FEMA Data: ${stats.has_fema_data}`);
    console.log(`Loans with Declaration Count > 0: ${stats.with_declarations}`);
    
    // Sample some FEMA data
    const sampleResult = await pool.query(`
      SELECT loan_number, city, state, county, 
             disaster_declaration_count, 
             fema_data,
             last_risk_analysis
      FROM loans
      WHERE fema_data IS NOT NULL 
        AND fema_data != 'null'::jsonb 
        AND fema_data != '{}'::jsonb
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('\nSample Loans with FEMA Data:');
      sampleResult.rows.forEach(loan => {
        console.log(`\n  ${loan.loan_number} - ${loan.city}, ${loan.state}`);
        console.log(`    Declaration Count: ${loan.disaster_declaration_count}`);
        console.log(`    Last Analysis: ${loan.last_risk_analysis || 'Never'}`);
        if (loan.fema_data) {
          try {
            const fema = typeof loan.fema_data === 'string' ? JSON.parse(loan.fema_data) : loan.fema_data;
            const disasters = fema.disasters || [];
            console.log(`    Disasters in FEMA data: ${disasters.length}`);
            if (disasters.length > 0) {
              console.log(`    First disaster: ${disasters[0].incidentType || disasters[0].declarationTitle || 'Unknown'}`);
            }
          } catch (e) {
            console.log(`    FEMA data format issue`);
          }
        }
      });
    } else {
      console.log('\n⚠️  No loans found with FEMA data');
    }
    
    // Check if risk scores are being calculated but stored as 0
    const zeroRiskResult = await pool.query(`
      SELECT loan_number, city, state, disaster_declaration_count, disaster_risk_score
      FROM loans
      WHERE disaster_declaration_count > 0 AND disaster_risk_score = 0
      LIMIT 5
    `);
    
    if (zeroRiskResult.rows.length > 0) {
      console.log('\n⚠️  Loans with declarations but risk score = 0:');
      zeroRiskResult.rows.forEach(loan => {
        console.log(`  ${loan.loan_number} - ${loan.city}, ${loan.state} - Declarations: ${loan.disaster_declaration_count}, Risk: ${loan.disaster_risk_score}`);
      });
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFEMAData();

