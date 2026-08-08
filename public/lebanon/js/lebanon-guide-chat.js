/**
 * Karim — Lebanon history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.LebanonI18N;

const PORTRAIT = '/lebanon/assets/karim-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Karim</strong>. Ask me about Beirut and Byblos, Baalbek and the cedars, tabbouleh and mezze, Fairuz and dabke, or the cafés where nargileh and long talk still meet.</p>
    <small class="text-muted">Try: "What is tabbouleh?" or "Why is Byblos famous?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>كريم</strong>. اسألني عن بيروت وجبيل، بعلبك والأرز، التبولة والمزة، فيروز والدبكة، أو المقاهي حيث ما زالت النرجيلة والحديث الطويل يلتقيان.</p>
    <small class="text-muted">جرّب: «ما هي التبولة؟» أو «لماذا اشتهرت جبيل؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Beirut, mezze, Fairuz, Byblos…',
  ar: 'اسأل عن بيروت أو المزة أو فيروز أو جبيل…'
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
    apiEndpoint: '/api/lebanon/assistant/chat',
    userId: 'lebanon-guest',
    sessionId: 'lebanon-karim',
    title: 'Karim',
    buttonTitle: 'Ask Karim about Lebanon',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('lbAskGuide')?.addEventListener('click', () => openChat());
  window.LebanonAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
