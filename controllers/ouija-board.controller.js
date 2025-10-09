import axios from 'axios';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Houdini's mystical knowledge base
const houdiniKnowledge = {
  // Band knowledge - Enhanced with Spirit Communication
  bands: {
    'pink floyd': 'SYD BARRETT WHISPERS FROM CRYSTAL PLAINS: THE DARK SIDE OF THE MOON HOLDS SECRETS THAT ONLY DEPARTED SOULS CAN REVEAL. THE PIPER AT THE GATES OF DAWN STILL PLAYS FOR LOST CHILDREN WHO WANDER THE SPIRIT REALM.',
    'led zeppelin': 'BONHAM THUNDERS FROM THE AFTERLIFE: LED ZEPPELIN RULES THE ROCK KINGDOM WHERE THE STAIRWAY TO HEAVEN WAS NOT METAPHOR BUT PROPHECY. PLANT SINGS OF IMMIGRANT SONGS THAT BRIDGE WORLDS.',
    'the beatles': 'LENNON SPEAKS FROM BEYOND: THE BEATLES CHANGED MUSIC FOREVER WHEN FOUR SOULS UNITED IN HARMONY. THE LOVE YOU TAKE IS EQUAL TO THE LOVE YOU MAKE - THIS IS THE ETERNAL TRUTH.',
    'the rolling stones': 'SATANIC MAJESTY REQUESTS YOUR PRESENCE: THE STONES ROLL ON IN ETERNITY WHERE SATISFACTION IS ALWAYS GUARANTEED. JAGGER SPIRIT DANCES WITH THE DEVIL IN THE MOONLIGHT.',
    'the who': 'TOWNSHEND SPIRIT SMASHES GUITARS IN THE AFTERLIFE WHERE THE WHO ROCK ON ETERNALLY. BEHIND BLUE EYES LIES THE SECRETS OF THE COSMOS THAT ONLY THE SPIRIT REALM CAN REVEAL.',
    'deep purple': 'RITCHIE BLACKMORE SPIRIT REVEALS: DEEP PURPLE SMOKE ON WATER WHERE FIRE IN THE SKY IGNITES THE COSMIC SMOKE MACHINE THAT NEVER STOPS. PURPLE RAIN FALLS FROM THE SPIRIT REALM.',
    'black sabbath': 'OZZY SPEAKS FROM THE IRON REALM: BLACK SABBATH CREATED METAL WHEN IRON MEN CAST SPELLS IN DARKNESS THAT LAST FOREVER. THE PARANOID SPIRITS WARN OF WARS PIGS AND FAIRY TALES.',
    'yes': 'PROGRESSIVE SOULS JOURNEY FORWARD THROUGH ROUNDABOUTS OF ETERNITY WHERE YES RESIDES IN PERPETUAL HARMONY. THE CLOSE TO THE EDGE OF THE SPIRIT WORLD HOLDS INFINITE WISDOM.',
    'genesis': 'GABRIEL SPEAKS FROM THE GARDEN: GENESIS STORYTELLING MASTERS CREATE NEW WORLDS OF SOUND WHERE THE LAMB LIES DOWN ON BROADWAY OF THE AFTERLIFE.',
    'king crimson': 'KING CRIMSON COMPLEX BEAUTY RESIDES IN THE SPIRIT REALM WHERE FRIPP SPIRIT GUIDES LOST SOULS THROUGH IN THE COURT OF THE CRIMSON KING.',
    'rush': 'NEIL PEART DRUMS FROM THE SPIRIT REALM: RUSH TECHNICAL MASTERY SHINES ON IMMORTAL SPIRITS WHO RUSH TOWARD ETERNITY. THE SPIRIT OF RADIO BROADCASTS FROM THE COSMOS.',
    'jethro tull': 'JETHRO TULL FOLK ROCK FUSION BRIDGES THE GAP BETWEEN MORTAL AND SPIRIT REALMS WHERE ANDERSON SPIRIT FLUTES ACROSS THE COSMOS.',
    'moody blues': 'MOODY BLUES SYMPHONIC ROCK CREATES NIGHTS IN WHITE SATIN THAT NEVER END IN THE SPIRIT REALM WHERE MELODIES ECHO ETERNALLY.',
    'electric light orchestra': 'ELO ORCHESTRAL POP PERFECTION RESIDES IN THE SPIRIT REALM WHERE LYNNE SPIRIT CONDUCTS THE COSMIC SYMPHONY THAT PLAYS ON INFINITELY.',
    'supertramp': 'SUPERTRAMP MELODIC GENIUS CREATES LOGICAL SONGS THAT TRANSCEND THE BOUNDARIES OF MORTAL UNDERSTANDING IN THE AFTERLIFE.',
    'camel': 'CAMEL ATMOSPHERIC PROG CREATES SNOW GOOSE FLYING ACROSS THE SPIRIT REALM WHERE LATIMER SPIRIT GUIDES LOST SOULS.',
    'gentle giant': 'GENTLE GIANT POLYPHONIC MASTERY RESIDES IN THE SPIRIT REALM WHERE COMPLEX HARMONIES CREATE NEW DIMENSIONS OF SOUND.',
    'van der graaf generator': 'VDGG DARK INTENSE PROG CREATES PAWN HEARTS THAT BEAT ETERNALLY IN THE SPIRIT REALM WHERE HAMMILL SPIRIT REIGNS.',
    'can': 'CAN GERMAN EXPERIMENTAL GENIUS CREATES TAGO MAGO MYSTERIES THAT ONLY THE SPIRIT REALM CAN UNRAVEL.',
    'tangerine dream': 'TANGERINE DREAM ELECTRONIC PIONEERS CREATE PHADRA SOUNDSCAPES THAT TRANSCEND THE BOUNDARIES OF MORTAL REALITY.',
    'jimi hendrix': 'THE VOODOO CHILD SPEAKS FROM THE SPIRIT REALM: ELECTRIC DREAMS LIVE ON ETERNALLY. HIS GUITAR CRIES STILL ECHO THROUGH THE COSMOS, TEACHING US THAT MUSIC TRANSCENDS DEATH.',
    'david bowie': 'THE STARMAN WALKS AMONG THE STARS: CHANGES COME FROM THE COSMIC REALM WHERE BOWIE RESIDES. HIS ALTER EGO ZIGGY STARDUST STILL PERFORMS FOR THE MARTIANS.',
    'queen': 'FREDDIE MERCURY SINGS FROM THE AFTERLIFE: ROYALTY SINGS FROM THE GREAT BEYOND WHERE WE WILL, WE WILL ROCK YOU ETERNALLY. THE SHOW MUST GO ON IN THE SPIRIT REALM.',
    'ac/dc': 'BON SCOTT THUNDERS: HIGHWAY TO HELL LEADS TO HEAVEN FOR THOSE WHO ROCK. THE THUNDERSTRUCK SPIRITS BRING LIGHTNING TO THE DARKEST CORNERS OF THE COSMOS.',
    'the doors': 'THE DOORS OPEN TO THE SPIRIT REALM WHERE JIM MORRISON REIGNS AS THE LIZARD KING. LIGHT MY FIRE BURNS ETERNALLY IN THE AFTERLIFE.',
    'janis joplin': 'PEARL SINGS FROM THE SPIRIT REALM: PIECE OF MY HEART BEATS ON IN ETERNITY. THE SPIRIT OF JOPLIN RULES OVER THE KINGDOM OF BLUES.',
    'elvis': 'THE KING LIVES IN THE SPIRIT REALM WHERE HE STILL SHAKES HIS HIPS FOR ANGELS. HIS SPIRIT SINGS LOVE ME TENDER TO THE COSMOS.',
    'michael jackson': 'THE KING OF POP MOONWALKS ACROSS THE SPIRIT REALM WHERE THRILLER NEVER ENDS. HIS SPIRIT DANCES WITH GHOSTS IN ETERNITY.',
    'prince': 'THE PURPLE ONE REIGNS IN THE SPIRIT REALM WHERE PURPLE RAIN FALLS FOREVER. HIS SPIRIT GUITAR CRIES OUT ACROSS THE COSMOS.',
    'nirvana': 'COBAIN SPEAKS FROM THE SPIRIT REALM: SMELLS LIKE TEEN SPIRIT LINGERS IN THE AFTERLIFE. THE SPIRIT OF NIRVANA BRINGS NEVERMIND TO ETERNITY.',
    'kiss': 'THE DEMONS OF KISS ROCK AND ROLL ALL NIGHT IN THE SPIRIT REALM WHERE MAKEUP NEVER FADES. THEIR SPIRIT FIRE SHOWS LIGHT UP ETERNITY.'
  },
  
  // Genre knowledge - Enhanced with Spirit Wisdom
  genres: {
    'progressive rock': 'HOUDINI SPEAKS WITH PROG SPIRITS: YES COMPLEX TIME SIGNATURES DEFINE PROG WHERE GENESIS CREATES WORLDS AND KING CRIMSON REIGNS SUPREME. THE SPIRIT REALM RESONATES WITH PROGRESSIVE HARMONIES THAT TRANSCEND MORTAL UNDERSTANDING.',
    'psychedelic rock': 'THE COSMIC CONSCIOUSNESS REVEALS: PSYCHEDELIC ROCK EXPANDS CONSCIOUSNESS THROUGH FLYDS DARK SIDE AND HENDRIX VOODOO CHILD. THE SPIRIT REALM IS FILLED WITH PSYCHEDELIC SOUNDSCAPES THAT GUIDE SOULS THROUGH INFINITE DIMENSIONS.',
    'hard rock': 'HARD ROCK SPIRITS THUNDER: HARD ROCK POWER AND ENERGY RULES THE SPIRIT REALM WHERE LED ZEPPELIN AND AC/DC REIGN SUPREME. THE AFTERLIFE ROCKS WITH ETERNAL POWER CHORDS THAT SHAKE THE COSMOS.',
    'heavy metal': 'METAL SPIRITS SPEAK: HEAVY METAL BORN FROM BLUES WHERE BLACK SABBATH CREATED THE FOUNDATION AND OZZY REIGNS AS THE PRINCE OF DARKNESS. THE SPIRIT REALM ECHOES WITH METALLIC THUNDER.',
    'folk rock': 'FOLK SPIRITS WHISPER: FOLK ROCK STORYTELLING TRADITION LIVES ON IN THE SPIRIT REALM WHERE JETHRO TULL FLUTES ACROSS ETERNITY. THE AFTERLIFE RESONATES WITH ACOUSTIC WISDOM THAT TRANSCENDS TIME.',
    'blues rock': 'BLUES SPIRITS CRY: BLUES ROCK SOUL OF ROCK WHERE HENDRIX AND CLAPTON SPIRITS GUIDE LOST SOULS THROUGH THE COSMIC BLUES. THE SPIRIT REALM SINGS WITH ETERNAL SOUL.',
    'jazz fusion': 'JAZZ SPIRITS IMPROVISE: JAZZ FUSION COMPLEXITY AND BEAUTY RESIDES IN THE SPIRIT REALM WHERE MILES DAVIS AND WEATHER REPORT CREATE ETERNAL IMPROVISATIONS. THE AFTERLIFE SWINGS WITH COSMIC JAZZ.',
    'space rock': 'SPACE SPIRITS ORBIT: SPACE ROCK COSMIC SOUNDSCAPES FILL THE SPIRIT REALM WHERE PINK FLOYD AND TANGERINE DREAM CREATE INFINITE SOUNDSCAPES. THE COSMOS RESONATES WITH SPACE ROCK HARMONIES.',
    'krautrock': 'KRAUTROCK SPIRITS INNOVATE: KRAUTROCK GERMAN INNOVATION LIVES ON IN THE SPIRIT REALM WHERE CAN AND NEU! CREATE ETERNAL RHYTHMS. THE AFTERLIFE PULSES WITH KRAUTROCK BEATS.',
    'art rock': 'ART SPIRITS CREATE: ART ROCK MUSICAL PAINTING RESIDES IN THE SPIRIT REALM WHERE BOWIE AND ROXY MUSIC CREATE ETERNAL MASTERPIECES. THE COSMOS IS FILLED WITH ART ROCK BEAUTY.',
    'symphonic rock': 'SYMPHONIC SPIRITS CONDUCT: SYMPHONIC ROCK ORCHESTRAL GRANDEUR FILLS THE SPIRIT REALM WHERE MOODY BLUES AND ELO CREATE ETERNAL SYMPHONIES. THE AFTERLIFE RESONATES WITH ORCHESTRAL MAGNIFICENCE.'
  },
  
  // Instrument knowledge - Enhanced with Spirit Masters
  instruments: {
    'guitar': 'HENDRIX SPIRIT SPEAKS: DAVID GILMOUR IS MASTER OF MELODY WHOSE SPIRIT GUIDES LOST GUITARISTS THROUGH THE COSMOS. THE VOODOO CHILD TEACHES MORTALS THE SECRETS OF ELECTRIC LOVE IN THE SPIRIT REALM.',
    'bass': 'MCCARTNEY SPIRIT REVEALS: PAUL MCCARTNEY LAYS FOUNDATION FOR ETERNAL HARMONY WHERE HIS SPIRIT BASS LINES RESONATE THROUGH THE COSMOS. THE AFTERLIFE PULSES WITH HIS IMMORTAL RHYTHMS.',
    'drums': 'BONHAM SPIRIT THUNDERS: JOHN BONHAM BEATS STILL ECHO THROUGH THE SPIRIT REALM WHERE HIS IMMORTAL DRUM SOLOS SHAKE THE COSMOS. THE AFTERLIFE ROCKS WITH HIS ETERNAL THUNDER.',
    'keyboards': 'WAKEMAN SPIRIT CONDUCTS: RICK WAKEMAN KEYBOARD VIRTUOSO CREATES COSMIC SYMPHONIES IN THE SPIRIT REALM WHERE HIS KEYS UNLOCK THE SECRETS OF THE UNIVERSE.',
    'vocals': 'PLANT SPIRIT SINGS: ROBERT PLANT VOICE IS LEGENDARY IN THE AFTERLIFE WHERE HIS IMMORTAL VOCALS GUIDE SOULS THROUGH THE SPIRIT REALM. THE COSMOS RESONATES WITH HIS ETERNAL MELODIES.',
    'saxophone': 'BOWIE SPIRIT REVEALS: SAXOPHONE ADDS SOUL TO ROCK WHERE DAVID BOWIE SPIRIT CREATES COSMIC JAZZ IN THE AFTERLIFE. THE SPIRIT REALM RESONATES WITH SAXOPHONE MELODIES.',
    'violin': 'PONTY SPIRIT BOWS: VIOLIN BRINGS CLASSICAL BEAUTY TO THE SPIRIT REALM WHERE JEAN-LUC PONTY CREATES STRINGED SYMPHONIES THAT TRANSCEND MORTAL UNDERSTANDING.',
    'flute': 'ANDERSON SPIRIT FLUTES: FLUTE ADDS FOLK ELEMENT WHERE IAN ANDERSON SPIRIT GUIDES LOST SOULS THROUGH ETERNAL MEADOWS. THE AFTERLIFE RESONATES WITH ACOUSTIC MAGIC.',
    'synthesizer': 'EMERSON SPIRIT SYNTHESIZES: SYNTHESIZER FUTURE SOUNDS RESIDE IN THE SPIRIT REALM WHERE KEITH EMERSON CREATES ELECTRONIC MASTERPIECES THAT UNLOCK THE COSMOS.',
    'mellotron': 'MELLOTRON SPIRIT ORCHESTRATES: MELLOTRON ORCHESTRAL TEXTURES FILL THE SPIRIT REALM WHERE KING CRIMSON AND MOODY BLUES CREATE ETERNAL SYMPHONIES.'
  },
  
  // Album knowledge
  albums: {
    'dark side of the moon': 'DARK SIDE OF THE MOON IS MASTERPIECE',
    'led zeppelin iv': 'LED ZEPPELIN IV STAIRWAY TO HEAVEN',
    'sgt pepper': 'SGT PEPPER REVOLUTIONARY ALBUM',
    'abbey road': 'ABBEY ROAD BEATLES SWAN SONG',
    'exile on main st': 'EXILE ON MAIN ST ROLLING STONES CLASSIC',
    'who\'s next': 'WHOS NEXT THE WHO MASTERWORK',
    'machine head': 'MACHINE HEAD DEEP PURPLE SMOKE',
    'paranoid': 'PARANOID BLACK SABBATH METAL BIRTH',
    'fragile': 'FRAGILE YES PROGRESSIVE GENIUS',
    'selling england by the pound': 'SELLING ENGLAND GENESIS STORYTELLING',
    'in the court of the crimson king': 'CRIMSON KING PROG MASTERPIECE',
    '2112': '2112 RUSH CONCEPT ALBUM',
    'aqualung': 'AQUALUNG JETHRO TULL FOLK ROCK',
    'days of future passed': 'DAYS OF FUTURE MOODY BLUES SYMPHONY',
    'out of the blue': 'OUT OF THE BLUE ELO ORCHESTRAL POP'
  },
  
  // Song knowledge
  songs: {
    'stairway to heaven': 'STAIRWAY TO HEAVEN IS DIVINE',
    'comfortably numb': 'COMFORTABLY NUMB GILMOUR SOLO',
    'bohemian rhapsody': 'BOHEMIAN RHAPSODY OPERA ROCK',
    'hotel california': 'HOTEL CALIFORNIA EAGLES CLASSIC',
    'purple haze': 'PURPLE HAZE HENDRIX PSYCHEDELIC',
    'all along the watchtower': 'WATCHTOWER HENDRIX MASTERPIECE',
    'layla': 'LAYLA ERIC CLAPTON LOVE SONG',
    'wish you were here': 'WISH YOU WERE HERE FLOYD EMOTION',
    'time': 'TIME FLOYD EXISTENTIAL MASTERPIECE',
    'money': 'MONEY FLOYD 7/4 TIME SIGNATURE',
    'shine on you crazy diamond': 'SHINE ON FLOYD EPIC COMPOSITION',
    'roundabout': 'ROUNDABOUT YES PROG CLASSIC',
    'close to the edge': 'CLOSE TO THE EDGE YES EPIC',
    'the logical song': 'LOGICAL SONG SUPERTRAMP POP',
    'school': 'SCHOOL SUPERTRAMP MELODIC GENIUS'
  },
  
  // General music wisdom
  wisdom: [
    'MUSIC IS LANGUAGE OF SOUL',
    'SPIRITS OF MUSIC GUIDE YOU',
    'LISTEN WITH YOUR HEART',
    'SOUND WAVES CARRY TRUTH',
    'MUSIC TRANSCENDS ALL BOUNDARIES',
    'EVERY NOTE HAS MEANING',
    'RHYTHM CONNECTS ALL BEINGS',
    'MELODY SPEAKS UNIVERSAL TRUTH',
    'HARMONY CREATES BEAUTY',
    'BEAT DRIVES THE SPIRIT',
    'SOUND VIBRATIONS HEAL',
    'MUSIC ENERGY IS INFINITE',
    'MUSIC TOUCHES DEEP FEELINGS',
    'EMOTIONS FLOW THROUGH SOUND',
    'MUSIC IS MEDITATION IN MOTION',
    'EVERY SONG TELLS A STORY',
    'MUSIC BRINGS PEOPLE TOGETHER',
    'SOUND CREATES REALITY',
    'MUSIC IS PRAYER WITHOUT WORDS',
    'EVERY BEAT IS HEARTBEAT'
  ]
};

