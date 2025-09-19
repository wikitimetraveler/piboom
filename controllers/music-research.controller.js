import axios from 'axios';

// Wikipedia API configuration
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1';
const WIKIPEDIA_SEARCH_URL = 'https://en.wikipedia.org/w/api.php';

// Google API configuration (single key for all Google services)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_KNOWLEDGE_GRAPH_URL = 'https://kgsearch.googleapis.com/v1/entities:search';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

/**
 * Search Google Knowledge Graph Cloud for artist information
 */
const searchKnowledgeGraph = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    const response = await axios.get(GOOGLE_KNOWLEDGE_GRAPH_URL, {
      params: {
        query: artist,
        key: GOOGLE_API_KEY,
        types: 'Person,MusicGroup',
        limit: 1
      }
    });

    const result = response.data.itemListElement?.[0]?.result;
    
    if (!result) {
      return res.json({ error: 'No artist information found' });
    }

    // Extract relevant information
    const artistInfo = {
      name: result.name,
      description: result.detailedDescription?.articleBody || result.description,
      genre: extractGenreFromKG(result),
      birthDate: result.birthDate,
      birthPlace: extractBirthPlaceFromKG(result),
      bandMembers: extractBandMembersFromKG(result),
      type: result['@type']?.includes('MusicGroup') ? 'Band' : 'Person',
      image: result.image?.contentUrl,
      url: result.url
    };

    res.json(artistInfo);

  } catch (error) {
    console.error('Knowledge Graph API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch artist information' });
  }
};

/**
 * Search Wikipedia for artist information
 */
const searchWikipedia = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    // First, search for the artist page
    const searchResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: artist,
        srlimit: 1,
        srprop: 'snippet'
      }
    });

    const searchResults = searchResponse.data.query?.search;
    
    if (!searchResults || searchResults.length === 0) {
      return res.json({ error: 'No artist information found' });
    }

    const pageTitle = searchResults[0].title;
    
    // Get the full page content (including more than just intro for better data extraction)
    const pageResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'extracts|pageimages|info',
        titles: pageTitle,
        exintro: false, // Get more than just intro
        exsentences: 10, // Get first 10 sentences for better context
        explaintext: true,
        piprop: 'original',
        inprop: 'url'
      }
    });

    const pages = pageResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const pageData = pages[pageId];

    if (!pageData || pageData.missing) {
      return res.json({ error: 'Artist page not found' });
    }

    // Extract relevant information
    const artistInfo = {
      name: pageData.title,
      description: pageData.extract || 'No description available',
      genre: extractGenreFromText(pageData.extract),
      birthDate: extractBirthDate(pageData.extract) || extractBirthDateFromInfobox(pageData.extract),
      birthPlace: extractBirthPlace(pageData.extract),
      bandMembers: extractBandMembers(pageData.extract),
      type: determineArtistType(pageData.extract),
      image: pageData.original?.source,
      url: pageData.fullurl
    };

    res.json(artistInfo);

  } catch (error) {
    console.error('Wikipedia API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch artist information' });
  }
};

/**
 * Search YouTube for artist videos
 */
