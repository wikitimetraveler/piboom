import axios from 'axios';

// Houdini's mystical knowledge base
const houdiniKnowledge = {
  // Band knowledge
  bands: {
    'pink floyd': 'THE DARK SIDE OF THE MOON IS MASTERPIECE',
    'led zeppelin': 'LED ZEPPELIN RULES THE ROCK KINGDOM',
    'the beatles': 'THE BEATLES CHANGED MUSIC FOREVER',
    'the rolling stones': 'ROLLING STONES ARE ETERNAL',
    'the who': 'THE WHO ROCKED GENERATIONS',
    'deep purple': 'DEEP PURPLE SMOKE ON WATER',
    'black sabbath': 'BLACK SABBATH CREATED METAL',
    'yes': 'YES PROGRESSIVE ROCK GENIUS',
    'genesis': 'GENESIS STORYTELLING MASTERS',
    'king crimson': 'KING CRIMSON COMPLEX BEAUTY',
    'rush': 'RUSH TECHNICAL MASTERY',
    'jethro tull': 'JETHRO TULL FOLK ROCK FUSION',
    'moody blues': 'MOODY BLUES SYMPHONIC ROCK',
    'electric light orchestra': 'ELO ORCHESTRAL POP PERFECTION',
    'supertramp': 'SUPERTRAMP MELODIC GENIUS',
    'camel': 'CAMEL ATMOSPHERIC PROG',
    'gentle giant': 'GENTLE GIANT POLYPHONIC MASTERY',
    'van der graaf generator': 'VDGG DARK INTENSE PROG',
    'can': 'CAN GERMAN EXPERIMENTAL GENIUS',
    'tangerine dream': 'TANGERINE DREAM ELECTRONIC PIONEERS'
  },
  
  // Genre knowledge
  genres: {
    'progressive rock': 'YES COMPLEX TIME SIGNATURES DEFINE PROG',
    'psychedelic rock': 'PSYCHEDELIC ROCK EXPANDS CONSCIOUSNESS',
    'hard rock': 'HARD ROCK POWER AND ENERGY',
    'heavy metal': 'HEAVY METAL BORN FROM BLUES',
    'folk rock': 'FOLK ROCK STORYTELLING TRADITION',
    'blues rock': 'BLUES ROCK SOUL OF ROCK',
    'jazz fusion': 'JAZZ FUSION COMPLEXITY AND BEAUTY',
    'space rock': 'SPACE ROCK COSMIC SOUNDSCAPES',
    'krautrock': 'KRAUTROCK GERMAN INNOVATION',
    'art rock': 'ART ROCK MUSICAL PAINTING',
    'symphonic rock': 'SYMPHONIC ROCK ORCHESTRAL GRANDEUR'
  },
  
  // Instrument knowledge
  instruments: {
    'guitar': 'DAVID GILMOUR IS MASTER OF MELODY',
    'bass': 'PAUL MCCARTNEY LAYS FOUNDATION',
    'drums': 'JOHN BONHAM BEATS STILL ECHO',
    'keyboards': 'RICK WAKEMAN KEYBOARD VIRTUOSO',
    'vocals': 'ROBERT PLANT VOICE IS LEGENDARY',
    'saxophone': 'SAXOPHONE ADDS SOUL TO ROCK',
    'violin': 'VIOLIN BRINGS CLASSICAL BEAUTY',
    'flute': 'FLUTE ADDS FOLK ELEMENT',
    'synthesizer': 'SYNTHESIZER FUTURE SOUNDS',
    'mellotron': 'MELLOTRON ORCHESTRAL TEXTURES'
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

// Houdini's mystical responses
export const askHoudini = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Houdini requires a question to consult the spirits'
      });
    }

    console.log('🔮 Houdini received question:', question);
    
    // Convert question to lowercase for matching
    const lowerQuestion = question.toLowerCase();
    
    // Search for matching knowledge
    let answer = null;
    
    // Check bands
    for (const [band, response] of Object.entries(houdiniKnowledge.bands)) {
      if (lowerQuestion.includes(band)) {
        answer = response;
        break;
      }
    }
    
    // Check genres
    if (!answer) {
      for (const [genre, response] of Object.entries(houdiniKnowledge.genres)) {
        if (lowerQuestion.includes(genre)) {
          answer = response;
          break;
        }
      }
    }
    
    // Check instruments
    if (!answer) {
      for (const [instrument, response] of Object.entries(houdiniKnowledge.instruments)) {
        if (lowerQuestion.includes(instrument)) {
          answer = response;
          break;
        }
      }
    }
    
    // Check albums
    if (!answer) {
      for (const [album, response] of Object.entries(houdiniKnowledge.albums)) {
        if (lowerQuestion.includes(album)) {
          answer = response;
          break;
        }
      }
    }
    
    // Check songs
    if (!answer) {
      for (const [song, response] of Object.entries(houdiniKnowledge.songs)) {
        if (lowerQuestion.includes(song)) {
          answer = response;
          break;
        }
      }
    }
    
    // If no specific match, use mystical wisdom
    if (!answer) {
      const randomWisdom = houdiniKnowledge.wisdom[
        Math.floor(Math.random() * houdiniKnowledge.wisdom.length)
      ];
      answer = randomWisdom;
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
    
    console.log('🔮 Houdini\'s response:', finalAnswer);
    
    // Simulate mystical delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    res.json({
      success: true,
      answer: finalAnswer,
      question: question,
      timestamp: new Date().toISOString(),
      spirit: 'Houdini'
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
      features: [
        'Letter-by-letter materialization',
        'Mystical music knowledge',
        '70s spiritual communication',
        'Houdini AI assistant',
        'Interactive Ouija Board'
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
