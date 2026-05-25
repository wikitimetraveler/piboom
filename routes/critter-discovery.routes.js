/**
 * Development work by David Lane
 */
import express from 'express';
import { identifyCritterFromImage, getCritterInfo, chatWithCritterExpert } from '../controllers/critter-discovery.controller.js';

const router = express.Router();

router.post('/identify-image', identifyCritterFromImage);
router.post('/critter-info', getCritterInfo);
router.post('/chat', chatWithCritterExpert);

export default router;
