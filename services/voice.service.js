/**
 * Development work by David Lane
 */
import { spawn, exec } from 'child_process';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';
import { SpeechClient } from '@google-cloud/speech';
import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
    this.ttsClient = null; // Google Cloud TTS client
    this.recognitionStream = null;
    this.isWindows = process.platform === 'win32';
    this.isSpeaking = false;
    this.speechTimeout = null;
    this.recognitionInterval = null;
  }

  // Initialize voice recognition
  async init() {
    try {
      // Initialize Google Cloud Speech client for both pi and cloud modes
      this.speechClient = new SpeechClient();
      
      // Initialize Google Cloud Text-to-Speech client
      this.ttsClient = new textToSpeech.TextToSpeechClient();
      
      // Test TTS availability
      this.testTTSAvailability();
      
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
        // Silent termination
      }
      this.recognitionProcess = null;
    }
    
    if (this.recognitionStream) {
      this.recognitionStream.destroy();
      this.recognitionStream = null;
    }
    
    if (this.recognitionInterval) {
      clearInterval(this.recognitionInterval);
      this.recognitionInterval = null;
    }
    
    this.speak('🔇 Voice activation disabled. I\'ll stop listening now.');
  }

  // Start voice recognition for Pi mode
  startPiModeRecognition() {
    console.log('Starting Pi mode voice recognition...');
    
    if (this.isWindows) {
      console.log('⚠️ Pi mode voice recognition not available on Windows');
      return;
    }
    
    // Start continuous voice recognition using arecord and Google Speech API
    this.startContinuousRecognition();
    
    console.log('✅ Pi mode voice recognition started');
  }
  
  // Start continuous voice recognition on Pi
  startContinuousRecognition() {
    if (this.recognitionProcess) {
      this.recognitionProcess.kill();
    }
    
    const tempDir = os.tmpdir();
    const audioFile = path.join(tempDir, `voice_${Date.now()}.wav`);
    
    // Record audio continuously and process it
    this.recognitionProcess = spawn('arecord', [
      '-D', 'plughw:1,0',  // Default microphone
      '-f', 'S16_LE',       // 16-bit signed little-endian
      '-c', '1',            // Mono
      '-r', '16000',        // 16kHz sample rate (Google Speech API requirement)
      '-t', 'wav',          // WAV format
      audioFile
    ]);
    
    // Process audio every 3 seconds
    this.recognitionInterval = setInterval(async () => {
      if (fs.existsSync(audioFile)) {
        try {
          const transcript = await this.processAudioFile(audioFile);
          if (transcript && transcript.trim()) {
            console.log('🎤 Pi voice input:', transcript);
            this.processVoiceCommand(transcript);
          }
        } catch (error) {
          console.error('Voice processing error:', error);
        }
        
        // Clean up old audio file
        if (fs.existsSync(audioFile)) {
          fs.unlinkSync(audioFile);
        }
      }
    }, 3000);
  }
  
  // Process audio file with Google Speech API
  async processAudioFile(audioFilePath) {
    if (!this.speechClient) {
      console.log('⚠️ Google Speech API not initialized');
      return null;
    }
    
    try {
      const audioBytes = fs.readFileSync(audioFilePath).toString('base64');
      
      const request = {
        audio: {
          content: audioBytes,
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
      };
      
      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
      
      return transcription;
    } catch (error) {
      console.error('Speech recognition error:', error);
      return null;
    }
  }

  // Start command processor
  startCommandProcessor() {
    // Set up periodic status updates
    this.statusInterval = setInterval(() => {
      if (!this.isListening) {
        clearInterval(this.statusInterval);
        return;
      }
      
      // Keep the voice recognition active
    }, 10000); // Update every 10 seconds
  }

  // Speak using Google Cloud Text-to-Speech (NEW - high quality!)
  async speakWithGoogle(text, voice = 'en-US-Standard-D', options = {}) {
    if (!this.ttsClient) return false;

    const basePitch = Number.isFinite(Number(options.pitch)) ? Number(options.pitch) : 0;
    const speakingRate = Number.isFinite(Number(options.speakingRate))
      ? Number(options.speakingRate)
      : 1.0;
    const youngFemale = options.youngFemale === true;
    const female =
      youngFemale ||
      options.preferFemale === true ||
      String(options.gender || '').toLowerCase() === 'female' ||
      /Neural2-[FGHCE]|Wavenet-[FGH]|Standard-F/i.test(String(voice || ''));

    // Pip youngFemale: bright Neural2-H → Wavenet-H → pitched Standard-F (plain Standard-F sounds matron).
    const voiceChain = [];
    const pushUnique = (name) => {
      if (name && !voiceChain.includes(name)) voiceChain.push(name);
    };
    pushUnique(voice);
    // Non-English requests (e.g. ar-XA for the Jordan guide) must never fall back to an
    // English voice — it would read foreign-script text as gibberish.
    const requestedLanguage = String(voice || '').split('-').slice(0, 2).join('-') || 'en-US';
    const isEnglishRequest = /^en-/i.test(requestedLanguage);
    const isPremiumVoice = /Neural2|Wavenet|Chirp|Studio|Journey/i.test(String(voice || ''));

    if (youngFemale && isEnglishRequest) {
      pushUnique('en-US-Neural2-H');
      pushUnique('en-US-Wavenet-H');
      pushUnique('en-US-Neural2-F');
      pushUnique('en-US-Standard-F');
    } else if (isPremiumVoice && isEnglishRequest) {
      if (female) pushUnique('en-US-Standard-F');
      else pushUnique('en-US-Standard-D');
    } else if (isPremiumVoice) {
      // Same language, plainer tier — e.g. ar-XA-Wavenet-B → ar-XA-Standard-B.
      pushUnique(String(voice).replace(/(Neural2|Wavenet|Chirp|Studio|Journey)/i, 'Standard'));
    }

    for (const voiceName of voiceChain) {
      try {
        const languageCode = String(voiceName || '').split('-').slice(0, 2).join('-') || 'en-US';
        // Standard-F reads mature — bump pitch harder so Pip stays playful
        let pitch = basePitch;
        if (youngFemale && /Standard-F$/i.test(voiceName)) {
          pitch = Math.min(20, Math.max(basePitch, 8.5));
        } else if (youngFemale && /Neural2-H|Wavenet-H/i.test(voiceName)) {
          pitch = Math.min(20, Math.max(basePitch, 5.5));
        }
        const request = {
          input: { text: text },
          voice: {
            languageCode,
            name: voiceName
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch,
            speakingRate: youngFemale ? Math.max(speakingRate, 1.1) : speakingRate
          }
        };

        const [response] = await this.ttsClient.synthesizeSpeech(request);
        return response.audioContent.toString('base64');
      } catch (error) {
        console.error('Google TTS error:', voiceName, error.message || error);
      }
    }
    return null;
  }

  // Speak text using text-to-speech with debounce
  async speak(text) {
    if (!this.sayEnabled) return;
    
    // Prevent overlapping speech
    if (this.isSpeaking) {
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
    
    // TRY GOOGLE CLOUD TTS FIRST (best quality!)
    if (this.ttsClient) {
      try {
        console.log('🎤 Attempting Google Cloud TTS...');
        const audioBase64 = await this.speakWithGoogle(text);
        if (audioBase64) {
          // Success! Google TTS worked - play it on Windows
          console.log('✅ Google TTS succeeded');
          if (this.isWindows) {
            try {
              // Save audio to temp file and play it with Windows media player
              const tmpDir = os.tmpdir();
              const audioPath = path.join(tmpDir, `tts_${Date.now()}.mp3`);
              const buffer = Buffer.from(audioBase64, 'base64');
              fs.writeFileSync(audioPath, buffer);
              
              // Play the audio file
              spawn('powershell', ['-Command', `(New-Object System.Media.SoundPlayer "${audioPath}").PlaySync()`]);
              console.log('🎵 Playing Google TTS audio...');
              return;
            } catch (playError) {
              console.error('Error playing Google TTS audio:', playError);
              // Continue to fallback if playback fails
            }
          } else {
            // On Linux/Pi, play the audio file
            try {
              const tmpDir = os.tmpdir();
              const audioPath = path.join(tmpDir, `tts_${Date.now()}.mp3`);
              const buffer = Buffer.from(audioBase64, 'base64');
              fs.writeFileSync(audioPath, buffer);
              
              // Play the audio file on Linux/Pi
              const mpg123 = spawn('mpg123', ['-q', audioPath]);
              mpg123.on('error', (error) => {
                console.error('mpg123 not available, trying espeak fallback');
                this.tryEspeakTTS(text);
              });
              mpg123.on('close', (code) => {
                if (code === 0) {
                  console.log('🎵 Google TTS audio played successfully');
                } else {
                  console.log('🎵 Google TTS audio playback failed, trying espeak fallback');
                  this.tryEspeakTTS(text);
                }
              });
              console.log('🎵 Playing Google TTS audio on Pi...');
              return;
            } catch (playError) {
              console.error('Error playing Google TTS audio on Pi:', playError);
              // Continue to fallback if playback fails
            }
          }
        }
      } catch (error) {
        // Silently fall back to local TTS - don't show error for Pi deployments
        console.log('⚠️  Google TTS not available, using local TTS');
        // Fall through to local TTS
      }
    }
    // Fallback to local TTS methods
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
              
              // Try alternative method with espeak if available
              this.tryEspeakFallback(text);
            }
            
          });
        } catch (error) {
          console.error('Windows text-to-speech not available:', error.message);
          this.tryEspeakFallback(text);
        }
      } else {
        // Use espeak on Linux Pi for better performance
        this.tryEspeakTTS(text);
      }
    } else {
      // Cloud mode - prefer web TTS; only use espeak on non-Windows hosts
      if (!this.isWindows) {
        this.tryEspeakTTS(text);
      }

      // Also try web-based TTS as a fallback for cloud deployments
      this.tryWebTTS(text);
    }
  }

  // Process voice commands
  processCommand(command) {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Find matching command
    let matchedCommand = null;
    for (const [key, aliases] of Object.entries(voiceCommands)) {
      if (aliases.some(alias => normalizedCommand.includes(alias))) {
        matchedCommand = key;
        break;
      }
    }
    
    if (matchedCommand) {
      this.commandHistory.push({
        command: matchedCommand,
        original: normalizedCommand,
        timestamp: Date.now()
      });
      
      if (this.onCommand) {
        this.onCommand(matchedCommand);
      }
    } else {
      this.speak(`I didn't understand "${normalizedCommand}". Say "help" for available commands.`);
    }
  }

  // Process voice commands from frontend (for Pi mode compatibility)
  processFrontendCommand(command) {
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
    if (this.isWindows) {
      console.log('🎤 espeak skipped on Windows');
      console.log('🎤 Voice feedback:', text);
      return;
    }
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
    console.log('🎤 Windows fallback: console only');
    console.log('🎤 Voice feedback:', text);
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
    console.log('🎤 PRIMARY: Google Cloud Text-to-Speech (best quality)');
    
    if (this.isWindows) {
      console.log('🎤 FALLBACK: Windows PowerShell TTS');
    } else {
      console.log('🎤 FALLBACK: Linux espeak TTS');
      
      // Test if espeak is available
      const testEspeak = spawn('espeak', ['--version']);
      testEspeak.on('error', (error) => {
        console.log('🎤 espeak not available:', error.message);
        console.log('🎤 FALLBACK 2: Console logging only');
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
