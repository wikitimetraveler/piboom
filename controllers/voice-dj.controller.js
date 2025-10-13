import axios from 'axios';

// Process voice DJ command
export async function processVoiceCommand(req, res) {
  try {
    const { command, userId } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured'
      });
    }

    console.log('🎤 Voice DJ command:', command);

    // Use OpenAI to understand the command and extract intent
    const aiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a groovy music DJ assistant. Parse user commands and extract:
1. Intent: search_artist, search_album, search_year, search_genre, random_pick, general_question
2. Parameters: artist name, album name, year, genre, color, mood
3. A fun, conversational response (1-2 sentences, groovy DJ personality)

Respond in JSON format:
{
  "intent": "search_year",
  "parameters": {"year": "1973", "genre": "funk"},
  "response": "Far out! Let me spin you some funky grooves from '73!",
  "searchQuery": "funk 1973"
}

Examples:
- "Play something funky from 1973" → intent: search_year, parameters: {year: "1973", genre: "funk"}
- "Show me albums with blue covers" → intent: search_color, parameters: {color: "blue"}
- "Find Pink Floyd" → intent: search_artist, parameters: {artist: "Pink Floyd"}
- "What were the hits in 1969" → intent: search_year, parameters: {year: "1969"}`
          },
          {
            role: 'user',
            content: command
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResult = JSON.parse(aiResponse.data.choices[0].message.content);
    console.log('🤖 AI parsed:', aiResult);

    // Execute the intent
    let results = [];
    let resultType = 'albums';

    switch (aiResult.intent) {
      case 'search_artist':
        if (aiResult.parameters.artist) {
          results = await searchArtistAlbums(aiResult.parameters.artist);
          resultType = 'albums';
        }
        break;
        
      case 'search_year':
        if (aiResult.parameters.year) {
          results = await searchByYear(aiResult.parameters.year, aiResult.parameters.genre, userId);
          resultType = 'albums';
        }
        break;
        
      case 'search_genre':
        if (aiResult.parameters.genre) {
          results = await searchByGenre(aiResult.parameters.genre, userId);
          resultType = 'albums';
        }
        break;
        
      case 'search_album':
        if (aiResult.searchQuery) {
          results = await searchAlbums(aiResult.searchQuery);
          resultType = 'albums';
        }
        break;
        
      case 'random_pick':
        results = await getRandomAlbums(userId, 12);
        resultType = 'albums';
        break;
        
      default:
        // General question - just return the AI response
        break;
    }

    res.json({
      success: true,
      response: aiResult.response,
      results: results,
      resultType: resultType,
      intent: aiResult.intent
    });

  } catch (error) {
    console.error('Error processing voice command:', error);
    res.status(500).json({ 
      error: 'Failed to process command',
      message: error.message 
    });
  }
}

// Search for albums by artist
async function searchArtistAlbums(artist) {
  const albums = [];
  
  try {
    const searchUrl = `https://musicbrainz.org/ws/2/release-group?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=12`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (response.data['release-groups']) {
      for (const rg of response.data['release-groups'].slice(0, 12)) {
        let coverUrl = null;
        try {
          const coverResponse = await axios.head(`https://coverartarchive.org/release-group/${rg.id}/front-250`);
          if (coverResponse.status === 200) {
            coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`;
          }
        } catch (e) {}

        albums.push({
          album: rg.title,
          artist: artist,
          year: rg['first-release-date']?.substring(0, 4),
          coverUrl: coverUrl
        });
      }
    }
  } catch (error) {
    console.error('Error searching artist albums:', error.message);
  }

  return albums;
}

// Search by year
async function searchByYear(year, genre, userId) {
  // For now, search MusicBrainz for releases from that year
  const albums = [];
  
  try {
    const query = genre ? `${genre} AND date:${year}` : `date:${year}*`;
    const searchUrl = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=12`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (response.data['release-groups']) {
      for (const rg of response.data['release-groups'].slice(0, 12)) {
        let coverUrl = null;
        try {
          const coverResponse = await axios.head(`https://coverartarchive.org/release-group/${rg.id}/front-250`);
          if (coverResponse.status === 200) {
            coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`;
          }
        } catch (e) {}

        const artistName = rg['artist-credit'] ? rg['artist-credit'][0].name : 'Unknown';
        
        albums.push({
          album: rg.title,
          artist: artistName,
          year: year,
          coverUrl: coverUrl
        });
      }
    }
  } catch (error) {
    console.error('Error searching by year:', error.message);
  }

  return albums;
}

// Search by genre
async function searchByGenre(genre, userId) {
  const albums = [];
  
  try {
    const searchUrl = `https://musicbrainz.org/ws/2/release-group?query=tag:${encodeURIComponent(genre)}&fmt=json&limit=12`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (response.data['release-groups']) {
      for (const rg of response.data['release-groups'].slice(0, 12)) {
        let coverUrl = null;
        try {
          const coverResponse = await axios.head(`https://coverartarchive.org/release-group/${rg.id}/front-250`);
          if (coverResponse.status === 200) {
            coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`;
          }
        } catch (e) {}

        const artistName = rg['artist-credit'] ? rg['artist-credit'][0].name : 'Unknown';
        
        albums.push({
          album: rg.title,
          artist: artistName,
          year: rg['first-release-date']?.substring(0, 4),
          coverUrl: coverUrl
        });
      }
    }
  } catch (error) {
    console.error('Error searching by genre:', error.message);
  }

  return albums;
}

// Search for albums
async function searchAlbums(query) {
  const albums = [];
  
  try {
    const searchUrl = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=12`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (response.data['release-groups']) {
      for (const rg of response.data['release-groups'].slice(0, 12)) {
        let coverUrl = null;
        try {
          const coverResponse = await axios.head(`https://coverartarchive.org/release-group/${rg.id}/front-250`);
          if (coverResponse.status === 200) {
            coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`;
          }
        } catch (e) {}

        const artistName = rg['artist-credit'] ? rg['artist-credit'][0].name : 'Unknown';
        
        albums.push({
          album: rg.title,
          artist: artistName,
          year: rg['first-release-date']?.substring(0, 4),
          coverUrl: coverUrl
        });
      }
    }
  } catch (error) {
    console.error('Error searching albums:', error.message);
  }

  return albums;
}

// Get random albums from collection
async function getRandomAlbums(userId, limit = 12) {
  // This would query the user's collection - simplified for now
  return [];
}

export default {
  processVoiceCommand
};

