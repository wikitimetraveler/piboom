import axios from 'axios';

// Search for posters/album covers from multiple data sources
export async function searchPosters(req, res) {
  try {
    const { query, filter = 'all' } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }


    const results = {
      query: query,
      posters: [],
      sources: []
    };

    // Search based on filter type
    if (filter === 'all' || filter === 'music') {
      try {
        const musicBrainzResults = await searchMusicBrainzPosters(query, filter);
        results.posters.push(...musicBrainzResults);
        results.sources.push('MusicBrainz/Cover Art Archive');
      } catch (error) {
        console.error('MusicBrainz search error:', error.message);
      }
    }

    if (filter === 'all' || ['neon', 'cyberpunk', 'psychedelic'].includes(filter)) {
      try {
        const youtubeResults = await searchYouTubePosters(query, filter);
        results.posters.push(...youtubeResults);
        results.sources.push('YouTube');
      } catch (error) {
        console.error('YouTube search error:', error.message);
      }
    }

    if (filter === 'all' || ['vintage', 'retro', 'abstract'].includes(filter)) {
      try {
        const wikipediaResults = await searchWikipediaImages(query, filter);
        results.posters.push(...wikipediaResults);
        results.sources.push('Wikipedia');
      } catch (error) {
        console.error('Wikipedia search error:', error.message);
      }
    }

    if (filter === 'all' || filter === 'abstract') {
      try {
        const kgResults = await searchKnowledgeGraphImages(query, filter);
        results.posters.push(...kgResults);
        results.sources.push('Google Knowledge Graph');
      } catch (error) {
        console.error('Knowledge Graph search error:', error.message);
      }
    }

    // Add Unsplash for high-quality posters and art
    if (filter === 'all' || ['neon', 'psychedelic', 'vintage', 'retro', 'abstract', 'cyberpunk'].includes(filter)) {
      try {
        const unsplashResults = await searchUnsplashPosters(query, filter);
        results.posters.push(...unsplashResults);
        results.sources.push('Unsplash');
      } catch (error) {
        console.error('Unsplash search error:', error.message);
      }
    }


    res.json({
      success: true,
      query: query,
      posters: results.posters,
      sources: results.sources,
      total: results.posters.length
    });

  } catch (error) {
    console.error('Error searching for posters:', error);
    res.status(500).json({ 
      error: 'Failed to search for posters',
      message: error.message 
    });
  }
}

