#!/usr/bin/env node
/**
 * Development work by David Lane
 */

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
  pruneOldDisasters,
  backfillDisasterGeocodes,
} from '../services/disasters.service.js';
import { getAllLoans } from '../services/loan-pipeline.service.js';
import { batchAnalyzeRisk } from '../services/disaster-risk.service.js';
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

    console.log('📍 Backfilling disaster geocodes...');
    const geocodeBackfill = await backfillDisasterGeocodes();
    console.log('   Geocode backfill complete', geocodeBackfill || {});

    console.log('🧹 Pruning disasters older than 90 days...');
    await pruneOldDisasters();
    console.log('   Prune complete');

    if (!skipFema) {
      console.log('🏠 Refreshing loan pipeline FEMA risk scores...');
      const loans = await getAllLoans();
      if (loans.length > 0) {
        const loanResults = await batchAnalyzeRisk(loans);
        const withDecls = loanResults.filter((r) => (r.disasterCount || 0) > 0).length;
        console.log(`   Loan FEMA risk refresh complete: ${loanResults.length} loans (${withDecls} with active 90d declarations)`);
      } else {
        console.log('   No loans in pipeline to analyze');
      }
    }

    console.log('🕸️ Refreshing disaster impact graph...');
    const graphRes = await refreshDisasterImpactGraphFromCurrentData();
    console.log('   Graph refresh complete', graphRes?.seeded || {});

    console.log('✅ Disaster refresh complete');
    await pool.end().catch(() => {});
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
