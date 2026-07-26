/**
 * Python Service Integration Example
 * 
 * Demonstrates how to call the Python service from Node.js
 * Run this after starting both the Node.js server and Python service.
 * 
 * Usage:
 *   node examples/python-service-example.js
 */

import pythonClient from '../services/python-client.service.js';

async function main() {
  console.log('Python Service Integration Example\n');
  console.log('=' .repeat(50));

  try {
    // Check if Python service is available
    console.log('\n1. Checking Python service availability...');
    const isAvailable = await pythonClient.isAvailable();
    console.log(`   Python service: ${isAvailable ? '✓ Available' : '✗ Unavailable'}`);

    if (!isAvailable) {
      console.log('\n   Please start the Python service first:');
      console.log('   npm run python:dev');
      return;
    }

    // Get disaster statistics
    console.log('\n2. Fetching disaster statistics (last 90 days)...');
    const stats = await pythonClient.getDisasterStats();
    console.log('   Stats:', JSON.stringify(stats.stats, null, 2));

    // Get disasters by type
    console.log('\n3. Fetching disasters by type...');
    const byType = await pythonClient.getDisastersByType(30);
    console.log(`   Found ${byType.breakdown.length} disaster types in last 30 days:`);
    byType.breakdown.slice(0, 5).forEach(item => {
      console.log(`   - ${item.event_type}: ${item.count} events`);
    });

    // Get recent disasters in California
    console.log('\n4. Fetching recent California disasters...');
    const caDisasters = await pythonClient.getRecentDisasters({
      state: 'CA',
      days: 30
    });
    console.log(`   Found ${caDisasters.count} disasters in California (last 30 days)`);
    if (caDisasters.disasters.length > 0) {
      const first = caDisasters.disasters[0];
      console.log(`   Example: ${first.event_type} in ${first.county_name}, ${first.state_abbr}`);
    }

    // Get disasters near a location (Orange County, CA)
    console.log('\n5. Fetching disasters near Orange County, CA...');
    const nearbyDisasters = await pythonClient.getDisastersNear({
      lat: 33.7175,
      lng: -117.8311,
      radius: 50,
      days: 60
    });
    console.log(`   Found ${nearbyDisasters.count} disasters within 50 miles`);
    if (nearbyDisasters.disasters.length > 0) {
      nearbyDisasters.disasters.slice(0, 3).forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.event_type} - ${d.distance_miles.toFixed(1)} miles away`);
      });
    }

    // Get disasters for specific county
    console.log('\n6. Fetching disasters for Orange County (FIPS 06059)...');
    const countyDisasters = await pythonClient.getDisastersByCounty('06059', 90);
    console.log(`   Found ${countyDisasters.count} disasters in Orange County`);

    console.log('\n' + '=' .repeat(50));
    console.log('Example completed successfully!\n');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nMake sure:');
    console.error('1. The Python service is running (npm run python:dev)');
    console.error('2. Your .env file has DATABASE_URL configured');
    console.error('3. The database has disaster data');
    process.exit(1);
  }
}

main();
