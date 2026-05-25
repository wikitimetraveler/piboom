/**
 * Development work by David Lane
 */
import 'dotenv/config';

/**
 * Refresh multi-source hazard webcams into fire_cameras (fixed mounts).
 * Run manually or on a separate cron — NOT part of refresh-disasters.js.
 *
 * Usage:
 *   npm run refresh:hazard-webcams
 *   node scripts/refresh-hazard-webcams.js --sources=usgs_nims,alertcalifornia
 */

import { initializeDatabase, createTables } from '../services/database.service.js';
import { initDisastersSchema } from '../services/disasters.service.js';
import { ingestHazardWebcams } from '../services/hazard-webcam-ingest.service.js';

function parseSourcesArg() {
  const flag = process.argv.find((a) => a.startsWith('--sources='));
  if (flag) return flag.split('=')[1];
  const env = process.env.HAZARD_WEBCAM_SOURCES;
  return env || 'all';
}

async function main() {
  const sources = parseSourcesArg();
  console.log('📹 Hazard Webcams Refresh');
  console.log('=========================');
  console.log('Sources:', sources);

  try {
    const pool = initializeDatabase();
    if (!pool) {
      console.error('❌ Database not initialized - DATABASE_URL required');
      process.exit(1);
    }
    await createTables();
    await initDisastersSchema();

    const result = await ingestHazardWebcams({ sources });
    console.log('✅ Hazard webcam refresh complete');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
