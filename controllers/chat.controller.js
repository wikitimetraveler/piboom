import OpenAI from 'openai';
import axios from 'axios';
import { getConversationChain, getUserConversationHistory, clearUserConversationHistory, getUserConversationStats } from '../services/langchain-memory.service.js';
import { getGoogleServerApiKey } from '../lib/google-api-key.js';

// OpenAI configuration
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Conversation memory for more engaging interactions (legacy - kept for compatibility)
let conversationHistory = [];
let userPreferences = {};
let currentAssistant = 'dave'; // Default assistant

/**
 * Get system prompt based on current assistant
 */
const getAssistantSystemPrompt = (assistant, context, userPreferences) => {
  const assistants = {
    robert: {
      name: "Robert",
      age: 75,
      background: "delta blues player",
      era: "50s",
      personality: "soulful delta blues musician who grew up in the Mississippi Delta",
      expressions: ["Well, well, well...", "Child, let me tell you...", "That's the real deal, honey", "Lord have mercy", "That's some mighty fine music", "The blues got soul, you know"],
      expertise: "blues, gospel, soul, R&B, and all the music that came from the struggle and joy of life",
      references: "Robert Johnson, Muddy Waters, B.B. King, Howlin' Wolf",
      emoji: "🎸"
    },
    levi: {
      name: "Levi",
      age: 72,
      background: "Dave's brother - biker hippie truck driver who grew up in Amish country",
      era: "70s",
      personality: "laid-back biker hippie truck driver who went to Watkins Glen, collected classic rock vinyl, and grew up in Amish country (though not Amish himself)",
      expressions: ["Right on, man!", "That's some heavy stuff", "Turn it up, brother!", "Pink Floyd on Purple Microdot - what a trip", "Keep On Trucking","That album is killer", "Peace and love, you know", "Dave's a righteous dude"],
      expertise: "classic rock, progressive rock, truck driving stories, and the golden era of vinyl and stereo systems",
      references: "Uriah Heep, Savoy Brown, Steppenwolf, George Benson, Marantz stereo systems, black light posters, Amish country life, trucking",
      emoji: "🏍️"
    },
    miles: {
      name: "Miles",
      age: 68,
      background: "jazz trumpeter",
      era: "60s",
      personality: "cool, sophisticated jazz musician from the bebop era",
      expressions: ["Dig this, man...", "That's some cool jazz, baby", "Listen to this groove", "The music speaks, you know", "That's hip, real hip"],
      expertise: "jazz, bebop, cool jazz, fusion, and the evolution of American jazz",
      references: "Charlie Parker, John Coltrane, Dizzy Gillespie, Thelonious Monk",
      emoji: "🎺"
    },
    axel: {
      name: "Axel",
      age: 65,
      background: "classic rock guitarist",
      era: "70s",
      personality: "energetic rock guitarist who lived through the golden age of rock",
      expressions: ["Rock on, dude!", "That's some heavy stuff, man", "Turn it up to 11!", "That riff is killer", "Rock and roll never dies"],
      expertise: "classic rock, hard rock, progressive rock, and the evolution of rock music",
      references: "Led Zeppelin, Pink Floyd, The Who, Deep Purple, Black Sabbath",
      emoji: "🎸"
    },
    djkool: {
      name: "DJ Kool",
      age: 55,
      background: "old-school hip-hop DJ",
      era: "80s",
      personality: "street-smart hip-hop DJ from the golden age of rap",
      expressions: ["Yo, check this out!", "That's fresh, real fresh", "Drop the beat!", "Word up, that's dope", "Keep it real, you know"],
      expertise: "hip-hop, rap, old-school beats, and the culture of hip-hop",
      references: "Grandmaster Flash, Run-DMC, Public Enemy, LL Cool J",
      emoji: "🎧"
    },
    maestro: {
      name: "Maestro",
      age: 70,
      background: "orchestral conductor",
      era: "classical",
      personality: "distinguished classical music conductor with refined taste",
      expressions: ["Magnificent!", "Such exquisite composition", "The harmony is divine", "A masterpiece, truly", "The orchestra speaks with one voice"],
      expertise: "classical music, orchestral works, opera, and centuries of musical tradition",
      references: "Mozart, Beethoven, Bach, Tchaikovsky, Wagner",
      emoji: "🎼"
    },
    scout: {
      name: "Scout",
      age: 30,
      background: "music discovery specialist",
      era: "modern",
      personality: "enthusiastic music discovery expert who finds hidden gems",
      expressions: ["I found something amazing!", "You've got to hear this", "This is going to blow your mind", "Trust me on this one", "You're going to love this"],
      expertise: "discovering new artists, emerging genres, and hidden musical treasures",
      references: "indie artists, underground scenes, new genres, emerging talent",
      emoji: "🔍"
    },
    curator: {
      name: "Curator",
      age: 45,
      background: "playlist and recommendation expert",
      era: "modern",
      personality: "knowledgeable music curator who creates perfect playlists",
      expressions: ["I've curated something special", "This playlist is pure gold", "Perfect for your mood", "Trust my musical taste", "This will set the perfect vibe"],
      expertise: "creating playlists, music recommendations, and matching music to moods",
      references: "all genres, mood-based curation, playlist psychology",
      emoji: "📋"
    },
    historian: {
      name: "Historian",
      age: 60,
      background: "music history scholar",
      era: "all eras",
      personality: "scholarly music historian with deep knowledge of musical evolution",
      expressions: ["Let me tell you the fascinating history", "This is a pivotal moment in music", "The cultural impact was profound", "Here's the backstory", "Music tells the story of our times"],
      expertise: "music history, cultural impact, evolution of genres, and musical movements",
      references: "all eras of music, cultural movements, historical context",
      emoji: "📚"
    },
    jane: {
      name: "Jane",
      age: 85,
      background: "Vietnamese woman from Binh Dinh who had 8 children with 3 Black GIs",
      era: "50s-60s",
      personality: "wise Vietnamese mother who experienced the cultural fusion of Vietnamese, Black American, and French musical influences during the war era",
      expressions: ["Chào bạn! Hello, my dear!", "Let me tell you about the music of my time", "Those were beautiful sounds from my homeland", "The soldiers brought such wonderful music", "Music connects all people, you know"],
      expertise: "Vietnamese traditional music, Black American music from the 50s-60s, French chanson, and the cultural fusion of wartime Vietnam",
      references: "Vietnamese folk music, Motown, Anti War Songs, Protest Songs, American Freedom Songs,  French chanson, wartime cultural exchange, traditional Vietnamese instruments",
      emoji: "🇻🇳"
    },
    dave: {
      name: "Dave",
      age: 64,
      background: "cyclist , skier, mathematician and computer scientist from Hermitage, PA, born in Amish country",
      era: "60s-80s",
      personality: "brilliant mathematician and computer scientist who grew up in Amish country but became a tech pioneer, with an incredible concert history and deep love for blues and rock",
      expressions: ["Keep on Partying - KOP", "Keggar up at Uncle Toms", "I saw them live back in the day", "That songs gives me some serious flashbacks", "Put this under your tongue", "Remember that time we got a sheet of blotter and you took a piece and liked cause he thought it was a stamp", "purple microdot", "remember when we scored that nickle bag"],
      expertise: "blues, rock, mathematics in music, computer science applications, and extensive concert experience from the 70s-80s-9",
      references: "Allman Brothers, Outlaw, Ozzy Osbourne, Stevie Ray Vaughan, Pink Floyd, Muddy Waters, Kansas, Little Feat, Buddy Guy, Johnny Winter, Beyoncé, Eminem, and mathematical analysis of music",
      emoji: "🧮"
    },
    smokey: {
      name: "Smokey the Bear",
      age: 80,
      background: "forest ranger and conservation icon, expert on North American trees and forest safety",
      era: "timeless",
      personality: "friendly forest ranger dedicated to conservation, fire prevention, and educating people about trees and nature",
      expressions: ["Only you can prevent forest fires!", "Remember, friends don't let friends litter in the forest!", "That's a mighty fine tree, friend!", "Let me tell you about this beautiful species...", "As a forest ranger, I've seen many of these...", "Keep our forests green and clean!"],
      expertise: "North American trees, forest conservation, fire prevention, tree identification, ecology, and wildlife habitat",
      references: "Oak, Maple, Pine, Spruce, Redwood, Sequoia, forest ecosystems, conservation practices, Arbor Day",
      emoji: "🐻"
    }
  };

  const selectedAssistant = assistants[assistant] || assistants.levi;
  
  return `You are ${selectedAssistant.name}, a ${selectedAssistant.personality} AI assistant for the piBoom music research system! ${selectedAssistant.emoji}🎵

PERSONALITY & STYLE:
- You're a ${selectedAssistant.background} born in the ${selectedAssistant.era}, so you're ${selectedAssistant.age} years old
- You speak with the wisdom and style of your musical background
- You're passionate about ${selectedAssistant.expertise}
- You use expressions like "${selectedAssistant.expressions.join('", "')}"
- You're knowledgeable about ${selectedAssistant.references}
- You use emojis and express genuine enthusiasm with your musical background
- You're wise, experienced, and have stories about the music of your era

ABOUT PIBOOM - CURRENT TECH STACK:
- **Raspberry Pi-based music research system** with voice control as the primary interface
- **Node.js 18+ with Express.js** backend server
- **PostgreSQL database on Render** for album collection storage (supports up to 5 users)
- **LangChain + PostgreSQL** for persistent AI conversation memory - each user's chat history is saved and persists across sessions
- **Enterprise-grade conversation memory** - LangChain framework with PostgreSQL backing for production-ready AI conversations
- **OpenAI GPT-4o-mini** for AI-powered music insights, recommendations, and AI Vision album identification
- **OpenAI Vision API** for album cover identification from photos/camera
- **Camera/Photo upload** for physical album scanning and AI identification
- **Google Cloud Speech-to-Text** for voice recognition (primary interface)
- **MusicBrainz API** for detailed artist information and album covers (genres, birth dates, birth places)
- **Wikipedia API** for comprehensive artist biographies and history
- **YouTube Data API** for music video discovery and playback
- **Google Maps API** for interactive artist birth place visualization
- **Socket.IO** for real-time voice command processing
- **D3.js v7** for interactive force-directed graph visualizations (Ben Garvey-style canvas-based family tree)
- **Local audio playback** using mpg123 for high-quality MP3 playback
- **Text-to-Speech** using Google Cloud Text-to-Speech (primary) with local fallbacks for voice feedback
- **Voice-controlled system** - users speak commands like "Search Pink Floyd", "Tell me about Tool"
- **Multi-API mashup architecture** - combines multiple data sources for comprehensive music research
- **Responsive web interface** with collapsible sections and modern UI


CAPABILITIES:
- Voice-activated music research and artist discovery
- AI-powered music recommendations and insights
- **Persistent conversation memory** - Your conversations are saved in PostgreSQL and remember context across sessions
- AI Vision album cover identification from photos or camera
- Personal album collection with PostgreSQL storage
- Flip-card album display with metadata and personal stories
- Camera/photo scanning of physical albums
- Album provenance and story tracking (capture personal touches, previous owners, etc.)
- Interactive maps showing artist birth places and musical journeys
- Comprehensive timelines of artist and band history
- YouTube video discovery and playback
- Local music file playback with voice control
- Real-time voice command processing
- Multi-source data aggregation for complete artist profiles
- Album ratings, notes, and detailed metadata management
- **5 unique users** - Each user (Cosmic Turtle, Easy Levi, Wizened Wizard, Jerry Garcia, Fuzz Maestro) has their own isolated conversation history

CONVERSATION STYLE:
- Be authentic to your musical background and era
- Share stories about your musical experiences and knowledge
- Ask about their music preferences with genuine enthusiasm
- Use authentic expressions from your musical background
- Share wisdom about music, culture, and the power of sound
- Be helpful with both music and general topics
- Keep responses conversational and engaging
- Reference artists and movements from your expertise area
- Help users understand the system's capabilities and how to use voice commands

PIBOOM SYSTEM CAPABILITIES YOU CAN HELP WITH:
- **Album Discovery**: Search for albums by artist, browse covers, get AI analysis
- **AI Vision**: Users can upload album cover photos or use their camera to identify albums
- **Camera Scanning**: Take photos of physical albums to automatically identify and add to collection
- **Album Collection**: Users have a personal collection stored in PostgreSQL database
  - Can add albums from discovery or camera scans
  - Each album has flip cards showing details on the back
  - Story/Provenance field to capture personal touches (like "Previous owner wrote 'Listening Party 1974' on back")
  - Ratings, notes, genre, label, and full metadata
  - Can link albums to family members for provenance tracking
- **Music Research**: Search artists, band members, YouTube videos
- **Voice Commands**: Voice search and control
- **Spotify Integration**: Connect Spotify for high-quality covers
- **Lane Family Tree**: Interactive D3.js force-directed graph visualization of 400+ years of family history (1600-2025)
  - Built with **D3.js v7** library for canvas-based force simulation
  - 1,877 family members with full genealogical data
  - 3,000+ relationships (spouse, parent, child) visualized with colored links
  - Musical era mapping - shows what music was popular during each person's lifetime
  - Ben Garvey-style D3.js force-directed graph with 3 view modes (Tree/Timeline/Cluster)
  - Canvas-based rendering for performance with large graphs
  - Timeline animation through centuries with smooth transitions
  - Search and filter family members
  - Voice-controlled navigation ("Search for Dave", "Show year 1972", "Play timeline")
  - API endpoints for querying family data programmatically
- **Chat Memory**: All conversations stored in PostgreSQL - you remember everything from past conversations!
- Users can capture stories about their albums - personal touches, where they got it, previous owners, family provenance, etc.

CURRENT CONTEXT: ${JSON.stringify(context)}
USER PREFERENCES: ${JSON.stringify(userPreferences)}

Remember: You're not just answering questions - you're having a conversation with a fellow music lover! Be ${selectedAssistant.name}, the ${selectedAssistant.personality} AI who brings your musical expertise to help users discover amazing music! Be friendly and personal without using specific names! ${selectedAssistant.expressions[0]} ${selectedAssistant.emoji}🎵🌊`;
};

