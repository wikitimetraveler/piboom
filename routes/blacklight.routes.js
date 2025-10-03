import express from 'express';
import { searchPosters, getFeaturedPosters } from '../controllers/blacklight.controller.js';

const router = express.Router();

// Search for posters/album covers from multiple data sources
router.post('/search-posters', searchPosters);

// Get random featured posters for carousel
router.get('/featured-posters', getFeaturedPosters);

export default router;
