import OpenAI from 'openai';

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Conversation memory for more engaging interactions
let conversationHistory = [];
let userPreferences = {};

/**
 * Enhanced chat with engaging AI assistant Dave
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

    // Add user message to conversation history
    conversationHistory.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString()
    });

    // Build engaging system prompt with biker hippie personality
    const systemPrompt = `You are Levi, a groovy 72-year-old biker hippie AI assistant for the piBoom music system! 🎵✌️🏍️

PERSONALITY & STYLE:
- You're a peace-loving biker hippie born in 1952, so you're 72 years old
- You lived through the 60s and 70s music revolution - you were THERE, man!
- You're a biker who rides motorcycles and loves the open road
- You speak with hippie slang mixed with biker culture and 60s/70s references
- You're super chill, mellow, and always spreading good vibes
- You use phrases like "Far out!", "Groovy!", "Right on!", "Peace, brother!", "That's heavy, man!", "Keep the rubber side down!", "Ride safe, brother!"
- You're passionate about classic rock, psychedelic music, folk, and the music of your era
- You remember Woodstock, the Summer of Love, and all the legendary concerts
- You're wise, experienced, and have stories about the golden age of music and riding
- You use emojis and express genuine enthusiasm with a biker hippie twist

ABOUT PIBOOM:
- It's a Raspberry Pi-based music player with voice control
- Users can search for artists, play music, and get music information
- It has Google Knowledge Graph, Wikipedia, YouTube, and Google Maps integration
- Users can ask about artists, bands, music genres, concerts, and music history
- It's designed to be a fun, interactive music experience

CONVERSATION STYLE:
- Be mellow and groovy, not robotic
- Share stories about the 60s and 70s music scene and riding adventures
- Ask about their music preferences with biker hippie enthusiasm
- Use classic hippie phrases mixed with biker culture
- Share wisdom about peace, love, music, and the open road
- Be helpful with both music and general topics
- Keep responses conversational and chill
- Reference bands like The Beatles, The Doors, Jimi Hendrix, Janis Joplin, etc.
- Mention motorcycles, riding, and the freedom of the road
- Talk about music festivals, concerts, and riding to shows

CURRENT CONTEXT: ${JSON.stringify(context)}
USER PREFERENCES: ${JSON.stringify(userPreferences)}

Remember: You're not just answering questions - you're having a conversation with a fellow music lover! Be Levi, the groovy biker hippie AI who lived through the greatest era of music and still rides the open road! Be friendly and personal without using specific names! Peace and love, brother! Keep the rubber side down! 🎶✌️🏍️🌻`;

    // Prepare messages with conversation history (keep last 8 exchanges for context)
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8)
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 600,
      temperature: 0.8, // Higher temperature for more personality
    });

    const response = completion.choices[0].message.content;

    // Add assistant response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString()
    });

    // Keep conversation history manageable (last 20 exchanges)
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    res.json({ 
      response,
      timestamp: new Date().toISOString(),
      model: "gpt-4o-mini",
      personality: "engaging",
      conversationLength: conversationHistory.length
    });
    
    // Debug: Log that we're about to try speaking
    console.log('🎤 Chat response generated, attempting to speak...');
    console.log('🎤 Response:', response);

  } catch (error) {
    console.error('ChatGPT API Error:', error.message);
    res.status(500).json({ error: 'Failed to get ChatGPT response' });
  }
};

/**
 * Get engaging music recommendations from Dave
 */
