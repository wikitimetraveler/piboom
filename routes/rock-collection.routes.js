/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  addSpecimen,
  listSpecimens,
  updateSpecimen,
  getGoogleMapsKey,
} from '../controllers/rock-collection.controller.js';

const router = Router();

router.post('/', addSpecimen);
router.get('/', listSpecimens);
router.get('/google-api-key', getGoogleMapsKey);
router.put('/:id', updateSpecimen);

export default router;
