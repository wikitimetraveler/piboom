/**
 * Niqula — Syria history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.SyriaI18N;

const PORTRAIT = '/syria/assets/niqula-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Niqula</strong>. Ask me about Damascus and Aleppo, Palmyra and Ugarit, the table, the oud, argileh, or the crafts that are still worked by hand.</p>
    <small class="text-muted">Try: "Who was Zenobia?" or "Why is kebab karaz made with cherries?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>نقولا</strong>. اسألني عن دمشق وحلب، تدمر وأوغاريت، المائدة والعود والأرجيلة، والحِرَف التي ما زالت تُصنع باليد.</p>
    <small class="text-muted">جرّب: «من هي زنوبيا؟» أو «لماذا يُطبخ كباب الكرز بالكرز؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Palmyra, Aleppo, kibbeh, the Umayyad Mosque…',
  ar: 'اسأل عن تدمر أو حلب أو الكبة أو الجامع الأموي…'
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
    apiEndpoint: '/api/syria/assistant/chat',
    userId: 'syria-guest',
    sessionId: 'syria-niqula',
    title: 'Niqula',
    buttonTitle: 'Ask Niqula about Syria',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('syAskGuide')?.addEventListener('click', () => openChat());
  window.SyriaAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
