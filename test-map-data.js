import 'dotenv/config';
import axios from 'axios';

const WIKIPEDIA_SEARCH_URL = 'https://en.wikipedia.org/w/api.php';

async function testMapData() {
  console.log('🗺️ Testing map data extraction...');
  
  try {
    // Test Wikipedia search
    const searchResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: 'Eminem',
        srlimit: 1
      }
    });

    console.log('Wikipedia search result:', searchResponse.data.query?.search?.[0]?.title);

    const pageTitle = searchResponse.data.query?.search?.[0]?.title;
    
    if (!pageTitle) {
      console.log('❌ No page found');
      return;
    }

    // Get page content
    const pageResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'extracts',
        titles: pageTitle,
        exintro: true,
        explaintext: true
      }
    });

    const pages = pageResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const pageData = pages[pageId];

    if (!pageData || pageData.missing) {
      console.log('❌ Page not found');
      return;
    }

    console.log('Page content preview:', pageData.extract?.substring(0, 200) + '...');

    // Test birth place extraction with improved patterns
    const birthPlacePatterns = [
      /born in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /from[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /birthplace[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /formed in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /based in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /hails from[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /originated in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /started in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
      /established in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i
    ];
    
    let birthPlace = null;
    for (const pattern of birthPlacePatterns) {
      const match = pageData.extract.match(pattern);
      if (match) {
        let place = match[1].trim();
        place = place.replace(/[,\n].*$/, '').trim();
        if (place.length > 0 && place.length < 100) {
          birthPlace = place;
          console.log('📍 Pattern matched:', pattern.toString(), '->', place);
          break;
        }
      }
    }

    console.log('Extracted birth place:', birthPlace);

    if (birthPlace && process.env.GOOGLE_API_KEY) {
      // Test geocoding
      const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: birthPlace,
          key: process.env.GOOGLE_API_KEY
        }
      });

      const location = geocodeResponse.data.results?.[0]?.geometry?.location;
      if (location) {
        console.log('✅ Geocoding successful:', location);
      } else {
        console.log('❌ Geocoding failed');
      }
    } else {
      console.log('❌ No birth place found or no API key');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMapData();
