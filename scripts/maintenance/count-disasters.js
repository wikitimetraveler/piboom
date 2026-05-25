/**
 * Development work by David Lane
 */
import { config } from 'dotenv';
import { initializeDatabase, getPool } from './services/database.service.js';

config();

async function countDisasters() {
  try {
    initializeDatabase();
    const pool = getPool();
    
    if (!pool) {
      throw new Error('Database not initialized');
    }
    
    // Count total disasters
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM disasters
    `);
    
    const total = totalResult.rows[0].total;
    console.log(`\n📊 Disaster Records Count:\n`);
    console.log(`Total Records: ${total}`);
    
    // Count by source
    const sourceResult = await pool.query(`
      SELECT 
        source,
        COUNT(*) as count
      FROM disasters
      GROUP BY source
      ORDER BY count DESC
    `);
    
    if (sourceResult.rows.length > 0) {
      console.log(`\nBy Source:`);
      sourceResult.rows.forEach(row => {
        console.log(`  ${row.source}: ${row.count}`);
      });
    }
    
    // Count by event type
    const eventTypeResult = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM disasters
      GROUP BY event_type
      ORDER BY count DESC
    `);
    
    if (eventTypeResult.rows.length > 0) {
      console.log(`\nBy Event Type:`);
      eventTypeResult.rows.forEach(row => {
        console.log(`  ${row.event_type}: ${row.count}`);
      });
    }
    
    // Count by state
    const stateResult = await pool.query(`
      SELECT 
        state_abbr,
        COUNT(*) as count
      FROM disasters
      WHERE state_abbr IS NOT NULL
      GROUP BY state_abbr
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (stateResult.rows.length > 0) {
      console.log(`\nTop 10 States:`);
      stateResult.rows.forEach(row => {
        console.log(`  ${row.state_abbr}: ${row.count}`);
      });
    }
    
    // Recent disasters (last 7 days)
    const recentResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM disasters
      WHERE start_time >= NOW() - INTERVAL '7 days'
    `);
    
    console.log(`\nRecent Disasters (last 7 days): ${recentResult.rows[0].count}`);
    
    // Oldest and newest
    const dateRangeResult = await pool.query(`
      SELECT 
        MIN(start_time) as oldest,
        MAX(start_time) as newest
      FROM disasters
    `);
    
    if (dateRangeResult.rows[0].oldest) {
      console.log(`\nDate Range:`);
      console.log(`  Oldest: ${dateRangeResult.rows[0].oldest}`);
      console.log(`  Newest: ${dateRangeResult.rows[0].newest}`);
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

countDisasters();

