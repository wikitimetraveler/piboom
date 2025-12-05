import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function dedupeFireCameras() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📹 Starting wildfire camera dedupe...');
    await pool.query('BEGIN');

    const deleteResult = await pool.query(`
      DELETE FROM disasters
      WHERE source = 'alertcalifornia'
        AND event_type = 'camera'
    `);
    const deleted = deleteResult.rowCount;
    await pool.query('COMMIT');

    console.log(`✅ Deleted ${deleted} wildfire camera rows (alertcalifornia).`);
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('❌ Dedupe failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

dedupeFireCameras().catch(() => process.exit(1));