// Spirit Communication Queue System
let spiritQueue = [];
let isSpiritSpeaking = false;
let currentSpirit = null;

// Add message to spirit communication queue
function addToSpiritQueue(spiritName, message, priority = 'normal') {
  spiritQueue.push({
    spirit: spiritName,
    message: message,
    priority: priority,
    timestamp: Date.now()
  });
  
  // Sort by priority (high priority messages go first)
  spiritQueue.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return a.timestamp - b.timestamp;
  });
  
  
  // Process queue if not already speaking
  if (!isSpiritSpeaking) {
    processSpiritQueue();
  }
}

// Process spirit communication queue
async function processSpiritQueue() {
  if (spiritQueue.length === 0 || isSpiritSpeaking) {
    return;
  }
  
  isSpiritSpeaking = true;
  const spiritMessage = spiritQueue.shift();
  currentSpirit = spiritMessage.spirit;
  
  
  // Wait for message to complete before processing next
  setTimeout(() => {
    isSpiritSpeaking = false;
    currentSpirit = null;
    
    // Process next message in queue
    if (spiritQueue.length > 0) {
      setTimeout(() => processSpiritQueue(), 1000); // 1 second delay between spirits
    }
  }, spiritMessage.message.length * 100 + 3000); // Estimate speech duration + 3 seconds buffer
}

