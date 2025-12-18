import { config } from 'dotenv';
import { initializeDatabase, getPool } from './services/database.service.js';

config();

async function checkUpdateStatus() {
  try {
    initializeDatabase();
    const pool = getPool();
    
    if (!pool) {
      console.log('❌ Database not available');
      process.exit(1);
    }
    
    // Check how many loans still need flood zone updates
    const pendingResult = await pool.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords,
        COUNT(CASE WHEN flood_zone IS NOT NULL THEN 1 END) as with_flood_zone,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
                  AND (flood_zone IS NULL OR last_flood_zone_check IS NULL) THEN 1 END) as pending_updates,
        MAX(last_flood_zone_check) as last_update_time
      FROM loans
    `);
    
    const stats = pendingResult.rows[0];
    
    console.log('\n📊 Flood Zone Update Status:\n');
    console.log(`Total Loans: ${stats.total_loans}`);
    console.log(`Loans with Coordinates: ${stats.with_coords}`);
    console.log(`Loans with Flood Zones: ${stats.with_flood_zone}`);
    console.log(`Pending Updates: ${stats.pending_updates}`);
    console.log(`Last Update Time: ${stats.last_update_time || 'Never'}`);
    
    if (parseInt(stats.pending_updates) > 0) {
      const estimatedTime = Math.ceil(parseInt(stats.pending_updates) / 5 * 0.2 / 60); // minutes
      console.log(`\n⏱️  Estimated time to complete: ~${estimatedTime} minutes`);
      console.log(`   (Processing 5 loans at a time with 200ms delay)`);
    }
    
    // Check for recent updates (within last 5 minutes)
    const recentUpdates = await pool.query(`
      SELECT COUNT(*) as count
      FROM loans
      WHERE last_flood_zone_check > NOW() - INTERVAL '5 minutes'
    `);
    
    if (parseInt(recentUpdates.rows[0].count) > 0) {
      console.log(`\n🔄 Active: ${recentUpdates.rows[0].count} loans updated in last 5 minutes`);
      console.log('   Update process appears to be running');
    } else {
      console.log(`\n✅ No recent updates detected`);
      console.log('   Update process may have completed or stopped');
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUpdateStatus();

