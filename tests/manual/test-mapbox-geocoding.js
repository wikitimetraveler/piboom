/**
 * Development work by David Lane
 */
/**
 * Test Mapbox Geocoding API
 * 
 * This script tests Mapbox geocoding and compares it to Nominatim
 * 
 * Usage:
 *   node test-mapbox-geocoding.js
 * 
 * Requires: MAPBOX_API_KEY in .env (optional - will test Nominatim if not set)
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Test Mapbox Geocoding API
 */
async function testMapboxGeocoding(address) {
  if (!MAPBOX_API_KEY) {
    console.log('⚠️  MAPBOX_API_KEY not set in .env - skipping Mapbox test');
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_API_KEY}&country=US&limit=1`;
    
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.error(`❌ Mapbox API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const placeName = feature.place_name;
      
      return {
        success: true,
        latitude: lat,
        longitude: lng,
        place_name: placeName,
        duration: `${duration}ms`,
        provider: 'Mapbox'
      };
    }
    
    return {
      success: false,
      message: 'No results found',
      provider: 'Mapbox'
    };
  } catch (error) {
    console.error(`❌ Mapbox geocoding error:`, error.message);
    return {
      success: false,
      error: error.message,
      provider: 'Mapbox'
    };
  }
}

/**
 * Test Nominatim Geocoding API (for comparison)
 */
async function testNominatimGeocoding(address) {
  try {
    const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=us`;
    
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevConnectLabs-Test/1.0 (testing geocoding services)'
      }
    });
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.error(`❌ Nominatim API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      
      return {
        success: true,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        place_name: result.display_name,
        duration: `${duration}ms`,
        provider: 'Nominatim (OpenStreetMap)'
      };
    }
    
    return {
      success: false,
      message: 'No results found',
      provider: 'Nominatim (OpenStreetMap)'
    };
  } catch (error) {
    console.error(`❌ Nominatim geocoding error:`, error.message);
    return {
      success: false,
      error: error.message,
      provider: 'Nominatim (OpenStreetMap)'
    };
  }
}

/**
 * Run comparison tests
 */
async function runTests() {
  console.log('🧪 Testing Geocoding Services\n');
  console.log('='.repeat(60));
  
  // Test addresses
  const testAddresses = [
    {
      address: '123 Main St, Austin, TX 78701',
      description: 'Specific street address'
    },
    {
      address: 'Austin, TX',
      description: 'City/State only'
    },
    {
      address: 'Travis County, TX',
      description: 'County/State'
    },
    {
      address: '1600 Amphitheatre Parkway, Mountain View, CA',
      description: 'Famous address (Google HQ)'
    }
  ];
  
  for (let i = 0; i < testAddresses.length; i++) {
    const test = testAddresses[i];
    console.log(`\n📍 Test ${i + 1}: ${test.description}`);
    console.log(`   Address: ${test.address}`);
    console.log('-'.repeat(60));
    
    // Test Nominatim (always available)
    console.log('\n🌍 Testing Nominatim (OpenStreetMap)...');
    const nominatimResult = await testNominatimGeocoding(test.address);
    if (nominatimResult) {
      if (nominatimResult.success) {
        console.log(`   ✅ Success!`);
        console.log(`   📍 Location: ${nominatimResult.place_name}`);
        console.log(`   🗺️  Coordinates: ${nominatimResult.latitude}, ${nominatimResult.longitude}`);
        console.log(`   ⏱️  Duration: ${nominatimResult.duration}`);
      } else {
        console.log(`   ❌ Failed: ${nominatimResult.message || nominatimResult.error}`);
      }
    }
    
    // Rate limiting for Nominatim (1 req/sec)
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Test Mapbox (if API key available)
    console.log('\n🗺️  Testing Mapbox...');
    const mapboxResult = await testMapboxGeocoding(test.address);
    if (mapboxResult) {
      if (mapboxResult.success) {
        console.log(`   ✅ Success!`);
        console.log(`   📍 Location: ${mapboxResult.place_name}`);
        console.log(`   🗺️  Coordinates: ${mapboxResult.latitude}, ${mapboxResult.longitude}`);
        console.log(`   ⏱️  Duration: ${mapboxResult.duration}`);
        
        // Compare results if both succeeded
        if (nominatimResult && nominatimResult.success) {
          const latDiff = Math.abs(nominatimResult.latitude - mapboxResult.latitude);
          const lngDiff = Math.abs(nominatimResult.longitude - mapboxResult.longitude);
          const distanceKm = calculateDistance(
            nominatimResult.latitude,
            nominatimResult.longitude,
            mapboxResult.latitude,
            mapboxResult.longitude
          );
          
          console.log(`\n   📊 Comparison:`);
          console.log(`   Distance between results: ${distanceKm?.toFixed(2) || 'N/A'} km`);
          console.log(`   Latitude difference: ${(latDiff * 111).toFixed(2)} km`);
          console.log(`   Longitude difference: ${(lngDiff * 111 * Math.cos(nominatimResult.latitude * Math.PI / 180)).toFixed(2)} km`);
        }
      } else {
        console.log(`   ❌ Failed: ${mapboxResult.message || mapboxResult.error}`);
      }
    } else {
      console.log(`   ⚠️  Skipped (no API key)`);
    }
    
    // Wait between tests
    if (i < testAddresses.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Testing Complete!\n');
  
  // Summary
  console.log('📊 Summary:');
  console.log('- Nominatim: FREE forever, 1 req/sec limit');
  if (MAPBOX_API_KEY) {
    console.log('- Mapbox: 100k requests/month FREE, then $0.75/1k');
    console.log('- Mapbox: Faster responses, higher rate limits');
  } else {
    console.log('- Mapbox: Not tested (no API key in .env)');
    console.log('  💡 Add MAPBOX_API_KEY to .env to test Mapbox');
  }
  console.log('\n');
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Test error:', error.message);
  process.exit(1);
});

