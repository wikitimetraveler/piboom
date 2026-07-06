/**
 * Development work by David Lane
 */
import express from 'express';
import * as disastersController from '../controllers/disasters.controller.js';
import { requireDisasterRefreshAccess } from '../lib/disaster-refresh-auth.js';

const router = express.Router();

// List disasters
router.get('/', disastersController.listDisasters);

// Manual refresh (async)
router.post('/refresh', requireDisasterRefreshAccess, disastersController.refreshDisasters);

// Manual camera feed refresh (for review purposes)
router.post('/refresh-cameras', requireDisasterRefreshAccess, disastersController.refreshCameras);

// Forward geocode for hazard webcam address search fallback
router.get('/geocode-address', disastersController.geocodeAddress);

// Nearby disasters, webcams, and loans (PostGIS when available)
router.get('/near', disastersController.listNear);

// List camera records (fixed hazard webcams)
router.get('/cameras/stats', disastersController.cameraStats);
router.get('/cameras/:id/snapshot', disastersController.cameraSnapshot);
router.get('/cameras', disastersController.listCameras);

// Live daily briefing (no DB required)
router.get('/daily-briefing', disastersController.dailyBriefing);

// Allowlisted web crawler (RSS/Atom + shallow .gov indexes)
router.get('/web-crawl', disastersController.webCrawl);

// Stats
router.get('/stats', disastersController.statsDisasters);
router.get('/county-summary', disastersController.countySummaryByState);

// CSV Export
router.get('/export.csv', disastersController.exportCsv);

export default router;


