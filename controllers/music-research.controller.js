import axios from 'axios';
import { config } from '../config/index.js';

// Google Knowledge Graph search
export async function searchKnowledgeGraph(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching Knowledge Graph for:', artist);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    // Search Google Knowledge Graph API
    const searchQuery = encodeURIComponent(artist);
    const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${searchQuery}&key=${apiKey}&limit=1&types=MusicGroup,Person,MusicRecording`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.itemListElement && data.itemListElement.length > 0) {
      const entity = data.itemListElement[0].result;
      
      const result = {
        name: entity.name || artist,
        description: entity.description || entity.detailedDescription?.articleBody || 'No description available',
        genre: entity.genre || 'Unknown',
        birthDate: entity.birthDate || 'Unknown',
        birthPlace: entity.birthPlace || 'Unknown',
        bandMembers: entity.member || [],
        url: entity.url || entity.detailedDescription?.url || '',
        image: entity.image?.contentUrl || ''
      };

      res.json(result);
    } else {
      res.json({ 
        name: artist,
        description: 'No information found in Knowledge Graph',
        error: 'No results found'
      });
    }
  } catch (error) {
    console.error('Knowledge Graph search error:', error);
    res.status(500).json({ error: 'Failed to search Knowledge Graph' });
  }
}

// Wikipedia search with Wikidata integration
export async function searchWikipedia(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching Wikipedia/Wikidata for:', artist);

    // First search for the page
    const searchQuery = encodeURIComponent(artist);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await axios.get(searchUrl);
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      res.json({ 
        name: artist,
        description: 'No Wikipedia page found',
        error: 'No results found'
      });
      return;
    }

    const pageTitle = searchData.query.search[0].title;
    console.log('📄 Found Wikipedia page:', pageTitle);

    // Get page summary for description first
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryResponse = await axios.get(summaryUrl);
    const summaryData = summaryResponse.data;

    // Get Wikidata information for structured data
    const wikidataInfo = await getWikidataInfo(pageTitle);
    
    // Fallback: if Wikidata didn't find birth place, try extracting from description
    if (wikidataInfo.birthPlace === 'Unknown' && summaryData.extract) {
      const extractedPlace = extractPlaceFromText(summaryData.extract);
      if (extractedPlace) {
        wikidataInfo.birthPlace = extractedPlace;
        console.log('📍 Fallback extraction from description:', extractedPlace);
      }
    }
    
    // Fallback: if no band members found in Wikidata, try extracting from description
    if (wikidataInfo.bandMembers.length === 0 && summaryData.extract) {
      const extractedMembers = extractBandMembersFromText(summaryData.extract);
      if (extractedMembers.length > 0) {
        wikidataInfo.bandMembers = extractedMembers;
        console.log('👥 Fallback extraction of band members:', extractedMembers.length);
      }
    }

    const result = {
      name: pageTitle,
      description: summaryData.extract || 'No description available',
      genre: wikidataInfo.genre || 'Various',
      birthDate: wikidataInfo.birthDate || 'Unknown',
      birthPlace: wikidataInfo.birthPlace || 'Unknown',
      bandMembers: wikidataInfo.bandMembers || [],
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      image: summaryData.thumbnail?.source || ''
    };

    res.json(result);
  } catch (error) {
    console.error('Wikipedia search error:', error);
    res.status(500).json({ error: 'Failed to search Wikipedia' });
  }
}

// Get structured data from Wikidata
async function getWikidataInfo(pageTitle) {
  try {
    // Get Wikidata ID from Wikipedia page
    const wikidataUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(pageTitle)}&ppprop=wikibase_item`;
    
    const wikidataResponse = await axios.get(wikidataUrl);
    const pages = wikidataResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
    
    if (!wikidataId) {
      console.log('❌ No Wikidata ID found');
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    console.log('🔍 Found Wikidata ID:', wikidataId);

    // Get structured data from Wikidata
    const dataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&format=json&props=claims`;
    
    const dataResponse = await axios.get(dataUrl);
    const entity = dataResponse.data.entities[wikidataId];
    
    if (!entity) {
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    const claims = entity.claims || {};
    
    // Extract birth place (P19) or formation place (P740 for bands)
    let birthPlace = 'Unknown';
    
    // Try birth place first (P19)
    if (claims.P19 && claims.P19[0]) {
      const placeId = claims.P19[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }
    
    // If no birth place, try formation place for bands (P740)
    if (birthPlace === 'Unknown' && claims.P740 && claims.P740[0]) {
      const placeId = claims.P740[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }
    
    // If still no place, try founded in (P571)
    if (birthPlace === 'Unknown' && claims.P571 && claims.P571[0]) {
      const placeId = claims.P571[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }

    // Extract birth date (P569)
    let birthDate = 'Unknown';
    if (claims.P569 && claims.P569[0]) {
      const dateValue = claims.P569[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) {
        birthDate = formatWikidataDate(dateValue);
      }
    }

    // Extract band members (P527 for "has part")
    let bandMembers = [];
    if (claims.P527) {
      for (const member of claims.P527) {
        const memberId = member.mainsnak?.datavalue?.value?.id;
        if (memberId) {
          const memberName = await getEntityLabel(memberId);
          if (memberName) {
            bandMembers.push({ name: memberName, instrument: 'Unknown', birthPlace: 'Unknown' });
          }
        }
      }
    }

    console.log('📍 Wikidata extracted:', { birthPlace, birthDate, members: bandMembers.length });

    return {
      birthDate,
      birthPlace,
      bandMembers,
      genre: 'Various' // Could extract from P136 (genre) if needed
    };

  } catch (error) {
    console.error('Wikidata extraction error:', error);
    return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
  }
}

// Get place name from Wikidata ID
async function getPlaceName(placeId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${placeId}&format=json&props=labels&languages=en`;
    const response = await axios.get(url);
    const entity = response.data.entities[placeId];
    return entity?.labels?.en?.value || 'Unknown';
  } catch (error) {
    console.error('Error getting place name:', error);
    return 'Unknown';
  }
}

