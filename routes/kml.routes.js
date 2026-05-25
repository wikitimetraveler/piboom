/**
 * Development work by David Lane
 */
import express from 'express';
import * as kmlController from '../controllers/kml.controller.js';

const router = express.Router();

// Upload KML file
router.post('/upload', kmlController.upload.single('kml'), kmlController.uploadKML);

// Load KML from URL
router.post('/load-url', kmlController.loadKMLFromURL);

// Search YouTube for videos related to location/event
router.post('/youtube-search', kmlController.searchYouTube);

// Get location details
router.post('/location-details', kmlController.getLocationDetails);

export default router;


