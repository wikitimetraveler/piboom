/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';

const STORAGE_ZONE_CODES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

/** Returns { storage_zone, storage_slot } or null if unset; throws message string if invalid */
export function normalizeStorageInput(body) {
  const rawCode = body.storageCode != null && String(body.storageCode).trim() !== ''
    ? String(body.storageCode).trim()
    : null;
  let zone = body.storageZone != null ? String(body.storageZone).trim().toUpperCase() : null;
  let slot = body.storageSlot;

  if (rawCode) {
    const m = rawCode.match(/^([A-Ga-g])(\d+)$/);
    if (!m) {
      throw new Error('storageCode must look like C4 (letter A–G + number)');
    }
    zone = m[1].toUpperCase();
    slot = parseInt(m[2], 10);
  }

  if (zone === '' || zone === 'NULL') zone = null;
  if (slot === '' || slot === null || slot === undefined) {
    slot = null;
  } else {
    slot = parseInt(slot, 10);
    if (Number.isNaN(slot)) throw new Error('storageSlot must be a number');
  }

  if (!zone && !slot) {
    return { storage_zone: null, storage_slot: null };
  }
  if (!zone || slot === null) {
    throw new Error('Set both storage zone (A–G) and slot, or omit both');
  }
  if (!STORAGE_ZONE_CODES.has(zone)) {
    throw new Error('storage zone must be A through G');
  }
  if (slot < 1) {
    throw new Error('storage slot must be at least 1');
  }
  return { storage_zone: zone, storage_slot: slot };
}

