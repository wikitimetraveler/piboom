/**
 * Live Music Pilgrimage Atlas routes.
 */
import { Router } from 'express';
import {
  atlasOverview,
  atlasQuery,
  atlasStopDetail,
  atlasVenues,
  getBookmarks,
  getRoutes,
  postBookmark,
  postRoute,
  removeBookmark,
  removeRoute,
} from '../controllers/music-pilgrimage.controller.js';

const router = Router();

router.get('/atlas/overview', atlasOverview);
router.get('/atlas', atlasQuery);
router.get('/atlas/stops/:id', atlasStopDetail);
router.get('/atlas/venues', atlasVenues);

router.get('/bookmarks', getBookmarks);
router.post('/bookmarks', postBookmark);
router.delete('/bookmarks/:id', removeBookmark);

router.get('/routes', getRoutes);
router.post('/routes', postRoute);
router.delete('/routes/:id', removeRoute);

export default router;
