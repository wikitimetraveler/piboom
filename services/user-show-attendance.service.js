import { getPool } from './database.service.js';

/**
 * User Show Attendance Service
 * Handles "I Was There" functionality for Grateful Dead shows
 */

/**
 * Mark a show as attended by a user
 */
export async function markShowAttended(userId, showId, data = {}) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const { personalNotes, rating, photos } = data;
    
    const result = await pool.query(`
      INSERT INTO user_show_attendance (user_id, show_id, personal_notes, rating, photos)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, show_id) 
      DO UPDATE SET 
        personal_notes = EXCLUDED.personal_notes,
        rating = EXCLUDED.rating,
        photos = EXCLUDED.photos,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, showId, personalNotes, rating, photos || []]);

    return result.rows[0];
  } catch (error) {
    console.error('Error marking show as attended:', error);
    throw error;
  }
}

/**
 * Get all shows attended by a user
 */
export async function getUserAttendedShows(userId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT 
        usa.*,
        gds.show_date,
        gds.venue_name,
        gds.city,
        gds.state,
        gds.country,
        gds.latitude,
        gds.longitude,
        gds.setlist,
        gds.notes
      FROM user_show_attendance usa
      JOIN grateful_dead_shows gds ON usa.show_id = gds.id
      WHERE usa.user_id = $1 AND usa.was_there = true
      ORDER BY gds.show_date DESC
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('Error getting user attended shows:', error);
    throw error;
  }
}

/**
 * Get user statistics
 */
export async function getUserShowStats(userId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_shows,
        COUNT(DISTINCT gds.venue_name) as unique_venues,
        COUNT(DISTINCT gds.city) as unique_cities,
        COUNT(DISTINCT EXTRACT(YEAR FROM gds.show_date)) as years_spanned,
        MIN(gds.show_date) as first_show,
        MAX(gds.show_date) as last_show,
        AVG(usa.rating) as average_rating
      FROM user_show_attendance usa
      JOIN grateful_dead_shows gds ON usa.show_id = gds.id
      WHERE usa.user_id = $1 AND usa.was_there = true
    `, [userId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting user show stats:', error);
    throw error;
  }
}

/**
 * Check if user attended a specific show
 */
export async function checkUserAttendance(userId, showId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT * FROM user_show_attendance 
      WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error checking user attendance:', error);
    throw error;
  }
}

/**
 * Remove show attendance
 */
export async function removeShowAttendance(userId, showId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      DELETE FROM user_show_attendance 
      WHERE user_id = $1 AND show_id = $2
      RETURNING *
    `, [userId, showId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error removing show attendance:', error);
    throw error;
  }
}

/**
 * Get shows with attendance counts
 */
export async function getShowsWithAttendanceCounts() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  try {
    const result = await pool.query(`
      SELECT 
        gds.*,
        COUNT(usa.id) as attendance_count
      FROM grateful_dead_shows gds
      LEFT JOIN user_show_attendance usa ON gds.id = usa.show_id AND usa.was_there = true
      GROUP BY gds.id
      ORDER BY attendance_count DESC, gds.show_date DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error getting shows with attendance counts:', error);
    throw error;
  }
}
