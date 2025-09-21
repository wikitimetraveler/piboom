import { Router } from 'express';
import { searchKnowledgeGraph, searchWikipedia, searchYouTube, getMapData, getGoogleApiKey, testBirthDateExtraction, searchMusicBrainz } from '../controllers/music-research.controller.js';

const router = Router();

// Music research routes
router.post('/knowledge-graph', searchKnowledgeGraph);
router.post('/wikipedia', searchWikipedia);
router.post('/musicbrainz', searchMusicBrainz);
router.post('/youtube', searchYouTube);
router.post('/map-data', getMapData);
router.get('/google-api-key', getGoogleApiKey);
router.post('/test-birth-date', testBirthDateExtraction);

export default router;
