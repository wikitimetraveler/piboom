/**
 * Pip AI chat widget wiring for Glazed (ES module)
 * Replies speak aloud with Pip's female Google TTS voice.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

/** Young female Neural2 — warmer/lighter to match Pip’s baker avatar */
const PIP_TTS_VOICE = 'en-US-Neural2-H';
const PIP_TTS_OPTS = { preferFemale: true, gender: 'female', pitch: 1.6, speakingRate: 1.06 };

function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function speakPip(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  if (typeof window.gzSpeakPip === 'function') {
    window.gzSpeakPip(clean);
    return;
  }
  if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
  if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  if (typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(clean, PIP_TTS_VOICE, PIP_TTS_OPTS);
    return;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.02;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  }
}

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
      <p>Hey — I'm <strong>Pip</strong>, your chatty donut buddy. I answer in text <em>and</em> speak aloud in my voice.</p>
      <small class="text-muted">Try: "What's good with Mango Sunrise?" or "Where is Savy on Harbor?" — then tell me how I sound!</small>`,
    onMessageReceived: (response) => {
      speakPip(response);
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    body.gz-page .ai-chat-button {
      background: linear-gradient(135deg, #ff7a9a, #e85a7a) !important;
      bottom: 24px;
      right: 24px;
      z-index: 1200;
      box-shadow: 0 8px 20px rgba(232, 90, 122, 0.4) !important;
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
    body.gz-page .dark-mode-toggle {
      bottom: 100px;
      right: 28px;
      z-index: 1190;
    }
    @media (max-width: 767.98px) {
      body.gz-page .ai-chat-button::after {
        display: none;
      }
      body.gz-page .ai-chat-button {
        bottom: 20px;
        right: 16px;
      }
      body.gz-page .dark-mode-toggle {
        bottom: 92px;
        right: 20px;
      }
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
