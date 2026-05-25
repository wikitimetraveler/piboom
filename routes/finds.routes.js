/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getFindsGoogleMapsKeyHandler,
  listFindsHandler,
  getFindHandler,
  createFindHandler,
  updateFindHandler,
  deleteFindHandler,
  analyzeFindHandler,
  scorePreviewHandler,
  appendVoiceNoteHandler,
  getSummaryTextHandler,
} from '../controllers/finds.controller.js';

const router = Router();

router.post('/analyze', analyzeFindHandler);
router.post('/score-preview', scorePreviewHandler);
router.get('/google-api-key', getFindsGoogleMapsKeyHandler);
router.get('/', listFindsHandler);
router.post('/', createFindHandler);
router.get('/:id/summary-text', getSummaryTextHandler);
router.post('/:id/voice-note', appendVoiceNoteHandler);
router.get('/:id', getFindHandler);
router.put('/:id', updateFindHandler);
router.delete('/:id', deleteFindHandler);

export default router;
