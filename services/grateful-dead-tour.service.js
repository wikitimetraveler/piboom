import { getPool } from './database.service.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD format
 */
function convertDateFormat(dateStr) {
  if (!dateStr) return null;
  
  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Convert DD-MM-YYYY to YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  
  return dateStr; // Return as-is if format is unexpected
}

/**
 * Fetch Grateful Dead tour data from setlist.fm API
 */
export async function fetchTourDataFromAPI() {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    throw new Error('SETLISTFM_API_KEY environment variable is required');
  }

  const shows = [];
  let page = 1;
  let totalPages = 1;

  console.log('🎸 Fetching Grateful Dead tour data from setlist.fm...');

  while (page <= totalPages) {
    try {
      const url = `https://api.setlist.fm/rest/1.0/search/setlists?artistMbid=6faa7ca7-0d99-4a5e-bfa6-1fd5037520c6&p=${page}&sort=eventDate`;
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (response.status === 429) {
        console.log(`⏳ Rate limited on page ${page}, waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue; // Retry the same page
      }

      if (!response.ok) {
        throw new Error(`setlist.fm API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (page === 1) {
        totalPages = Math.ceil(data.total / 20); // 20 results per page
        console.log(`📊 Found ${data.total} shows across ${totalPages} pages`);
      }

      // Process shows from this page
      for (const setlist of data.setlist) {
        const show = {
          show_date: convertDateFormat(setlist.eventDate),
          venue_name: setlist.venue?.name || 'Unknown Venue',
          city: setlist.venue?.city?.name || '',
          state: setlist.venue?.city?.state || '',
          country: setlist.venue?.city?.country?.name || '',
          setlist: JSON.stringify(setlist.sets?.set || []),
          attendance: null, // Not available in setlist.fm
          recording_available: false,
          archive_identifier: null,
          notes: setlist.info || ''
        };

        shows.push(show);
      }

      console.log(`📄 Processed page ${page}/${totalPages} (${data.setlist.length} shows)`);
      
      // Rate limiting: 2 requests per second
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      page++;
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error.message);
      throw error;
    }
  }

  console.log(`✅ Fetched ${shows.length} shows from setlist.fm`);
  return shows;
}

/**
 * Geocode venue to get coordinates
 */
export async function geocodeVenue(venue, city, state, country) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_API_KEY not set - skipping geocoding');
    return { latitude: null, longitude: null };
  }

  try {
    const address = [venue, city, state, country].filter(Boolean).join(', ');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } else {
      console.warn(`⚠️  Geocoding failed for: ${address}`);
      return { latitude: null, longitude: null };
    }
  } catch (error) {
    console.error(`❌ Geocoding error for ${venue}:`, error.message);
    return { latitude: null, longitude: null };
  }
}

/**
 * Save tour data to database
 */
export async function saveTourDataToDB(showData) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  console.log(`💾 Saving ${showData.length} shows to database...`);

  for (const show of showData) {
    try {
      await pool.query(`
        INSERT INTO grateful_dead_shows (
          show_date, venue_name, city, state, country, 
          latitude, longitude, setlist, attendance, 
          recording_available, archive_identifier, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (show_date, venue_name, city) 
        DO UPDATE SET
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          setlist = EXCLUDED.setlist,
          attendance = EXCLUDED.attendance,
          recording_available = EXCLUDED.recording_available,
          archive_identifier = EXCLUDED.archive_identifier,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
      `, [
        show.show_date,
        show.venue_name,
        show.city,
        show.state,
        show.country,
        show.latitude,
        show.longitude,
        show.setlist,
        show.attendance,
        show.recording_available,
        show.archive_identifier,
        show.notes
      ]);
    } catch (error) {
      console.error(`❌ Error saving show ${show.show_date} at ${show.venue_name}:`, error.message);
    }
  }

  console.log('✅ Shows saved to database');
}

/**
 * Get all shows from database
 */
export async function getAllShows() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not initialized');
  }

  const result = await pool.query(`
    SELECT * FROM grateful_dead_shows 
    ORDER BY show_date ASC
  `);

  return result.rows;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate KML from shows data
 */
