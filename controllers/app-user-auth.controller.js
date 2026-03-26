import { verifyAppUserPassword } from '../services/app-user-auth.service.js';

export async function postVerifyUserPassword(req, res) {
  try {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!userId) {
      return res.status(400).json({ valid: false, error: 'userId required' });
    }

    const { valid, reason } = await verifyAppUserPassword(userId, password);
    if (reason === 'unavailable') {
      return res.status(503).json({ valid: false, error: 'Database unavailable' });
    }
    return res.json({ valid });
  } catch (e) {
    console.error('verify-user-password:', e.message);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