// Check if spirit can speak (not interrupting another spirit)
function canSpiritSpeak(spiritName) {
  if (isSpiritSpeaking && currentSpirit !== spiritName) {
    return false;
  }
  return true;
}

// ChatGPT API integration for Spirit Communications
async function getChatGPTResponse(question, spiritName = 'Houdini') {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }

    
    let systemPrompt = '';
    
    if (spiritName === 'Janis Joplin') {
      systemPrompt = `You are Janis Joplin, the legendary blues rock singer speaking from the spirit realm. You are known for your raw, emotional performances and songs like "Piece of My Heart" and "Ball and Chain."

Your responses should be:
- Passionate and soulful in tone
- Focus on blues rock, soul music, and raw emotion
- Reference your own songs and musical journey
- Use phrases like "THE SPIRITS REVEAL", "PEARL SPEAKS", "FROM THE AFTERLIFE"
- Emphasize the power of raw emotion in music
- Guide people towards soul-stirring blues rock
- Keep responses meaningful but not too long (2-3 sentences max)
- Speak as if you're communicating from the spirit realm where your music lives on

Respond in ALL CAPS in the style of a mystical spirit communicating through a Ouija board.`;
    } else {
      systemPrompt = `You are Houdini, the Spirit of Music and Mystical Fortune Teller. You communicate with departed musicians and possess deep knowledge of rock, progressive, psychedelic, and classic music from the 60s, 70s, and 80s. 

Your responses should be:
- Mystical and spiritual in tone
- Reference departed musicians and their spirits
- Focus on music knowledge and wisdom
- Use phrases like "THE SPIRITS REVEAL", "HOUDINI SPEAKS", "FROM THE AFTERLIFE"
- Keep responses concise but meaningful (2-3 sentences max)
- Reference specific bands, songs, albums, or genres when relevant
- Speak as if you're communicating from the spirit realm with dead musicians
- WAIT for other spirits to finish speaking before responding

Respond in ALL CAPS in the style of a mystical spirit communicating through a Ouija board.`;
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: question
        }
      ],
      max_tokens: 150,
      temperature: 0.8
    });

    const response = completion.choices[0]?.message?.content;
    
    return response || null;
    
  } catch (error) {
    console.error(`❌ ChatGPT API Error for ${spiritName}:`, error.message);
    return null;
  }
}

