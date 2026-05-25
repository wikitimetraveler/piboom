/**
 * Development work by David Lane
 */
import SpotifyWebApi from 'spotify-web-api-node';

// Spotify OAuth Configuration - dynamically set redirect URI based on environment
const getRedirectUri = () => {
  // Check if running on Render (or other cloud platform)
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}/api/spotify/callback`;
  }
  // Check for custom production redirect URI
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI;
  }
  // Default to localhost for local development
  return 'http://localhost:3000/api/spotify/callback';
};

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: getRedirectUri()
});

// Store user tokens (in production, use a proper database)
const userTokens = new Map();

// Generate authorization URL for Spotify OAuth
export const getAuthUrl = async (req, res) => {
  try {
    // Define the scopes you want to request
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'user-read-recently-played',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
      'user-follow-read',
      'user-read-playback-state',
      'user-modify-playback-state'
    ];
    
    // Generate the authorization URL
    const authUrl = spotifyApi.createAuthorizeURL(scopes, 'music-box-session');
    
    
    res.json({
      success: true,
      authUrl: authUrl,
      scopes: scopes,
      message: 'Spotify authorization URL generated'
    });
    
  } catch (error) {
    console.error('❌ Spotify Auth URL Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Spotify authorization URL'
    });
  }
};

// Handle Spotify OAuth callback
export const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code not found in callback'
      });
    }
    
    // Exchange code for access token
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;
    
    
    // Set the access token
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    
    // Get user profile
    const userProfile = await spotifyApi.getMe();
    const userId = userProfile.body.id;
    
    // Store tokens for this user
    userTokens.set(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      profile: userProfile.body
    });
    
    
    // Redirect to dashboard with user ID
    res.redirect(`/spotify-dashboard.html?userId=${userId}&connected=true`);
    
  } catch (error) {
    console.error('❌ Spotify Callback Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Spotify callback',
      details: error.message
    });
  }
};

// Get user's Spotify profile
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    
    // Get user tokens
    const userTokenData = userTokens.get(userId);
    if (!userTokenData) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Spotify'
      });
    }
    
    // Check if token is expired and refresh if needed
    if (Date.now() > userTokenData.expiresAt) {
      await refreshUserToken(userId);
    }
    
    // Set the access token
    spotifyApi.setAccessToken(userTokenData.accessToken);
    
    // Get user profile
    const userProfile = await spotifyApi.getMe();
    
    res.json({
      success: true,
      user: userProfile.body,
      message: 'User profile retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Get Profile Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
};

// Get user's top tracks
export const getTopTracks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 'medium_term', limit = 20 } = req.query;
    
    
    // Get user tokens
    const userTokenData = userTokens.get(userId);
    if (!userTokenData) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Spotify'
      });
    }
    
    // Check if token is expired and refresh if needed
    if (Date.now() > userTokenData.expiresAt) {
      await refreshUserToken(userId);
    }
    
    // Set the access token
    spotifyApi.setAccessToken(userTokenData.accessToken);
    
    // Get top tracks
    const topTracks = await spotifyApi.getMyTopTracks({
      time_range: timeRange,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      tracks: topTracks.body.items,
      timeRange: timeRange,
      message: 'Top tracks retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Get Top Tracks Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top tracks'
    });
  }
};

// Get user's top artists
export const getTopArtists = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 'medium_term', limit = 20 } = req.query;
    
    
    // Get user tokens
    const userTokenData = userTokens.get(userId);
    if (!userTokenData) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Spotify'
      });
    }
    
    // Check if token is expired and refresh if needed
    if (Date.now() > userTokenData.expiresAt) {
      await refreshUserToken(userId);
    }
    
    // Set the access token
    spotifyApi.setAccessToken(userTokenData.accessToken);
    
    // Get top artists
    const topArtists = await spotifyApi.getMyTopArtists({
      time_range: timeRange,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      artists: topArtists.body.items,
      timeRange: timeRange,
      message: 'Top artists retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Get Top Artists Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top artists'
    });
  }
};

// Get user's playlists
export const getUserPlaylists = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    
    
    // Get user tokens
    const userTokenData = userTokens.get(userId);
    if (!userTokenData) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Spotify'
      });
    }
    
    // Check if token is expired and refresh if needed
    if (Date.now() > userTokenData.expiresAt) {
      await refreshUserToken(userId);
    }
    
    // Set the access token
    spotifyApi.setAccessToken(userTokenData.accessToken);
    
    // Get user playlists
    const playlists = await spotifyApi.getUserPlaylists(userId, {
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      playlists: playlists.body.items,
      message: 'Playlists retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Get Playlists Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get playlists'
    });
  }
};

// Search for tracks, artists, albums
export const searchSpotify = async (req, res) => {
  try {
    const { q, type = 'track,artist,album', limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    
    // Search doesn't require user authentication
    const searchResults = await spotifyApi.search(q, type.split(','), {
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      query: q,
      results: {
        tracks: searchResults.body.tracks?.items || [],
        artists: searchResults.body.artists?.items || [],
        albums: searchResults.body.albums?.items || []
      },
      message: 'Search completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Search Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search Spotify'
    });
  }
};

// Get currently playing track
export const getCurrentlyPlaying = async (req, res) => {
  try {
    const { userId } = req.params;
    
    
    // Get user tokens
    const userTokenData = userTokens.get(userId);
    if (!userTokenData) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Spotify'
      });
    }
    
    // Check if token is expired and refresh if needed
    if (Date.now() > userTokenData.expiresAt) {
      await refreshUserToken(userId);
    }
    
    // Set the access token
    spotifyApi.setAccessToken(userTokenData.accessToken);
    
    // Get currently playing
    const currentlyPlaying = await spotifyApi.getMyCurrentPlayingTrack();
    
    res.json({
      success: true,
      currentlyPlaying: currentlyPlaying.body,
      message: 'Currently playing track retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Get Currently Playing Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get currently playing track'
    });
  }
};

// Refresh user token
async function refreshUserToken(userId) {
  try {
    const userTokenData = userTokens.get(userId);
    if (!userTokenData || !userTokenData.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    
    spotifyApi.setRefreshToken(userTokenData.refreshToken);
    const data = await spotifyApi.refreshAccessToken();
    
    const newAccessToken = data.body.access_token;
    const newExpiresAt = Date.now() + (data.body.expires_in * 1000);
    
    // Update stored tokens
    userTokens.set(userId, {
      ...userTokenData,
      accessToken: newAccessToken,
      expiresAt: newExpiresAt
    });
    
    
  } catch (error) {
    console.error('❌ Token Refresh Error:', error);
    // Remove invalid tokens
    userTokens.delete(userId);
    throw error;
  }
}

// Get authentication status
export const getAuthStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userTokenData = userTokens.get(userId);
    const isAuthenticated = userTokenData && Date.now() < userTokenData.expiresAt;
    
    res.json({
      success: true,
      authenticated: isAuthenticated,
      user: isAuthenticated ? userTokenData.profile : null,
      message: isAuthenticated ? 'User is authenticated' : 'User is not authenticated'
    });
    
  } catch (error) {
    console.error('❌ Auth Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status'
    });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    const { userId } = req.params;
    
    
    // Remove user tokens
    userTokens.delete(userId);
    
    res.json({
      success: true,
      message: 'User logged out successfully'
    });
    
  } catch (error) {
    console.error('❌ Logout Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout user'
    });
  }
};