export function generateKMLFromShows(shows) {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Grateful Dead: The Endless Tour (1965-1995)</name>
    <description>Complete tour history of the Grateful Dead from 1965 to 1995 - ${shows.length} shows across the world</description>
    
    <Style id="deadIcon">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>1.0</scale>
      </LabelStyle>
      <BalloonStyle>
        <text><![CDATA[
          <b>$[name]</b><br/>
          $[description]
        ]]></text>
      </BalloonStyle>
    </Style>`;

  let placemarks = '';

  shows.forEach((show, index) => {
    const date = new Date(show.show_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const setlist = show.setlist ? JSON.parse(show.setlist) : [];
    const setlistPreview = setlist.length > 0 ? 
      setlist.map(set => set.song?.map(song => song.name).join(', ')).join(' | ') : 
      'Setlist not available';

    const description = `
      <b>Date:</b> ${escapeXml(date)}<br/>
      <b>Venue:</b> ${escapeXml(show.venue_name)}<br/>
      <b>Location:</b> ${escapeXml(show.city)}${show.state ? ', ' + escapeXml(show.state) : ''}${show.country ? ', ' + escapeXml(show.country) : ''}<br/>
      ${show.attendance ? `<b>Attendance:</b> ${show.attendance.toLocaleString()}<br/>` : ''}
      <b>Setlist:</b> ${escapeXml(setlistPreview)}<br/>
      ${show.recording_available ? '<b>Recording:</b> Available on Archive.org<br/>' : ''}
      ${show.notes ? `<b>Notes:</b> ${escapeXml(show.notes)}<br/>` : ''}
    `.trim();

    const coordinates = show.longitude && show.latitude ? 
      `${show.longitude},${show.latitude},0` : 
      '0,0,0';

    placemarks += `
    <Placemark>
      <name>${escapeXml(show.venue_name)} - ${escapeXml(date)}</name>
      <description>
        <![CDATA[${description}]]>
      </description>
      <styleUrl>#deadIcon</styleUrl>
      <LookAt>
        <longitude>${show.longitude || 0}</longitude>
        <latitude>${show.latitude || 0}</latitude>
        <altitude>0</altitude>
        <heading>0</heading>
        <tilt>0</tilt>
        <range>2000</range>
      </LookAt>
      <Point>
        <coordinates>${coordinates}</coordinates>
      </Point>
    </Placemark>`;
  });

  const kmlFooter = `
  </Document>
</kml>`;

  return kmlHeader + placemarks + kmlFooter;
}

/**
 * Save KML content to file
 */
export async function saveKMLToFile(kmlContent, filename = 'grateful-dead-endless-tour.kml') {
  const dataDir = path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, filename);
  
  try {
    await fs.writeFile(filePath, kmlContent, 'utf-8');
    console.log(`✅ KML file saved: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`❌ Error saving KML file:`, error.message);
    throw error;
  }
}

/**
 * Import tour data from setlist.fm and save to database
 */
export async function importTourData() {
  try {
    console.log('🎸 Starting Grateful Dead tour data import...');
    
    // Initialize database first
    const { initializeDatabase, createTables } = await import('./database.service.js');
    initializeDatabase();
    await createTables();
    
    // Fetch data from API
    const shows = await fetchTourDataFromAPI();
    
    // Geocode venues that don't have coordinates
    console.log('🌍 Geocoding venues...');
    for (const show of shows) {
      if (!show.latitude || !show.longitude) {
        const coords = await geocodeVenue(
          show.venue_name, 
          show.city, 
          show.state, 
          show.country
        );
        show.latitude = coords.latitude;
        show.longitude = coords.longitude;
        
        // Rate limiting for geocoding
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Save to database
    await saveTourDataToDB(shows);
    
    console.log('✅ Tour data import completed');
    return shows.length;
  } catch (error) {
    console.error('❌ Tour data import failed:', error.message);
    throw error;
  }
}

/**
 * Generate and save KML file from database
 */
export async function generateKMLFile() {
  try {
    console.log('🗺️  Generating KML file from database...');
    
    // Get all shows from database
    const shows = await getAllShows();
    
    if (shows.length === 0) {
      throw new Error('No shows found in database. Run import first.');
    }
    
    // Generate KML content
    const kmlContent = generateKMLFromShows(shows);
    
    // Save to file
    const filePath = await saveKMLToFile(kmlContent);
    
    console.log(`✅ KML file generated with ${shows.length} shows`);
    return { filePath, showCount: shows.length };
  } catch (error) {
    console.error('❌ KML generation failed:', error.message);
    throw error;
  }
}

export default {
  fetchTourDataFromAPI,
  geocodeVenue,
  saveTourDataToDB,
  getAllShows,
  generateKMLFromShows,
  saveKMLToFile,
  importTourData,
  generateKMLFile
};
