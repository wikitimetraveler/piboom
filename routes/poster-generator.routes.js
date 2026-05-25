/**
 * Development work by David Lane
 */
import express from 'express';
import { generatePoster, createPosterShare, getPosterShare, proxyPosterImage } from '../controllers/poster-generator.controller.js';

const router = express.Router();

// Generate concert poster
router.post('/generate', generatePoster);
router.post('/share', createPosterShare);
router.get('/share/:id', getPosterShare);
router.get('/proxy-image', proxyPosterImage);

export default router;

