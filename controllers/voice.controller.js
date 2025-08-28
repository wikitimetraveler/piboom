import VoiceService from '../services/voice.service.js';

const voiceService = new VoiceService();
let isInitialized = false;
let lastVoiceCommand = null;

// Execute voice commands with server-side actions
function executeVoiceCommand(command) {
  console.log('Executing voice command:', command);
  
  // Store the last command for fallback communication
  lastVoiceCommand = {
    command,
    timestamp: Date.now(),
    action: 'execute'
  };
  
  switch (command) {
    case 'play':
      console.log('🎵 Voice command: Starting playback');
      break;
      
    case 'pause':
      console.log('⏸️ Voice command: Pausing playback');
      break;
      
    case 'volume up':
      console.log('🔊 Voice command: Increasing volume');
      break;
      
    case 'volume down':
      console.log('🔉 Voice command: Decreasing volume');
      break;
      
    case 'what song':
      console.log('🎤 Voice command: Announcing current song');
      break;
      
    case 'help':
      console.log('❓ Voice command: Showing help');
      break;
      
    default:
      console.log('❓ Voice command not recognized:', command);
  }
}

export async function initVoice(req, res) {
  console.log('Voice init endpoint called');
  try {
    console.log('Current initialization status:', isInitialized);
    if (!isInitialized) {
      console.log('Attempting to initialize voice service...');
      const success = await voiceService.init();
      console.log('Voice service init result:', success);
      isInitialized = success;
      
      if (success) {
        console.log('Voice service initialized successfully');
        res.json({ 
          success: true, 
          message: 'Voice service initialized successfully',
          available: true
        });
      } else {
        console.log('Voice service not available');
        res.json({ 
          success: false, 
          message: 'Voice service not available in current mode',
          available: false
        });
      }
    } else {
      console.log('Voice service already initialized');
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
  console.log('startVoice endpoint called');
  try {
    voiceService.startListening((command) => {
      console.log('Voice command recognized:', command);
      executeVoiceCommand(command);
      
      // Send command to frontend via Socket.IO for immediate action
      if (req.app.locals.io) {
        console.log('Emitting voice command to frontend:', command);
        req.app.locals.io.emit('voiceCommand', { 
          command, 
          timestamp: Date.now(),
          action: 'execute'
        });
      } else {
        console.log('Socket.IO not available for frontend communication');
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Voice activation started',
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
  console.log('stopVoice endpoint called');
  try {
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
    
    voiceService.speak(text);
    
    res.json({ 
      success: true, 
      message: 'Text spoken successfully',
      text 
    });
  } catch (error) {
    console.error('Speak text error:', error);
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
    
    console.log('🎤 Frontend voice command received:', command);
    
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
      console.log('Emitting frontend voice command to frontend:', command);
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
