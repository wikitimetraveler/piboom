import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function countFireCameras() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS total
      FROM disasters
      WHERE source = 'alertcalifornia'
        AND event_type = 'camera'
    `);

    const total = Number(result.rows[0]?.total || 0);
    console.log(`📊 Current wildfire camera rows: ${total}`);
  } catch (error) {
    console.error('❌ Failed to count wildfire cameras:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

countFireCameras();

