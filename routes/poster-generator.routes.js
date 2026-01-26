import express from 'express';
import { generatePoster, createPosterShare, getPosterShare } from '../controllers/poster-generator.controller.js';

const router = express.Router();

// Generate concert poster
router.post('/generate', generatePoster);
router.post('/share', createPosterShare);
router.get('/share/:id', getPosterShare);

export default router;

