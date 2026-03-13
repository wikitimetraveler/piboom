/**
 * Global Voice Activation Widget
 * 
 * @file       voice-widget.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Global voice control widget that adds voice activation capabilities to any
 * page with a floating microphone button. Provides hands-free navigation and
 * command execution through speech recognition API.
 * 
 * Features:
 * - Floating microphone button (customizable position)
 * - Speech recognition integration
 * - Customizable command handlers
 * - Multiple theme options (blue, green, gold)
 * - Visual feedback during listening
 * - Command execution callbacks
 * 
 * Configuration:
 * - Position: bottom-right, bottom-left, top-right, top-left
 * - Theme: blue, green, gold
 * - Button size: customizable
 * - Custom command handler function
 * 
 * Technical Implementation:
 * - Web Speech API (SpeechRecognition)
 * - Floating action button (FAB) pattern
 * - CSS animations for visual feedback
 * - Event-driven command processing
 * - Browser compatibility handling
 * 
 * Browser Support:
 * - Requires Web Speech API support
 * - Chrome, Edge (Chromium), Safari
 * - Fallback messaging for unsupported browsers
 * 
 * Usage:
 * const widget = new VoiceWidget({
 *   position: 'bottom-right',
 *   theme: 'blue',
 *   onCommand: (command) => { console.log(command); }
 * });
 * 
 * ==============================================================================
 */

class VoiceWidget {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'bottom-right', // bottom-right, bottom-left, top-right, top-left
      theme: options.theme || 'blue', // blue, green, gold
      onCommand: options.onCommand || this.defaultCommandHandler,
      buttonSize: options.buttonSize || 60,
      ...options
    };
    
    this.recognition = null;
    this.isListening = false;
    this.init();
  }

  init() {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Voice recognition not supported in this browser');
      return;
    }
    
    // Create the floating button
    this.createButton();

    // Initialize speech recognition
    this.initSpeechRecognition();
  }

  createButton() {
    const themes = {
      blue: { color: 'rgba(135, 206, 250, 0.9)', glow: 'rgba(135, 206, 250, 0.5)' },
      green: { color: 'rgba(139, 187, 166, 0.9)', glow: 'rgba(139, 187, 166, 0.5)' },
      gold: { color: 'rgba(212, 175, 55, 0.9)', glow: 'rgba(212, 175, 55, 0.5)' }
    };

    const theme = themes[this.options.theme] || themes.blue;

    const positions = {
      'bottom-right': 'bottom: 30px; right: 30px;',
      'bottom-left': 'bottom: 30px; left: 30px;',
      'top-right': 'top: 100px; right: 30px;',
      'top-left': 'top: 100px; left: 30px;'
    };

    const position = positions[this.options.position] || positions['bottom-right'];

    // Create button
    this.button = document.createElement('button');
    this.button.id = 'voiceWidgetBtn';
    this.button.innerHTML = '<i class="bi-mic-fill"></i>';
    this.button.style.cssText = `
      position: fixed;
      ${position}
      width: ${this.options.buttonSize}px;
      height: ${this.options.buttonSize}px;
      border-radius: 50%;
      background: ${theme.color};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 2px solid rgba(255,255,255,0.6);
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 20px ${theme.glow};
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.button.addEventListener('click', () => this.toggleListening());
    this.button.addEventListener('touchstart', (e) => {
      if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
      if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    }, { passive: true, capture: true });
    this.button.addEventListener('mouseenter', () => {
      if (!this.isListening) {
        this.button.style.transform = 'scale(1.1)';
      }
    });
    this.button.addEventListener('mouseleave', () => {
      if (!this.isListening) {
        this.button.style.transform = 'scale(1)';
      }
    });

    document.body.appendChild(this.button);

    // Create status tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'voiceWidgetTooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      ${position.includes('right') ? 'right: 100px;' : 'left: 100px;'}
      ${position.includes('bottom') ? 'bottom: 45px;' : 'top: 115px;'}
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 0.9rem;
      z-index: 9998;
      display: none;
      white-space: nowrap;
    `;
    this.tooltip.textContent = 'Click to activate voice';
    document.body.appendChild(this.tooltip);
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.button.style.animation = 'voicePulse 1.5s ease-in-out infinite';
      this.tooltip.textContent = '🎤 Listening...';
      this.tooltip.style.display = 'block';
      console.log('🎤 Voice recognition started');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('📝 Heard:', transcript);
      this.tooltip.textContent = `"${transcript}"`;
      
      // Call the command handler
      this.options.onCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      this.tooltip.textContent = 'Voice error - try again';
      setTimeout(() => {
        this.tooltip.style.display = 'none';
      }, 2000);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.button.style.animation = '';
      setTimeout(() => {
        this.tooltip.style.display = 'none';
      }, 3000);
    };

    // Add animation keyframes
    if (!document.getElementById('voiceWidgetStyles')) {
      const style = document.createElement('style');
      style.id = 'voiceWidgetStyles';
      style.textContent = `
        @keyframes voicePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 20px rgba(139, 187, 166, 0.5);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 10px 40px rgba(139, 187, 166, 0.8);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  toggleListening() {
    if (!this.recognition) return;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();

    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  defaultCommandHandler(command) {
    // Default: navigate to voice DJ or assistant
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('search') || lowerCommand.includes('find') || lowerCommand.includes('show me')) {
      // Redirect to voice DJ
      sessionStorage.setItem('voiceCommand', command);
      window.location.href = '/voice-dj.html';
    } else if (lowerCommand.includes('tell me') || lowerCommand.includes('what') || lowerCommand.includes('who')) {
      // Redirect to assistant
      sessionStorage.setItem('voiceCommand', command);
      window.location.href = '/assistant.html';
    } else {
      // Default to voice DJ
      sessionStorage.setItem('voiceCommand', command);
      window.location.href = '/voice-dj.html';
    }
  }

  show() {
    if (this.button) this.button.style.display = 'flex';
  }

  hide() {
    if (this.button) this.button.style.display = 'none';
  }

  destroy() {
    if (this.button) this.button.remove();
    if (this.tooltip) this.tooltip.remove();
    if (this.recognition) this.recognition.stop();
  }
}

// Auto-initialize on pages that want it
window.VoiceWidget = VoiceWidget;

// Simple initialization function
window.initVoiceWidget = function(options = {}) {
  return new VoiceWidget(options);
};


