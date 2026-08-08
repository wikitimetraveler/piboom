/**
 * Zayd — Iraq history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.IraqI18N;

const PORTRAIT = '/iraq/assets/zayd-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Zayd</strong>. Ask me about Babylon and Ur, Baghdad’s books and tea houses, masgouf and maqam, the Ahwar marshes, or Ashura roads to Karbala.</p>
    <small class="text-muted">Try: "What is masgouf?" or "Why is Babylon famous?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>زيد</strong>. اسألني عن بابل وأور، كتب بغداد وبيوت الشاي، المسگوف والمقام، أهوار الأهوار، أو طرق عاشوراء إلى كربلاء.</p>
    <small class="text-muted">جرّب: «ما هو المسگوف؟» أو «لماذا اشتهرت بابل؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Babylon, masgouf, maqam, marshes…',
  ar: 'اسأل عن بابل أو المسگوف أو المقام أو الأهوار…'
};

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
  i18n()?.speakAsGuide(clean);
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

function applyLanguage(widget) {
  const lang = i18n()?.lang() || 'en';
  widget.welcomeHtml = WELCOME[lang];
  widget.inputPlaceholder = PLACEHOLDER[lang];
  const input = document.querySelector('.ai-chat-input, .ai-chat-panel input[type="text"], .ai-chat-panel textarea');
  if (input) input.setAttribute('placeholder', PLACEHOLDER[lang]);
}

function initChat() {
  const widget = new AIChatWidget({
    apiEndpoint: '/api/iraq/assistant/chat',
    userId: 'iraq-guest',
    sessionId: 'iraq-zayd',
    title: 'Zayd',
    buttonTitle: 'Ask Zayd about Iraq',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('iqAskGuide')?.addEventListener('click', () => openChat());
  window.IraqAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
