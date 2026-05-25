/**
 * Development work by David Lane
 */
#!/usr/bin/env node

/**
 * Standalone script to generate Grateful Dead KML file
 * Can be run without the server: node scripts/generate-grateful-dead-kml.js
 */

import { config } from '../config/index.js';
import { initializeDatabase, createTables } from '../services/database.service.js';
import { importTourData, generateKMLFile } from '../services/grateful-dead-tour.service.js';

async function main() {
  console.log('🎸 Grateful Dead KML Generator');
  console.log('================================');

  try {
    // Initialize database
    console.log('🔧 Initializing database...');
    initializeDatabase();
    await createTables();

    // Check if we have shows in database
    const { getAllShows } = await import('../services/grateful-dead-tour.service.js');
    const existingShows = await getAllShows();

    if (existingShows.length === 0) {
      console.log('📥 No shows found in database. Importing from setlist.fm...');
      console.log('⚠️  This requires SETLISTFM_API_KEY and GOOGLE_GEOCODING_API_KEY environment variables');
      
      const showCount = await importTourData();
      console.log(`✅ Imported ${showCount} shows`);
    } else {
      console.log(`📊 Found ${existingShows.length} shows in database`);
    }

    // Generate KML file
    console.log('🗺️  Generating KML file...');
    const result = await generateKMLFile();
    
    console.log('✅ Success!');
    console.log(`📁 KML file saved: ${result.filePath}`);
    console.log(`🎵 Contains ${result.showCount} Grateful Dead shows`);
    console.log('');
    console.log('💡 You can now:');
    console.log('   - Open the KML file in Google Earth');
    console.log('   - Upload it to Google My Maps');
    console.log('   - Use it in your DevConnect Labs application');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 Make sure you have:');
    console.error('   - DATABASE_URL environment variable set');
    console.error('   - SETLISTFM_API_KEY for data import');
    console.error('   - GOOGLE_GEOCODING_API_KEY for venue coordinates');
    process.exit(1);
  }
}

// Run the script
main();
