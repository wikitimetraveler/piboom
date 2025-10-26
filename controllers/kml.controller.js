import fetch from 'node-fetch';
import { DOMParser } from 'xmldom';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.memoryStorage();
export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.google-earth.kml+xml' || 
        file.originalname.endsWith('.kml') ||
        file.mimetype === 'text/xml' ||
        file.mimetype === 'application/xml') {
      cb(null, true);
    } else {
      cb(new Error('Only KML files are allowed'));
    }
  }
});

/**
 * Upload and parse KML file
 */
export async function uploadKML(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const kmlContent = req.file.buffer.toString('utf-8');
    const parsedData = parseKMLContent(kmlContent);

    res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    console.error('KML upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Load KML from URL or local file
 */
export async function loadKMLFromURL(req, res) {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    let kmlContent;

    // Check if it's a local file path (starts with /data/)
    if (url.startsWith('/data/')) {
      // Load from local filesystem
      const fileName = url.replace('/data/', '');
      const filePath = path.join(__dirname, '..', 'data', fileName);
      
      console.log('Loading local KML file:', filePath);
      
      try {
        kmlContent = await fs.readFile(filePath, 'utf-8');
      } catch (readError) {
        throw new Error(`Failed to read local KML file: ${readError.message}`);
      }
    } else {
      // Fetch KML content from external URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch KML: ${response.statusText}`);
      }
      kmlContent = await response.text();
    }

    const parsedData = parseKMLContent(kmlContent);

    res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    console.error('KML URL load error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Parse KML content
 */
function parseKMLContent(kmlContent) {
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');

  const locations = [];
  const events = [];

  // Parse Placemarks
  const placemarks = kmlDoc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    
    // Get name
    const nameEl = placemark.getElementsByTagName('name')[0];
    const name = nameEl ? nameEl.textContent : `Location ${i + 1}`;

    // Get description
    const descEl = placemark.getElementsByTagName('description')[0];
    const description = descEl ? descEl.textContent : '';

    // Get coordinates
    const coordsEl = placemark.getElementsByTagName('coordinates')[0];
    if (coordsEl) {
      const coordsText = coordsEl.textContent.trim();
      const coords = coordsText.split(',');
      
      if (coords.length >= 2) {
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Extract date from TimeStamp, description, or extended data
          const date = extractDateFromTimeStamp(placemark) ||
                      extractDateFromDescription(description) || 
                      extractDateFromExtendedData(placemark);

          const location = {
            name,
            description,
            lat,
            lng,
            date
          };

          locations.push(location);

          // Create timeline event with original index for stable sorting
          events.push({
            name,
            description,
            location: name,
            date: date || 'Unknown',
            coordinates: { lat, lng },
            originalIndex: events.length
          });
        }
      }
    }
  }

  // Keep events in the original order from the KML file
  // (No sorting - preserve document order)

  return {
    locations,
    events,
    metadata: {
      name: getKMLName(kmlDoc),
      description: getKMLDescription(kmlDoc)
    }
  };
}

/**
 * Normalize date string for sorting
 * Handles formats: YYYY-MM-DD, YYYY-MM, YYYY
 */
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === 'Unknown') {
    return new Date('9999-12-31'); // Sort unknowns to end
  }
  
  // Handle year only (e.g., "1947")
  if (/^\d{4}$/.test(dateStr)) {
    return new Date(`${dateStr}-01-01`);
  }
  
  // Handle year-month (e.g., "1960-12")
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}-01`);
  }
  
  // Handle full date (e.g., "1941-05-24")
  return new Date(dateStr);
}

/**
 * Extract date from KML TimeStamp element
 */
function extractDateFromTimeStamp(placemark) {
  // Try to find TimeStamp element
  const timeStampEl = placemark.getElementsByTagName('TimeStamp')[0];
  if (timeStampEl) {
    const whenEl = timeStampEl.getElementsByTagName('when')[0];
    if (whenEl) {
      return whenEl.textContent.trim();
    }
  }
  
  // Try to find TimeSpan element (start date)
  const timeSpanEl = placemark.getElementsByTagName('TimeSpan')[0];
  if (timeSpanEl) {
    const beginEl = timeSpanEl.getElementsByTagName('begin')[0];
    if (beginEl) {
      return beginEl.textContent.trim();
    }
  }
  
  return null;
}

/**
 * Extract date from description text
 */
function extractDateFromDescription(description) {
  if (!description) return null;

  // Try to find date patterns
  const datePatterns = [
    /\b(\d{4})-(\d{2})-(\d{2})\b/,  // YYYY-MM-DD
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,  // MM/DD/YYYY
    /\b(\d{4})\b/  // Year only
  ];

  for (const pattern of datePatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * Extract date from KML extended data
 */
function extractDateFromExtendedData(placemark) {
  const extendedData = placemark.getElementsByTagName('ExtendedData')[0];
  if (!extendedData) return null;

  const dataElements = extendedData.getElementsByTagName('Data');
  for (let i = 0; i < dataElements.length; i++) {
    const dataEl = dataElements[i];
    const name = dataEl.getAttribute('name');
    
    if (name && (name.toLowerCase().includes('date') || name.toLowerCase().includes('time'))) {
      const valueEl = dataEl.getElementsByTagName('value')[0];
      if (valueEl) {
        return valueEl.textContent;
      }
    }
  }

  return null;
}

/**
 * Get KML document name
 */
function getKMLName(kmlDoc) {
  const docEl = kmlDoc.getElementsByTagName('Document')[0];
  if (docEl) {
    const nameEl = docEl.getElementsByTagName('name')[0];
    if (nameEl) {
      return nameEl.textContent;
    }
  }
  return 'KML Document';
}

/**
 * Get KML document description
 */
function getKMLDescription(kmlDoc) {
  const docEl = kmlDoc.getElementsByTagName('Document')[0];
  if (docEl) {
    const descEl = docEl.getElementsByTagName('description')[0];
    if (descEl) {
      return descEl.textContent;
    }
  }
  return '';
}

/**
 * Search YouTube for videos related to location/event
 */
export async function searchYouTube(req, res) {
  try {
    const { query, location, date } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Google API key not configured'
      });
    }

    // Build search query
    let searchQuery = query;
    if (location) {
      searchQuery += ` ${location}`;
    }
    if (date) {
      // Extract year if date is present
      const yearMatch = date.match(/\b(\d{4})\b/);
      if (yearMatch) {
        searchQuery += ` ${yearMatch[1]}`;
      }
    }

    // Search YouTube
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(searchQuery)}&type=video&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'YouTube API request failed');
    }

    // Format video results
    const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt
    }));

    res.json({
      success: true,
      videos,
      query: searchQuery
    });
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get location details from Google Places API
 */
export async function getLocationDetails(req, res) {
  try {
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required'
      });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Google API key not configured'
      });
    }

    // Search for place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(location)}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchResponse.ok || !searchData.candidates || searchData.candidates.length === 0) {
      return res.json({
        success: false,
        error: 'Location not found'
      });
    }

    const place = searchData.candidates[0];

    // Get place details
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,photos,rating,types,website&key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (!detailsResponse.ok) {
      throw new Error('Failed to get place details');
    }

    res.json({
      success: true,
      location: detailsData.result
    });
  } catch (error) {
    console.error('Location details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  uploadKML,
  loadKMLFromURL,
  searchYouTube,
  getLocationDetails,
  upload
};

