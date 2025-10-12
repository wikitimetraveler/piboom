import axios from 'axios';

// Get music history for a specific date
export async function getMusicHistory(req, res) {
  try {
    const { month, day, year } = req.query;
    
    if (!month || !day) {
      return res.status(400).json({ error: 'Month and day are required' });
    }

    const history = {
      albums: [],
      chartToppers: [],
      concerts: [],
      events: [],
      videos: [],
      mapData: []
    };

    // Get albums released on this date from MusicBrainz
    try {
      const albums = await getAlbumsReleasedOnDate(month, day, year);
      history.albums = albums;
    } catch (error) {
      console.error('Error fetching albums:', error.message);
    }

    // Get historical events from Wikipedia
    try {
      const events = await getMusicEventsFromWikipedia(month, day);
      history.events = events;
    } catch (error) {
      console.error('Error fetching events:', error.message);
    }

    // Get YouTube videos from that year
    if (year) {
      try {
        const videos = await getYouTubeVideosFromYear(year);
        history.videos = videos;
      } catch (error) {
        console.error('Error fetching YouTube videos:', error.message);
      }
    }

    // Get location data for map (famous concerts/events)
    if (year) {
      history.mapData = getFamousConcertLocations(year, month, day);
    }

    // Return the compiled history
    res.json(history);

  } catch (error) {
    console.error('Error getting music history:', error);
    res.status(500).json({ 
      error: 'Failed to get music history',
      message: error.message 
    });
  }
}

// Get albums released on a specific date from MusicBrainz
async function getAlbumsReleasedOnDate(month, day, year) {
  const albums = [];
  
  try {
    // Format date as YYYY-MM-DD
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = year ? `${year}-${monthStr}-${dayStr}` : `${monthStr}-${dayStr}`;
    
    // Search MusicBrainz for releases on this date
    const searchUrl = `https://musicbrainz.org/ws/2/release?query=date:${dateStr}*&fmt=json&limit=20`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (response.data.releases && response.data.releases.length > 0) {
      for (const release of response.data.releases.slice(0, 10)) {
        // Try to get cover art
        let coverUrl = null;
        try {
          const coverResponse = await axios.head(`https://coverartarchive.org/release/${release.id}/front-250`);
          if (coverResponse.status === 200) {
            coverUrl = `https://coverartarchive.org/release/${release.id}/front-250`;
          }
        } catch (e) {
          // No cover art available
        }

        albums.push({
          title: release.title,
          artist: release['artist-credit'] ? release['artist-credit'].map(ac => ac.name).join(', ') : 'Unknown',
          date: release.date,
          label: release['label-info'] && release['label-info'][0] ? release['label-info'][0].label?.name : null,
          coverUrl: coverUrl
        });
      }
    }
  } catch (error) {
    console.error('Error fetching albums from MusicBrainz:', error.message);
  }

  return albums;
}

