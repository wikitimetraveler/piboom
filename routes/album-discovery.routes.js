/**
 * Development work by David Lane
 */
import express from 'express';
import { 
  analyzeAlbumsWithAI, 
  getAlbums, 
  searchAlbum, 
  identifyAlbumFromImage,
  identifyAlbumsFromImages,
} from '../controllers/album-discovery.controller.js';

const router = express.Router();

// AI-powered album analysis
router.post('/ai-analysis', analyzeAlbumsWithAI);

// Get albums for an artist
router.post('/albums', getAlbums);

// Search for a specific album by name
router.post('/search-album', searchAlbum);

// Identify album from uploaded image
router.post('/identify-image', identifyAlbumFromImage);

// Identify up to 5 albums (shelf photo or image stack)
router.post('/identify-images', identifyAlbumsFromImages);

export default router;
