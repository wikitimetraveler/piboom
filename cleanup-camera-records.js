import { config } from 'dotenv';
import { initializeDatabase, getPool } from './services/database.service.js';

config();

async function cleanupCameraRecords() {
  try {
    initializeDatabase();
    const pool = getPool();
    
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Count camera records first
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
    `);
    
    const count = countResult.rows[0].count;
    console.log(`\n📊 Found ${count} camera records in disasters table`);
    
    if (count === 0) {
      console.log('✅ No camera records to clean up');
      process.exit(0);
    }
    
    // Ask for confirmation (in a real script, you'd use readline)
    console.log('\n⚠️  This will DELETE all camera records from the disasters table.');
    console.log('   To proceed, uncomment the DELETE query below and run again.\n');
    
    // Uncomment the following lines to actually delete:
    /*
    console.log('🗑️  Deleting camera records...');
    const deleteResult = await pool.query(`
      DELETE FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
    `);
    
    console.log(`✅ Deleted ${deleteResult.rowCount} camera records`);
    */
    
    // Show breakdown by date
    const dateBreakdown = await pool.query(`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as count
      FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
      GROUP BY DATE(start_time)
      ORDER BY date DESC
      LIMIT 10
    `);
    
    if (dateBreakdown.rows.length > 0) {
      console.log('\nRecent camera record dates:');
      dateBreakdown.rows.forEach(row => {
        console.log(`  ${row.date}: ${row.count} records`);
      });
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupCameraRecords();



