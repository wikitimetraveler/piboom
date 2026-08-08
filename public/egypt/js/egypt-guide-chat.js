/**
 * Omar — Egypt history expert chat. Answers and speaks in the page language.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const i18n = () => window.EgyptI18N;

const PORTRAIT = '/egypt/assets/omar-guide-portrait-256.png';

const WELCOME = {
  en: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>Ahlan wa sahlan — I'm <strong>Omar</strong>. Ask me about Giza and Luxor, Islamic Cairo and Al-Azhar, koshari and ful, Umm Kulthum and tarab, or the ahwa cafés where shai and long talk still meet.</p>
    <small class="text-muted">Try: "What is koshari?" or "Why is Giza famous?"</small>`,
  ar: `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c9992f"/>
    <p>أهلاً وسهلاً — أنا <strong>عمر</strong>. اسألني عن الجيزة والأقصر، القاهرة الإسلامية والأزهر، الكشري والفول، أم كلثوم والطرب، أو المقاهي حيث ما زال الشاي والحديث الطويل يلتقيان.</p>
    <small class="text-muted">جرّب: «ما هو الكشري؟» أو «لماذا اشتهرت الجيزة؟»</small>`
};

/** Phrases that open the secret Raqs · Baladi section without calling the API. */
function tryRaqsUnlock(widget, message) {
  if (!window.EgyptRaqs?.matchUnlock?.(message)) return false;
  const input = document.getElementById('aiChatInput');
  if (input) input.value = '';
  widget.addMessage(message, 'user');
  const reply = window.EgyptRaqs.unlockFromChat();
  widget.addMessage(reply, 'assistant');
  speakReply(reply);
  return true;
}

const PLACEHOLDER = {
  en: 'Ask about Giza, koshari, Umm Kulthum, Luxor…',
  ar: 'اسأل عن الجيزة أو الكشري أو أم كلثوم أو الأقصر…'
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
    apiEndpoint: '/api/egypt/assistant/chat',
    userId: 'egypt-guest',
    sessionId: 'egypt-omar',
    title: 'Omar',
    buttonTitle: 'Ask Omar about Egypt',
    inputPlaceholder: PLACEHOLDER.en,
    welcomeHtml: WELCOME.en,
    getContext: () => ({ lang: i18n()?.lang() || 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  const sendOriginal = widget.sendMessage.bind(widget);
  widget.sendMessage = async (messageText = null) => {
    const input = document.getElementById('aiChatInput');
    const message = messageText || input?.value?.trim();
    if (message && tryRaqsUnlock(widget, message)) return;
    return sendOriginal(messageText);
  };

  window.aiChatWidget = widget;
  applyLanguage(widget);
  i18n()?.onChange(() => applyLanguage(widget));

  document.getElementById('egAskGuide')?.addEventListener('click', () => openChat());
  window.EgyptAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