function firstCoverUrlFromMediaGallery(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const firstImg = arr.find(
    (m) => m && m.url && m.type !== 'video' && !/^data:video\//i.test(String(m.url))
  );
  if (firstImg) return firstImg.url;
  const firstNonVideo = arr.find((m) => m && m.url && !/^data:video\//i.test(String(m.url)));
  return firstNonVideo ? firstNonVideo.url : null;
}

// Next physical shelf slot for a zone (per user)
export async function getNextStorageSlot(req, res) {
  try {
    const userId = req.query.userId || null;
    const zone = (req.query.zone || '').toString().trim().toUpperCase();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (!STORAGE_ZONE_CODES.has(zone)) {
      return res.status(400).json({ success: false, error: 'zone must be A through G' });
    }
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }
    const r = await pool.query(
      `SELECT COALESCE(MAX(storage_slot), 0) AS max_slot FROM records WHERE user_id = $1 AND storage_zone = $2`,
      [userId, zone]
    );
    const maxSlot = parseInt(r.rows[0].max_slot, 10) || 0;
    const nextSlot = maxSlot + 1;
    res.json({ success: true, nextSlot, zone });
  } catch (error) {
    console.error('❌ getNextStorageSlot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Add album to collection
export async function addToCollection(req, res) {
  try {
    const { artist, album, year, genre, label, notes, coverUrl, spotifyId, musicbrainzId, rating, valuation, aiAnalysis, locationLat, locationLng, locationLabel } = req.body;
    const userId = req.query.userId || null; // Multi-user support

    let storage;
    try {
      storage = normalizeStorageInput(req.body);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
    
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
      'SELECT id FROM records WHERE artist = $1 AND album = $2 AND user_id = $3',
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
      `INSERT INTO records (user_id, artist, album, year, genre, label, notes, cover_url, spotify_id, musicbrainz_id, rating, valuation, ai_analysis, latitude, longitude, location_label, storage_zone, storage_slot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        userId,
        artist,
        album,
        year,
        genre,
        label,
        notes,
        coverUrl,
        spotifyId,
        musicbrainzId,
        rating,
        valuation,
        aiAnalysis,
        locationLat ?? null,
        locationLng ?? null,
        locationLabel ?? null,
        storage.storage_zone,
        storage.storage_slot,
      ]
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

const COLLECTION_LIST_SELECT = `
  id, user_id, artist, album, year, genre, label, rating, valuation, cover_url,
  added_date, storage_zone, storage_slot, latitude, longitude, location_label,
  (ai_analysis IS NOT NULL AND TRIM(ai_analysis) <> '') AS has_ai_analysis
`;

const COLLECTION_PAGE_SIZE_DEFAULT = 48;
const COLLECTION_PAGE_SIZE_MAX = 200;

// Get all albums in collection (slim list rows; full detail via getAlbumById)
export async function getCollection(req, res) {
  try {
    const userId = req.query.userId || null; // Multi-user support
    const { sortBy = 'added_date', order = 'DESC', search } = req.query;
    const limitRaw = parseInt(req.query.limit, 10);
    const offsetRaw = parseInt(req.query.offset, 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), COLLECTION_PAGE_SIZE_MAX)
      : COLLECTION_PAGE_SIZE_DEFAULT;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Build query based on userId
    let whereClause = '';
    const params = [];
    
    if (userId === 'all') {
      whereClause = 'WHERE 1=1';
    } else if (userId) {
      whereClause = 'WHERE user_id = $1';
      params.push(userId);
    } else {
      whereClause = 'WHERE user_id IS NULL';
    }

    // Add search filter if provided
    if (search) {
      const paramNum = params.length + 1;
      whereClause += ` AND (LOWER(artist) LIKE $${paramNum} OR LOWER(album) LIKE $${paramNum} OR LOWER(genre) LIKE $${paramNum})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM records ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    // Add sorting
    const validSortColumns = ['artist', 'album', 'year', 'added_date', 'rating', 'valuation', 'storage_zone', 'storage_slot'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT ${COLLECTION_LIST_SELECT} FROM records ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listParams
    );

    const albums = result.rows.map((row) => ({
      ...row,
      has_ai_analysis: row.has_ai_analysis === true || row.has_ai_analysis === 't',
    }));

    res.json({
      success: true,
      count: total,
      albums,
      limit,
      offset,
      hasMore: offset + albums.length < total,
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
    const { notes, rating, genre, label, year, valuation, locationLat, locationLng, locationLabel } = req.body;

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
    if (valuation !== undefined) {
      updates.push(`valuation = $${paramCount++}`);
      params.push(valuation);
    }
    if (locationLat !== undefined) {
      updates.push(`latitude = $${paramCount++}`);
      params.push(locationLat);
    }
    if (locationLng !== undefined) {
      updates.push(`longitude = $${paramCount++}`);
      params.push(locationLng);
    }
    if (locationLabel !== undefined) {
      updates.push(`location_label = $${paramCount++}`);
      params.push(locationLabel);
    }
    if (req.body.mediaGallery !== undefined) {
      const arr = Array.isArray(req.body.mediaGallery) ? req.body.mediaGallery : [];
      updates.push(`media_gallery = $${paramCount++}::jsonb`);
      params.push(JSON.stringify(arr));
      updates.push(`cover_url = $${paramCount++}`);
      params.push(firstCoverUrlFromMediaGallery(arr));
    }
    if (req.body.coverUrl !== undefined && req.body.mediaGallery === undefined) {
      updates.push(`cover_url = $${paramCount++}`);
      params.push(req.body.coverUrl);
    }
    if (storagePatch) {
      updates.push(`storage_zone = $${paramCount++}`);
      params.push(storagePatch.storage_zone);
      updates.push(`storage_slot = $${paramCount++}`);
      params.push(storagePatch.storage_slot);
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

    let result;
    
    if (userId === 'all') {
      // When viewing all users, allow deletion of any album by id alone
      result = await pool.query(
        'DELETE FROM records WHERE id = $1 RETURNING artist, album, user_id',
        [id]
      );
    } else if (userId) {
      // When viewing specific user, only delete their albums
      result = await pool.query(
        'DELETE FROM records WHERE id = $1 AND user_id = $2 RETURNING artist, album, user_id',
        [id, userId]
      );
    } else {
      // Legacy support: no userId specified (old albums with NULL user_id)
      result = await pool.query(
        'DELETE FROM records WHERE id = $1 AND user_id IS NULL RETURNING artist, album, user_id',
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Album not found in collection' 
      });
    }

    console.log('✅ Album deleted from collection:', result.rows[0].album, 'by user:', result.rows[0].user_id);

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

    // Build WHERE clause based on userId
    let whereClause = '';
    const params = [];
    
    if (userId === 'all') {
      whereClause = 'WHERE 1=1';
    } else if (userId) {
      whereClause = 'WHERE user_id = $1';
      params.push(userId);
    } else {
      whereClause = 'WHERE user_id IS NULL';
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM records ${whereClause}`,
      params
    );

    // Get count by genre
    const genreResult = await pool.query(
      `SELECT genre, COUNT(*) as count 
       FROM records 
       ${whereClause} AND genre IS NOT NULL
       GROUP BY genre 
       ORDER BY count DESC 
       LIMIT 10`,
      params
    );

    // Get count by decade
    const decadeResult = await pool.query(
      `SELECT 
         FLOOR(CAST(year AS INTEGER) / 10) * 10 as decade, 
         COUNT(*) as count 
       FROM records 
       ${whereClause} AND year IS NOT NULL AND year ~ '^[0-9]+$'
       GROUP BY decade 
       ORDER BY decade DESC`,
      params
    );

    // Get recent additions
    const recentResult = await pool.query(
      `SELECT artist, album, cover_url, added_date 
       FROM records 
       ${whereClause}
       ORDER BY added_date DESC 
       LIMIT 5`,
      params
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

