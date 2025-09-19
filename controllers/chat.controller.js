import OpenAI from 'openai';

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Chat with ChatGPT about music
 */
const chatWithGPT = async (req, res) => {
  try {
    const { message, context = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build context-aware prompt for music discussions
    const systemPrompt = `You are a helpful music assistant for a voice-controlled boom box system called piBoom. 
    
    Context about the system:
    - It's a Raspberry Pi-based music player with voice control
    - Users can search for artists, play music, and get music information
    - It has Google Knowledge Graph, Wikipedia, YouTube, and Google Maps integration
    - Users can ask about artists, bands, music genres, concerts, and music history
    
    Be conversational, helpful, and music-focused. Keep responses concise but informative.
    If asked about specific artists, provide interesting facts, recommendations, or context.
    If asked about technical aspects, explain in simple terms.
    
    Current context: ${JSON.stringify(context)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    res.json({ 
      response,
      timestamp: new Date().toISOString(),
      model: "gpt-4o-mini"
    });

  } catch (error) {
    console.error('ChatGPT API Error:', error.message);
    res.status(500).json({ error: 'Failed to get ChatGPT response' });
  }
};

/**
 * Get music recommendations from ChatGPT
 */
const getMusicRecommendations = async (req, res) => {
  try {
    const { artist, genre, mood } = req.body;
    
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    let prompt = "Give me 5 music recommendations";
    
    if (artist) {
      prompt += ` similar to ${artist}`;
    }
    if (genre) {
      prompt += ` in the ${genre} genre`;
    }
    if (mood) {
      prompt += ` for a ${mood} mood`;
    }
    
    prompt += ". Include artist name, song title, and a brief reason why I'd like it. Format as a numbered list.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music recommendation expert. Provide diverse, interesting music suggestions with brief explanations." },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content;

    res.json({ 
      recommendations: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Music Recommendations Error:', error.message);
    res.status(500).json({ error: 'Failed to get music recommendations' });
  }
};

/**
 * Get artist information from ChatGPT
 */
const getArtistInfo = async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const prompt = `Tell me interesting facts about the artist/band "${artist}". Include:
    - Brief background/history
    - Musical style and notable characteristics
    - Famous songs or albums
    - Interesting trivia or facts
    - Current status or recent activity
    
    Keep it engaging and informative, around 200-300 words.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music expert providing engaging artist information." },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    res.json({ 
      artistInfo: response,
      artist: artist,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Artist Info Error:', error.message);
    res.status(500).json({ error: 'Failed to get artist information' });
  }
};

export {
  chatWithGPT,
  getMusicRecommendations,
  getArtistInfo
};
