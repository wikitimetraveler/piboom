import express from 'express';
import * as disastersController from '../controllers/disasters.controller.js';

const router = express.Router();

// List disasters
router.get('/', disastersController.listDisasters);

// Manual refresh (async)
router.post('/refresh', disastersController.refreshDisasters);

// Stats
router.get('/stats', disastersController.statsDisasters);

// CSV Export
router.get('/export.csv', disastersController.exportCsv);

export default router;


