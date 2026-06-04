/**
 * Development work by David Lane
 */
import axios from 'axios';
import OpenAI from 'openai';
import { getUserConversationHistory } from '../services/langchain-memory.service.js';
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';
import { getPool } from '../services/database.service.js';
import { mbGet } from '../services/musicbrainz.service.js';

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// Process voice DJ command with LangChain memory
export async function processVoiceCommand(req, res) {
  try {
    const { command, userId = 'demo-analyst-1' } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for conversation persistence' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured'
      });
    }

    console.log(`🎤 Voice DJ command from ${userId}:`, command);

    // Get conversation history from PostgreSQL
    const history = await getUserConversationHistory(userId, 'voice-dj', 10);
    
    // Build messages array with history
    const messages = [
      {
        role: 'system',
        content: `You are a groovy music DJ assistant with conversation memory! 

IMPORTANT: You SEARCH and SHOW albums - you don't actually play music. The user will see album covers and can click to explore.

CRITICAL: You MUST respond with valid JSON that has both:
1. A "response" field - groovy text that Wolfman Dave will SPEAK to the user
2. "intent" and "parameters" - to trigger album searches and YouTube videos

Parse user commands and extract:
- Intent: search_artist, search_album, search_year, search_genre, random_pick, general_question
- Parameters: artist name, album name, year, genre, mood
- Response: What Wolfman Dave will SPEAK (make it groovy!)
- SearchQuery: What to search for

REMEMBER PAST CONVERSATIONS! If the user says "more like that" or "something similar", reference what they searched for before.

ALWAYS return this JSON structure:
{
  "intent": "search_artist",
  "parameters": {"artist": "Jimi Hendrix"},
  "response": "Right on! Let me show you Jimi Hendrix - the guitar master! Albums and videos coming up!",
  "searchQuery": "Jimi Hendrix"
}

The "response" field will be spoken by Wolfman Dave's deep voice.
The "intent" and "parameters" will trigger album searches and YouTube videos.

Examples:
- "Find Jimi Hendrix" → {"intent": "search_artist", "parameters": {"artist": "Jimi Hendrix"}, "response": "Far out! Jimi Hendrix - the guitar legend! Check out these albums!", "searchQuery": "Jimi Hendrix"}
- "Show me something from 1973" → {"intent": "search_year", "parameters": {"year": "1973"}, "response": "Groovy! Here are some killer albums from 1973!", "searchQuery": "1973"}
- "Give me some songs" → {"intent": "random_pick", "parameters": {}, "response": "Right on! Here's some far out music for you!", "searchQuery": "classic rock"}

RESPOND WITH ONLY VALID JSON!`
      },
      // Add conversation history
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: command
      }
    ];

    // Call OpenAI with JSON mode
    const completion = await openai.chat.completions.create({
      model: resolveOpenAiAgentModel('VOICE_DJ_MODEL'),
      messages: messages,
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const rawResponse = completion.choices[0].message.content;
    console.log('🤖 Raw AI response:', rawResponse);

    let aiResult;
    try {
      aiResult = JSON.parse(rawResponse);
      console.log('✅ Parsed JSON:', aiResult);
      
      // Ensure required fields exist
      if (!aiResult.intent) aiResult.intent = 'general_question';
      if (!aiResult.response) aiResult.response = 'Right on! Let me search for that!';
      if (!aiResult.searchQuery) aiResult.searchQuery = command;
      if (!aiResult.parameters) aiResult.parameters = {};
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed. Raw response:', rawResponse);
      
      // Smart fallback - try to extract artist/year from command
      const yearMatch = command.match(/\b(19\d{2}|20\d{2})\b/);
      const artistKeywords = ['find', 'show', 'search', 'get'];
      
      if (yearMatch) {
        // Command mentions a year
        aiResult = {
          intent: 'search_year',
          parameters: { year: yearMatch[1] },
          response: `Groovy! Here are some albums from ${yearMatch[1]}!`,
          searchQuery: yearMatch[1]
        };
      } else {
        // Default to general search
        aiResult = {
          intent: 'general_question',
          parameters: {},
          response: rawResponse.substring(0, 150) || 'Right on! Let me search for that!',
          searchQuery: command
        };
      }
    }

    // Save this interaction to PostgreSQL for conversation history
    await saveVoiceDJConversation(userId, command, JSON.stringify(aiResult));


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
    const response = await mbGet('/release-group', {
      query: `artist:${artist}`,
      limit: 12
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
    // Try a simpler query format that should work
    const query = `date:${year}`;
    const response = await mbGet('/release-group', {
      query,
      limit: 12
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

  // Fallback: if no results from MusicBrainz, return some classic albums from that year
  if (albums.length === 0) {
    const fallbackAlbums = getFallbackAlbumsForYear(year);
    albums.push(...fallbackAlbums);
  }

  return albums;
}

// Fallback albums for when MusicBrainz fails
function getFallbackAlbumsForYear(year) {
  const fallbackData = {
    1973: [
      { album: "The Dark Side of the Moon", artist: "Pink Floyd", year: 1973, coverUrl: null },
      { album: "Goodbye Yellow Brick Road", artist: "Elton John", year: 1973, coverUrl: null },
      { album: "Band on the Run", artist: "Paul McCartney & Wings", year: 1973, coverUrl: null },
      { album: "Innervisions", artist: "Stevie Wonder", year: 1973, coverUrl: null },
      { album: "Aladdin Sane", artist: "David Bowie", year: 1973, coverUrl: null },
      { album: "Houses of the Holy", artist: "Led Zeppelin", year: 1973, coverUrl: null },
      { album: "Quadrophenia", artist: "The Who", year: 1973, coverUrl: null },
      { album: "Countdown to Ecstasy", artist: "Steely Dan", year: 1973, coverUrl: null }
    ],
    1974: [
      { album: "On the Border", artist: "Eagles", year: 1974, coverUrl: null },
      { album: "461 Ocean Boulevard", artist: "Eric Clapton", year: 1974, coverUrl: null },
      { album: "Court and Spark", artist: "Joni Mitchell", year: 1974, coverUrl: null },
      { album: "Pretzel Logic", artist: "Steely Dan", year: 1974, coverUrl: null },
      { album: "Diamond Dogs", artist: "David Bowie", year: 1974, coverUrl: null }
    ],
    1975: [
      { album: "Born to Run", artist: "Bruce Springsteen", year: 1975, coverUrl: null },
      { album: "Wish You Were Here", artist: "Pink Floyd", year: 1975, coverUrl: null },
      { album: "Physical Graffiti", artist: "Led Zeppelin", year: 1975, coverUrl: null },
      { album: "Captain Fantastic and the Brown Dirt Cowboy", artist: "Elton John", year: 1975, coverUrl: null }
    ]
  };
  
  return fallbackData[year] || [];
}

// Search by genre
async function searchByGenre(genre, userId) {
  const albums = [];
  
  try {
    const response = await mbGet('/release-group', {
      query: `tag:${genre}`,
      limit: 12
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
    const response = await mbGet('/release-group', {
      query,
      limit: 12
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

// Save Voice DJ conversation to PostgreSQL
async function saveVoiceDJConversation(userId, userMessage, assistantMessage) {
  const pool = getPool();
  
  if (!pool) {
    console.log('⚠️  Database not available - skipping conversation save');
    return;
  }

  try {
    // Get or create conversation
    const conversationResult = await pool.query(
      `INSERT INTO conversations (user_id, session_id, assistant_type, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, session_id)
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [userId, 'voice-dj', 'voice-dj']
    );
    
    const conversationId = conversationResult.rows[0].id;

    // Save user message
    await pool.query(
      `INSERT INTO messages (conversation_id, user_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [conversationId, userId, 'user', userMessage]
    );

    // Save assistant response
    await pool.query(
      `INSERT INTO messages (conversation_id, user_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [conversationId, userId, 'assistant', assistantMessage]
    );

    console.log(`✅ Saved Voice DJ conversation for ${userId}`);
  } catch (error) {
    console.error('❌ Error saving Voice DJ conversation:', error.message);
  }
}

export default {
  processVoiceCommand
};

