import { getPool } from '../services/database.service.js';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';

export async function addSpecimen(req, res) {
  try {
    const {
      specimenName,
      likelyType,
      notes,
      imageUrl,
      latitude,
      longitude,
      locationLabel,
      aiAnalysis,
    } = req.body;
    const userId = req.query.userId || null;

    if (!specimenName) {
      return res.status(400).json({ success: false, error: 'specimenName is required' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const result = await pool.query(
      `INSERT INTO rock_specimens (
        user_id, specimen_name, likely_type, notes, image_url,
        latitude, longitude, location_label, ai_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        specimenName,
        likelyType || null,
        notes || null,
        imageUrl || null,
        latitude ?? null,
        longitude ?? null,
        locationLabel || null,
        aiAnalysis || null,
      ]
    );

    res.json({ success: true, specimen: result.rows[0] });
  } catch (error) {
    console.error('❌ Error adding rock specimen:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add specimen',
      message: error.message,
    });
  }
}

export async function listSpecimens(req, res) {
  try {
    const { userId, limit = 200 } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const params = [userId];
    let query = 'SELECT * FROM rock_specimens WHERE user_id = $1 ORDER BY found_at DESC';
    if (limit) {
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, specimens: result.rows });
  } catch (error) {
    console.error('❌ Error listing rock specimens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list specimens',
      message: error.message,
    });
  }
}

export async function updateSpecimen(req, res) {
  try {
    const { id } = req.params;
    const {
      userId,
      specimenName,
      likelyType,
      notes,
      latitude,
      longitude,
      locationLabel,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (!id) {
      return res.status(400).json({ success: false, error: 'specimen id is required' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (specimenName !== undefined) {
      updates.push(`specimen_name = $${idx++}`);
      params.push(specimenName);
    }
    if (likelyType !== undefined) {
      updates.push(`likely_type = $${idx++}`);
      params.push(likelyType);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      params.push(notes);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${idx++}`);
      params.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${idx++}`);
      params.push(longitude);
    }
    if (locationLabel !== undefined) {
      updates.push(`location_label = $${idx++}`);
      params.push(locationLabel);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    params.push(userId);

    const query = `
      UPDATE rock_specimens
      SET ${updates.join(', ')}, found_at = COALESCE(found_at, CURRENT_TIMESTAMP)
      WHERE id = $${idx++} AND (user_id = $${idx} OR user_id IS NULL)
      RETURNING *`;

    const result = await pool.query(query, params);
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Specimen not found or not owned by user',
      });
    }

    res.json({ success: true, specimen: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating rock specimen:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update specimen',
      message: error.message,
    });
  }
}

export async function getGoogleMapsKey(req, res) {
  try {
    const apiKey = getGoogleBrowserApiKey();
    res.json({ apiKey: apiKey || null });
  } catch (error) {
    console.error('❌ Google API key error:', error);
    res.status(500).json({ error: 'Failed to get Google API key' });
  }
}
