import express from 'express';
import { getMusicHistory, getLiveConcerts } from '../controllers/music-history.controller.js';

const router = express.Router();

// Get music history for a date
router.get('/music-history', getMusicHistory);

// Get live concerts for artists
router.post('/live-concerts', getLiveConcerts);

export default router;

