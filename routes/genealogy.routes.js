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
  getMuseumContentData,
  getFeaturedStoryData,
  getProminentLanesData,
  getWarCampaignsData,
  getWarParticipantsData,
  getOccupationsData,
  getDirectAncestorStoryData,
  getGenealogyGoogleApiKey,
  getGenealogyMapboxAccessToken,
  getGenealogyGeocodeAddress,
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

// Museum storytelling content endpoints
router.get('/museum-content', getMuseumContentData);
router.get('/featured-story', getFeaturedStoryData);
router.get('/prominent-lanes', getProminentLanesData);
router.get('/wars', getWarCampaignsData);
router.get('/wars/:warSlug/participants', getWarParticipantsData);
router.get('/occupations', getOccupationsData);
router.get('/direct-line-story', getDirectAncestorStoryData);
router.get('/google-api-key', getGenealogyGoogleApiKey);
router.get('/mapbox-access-token', getGenealogyMapboxAccessToken);
router.get('/geocode-address', getGenealogyGeocodeAddress);

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

