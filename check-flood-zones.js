import { config } from 'dotenv';
import { initializeDatabase, getPool } from './services/database.service.js';

config();

async function checkFloodZones() {
  try {
    initializeDatabase();
    const pool = getPool();
    
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Check flood zone statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN flood_zone IS NOT NULL THEN 1 END) as with_flood_zone,
        COUNT(CASE WHEN last_flood_zone_check IS NOT NULL THEN 1 END) as checked,
        COUNT(CASE WHEN flood_zone IS NULL AND last_flood_zone_check IS NOT NULL THEN 1 END) as checked_no_zone,
        COUNT(CASE WHEN flood_zone IS NOT NULL AND last_flood_zone_check IS NOT NULL THEN 1 END) as checked_with_zone
      FROM loans
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    
    const stats = statsResult.rows[0];
    console.log('\n🌊 Flood Zone Status:\n');
    console.log(`Total Loans with Coordinates: ${stats.total_loans}`);
    console.log(`Loans with Flood Zone Data: ${stats.with_flood_zone}`);
    console.log(`Loans Checked: ${stats.checked}`);
    console.log(`Checked - No Zone Found: ${stats.checked_no_zone}`);
    console.log(`Checked - Zone Found: ${stats.checked_with_zone}`);
    
    // Show success rate
    if (stats.checked > 0) {
      const successRate = ((stats.checked_with_zone / stats.checked) * 100).toFixed(1);
      console.log(`\n✅ Success Rate: ${successRate}% (${stats.checked_with_zone}/${stats.checked})`);
    }
    
    // Sample loans with flood zones
    const withZoneResult = await pool.query(`
      SELECT loan_number, city, state, county, 
             flood_zone, flood_zone_type,
             last_flood_zone_check
      FROM loans
      WHERE flood_zone IS NOT NULL
      ORDER BY last_flood_zone_check DESC
      LIMIT 10
    `);
    
    if (withZoneResult.rows.length > 0) {
      console.log('\n✅ Sample Loans WITH Flood Zone Data:');
      withZoneResult.rows.forEach(loan => {
        console.log(`\n  ${loan.loan_number} - ${loan.city}, ${loan.state}`);
        console.log(`    Flood Zone: ${loan.flood_zone}`);
        console.log(`    Zone Type: ${loan.flood_zone_type || 'N/A'}`);
        console.log(`    Checked: ${loan.last_flood_zone_check || 'Never'}`);
      });
    } else {
      console.log('\n⚠️  No loans found with flood zone data');
    }
    
    // Sample loans checked but no zone found
    const noZoneResult = await pool.query(`
      SELECT loan_number, city, state, county, 
             last_flood_zone_check
      FROM loans
      WHERE flood_zone IS NULL 
        AND last_flood_zone_check IS NOT NULL
      ORDER BY last_flood_zone_check DESC
      LIMIT 5
    `);
    
    if (noZoneResult.rows.length > 0) {
      console.log('\n⚠️  Sample Loans Checked but NO Zone Found:');
      noZoneResult.rows.forEach(loan => {
        console.log(`  ${loan.loan_number} - ${loan.city}, ${loan.state} (Checked: ${loan.last_flood_zone_check})`);
      });
    }
    
    // Check recent flood zone checks
    const recentResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN last_flood_zone_check > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
        COUNT(CASE WHEN last_flood_zone_check > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h
      FROM loans
      WHERE last_flood_zone_check IS NOT NULL
    `);
    
    const recent = recentResult.rows[0];
    console.log(`\n📅 Recent Checks:`);
    console.log(`  Last Hour: ${recent.last_hour}`);
    console.log(`  Last 24 Hours: ${recent.last_24h}`);
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFloodZones();

