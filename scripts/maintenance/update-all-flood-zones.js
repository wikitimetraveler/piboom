/**
 * Development work by David Lane
 */
import { config } from 'dotenv';
import { initializeDatabase } from './services/database.service.js';
import { batchUpdateFloodZones } from './services/disaster-risk.service.js';

config();

async function updateAllFloodZones() {
  try {
    console.log('🚀 Starting flood zone update for all loans...\n');
    
    // Initialize database
    initializeDatabase();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const forceUpdate = args.includes('--force') || args.includes('-f');
    const limitArg = args.find(arg => arg.startsWith('--limit=') || arg.startsWith('-l='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
    
    if (forceUpdate) {
      console.log('⚠️  Force update mode: Will update ALL loans, even if already checked\n');
    } else {
      console.log('ℹ️  Normal mode: Will only update loans without flood zone data\n');
    }
    
    if (limit) {
      console.log(`📊 Limiting to ${limit} loans\n`);
    }
    
    // Run batch update
    const startTime = Date.now();
    const results = await batchUpdateFloodZones(limit, forceUpdate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Loans Processed: ${results.total}`);
    console.log(`Successfully Updated: ${results.updated}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Duration: ${duration} seconds`);
    console.log('='.repeat(60) + '\n');
    
    // Show success rate
    if (results.total > 0) {
      const successRate = ((results.updated / results.total) * 100).toFixed(1);
      console.log(`✅ Success Rate: ${successRate}%`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating flood zones:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node update-all-flood-zones.js [options]

Options:
  --force, -f              Force update all loans, even if already checked
  --limit=N, -l=N        Limit to N loans (e.g., --limit=100)
  --help, -h             Show this help message

Examples:
  node update-all-flood-zones.js
    Update only loans without flood zone data
  
  node update-all-flood-zones.js --force
    Update ALL loans, even if already checked
  
  node update-all-flood-zones.js --limit=50
    Update only first 50 loans without flood zone data
  
  node update-all-flood-zones.js --force --limit=100
    Force update first 100 loans
  `);
  process.exit(0);
}

updateAllFloodZones();

