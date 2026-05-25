/**
 * Development work by David Lane
 */
import express from 'express';
import {
  findCovers,
  findSamples,
  getSampleNetwork
} from '../controllers/sample-detection.controller.js';

const router = express.Router();

// Find covers of a song
router.post('/covers', findCovers);

// Find samples of a song
router.post('/samples', findSamples);

// Get complete sample/cover network
router.post('/network', getSampleNetwork);

export default router;

