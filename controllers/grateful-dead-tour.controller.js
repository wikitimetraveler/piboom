/**
 * Development work by David Lane
 */
import { 
  getAllShows, 
  importTourData, 
  generateKMLFile,
  geocodeVenue 
} from '../services/grateful-dead-tour.service.js';
import { getPool } from '../services/database.service.js';

/**
 * Get all Grateful Dead shows (paginated)
 */
export async function getShows(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const pool = getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM grateful_dead_shows');
    const total = parseInt(countResult.rows[0].count);

    // Get shows for this page
    const result = await pool.query(`
      SELECT * FROM grateful_dead_shows 
      ORDER BY show_date ASC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      data: {
        shows: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting shows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get Grateful Dead shows on a specific calendar date (YYYY-MM-DD).
 */
export async function getShowsByDate(req, res) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    const day = parseInt(req.query.day, 10);

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'year, month, and day query parameters are required'
      });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    const result = await pool.query(
      `SELECT * FROM grateful_dead_shows WHERE show_date = $1 ORDER BY venue_name ASC`,
      [dateKey]
    );

    res.json({
      success: true,
      date: dateKey,
      shows: result.rows
    });
  } catch (error) {
    console.error('Error getting shows by date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get single show by ID
 */
export async function getShowById(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const result = await pool.query(
      'SELECT * FROM grateful_dead_shows WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Show not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting show:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Import tour data from setlist.fm API
 */
export async function importData(req, res) {
  try {
    console.log('🎸 Starting tour data import...');
    
    const showCount = await importTourData();
    
    res.json({
      success: true,
      message: `Successfully imported ${showCount} shows`,
      showCount
    });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Generate KML file and return as JSON
 */
export async function generateKML(req, res) {
  try {
    console.log('🗺️  Generating KML file...');
    
    const result = await generateKMLFile();
    
    res.json({
      success: true,
      message: `KML file generated with ${result.showCount} shows`,
      filePath: result.filePath,
      showCount: result.showCount
    });
  } catch (error) {
    console.error('Error generating KML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Download KML file
 */
export async function downloadKML(req, res) {
  try {
    const result = await generateKMLFile();
    
    res.download(result.filePath, 'grateful-dead-endless-tour.kml', (err) => {
      if (err) {
        console.error('Error downloading KML:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download KML file'
        });
      }
    });
  } catch (error) {
    console.error('Error downloading KML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Geocode shows without coordinates
 */
export async function geocodeMissing(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Get shows without coordinates
    const result = await pool.query(`
      SELECT * FROM grateful_dead_shows 
      WHERE latitude IS NULL OR longitude IS NULL
      ORDER BY show_date ASC
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'All shows already have coordinates',
        geocoded: 0
      });
    }

    console.log(`🌍 Geocoding ${result.rows.length} shows...`);
    let geocoded = 0;

    for (const show of result.rows) {
      try {
        const coords = await geocodeVenue(
          show.venue_name,
          show.city,
          show.state,
          show.country
        );

        if (coords.latitude && coords.longitude) {
          await pool.query(
            'UPDATE grateful_dead_shows SET latitude = $1, longitude = $2 WHERE id = $3',
            [coords.latitude, coords.longitude, show.id]
          );
          geocoded++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error geocoding show ${show.id}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Geocoded ${geocoded} shows`,
      geocoded,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error geocoding shows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get tour statistics
 */
export async function getTourStats(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Get basic stats
    const totalShows = await pool.query('SELECT COUNT(*) FROM grateful_dead_shows');
    const showsWithCoords = await pool.query('SELECT COUNT(*) FROM grateful_dead_shows WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    const showsWithSetlists = await pool.query('SELECT COUNT(*) FROM grateful_dead_shows WHERE setlist IS NOT NULL AND setlist != \'[]\'');
    
    // Get date range
    const dateRange = await pool.query(`
      SELECT 
        MIN(show_date) as first_show,
        MAX(show_date) as last_show
      FROM grateful_dead_shows
    `);

    // Get top venues
    const topVenues = await pool.query(`
      SELECT venue_name, city, state, COUNT(*) as show_count
      FROM grateful_dead_shows 
      GROUP BY venue_name, city, state 
      ORDER BY show_count DESC 
      LIMIT 10
    `);

    // Get shows by year
    const showsByYear = await pool.query(`
      SELECT 
        EXTRACT(YEAR FROM show_date) as year,
        COUNT(*) as show_count
      FROM grateful_dead_shows 
      GROUP BY EXTRACT(YEAR FROM show_date)
      ORDER BY year
    `);

    res.json({
      success: true,
      data: {
        totalShows: parseInt(totalShows.rows[0].count),
        showsWithCoordinates: parseInt(showsWithCoords.rows[0].count),
        showsWithSetlists: parseInt(showsWithSetlists.rows[0].count),
        dateRange: dateRange.rows[0],
        topVenues: topVenues.rows,
        showsByYear: showsByYear.rows
      }
    });
  } catch (error) {
    console.error('Error getting tour stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  getShows,
  getShowById,
  importData,
  generateKML,
  downloadKML,
  geocodeMissing,
  getTourStats
};
