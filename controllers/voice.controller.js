/**
 * Development work by David Lane
 */
import VoiceService from '../services/voice.service.js';
import axios from 'axios';

const voiceService = new VoiceService();
let isInitialized = false;
let lastVoiceCommand = null;

// Initialize voice service on startup
(async () => {
  try {
    const initialized = await voiceService.init();
    if (initialized) {
      isInitialized = true;
      console.log('✅ VoiceService initialized on startup');
    }
  } catch (error) {
    console.error('❌ Error initializing VoiceService on startup:', error.message);
  }
})();

// Execute voice commands with server-side actions
async function executeVoiceCommand(command, io) {
  // Store the last command for fallback communication
  lastVoiceCommand = {
    command,
    timestamp: Date.now(),
    action: 'execute'
  };
  
  // Check for music research commands first
  if (command.startsWith('search ') || command.startsWith('tell me about ') || command.startsWith('who is ')) {
    const artistName = command.replace(/^(search |tell me about |who is )/i, '').trim();
    
    // Send to frontend to open music research page and search
    if (io) {
      io.emit('voiceCommand', { 
        command: 'musicResearch', 
        artist: artistName,
        timestamp: Date.now(),
        action: 'search'
      });
    }
    return;
  }
  
  // Check for Dave-powered commands (enhanced assistant)
  if (command.startsWith('ask ') || command.startsWith('what ') || command.startsWith('how ') || 
      command.startsWith('why ') || command.startsWith('explain ') || command.includes('recommend') ||
      command.startsWith('tell me ') || command.startsWith('dave ') || command.includes('music')) {
    try {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
      const response = await axios.post(`${baseUrl}/api/chat/chat`, {
        message: command,
        context: { source: 'voice_command', mode: 'pi' }
      });
      
      const chatResponse = response.data.response;
      const personality = response.data.personality || 'engaging';
      
      // Send response to frontend with personality info
      if (io) {
        io.emit('voiceCommand', { 
          command: 'chatResponse', 
          response: chatResponse,
          personality: personality,
          timestamp: Date.now(),
          action: 'chat'
        });
      }
      
      // Make Levi speak his response through voice service
      if (voiceService && voiceService.sayEnabled) {
        // Use chunked speaking for longer responses
        if (chatResponse.length > 200) {
          voiceService.speakChunked(chatResponse);
        } else {
          voiceService.speak(chatResponse);
        }
      }
      
    } catch (error) {
      console.error('Dave Assistant Error:', error.message);
      if (io) {
        io.emit('voiceCommand', { 
          command: 'chatError', 
          error: 'Oops! I had a little trouble there, but I\'m still here to help! Try asking me something else!',
          timestamp: Date.now(),
          action: 'error'
        });
      }
    }
    return;
  }
  
  switch (command) {
    case 'play':
      break;
      
    case 'pause':
      break;
      
    case 'stop':
      if (voiceService) {
        voiceService.stopSpeaking();
      }
      break;
      
    case 'volume up':
      break;
      
    case 'volume down':
      break;
      
    case 'what song':
    case 'what song is this':
    case 'identify song':
    case 'name this song':
    case 'what is this song':
      // Trigger song identification
      try {
        if (io) {
          io.emit('voiceCommand', { 
            command: 'identifySong', 
            timestamp: Date.now(),
            action: 'identify'
          });
        }
        
        // Notify user that identification is starting
        if (voiceService && voiceService.sayEnabled) {
          voiceService.speak('Listening to identify the song. This will take about 10 seconds.');
        }
        
        // Make API call to identify song
        const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
        const response = await axios.post(`${baseUrl}/api/audio-fingerprint/identify`, {
          duration: 10
        });
        
        if (response.data.success && response.data.song) {
          const song = response.data.song;
          const announcement = `I found it! This is ${song.title} by ${song.artist}${song.album ? `, from the album ${song.album}` : ''}`;
          
          if (voiceService && voiceService.sayEnabled) {
            voiceService.speak(announcement);
          }
          
          // Send detailed results to frontend
          if (io) {
            io.emit('songIdentified', response.data);
          }
        } else {
          const message = response.data.message || 'I couldn\'t identify the song. Make sure music is playing and try again.';
          if (voiceService && voiceService.sayEnabled) {
            voiceService.speak(message);
          }
        }
      } catch (error) {
        console.error('Song identification error:', error.message);
        if (voiceService && voiceService.sayEnabled) {
          voiceService.speak('Sorry, I had trouble identifying the song. Make sure the audio fingerprinting service is configured.');
        }
      }
      break;
      
    case 'music research':
    case 'open research':
      if (io) {
        io.emit('voiceCommand', { 
          command: 'openMusicResearch', 
          timestamp: Date.now(),
          action: 'navigate'
        });
      }
      break;
      
    case 'help':
      if (io) {
        io.emit('voiceCommand', { 
          command: 'showHelp', 
          timestamp: Date.now(),
          action: 'help'
        });
      }
      break;
      
    default:
      // Try Dave assistant for unrecognized commands
      try {
        const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
        const response = await axios.post(`${baseUrl}/api/chat/chat`, {
          message: `I said "${command}" but I'm not sure what you want me to do. Can you help me understand what you'd like?`,
          context: { source: 'unrecognized_voice_command', mode: 'pi' }
        });
        
        const chatResponse = response.data.response;
        const personality = response.data.personality || 'engaging';
        if (io) {
          io.emit('voiceCommand', { 
            command: 'chatResponse', 
            response: chatResponse,
            personality: personality,
            timestamp: Date.now(),
            action: 'chat'
          });
        }
        
        // Make Levi speak his response through voice service
        if (voiceService && voiceService.sayEnabled) {
          // Use chunked speaking for longer responses
          if (chatResponse.length > 200) {
            voiceService.speakChunked(chatResponse);
          } else {
            voiceService.speak(chatResponse);
          }
        }
      } catch (error) {
        console.error('Dave assistant fallback error:', error.message);
        if (io) {
          io.emit('voiceCommand', { 
            command: 'chatError', 
            error: 'Hmm, I\'m not sure what you meant by that. Could you try saying it differently?',
            timestamp: Date.now(),
            action: 'error'
          });
        }
      }
  }
}

