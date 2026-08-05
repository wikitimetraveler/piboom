/**
 * Development work by David Lane
 */
import { verifyCoffeeDreamsPassword } from '../lib/coffee-dreams-auth.js';

export async function postVerifyCoffeeDreams(req, res) {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = verifyCoffeeDreamsPassword(password);

    if (!result.valid) {
      return res.status(401).json({ valid: false });
    }

    return res.json({ valid: true });
  } catch (e) {
    console.error('verify-coffee-dreams:', e.message);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}

export default {
  postVerifyCoffeeDreams,
};
