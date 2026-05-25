/**
 * Development work by David Lane
 */
#!/usr/bin/env node

import 'dotenv/config';

/**
 * Standalone script to refresh disaster data from all sources.
 * Run once per day via cron: 0 6 * * * cd /path/to/your-project && node scripts/refresh-disasters.js
 *
 * Data sources: FEMA, NASA FIRMS, USGS, NWS, NHC (no wildfire cameras)
 *
 * Skip FEMA: SKIP_FEMA=1 node scripts/refresh-disasters.js
 */

import { initializeDatabase, createTables } from '../services/database.service.js';
import {
  initDisastersSchema,
  ingestFema,
  ingestFirmsNrt,
  ingestUsgsQuakes,
  ingestNwsCap,
  ingestNhc,
  pruneOldDisasters
} from '../services/disasters.service.js';
import { refreshDisasterImpactGraphFromCurrentData } from '../services/disaster-impact-graph.service.js';

async function main() {
  console.log('📊 Disaster Data Refresh');
  console.log('========================');

  try {
    console.log('🔧 Initializing database...');
    const pool = initializeDatabase();
    if (!pool) {
      console.error('❌ Database not initialized - DATABASE_URL required');
      process.exit(1);
    }
    await createTables();
    await initDisastersSchema();

    const skipFema = process.env.SKIP_FEMA === '1' || process.env.SKIP_FEMA === 'true';

    if (!skipFema) {
      console.log('📥 Ingesting FEMA...');
      const fema = await ingestFema();
      console.log(`   FEMA: ${fema?.inserted ?? 0} inserted`);
    } else {
      console.log('⏭️  Skipping FEMA (SKIP_FEMA=1)');
    }

    console.log('📥 Ingesting NASA FIRMS (fires)...');
    const firms = await ingestFirmsNrt();
    console.log(`   FIRMS: ${firms?.inserted ?? 0} inserted`);

    console.log('📥 Ingesting USGS earthquakes...');
    const usgs = await ingestUsgsQuakes();
    console.log(`   USGS: ${usgs?.inserted ?? 0} inserted`);

    console.log('📥 Ingesting NWS alerts...');
    const nws = await ingestNwsCap();
    console.log(`   NWS: ${nws?.inserted ?? 0} inserted`);

    console.log('📥 Ingesting NHC hurricanes...');
    const nhc = await ingestNhc();
    console.log(`   NHC: ${nhc?.inserted ?? 0} inserted`);

    console.log('🧹 Pruning disasters older than 90 days...');
    await pruneOldDisasters();
    console.log('   Prune complete');

    console.log('🕸️ Refreshing disaster impact graph...');
    const graphRes = await refreshDisasterImpactGraphFromCurrentData();
    console.log('   Graph refresh complete', graphRes?.seeded || {});

    console.log('✅ Disaster refresh complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
