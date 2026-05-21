#!/usr/bin/env node

import 'dotenv/config';

/**
 * Refresh ALERTCalifornia fire cameras into fire_cameras (fixed mounts).
 * Run manually or on a separate cron — NOT part of refresh-disasters.js.
 *
 * After ingest, removes legacy alertcalifornia/camera rows from disasters if any remain.
 */

import { initializeDatabase, createTables } from '../services/database.service.js';
import {
  initDisastersSchema,
  ingestCaFireCameras
} from '../services/disasters.service.js';

async function main() {
  console.log('📹 CA Fire Cameras Refresh');
  console.log('==========================');

  try {
    const pool = initializeDatabase();
    if (!pool) {
      console.error('❌ Database not initialized - DATABASE_URL required');
      process.exit(1);
    }
    await createTables();
    await initDisastersSchema();

    const result = await ingestCaFireCameras();
    console.log('✅ Camera refresh complete', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