// Search for diverse neon-themed content (not just music)
async function searchMusicBrainzPosters(query, filter = 'all') {
  // Expand search to include various creative content
  const searchTerms = [
    `${query} album`,
    `${query} art`,
    `${query} poster`,
    `${query} neon`,
    `${query} psychedelic`,
    `${query} retro`,
    `${query} vintage`
  ];

  const posters = [];

  for (const searchTerm of searchTerms.slice(0, 3)) { // Limit to 3 searches
    try {
      const searchQuery = encodeURIComponent(searchTerm);
      const musicBrainzUrl = `https://musicbrainz.org/ws/2/release-group?query=${searchQuery}&fmt=json&limit=5`;

      const response = await axios.get(musicBrainzUrl, {
        headers: {
          'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
        }
      });

      const data = response.data;

      if (data['release-groups'] && data['release-groups'].length > 0) {
        for (const releaseGroup of data['release-groups']) {
          try {
            // Try to get cover art from Cover Art Archive
            const coverArtUrl = `https://coverartarchive.org/release-group/${releaseGroup.id}/front-500`;
            
            // Test if the cover art exists
            const coverResponse = await axios.head(coverArtUrl);
            if (coverResponse.status === 200) {
              posters.push({
                id: releaseGroup.id,
                title: releaseGroup.title || 'Neon Art Piece',
                artist: query,
                type: 'Creative Art',
                source: 'MusicBrainz/Cover Art Archive',
                imageUrl: coverArtUrl,
                thumbnailUrl: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
                year: releaseGroup['first-release-date'] ? releaseGroup['first-release-date'].substring(0, 4) : 'Unknown',
                description: `Neon-themed creative artwork: "${releaseGroup.title}"`,
                confidence: 0.85
              });
            }
          } catch (coverError) {
            // Cover art not available, skip this release
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`Error searching for ${searchTerm}:`, error.message);
      continue;
    }
  }

  return posters.slice(0, 8); // Limit total results
}

// Search YouTube for diverse neon-themed content
async function searchYouTubePosters(query, filter = 'all') {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  // Search for various neon-themed content
  const searchTerms = [
    `${query} neon art`,
    `${query} psychedelic poster`,
    `${query} retro design`,
    `${query} cyberpunk art`,
    `${query} black light poster`,
    `${query} vintage neon`
  ];

  const posters = [];

  for (const searchTerm of searchTerms.slice(0, 2)) { // Limit to 2 searches
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: searchTerm,
          type: 'video',
          maxResults: 4,
          key: apiKey
        }
      });

      const newPosters = response.data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: query,
        type: 'Neon Visual Content',
        source: 'YouTube',
        imageUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
        thumbnailUrl: item.snippet.thumbnails.medium.url,
        year: item.snippet.publishedAt ? item.snippet.publishedAt.substring(0, 4) : 'Unknown',
        description: `Neon-themed visual content: "${item.snippet.title}"`,
        videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        confidence: 0.80
      }));

      posters.push(...newPosters);
    } catch (error) {
      console.error(`Error searching YouTube for ${searchTerm}:`, error.message);
      continue;
    }
  }

  return posters.slice(0, 6); // Limit total results
}

