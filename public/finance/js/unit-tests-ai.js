/**
 * Development work by David Lane
 */
/**
 * Unit Tests AI Assistant
 * Integrates with Encompass Unit Testing AI Assistant and TTS services
 */

const aiAssistantCard = document.getElementById('aiAssistantCard');
const aiChatMessages = document.getElementById('aiChatMessages');
const aiChatInput = document.getElementById('aiChatInput');
const aiChatSendBtn = document.getElementById('aiChatSendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

let chatContext = [];

// Initialize AI Assistant
function initializeAIAssistant() {
  if (!aiAssistantCard || !aiChatMessages) return;
  
  // Show AI assistant card when file is loaded
  aiAssistantCard.style.display = 'block';
  
  // Add welcome message
  addAIMessage('assistant', 'Hello! I\'m your Encompass Unit Testing AI Assistant. I can help you with:\n\n• Creating test scenarios\n• Understanding Encompass APIs\n• Test automation guidance\n• Troubleshooting test issues\n• Best practices for unit testing\n\nWhat would you like to know?');
  
  // Event listeners
  aiChatSendBtn?.addEventListener('click', sendAIMessage);
  aiChatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIMessage();
    }
  });
  
  clearChatBtn?.addEventListener('click', clearChat);

  const ttsToggleBtn = document.getElementById('ttsToggleBtn');
  if (ttsToggleBtn) {
    ttsToggleBtn.addEventListener('click', () => {
      window.unitTestsSpeakResponses = !window.unitTestsSpeakResponses;
      ttsToggleBtn.classList.toggle('active', !!window.unitTestsSpeakResponses);
      ttsToggleBtn.title = window.unitTestsSpeakResponses ? 'Speaking AI responses (click to disable)' : 'Speak AI responses aloud';
    });
  }
}

function addAIMessage(role, content, timestamp = null, options = {}) {
  if (!aiChatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'ai-chat-message-avatar';
  avatar.innerHTML = role === 'user' ? '<i class="bi-person"></i>' : '<i class="bi-robot"></i>';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'ai-chat-message-content';
  
  // Convert markdown-like formatting to HTML
  const formattedContent = formatMessageContent(content);
  contentDiv.innerHTML = formattedContent;
  
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'ai-chat-message-timestamp';
  timestampDiv.textContent = timestamp || new Date().toLocaleTimeString();
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  contentDiv.appendChild(timestampDiv);
  
  aiChatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  // TTS: Speak assistant response when enabled
  if (role === 'assistant' && options.speakResponse && content && typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(content.substring(0, 500), 'en-US-Standard-D', { speakingRate: 0.9 })
      .catch(() => {});
  } else if (role === 'assistant' && options.speakResponse && content && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(content.substring(0, 500));
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);
    u.rate = isMobile ? 1.0 : 0.9;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

function formatMessageContent(content) {
  // Simple markdown-like formatting
  let formatted = content
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
  
  return formatted;
}

async function sendAIMessage(opts = null) {
  const message = (opts && typeof opts === 'object' && opts.message) ? opts.message.trim() : aiChatInput?.value?.trim();
  const testContext = opts && typeof opts === 'object' ? opts.testContext : null;
  if (!message) return;

  const normalized = message.toLowerCase();
  if ((normalized.includes('run tests') || normalized.includes('run test')) && !testContext) {
    addAIMessage('user', message);
    aiChatInput.value = '';
    if (typeof window.runTests === 'function') {
      addAIMessage('assistant', 'Running tests now.');
      window.runTests();
    } else {
      addAIMessage('assistant', 'Unable to run tests right now. Please load test data first.');
    }
    return;
  }
  
  // Add user message to chat
  addAIMessage('user', message);
  
  // Add loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-chat-loading';
  loadingDiv.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> <span>AI Assistant is thinking...</span>';
  aiChatMessages.appendChild(loadingDiv);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  
  // Clear input unless we were called with opts
  if (!opts || !opts.message) aiChatInput.value = '';
  
  // Add to context
  chatContext.push(message);
  
  try {
    const body = {
      message,
      context: chatContext.slice(-10)
    };
    if (testContext && (testContext.results || testContext.failures)) {
      body.testContext = {
        results: testContext.results || [],
        failures: testContext.failures || [],
        summary: testContext.failures
          ? `${testContext.failures.length} failed, ${(testContext.results || []).filter((r) => r.status === 'info').length} passed`
          : null
      };
    }
    const response = await fetch('/api/unit-tests/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Remove loading indicator
    loadingDiv.remove();
    
    // Add assistant response
    addAIMessage('assistant', data.message, new Date(data.timestamp).toLocaleTimeString(), { speakResponse: !!window.unitTestsSpeakResponses });
    
    // Add to context (limit context size)
    if (chatContext.length > 20) {
      chatContext = chatContext.slice(-10);
    }
    
  } catch (error) {
    console.error('Error sending AI message:', error);
    loadingDiv.remove();
    addAIMessage('assistant', `Sorry, I encountered an error: ${error.message}. Please try again.`);
  }
}

function clearChat() {
  if (!aiChatMessages) return;
  
  if (confirm('Clear chat history?')) {
    chatContext = [];
    aiChatMessages.innerHTML = '';
    addAIMessage('assistant', 'Chat cleared. How can I help you with unit testing?');
    
    // Stop any current speech
    if (window.stopSpeech) {
      window.stopSpeech();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAIAssistant);
} else {
  initializeAIAssistant();
}

// Export functions for use in unit-tests.js
window.unitTestsAI = {
  initialize: initializeAIAssistant,
  sendMessage: (message) => {
    if (!aiChatInput) return;
    aiChatInput.value = message;
    sendAIMessage();
  },
  sendMessageWithContext: (message, testContext) => {
    sendAIMessage({ message: String(message).trim(), testContext });
  },
  show: () => {
    if (aiAssistantCard) {
      aiAssistantCard.style.display = 'block';
    }
  },
  hide: () => {
    if (aiAssistantCard) {
      aiAssistantCard.style.display = 'none';
    }
  }
};
