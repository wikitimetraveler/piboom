/**
 * Pip AI chat widget wiring for Glazed (ES module)
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

function initPipChat() {
  window.aiChatWidget = new AIChatWidget({
    apiEndpoint: '/api/donuts/assistant/chat',
    userId: 'glazed-guest',
    sessionId: 'glazed-pip',
    title: 'Pip',
    buttonTitle: 'Ask Pip',
    inputPlaceholder: 'Ask Pip about donuts, smoothies, or Savy on Harbor…',
    welcomeHtml: `
      <img src="/donuts/assets/pip-baker-portrait.png" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin-bottom:8px;border:2px solid #f5c76a"/>
      <p>Hey — I'm <strong>Pip</strong>. Ask me about the case, smoothie pairings, or how to find <strong>Savy Donuts &amp; Smoothies</strong> on Harbor.</p>
      <small class="text-muted">Try: "What's good with Mango Sunrise?" or "Where is Savy Donuts and Smoothies on Harbor?"</small>`
  });

  const style = document.createElement('style');
  style.textContent = `
    body.gz-page .ai-chat-button {
      background: linear-gradient(135deg, #ff7a9a, #e85a7a) !important;
      bottom: 24px;
      right: 24px;
      z-index: 1200;
      box-shadow: 0 8px 24px rgba(232, 90, 122, 0.55) !important;
    }
    body.gz-page .ai-chat-button::after {
      content: 'Ask Pip';
      position: absolute;
      right: 70px;
      top: 50%;
      transform: translateY(-50%);
      white-space: nowrap;
      background: rgba(26, 16, 12, 0.92);
      color: #fff4e8;
      font-size: 0.78rem;
      font-weight: 800;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      border: 1px solid rgba(245, 199, 106, 0.35);
      pointer-events: none;
    }
    body.gz-page .ai-chat-panel {
      z-index: 1201;
    }
    body.gz-page .ai-chat-header {
      background: linear-gradient(135deg, #4a2c1a, #2c1810) !important;
    }
    body.gz-page .ai-chat-send-btn {
      background: #e85a7a !important;
    }
  `;
  document.head.appendChild(style);

  document.getElementById('gzAskPip')?.addEventListener('click', openPip);
  document.getElementById('gzAskPipMap')?.addEventListener('click', openPip);
}

function openPip() {
  if (!window.aiChatWidget) return;
  if (typeof window.aiChatWidget.open === 'function') window.aiChatWidget.open();
  else if (typeof window.aiChatWidget.toggle === 'function') window.aiChatWidget.toggle();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPipChat);
} else {
  initPipChat();
}