// Get entity label from Wikidata ID
async function getEntityLabel(entityId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=labels&languages=en`;
    const response = await axios.get(url);
    const entity = response.data.entities[entityId];
    return entity?.labels?.en?.value || null;
  } catch (error) {
    console.error('Error getting entity label:', error);
  return null;
}
}

// Format Wikidata date
function formatWikidataDate(dateString) {
  try {
    // Wikidata dates are in format +1965-00-00T00:00:00Z
    const year = dateString.match(/\+(\d{4})/);
    if (year) {
      return year[1];
    }
    return 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

// Extract place from text as fallback
function extractPlaceFromText(text) {
  const placePatterns = [
    /formed in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /born in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /from[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /based in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /originated in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /started in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /established in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i
  ];
  
  for (const pattern of placePatterns) {
    const match = text.match(pattern);
    if (match) {
      let place = match[1].trim();
      place = place.replace(/[,\n].*$/, '').trim();
      if (place.length > 0 && place.length < 100) {
        return place;
      }
    }
  }
  
  return null;
}

// Extract band members from text as fallback
function extractBandMembersFromText(text) {
  const members = [];
  
  // Look for patterns like "consisted of [names]" or "members included [names]"
  const memberPatterns = [
    /consisted of[:\s]+([^.]+?)\./i,
    /members included[:\s]+([^.]+?)\./i,
    /members were[:\s]+([^.]+?)\./i,
    /band members[:\s]+([^.]+?)\./i
  ];
  
  for (const pattern of memberPatterns) {
    const match = text.match(pattern);
    if (match) {
      const memberText = match[1];
      console.log('🎵 Found member text:', memberText);
      
      // Split by common separators and clean up
      const memberNames = memberText
        .split(/[,;]|\sand\s/i)
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.length < 50)
        .map(name => {
          // Clean up common prefixes/suffixes
          return name
            .replace(/^(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)\s+/i, '')
            .replace(/\s+(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)$/i, '')
            .trim();
        })
        .filter(name => name.length > 0);
      
      // Handle the case where we have "and" in the middle of the text
      // Split the original text more carefully
      const fullMemberText = memberText.replace(/^(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)\s+/i, '');
      const allMembers = fullMemberText
        .split(/\sand\s/i)
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .flatMap(part => part.split(/[,;]/))
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.length < 50);
      
      console.log('👥 All members after better splitting:', allMembers);
      
      // Use the better splitting result
      allMembers.forEach(name => {
        if (name && name.length > 0) {
          members.push({
            name: name,
            birthPlace: 'Unknown',
            birthDate: 'Unknown'
          });
        }
      });
      
      break; // Only process the first match
    }
  }
  
  return members;
}


// YouTube search
export async function searchYouTube(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching YouTube for:', artist);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    // Search YouTube Data API
    const searchQuery = encodeURIComponent(artist);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&key=${apiKey}&maxResults=6`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.items && data.items.length > 0) {
      const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || ''
    }));

    res.json({ videos });
    } else {
      res.json({ videos: [] });
    }
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
}

