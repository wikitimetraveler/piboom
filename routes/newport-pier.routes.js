/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getNewportPierCatalog,
  getNewportPierReelRenderStatus,
  postNewportPierReelRender,
  postNewportPierStopSave,
  postNewportPierStopExport,
  postNewportPierStopCacheClip
} from '../controllers/newport-pier.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'newport-pier',
    capabilities: {
      save: true,
      export: true,
      cacheClip: true,
      reelRender: true
    }
  });
});
router.get('/catalog', getNewportPierCatalog);
router.post('/stops/save', postNewportPierStopSave);
router.post('/stops/export', postNewportPierStopExport);
router.post('/stops/cache-clip', postNewportPierStopCacheClip);
router.post('/reel/render', postNewportPierReelRender);
router.get('/reel/render/status', getNewportPierReelRenderStatus);

export default router;
