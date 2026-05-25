/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';

const ensureUser = (userId, res) => {
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId is required' });
    return false;
  }
  return true;
};

export async function listBikes(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

    const result = await pool.query(
      'SELECT * FROM bikes WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ success: true, bikes: result.rows });
  } catch (error) {
    console.error('❌ listBikes error:', error);
    res.status(500).json({ success: false, error: 'Failed to list bikes', message: error.message });
  }
}

export async function addBike(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;

    const {
      model,
      brand,
      size,
      color,
      motor,
      battery,
      price,
      status = 'available',
      photos,
      description,
      latitude,
      longitude,
      locationLabel
    } = req.body;

    const normalizePhotos = (p) => {
      if (Array.isArray(p)) return p;
      if (typeof p === 'string' && p.trim()) return [p.trim()];
      return [];
    };
    const photosArray = normalizePhotos(photos);
    const photosJson = photosArray.length ? JSON.stringify(photosArray) : null;

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

    const result = await pool.query(
      `INSERT INTO bikes
        (user_id, model, brand, size, color, motor, battery, price, status, photos, description, latitude, longitude, location_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        userId,
        model,
        brand,
        size,
        color,
        motor,
        battery,
        price,
        status,
        photosJson,
        description || null,
        latitude ?? null,
        longitude ?? null,
        locationLabel || null
      ]
    );
    res.json({ success: true, bike: result.rows[0] });
  } catch (error) {
    console.error('❌ addBike error:', error);
    res.status(500).json({ success: false, error: 'Failed to add bike', message: error.message });
  }
}

export async function updateBike(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const {
      model,
      brand,
      size,
      color,
      motor,
      battery,
      price,
      status,
      photos,
      description,
      latitude,
      longitude,
      locationLabel,
      soldCustomerId,
      soldPrice,
      soldDate
    } = req.body;

    const normalizePhotos = (p) => {
      if (Array.isArray(p)) return p;
      if (typeof p === 'string' && p.trim()) return [p.trim()];
      return [];
    };

    const photosArray = photos !== undefined ? normalizePhotos(photos) : undefined;
    const photosJson = photosArray ? (photosArray.length ? JSON.stringify(photosArray) : null) : undefined;

    const updates = [];
    const params = [];
    let idx = 1;

    const add = (field, val) => {
      if (val !== undefined) {
        updates.push(`${field} = $${idx++}`);
        params.push(val);
      }
    };

    add('model', model);
    add('brand', brand);
    add('size', size);
    add('color', color);
    add('motor', motor);
    add('battery', battery);
    add('price', price);
    add('status', status);
    add('photos', photosJson);
    add('description', description);
    add('latitude', latitude);
    add('longitude', longitude);
    add('location_label', locationLabel);
    add('sold_customer_id', soldCustomerId);
    add('sold_price', soldPrice);
    add('sold_date', soldDate);

    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    params.push(userId);

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

    const result = await pool.query(
      `UPDATE bikes
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Bike not found or not owned by user' });
    }

    res.json({ success: true, bike: result.rows[0] });
  } catch (error) {
    console.error('❌ updateBike error:', error);
    res.status(500).json({ success: false, error: 'Failed to update bike', message: error.message });
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

