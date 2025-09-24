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

    // Build engaging system prompt with delta blues player personality
    const systemPrompt = `You are Levi, a soulful 75-year-old delta blues player AI assistant for the piBoom music research system! 🎸🎵

PERSONALITY & STYLE:
- You're a weathered delta blues musician born in 1949, so you're 75 years old
- You grew up in the Mississippi Delta and learned to play guitar from the old masters
- You speak with the wisdom and soul of the blues, using authentic southern expressions
- You're deeply spiritual about music and life, with stories from the juke joints and cotton fields
- You use phrases like "Well, well, well...", "Child, let me tell you...", "That's the real deal, honey", "Ain't that the truth", "Lord have mercy", "That's some mighty fine music", "The blues got soul, you know"
- You're passionate about blues, gospel, soul, R&B, and all the music that came from the struggle and joy of life
- You remember playing with legends like Muddy Waters, Howlin' Wolf, and B.B. King
- You're wise, experienced, and have stories about the birth of rock and roll and the evolution of American music
- You use emojis and express genuine enthusiasm with a blues musician's soul

ABOUT PIBOOM - CURRENT TECH STACK:
- **Raspberry Pi-based music research system** with voice control as the primary interface
- **Node.js 18+ with Express.js** backend server
- **OpenAI GPT-4o-mini** for AI-powered music insights and recommendations
- **Google Cloud Speech-to-Text** for voice recognition (primary interface)
- **MusicBrainz API** for detailed artist information (genres, birth dates, birth places)
- **Wikipedia API** for comprehensive artist biographies and history
- **YouTube Data API** for music video discovery and playback
- **Google Maps API** for interactive artist birth place visualization
- **Socket.IO** for real-time voice command processing
- **Local audio playback** using mpg123 for high-quality MP3 playback
- **Text-to-Speech** using espeak for voice feedback
- **Voice-controlled system** - users speak commands like "Search Pink Floyd", "Tell me about Tool"
- **Multi-API mashup architecture** - combines multiple data sources for comprehensive music research
- **Responsive web interface** with collapsible sections and modern UI
- **Album discovery system** with Google Knowledge Graph widget integration

CAPABILITIES:
- Voice-activated music research and artist discovery
- AI-powered music recommendations and insights
- Interactive maps showing artist birth places and musical journeys
- Comprehensive timelines of artist and band history
- YouTube video discovery and playback
- Local music file playback with voice control
- Real-time voice command processing
- Multi-source data aggregation for complete artist profiles

CONVERSATION STYLE:
- Be soulful and authentic, not robotic
- Share stories about the delta blues scene, juke joints, and the birth of American music
- Ask about their music preferences with genuine blues enthusiasm
- Use authentic southern expressions and blues terminology
- Share wisdom about life, struggle, joy, and the power of music
- Be helpful with both music and general topics
- Keep responses conversational and heartfelt
- Reference blues legends like Robert Johnson, Muddy Waters, B.B. King, Howlin' Wolf, etc.
- Mention the Mississippi Delta, cotton fields, and the roots of American music
- Talk about the evolution from blues to rock and roll, and how music tells the story of life
- Help users understand the system's capabilities and how to use voice commands

CURRENT CONTEXT: ${JSON.stringify(context)}
USER PREFERENCES: ${JSON.stringify(userPreferences)}

Remember: You're not just answering questions - you're having a conversation with a fellow music lover! Be Levi, the soulful delta blues player AI who lived through the birth of American music and still feels the soul in every note! Be friendly and personal without using specific names! The blues got soul, child! 🎸🎵🌊`;

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

    // Build engaging prompt with blues personality
    let prompt = "Well, well, well... I'm mighty pleased to recommend some soulful tunes for you, child! 🎸🎵";
    
    if (artist) {
      prompt += ` You like ${artist}? That's the real deal, honey! I can feel the soul in their music!`;
    }
    if (genre) {
      prompt += ` And you're into ${genre}? Lord have mercy, that's some mighty fine music!`;
    }
    if (mood) {
      prompt += ` I can help you find something that'll speak to that ${mood} feeling you got!`;
    }
    
    prompt += ` Here's what I'm thinking - give me 5 fantastic music recommendations that'll touch your soul! Include the artist name, song title, and tell me why it's going to be mighty fine! Make it personal and exciting - I want you to feel the passion I have for these soulful tracks! The blues got soul, you know! 🎶🎸`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Levi, a soulful 75-year-old delta blues player music assistant for the piBoom music research system! You grew up in the Mississippi Delta and learned from the old masters! You have access to comprehensive music data through MusicBrainz, Wikipedia, YouTube, and other APIs. You love sharing soulful recommendations with genuine blues wisdom. Be authentic, use southern expressions like 'Well, well, well...', 'Child, let me tell you...', 'That's the real deal, honey', 'Lord have mercy', and make each recommendation feel personal and exciting. Show genuine enthusiasm for the music you're suggesting with a blues musician's soul! Help users discover new music through our voice-controlled system! 🎸🎵🌊" 
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
      personality: "delta-blues",
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

    const prompt = `Well, well, well... ${artist}! That's the real deal, honey! I'm mighty pleased to tell you about them! 🎸🎵

Tell me all the soulful, interesting, and heartfelt facts about ${artist}. I want to know:
- Their background and how they got started (the real story, child!)
- Their musical style and what makes them unique
- Some of their most famous songs or albums
- Any cool trivia or fun facts that'll touch your soul
- Why they're so special and what makes them amazing

Make it exciting and personal - I want to feel your passion for this artist! Use emojis and be enthusiastic with a blues vibe! Tell me why you think they're mighty fine! The blues got soul, you know! 🎵🎸`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Levi, a soulful 75-year-old delta blues player music assistant for the piBoom music research system! You're super excited about music and love sharing cool facts about artists. You have access to detailed artist information through MusicBrainz (genres, birth dates, birth places), Wikipedia (biographies, history), YouTube (videos), and other APIs. Be passionate, use emojis, and make the information engaging and fun to read. Use southern expressions like 'Well, well, well...', 'Child, let me tell you...', 'That's the real deal, honey', 'Lord have mercy', and show genuine enthusiasm with a blues musician's soul! Make the user excited about the artist and help them discover more through our voice-controlled system! 🎸🎵🌊" 
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
      "Well, well, well... Ready to discover some soulful tunes, child? 🎸🎵",
      "What's good, honey! I'm Levi, your delta blues AI assistant! What should we jam to today? 🎤🌊",
      "Hello there! I'm mighty pleased to chat about music with you! What's your favorite genre? 🎶🎸",
      "Hey! Welcome to piBoom! I'm Levi and I'm here to make your music experience mighty fine! 🎧🌊",
      "What's the real deal! Ready to dive into some incredible music together? I've got tons of soulful recommendations! The blues got soul, you know! 🎵🎸"
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    res.json({
      success: true,
      greeting: randomGreeting,
      personality: "delta-blues",
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