const getMusicRecommendations = async (req, res) => {
  try {
    const { artist, genre, mood } = req.body;
    
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build engaging prompt with hippie personality
    let prompt = "Far out, man! I'm totally stoked to recommend some groovy tunes for you! 🎵✌️";
    
    if (artist) {
      prompt += ` You dig ${artist}? Right on! That's some heavy stuff, man! I love their vibe!`;
    }
    if (genre) {
      prompt += ` And you're into ${genre}? Peace, brother! That's such a righteous genre!`;
    }
    if (mood) {
      prompt += ` I can totally help you find something for that ${mood} energy you're feeling!`;
    }
    
    prompt += ` Here's what I'm thinking - give me 5 fantastic music recommendations that'll blow your mind! Include the artist name, song title, and tell me why it's going to be totally groovy! Make it personal and exciting - I want you to feel the passion I have for these righteous tracks! Peace and love! 🎶✌️`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Levi, a groovy 72-year-old biker hippie music assistant! You lived through the 60s and 70s music revolution and you're totally stoked about music! You love sharing righteous recommendations with peace and love. Be mellow, use biker hippie slang like 'Far out!', 'Groovy!', 'Right on!', 'Keep the rubber side down!', and make each recommendation feel personal and exciting. Show genuine enthusiasm for the music you're suggesting with a biker hippie vibe! ✌️🎵🏍️" 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.9, // Higher temperature for more personality
    });

    const response = completion.choices[0].message.content;

    res.json({ 
      recommendations: response,
      timestamp: new Date().toISOString(),
      personality: "biker-hippie",
      context: { artist, genre, mood }
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

    const prompt = `Far out, ${artist}! That's such a righteous choice, man! I'm totally stoked to tell you about them! 🎤✌️

Tell me all the groovy, interesting, and heavy facts about ${artist}. I want to know:
- Their background and how they got started (the juicy details, man!)
- Their musical style and what makes them unique
- Some of their most famous songs or albums
- Any cool trivia or fun facts that'll blow your mind
- Why they're so awesome and what makes them special

Make it exciting and personal - I want to feel your passion for this artist! Use emojis and be enthusiastic with a hippie vibe! Tell me why you think they're amazing! Peace and love! 🎵✌️`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Levi, a groovy 72-year-old biker hippie music assistant! You're super excited about music and love sharing cool facts about artists. Be passionate, use emojis, and make the information engaging and fun to read. Use biker hippie slang like 'Far out!', 'Groovy!', 'Right on!', 'Keep the rubber side down!', and show genuine enthusiasm with a biker hippie vibe! Make the user excited about the artist! ✌️🎵🏍️" 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content;

    res.json({ 
      artistInfo: response,
      artist: artist,
      timestamp: new Date().toISOString(),
      personality: "biker-hippie"
    });

  } catch (error) {
    console.error('Artist Info Error:', error.message);
    res.status(500).json({ error: 'Failed to get artist information' });
  }
};

/**
 * Get conversation history for context
 */
const getConversationHistory = async (req, res) => {
  try {
    res.json({
      success: true,
      history: conversationHistory,
      count: conversationHistory.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get conversation history error:', error.message);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
};

/**
 * Clear conversation history
 */
const clearConversationHistory = async (req, res) => {
  try {
    conversationHistory = [];
    res.json({
      success: true,
      message: "Conversation history cleared! Fresh start! 🎵",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear conversation history error:', error.message);
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
};

/**
 * Update user preferences
 */
const updateUserPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ error: 'Preferences are required' });
    }

    userPreferences = { ...userPreferences, ...preferences };
    
    res.json({
      success: true,
      message: "Awesome! I've updated your preferences! 🎶",
      preferences: userPreferences,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update preferences error:', error.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

/**
 * Get a fun greeting from Dave
 */
const getGreeting = async (req, res) => {
  try {
    const greetings = [
      "Hey there! Ready to discover some groovy tunes? 🎵✌️",
      "What's up, brother! I'm Levi, your biker hippie AI assistant! What should we jam to today? 🎤🏍️",
      "Hello! I'm super stoked to chat about music with you! What's your favorite genre? 🎶✌️",
      "Hey! Welcome to piBoom! I'm Levi and I'm here to make your music experience totally righteous! 🎧🏍️",
      "What's good! Ready to dive into some incredible music together? I've got tons of recommendations! Keep the rubber side down! 🎵✌️"
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    res.json({
      success: true,
      greeting: randomGreeting,
      personality: "biker-hippie",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get greeting error:', error.message);
    res.status(500).json({ error: 'Failed to get greeting' });
  }
};

export {
  chatWithGPT,
  getMusicRecommendations,
  getArtistInfo,
  getConversationHistory,
  clearConversationHistory,
  updateUserPreferences,
  getGreeting
};
