import express from 'express';
import { generatePoster } from '../controllers/poster-generator.controller.js';

const router = express.Router();

// Generate concert poster
router.post('/generate', generatePoster);

export default router;