export async function initVoice(req, res) {
  try {
    if (!isInitialized) {
      const success = await voiceService.init();
      isInitialized = success;
      
      if (success) {
        // Test speaking immediately
        voiceService.speak('Voice service initialized successfully!');
        
        res.json({ 
          success: true, 
          message: 'Voice service initialized successfully',
          available: true
        });
      } else {
        res.json({ 
          success: false, 
          message: 'Voice service not available in current mode',
          available: false
        });
      }
    } else {
      // Test speaking even if already initialized
      voiceService.speak('Voice service was already initialized!');
      
      res.json({ 
        success: true, 
        message: 'Voice service already initialized',
        available: true
      });
    }
  } catch (error) {
    console.error('Voice initialization error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      available: false
    });
  }
}

export function startVoice(req, res) {
  try {
    voiceService.startListening(async (command) => {
      await executeVoiceCommand(command, req.app.locals.io);
      
      // Send command to frontend via Socket.IO for immediate action
      if (req.app.locals.io) {
        req.app.locals.io.emit('voiceCommand', { 
          command, 
          timestamp: Date.now(),
          action: 'execute'
        });
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Voice activation started with ChatGPT integration',
      listening: true
    });
  } catch (error) {
    console.error('Voice start error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

export function stopVoice(req, res) {
  try{
    voiceService.stopListening();
    
    res.json({ 
      success: true, 
      message: 'Voice activation stopped',
      listening: false
    });
  } catch (error) {
    console.error('Voice stop error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

export function getVoiceStatus(req, res) {
  try {
    const status = {
      initialized: isInitialized,
      listening: voiceService.isListening,
      available: isInitialized,
      commands: Object.keys(voiceService.voiceCommands || {}),
      voiceFeedback: voiceService.sayEnabled
    };
    
    res.json({ 
      success: true, 
      status 
    });
  } catch (error) {
    console.error('Voice status error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

export function toggleVoiceFeedback(req, res) {
  try {
    // Get current state and toggle it
    const currentState = voiceService.sayEnabled;
    const newState = !currentState;
    
    // Set the new state
    voiceService.setVoiceFeedback(newState);
    
    // Speak feedback about the change
    const feedbackMessage = newState ? 
      'Voice feedback enabled! I will speak back to you.' : 
      'Voice feedback disabled. I will be quiet now.';
    
    voiceService.speak(feedbackMessage);
    
    res.json({ 
      success: true, 
      message: feedbackMessage,
      voiceFeedback: newState
    });
  } catch (error) {
    console.error('Voice feedback toggle error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

export function speakText(req, res) {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Text parameter is required' 
      });
    }
    
    // Use chunked speech for longer responses to prevent cutoffs
    if (text.length > 200) {
      voiceService.speakChunked(text);
    } else {
      voiceService.speak(text);
    }
    
    res.json({ 
      success: true, 
      message: 'Text spoken successfully',
      text,
      platform: process.platform,
      mode: process.env.MODE || 'pi',
      sayEnabled: voiceService.sayEnabled
    });
  } catch (error) {
    console.error('Speak text error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

// NEW: Google Cloud TTS endpoint - returns audio for frontend playback
export async function synthesizeSpeech(req, res) {
  try {
    const { text, voice, pitch, speakingRate } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Text parameter is required' 
      });
    }
    
    // Use Google Cloud TTS (pitch / speakingRate optional — used by Glazed Pip, etc.)
    const audioBase64 = await voiceService.speakWithGoogle(
      text,
      voice || 'en-US-Standard-D',
      { pitch, speakingRate }
    );
    
    if (audioBase64) {
      res.json({ 
        success: true, 
        audio: audioBase64,
        format: 'mp3',
        text: text
      });
    } else {
      // Fallback: use local TTS
      voiceService.speak(text);
      res.json({ 
        success: false, 
        message: 'Google TTS not available, using local TTS',
        fallback: true
      });
    }
  } catch (error) {
    console.error('Synthesize speech error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

export function getVoiceCommands(req, res) {
  try {
    // Get available commands from the voiceService
    const commands = Object.keys(voiceService.voiceCommands || {});
    
    res.json({ 
      success: true, 
      commands,
      count: commands.length
    });
  } catch (error) {
    console.error('Get voice commands error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

// Fallback endpoint to get last voice command
export function getLastVoiceCommand(req, res) {
  try {
    if (lastVoiceCommand) {
      const command = lastVoiceCommand;
      lastVoiceCommand = null; // Clear after sending
      
      res.json({ 
        success: true, 
        command 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'No voice command available' 
      });
    }
  } catch (error) {
    console.error('Get last voice command error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

// Handle voice commands from frontend (for Pi mode compatibility)
export function processFrontendVoiceCommand(req, res) {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ 
        success: false, 
        message: 'Command parameter is required' 
      });
    }
    
    // Process the command through the voice service
    voiceService.processFrontendCommand(command);
    
    // Store the command for fallback communication
    lastVoiceCommand = {
      command,
      timestamp: Date.now(),
      action: 'execute',
      source: 'frontend'
    };
    
    // Send command to frontend via Socket.IO for immediate action
    if (req.app.locals.io) {
      req.app.locals.io.emit('voiceCommand', { 
        command, 
        timestamp: Date.now(),
        action: 'execute',
        source: 'frontend'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Voice command processed successfully',
      command 
    });
  } catch (error) {
    console.error('Process frontend voice command error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

// Stop speaking function
export function stopSpeaking(req, res) {
  try {
    // Stop the voice service speaking
    voiceService.stopSpeaking();
    
    res.json({ 
      success: true, 
      message: 'Speech stopped successfully' 
    });
  } catch (error) {
    console.error('Stop speaking error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}
