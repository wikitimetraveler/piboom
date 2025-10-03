import { spawn, exec } from 'child_process';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';
import { SpeechClient } from '@google-cloud/speech';

let isListening = false;
let recognitionProcess = null;
let voiceCommands = {
  'play': ['play', 'start', 'begin', 'go'],
  'pause': ['pause', 'halt', 'wait'],
  'stop': ['stop', 'stop speaking', 'be quiet', 'shut up', 'silence'],
  'next': ['next', 'skip', 'forward', 'advance'],
  'previous': ['previous', 'back', 'rewind', 'last'],
  'volume up': ['volume up', 'louder', 'turn up', 'increase volume'],
  'volume down': ['volume down', 'quieter', 'turn down', 'decrease volume'],
  'what song': ['what song', 'what track', 'what is playing', 'current song'],
  'help': ['help', 'commands', 'what can you do', 'voice commands']
};

export class VoiceService {
  constructor() {
    this.isListening = false;
    this.recognitionProcess = null;
    this.onCommand = null;
    this.sayEnabled = true;
    this.audioBuffer = [];
    this.commandHistory = [];
    this.speechClient = null;
    this.recognitionStream = null;
    this.isWindows = process.platform === 'win32';
    this.isSpeaking = false;
    this.speechTimeout = null;
  }

  // Initialize voice recognition
  async init() {
    console.log('VoiceService.init() called');
    console.log('Platform:', process.platform);
    console.log('Mode:', config.mode);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Render URL:', process.env.RENDER_EXTERNAL_URL || 'not set');
    
    try {
      // Initialize Google Cloud Speech client for both pi and cloud modes
      this.speechClient = new SpeechClient();
      console.log('✅ Google Cloud Speech client initialized');
      
      // Test TTS availability
      console.log('🎤 Testing TTS availability...');
      this.testTTSAvailability();
      
      if (config.mode === 'pi') {
        console.log('✅ Voice activation ready for Pi mode');
      } else {
        console.log('✅ Voice activation ready for Cloud mode');
      }
      return true;
    } catch (error) {
      console.error('Voice activation initialization error:', error.message);
      console.error('Full error:', error);
      return false;
    }
  }

  // Start listening for voice commands
  startListening(onCommand) {
    if (this.isListening) return;
    
    this.onCommand = onCommand;
    this.isListening = true;
    
    if (config.mode === 'pi') {
      this.startPiModeRecognition();
    } else {
      // Cloud mode - frontend handles voice recognition
      console.log('✅ Cloud mode voice recognition ready - frontend will handle voice input');
    }
    
    this.speak('🎤 Voice activation enabled! I\'m listening for your commands. Say "help" to see what you can do!');
  }

  // Stop listening for voice commands
  stopListening() {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    if (this.recognitionProcess) {
      try {
        this.recognitionProcess.kill('SIGTERM');
      } catch (error) {
        console.log('Process termination:', error.message);
      }
      this.recognitionProcess = null;
    }
    
    if (this.recognitionStream) {
      this.recognitionStream.destroy();
      this.recognitionStream = null;
    }
    
    this.speak('🔇 Voice activation disabled. I\'ll stop listening now.');
  }

  // Start voice recognition for Pi mode (simplified)
  startPiModeRecognition() {
    console.log('Starting Pi mode voice recognition...');
    
    // In Pi mode, we'll use a simple command processor
    // The frontend Web Speech API will handle voice recognition
    // This backend will process the commands and provide feedback
    
    console.log('✅ Pi mode voice recognition started');
    
    // Set up a simple command processor
    this.startCommandProcessor();
  }

  // Start command processor
  startCommandProcessor() {
    console.log('🎯 Command processor ready');
    
    // Set up periodic status updates
    this.statusInterval = setInterval(() => {
      if (!this.isListening) {
        clearInterval(this.statusInterval);
        return;
      }
      
      // Keep the voice recognition active
      console.log('🎤 Pi mode voice recognition active...');
    }, 10000); // Update every 10 seconds
  }

  // Speak text using text-to-speech with debounce
  speak(text) {
    if (!this.sayEnabled) return;
    
    // Prevent overlapping speech
    if (this.isSpeaking) {
      console.log('🎤 Already speaking, skipping:', text);
      return;
    }
    
    // Clear any existing speech timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
    }
    
    // Set speaking flag and timeout
    this.isSpeaking = true;
    this.speechTimeout = setTimeout(() => {
      this.isSpeaking = false;
    }, 5000); // 5 second speech timeout
    
    console.log('🎤 Attempting to speak:', text);
    console.log('🎤 Platform:', process.platform);
    console.log('🎤 Mode:', config.mode);
    