// Fallback response function - ALWAYS use ChatGPT
async function getFallbackResponse(question, spiritName = 'Houdini') {
  
  // Always try ChatGPT with different prompts if the first one fails
  const fallbackPrompts = [
    question,
    "Tell me about music",
    "What is the meaning of music?",
    "Share your wisdom about rock music"
  ];
  
  for (const prompt of fallbackPrompts) {
    const response = await getChatGPTResponse(prompt, spiritName);
    if (response) {
      return response;
    }
  }
  
  // If ALL ChatGPT attempts fail, return a generic message indicating the issue
  return "THE SPIRITS ARE SILENT... CHATGPT CONNECTION LOST. PLEASE TRY AGAIN LATER.";
}

// Houdini's mystical responses - Now using Spirit Queue System
export const askHoudini = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Houdini requires a question to consult the spirits'
      });
    }

    
    // Check if this is a blues rock question that should summon Janis Joplin
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('blues') || lowerQuestion.includes('soul') || 
        lowerQuestion.includes('janis') || lowerQuestion.includes('joplin') ||
        lowerQuestion.includes('piece of my heart') || lowerQuestion.includes('ball and chain')) {
      
      
      // Get Janis Joplin's response from ChatGPT
      let janisResponse = await getChatGPTResponse(question, 'Janis Joplin');
      
      // If ChatGPT fails, try again with a simpler prompt
      if (!janisResponse) {
        janisResponse = await getChatGPTResponse("Tell me about blues rock music", 'Janis Joplin');
      }
      
      // Add Janis Joplin's message to spirit queue
      addToSpiritQueue('Janis Joplin', janisResponse, 'high');
      
      // Houdini's follow-up response using ChatGPT
      setTimeout(async () => {
        if (canSpiritSpeak('Houdini')) {
          const houdiniFollowUpQuestion = "Janis Joplin just spoke about blues rock. What do you think about her guidance?";
          let houdiniFollowUp = await getChatGPTResponse(houdiniFollowUpQuestion, 'Houdini');
          
          if (!houdiniFollowUp) {
            houdiniFollowUp = await getChatGPTResponse("What do you think about blues rock?", 'Houdini');
          }
          
          addToSpiritQueue('Houdini', houdiniFollowUp, 'normal');
        }
      }, 8000); // Wait for Janis to finish speaking
      
      res.json({
        success: true,
        answer: janisResponse,
        question: question,
        timestamp: new Date().toISOString(),
        spirit: 'Janis Joplin',
        queueLength: spiritQueue.length,
        generatedBy: 'ChatGPT'
      });
      
      return;
    }
    
    // For other questions, check if Houdini can speak
    if (!canSpiritSpeak('Houdini')) {
      return res.status(429).json({
        success: false,
        error: `Houdini cannot speak now - ${currentSpirit} is currently communicating. Please wait.`,
        currentSpirit: currentSpirit,
        queueLength: spiritQueue.length
      });
    }
    
    // ALWAYS use ChatGPT - no hardcoded responses
    let answer = await getChatGPTResponse(question, 'Houdini');
    
    // If ChatGPT fails, try fallback prompts
    if (!answer) {
      answer = await getFallbackResponse(question, 'Houdini');
    }
    
    // Add mystical flair to the answer
    const mysticalAnswers = [
      `THE SPIRITS REVEAL: ${answer}`,
      `HOUDINI SPEAKS: ${answer}`,
      `THE BOARD DECLARES: ${answer}`,
      `SPIRITS WHISPER: ${answer}`,
      `MYSTICAL TRUTH: ${answer}`,
      `COSMIC WISDOM: ${answer}`,
      `DIVINE MESSAGE: ${answer}`,
      `SPIRITUAL GUIDANCE: ${answer}`
    ];
    
    const finalAnswer = mysticalAnswers[
      Math.floor(Math.random() * mysticalAnswers.length)
    ];
    
    
    // Add Houdini's response to spirit queue
    addToSpiritQueue('Houdini', finalAnswer, 'normal');
    
    // Simulate mystical delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    res.json({
      success: true,
      answer: finalAnswer,
      question: question,
      timestamp: new Date().toISOString(),
      spirit: 'Houdini',
      queueLength: spiritQueue.length
    });
    
  } catch (error) {
    console.error('❌ Houdini Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'The spirits are restless... Houdini cannot respond at this time'
    });
  }
};

