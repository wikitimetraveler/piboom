import { Router } from 'express';
import { 
  addConcertToUserCollection,
  getUserCollection,
  getUserCollectionStats,
  removeConcertFromUserCollection,
  getArtistConcertsList,
  searchArtists,
  createNewArtist,
  createNewVenue,
  createNewConcert,
  checkConcertAttendance,
  getVenueConcerts,
  searchConcertsByDate
} from '../controllers/concert-collection.controller.js';

const router = Router();

// User Collection Routes
router.post('/users/:userId/concerts/:concertId', addConcertToUserCollection);
router.get('/users/:userId/concerts', getUserCollection);
router.get('/users/:userId/stats', getUserCollectionStats);
router.delete('/users/:userId/concerts/:concertId', removeConcertFromUserCollection);
router.get('/users/:userId/concerts/:concertId/attendance', checkConcertAttendance);

// Artist Routes
router.get('/artists/:artistId/concerts', getArtistConcertsList);
router.get('/artists/search', searchArtists);
router.post('/artists', createNewArtist);

// Venue Routes
router.get('/venues/:venueId/concerts', getVenueConcerts);
router.post('/venues', createNewVenue);

// Concert Routes
router.post('/concerts', createNewConcert);
router.get('/concerts/search', searchConcertsByDate);

export default router;
