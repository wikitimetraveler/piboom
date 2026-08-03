/**
 * Noor — Palestine · Israel history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.HolyLandI18N;

const PORTRAIT = '/holy-land/assets/noor-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Noor</strong>. Ask me about Jerusalem and Bethlehem, the olive harvest, knafeh and shakshuka, dabke and piyutim, or how Hebrew and Arabic share the same markets.</p>
    <small class="text-muted">Try: "Why is Jerusalem layered?" or "What is tatreez?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>نور</strong>. اسألني عن القدس وبيت لحم، موسم الزيتون، الكنافة والشكشوكة، الدبكة والبيوطيم، وكيف تلتقي العبرية والعربية في الأسواق نفسها.</p>
    <small class="text-muted">جرّب: «لماذا القدس طبقات؟» أو «ما هو التطريز؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Jerusalem, knafeh, olive harvest, dabke…',
  ar: 'اسأل عن القدس أو الكنافة أو الزيتون أو الدبكة…'
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
    apiEndpoint: '/api/holy-land/assistant/chat',
    userId: 'holy-land-guest',
    sessionId: 'holy-land-noor',
    title: 'Noor',
    buttonTitle: 'Ask Noor about Palestine · Israel',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('hlAskGuide')?.addEventListener('click', () => openChat());
  window.HolyLandAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
