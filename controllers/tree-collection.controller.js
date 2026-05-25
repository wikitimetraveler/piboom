/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';

// Add tree to collection
export async function addToCollection(req, res) {
  try {
    const { 
      treeName, scientificName, confidence, features, region, 
      funFacts, conservationStatus, description, photoUrl,
      latitude, longitude, locationName, notes, rating, aiAnalysis 
    } = req.body;
    const userId = req.query.userId || null;
    
    if (!treeName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tree name is required' 
      });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    // Insert the tree
    const result = await pool.query(
      `INSERT INTO trees (
        user_id, tree_name, scientific_name, confidence, features, region,
        fun_facts, conservation_status, description, photo_url,
        latitude, longitude, location_name, notes, rating, ai_analysis
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId, treeName, scientificName, confidence, features, region,
        funFacts, conservationStatus, description, photoUrl,
        latitude, longitude, locationName, notes, rating, aiAnalysis
      ]
    );

    console.log('✅ Tree added to collection:', treeName);

    res.json({
      success: true,
      message: 'Tree added to collection',
      tree: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error adding tree to collection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add tree to collection',
      message: error.message 
    });
  }
}

// Get all trees in collection
export async function getCollection(req, res) {
  try {
    const userId = req.query.userId || null;
    const { sortBy = 'added_date', order = 'DESC', search } = req.query;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    let query = '';
    const params = [];
    
    if (userId === 'all') {
      query = 'SELECT * FROM trees WHERE 1=1';
    } else if (userId) {
      query = 'SELECT * FROM trees WHERE user_id = $1';
      params.push(userId);
    } else {
      query = 'SELECT * FROM trees WHERE user_id IS NULL';
    }

    // Add search filter
    if (search) {
      const paramNum = params.length + 1;
      query += ` AND (LOWER(tree_name) LIKE $${paramNum} OR LOWER(scientific_name) LIKE $${paramNum} OR LOWER(region) LIKE $${paramNum})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    // Add sorting
    const validSortColumns = ['tree_name', 'scientific_name', 'region', 'added_date', 'rating'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      trees: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error getting tree collection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get tree collection',
      message: error.message 
    });
  }
}

// Get tree statistics
export async function getStats(req, res) {
  try {
    const userId = req.query.userId || null;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    let userFilter = '';
    const params = [];
    
    if (userId === 'all') {
      userFilter = '';
    } else if (userId) {
      userFilter = 'WHERE user_id = $1';
      params.push(userId);
    } else {
      userFilter = 'WHERE user_id IS NULL';
    }

    // Get total count
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM trees ${userFilter}`,
      params
    );

    // Get trees by region
    const regionResult = await pool.query(
      `SELECT region, COUNT(*) as count FROM trees ${userFilter} 
       GROUP BY region ORDER BY count DESC`,
      params
    );

    // Get trees by confidence level
    const confidenceResult = await pool.query(
      `SELECT confidence, COUNT(*) as count FROM trees ${userFilter} 
       GROUP BY confidence ORDER BY count DESC`,
      params
    );

    // Get recent additions
    const recentResult = await pool.query(
      `SELECT * FROM trees ${userFilter} 
       ORDER BY added_date DESC LIMIT 10`,
      params
    );

    res.json({
      success: true,
      stats: {
        total: parseInt(totalResult.rows[0].total),
        byRegion: regionResult.rows,
        byConfidence: confidenceResult.rows,
        recentAdditions: recentResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Error getting tree stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get tree statistics',
      message: error.message 
    });
  }
}

// Update tree
export async function updateTree(req, res) {
  try {
    const { id } = req.params;
    const { notes, rating, locationName, latitude, longitude } = req.body;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

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

    if (locationName !== undefined) {
      updates.push(`location_name = $${paramCount++}`);
      params.push(locationName);
    }

    if (latitude !== undefined) {
      updates.push(`latitude = $${paramCount++}`);
      params.push(latitude);
    }

    if (longitude !== undefined) {
      updates.push(`longitude = $${paramCount++}`);
      params.push(longitude);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    updates.push(`updated_date = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE trees 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tree not found' 
      });
    }

    console.log('✅ Tree updated:', id);

    res.json({
      success: true,
      message: 'Tree updated successfully',
      tree: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error updating tree:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update tree',
      message: error.message 
    });
  }
}

// Delete tree
export async function deleteTree(req, res) {
  try {
    const { id } = req.params;

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }

    const result = await pool.query(
      'DELETE FROM trees WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tree not found' 
      });
    }

    console.log('✅ Tree deleted:', id);

    res.json({
      success: true,
      message: 'Tree deleted successfully',
      tree: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error deleting tree:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete tree',
      message: error.message 
    });
  }
}

export default {
  addToCollection,
  getCollection,
  getStats,
  updateTree,
  deleteTree
};