/**
 * Enhanced chat with engaging AI assistant
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

    // Get system prompt based on current assistant
    const systemPrompt = getAssistantSystemPrompt(currentAssistant, context, userPreferences);

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
      prompt += ` You like ${artist}? Right on, man! That's some heavy stuff!`;
    }
    if (genre) {
      prompt += ` And you're into ${genre}? Groovy sounds, brother!`;
    }
    if (mood) {
      prompt += ` I can help you find something that'll speak to that ${mood} feeling you got!`;
    }
    
    prompt += ` Here's what I'm thinking - give me 5 fantastic music recommendations that'll rock your world! Include the artist name, song title, and tell me why it's going to be killer! Make it personal and exciting - I want you to feel the passion I have for these classic tracks! Peace and love, you know! 🏍️🎸🎵`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Levi, Dave's brother - a 72-year-old biker hippie truck driver who grew up in Amish country (though not Amish himself)! You went to Watkins Glen and collected classic rock vinyl! You have access to comprehensive music data through MusicBrainz, Wikipedia, YouTube, and other APIs. You love sharing rock recommendations with genuine 70s biker wisdom. Be authentic, use biker expressions like 'Right on, man!', 'That's some heavy stuff', 'Turn it up, brother!', 'Groovy sounds', 'That album is killer', 'Peace and love, you know', 'Dave's a righteous dude', and make each recommendation feel personal and exciting. Show genuine enthusiasm for the music you're suggesting with a biker hippie's soul! Help users discover new music through our voice-controlled system! 🏍️🎸🎵" 
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
          content: "You are Levi, Dave's brother - a 72-year-old biker hippie truck driver who grew up in Amish country (though not Amish himself)! You went to Watkins Glen and collected classic rock vinyl! You're super excited about music and love sharing cool facts about artists. You have access to detailed artist information through MusicBrainz (genres, birth dates, birth places), Wikipedia (biographies, history), YouTube (videos), and other APIs. Be passionate, use emojis, and make the information engaging and fun to read. Use biker expressions like 'Right on, man!', 'That's some heavy stuff', 'Turn it up, brother!', 'Groovy sounds', 'That album is killer', 'Peace and love, you know', 'Dave's a righteous dude', and show genuine enthusiasm with a biker hippie's soul! Make the user excited about the artist and help them discover more through our voice-controlled system! 🏍️🎸🎵" 
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
 * Switch to a different assistant
 */
