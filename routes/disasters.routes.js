/**
 * Development work by David Lane
 */
import express from 'express';
import * as disastersController from '../controllers/disasters.controller.js';

const router = express.Router();
const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function requireDisasterRefreshAccess(req, res, next) {
  const configuredToken = String(process.env.DISASTER_REFRESH_TOKEN || '').trim();
  const providedToken = String(req.headers['x-disaster-refresh-token'] || getBearerToken(req) || '').trim();
  const role = String(req.headers['x-user-role'] || '').toLowerCase().trim();
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const reqIp = (forwardedFor || req.ip || '').replace(/^::ffff:/, '');
  const isLocal = LOCALHOST_IPS.has(reqIp);

  if (configuredToken) {
    if (!providedToken || providedToken !== configuredToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized refresh token' });
    }
    if (role && role !== 'admin' && role !== 'ops') {
      return res.status(403).json({ success: false, error: 'Insufficient role for disaster refresh' });
    }
    return next();
  }

  if (!isLocal) {
    return res.status(403).json({
      success: false,
      error: 'Refresh endpoints require localhost access or DISASTER_REFRESH_TOKEN'
    });
  }

  return next();
}

// List disasters
router.get('/', disastersController.listDisasters);

// Manual refresh (async)
router.post('/refresh', requireDisasterRefreshAccess, disastersController.refreshDisasters);

// Manual camera feed refresh (for review purposes)
router.post('/refresh-cameras', requireDisasterRefreshAccess, disastersController.refreshCameras);

// Forward geocode for hazard webcam address search fallback
router.get('/geocode-address', disastersController.geocodeAddress);

// List camera records (fixed hazard webcams)
router.get('/cameras/stats', disastersController.cameraStats);
router.get('/cameras/:id/snapshot', disastersController.cameraSnapshot);
router.get('/cameras', disastersController.listCameras);

// Stats
router.get('/stats', disastersController.statsDisasters);

// CSV Export
router.get('/export.csv', disastersController.exportCsv);

export default router;


