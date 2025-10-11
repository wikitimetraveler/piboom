import { getPool } from '../services/database.service.js';

// Add album to collection
export async function addToCollection(req, res) {
  try {
    const { artist, album, year, genre, label, notes, coverUrl, spotifyId, musicbrainzId, rating } = req.body;
    const userId = req.query.userId || null; // For future multi-user support
    
    if (!artist || !album) {
      return res.status(400).json({ 
        success: false, 
        error: 'Artist and album name are required' 
      });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Check if album already exists for this user
    const existingCheck = await pool.query(
      'SELECT id FROM records WHERE artist = $1 AND album = $2 AND (user_id = $3 OR (user_id IS NULL AND $3 IS NULL))',
      [artist, album, userId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Album already in collection',
        albumId: existingCheck.rows[0].id
      });
    }

    // Insert the album
    const result = await pool.query(
      `INSERT INTO records (user_id, artist, album, year, genre, label, notes, cover_url, spotify_id, musicbrainz_id, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, artist, album, year, genre, label, notes, coverUrl, spotifyId, musicbrainzId, rating]
    );

    console.log('✅ Album added to collection:', album, 'by', artist);

    res.json({
      success: true,
      message: 'Album added to collection',
      album: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error adding album to collection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add album to collection',
      message: error.message 
    });
  }
}

// Get all albums in collection
export async function getCollection(req, res) {
  try {
    const userId = req.query.userId || null; // For future multi-user support
    const { sortBy = 'added_date', order = 'DESC', search } = req.query;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Build query
    let query = 'SELECT * FROM records WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL))';
    const params = [userId];

    // Add search filter if provided
    if (search) {
      query += ' AND (LOWER(artist) LIKE $2 OR LOWER(album) LIKE $2 OR LOWER(genre) LIKE $2)';
      params.push(`%${search.toLowerCase()}%`);
    }

    // Add sorting
    const validSortColumns = ['artist', 'album', 'year', 'added_date', 'rating'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      albums: result.rows
    });

  } catch (error) {
    console.error('❌ Error getting collection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get collection',
      message: error.message 
    });
  }
}

// Get single album from collection
export async function getAlbumById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.query.userId || null;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    const result = await pool.query(
      'SELECT * FROM records WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL))',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Album not found in collection' 
      });
    }

    res.json({
      success: true,
      album: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error getting album:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get album',
      message: error.message 
    });
  }
}

// Update album in collection
export async function updateAlbum(req, res) {
  try {
    const { id } = req.params;
    const userId = req.query.userId || null;
    const { notes, rating, genre, label, year } = req.body;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(notes);
    }
    if (rating !== undefined) {
      updates.push(`rating = $${paramCount++}`);
      params.push(rating);
    }
    if (genre !== undefined) {
      updates.push(`genre = $${paramCount++}`);
      params.push(genre);
    }
    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      params.push(label);
    }
    if (year !== undefined) {
      updates.push(`year = $${paramCount++}`);
      params.push(year);
    }
    if (req.body.story !== undefined) {
      updates.push(`story = $${paramCount++}`);
      params.push(req.body.story);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    updates.push(`updated_date = CURRENT_TIMESTAMP`);
    params.push(id, userId);

    const query = `
      UPDATE records 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND (user_id = $${paramCount + 1} OR (user_id IS NULL AND $${paramCount + 1} IS NULL))
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Album not found in collection' 
      });
    }

    console.log('✅ Album updated:', result.rows[0].album);

    res.json({
      success: true,
      message: 'Album updated successfully',
      album: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error updating album:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update album',
      message: error.message 
    });
  }
}

// Delete album from collection
export async function deleteAlbum(req, res) {
  try {
    const { id } = req.params;
    const userId = req.query.userId || null;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    const result = await pool.query(
      'DELETE FROM records WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL)) RETURNING artist, album',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Album not found in collection' 
      });
    }

    console.log('✅ Album deleted from collection:', result.rows[0].album);

    res.json({
      success: true,
      message: 'Album deleted from collection',
      album: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error deleting album:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete album',
      message: error.message 
    });
  }
}

// Get collection statistics
export async function getCollectionStats(req, res) {
  try {
    const userId = req.query.userId || null;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM records WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL))',
      [userId]
    );

    // Get count by genre
    const genreResult = await pool.query(
      `SELECT genre, COUNT(*) as count 
       FROM records 
       WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL)) AND genre IS NOT NULL
       GROUP BY genre 
       ORDER BY count DESC 
       LIMIT 10`,
      [userId]
    );

    // Get count by decade
    const decadeResult = await pool.query(
      `SELECT 
         FLOOR(CAST(year AS INTEGER) / 10) * 10 as decade, 
         COUNT(*) as count 
       FROM records 
       WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL)) AND year IS NOT NULL AND year ~ '^[0-9]+$'
       GROUP BY decade 
       ORDER BY decade DESC`,
      [userId]
    );

    // Get recent additions
    const recentResult = await pool.query(
      `SELECT artist, album, cover_url, added_date 
       FROM records 
       WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL))
       ORDER BY added_date DESC 
       LIMIT 5`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        total: parseInt(countResult.rows[0].total),
        byGenre: genreResult.rows,
        byDecade: decadeResult.rows,
        recentAdditions: recentResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Error getting collection stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get collection statistics',
      message: error.message 
    });
  }
}

