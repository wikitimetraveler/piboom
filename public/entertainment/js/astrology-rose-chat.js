/**
 * Rose parlor chat for the astrology page
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const PORTRAIT = '/entertainment/assets/rose-guide-portrait-256.png';
const WELCOME = `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c44860"/>
    <p>I'm <strong>Rose</strong>. Ask for a sign, a birthday, or a Sun / Cross / Path reading. Playful tropical cards — not the night sky.</p>
    <small class="text-muted">Try: "Read Cancer for me" or "What does the Cross mean?"</small>`;

function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

function speakReply(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  if (window.AstrologyHeygen && typeof window.AstrologyHeygen.speak === 'function') {
    window.AstrologyHeygen.speak(clean);
  }
}

function currentContext() {
  const spread = window.AstrologyPage?.lastSpread?.();
  const detail = document.getElementById('astroDetail');
  return {
    sign: detail?.dataset?.sign || '',
    spread: spread
      ? { sun: spread.sun?.name, cross: spread.cross?.name, path: spread.path?.name }
      : undefined,
  };
}

function openChat(prefill) {
  const widget = window.aiChatWidget;
  if (!widget) return;
  if (typeof widget.open === 'function') widget.open();
  else widget.toggle?.();
  const message = String(prefill || '').trim();
  if (message && typeof widget.sendMessage === 'function') {
    window.setTimeout(() => widget.sendMessage(message), 180);
  }
}

function initChat() {
  const widget = new AIChatWidget({
    apiEndpoint: '/api/astrology/assistant/chat',
    userId: 'astrology-guest',
    sessionId: 'astrology-rose',
    title: 'Rose',
    buttonTitle: 'Ask Rose',
    inputPlaceholder: 'Ask Rose about a sign…',
    welcomeHtml: WELCOME,
    avatarUrl: PORTRAIT,
    getContext: currentContext,
    onMessageReceived: (response) => {
      const text = typeof response === 'string' ? response : response?.reply || response?.response || '';
      speakReply(text);
    },
  });
  window.aiChatWidget = widget;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}

window.AstrologyRose = {
  ask: openChat,
  speak: speakReply,
};
