import express from 'express';
import {
  getFamilyData,
  getPeople,
  getPerson,
  search,
  getGeneration,
  getPeopleAliveInYear,
  getMusicalEraInfo,
  getStats,
  getMusicalTimeline,
  importImages,
  genealogyImageUpload
} from '../controllers/genealogy.controller.js';

const router = express.Router();

// Get complete family data for D3 visualization
router.get('/data', getFamilyData);

// Get all people
router.get('/people', getPeople);

// Search people
router.get('/search', search);

// Get family tree statistics
router.get('/stats', getStats);

// Get musical timeline
router.get('/musical-timeline', getMusicalTimeline);

// Upload genealogy page photos (camera/import)
router.post('/import-images', genealogyImageUpload.array('photos', 40), importImages);

// Get people by generation
router.get('/generation/:generation', getGeneration);

// Get people alive in a specific year
router.get('/year/:year/people', getPeopleAliveInYear);

// Get musical era info for a year
router.get('/year/:year/music', getMusicalEraInfo);

// Get person by ID (must be last to avoid conflicts)
router.get('/:id', getPerson);

export default router;

