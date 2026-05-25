/**
 * Development work by David Lane
 */
import { getPool } from './database.service.js';

/**
 * Concert Collection Service
 * Handles user concert collections for any artist (expandable beyond Grateful Dead)
 */

/**
 * Add a concert to user's collection
 */
export async function addConcertToCollection(userId, concertId, data = {}) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const { 
      personalNotes, 
      rating, 
      photos, 
      ticketPrice, 
      seatLocation, 
      weatherNotes, 
      companions 
    } = data;
    
    const result = await pool.query(`
      INSERT INTO user_concert_collections (
        user_id, concert_id, personal_notes, rating, photos, 
        ticket_price, seat_location, weather_notes, companions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, concert_id) 
      DO UPDATE SET 
        personal_notes = EXCLUDED.personal_notes,
        rating = EXCLUDED.rating,
        photos = EXCLUDED.photos,
        ticket_price = EXCLUDED.ticket_price,
        seat_location = EXCLUDED.seat_location,
        weather_notes = EXCLUDED.weather_notes,
        companions = EXCLUDED.companions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      userId, 
      concertId, 
      personalNotes, 
      rating, 
      photos || [], 
      ticketPrice, 
      seatLocation, 
      weatherNotes, 
      companions || []
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error adding concert to collection:', error);
    throw error;
  }
}

/**
 * Get user's concert collection
 */
export async function getUserConcertCollection(userId, artistId = null) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    let query = `
      SELECT 
        ucc.*,
        c.concert_date,
        c.tour_name,
        c.setlist,
        c.notes as concert_notes,
        a.name as artist_name,
        a.genre as artist_genre,
        v.name as venue_name,
        v.city,
        v.state,
        v.country,
        v.latitude,
        v.longitude,
        v.capacity
      FROM user_concert_collections ucc
      JOIN concerts c ON ucc.concert_id = c.id
      JOIN artists a ON c.artist_id = a.id
      JOIN venues v ON c.venue_id = v.id
      WHERE ucc.user_id = $1 AND ucc.was_there = true
    `;
    
    const params = [userId];
    
    if (artistId) {
      query += ` AND a.id = $2`;
      params.push(artistId);
    }
    
    query += ` ORDER BY c.concert_date DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting user concert collection:', error);
    throw error;
  }
}

/**
 * Get user's concert collection statistics
 */
export async function getUserConcertStats(userId, artistId = null) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    let query = `
      SELECT 
        COUNT(*) as total_concerts,
        COUNT(DISTINCT c.artist_id) as unique_artists,
        COUNT(DISTINCT c.venue_id) as unique_venues,
        COUNT(DISTINCT v.city) as unique_cities,
        COUNT(DISTINCT EXTRACT(YEAR FROM c.concert_date)) as years_spanned,
        MIN(c.concert_date) as first_concert,
        MAX(c.concert_date) as last_concert,
        AVG(ucc.rating) as average_rating,
        SUM(ucc.ticket_price) as total_spent
      FROM user_concert_collections ucc
      JOIN concerts c ON ucc.concert_id = c.id
      JOIN venues v ON c.venue_id = v.id
      WHERE ucc.user_id = $1 AND ucc.was_there = true
    `;
    
    const params = [userId];
    
    if (artistId) {
      query += ` AND c.artist_id = $2`;
      params.push(artistId);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user concert stats:', error);
    throw error;
  }
}

/**
 * Remove concert from user's collection
 */
