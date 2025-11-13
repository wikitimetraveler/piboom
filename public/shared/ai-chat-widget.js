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
        
        this.isOpen = false;
        this.messages = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
    }

    createWidget() {
        // Create floating chat button
        const chatButton = document.createElement('button');
        chatButton.id = 'aiChatButton';
        chatButton.className = 'ai-chat-button';
        chatButton.innerHTML = '<i class="bi bi-chat-dots-fill"></i>';
        chatButton.title = 'AI Assistant';
        chatButton.onclick = () => this.toggle();
        document.body.appendChild(chatButton);

        // Create chat panel
        const chatPanel = document.createElement('div');
        chatPanel.id = 'aiChatPanel';
        chatPanel.className = 'ai-chat-panel';
        chatPanel.innerHTML = `
            <div class="ai-chat-header">
                <h5 class="mb-0"><i class="bi bi-robot"></i> AI Assistant</h5>
                <button type="button" class="btn-close btn-close-white" onclick="window.aiChatWidget?.close()" aria-label="Close"></button>
            </div>
            <div class="ai-chat-messages" id="aiChatMessages">
                <div class="ai-chat-welcome">
                    <i class="bi bi-robot"></i>
                    <p>Hello! I'm your AI assistant for loan pipeline analysis. How can I help you today?</p>
                    <small class="text-muted">Try asking: "What are the highest risk loans?" or "Show me insights about Texas loans"</small>
                </div>
            </div>
            <div class="ai-chat-input-container">
                <div class="ai-chat-input-wrapper">
                    <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="Ask me anything about your loan pipeline..." />
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
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    cursor: pointer;
                    z-index: 1000;
                    font-size: 1.5rem;
                    transition: transform 0.2s ease;
                }
                .ai-chat-button:hover {
                    transform: scale(1.1);
                }
                .ai-chat-panel {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 400px;
                    height: 600px;
                    background: white;
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
                .ai-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    background: #f8fafc;
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
                    background: white;
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
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
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
    }

    close() {
        const panel = document.getElementById('aiChatPanel');
        if (panel) {
            panel.classList.remove('open');
            this.isOpen = false;
        }
    }

    async sendMessage(messageText = null) {
        const input = document.getElementById('aiChatInput');
        const message = messageText || input?.value?.trim();
        
        if (!message) return;

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
                this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
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

    toggleVoice() {
        // Voice integration will be added in voice-controls step
        if (window.voiceRecognition) {
            if (window.voiceRecognition.isListening) {
                window.voiceRecognition.stop();
            } else {
                window.voiceRecognition.start((transcript) => {
                    this.sendMessage(transcript);
                });
            }
        } else {
            alert('Voice recognition not available. Please type your message.');
        }
    }
}

// Make available globally
window.AIChatWidget = AIChatWidget;

export default AIChatWidget;

