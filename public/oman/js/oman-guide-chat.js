/**
 * Salim — Oman history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.OmanI18N;

const PORTRAIT = '/oman/assets/salim-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Salim</strong>. Ask me about Muscat and Nizwa, frankincense and khareef, shuwa and kahwa, razha and sea songs, or the falaj water that still shares the oasis.</p>
    <small class="text-muted">Try: "What is shuwa?" or "Why is frankincense famous?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>سليم</strong>. اسألني عن مسقط ونزوى، اللبان والخريف، الشواء والقهوة، الرزحة وأغاني البحر، أو فلج الماء الذي ما زال يقاسم الواحة.</p>
    <small class="text-muted">جرّب: «ما هو الشواء؟» أو «لماذا اشتهر اللبان؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Muscat, shuwa, frankincense, razha…',
  ar: 'اسأل عن مسقط أو الشواء أو اللبان أو الرزحة…'
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
    apiEndpoint: '/api/oman/assistant/chat',
    userId: 'oman-guest',
    sessionId: 'oman-salim',
    title: 'Salim',
    buttonTitle: 'Ask Salim about Oman',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('omAskGuide')?.addEventListener('click', () => openChat());
  window.OmanAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