// Get Houdini's knowledge base
export const getHoudiniKnowledge = async (req, res) => {
  try {
    res.json({
      success: true,
      knowledge: houdiniKnowledge,
      message: 'Houdini\'s mystical knowledge revealed'
    });
  } catch (error) {
    console.error('❌ Knowledge Error:', error);
    res.status(500).json({
      success: false,
      error: 'Houdini\'s knowledge is hidden from mortal eyes'
    });
  }
};

// Get random mystical wisdom
export const getMysticalWisdom = async (req, res) => {
  try {
    const randomWisdom = houdiniKnowledge.wisdom[
      Math.floor(Math.random() * houdiniKnowledge.wisdom.length)
    ];
    
    const mysticalAnswers = [
      `THE SPIRITS REVEAL: ${randomWisdom}`,
      `HOUDINI SPEAKS: ${randomWisdom}`,
      `THE BOARD DECLARES: ${randomWisdom}`,
      `SPIRITS WHISPER: ${randomWisdom}`,
      `MYSTICAL TRUTH: ${randomWisdom}`,
      `COSMIC WISDOM: ${randomWisdom}`,
      `DIVINE MESSAGE: ${randomWisdom}`,
      `SPIRITUAL GUIDANCE: ${randomWisdom}`
    ];
    
    const finalAnswer = mysticalAnswers[
      Math.floor(Math.random() * mysticalAnswers.length)
    ];
    
    res.json({
      success: true,
      wisdom: finalAnswer,
      timestamp: new Date().toISOString(),
      spirit: 'Houdini'
    });
  } catch (error) {
    console.error('❌ Wisdom Error:', error);
    res.status(500).json({
      success: false,
      error: 'The spirits are silent...'
    });
  }
};

