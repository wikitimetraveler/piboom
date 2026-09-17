/**
 * AI Chat Widget Component
 * 
 * Reusable AI chat widget with slide-up panel
 * 
 * @file       ai-chat-widget.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 */

class AIChatWidget {
    constructor(config = {}) {
        this.apiEndpoint = config.apiEndpoint || '/api/loan-pipeline/ai/chat';
        this.userId = config.userId || 'anonymous';
        this.sessionId = config.sessionId || 'default';
        this.context = config.context || {};
        this.getContext = config.getContext || (() => this.context); // Function to get dynamic context
        this.onMessageSent = config.onMessageSent || null;
        this.onMessageReceived = config.onMessageReceived || null;
        this.title = config.title || 'AI Assistant';
        this.buttonTitle = config.buttonTitle || 'AI Assistant';
        this.welcomeHtml = config.welcomeHtml || null;
        this.inputPlaceholder = config.inputPlaceholder || 'Ask me anything about your loan pipeline...';
        this.onOpen = config.onOpen || null;
        this.onClose = config.onClose || null;
        this.showMusicMute = config.showMusicMute === true;
        this.avatarUrl = typeof config.avatarUrl === 'string' ? config.avatarUrl.trim() : '';
        
        this.isOpen = false;
        this.messages = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
    }

