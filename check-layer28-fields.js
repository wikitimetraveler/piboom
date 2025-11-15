async function checkLayer28Fields() {
  const baseUrl = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer';
  const testLat = 29.7604; // Houston
  const testLng = -95.3698;
  const buffer = 0.01;
  const geometry = {
    xmin: testLng - buffer,
    ymin: testLat - buffer,
    xmax: testLng + buffer,
    ymax: testLat + buffer,
    spatialReference: { wkid: 4326 }
  };
  
  console.log('🔍 Checking Layer 28 field names...\n');
  
  // First, get layer info to see available fields
  const layerInfoUrl = `${baseUrl}/28?f=json`;
  const layerInfoResponse = await fetch(layerInfoUrl);
  
  if (layerInfoResponse.ok) {
    const layerInfo = await layerInfoResponse.json();
    console.log('📋 Available Fields in Layer 28:');
    if (layerInfo.fields) {
      layerInfo.fields.forEach(field => {
        console.log(`   ${field.name} (${field.type}) - ${field.alias || 'No alias'}`);
      });
    }
  }
  
  // Now query for actual data
  console.log('\n🔍 Querying Layer 28 for actual data...\n');
  const queryUrl = `${baseUrl}/28/query`;
  const params = new URLSearchParams({
    f: 'geojson',
    where: '1=1',
    outFields: '*', // Get all fields
    returnGeometry: 'true',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnCountOnly: 'false'
  });
  
  const response = await fetch(`${queryUrl}?${params.toString()}`);
  
  if (response.ok) {
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      console.log(`✅ Found ${data.features.length} features\n`);
      const feature = data.features[0];
      const props = feature.properties || {};
      
      console.log('📊 First Feature Properties:');
      Object.keys(props).forEach(key => {
        console.log(`   ${key}: ${props[key]}`);
      });
      
      // Check for common flood zone field name variations
      console.log('\n🔍 Checking for flood zone field variations:');
      const possibleZoneFields = ['FLD_ZONE', 'flood_zone', 'ZONE', 'zone', 'FLDZONE', 'FLOODZONE', 'ZONE_SUBTY', 'ZONE_TYPE'];
      possibleZoneFields.forEach(field => {
        if (props[field] !== undefined) {
          console.log(`   ✅ Found ${field}: ${props[field]}`);
        }
      });
    } else {
      console.log('❌ No features found');
    }
  } else {
    console.log(`❌ Query failed: ${response.status} ${response.statusText}`);
  }
  
  process.exit(0);
}

checkLayer28Fields();
