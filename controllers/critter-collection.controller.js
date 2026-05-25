/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';

export async function addToCollection(req, res) {
  try {
    const {
      animalName, scientificName, confidence, features, habitat,
      funFacts, conservationStatus, description, photoUrl,
      latitude, longitude, locationName, notes, rating, aiAnalysis,
    } = req.body;
    const userId = req.query.userId || null;

    if (!animalName) {
      return res.status(400).json({ success: false, error: 'Animal name is required' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const result = await pool.query(
      `INSERT INTO critters (
        user_id, animal_name, scientific_name, confidence, features, habitat,
        fun_facts, conservation_status, description, photo_url,
        latitude, longitude, location_name, notes, rating, ai_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId, animalName, scientificName, confidence, features, habitat,
        funFacts, conservationStatus, description, photoUrl,
        latitude, longitude, locationName, notes, rating, aiAnalysis,
      ]
    );

    console.log('✅ Critter added to collection:', animalName);

    res.json({
      success: true,
      message: 'Critter added to collection',
      critter: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error adding critter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add critter to collection',
      message: error.message,
    });
  }
}

export async function getCollection(req, res) {
  try {
    const userId = req.query.userId || null;
    const { sortBy = 'added_date', order = 'DESC', search } = req.query;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    let query = '';
    const params = [];

    if (userId === 'all') {
      query = 'SELECT * FROM critters WHERE 1=1';
    } else if (userId) {
      query = 'SELECT * FROM critters WHERE user_id = $1';
      params.push(userId);
    } else {
      query = 'SELECT * FROM critters WHERE user_id IS NULL';
    }

    if (search) {
      const paramNum = params.length + 1;
      query += ` AND (LOWER(animal_name) LIKE $${paramNum} OR LOWER(scientific_name) LIKE $${paramNum} OR LOWER(habitat) LIKE $${paramNum})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    const validSortColumns = ['animal_name', 'scientific_name', 'habitat', 'added_date', 'rating'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const result = await pool.query(query, params);

    res.json({ success: true, critters: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('❌ Error getting critter collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critter collection',
      message: error.message,
    });
  }
}

export async function getStats(req, res) {
  try {
    const userId = req.query.userId || null;
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const userFilter = userId === 'all' ? '' : userId ? 'WHERE user_id = $1' : 'WHERE user_id IS NULL';
    const params = userId && userId !== 'all' ? [userId] : [];

    const [totalResult, habitatResult, confidenceResult, recentResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total FROM critters ${userFilter}`, params),
      pool.query(`SELECT habitat, COUNT(*) as count FROM critters ${userFilter} GROUP BY habitat ORDER BY count DESC`, params),
      pool.query(`SELECT confidence, COUNT(*) as count FROM critters ${userFilter} GROUP BY confidence ORDER BY count DESC`, params),
      pool.query(`SELECT * FROM critters ${userFilter} ORDER BY added_date DESC LIMIT 10`, params),
    ]);

    res.json({
      success: true,
      stats: {
        total: parseInt(totalResult.rows[0].total),
        byHabitat: habitatResult.rows,
        byConfidence: confidenceResult.rows,
        recentAdditions: recentResult.rows,
      },
    });
  } catch (error) {
    console.error('❌ Error getting critter stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critter statistics',
      message: error.message,
    });
  }
}

export async function updateCritter(req, res) {
  try {
    const { id } = req.params;
    const { notes, rating, locationName, latitude, longitude } = req.body;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); params.push(notes); }
    if (rating !== undefined) { updates.push(`rating = $${paramCount++}`); params.push(rating); }
    if (locationName !== undefined) { updates.push(`location_name = $${paramCount++}`); params.push(locationName); }
    if (latitude !== undefined) { updates.push(`latitude = $${paramCount++}`); params.push(latitude); }
    if (longitude !== undefined) { updates.push(`longitude = $${paramCount++}`); params.push(longitude); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_date = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await pool.query(
      `UPDATE critters SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Critter not found' });
    }

    res.json({ success: true, message: 'Critter updated successfully', critter: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating critter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update critter',
      message: error.message,
    });
  }
}

export async function deleteCritter(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const result = await pool.query('DELETE FROM critters WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Critter not found' });
    }

    res.json({ success: true, message: 'Critter deleted successfully', critter: result.rows[0] });
  } catch (error) {
    console.error('❌ Error deleting critter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete critter',
      message: error.message,
    });
  }
}
