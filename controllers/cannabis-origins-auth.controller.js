/**
 * Development work by David Lane
 */
import { verifyCannabisOriginsPassword } from '../lib/cannabis-origins-auth.js';

export async function postVerifyCannabisOrigins(req, res) {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = verifyCannabisOriginsPassword(password);

    if (result.reason === 'unconfigured') {
      return res.status(503).json({
        valid: false,
        error: 'Page password not configured (set CANNABIS_ORIGINS_PASSWORD or COFFEE_DREAMS_PASSWORD)',
      });
    }

    if (!result.valid) {
      return res.status(401).json({ valid: false });
    }

    return res.json({ valid: true });
  } catch (e) {
    console.error('verify-cannabis-origins:', e.message);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}

export default {
  postVerifyCannabisOrigins,
};