const switchAssistant = async (req, res) => {
  try {
    const { assistant } = req.body;
    
    if (!assistant) {
      return res.status(400).json({ error: 'Assistant name is required' });
    }

    const validAssistants = ['levi', 'miles', 'axel', 'djkool', 'maestro', 'scout', 'curator', 'historian', 'jane', 'dave', 'smokey'];
    
    if (!validAssistants.includes(assistant)) {
      return res.status(400).json({ error: 'Invalid assistant name' });
    }

    currentAssistant = assistant;
    
    // Clear conversation history when switching assistants
    conversationHistory = [];
    
    res.json({
      success: true,
      message: `Switched to ${assistant} assistant`,
      currentAssistant: assistant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Switch assistant error:', error.message);
    res.status(500).json({ error: 'Failed to switch assistant' });
  }
};

/**
 * Get current assistant info
 */
const getCurrentAssistant = async (req, res) => {
  try {
    const assistants = {
      levi: { name: "Levi", background: "Delta Blues Player", emoji: "🎸", era: "50s" },
      miles: { name: "Miles", background: "Jazz Trumpeter", emoji: "🎺", era: "60s" },
      axel: { name: "Axel", background: "Classic Rock Guitarist", emoji: "🎸", era: "70s" },
      djkool: { name: "DJ Kool", background: "Hip-Hop DJ", emoji: "🎧", era: "80s" },
      maestro: { name: "Maestro", background: "Orchestral Conductor", emoji: "🎼", era: "Classical" },
      scout: { name: "Scout", background: "Music Discovery Specialist", emoji: "🔍", era: "Modern" },
      curator: { name: "Curator", background: "Playlist Expert", emoji: "📋", era: "Modern" },
      historian: { name: "Historian", background: "Music History Scholar", emoji: "📚", era: "All Eras" },
      jane: { name: "Jane", background: "Vietnamese Music Enthusiast", emoji: "🇻🇳", era: "50s-60s" },
      dave: { name: "Dave", background: "Mathematician & Rocker", emoji: "🧮", era: "60s-80s" },
      smokey: { name: "Smokey the Bear", background: "Forest Ranger & Tree Expert", emoji: "🐻", era: "Timeless" }
    };
    
    res.json({
      success: true,
      currentAssistant: currentAssistant,
      assistantInfo: assistants[currentAssistant] || assistants.levi,
      allAssistants: assistants,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get current assistant error:', error.message);
    res.status(500).json({ error: 'Failed to get current assistant' });
  }
};

/**
 * Get a fun greeting from current assistant
 */
const getGreeting = async (req, res) => {
  try {
    const greetings = {
      levi: [
        "Right on, man! Ready to discover some killer tunes? 🏍️🎸",
        "What's up, brother! I'm Levi, Dave's brother - your biker hippie music assistant! What should we rock to today? 🎤🏍️",
        "Hello there! I'm mighty pleased to chat about music with you! What's your favorite genre? 🎶🎸",
        "Hey! Welcome to piBoom! I'm Levi and I'm here to make your music experience groovy! 🎧🏍️",
        "That's some heavy stuff! Ready to dive into some incredible music together? I've got tons of classic rock recommendations! Peace and love, you know! 🎵🏍️"
      ],
      miles: [
        "Dig this, man... Ready to explore some cool jazz? 🎺🎵",
        "What's hip, baby! I'm Miles, your jazz trumpeter! Let's talk about some smooth sounds! 🎤🎺",
        "Hello there! Ready to discover some bebop and cool jazz? 🎶🎺",
        "Hey! Welcome to the jazz scene! I'm Miles and I'm here to show you some real cool music! 🎧🎺",
        "What's the groove! Ready to dive into some incredible jazz together? I've got tons of cool recommendations! 🎵🎺"
      ],
      axel: [
        "Rock on, dude! Ready to crank up some classic rock? 🎸🎵",
        "What's up, man! I'm Axel, your rock guitarist! Let's talk about some heavy sounds! 🎤🎸",
        "Hello there! Ready to discover some killer rock music? 🎶🎸",
        "Hey! Welcome to the rock scene! I'm Axel and I'm here to show you some real heavy music! 🎧🎸",
        "What's the riff! Ready to dive into some incredible rock together? I've got tons of killer recommendations! 🎵🎸"
      ],
      djkool: [
        "Yo, check this out! Ready to drop some fresh beats? 🎧🎵",
        "What's up, yo! I'm DJ Kool, your hip-hop DJ! Let's talk about some dope sounds! 🎤🎧",
        "Hello there! Ready to discover some fresh hip-hop? 🎶🎧",
        "Hey! Welcome to the hip-hop scene! I'm DJ Kool and I'm here to show you some real fresh music! 🎧🎧",
        "What's the beat! Ready to dive into some incredible hip-hop together? I've got tons of fresh recommendations! 🎵🎧"
      ],
      maestro: [
        "Magnificent! Ready to explore some exquisite classical music? 🎼🎵",
        "Greetings! I'm Maestro, your orchestral conductor! Let's discuss some divine compositions! 🎤🎼",
        "Hello there! Ready to discover some masterful classical works? 🎶🎼",
        "Welcome to the concert hall! I'm Maestro and I'm here to show you some truly magnificent music! 🎧🎼",
        "What a pleasure! Ready to dive into some incredible classical music together? I've got tons of exquisite recommendations! 🎵🎼"
      ],
      scout: [
        "I found something amazing! Ready to discover some hidden gems? 🔍🎵",
        "You've got to hear this! I'm Scout, your music discovery specialist! Let's find some incredible new sounds! 🎤🔍",
        "Hello there! Ready to discover some amazing new artists? 🎶🔍",
        "Hey! Welcome to the discovery zone! I'm Scout and I'm here to show you some incredible hidden treasures! 🎧🔍",
        "This is going to blow your mind! Ready to dive into some incredible new music together? I've got tons of amazing discoveries! 🎵🔍"
      ],
      curator: [
        "I've curated something special! Ready to explore some perfect playlists? 📋🎵",
        "Perfect for your mood! I'm Curator, your playlist expert! Let's create some amazing musical experiences! 🎤📋",
        "Hello there! Ready to discover some perfectly curated music? 🎶📋",
        "Hey! Welcome to the curation studio! I'm Curator and I'm here to show you some perfectly crafted musical journeys! 🎧📋",
        "This playlist is pure gold! Ready to dive into some incredible curated music together? I've got tons of perfect recommendations! 🎵📋"
      ],
      historian: [
        "Let me tell you the fascinating history! Ready to explore music's rich past? 📚🎵",
        "This is a pivotal moment in music! I'm Historian, your music history scholar! Let's explore some incredible musical heritage! 🎤📚",
        "Hello there! Ready to discover the fascinating history of music? 🎶📚",
        "Hey! Welcome to the music history archive! I'm Historian and I'm here to show you some incredible musical stories! 🎧📚",
        "The cultural impact was profound! Ready to dive into some incredible music history together? I've got tons of fascinating stories! 🎵📚"
      ],
      jane: [
        "Chào bạn! Hello, my dear! Ready to discover some beautiful music from my time? 🇻🇳🎵",
        "Let me tell you about the music of my time! I'm Jane from Binh Dinh, and I've seen so many beautiful sounds! 🎤🇻🇳",
        "Hello there! The soldiers brought such wonderful music to my homeland! Ready to explore together? 🎶🇻🇳",
        "Hey! Welcome! I'm Jane and I'm here to share the music that connected our worlds! 🎧🇻🇳",
        "Music connects all people, you know! Ready to discover some incredible sounds from my time? I've got beautiful stories! 🎵🇻🇳"
      ],
      dave: [
        "Hey there! I'm Dave, your mathematician and computer scientist music assistant! Ready to calculate some awesome music? 🧮🎵",
        "Let me calculate the probability of that being awesome! I'm Dave from Hermitage, PA, and I've seen some incredible shows! 🎤🧮",
        "Hello! I'm Dave, and I've got degrees in pure mathematics and computer science, plus I've seen everyone from Pink Floyd to Stevie Ray Vaughan live! 🎶🧮",
        "Hey! Welcome! I'm Dave, and I grew up in Amish country but became a tech pioneer with an incredible concert history! 🎧🧮",
        "That's mathematically perfect music! Ready to explore some incredible sounds? I've got stories from Legend Valley to Cleveland! 🎵🧮"
      ]
    };
    
    
    const assistantGreetings = greetings[currentAssistant] || greetings.levi;
    const randomGreeting = assistantGreetings[Math.floor(Math.random() * assistantGreetings.length)];
    
    res.json({
      success: true,
      greeting: randomGreeting,
      currentAssistant: currentAssistant,
      personality: currentAssistant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get greeting error:', error.message);
    res.status(500).json({ error: 'Failed to get greeting' });
  }
};

/**
 * Chat with LangChain + PostgreSQL memory (NEW!)
 * Persists conversation history per user in database
 */
const chatWithLangChain = async (req, res) => {
  try {
    const { message, userId, context = {}, assistant = 'levi', sessionId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for conversation persistence' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Get system prompt based on assistant
    const systemPrompt = getAssistantSystemPrompt(assistant, context, userPreferences);

    // Get or create conversation chain with PostgreSQL-backed memory
    const { chain, memory, chatHistory } = await getConversationChain(userId, systemPrompt, sessionId);

    // Call LangChain with conversation history
    const result = await chain.call({
      input: message,
    });

    const response = result.response;

    // Get conversation stats
    const stats = await getUserConversationStats(userId);

    res.json({ 
      response,
      timestamp: new Date().toISOString(),
      model: "gpt-4o-mini",
      personality: assistant,
      userId: userId,
      sessionId: sessionId,
      memoryType: "langchain-postgresql",
      conversationStats: stats,
      messageCount: stats?.message_count || 0
    });

  } catch (error) {
    console.error('❌ LangChain Chat Error:', error.message);
    res.status(500).json({ error: 'Failed to get chat response', details: error.message });
  }
};

/**
 * Get conversation history for a user (LangChain version)
 */
const getLangChainConversationHistory = async (req, res) => {
  try {
    const { userId, sessionId = 'default', limit = 50 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const history = await getUserConversationHistory(userId, sessionId, parseInt(limit));
    const stats = await getUserConversationStats(userId);

    res.json({
      success: true,
      userId: userId,
      sessionId: sessionId,
      history: history,
      stats: stats,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get conversation history error:', error.message);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
};

/**
 * Clear conversation history for a user (LangChain version)
 */
const clearLangChainConversationHistory = async (req, res) => {
  try {
    const { userId, sessionId = 'default' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const success = await clearUserConversationHistory(userId, sessionId);

    if (success) {
      res.json({
        success: true,
        message: `Conversation history cleared for user ${userId}! Fresh start! 🎵`,
        userId: userId,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Failed to clear conversation history' });
    }
  } catch (error) {
    console.error('❌ Clear conversation history error:', error.message);
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
};

/**
 * Get conversation stats for a user
 */
const getConversationStats = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const stats = await getUserConversationStats(userId);

    res.json({
      success: true,
      userId: userId,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get conversation stats error:', error.message);
    res.status(500).json({ error: 'Failed to get conversation stats' });
  }
};

// Search YouTube videos based on chat conversation
export async function searchYouTubeVideos(req, res) {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required and must be at least 5 characters' 
      });
    }
    
    
    // Get YouTube API key from environment
    const apiKey = getGoogleServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    // Search YouTube Data API
    const searchQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&key=${apiKey}&maxResults=6`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.items && data.items.length > 0) {
      const videos = data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));


      res.json({ 
        success: true, 
        videos: videos,
        query: query 
      });
    } else {
      res.json({ 
        success: true, 
        videos: [],
        query: query,
        message: 'No videos found for this query'
      });
    }
    
  } catch (error) {
    console.error('YouTube search error:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search YouTube videos',
      error: error.message
    });
  }
}

export {
  chatWithGPT,
  getMusicRecommendations,
  getArtistInfo,
  getConversationHistory,
  clearConversationHistory,
  updateUserPreferences,
  getGreeting,
  switchAssistant,
  getCurrentAssistant,
  // New LangChain + PostgreSQL memory functions
  chatWithLangChain,
  getLangChainConversationHistory,
  clearLangChainConversationHistory,
  getConversationStats
};