export async function removeConcertFromCollection(userId, concertId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      DELETE FROM user_concert_collections 
      WHERE user_id = $1 AND concert_id = $2
      RETURNING *
    `, [userId, concertId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error removing concert from collection:', error);
    throw error;
  }
}

/**
 * Get all concerts for an artist
 */
export async function getArtistConcerts(artistId, limit = 100, offset = 0) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        a.name as artist_name,
        a.genre as artist_genre,
        v.name as venue_name,
        v.city,
        v.state,
        v.country,
        v.latitude,
        v.longitude
      FROM concerts c
      JOIN artists a ON c.artist_id = a.id
      JOIN venues v ON c.venue_id = v.id
      WHERE c.artist_id = $1
      ORDER BY c.concert_date ASC
      LIMIT $2 OFFSET $3
    `, [artistId, limit, offset]);

    return result.rows;
  } catch (error) {
    console.error('Error getting artist concerts:', error);
    throw error;
  }
}

/**
 * Get artist by name
 */
export async function getArtistByName(artistName) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT * FROM artists WHERE name ILIKE $1
    `, [`%${artistName}%`]);

    return result.rows;
  } catch (error) {
    console.error('Error getting artist by name:', error);
    throw error;
  }
}

/**
 * Create a new artist
 */
export async function createArtist(artistData) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const { name, genre, formedYear, disbandedYear, country, bio, imageUrl, spotifyId } = artistData;
    
    const result = await pool.query(`
      INSERT INTO artists (name, genre, formed_year, disbanded_year, country, bio, image_url, spotify_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, genre, formedYear, disbandedYear, country, bio, imageUrl, spotifyId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating artist:', error);
    throw error;
  }
}

/**
 * Create a new venue
 */
export async function createVenue(venueData) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const { name, city, state, country, latitude, longitude, capacity, venueType, website } = venueData;
    
    const result = await pool.query(`
      INSERT INTO venues (name, city, state, country, latitude, longitude, capacity, venue_type, website)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, city, state, country, latitude, longitude, capacity, venueType, website]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating venue:', error);
    throw error;
  }
}

/**
 * Create a new concert
 */
export async function createConcert(concertData) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const { artistId, venueId, concertDate, tourName, setlist, attendance, recordingAvailable, archiveIdentifier, notes } = concertData;
    
    const result = await pool.query(`
      INSERT INTO concerts (artist_id, venue_id, concert_date, tour_name, setlist, attendance, recording_available, archive_identifier, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [artistId, venueId, concertDate, tourName, setlist, attendance, recordingAvailable, archiveIdentifier, notes]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating concert:', error);
    throw error;
  }
}

/**
 * Check if user attended a specific concert
 */
export async function checkUserConcertAttendance(userId, concertId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT * FROM user_concert_collections 
      WHERE user_id = $1 AND concert_id = $2
    `, [userId, concertId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error checking user concert attendance:', error);
    throw error;
  }
}

/**
 * Get concerts by venue
 */
export async function getConcertsByVenue(venueId, limit = 100, offset = 0) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        a.name as artist_name,
        a.genre as artist_genre,
        v.name as venue_name,
        v.city,
        v.state,
        v.country
      FROM concerts c
      JOIN artists a ON c.artist_id = a.id
      JOIN venues v ON c.venue_id = v.id
      WHERE c.venue_id = $1
      ORDER BY c.concert_date DESC
      LIMIT $2 OFFSET $3
    `, [venueId, limit, offset]);

    return result.rows;
  } catch (error) {
    console.error('Error getting concerts by venue:', error);
    throw error;
  }
}

/**
 * Search concerts by date range
 */
export async function searchConcertsByDateRange(startDate, endDate, artistId = null) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    let query = `
      SELECT 
        c.*,
        a.name as artist_name,
        a.genre as artist_genre,
        v.name as venue_name,
        v.city,
        v.state,
        v.country
      FROM concerts c
      JOIN artists a ON c.artist_id = a.id
      JOIN venues v ON c.venue_id = v.id
      WHERE c.concert_date BETWEEN $1 AND $2
    `;
    
    const params = [startDate, endDate];
    
    if (artistId) {
      query += ` AND c.artist_id = $3`;
      params.push(artistId);
    }
    
    query += ` ORDER BY c.concert_date ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching concerts by date range:', error);
    throw error;
  }
}