    if (config.mode === 'pi') {
      if (this.isWindows) {
        // Use Windows built-in text-to-speech with better error handling
        try {
          // Clean the text for Windows TTS - be more conservative with cleaning
          const cleanText = text
            .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove special characters that might cause issues
            .replace(/'/g, "''") // Escape single quotes
            .replace(/"/g, '""') // Escape double quotes
            .substring(0, 500); // Increased limit for better coverage
          
          // Use a simpler PowerShell command that we know works
          const command = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${cleanText}')"`;
          
          console.log('🎤 Executing Windows TTS command...');
          console.log('🎤 Text to speak:', cleanText);
          
          exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
              console.error('Windows text-to-speech failed:', error.message);
              console.log('🎤 Voice feedback (fallback):', text);
              
              // Try alternative method with espeak if available
              this.tryEspeakFallback(text);
            } else {
              console.log('🎤 Windows text-to-speech successful!');
            }
            
          });
        } catch (error) {
          console.error('Windows text-to-speech not available:', error.message);
          console.log('🎤 Voice feedback (fallback):', text);
          this.tryEspeakFallback(text);
        }
      } else {
        // Use espeak on Linux Pi for better performance
        this.tryEspeakTTS(text);
      }
    } else {
      // Cloud mode - try espeak first, then fallback to web TTS or console
      console.log('🎤 Cloud mode - attempting espeak TTS...');
      this.tryEspeakTTS(text);
      
      // Also try web-based TTS as a fallback for cloud deployments
      this.tryWebTTS(text);
      
    }
  }

  // Process voice commands
  processCommand(command) {
    const normalizedCommand = command.toLowerCase().trim();
    console.log('Processing command:', normalizedCommand);
    
    // Find matching command
    let matchedCommand = null;
    for (const [key, aliases] of Object.entries(voiceCommands)) {
      if (aliases.some(alias => normalizedCommand.includes(alias))) {
        matchedCommand = key;
        break;
      }
    }
    
    if (matchedCommand) {
      console.log('✅ Command matched:', matchedCommand);
      this.commandHistory.push({
        command: matchedCommand,
        original: normalizedCommand,
        timestamp: Date.now()
      });
      
      if (this.onCommand) {
        this.onCommand(matchedCommand);
      }
    } else {
      console.log('❌ Command not recognized:', normalizedCommand);
      this.speak(`I didn't understand "${normalizedCommand}". Say "help" for available commands.`);
    }
  }

  // Process voice commands from frontend (for Pi mode compatibility)
  processFrontendCommand(command) {
    console.log('🎤 Frontend voice command received:', command);
    
    // Process the command using the same logic
    this.processCommand(command);
    
    // Provide voice feedback only if enabled
    if (this.sayEnabled) {
      this.speak(`Command received: ${command}`);
    }
  }

  // Get command history
  getCommandHistory() {
    return this.commandHistory;
  }

  // Clear command history
  clearCommandHistory() {
    this.commandHistory = [];
  }

  // Enable/disable voice feedback
  setVoiceFeedback(enabled) {
    this.sayEnabled = enabled;
    console.log(`Voice feedback ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Try espeak TTS with proper error handling
  tryEspeakTTS(text) {
    try {
      console.log('🎤 Attempting espeak TTS...');
      
      // Clean text for espeak
      const cleanText = text
        .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove special characters
        .substring(0, 500); // Increased limit for better coverage
      
      const espeak = spawn('espeak', [cleanText, '--stdout']);
      
      // Try to pipe to aplay if available (Linux)
      const aplay = spawn('aplay', ['-f', 'S16_LE', '-r', '22050', '-c', '1']);
      
      espeak.stdout.pipe(aplay.stdin);
      
      espeak.on('error', (error) => {
        console.log('🎤 espeak not available, falling back to console');
        console.log('🎤 Voice feedback:', text);
      });
      
      espeak.on('close', (code) => {
        if (code === 0) {
          console.log('🎤 espeak TTS successful!');
        } else {
          console.log('🎤 espeak TTS failed with code:', code);
          console.log('🎤 Voice feedback (fallback):', text);
        }
      });
      
      aplay.on('error', (error) => {
        console.log('🎤 aplay not available, espeak audio will not play');
        console.log('🎤 Voice feedback:', text);
      });
      
    } catch (error) {
      console.log('🎤 espeak TTS failed:', error.message);
      console.log('🎤 Voice feedback:', text);
    }
  }

  // Try web-based TTS for cloud deployments
  tryWebTTS(text) {
    try {
      console.log('🎤 Attempting web-based TTS for cloud deployment...');
      
      // For cloud deployments, we'll use a simple approach:
      // 1. Log the text (always works)
      // 2. Try to use the browser's Web Speech API via frontend
      // 3. Provide clear feedback about TTS availability
      
      console.log('🎤 Voice feedback (cloud mode):', text);
      
      // In cloud mode, the frontend can handle TTS using Web Speech API
      // This is more reliable than trying to install espeak on cloud platforms
      
    } catch (error) {
      console.log('🎤 Web TTS failed:', error.message);
      console.log('🎤 Voice feedback:', text);
    }
  }

  // Try espeak as fallback on Windows
  tryEspeakFallback(text) {
    try {
      console.log('🎤 Trying espeak fallback...');
      const espeak = spawn('espeak', [text, '--stdout']);
      const aplay = spawn('aplay', ['-f', 'S16_LE', '-r', '22050', '-c', '1']);
      
      espeak.stdout.pipe(aplay.stdin);
      
      espeak.on('error', (error) => {
        console.log('espeak not available, using console fallback');
        console.log('🎤 Voice feedback:', text);
      });
      
      aplay.on('error', (error) => {
        console.log('aplay not available, using console fallback');
        console.log('🎤 Voice feedback:', text);
      });
    } catch (error) {
      console.log('espeak fallback failed:', error.message);
      console.log('🎤 Voice feedback:', text);
    }
  }

  // Speak longer text in chunks
  speakChunked(text) {
    if (!this.sayEnabled) return;
    
    // Stop any existing chunked speech
    this.stopChunkedSpeech();
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) {
      this.speak(text);
      return;
    }
    
    // Store chunk timeouts so we can cancel them
    this.chunkTimeouts = [];
    
    // Speak first sentence immediately
    this.speak(sentences[0].trim());
    
    // Speak remaining sentences with delay
    sentences.slice(1).forEach((sentence, index) => {
      const timeout = setTimeout(() => {
        // Check if we're still supposed to be speaking
        if (this.sayEnabled && !this.isSpeaking) {
          this.speak(sentence.trim());
        }
      }, (index + 1) * 3000); // 3 second delay between chunks
      
      this.chunkTimeouts.push(timeout);
    });
  }

  // Stop chunked speech
  stopChunkedSpeech() {
    if (this.chunkTimeouts) {
      this.chunkTimeouts.forEach(timeout => clearTimeout(timeout));
      this.chunkTimeouts = [];
    }
  }

  // Test TTS availability
  testTTSAvailability() {
    console.log('🎤 Testing TTS availability...');
    
    if (this.isWindows) {
      console.log('🎤 Windows platform detected - will use PowerShell TTS');
    } else {
      console.log('🎤 Linux platform detected - will try espeak');
      
      // Test if espeak is available
      const testEspeak = spawn('espeak', ['--version']);
      testEspeak.on('error', (error) => {
        console.log('🎤 espeak not available:', error.message);
        console.log('🎤 Will use console fallback for TTS');
      });
      testEspeak.on('close', (code) => {
        if (code === 0) {
          console.log('🎤 espeak is available and working');
        } else {
          console.log('🎤 espeak test failed with code:', code);
        }
      });
    }
  }

  // Stop speaking immediately
  stopSpeaking() {
    console.log('🛑 VoiceService: Stopping speech...');
    
    // Clear speaking flag immediately
    this.isSpeaking = false;
    
    // Clear any speech timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    
    // Stop any chunked speech
    this.stopChunkedSpeech();
    
    // On Windows, try to stop any running PowerShell TTS processes
    if (this.isWindows) {
      try {
        // Kill any running PowerShell processes that might be doing TTS
        exec('taskkill /f /im powershell.exe /fi "WINDOWTITLE eq *"', (error, stdout, stderr) => {
          if (error) {
            // Ignore errors - process might not exist
            console.log('🛑 No PowerShell TTS processes to stop');
          } else {
            console.log('🛑 PowerShell TTS processes stopped');
          }
        });
      } catch (error) {
        console.log('🛑 Error stopping PowerShell processes:', error.message);
      }
    } else {
      // On Linux/Pi, try to stop espeak processes
      try {
        exec('pkill -f espeak', (error, stdout, stderr) => {
          if (error) {
            console.log('🛑 No espeak processes to stop');
          } else {
            console.log('🛑 espeak processes stopped');
          }
        });
      } catch (error) {
        console.log('🛑 Error stopping espeak processes:', error.message);
      }
    }
    
    console.log('🛑 VoiceService: Speech stopped successfully');
  }

  // Get current status
  getStatus() {
    return {
      isListening: this.isListening,
      isInitialized: !!this.speechClient,
      voiceFeedbackEnabled: this.sayEnabled,
      commandHistoryLength: this.commandHistory.length,
      mode: config.mode,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    };
  }

}

export default VoiceService;
