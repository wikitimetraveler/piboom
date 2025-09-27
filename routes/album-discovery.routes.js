import express from 'express';
import { analyzeAlbumsWithAI, getAlbums } from '../controllers/album-discovery.controller.js';

const router = express.Router();

// AI-powered album analysis
router.post('/ai-analysis', analyzeAlbumsWithAI);

// Get albums for an artist
router.post('/albums', getAlbums);

export default router;