    createWidget() {
        const escapeAttr = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const avatar = this.avatarUrl;
        const headerTitle = avatar
            ? `<h5 class="mb-0 ai-chat-header-guide"><img src="${escapeAttr(avatar)}" alt="" width="36" height="36"/> ${this.title}</h5>`
            : `<h5 class="mb-0"><i class="bi bi-robot"></i> ${this.title}</h5>`;

        // Create floating chat button
        const chatButton = document.createElement('button');
        chatButton.id = 'aiChatButton';
        chatButton.className = avatar ? 'ai-chat-button ai-chat-button--avatar' : 'ai-chat-button';
        chatButton.innerHTML = avatar
            ? `<img src="${escapeAttr(avatar)}" alt="" width="60" height="60"/>`
            : '<i class="bi bi-chat-dots-fill"></i>';
        chatButton.title = this.buttonTitle;
        chatButton.setAttribute('aria-label', this.buttonTitle);
        chatButton.onclick = () => this.toggle();
        document.body.appendChild(chatButton);

        // Create chat panel
        const chatPanel = document.createElement('div');
        chatPanel.id = 'aiChatPanel';
        chatPanel.className = 'ai-chat-panel';
        chatPanel.innerHTML = `
            <div class="ai-chat-header">
                ${headerTitle}
                <div class="ai-chat-header-actions">
                    ${this.showMusicMute ? `<button type="button" id="aiChatMusicMuteBtn" class="ai-chat-music-mute-btn" title="Toggle disaster mood music" aria-label="Toggle disaster mood music"><i class="bi bi-music-note-beamed"></i></button>` : ''}
                    <button type="button" id="aiChatStopSpeakBtn" class="ai-chat-speak-btn" title="Stop speaking" aria-label="Stop speaking"><i class="bi bi-stop-fill"></i></button>
                    <button type="button" id="aiChatMuteSpeakBtn" class="ai-chat-speak-btn" title="Mute agent voice" aria-label="Mute agent voice" aria-pressed="false"><i class="bi bi-volume-up"></i></button>
                    <button type="button" class="btn-close btn-close-white" onclick="window.aiChatWidget?.close()" aria-label="Close"></button>
                </div>
            </div>
            <div class="ai-chat-messages" id="aiChatMessages">
                <div class="ai-chat-welcome">
                    ${this.welcomeHtml || `<i class="bi bi-robot"></i>
                    <p>Hello! I'm your AI assistant for loan pipeline analysis. How can I help you today?</p>
                    <small class="text-muted">Try asking: "What are the highest risk loans?" or "Show me insights about Texas loans"</small>`}
                </div>
            </div>
            <div class="ai-chat-input-container">
                <div class="ai-chat-input-wrapper">
                    <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="${this.inputPlaceholder}" />
                    <button id="aiChatSendBtn" class="ai-chat-send-btn" onclick="window.aiChatWidget?.sendMessage()">
                        <i class="bi bi-send"></i>
                    </button>
                    <button id="aiChatVoiceBtn" class="ai-chat-voice-btn" onclick="window.aiChatWidget?.toggleVoice()" title="Voice Input">
                        <i class="bi bi-mic"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(chatPanel);

        // Add styles if not already added
        if (!document.getElementById('aiChatWidgetStyles')) {
            const styles = document.createElement('style');
            styles.id = 'aiChatWidgetStyles';
            styles.textContent = `
                .ai-chat-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: rgba(37, 99, 235, 0.9);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.4);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    cursor: pointer;
                    z-index: 1000;
                    font-size: 1.5rem;
                    transition: transform 0.2s ease;
                }
                .ai-chat-button:hover {
                    transform: scale(1.1);
                }
                .ai-chat-button--avatar {
                    padding: 0;
                    overflow: hidden;
                }
                .ai-chat-button--avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    border-radius: 50%;
                }
                .ai-chat-header-guide {
                    display: flex;
                    align-items: center;
                    gap: 0.55rem;
                }
                .ai-chat-header-guide img {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .ai-chat-panel {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 400px;
                    height: 600px;
                    background: rgba(255,255,255,0.92);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.5);
                    border-bottom: none;
                    border-right: none;
                    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    transform: translateY(100%);
                    transition: transform 0.3s ease-in-out;
                    border-radius: 12px 12px 0 0;
                }
                .ai-chat-panel.open {
                    transform: translateY(0);
                }
                .ai-chat-header {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: white;
                    padding: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 12px 12px 0 0;
                }
                .ai-chat-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .ai-chat-music-mute-btn {
                    border: none;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .ai-chat-music-mute-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                .ai-chat-music-mute-btn.is-muted {
                    opacity: 0.55;
                }
                .ai-chat-speak-btn {
                    border: none;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .ai-chat-speak-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                .ai-chat-speak-btn.is-muted,
                .ai-chat-speak-btn[aria-pressed="true"] {
                    background: rgba(220, 53, 69, 0.45);
                }
                .ai-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    background: rgba(248,250,252,0.8);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
                .ai-chat-welcome {
                    text-align: center;
                    padding: 2rem 1rem;
                    color: #6b7280;
                }
                .ai-chat-welcome i {
                    font-size: 3rem;
                    color: #2563eb;
                    margin-bottom: 1rem;
                }
                .ai-chat-message {
                    margin-bottom: 1rem;
                    display: flex;
                    flex-direction: column;
                }
                .ai-chat-message.user {
                    align-items: flex-end;
                }
                .ai-chat-message.assistant {
                    align-items: flex-start;
                }
                .ai-chat-message-bubble {
                    max-width: 80%;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    word-wrap: break-word;
                }
                .ai-chat-message.user .ai-chat-message-bubble {
                    background: #2563eb;
                    color: white;
                }
                .ai-chat-message.assistant .ai-chat-message-bubble {
                    background: white;
                    color: #1f2937;
                    border: 1px solid #e5e7eb;
                }
                .ai-chat-input-container {
                    padding: 1rem;
                    background: rgba(255,255,255,0.9);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border-top: 1px solid #e5e7eb;
                }
                .ai-chat-input-wrapper {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }
                .ai-chat-input {
                    flex: 1;
                    padding: 0.75rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    outline: none;
                }
                .ai-chat-input:focus {
                    border-color: #2563eb;
                }
                .ai-chat-send-btn, .ai-chat-voice-btn {
                    padding: 0.75rem;
                    border: none;
                    background: #2563eb;
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .ai-chat-send-btn:hover, .ai-chat-voice-btn:hover {
                    background: #1d4ed8;
                }
                .ai-chat-voice-btn.listening {
                    background: #ef4444;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    attachEventListeners() {
        const input = document.getElementById('aiChatInput');
        const sendBtn = document.getElementById('aiChatSendBtn');
        const musicMuteBtn = document.getElementById('aiChatMusicMuteBtn');
        const stopSpeakBtn = document.getElementById('aiChatStopSpeakBtn');
        const muteSpeakBtn = document.getElementById('aiChatMuteSpeakBtn');
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        if (musicMuteBtn) {
            this.updateMusicMuteButton();
            musicMuteBtn.addEventListener('click', () => {
                if (window.DisasterMoodMusic?.toggleMuted) {
                    window.DisasterMoodMusic.toggleMuted();
                    this.updateMusicMuteButton();
                }
            });
        }

        if (stopSpeakBtn) {
            stopSpeakBtn.addEventListener('click', () => {
                if (typeof window.stopSpeech === 'function') window.stopSpeech();
            });
        }

        if (muteSpeakBtn) {
            this.updateAgentMuteButton();
            muteSpeakBtn.addEventListener('click', () => {
                if (typeof window.toggleAgentSpeechMuted === 'function') {
                    window.toggleAgentSpeechMuted();
                } else if (typeof window.stopSpeech === 'function') {
                    window.stopSpeech();
                }
                this.updateAgentMuteButton();
            });
            window.addEventListener('lane-agent-speech-mute', () => this.updateAgentMuteButton());
        }
    }

    updateAgentMuteButton() {
        const muteSpeakBtn = document.getElementById('aiChatMuteSpeakBtn');
        if (!muteSpeakBtn) return;
        const muted = typeof window.isAgentSpeechMuted === 'function' ? window.isAgentSpeechMuted() : false;
        muteSpeakBtn.classList.toggle('is-muted', muted);
        muteSpeakBtn.setAttribute('aria-pressed', String(muted));
        muteSpeakBtn.title = muted ? 'Unmute agent voice' : 'Mute agent voice';
        muteSpeakBtn.setAttribute('aria-label', muteSpeakBtn.title);
        const icon = muteSpeakBtn.querySelector('i');
        if (icon) {
            icon.className = muted ? 'bi bi-volume-mute' : 'bi bi-volume-up';
        }
    }

    unlockAgentSpeech() {
        try {
            window.ensureAudioUnlock?.();
            window.primeSpeechSynthesis?.();
        } catch (_) {
            /* ignore */
        }
    }

    updateMusicMuteButton() {
        const musicMuteBtn = document.getElementById('aiChatMusicMuteBtn');
        if (!musicMuteBtn) return;
        const muted = window.DisasterMoodMusic?.isMuted?.() === true;
        musicMuteBtn.classList.toggle('is-muted', muted);
        musicMuteBtn.title = muted ? 'Disaster mood music muted' : 'Disaster mood music on';
        musicMuteBtn.setAttribute('aria-label', musicMuteBtn.title);
        const icon = musicMuteBtn.querySelector('i');
        if (icon) {
            icon.className = muted ? 'bi bi-volume-mute' : 'bi bi-music-note-beamed';
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        const panel = document.getElementById('aiChatPanel');
        if (panel) {
            panel.classList.add('open');
            this.isOpen = true;
            document.getElementById('aiChatInput')?.focus();
        }
        this.unlockAgentSpeech();
        this.updateAgentMuteButton();
        if (this.onOpen) {
            Promise.resolve()
                .then(async () => {
                    const ctx = typeof this.getContext === 'function'
                        ? await Promise.resolve(this.getContext())
                        : this.context;
                    await this.onOpen(ctx);
                })
                .catch((err) => console.warn('AI chat onOpen failed:', err));
        }
    }

    close() {
        const panel = document.getElementById('aiChatPanel');
        if (panel) {
            panel.classList.remove('open');
            this.isOpen = false;
        }
        if (this.onClose) {
            try {
                this.onClose();
            } catch (err) {
                console.warn('AI chat onClose failed:', err);
            }
        }
    }

    async sendMessage(messageText = null) {
        const input = document.getElementById('aiChatInput');
        const message = messageText || input?.value?.trim();
        
        if (!message) return;

        // Unlock audio during this user gesture so the reply can speak after fetch.
        this.unlockAgentSpeech();

        // Always show the transcript in chat (voice + typed)
        if (!this.isOpen) this.open();

        // Clear input
        if (input) input.value = '';

        // Add user message to UI
        this.addMessage(message, 'user');

        // Call onMessageSent callback
        if (this.onMessageSent) {
            this.onMessageSent(message);
        }

        try {
            // Show typing indicator
            const typingId = this.addMessage('Thinking...', 'assistant', true);

            // Get current context (may be dynamic)
            const currentContext = typeof this.getContext === 'function' ? this.getContext() : this.context;
            
            // Send to API
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    userId: this.userId,
                    sessionId: this.sessionId,
                    context: currentContext
                })
            });

            const data = await response.json();

            // Remove typing indicator
            this.removeMessage(typingId);

            if (data.success && data.response) {
                // Add AI response
                this.addMessage(data.response, 'assistant');
                
                // Call onMessageReceived callback
                if (this.onMessageReceived) {
                    this.onMessageReceived(data.response, data);
                }
            } else {
                const detail = String(data.error || data.message || '').trim();
                this.addMessage(
                  detail
                    ? `Sorry — ${detail}`
                    : 'Sorry, I encountered an error. Please try again.',
                  'assistant'
                );
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.removeMessage(typingId);
            this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
    }

    addMessage(text, role = 'user', isTyping = false) {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer) return null;

        // Remove welcome message if present
        const welcome = messagesContainer.querySelector('.ai-chat-welcome');
        if (welcome) welcome.remove();

        const messageId = `msg-${Date.now()}-${Math.random()}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `ai-chat-message ${role}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'ai-chat-message-bubble';
        bubble.textContent = text;
        
        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store message
        this.messages.push({ id: messageId, text, role, timestamp: new Date() });

        return messageId;
    }

    removeMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) message.remove();
    }

    updateContext(newContext) {
        this.context = { ...this.context, ...newContext };
    }

    resolveVoiceLang() {
        try {
            const ctx = typeof this.getContext === 'function' ? this.getContext() : this.context;
            const lang = String(ctx?.lang || ctx?.language || 'en').toLowerCase();
            if (lang.startsWith('ar')) return 'ar-SA';
            if (lang.startsWith('es')) return 'es-ES';
            if (lang.startsWith('fr')) return 'fr-FR';
            if (lang.startsWith('vi')) return 'vi-VN';
            return 'en-US';
        } catch (_) {
            return 'en-US';
        }
    }

    /**
     * Shared mic for every AIChatWidget page (Jordan, Glazed, Shenango, disasters chat, etc.).
     * Uses /shared/speech-recognition.js when present; falls back to Web Speech API directly.
     */
    ensureVoiceRecognition() {
        if (this._chatVoice) {
            this._chatVoice.setLang?.(this.resolveVoiceLang());
            return this._chatVoice;
        }

        const setListeningUi = (on) => {
            document.getElementById('aiChatVoiceBtn')?.classList.toggle('listening', on);
        };

        if (window.DcSpeechRecognition?.createSpeechBridge) {
            this._chatVoice = window.DcSpeechRecognition.createSpeechBridge({
                lang: this.resolveVoiceLang(),
                continuous: false,
                interimResults: false,
                onStart: () => setListeningUi(true),
                onEnd: () => setListeningUi(false),
                onError: () => setListeningUi(false)
            });
            return this._chatVoice;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = this.resolveVoiceLang();

        let listening = false;
        let onResult = null;
        const widget = this;

        recognition.onstart = () => {
            listening = true;
            setListeningUi(true);
        };
        recognition.onend = () => {
            listening = false;
            setListeningUi(false);
        };
        recognition.onerror = () => {
            listening = false;
            setListeningUi(false);
        };
        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim();
            if (transcript && typeof onResult === 'function') onResult(transcript);
        };

        this._chatVoice = {
            get isListening() {
                return listening;
            },
            setLang(lang) {
                if (lang) recognition.lang = lang;
            },
            start(callback) {
                onResult = callback;
                recognition.lang = widget.resolveVoiceLang();
                try {
                    recognition.start();
                } catch (_) {
                    /* already started */
                }
            },
            stop() {
                try {
                    recognition.stop();
                } catch (_) {
                    /* ignore */
                }
            }
        };

        return this._chatVoice;
    }

    isVoiceListening(voice) {
        if (!voice) return false;
        if (typeof voice.isListening === 'function') return Boolean(voice.isListening());
        return Boolean(voice.isListening);
    }

    toggleVoice() {
        const voice = this.ensureVoiceRecognition();
        if (!voice) {
            const input = document.getElementById('aiChatInput');
            if (input) {
                input.placeholder = 'Voice not supported here — type your message';
                input.focus();
            }
            return;
        }
        if (this.isVoiceListening(voice)) voice.stop();
        else {
            if (!this.isOpen) this.open();
            voice.start((transcript) => {
                const text = String(transcript || '').trim();
                if (!text) return;
                // Show what was heard in the input, then send so it lands in the chat thread
                if (!this.isOpen) this.open();
                const input = document.getElementById('aiChatInput');
                if (input) input.value = text;
                this.sendMessage(text);
            });
        }
    }
}

// Make available globally
window.AIChatWidget = AIChatWidget;

export default AIChatWidget;