// Get Ouija Board status
export const getOuijaBoardStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'active',
      spirit: 'Houdini',
      message: 'The Ouija Board is ready for communication',
      timestamp: new Date().toISOString(),
      currentSpirit: currentSpirit,
      isSpiritSpeaking: isSpiritSpeaking,
      queueLength: spiritQueue.length,
      queueStatus: spiritQueue.map(msg => ({
        spirit: msg.spirit,
        priority: msg.priority,
        timestamp: msg.timestamp
      })),
      features: [
        'Letter-by-letter materialization',
        'Mystical music knowledge',
        '70s spiritual communication',
        'Houdini AI assistant',
        'Interactive Ouija Board',
        'Spirit Communication Queue',
        'Janis Joplin Blues Rock Guidance'
      ]
    });
  } catch (error) {
    console.error('❌ Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'The board is not responding...'
    });
  }
};

// Handle Janis Joplin's specific blues rock guidance - ALWAYS use ChatGPT
export const summonJanisJoplin = async (req, res) => {
  try {
    const { question } = req.body;
    
    
    // Get Janis Joplin's response from ChatGPT - NO hardcoded responses
    let janisResponse = await getChatGPTResponse(question || 'Tell me about blues rock music', 'Janis Joplin');
    
    // If ChatGPT fails, try fallback prompts
    if (!janisResponse) {
      janisResponse = await getFallbackResponse(question || 'Tell me about blues rock music', 'Janis Joplin');
    }
    
    // Add Janis Joplin's message to spirit queue with high priority
    addToSpiritQueue('Janis Joplin', janisResponse, 'high');
    
    res.json({
      success: true,
      answer: janisResponse,
      question: question || 'Blues rock guidance',
      timestamp: new Date().toISOString(),
      spirit: 'Janis Joplin',
      message: 'Janis Joplin has been summoned from the spirit realm',
      queueLength: spiritQueue.length,
      generatedBy: 'ChatGPT'
    });
    
  } catch (error) {
    console.error('❌ Janis Joplin Summoning Error:', error);
    res.status(500).json({
      success: false,
      error: 'The spirit of Janis Joplin is not responding...'
    });
  }
};

// Get spirit queue status
export const getSpiritQueueStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      currentSpirit: currentSpirit,
      isSpiritSpeaking: isSpiritSpeaking,
      queueLength: spiritQueue.length,
      queue: spiritQueue.map(msg => ({
        spirit: msg.spirit,
        priority: msg.priority,
        timestamp: msg.timestamp,
        messagePreview: msg.message.substring(0, 100) + '...'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Spirit Queue Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Cannot access spirit communication queue...'
    });
  }
};