// Get music events from Wikipedia for a specific date
async function getMusicEventsFromWikipedia(month, day) {
  const events = [];
  
  try {
    // Wikipedia uses month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month - 1];
    
    // Get Wikipedia page for this date
    const pageTitle = `${monthName}_${day}`;
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles=${pageTitle}&explaintext=true&exsectionformat=plain`;
    
    const response = await axios.get(wikiUrl);
    const pages = response.data.query.pages;
    const page = Object.values(pages)[0];
    
    if (page && page.extract) {
      // Parse the extract for music-related events
      const extract = page.extract;
      const lines = extract.split('\n');
      
      // Look for sections about births, deaths, and events
      let inMusicSection = false;
      for (let i = 0; i < lines.length && events.length < 10; i++) {
        const line = lines[i].trim();
        
        // Check if we're in a music-related section
        if (line.includes('Music') || line.includes('musician') || line.includes('singer') || 
            line.includes('album') || line.includes('band') || line.includes('concert')) {
          inMusicSection = true;
        }
        
        // Extract years and events
        const yearMatch = line.match(/^(\d{4})\s*[-–]\s*(.+)/);
        if (yearMatch && line.length < 200) {
          const year = yearMatch[1];
          const event = yearMatch[2];
          
          // Check if it's music-related
          if (event.toLowerCase().includes('music') || 
              event.toLowerCase().includes('album') ||
              event.toLowerCase().includes('song') ||
              event.toLowerCase().includes('band') ||
              event.toLowerCase().includes('singer') ||
              event.toLowerCase().includes('concert') ||
              event.toLowerCase().includes('release')) {
            events.push({
              year: year,
              title: `${year} - Music Event`,
              description: event
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching events from Wikipedia:', error.message);
  }

  return events;
}

// Get YouTube videos from a specific year
async function getYouTubeVideosFromYear(year) {
  const videos = [];
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.warn('Google API key not available');
    return videos;
  }

  try {
    // Search for popular music from that year
    const searchTerms = [
      `${year} music hits`,
      `${year} classic rock`,
      `${year} live concert`
    ];

    for (const searchTerm of searchTerms.slice(0, 1)) {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: searchTerm,
          type: 'video',
          maxResults: 6,
          order: 'relevance',
          key: apiKey
        }
      });

      if (response.data.items) {
        for (const item of response.data.items) {
          videos.push({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching YouTube videos:', error.message);
  }

  return videos.slice(0, 6);
}

// Get famous concert locations for a specific date
function getFamousConcertLocations(year, month, day) {
  const locations = [];
  
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  console.log('🔍 Looking for date:', dateKey);
  
  // Famous concerts and events with known locations
  const famousEvents = {
    // Woodstock 1969
    '1969-08-15': { lat: 41.7012, lng: -74.3645, title: 'Woodstock Festival', description: 'August 15-18, 1969 - Max Yasgur\'s Farm, Bethel, NY - Featuring Jimi Hendrix, Janis Joplin, The Who' },
    '1969-08-16': { lat: 41.7012, lng: -74.3645, title: 'Woodstock Festival - Day 2', description: 'Featuring Santana, Creedence Clearwater Revival, Grateful Dead' },
    '1969-08-17': { lat: 41.7012, lng: -74.3645, title: 'Woodstock Festival - Day 3', description: 'Featuring Joe Cocker, Jefferson Airplane, The Band' },
    '1969-08-18': { lat: 41.7012, lng: -74.3645, title: 'Woodstock Festival - Final Day', description: 'Featuring Jimi Hendrix\'s legendary Star-Spangled Banner performance' },
    '1969-12-06': { lat: 37.9391, lng: -122.3445, title: 'Altamont Free Concert', description: 'December 6, 1969 - Altamont Speedway, CA - Rolling Stones, Jefferson Airplane' },
    // Monterey Pop 1967
    '1967-06-16': { lat: 37.6047, lng: -121.8947, title: 'Monterey Pop Festival', description: 'June 16-18, 1967 - Monterey County Fairgrounds - Jimi Hendrix burns guitar' },
    '1967-06-17': { lat: 37.6047, lng: -121.8947, title: 'Monterey Pop Festival - Day 2', description: 'Featuring The Who, Janis Joplin\'s breakout performance' },
    '1967-06-18': { lat: 37.6047, lng: -121.8947, title: 'Monterey Pop Festival - Final Day', description: 'Featuring Ravi Shankar, The Mamas & the Papas' },
    // Other iconic concerts
    '1973-01-14': { lat: 21.3099, lng: -157.8581, title: 'Elvis: Aloha from Hawaii', description: 'January 14, 1973 - First global satellite TV concert - 1.5 billion viewers' },
    '1985-07-13': { lat: 51.5074, lng: -0.1278, title: 'Live Aid - London', description: 'July 13, 1985 - Wembley Stadium - Queen, U2, David Bowie' },
    '1976-01-31': { lat: 47.6062, lng: -122.3321, title: 'Led Zeppelin Final US Concert', description: 'January 31, 1976 - Seattle, WA' },
    '1964-08-15': { lat: 40.7128, lng: -74.0060, title: 'The Beatles at Shea Stadium', description: 'August 15, 1964 - New York - 55,000 fans' },
    '1991-11-24': { lat: 51.5074, lng: -0.1278, title: 'Freddie Mercury Tribute Concert', description: 'April 20, 1992 - Wembley Stadium' },
    '1979-09-19': { lat: 40.7306, lng: -73.9352, title: 'No Nukes Concert', description: 'September 19-23, 1979 - Madison Square Garden' }
  };
  
  if (famousEvents[dateKey]) {
    console.log('✅ Found event for', dateKey, ':', famousEvents[dateKey].title);
    locations.push(famousEvents[dateKey]);
  } else {
    console.log('❌ No event found for', dateKey);
    console.log('Available dates:', Object.keys(famousEvents).slice(0, 5).join(', '), '...');
  }

  return locations;
}

// Get live concerts for artists (for Concert Finder feature)
export async function getLiveConcerts(req, res) {
  try {
    const { artists, location } = req.body;
    
    if (!artists || !Array.isArray(artists)) {
      return res.status(400).json({ error: 'Artists array is required' });
    }

    const concerts = [];

    // Use Songkick API (free tier available)
    const apiKey = process.env.SONGKICK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Songkick API key not configured',
        message: 'Please add SONGKICK_API_KEY to your .env file. Get it from https://www.songkick.com/developer' 
      });
    }
    
    for (const artist of artists.slice(0, 10)) { // Limit to 10 artists
      try {
        // First, search for the artist to get their Songkick ID
        const artistName = encodeURIComponent(artist);
        const searchUrl = `https://api.songkick.com/api/3.0/search/artists.json?apikey=${apiKey}&query=${artistName}`;
        
        const searchResponse = await axios.get(searchUrl);
        
        if (searchResponse.data?.resultsPage?.results?.artist && searchResponse.data.resultsPage.results.artist.length > 0) {
          const artistData = searchResponse.data.resultsPage.results.artist[0];
          const artistId = artistData.id;
          
          // Get upcoming events for this artist
          const eventsUrl = `https://api.songkick.com/api/3.0/artists/${artistId}/calendar.json?apikey=${apiKey}`;
          const eventsResponse = await axios.get(eventsUrl);
          
          if (eventsResponse.data?.resultsPage?.results?.event) {
            const events = eventsResponse.data.resultsPage.results.event;
            
            for (const event of events.slice(0, 10)) { // Max 10 events per artist
              concerts.push({
                artist: artist,
                venue: event.venue?.displayName || 'TBA',
                location: event.location ? `${event.location.city}` : 'TBA',
                date: event.start?.datetime || event.start?.date,
                ticketUrl: event.uri,
                lineup: event.performance?.map(p => p.displayName) || [artist]
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching concerts for ${artist}:`, error.message);
        // Continue with other artists
      }
    }

    // Sort by date
    concerts.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      concerts: concerts,
      total: concerts.length
    });

  } catch (error) {
    console.error('Error getting live concerts:', error);
    res.status(500).json({ 
      error: 'Failed to get live concerts',
      message: error.message 
    });
  }
}

export default {
  getMusicHistory,
  getLiveConcerts
};