// Map data for birth places using Wikipedia/Wikidata
export async function getMapData(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Getting map data for:', artist);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    // Get artist information from Wikipedia/Wikidata
    const artistInfo = await getArtistInfoFromWikipedia(artist);
    
    let mapData = [];
    let timelineEvents = [];

    // Process main artist birth place
    if (artistInfo.birthPlace && artistInfo.birthPlace !== 'Unknown') {
      const geocoded = await geocodeLocation(artistInfo.birthPlace, apiKey);
      if (geocoded) {
        mapData.push(geocoded);
        timelineEvents.push({
          date: artistInfo.birthDate || 'Unknown',
          title: `Born: ${artistInfo.name}`,
          description: `Birth of ${artistInfo.name}`,
          location: artistInfo.birthPlace,
          type: 'birth',
          coordinates: { lat: geocoded.lat, lng: geocoded.lng }
        });
      }
    }

    // Process band members' birth places
    if (artistInfo.bandMembers && artistInfo.bandMembers.length > 0) {
      for (const member of artistInfo.bandMembers) {
        if (member.birthPlace && member.birthPlace !== 'Unknown') {
          const geocoded = await geocodeLocation(member.birthPlace, apiKey);
          if (geocoded) {
            // Check if this location is already in mapData
            const exists = mapData.some(loc => 
              Math.abs(loc.lat - geocoded.lat) < 0.01 && 
              Math.abs(loc.lng - geocoded.lng) < 0.01
            );
            
            if (!exists) {
              mapData.push(geocoded);
            }
            
          timelineEvents.push({
              date: member.birthDate || 'Unknown',
              title: `Band Member: ${member.name}`,
              description: `${member.name}${member.instrument ? ` (${member.instrument})` : ''}`,
              location: member.birthPlace,
              type: 'other',
              coordinates: { lat: geocoded.lat, lng: geocoded.lng }
      });
    }
  }
      }
    }

    console.log('📍 Map data extracted:', { locations: mapData.length, events: timelineEvents.length });

    res.json({ 
      mapData,
      timelineEvents 
    });
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ error: 'Failed to get map data' });
  }
}

// Get artist info from Wikipedia/Wikidata
async function getArtistInfoFromWikipedia(artist) {
  try {
    // Search for the page
    const searchQuery = encodeURIComponent(artist);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await axios.get(searchUrl);
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
    }

    const pageTitle = searchData.query.search[0].title;
    console.log('📄 Found Wikipedia page for map data:', pageTitle);

    // Get Wikidata information
    const wikidataInfo = await getWikidataInfo(pageTitle);
        
        return {
      name: pageTitle,
      birthPlace: wikidataInfo.birthPlace,
      birthDate: wikidataInfo.birthDate,
      bandMembers: wikidataInfo.bandMembers
    };
  } catch (error) {
    console.error('Error getting artist info:', error);
    return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
  }
}

// Geocode a location using Google Maps API
async function geocodeLocation(placeName, apiKey) {
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&key=${apiKey}`;
    
    const geoResponse = await axios.get(geocodingUrl);
    const geoData = geoResponse.data;
    
    if (geoData.results && geoData.results.length > 0) {
      const location = geoData.results[0].geometry.location;
      console.log('📍 Geocoded:', placeName, '->', location);
      return {
        name: placeName,
        lat: location.lat,
        lng: location.lng
      };
    }
    
    console.log('❌ Geocoding failed for:', placeName);
    return null;
  } catch (error) {
    console.error('Geocoding error for', placeName, ':', error);
    return null;
  }
}

// Get Google API key
export async function getGoogleApiKey(req, res) {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (apiKey) {
      console.log('🗺️ Using Google Maps API key from environment');
      res.json({ apiKey: apiKey });
    } else {
      console.warn('❌ No Google Maps API key found in environment variables');
      res.json({ apiKey: null });
    }
  } catch (error) {
    console.error('Google API key error:', error);
    res.status(500).json({ error: 'Failed to get Google API key' });
  }
}

// Test birth date extraction
export async function testBirthDateExtraction(req, res) {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Mock birth date extraction
    const mockResult = {
      extractedDate: '1960-10-09',
      confidence: 0.85,
      source: 'Wikipedia'
    };

    res.json(mockResult);
  } catch (error) {
    console.error('Birth date extraction error:', error);
    res.status(500).json({ error: 'Failed to extract birth date' });
  }
}