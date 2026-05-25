/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';

const ensureUser = (userId, res) => {
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId is required' });
    return false;
  }
  return true;
};

export async function listCustomers(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });
    const result = await pool.query(
      'SELECT * FROM customers WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('❌ listCustomers error:', error);
    res.status(500).json({ success: false, error: 'Failed to list customers', message: error.message });
  }
}

export async function addCustomer(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;
    const { name, email, phone, photoUrl, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

    const result = await pool.query(
      `INSERT INTO customers (user_id, name, email, phone, photo_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, name, email || null, phone || null, photoUrl || null, notes || null]
    );
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('❌ addCustomer error:', error);
    res.status(500).json({ success: false, error: 'Failed to add customer', message: error.message });
  }
}

export async function updateCustomer(req, res) {
  try {
    const userId = req.query.userId || null;
    if (!ensureUser(userId, res)) return;
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const { name, email, phone, photoUrl, notes } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    const add = (field, val) => {
      if (val !== undefined) {
        updates.push(`${field} = $${idx++}`);
        params.push(val);
      }
    };

    add('name', name);
    add('email', email);
    add('phone', phone);
    add('photo_url', photoUrl);
    add('notes', notes);

    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    params.push(userId);

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not available' });

    const result = await pool.query(
      `UPDATE customers
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      params
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Customer not found or not owned by user' });
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('❌ updateCustomer error:', error);
    res.status(500).json({ success: false, error: 'Failed to update customer', message: error.message });
  }
}

