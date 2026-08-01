/**
 * David — Shenango Valley expert chat.
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const WELCOME = `<img src="/family/assets/david-lane-time-traveler-scene.png" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c48a3a;object-fit:cover"/>
  <p>Welcome home — I'm <strong>David</strong>. Ask me about Buhl Park, New Wilmington Amish country, Quaker Steak &amp; Lube, or Luigi's Pizza.</p>
  <small class="text-muted">Try: "Where is Buhl Park?" or "Tell me about the original Lube."</small>`;

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
  window.ShenangoContent?.speak?.(clean);
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
    apiEndpoint: '/api/shenango/assistant/chat',
    userId: 'shenango-guest',
    sessionId: 'shenango-david',
    title: 'David',
    buttonTitle: 'Ask David about Shenango Valley',
    inputPlaceholder: 'Ask about Buhl Park, Amish roads, wings, pizza…',
    welcomeHtml: WELCOME,
    getContext: () => ({ lang: 'en' }),
    onMessageReceived: (response) => speakReply(response)
  });

  window.aiChatWidget = widget;
  document.getElementById('svAskGuide')?.addEventListener('click', () => openChat());
  window.ShenangoAskGuide = openChat;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
