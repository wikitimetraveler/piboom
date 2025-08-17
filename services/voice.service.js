import { spawn } from 'child_process';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';
import say from 'say'; // Enable text-to-speech for Windows development

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
  }

  // Initialize voice recognition
  async init() {
    console.log('VoiceService.init() called');
    console.log('Platform:', process.platform);
    console.log('Config mode:', config.mode);
    
    // Allow voice service in both Windows (dev) and Pi (production) modes
    if (config.mode === 'cloud' || config.mode === 'pi') {
      console.log('Voice activation available in current mode');
      
      // Skip dependency checks on Windows for development
      if (process.platform === 'win32') {
        console.log('Windows development mode - skipping system dependency checks');
        return true;
      }
      
      try {
        console.log('Checking dependencies...');
        // Check if required system tools are available
        await this.checkDependencies();
        console.log('Dependencies check passed');
        return true;
      } catch (error) {
        console.error('Voice activation dependencies not met:', error.message);
        return false;
      }
    } else {
      console.log('Voice activation not available in current mode');
      return false;
    }
  }

  // Check if required system dependencies are available
  async checkDependencies() {
    try {
      // Check for arecord (audio recording)
      await run('which', ['arecord']);
      // Check for sox (audio processing)
      await run('which', ['sox']);
      return true;
    } catch (error) {
      throw new Error('Missing audio recording tools. Install: sudo apt-get install sox');
    }
  }

  // Start listening for voice commands
  startListening(onCommand) {
    if (this.isListening) return;
    
    this.onCommand = onCommand;
    this.isListening = true;
    
    if (config.mode === 'pi' && process.platform !== 'win32') {
      this.startPiRecognition();
    } else if (process.platform === 'win32') {
      // Windows development mode - simulate voice recognition
      this.startWindowsSimulation();
    }
    
    this.speak('🎤 Voice activation enabled! I\'m listening for your commands. Say "help" to see what you can do!');
  }

  // Stop listening for voice commands
  stopListening() {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    if (this.recognitionProcess) {
      this.recognitionProcess.kill('SIGKILL');
      this.recognitionProcess = null;
    }
    
    this.speak('🔇 Voice activation disabled. I\'ll stop listening now.');
  }

  // Start Windows simulation for development
  startWindowsSimulation() {
    console.log('Starting Windows voice simulation for development');
    
    // Use a predictable sequence of commands for testing
    const testCommands = ['play', 'pause', 'volume up', 'volume down', 'what song', 'help'];
    let commandIndex = 0;
    
    // Simulate voice commands every 5 seconds for testing
    const simulateCommands = () => {
      if (!this.isListening) return;
      
      const command = testCommands[commandIndex % testCommands.length];
      commandIndex++;
      
      console.log('Simulated voice command:', command);
      
      if (this.onCommand) {
        this.onCommand(command);
      }
      
      // Schedule next simulation
      if (this.isListening) {
        setTimeout(simulateCommands, 5000);
      }
    };
    
    // Start simulation after 2 seconds
    setTimeout(simulateCommands, 2000);
  }

  // Start voice recognition on Pi using system tools
  startPiRecognition() {
    if (this.recognitionProcess) return;

    // Use arecord to capture audio and pipe to sox for processing
    const arecord = spawn('arecord', [
      '-f', 'S16_LE',  // 16-bit signed little-endian
      '-r', '16000',   // 16kHz sample rate
      '-c', '1',       // Mono channel
      '-D', 'default', // Default audio device
      '--duration=5'   // Record in 5-second chunks
    ]);

    const sox = spawn('sox', [
      '-t', 'raw',     // Raw audio input
      '-r', '16000',   // 16kHz sample rate
      '-s', '2',       // 16-bit signed
      '-c', '1',       // Mono
      '-',            // Input from stdin
      '-t', 'wav',    // Output as WAV
      '-',            // Output to stdout
      'trim', '0', '5' // Trim to 5 seconds
    ]);

    arecord.stdout.pipe(sox.stdin);

    sox.stdout.on('data', (data) => {
      // Process audio data and attempt to recognize speech
      this.processAudioChunk(data);
    });

    sox.stderr.on('data', (data) => {
      console.log('Sox stderr:', data.toString());
    });

    arecord.stderr.on('data', (data) => {
      console.log('Arecord stderr:', data.toString());
    });

    this.recognitionProcess = { arecord, sox };
  }

  // Process audio chunk and attempt speech recognition
  async processAudioChunk(audioData) {
    // For now, we'll use a simple approach
    // In a full implementation, you'd send this to Google Speech API or similar
    
    // Use the same predictable command sequence for Pi mode
    this.simulatePiCommandRecognition();
  }

  // Simulate command recognition for Pi mode (replace with actual speech-to-text)
  simulatePiCommandRecognition() {
    // Use the same predictable sequence as Windows for consistency
    const testCommands = ['play', 'pause', 'volume up', 'volume down', 'what song', 'help'];
    let commandIndex = 0;
    
    const simulateCommands = () => {
      if (!this.isListening) return;
      
      const command = testCommands[commandIndex % testCommands.length];
      commandIndex++;
      
      console.log('Pi simulated voice command:', command);
      
      if (this.onCommand) {
        this.onCommand(command);
      }
      
      // Schedule next simulation
      if (this.isListening) {
        setTimeout(simulateCommands, 5000);
      }
    };
    
    // Start simulation after 2 seconds
    setTimeout(simulateCommands, 2000);
  }

  // Speak text using text-to-speech
  speak(text) {
    if (!this.sayEnabled) return;
    
    if (config.mode === 'pi' && process.platform !== 'win32') {
      // Use espeak on Pi for better performance
      const espeak = spawn('espeak', [text, '--stdout']);
      const aplay = spawn('aplay', ['-f', 'S16_LE', '-r', '22050', '-c', '1']);
      
      espeak.stdout.pipe(aplay.stdin);
      
      espeak.on('error', (error) => {
        console.log('espeak not available, falling back to console log');
        console.log('🎤 Voice feedback:', text);
      });
    } else if (process.platform === 'win32') {
      // Windows development mode - use say package for actual speech
      try {
        say.speak(text, undefined, 1.0, (err) => {
          if (err) {
            console.log('Say package error, falling back to console log:', err);
            console.log('🎤 Voice feedback:', text);
          }
        });
      } catch (error) {
        console.log('Say package not available, falling back to console log:', error);
        console.log('🎤 Voice feedback:', text);
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
    
    // Find matching command with exact matching first
    for (const [action, keywords] of Object.entries(voiceCommands)) {
      // Check for exact match first
      if (normalizedCommand === action) {
        console.log('Exact match found:', action);
        this.executeCommand(action);
        return action;
      }
      
      // Check for keyword match
      if (keywords.some(keyword => normalizedCommand === keyword)) {
        console.log('Keyword match found:', action, 'for keyword:', keyword);
        this.executeCommand(action);
        return action;
      }
    }
    
    // No match found
    console.log('No match found for command:', normalizedCommand);
    this.speak('Command not recognized. Say help for available commands.');
    return null;
  }

  // Execute the recognized command
  executeCommand(action) {
    let feedbackMessage = '';
    
    switch (action) {
      case 'play':
        feedbackMessage = '🎵 Playing music now!';
        break;
      case 'pause':
        feedbackMessage = '⏸️ Music paused!';
        break;
      case 'next':
        feedbackMessage = '⏭️ Next track!';
        break;
      case 'previous':
        feedbackMessage = '⏮️ Previous track!';
        break;
      case 'volume up':
        feedbackMessage = '🔊 Volume increased!';
        break;
      case 'volume down':
        feedbackMessage = '🔉 Volume decreased!';
        break;
      case 'what song':
        feedbackMessage = '🎤 Checking current song...';
        break;
      case 'help':
        feedbackMessage = '💡 Available commands: play, pause, next, previous, volume up, volume down, what song, and help!';
        break;
      default:
        feedbackMessage = `Executing ${action}`;
    }
    
    this.speak(feedbackMessage);
    
    if (this.onCommand) {
      this.onCommand(action);
    }
  }

  // Get available voice commands
  getAvailableCommands() {
    return Object.keys(voiceCommands);
  }

  // Toggle voice feedback
  toggleVoiceFeedback() {
    this.sayEnabled = !this.sayEnabled;
    if (this.sayEnabled) {
      this.speak('🔊 Voice feedback enabled! I\'ll speak back to you!');
    } else {
      this.speak('🔇 Voice feedback disabled. I\'ll be quiet now.');
    }
    return this.sayEnabled;
  }

  // Cleanup
  cleanup() {
    this.stopListening();
  }
}

export default VoiceService;
