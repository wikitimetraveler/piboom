/**
 * Voice Control System
 *
 * @file        voiceController.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * Provides shared voice navigation and speech synthesis across the finance hub.
 */
class VoiceController {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.voiceBtn = document.getElementById('voiceBtn');
    this.voiceStatus = document.getElementById('voiceStatus');
    this.voiceHelp = document.getElementById('voiceHelp');
    this.isInitialized = false;
    
    this.toolCommands = {
      'calculator': '/finance/fha-streamline-calculator.html',
      'parser': '/finance/tool2.html',
      'mashup': '/finance/tool3.html',
      'automator': '/finance/tool4.html',
      'ruler': '/finance/tool5.html',
      'transformer': '/finance/tool6.html',
      'alchemist': '/finance/tool8.html'
    };
    
    // Initialize voice control lazily when first needed
    this.setupEventListeners();
  }
  
  async init() {
    // Check if browser supports speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.setupRecognition();
        this.isInitialized = true;
      } catch (error) {
        console.error('Speech recognition initialization failed:', error);
        this.voiceStatus.textContent = 'Voice not available';
        this.voiceBtn.disabled = true;
        this.voiceBtn.style.opacity = '0.5';
      }
    } else {
      this.voiceStatus.textContent = 'Voice not supported';
      this.voiceBtn.disabled = true;
      this.voiceBtn.style.opacity = '0.5';
    }
  }
  
  setupRecognition() {
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      this.isListening = true;
      this.voiceBtn.classList.add('listening');
      this.voiceBtn.innerHTML = '<i class="bi-mic-mute"></i>';
      this.updateStatus('Listening...', true);
    };
    
    this.recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      this.processCommand(command);
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.updateStatus('Error: ' + event.error, false);
      this.stopListening();
    };
    
    this.recognition.onend = () => {
      this.stopListening();
    };
  }
  
  setupEventListeners() {
    this.voiceBtn.addEventListener('click', async () => {
      if (!this.isInitialized) {
        await this.init();
      }
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
    
    // Keyboard shortcut for voice control
    document.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        if (!this.isInitialized) {
          await this.init();
        }
        if (this.isListening) {
          this.stopListening();
        } else {
          this.startListening();
        }
      }
    });
  }
  
  startListening() {
    if (!this.isInitialized) {
      this.updateStatus('Voice control not ready', false);
      return;
    }
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.updateStatus('Error starting voice control', false);
    }
  }
  
  stopListening() {
    this.isListening = false;
    this.voiceBtn.classList.remove('listening');
    this.voiceBtn.innerHTML = '<i class="bi-mic"></i>';
    this.updateStatus('Click to start voice control');
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }
  
  updateStatus(message, isListening = false) {
    this.voiceStatus.textContent = message;
    this.voiceStatus.classList.toggle('show', true);
    this.voiceStatus.classList.toggle('listening', isListening);
    
    setTimeout(() => {
      this.voiceStatus.classList.remove('show');
    }, 3000);
  }
  
  processCommand(command) {
    console.log('Voice command received:', command);
    
    // Tool navigation commands
    for (const [tool, url] of Object.entries(this.toolCommands)) {
      if (command.includes(`open ${tool}`) || command.includes(`go to ${tool}`) || command.includes(`navigate to ${tool}`)) {
        this.speak(`Opening ${tool}`);
        setTimeout(() => {
          window.location.href = url;
        }, 1000);
        return;
      }
    }
    
    // Calculator-specific commands (for tool1)
    if (window.location.pathname.includes('tool1')) {
      if (command.includes('calculate') || command.includes('run calculations')) {
        this.speak('Running calculations');
        if (typeof fhaCalculator !== 'undefined') {
          fhaCalculator.calculateAll();
        }
        return;
      }
      
      if (command.includes('run audit') || command.includes('audit')) {
        this.speak('Running audit tests');
        if (typeof fhaAudit !== 'undefined') {
          fhaAudit.runAllAuditTests();
        }
        return;
      }
      
      if (command.includes('load scenarios') || command.includes('load sample data')) {
        this.speak('Loading sample scenarios');
        if (typeof populateScenarios === 'function') {
          populateScenarios();
        }
        return;
      }
      
      if (command.includes('clear all') || command.includes('clear fields')) {
        this.speak('Clearing all fields');
        // Clear all calculator inputs
        const inputs = document.querySelectorAll('.calculator-input');
        inputs.forEach(input => {
          input.value = '';
        });
        return;
      }
      
      if (command.includes('go home') || command.includes('home')) {
        this.speak('Returning to main menu');
        setTimeout(() => {
          window.location.href = '../../index.html';
        }, 1000);
        return;
      }
    }
    
    // Help commands
    if (command.includes('show help') || command.includes('help')) {
      this.showHelp();
      this.speak('Showing voice commands help');
      return;
    }
    
    if (command.includes('hide help')) {
      this.hideHelp();
      this.speak('Hiding help');
      return;
    }
    
    // General navigation (for homepage)
    if (command.includes('go home') || command.includes('home')) {
      this.speak('You are already on the home page');
      return;
    }
    
    // Unknown command
    this.speak('Command not recognized. Say "show help" for available commands');
    this.updateStatus('Command not recognized');
  }
  
  speak(text) {
    if (this.synthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      this.synthesis.speak(utterance);
    }
  }
  
  showHelp() {
    this.voiceHelp.classList.add('show');
  }
  
  hideHelp() {
    this.voiceHelp.classList.remove('show');
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceController;
} 