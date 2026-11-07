/**
 * Crouton Corgi Feeding Routes
 */

import { Router } from 'express';
import { getStatus, recordFeed, removeFeed } from '../controllers/corgi.controller.js';

const router = Router();

router.get('/status', getStatus);
router.post('/feed', recordFeed);
router.delete('/feed/:id', removeFeed);

export default router;
