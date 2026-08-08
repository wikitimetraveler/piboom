/**
 * Nima — Iran history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.IranI18N;

const PORTRAIT = '/iran/assets/nima-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Salâm — I'm <strong>Nima</strong>. Ask me about Persepolis and Isfahan, Nowruz and tahdig, tar and the radif, taarof and bazaars, or the Achaemenid stairs that still face the plain.</p>
    <small class="text-muted">Try: "What is tahdig?" or "Why is Persepolis famous?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>سلام — أنا <strong>نیما</strong>. اسألني عن برسبوليس وأصفهان، نوروز والتهديغ، التار والرديف، التعارف والأسواق، أو الأدراج الأخمينية التي ما زالت تواجه السهل.</p>
    <small class="text-muted">جرّب: «ما هو التهديغ؟» أو «لماذا اشتهرت برسبوليس؟»</small>`
};

const PLACEHOLDER = {
  en: 'Ask about Persepolis, tahdig, Nowruz, tar…',
  ar: 'اسأل عن برسبوليس أو التهديغ أو نوروز أو التار…'
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
    apiEndpoint: '/api/iran/assistant/chat',
    userId: 'iran-guest',
    sessionId: 'iran-nima',
    title: 'Nima',
    buttonTitle: 'Ask Nima about Iran',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('irAskGuide')?.addEventListener('click', () => openChat());
  window.IranAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
