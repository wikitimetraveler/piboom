/**
 * Development work by David Lane
 */
import { config } from 'dotenv';
import { queryFloodZoneForPoint } from './services/disaster-risk.service.js';

config();

async function testFloodZoneEndpoints() {
  console.log('🧪 Testing FEMA NFHL API endpoints...\n');
  
  // Test with a known flood-prone location (Houston, TX - Harris County)
  const testLocations = [
    { name: 'Houston, TX (flood-prone)', lat: 29.7604, lng: -95.3698 },
    { name: 'New Orleans, LA (flood-prone)', lat: 29.9511, lng: -90.0715 },
    { name: 'Miami, FL (coastal)', lat: 25.7617, lng: -80.1918 }
  ];
  
  for (const location of testLocations) {
    console.log(`\n📍 Testing: ${location.name} (${location.lat}, ${location.lng})`);
    console.log('─'.repeat(60));
    
    try {
      const result = await queryFloodZoneForPoint(location.lat, location.lng);
      
      if (result) {
        console.log('✅ SUCCESS! Flood zone data retrieved:');
        console.log(`   Flood Zone: ${result.floodZone || 'N/A'}`);
        console.log(`   Zone Type: ${result.zoneType || 'N/A'}`);
        console.log(`   DFIRM ID: ${result.dfirmId || 'N/A'}`);
        console.log(`   Base Flood Elevation: ${result.baseFloodElevation || 'N/A'}`);
        console.log(`   Floodway: ${result.floodway || 'N/A'}`);
        
        // Debug: show what's actually in result
        console.log(`\n   🔍 Debug - Result keys: ${Object.keys(result).join(', ')}`);
        console.log(`   🔍 Debug - result.floodZone value: "${result.floodZone}" (type: ${typeof result.floodZone})`);
        
        // Show boundary information
        if (result.boundaries) {
          console.log(`   Boundaries: ${result.boundaryCount || result.boundaries.length} found`);
          if (result.boundaries.length > 0) {
            console.log(`   First boundary properties:`, Object.keys(result.boundaries[0].properties || {}).slice(0, 5).join(', '));
            console.log(`   Boundary has geometry: ${result.boundaries[0].geometry ? 'Yes' : 'No'}`);
          }
        } else {
          console.log(`   Boundaries: None found`);
        }
        
        if (result.zoneGeometry) {
          console.log(`   Zone Geometry: Yes (${result.zoneGeometry.type || 'unknown'})`);
        }
        
        // Show sample of fullData if available
        if (result.fullData) {
          const sampleKeys = Object.keys(result.fullData).slice(0, 15);
          console.log(`   Zone Data fields: ${sampleKeys.join(', ')}${Object.keys(result.fullData).length > 15 ? '...' : ''}`);
          // Show FLD_ZONE value directly
          if (result.fullData.FLD_ZONE !== undefined) {
            console.log(`   🔍 Debug - fullData.FLD_ZONE: "${result.fullData.FLD_ZONE}"`);
          }
        }
      } else {
        console.log('❌ No flood zone data found (or all endpoints failed)');
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Testing complete!\n');
  process.exit(0);
}

testFloodZoneEndpoints().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

