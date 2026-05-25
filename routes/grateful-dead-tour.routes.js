/**
 * Development work by David Lane
 */
import express from 'express';
import {
  getShows,
  getShowsByDate,
  getShowById,
  importData,
  generateKML,
  downloadKML,
  geocodeMissing,
  getTourStats
} from '../controllers/grateful-dead-tour.controller.js';

const router = express.Router();

// GET /api/grateful-dead/shows - List all shows (paginated)
router.get('/shows', getShows);

// GET /api/grateful-dead/shows/by-date?year=&month=&day=
router.get('/shows/by-date', getShowsByDate);

// GET /api/grateful-dead/shows/:id - Get single show details
router.get('/shows/:id', getShowById);

// GET /api/grateful-dead/stats - Get tour statistics
router.get('/stats', getTourStats);

// POST /api/grateful-dead/import - Import data from setlist.fm API
router.post('/import', importData);

// GET /api/grateful-dead/generate-kml - Generate KML file (returns JSON)
router.get('/generate-kml', generateKML);

// GET /api/grateful-dead/download-kml - Download KML file
router.get('/download-kml', downloadKML);

// POST /api/grateful-dead/geocode-missing - Geocode shows without coordinates
router.post('/geocode-missing', geocodeMissing);

export default router;
