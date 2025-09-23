import { spawn, exec } from 'child_process';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';
import { SpeechClient } from '@google-cloud/speech';

let isListening = false;
let recognitionProcess = null;
let voiceCommands = {
  'play': ['play', 'start', 'begin', 'go'],
  'pause': ['pause', 'stop', 'halt', 'wait'],
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
  }

  // Initialize voice recognition
  async init() {
    console.log('VoiceService.init() called');
    console.log('Platform:', process.platform);
    console.log('Mode:', config.mode);
    
    if (config.mode === 'pi') {
      try {
        // Initialize Google Cloud Speech client
        this.speechClient = new SpeechClient();
        console.log('✅ Google Cloud Speech client initialized');
        
        // For Pi mode, we'll use a simplified approach that works on both Windows and Linux
        console.log('✅ Voice activation ready for Pi mode');
        return true;
      } catch (error) {
        console.error('Voice activation initialization error:', error.message);
        return false;
      }
    } else {
      console.log('Voice activation not available in current mode');
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

  // Speak text using text-to-speech
  speak(text) {
    if (!this.sayEnabled) return;
    
    if (config.mode === 'pi') {
      if (this.isWindows) {
        // Use Windows built-in text-to-speech with better error handling
        try {
          // Clean the text for Windows TTS
          const cleanText = text
            .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove special characters that might cause issues
            .replace(/'/g, "''") // Escape single quotes
            .replace(/"/g, '""') // Escape double quotes
            .substring(0, 200); // Shorter limit for better reliability
          
          // Use a simpler PowerShell command
          const command = `powershell -Command "& {Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${cleanText}')}"`;
          
          console.log('🎤 Executing Windows TTS command...');
          console.log('🎤 Text to speak:', cleanText);
          
          exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
              console.log('Windows text-to-speech failed:', error.message);
              console.log('🎤 Voice feedback (fallback):', text);
              
              // Try alternative method with espeak if available
              this.tryEspeakFallback(text);
            } else {
              console.log('🎤 Windows text-to-speech successful!');
            }
          });
        } catch (error) {
          console.log('Windows text-to-speech not available:', error.message);
          console.log('🎤 Voice feedback (fallback):', text);
          this.tryEspeakFallback(text);
        }
      } else {
        // Use espeak on Linux Pi for better performance
        const espeak = spawn('espeak', [text, '--stdout']);
        const aplay = spawn('aplay', ['-f', 'S16_LE', '-r', '22050', '-c', '1']);
        
        espeak.stdout.pipe(aplay.stdin);
        
        espeak.on('error', (error) => {
          console.log('espeak not available, falling back to console log');
          console.log('🎤 Voice feedback:', text);
        });
      }
    } else {
      // Fallback for other platforms
      console.log('🎤 Voice feedback:', text);
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
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) {
      this.speak(text);
      return;
    }
    
    // Speak first sentence immediately
    this.speak(sentences[0].trim());
    
    // Speak remaining sentences with delay
    sentences.slice(1).forEach((sentence, index) => {
      setTimeout(() => {
        this.speak(sentence.trim());
      }, (index + 1) * 3000); // 3 second delay between chunks
    });
  }

  // Get current status
  getStatus() {
    return {
      isListening: this.isListening,
      isInitialized: !!this.speechClient,
      voiceFeedbackEnabled: this.sayEnabled,
      commandHistoryLength: this.commandHistory.length,
      mode: config.mode
    };
  }
}

export default VoiceService;