const searchYouTube = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: 'snippet',
        q: `${artist} music`,
        type: 'video',
        key: GOOGLE_API_KEY,
        maxResults: 6,
        order: 'relevance'
      }
    });

    const videos = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url,
      publishedAt: item.snippet.publishedAt
    }));

    res.json({ videos });

  } catch (error) {
    console.error('YouTube API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
};

/**
 * Get map data for artist birth places using Wikipedia
 */
const getMapData = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    // First get artist info from Wikipedia to find birth places
    const searchResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: artist,
        srlimit: 1
      }
    });

    const searchResults = searchResponse.data.query?.search;
    
    if (!searchResults || searchResults.length === 0) {
      return res.json({ error: 'No artist information found' });
    }

    const pageTitle = searchResults[0].title;
    
    // Get the full page content
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
      return res.json({ error: 'Artist page not found' });
    }

    const birthPlaces = extractBirthPlaces(pageData.extract);
    const mapData = [];
    const timelineEvents = [];

    // Get coordinates for each birth place and create timeline events
    for (const place of birthPlaces) {
      try {
        const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: place,
            key: GOOGLE_API_KEY
          }
        });

        const location = geocodeResponse.data.results?.[0]?.geometry?.location;
        if (location) {
          mapData.push({
            name: place,
            lat: location.lat,
            lng: location.lng
          });
          
          // Create timeline event for birth place
          timelineEvents.push({
            date: 'Unknown',
            title: `Birth Place: ${place}`,
            description: `Birth place of ${artist}`,
            location: place,
            type: 'birth',
            coordinates: { lat: location.lat, lng: location.lng }
          });
        }
      } catch (geocodeError) {
        console.error(`Geocoding error for ${place}:`, geocodeError.message);
      }
    }

    // Extract additional timeline events from the text
    const additionalEvents = extractTimelineEvents(pageData.extract, artist);
    timelineEvents.push(...additionalEvents);

    // Sort timeline events chronologically
    timelineEvents.sort((a, b) => {
      const dateA = parseDateForSorting(a.date);
      const dateB = parseDateForSorting(b.date);
      return dateA - dateB;
    });

    res.json({ 
      mapData,
      timelineEvents 
    });

  } catch (error) {
    console.error('Map Data Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
};

// Helper functions for Knowledge Graph data extraction

function extractGenreFromKG(result) {
  // Try to extract genre from various properties
  const genre = result.genre || 
                result.detailedDescription?.articleBody?.match(/genre[:\s]+([^,\.]+)/i)?.[1] ||
                result.description?.match(/genre[:\s]+([^,\.]+)/i)?.[1];
  return genre?.trim();
}

function extractBirthPlaceFromKG(result) {
  // Extract birth place from various sources
  return result.birthPlace?.name || 
         result.birthPlace?.address?.addressLocality ||
         result.birthPlace?.address?.addressCountry ||
         result.birthPlace;
}

function extractBandMembersFromKG(result) {
  if (!result.member || !Array.isArray(result.member)) {
    return [];
  }
  
  return result.member.map(member => ({
    name: member.name,
    instrument: member.instrument || member.role,
    birthPlace: extractBirthPlaceFromKG(member)
  }));
}

// Helper functions for Wikipedia text parsing

function extractGenreFromText(text) {
  if (!text) return null;
  
  // Look for genre patterns in Wikipedia text
  const genrePatterns = [
    /genre[:\s]+([^,\.]+)/i,
    /musical genre[:\s]+([^,\.]+)/i,
    /style[:\s]+([^,\.]+)/i,
    /known for[:\s]+([^,\.]+)/i
  ];
  
  for (const pattern of genrePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractBirthDate(text) {
  if (!text) return null;
  
  // Enhanced birth date patterns for better extraction (ordered by specificity)
  const birthPatterns = [
    // Most specific patterns first - exact date formats
    /born[:\s]+([A-Za-z]+ \d{1,2},? \d{4})/i,
    /born[:\s]+(\d{1,2} [A-Za-z]+ \d{4})/i,
    /born[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    
    // Parenthetical patterns with dates
    /\(born[:\s]+([A-Za-z]+ \d{1,2},? \d{4})\)/i,
    /\(born[:\s]+(\d{1,2} [A-Za-z]+ \d{4})\)/i,
    /\(born[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\)/i,
    
    // Just year patterns
    /born[:\s]+(\d{4})/i,
    /\(born[:\s]+(\d{4})\)/i,
    
    // Wikipedia infobox patterns
    /birth_date[:\s]*=?\s*([A-Za-z]+ \d{1,2},? \d{4})/i,
    /born[:\s]*=?\s*([A-Za-z]+ \d{1,2},? \d{4})/i,
    /birth_date[:\s]*=?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /born[:\s]*=?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    
    // Age-based patterns (calculate birth year)
    /born[:\s]+([^,\.]+)[^,\.]*?\(age[:\s]*(\d+)\)/i,
    
    // More flexible patterns but with better boundaries
    /born[:\s]+([A-Za-z]+ \d{1,2},? \d{4})[^A-Za-z]/i,
    /born[:\s]+(\d{1,2} [A-Za-z]+ \d{4})[^A-Za-z]/i,
    
    // Fallback patterns (less specific)
    /born[:\s]+([^,\.\(]+(?:January|February|March|April|May|June|July|August|September|October|November|December)[^,\.\(]*)/i,
    /born[:\s]+([^,\.\(]+\d{4}[^,\.\(]*)/i,
    
    // Last resort patterns (most general)
    /born[:\s]+([^,\.]+)/i,
    /birth[:\s]+([^,\.]+)/i,
    /\(born[:\s]+([^\)]+)\)/i
  ];
  
  for (const pattern of birthPatterns) {
    const match = text.match(pattern);
    if (match) {
      let dateStr = match[1].trim();
      
      // Clean up the date string
      dateStr = dateStr.replace(/[,\s]+$/, ''); // Remove trailing commas/spaces
      dateStr = dateStr.replace(/^[,\s]+/, ''); // Remove leading commas/spaces
      
      // If we found an age-based pattern, try to calculate birth year
      if (pattern.source.includes('age') && match[2]) {
        const currentYear = new Date().getFullYear();
        const age = parseInt(match[2]);
        const birthYear = currentYear - age;
        return birthYear.toString();
      }
      
      // Validate that we have a reasonable date
      if (isValidDateString(dateStr)) {
        return dateStr;
      }
    }
  }
  
  return null;
}

// Helper function to validate date strings
function isValidDateString(dateStr) {
  if (!dateStr || dateStr.length < 4) return false;
  
  // Check if it contains a year (4 digits)
  const yearMatch = dateStr.match(/\d{4}/);
  if (!yearMatch) return false;
  
  const year = parseInt(yearMatch[0]);
  
  // Reasonable year range (1800-2025)
  if (year < 1800 || year > 2025) return false;
  
  // Check if it's not just a random number
  if (dateStr.length < 6) return false;
  
  // Additional validation - check for common date patterns
  const hasValidDatePattern = 
    // Month name patterns
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(dateStr) ||
    // Numeric date patterns
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(dateStr) ||
    // Just year (but with some context)
    (dateStr.length <= 10 && /\d{4}/.test(dateStr));
  
  if (!hasValidDatePattern) return false;
  
  // Reject if it contains too much extra text (likely captured too much)
  if (dateStr.length > 50) return false;
  
  return true;
}

// Extract birth date from Wikipedia infobox patterns
function extractBirthDateFromInfobox(text) {
  if (!text) return null;
  
  // Look for infobox patterns that might contain birth dates
  const infoboxPatterns = [
    // Common infobox patterns
    /birth_date[:\s]*=?\s*([^|\n]+)/i,
    /born[:\s]*=?\s*([^|\n]+)/i,
    /date_of_birth[:\s]*=?\s*([^|\n]+)/i,
    /birth[:\s]*=?\s*([^|\n]+)/i,
    
    // Table-like patterns
    /\|\s*birth_date\s*=\s*([^|\n]+)/i,
    /\|\s*born\s*=\s*([^|\n]+)/i,
    /\|\s*date_of_birth\s*=\s*([^|\n]+)/i,
    
    // More specific date patterns in infobox context
    /birth_date[:\s]*=?\s*([A-Za-z]+ \d{1,2},? \d{4})/i,
    /born[:\s]*=?\s*([A-Za-z]+ \d{1,2},? \d{4})/i,
    /birth_date[:\s]*=?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /born[:\s]*=?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    
    // Parenthetical patterns in infobox
    /birth_date[:\s]*=?\s*[^|]*?\(([^)]+)\)/i,
    /born[:\s]*=?\s*[^|]*?\(([^)]+)\)/i
  ];
  
  for (const pattern of infoboxPatterns) {
    const match = text.match(pattern);
    if (match) {
      let dateStr = match[1].trim();
      
      // Clean up the date string
      dateStr = dateStr.replace(/[,\s]+$/, '');
      dateStr = dateStr.replace(/^[,\s]+/, '');
      
      // Validate that we have a reasonable date
      if (isValidDateString(dateStr)) {
        return dateStr;
      }
    }
  }
  
  return null;
}

function extractBirthPlace(text) {
  if (!text) return null;
  
  // Look for birth place patterns
  const placePatterns = [
    /born in[:\s]+([^,\.]+)/i,
    /from[:\s]+([^,\.]+)/i,
    /birthplace[:\s]+([^,\.]+)/i
  ];
  
  for (const pattern of placePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractBirthPlaces(text) {
  const places = [];
  
  // Add main birth place
  const birthPlace = extractBirthPlace(text);
  if (birthPlace) {
    places.push(birthPlace);
  }
  
  // Look for band members' birth places
  const memberPattern = /members?[:\s]+([^\.]+)/i;
  const memberMatch = text.match(memberPattern);
  if (memberMatch) {
    const membersText = memberMatch[1];
    // Look for birth places in member descriptions
    const memberPlacePattern = /\(born[:\s]+([^\)]+)\)/gi;
    let match;
    while ((match = memberPlacePattern.exec(membersText)) !== null) {
      const place = match[1].trim();
      if (place && !places.includes(place)) {
        places.push(place);
      }
    }
  }
  
  return places;
}

function extractBandMembers(text) {
  if (!text) return [];
  
  const members = [];
  
  // Look for band members section
  const memberPatterns = [
    /members?[:\s]+([^\.]+)/i,
    /lineup[:\s]+([^\.]+)/i,
    /band members?[:\s]+([^\.]+)/i
  ];
  
  for (const pattern of memberPatterns) {
    const match = text.match(pattern);
    if (match) {
      const membersText = match[1];
      // Split by common separators and clean up
      const memberList = membersText.split(/[,;]/).map(member => {
        const cleanMember = member.trim();
        const nameMatch = cleanMember.match(/^([^(]+)/);
        const instrumentMatch = cleanMember.match(/\(([^)]+)\)/);
        
        return {
          name: nameMatch ? nameMatch[1].trim() : cleanMember,
          instrument: instrumentMatch ? instrumentMatch[1].trim() : null,
          birthPlace: extractBirthPlace(cleanMember)
        };
      });
      
      members.push(...memberList);
      break;
    }
  }
  
  return members;
}

function determineArtistType(text) {
  if (!text) return 'Unknown';
  
  const bandIndicators = ['band', 'group', 'ensemble', 'collective', 'members'];
  const soloIndicators = ['singer', 'musician', 'artist', 'solo'];
  
  const lowerText = text.toLowerCase();
  
  for (const indicator of bandIndicators) {
    if (lowerText.includes(indicator)) {
      return 'Band';
    }
  }
  
  for (const indicator of soloIndicators) {
    if (lowerText.includes(indicator)) {
      return 'Solo Artist';
    }
  }
  
  return 'Musician';
}

/**
 * Extract timeline events from Wikipedia text
 */
function extractTimelineEvents(text, artistName) {
  const events = [];
  
  if (!text) return events;
  
  // Extract birth date and create birth event
  const birthDate = extractBirthDate(text);
  const birthPlace = extractBirthPlace(text);
  
  if (birthDate && birthPlace) {
    events.push({
      date: birthDate,
      title: `Born: ${artistName}`,
      description: `Birth of ${artistName}`,
      location: birthPlace,
      type: 'birth'
    });
  }
  
  // Extract band formation dates
  const formationPatterns = [
    /formed in (\d{4})/i,
    /founded in (\d{4})/i,
    /established in (\d{4})/i,
    /created in (\d{4})/i
  ];
  
  for (const pattern of formationPatterns) {
    const match = text.match(pattern);
    if (match) {
      events.push({
        date: match[1],
        title: `Band Formed: ${artistName}`,
        description: `Formation of ${artistName}`,
        location: birthPlace || 'Unknown',
        type: 'formation'
      });
      break;
    }
  }
  
  // Extract album release dates
  const albumPatterns = [
    /released (?:their )?(?:debut )?album[^.]*?(\d{4})/i,
    /album[^.]*?(\d{4})/i
  ];
  
  for (const pattern of albumPatterns) {
    const match = text.match(pattern);
    if (match) {
      events.push({
        date: match[1],
        title: `Album Release`,
        description: `Album released by ${artistName}`,
        location: 'Unknown',
        type: 'album'
      });
      break;
    }
  }
  
  // Extract band member information
  const memberPattern = /members?[:\s]+([^\.]+)/i;
  const memberMatch = text.match(memberPattern);
  if (memberMatch) {
    const membersText = memberMatch[1];
    const memberPlacePattern = /\(born[:\s]+([^\)]+)\)/gi;
    let match;
    while ((match = memberPlacePattern.exec(membersText)) !== null) {
      const place = match[1].trim();
      events.push({
        date: 'Unknown',
        title: `Band Member Birth Place`,
        description: `Band member from ${place}`,
        location: place,
        type: 'other'
      });
    }
  }
  
  return events;
}

/**
 * Parse date string for chronological sorting
 */
function parseDateForSorting(dateString) {
  if (!dateString || dateString === 'Unknown') {
    return new Date(1900, 0, 1);
  }
  
  // Try to extract year from various formats
  const yearMatch = dateString.match(/(\d{4})/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }
  
  // Try to parse the full date
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return new Date(1900, 0, 1);
}

/**
 * Get Google API key for frontend
 */
const getGoogleApiKey = async (req, res) => {
  try {
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }
    
    res.json({ apiKey: GOOGLE_API_KEY });
  } catch (error) {
    console.error('API Key Error:', error.message);
    res.status(500).json({ error: 'Failed to get API key' });
  }
};

/**
 * Test birth date extraction for debugging
 */
const testBirthDateExtraction = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    // Get Wikipedia page content
    const searchResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: artist,
        srlimit: 1
      }
    });

    const searchResults = searchResponse.data.query?.search;
    
    if (!searchResults || searchResults.length === 0) {
      return res.json({ error: 'No artist information found' });
    }

    const pageTitle = searchResults[0].title;
    
    // Get the full page content
    const pageResponse = await axios.get(WIKIPEDIA_SEARCH_URL, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'extracts',
        titles: pageTitle,
        exintro: false,
        exsentences: 15,
        explaintext: true
      }
    });

    const pages = pageResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const pageData = pages[pageId];

    if (!pageData || pageData.missing) {
      return res.json({ error: 'Artist page not found' });
    }

    // Test different extraction methods
    const birthDate1 = extractBirthDate(pageData.extract);
    const birthDate2 = extractBirthDateFromInfobox(pageData.extract);
    const birthPlace = extractBirthPlace(pageData.extract);

    res.json({
      artist: pageTitle,
      text: pageData.extract.substring(0, 1000) + '...', // First 1000 chars for debugging
      birthDate: {
        method1: birthDate1,
        method2: birthDate2,
        final: birthDate1 || birthDate2
      },
      birthPlace: birthPlace,
      textLength: pageData.extract.length
    });

  } catch (error) {
    console.error('Birth Date Test Error:', error.message);
    res.status(500).json({ error: 'Failed to test birth date extraction' });
  }
};

export {
  searchKnowledgeGraph,
  searchWikipedia,
  searchYouTube,
  getMapData,
  getGoogleApiKey,
  testBirthDateExtraction
};
