/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getNewportPierCatalog,
  postNewportPierStopSave,
  postNewportPierStopExport
} from '../controllers/newport-pier.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'newport-pier' });
});
router.get('/catalog', getNewportPierCatalog);
router.post('/stops/save', postNewportPierStopSave);
router.post('/stops/export', postNewportPierStopExport);

export default router;
