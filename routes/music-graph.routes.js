/**
 * Development work by David Lane
 */
import express from 'express';
import * as musicGraphController from '../controllers/music-graph.controller.js';

const router = express.Router();

router.get('/collection/:userId', musicGraphController.getCollectionGraph);
router.get('/artist/:key', musicGraphController.getArtistGraph);
router.post('/refresh', musicGraphController.refreshMusicGraph);
router.get('/:nodeId/summary', musicGraphController.getMusicGraphSummary);
router.get('/:nodeId', musicGraphController.getMusicGraph);

export default router;
