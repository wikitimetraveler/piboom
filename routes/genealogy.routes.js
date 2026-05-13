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
  getLaneTradingCardsData,
  getLaneTradingCardData,
  getLanePdfGallery,
  getLanePdfGalleryHides,
  postLanePdfGalleryHidePlate,
  postLanePdfGalleryUndoHide,
  deleteLanePdfGalleryClientHides,
  postLanePdfGalleryBulkImport,
  getLanePdfGalleryPresets,
  postLanePdfGalleryPreset,
  deleteLanePdfGalleryPreset,
  postLanePdfGalleryPresetsImport,
  getLaneBookSayingsData,
  getWarCampaignsData,
  getWarParticipantsData,
  getOccupationsData,
  getDirectAncestorStoryData,
  getDirectDescendantStoryData,
  getGenealogyGoogleApiKey,
  getGenealogyMapboxAccessToken,
  getGenealogyGeocodeAddress,
  getMusicalTimeline,
  importImages,
  genealogyImageUpload
} from '../controllers/genealogy.controller.js';
import laneFamilyAIRouter from '../controllers/lane-family-ai.controller.js';

const router = express.Router();

router.use('/ai', laneFamilyAIRouter);

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
router.get('/lane-cards', getLaneTradingCardsData);
router.get('/lane-cards/:cardId', getLaneTradingCardData);
router.get('/lane-pdf/gallery', getLanePdfGallery);
router.get('/lane-pdf/hides', getLanePdfGalleryHides);
router.post('/lane-pdf/hides', postLanePdfGalleryHidePlate);
router.post('/lane-pdf/hides/undo', postLanePdfGalleryUndoHide);
router.post('/lane-pdf/hides/import', postLanePdfGalleryBulkImport);
router.delete('/lane-pdf/hides', deleteLanePdfGalleryClientHides);
router.get('/lane-pdf/presets', getLanePdfGalleryPresets);
router.post('/lane-pdf/presets', postLanePdfGalleryPreset);
router.delete('/lane-pdf/presets', deleteLanePdfGalleryPreset);
router.post('/lane-pdf/presets/import', postLanePdfGalleryPresetsImport);
router.get('/lane-book-sayings', getLaneBookSayingsData);
router.get('/wars', getWarCampaignsData);
router.get('/wars/:warSlug/participants', getWarParticipantsData);
router.get('/occupations', getOccupationsData);
router.get('/direct-line-story', getDirectAncestorStoryData);
router.get('/direct-descendant-story', getDirectDescendantStoryData);
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

