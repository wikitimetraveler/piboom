import 'dotenv/config';
import { initializeDatabase, createTables } from '../services/database.service.js';
import { backfillLaneDataFromFilesystem } from '../services/lane-postgres.service.js';

async function main() {
  try {
    initializeDatabase();
    await createTables();
    const result = await backfillLaneDataFromFilesystem();
    console.log(
      `✅ Lane JSON migration complete: imported ${result.imported} dataset(s); graph rebuilt=${result.graphRebuilt}`
    );
    if (Array.isArray(result.files) && result.files.length) {
      console.log(`   Files: ${result.files.join(', ')}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Lane JSON migration failed:', error?.message || error);
    process.exit(1);
  }
}

await main();
