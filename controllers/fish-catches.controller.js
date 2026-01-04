import { getPool } from '../services/database.service.js';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';

export async function addCatch(req, res) {
  try {
    const {
      species,
      description,
      notes,
      imageUrl,
      latitude,
      longitude,
      locationLabel
    } = req.body;
    const userId = req.query.userId || null;

    if (!species) {
      return res.status(400).json({ success: false, error: 'Species is required' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    const result = await pool.query(
      `INSERT INTO catches (user_id, species, description, notes, image_url, latitude, longitude, location_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        species,
        description || null,
        notes || null,
        imageUrl || null,
        latitude ?? null,
        longitude ?? null,
        locationLabel || null
      ]
    );

    res.json({ success: true, catch: result.rows[0] });
  } catch (error) {
    console.error('❌ Error adding catch:', error);
    res.status(500).json({ success: false, error: 'Failed to add catch', message: error.message });
  }
}

export async function listCatches(req, res) {
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
    let query = 'SELECT * FROM catches WHERE user_id = $1 ORDER BY caught_at DESC';
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, catches: result.rows });
  } catch (error) {
    console.error('❌ Error listing catches:', error);
    res.status(500).json({ success: false, error: 'Failed to list catches', message: error.message });
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