// Search Wikipedia for neon-themed images
async function searchWikipediaImages(query, filter = 'all') {
  // Search for neon-themed topics
  const searchTerms = [
    query,
    `${query} neon`,
    `${query} art`,
    `${query} design`,
    `${query} poster`
  ];

  const posters = [];

  for (const searchTerm of searchTerms.slice(0, 2)) { // Limit searches
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=2`;
      const searchResponse = await axios.get(searchUrl);

      if (!searchResponse.data.query?.search || searchResponse.data.query.search.length === 0) {
        continue;
      }

      for (const page of searchResponse.data.query.search) {
        try {
          // Get page images
          const imagesUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(page.title)}&pithumbsize=500&pilicense=any`;
          const imagesResponse = await axios.get(imagesUrl);

          const pages = imagesResponse.data.query?.pages;
          if (pages) {
            for (const pageId in pages) {
              const pageData = pages[pageId];
              if (pageData.thumbnail) {
                posters.push({
                  id: pageData.pageid,
                  title: pageData.title,
                  artist: query,
                  type: 'Neon Art Reference',
                  source: 'Wikipedia',
                  imageUrl: pageData.thumbnail.source,
                  thumbnailUrl: pageData.thumbnail.source,
                  year: 'Unknown',
                  description: `Neon-themed reference: "${pageData.title}"`,
                  pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`,
                  confidence: 0.75
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error getting images for ${page.title}:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.error(`Error searching Wikipedia for ${searchTerm}:`, error.message);
      continue;
    }
  }

  return posters.slice(0, 4); // Limit to 4 Wikipedia images
}

// Search Google Knowledge Graph for neon-themed entities
async function searchKnowledgeGraphImages(query, filter = 'all') {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key not configured');
  }

  // Search for various entity types that might have visual content
  const searchTerms = [
    query,
    `${query} art`,
    `${query} neon`,
    `${query} design`
  ];

  const posters = [];

  for (const searchTerm of searchTerms.slice(0, 2)) { // Limit searches
    try {
      const searchUrl = `https://kgsearch.googleapis.com/v1/entities:search`;
      const response = await axios.get(searchUrl, {
        params: {
          query: searchTerm,
          key: apiKey,
          limit: 3,
          types: 'Thing,CreativeWork,Person,Organization'
        }
      });

      if (response.data.itemListElement) {
        for (const item of response.data.itemListElement) {
          const entity = item.result;
          if (entity.image && entity.image.contentUrl) {
            posters.push({
              id: entity['@id'],
              title: entity.name,
              artist: query,
              type: 'Neon Visual Entity',
              source: 'Google Knowledge Graph',
              imageUrl: entity.image.contentUrl,
              thumbnailUrl: entity.image.contentUrl,
              year: entity.description || 'Unknown',
              description: entity.detailedDescription?.articleBody || entity.description || `Neon-themed visual entity: "${entity.name}"`,
              confidence: 0.85
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error searching Knowledge Graph for ${searchTerm}:`, error.message);
      continue;
    }
  }

  return posters.slice(0, 4); // Limit to 4 KG images
}

// Search Unsplash for high-quality poster images
async function searchUnsplashPosters(query, filter = 'all') {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn('Unsplash API key not configured - skipping Unsplash results');
    return [];
  }

  // Enhance query based on filter
  let enhancedQuery = query;
  if (filter === 'neon') enhancedQuery += ' neon lights';
  else if (filter === 'psychedelic') enhancedQuery += ' psychedelic art';
  else if (filter === 'vintage') enhancedQuery += ' vintage poster';
  else if (filter === 'retro') enhancedQuery += ' retro design';
  else if (filter === 'cyberpunk') enhancedQuery += ' cyberpunk neon';
  else if (filter === 'abstract') enhancedQuery += ' abstract art';
  else enhancedQuery += ' poster art';

  const posters = [];

  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: enhancedQuery,
        per_page: 12,
        orientation: 'portrait',
        order_by: 'relevant'
      },
      headers: {
        'Authorization': `Client-ID ${accessKey}`
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      for (const photo of response.data.results) {
        posters.push({
          id: photo.id,
          title: photo.description || photo.alt_description || query,
          artist: photo.user.name,
          type: 'High-Quality Art',
          source: 'Unsplash',
          imageUrl: photo.urls.regular,
          thumbnailUrl: photo.urls.small,
          year: new Date(photo.created_at).getFullYear().toString(),
          description: photo.description || photo.alt_description || `Art by ${photo.user.name}`,
          artistUrl: photo.user.links.html,
          photoUrl: photo.links.html,
          color: photo.color,
          confidence: 0.90
        });
      }
    }
  } catch (error) {
    console.error(`Error searching Unsplash for ${enhancedQuery}:`, error.message);
  }

  return posters.slice(0, 12); // Return up to 12 Unsplash results
}

// Get random featured posters for the carousel
export async function getFeaturedPosters(req, res) {
  try {
    const featuredArtists = [
      'Pink Floyd', 'Led Zeppelin', 'The Beatles', 'Queen', 'David Bowie',
      'Jimi Hendrix', 'The Rolling Stones', 'AC/DC', 'Black Sabbath', 'Deep Purple'
    ];

    const randomArtist = featuredArtists[Math.floor(Math.random() * featuredArtists.length)];
    

    // Get posters from multiple sources
    const musicBrainzResults = await searchMusicBrainzPosters(randomArtist);
    const youtubeResults = await searchYouTubePosters(randomArtist);
    const unsplashResults = await searchUnsplashPosters(randomArtist);

    const featuredPosters = [
      ...unsplashResults.slice(0, 4),  // Prioritize high-quality Unsplash images
      ...musicBrainzResults.slice(0, 2),
      ...youtubeResults.slice(0, 2)
    ];

    res.json({
      success: true,
      featuredArtist: randomArtist,
      posters: featuredPosters,
      total: featuredPosters.length
    });

  } catch (error) {
    console.error('Error getting featured posters:', error);
    res.status(500).json({ 
      error: 'Failed to get featured posters',
      message: error.message 
    });
  }
}
