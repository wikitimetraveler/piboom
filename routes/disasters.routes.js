import express from 'express';
import * as disastersController from '../controllers/disasters.controller.js';

const router = express.Router();

// List disasters
router.get('/', disastersController.listDisasters);

// Manual refresh (async)
router.post('/refresh', disastersController.refreshDisasters);

// Manual camera feed refresh (for review purposes)
router.post('/refresh-cameras', disastersController.refreshCameras);

// List camera records (for review)
router.get('/cameras', disastersController.listCameras);

// Stats
router.get('/stats', disastersController.statsDisasters);

// CSV Export
router.get('/export.csv', disastersController.exportCsv);

export default router;


