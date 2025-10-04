import express from 'express';
import { 
  getAuthUrl,
  handleCallback,
  getUserProfile,
  getTopTracks,
  getTopArtists,
  getUserPlaylists,
  searchSpotify,
  getCurrentlyPlaying,
  getAuthStatus,
  logout
} from '../controllers/spotify.controller.js';

const router = express.Router();

// OAuth routes
router.get('/auth', getAuthUrl);                    // GET /api/spotify/auth
router.get('/callback', handleCallback);            // GET /api/spotify/callback

// User data routes (require authentication)
router.get('/user/:userId/profile', getUserProfile);
router.get('/user/:userId/top-tracks', getTopTracks);
router.get('/user/:userId/top-artists', getTopArtists);
router.get('/user/:userId/playlists', getUserPlaylists);
router.get('/user/:userId/currently-playing', getCurrentlyPlaying);
router.get('/user/:userId/auth-status', getAuthStatus);
router.post('/user/:userId/logout', logout);

// Search route (doesn't require user authentication)
router.get('/search', searchSpotify);

export default router;
