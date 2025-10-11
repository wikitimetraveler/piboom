// Migrate existing albums to The Cosmic Turtle user
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function migrateToCosmicTurtle() {
  console.log('🐢 Starting migration to The Cosmic Turtle...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Count existing albums without a user_id
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM records WHERE user_id IS NULL'
    );
    const albumCount = parseInt(countResult.rows[0].count);
    
    console.log(`📀 Found ${albumCount} albums to migrate`);

    if (albumCount === 0) {
      console.log('✅ No albums to migrate - all albums already have owners!');
      await pool.end();
      return;
    }

    // Update all albums with NULL user_id to cosmic-turtle
    const updateResult = await pool.query(
      `UPDATE records 
       SET user_id = 'cosmic-turtle' 
       WHERE user_id IS NULL 
       RETURNING artist, album`
    );

    console.log(`\n🎉 Successfully migrated ${updateResult.rowCount} albums to The Cosmic Turtle!\n`);
    
    // Show first 10 albums as confirmation
    console.log('📋 Sample of migrated albums:');
    updateResult.rows.slice(0, 10).forEach((album, i) => {
      console.log(`   ${i + 1}. ${album.album} by ${album.artist}`);
    });
    
    if (updateResult.rowCount > 10) {
      console.log(`   ... and ${updateResult.rowCount - 10} more!`);
    }

    console.log('\n✨ Migration complete! The Cosmic Turtle now owns all your albums! 🐢🎵\n');

    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Run migration
migrateToCosmicTurtle();

