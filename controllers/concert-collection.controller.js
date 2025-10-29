import { 
  addConcertToCollection,
  getUserConcertCollection,
  getUserConcertStats,
  removeConcertFromCollection,
  getArtistConcerts,
  getArtistByName,
  createArtist,
  createVenue,
  createConcert,
  checkUserConcertAttendance,
  getConcertsByVenue,
  searchConcertsByDateRange
} from '../services/concert-collection.service.js';

/**
 * Add a concert to user's collection
 */
export async function addConcertToUserCollection(req, res) {
  try {
    const { userId, concertId } = req.params;
    const { personalNotes, rating, photos, ticketPrice, seatLocation, weatherNotes, companions } = req.body;

    const result = await addConcertToCollection(userId, parseInt(concertId), {
      personalNotes,
      rating,
      photos,
      ticketPrice,
      seatLocation,
      weatherNotes,
      companions
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error adding concert to collection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get user's concert collection
 */
export async function getUserCollection(req, res) {
  try {
    const { userId } = req.params;
    const { artistId } = req.query;

    const concerts = await getUserConcertCollection(userId, artistId ? parseInt(artistId) : null);

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('Error getting user collection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get user's concert collection statistics
 */
export async function getUserCollectionStats(req, res) {
  try {
    const { userId } = req.params;
    const { artistId } = req.query;

    const stats = await getUserConcertStats(userId, artistId ? parseInt(artistId) : null);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting user collection stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Remove concert from user's collection
 */
export async function removeConcertFromUserCollection(req, res) {
  try {
    const { userId, concertId } = req.params;

    const result = await removeConcertFromCollection(userId, parseInt(concertId));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error removing concert from collection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all concerts for an artist
 */
export async function getArtistConcertsList(req, res) {
  try {
    const { artistId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const concerts = await getArtistConcerts(parseInt(artistId), limit, offset);

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('Error getting artist concerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Search artists by name
 */
export async function searchArtists(req, res) {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }

    const artists = await getArtistByName(name);

    res.json({
      success: true,
      data: artists
    });
  } catch (error) {
    console.error('Error searching artists:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new artist
 */
export async function createNewArtist(req, res) {
  try {
    const { name, genre, formedYear, disbandedYear, country, bio, imageUrl, spotifyId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }

    const artist = await createArtist({
      name,
      genre,
      formedYear,
      disbandedYear,
      country,
      bio,
      imageUrl,
      spotifyId
    });

    res.json({
      success: true,
      data: artist
    });
  } catch (error) {
    console.error('Error creating artist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new venue
 */
export async function createNewVenue(req, res) {
  try {
    const { name, city, state, country, latitude, longitude, capacity, venueType, website } = req.body;

    if (!name || !city) {
      return res.status(400).json({
        success: false,
        error: 'Venue name and city are required'
      });
    }

    const venue = await createVenue({
      name,
      city,
      state,
      country,
      latitude,
      longitude,
      capacity,
      venueType,
      website
    });

    res.json({
      success: true,
      data: venue
    });
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new concert
 */
export async function createNewConcert(req, res) {
  try {
    const { artistId, venueId, concertDate, tourName, setlist, attendance, recordingAvailable, archiveIdentifier, notes } = req.body;

    if (!artistId || !venueId || !concertDate) {
      return res.status(400).json({
        success: false,
        error: 'Artist ID, venue ID, and concert date are required'
      });
    }

    const concert = await createConcert({
      artistId,
      venueId,
      concertDate,
      tourName,
      setlist,
      attendance,
      recordingAvailable,
      archiveIdentifier,
      notes
    });

    res.json({
      success: true,
      data: concert
    });
  } catch (error) {
    console.error('Error creating concert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Check if user attended a specific concert
 */
export async function checkConcertAttendance(req, res) {
  try {
    const { userId, concertId } = req.params;

    const attendance = await checkUserConcertAttendance(userId, parseInt(concertId));

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error checking concert attendance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get concerts by venue
 */
export async function getVenueConcerts(req, res) {
  try {
    const { venueId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const concerts = await getConcertsByVenue(parseInt(venueId), limit, offset);

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('Error getting venue concerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Search concerts by date range
 */
export async function searchConcertsByDate(req, res) {
  try {
    const { startDate, endDate, artistId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const concerts = await searchConcertsByDateRange(startDate, endDate, artistId ? parseInt(artistId) : null);

    res.json({
      success: true,
      data: concerts
    });
  } catch (error) {
    console.error('Error searching concerts by date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
