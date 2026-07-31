/**
 * Rami — Jordan history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.JordanI18N;

const WELCOME = {
  en: `<img src="/jordan/assets/rami-guide-portrait-256.png" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #d4a24c"/>
    <p>Ahlan wa sahlan — I'm <strong>Rami</strong>. Ask me about history, food, music, argileh, Bedouin life, or Amman's neighborhoods.</p>
    <small class="text-muted">Try: "What is the eastern badia?" or "Why is mansaf eaten from one tray?"</small>`,
  ar: `<img src="/jordan/assets/rami-guide-portrait-256.png" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #d4a24c"/>
    <p>أهلاً وسهلاً — أنا <strong>رامي</strong>. اسألني عن التاريخ أو الطعام أو الموسيقى أو الأرجيلة أو الحياة البدوية أو أحياء عمّان.</p>
    <small class="text-muted">جرّب: «ما البادية الشرقية؟» أو «لماذا يُؤكل المنسف من صينية واحدة؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Petra, Azraq, mansaf, Bedouin diwan…',
  ar: 'اسأل عن البتراء أو الأزرق أو المنسف أو الديوان…'
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
    apiEndpoint: '/api/jordan/assistant/chat',
    userId: 'jordan-guest',
    sessionId: 'jordan-rami',
    title: 'Rami',
    buttonTitle: 'Ask Rami about Jordan',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('jdAskGuide')?.addEventListener('click', () => openChat());
  window.JordanAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
