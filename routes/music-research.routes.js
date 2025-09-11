import { Router } from 'express';
import { searchKnowledgeGraph, searchWikipedia, searchYouTube, getMapData, getGoogleApiKey } from '../controllers/music-research.controller.js';

const router = Router();

// Music research routes
router.post('/knowledge-graph', searchKnowledgeGraph);
router.post('/wikipedia', searchWikipedia);
router.post('/youtube', searchYouTube);
router.post('/map-data', getMapData);
router.get('/google-api-key', getGoogleApiKey);

export default router;
