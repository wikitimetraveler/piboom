/**
 * David — Shenango Valley expert chat (avatar + Google TTS).
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const AVATAR = '/family/assets/david-lane-time-traveler-scene.png';

const WELCOME = `<img src="${AVATAR}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c48a3a;object-fit:cover"/>
  <p>Welcome home — I'm <strong>David</strong>. Ask about Buhl Park at the center, Sharon Steel / Farrell, New Wilmington Amish roads, Steel Bowl sports, The Lettermen, or Trent Reznor from Mercer.</p>
  <small class="text-muted">Try: "Why is Buhl Park the hub?" or "Tell me about Tony Butala." · Replies speak with Google TTS.</small>`;

function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

function unlockTts() {
  try {
    window.ensureAudioUnlock?.();
    window.primeSpeechSynthesis?.();
  } catch (_) {
    /* ignore */
  }
}

async function speakReply(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  unlockTts();
  if (typeof window.speakWithGoogle === 'function') {
    try {
      await window.speakWithGoogle(clean, { lang: 'en-US', gender: 'male' });
      return;
    } catch (_) {
      /* fall through */
    }
  }
  window.ShenangoContent?.speak?.(clean);
}

function openChat(prefill) {
  unlockTts();
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
    buttonTitle: 'Ask David — Shenango Valley guide',
    inputPlaceholder: 'Ask about Buhl Park, steel, Lettermen, Reznor…',
    welcomeHtml: WELCOME,
    avatarUrl: AVATAR,
    getContext: () => ({ lang: 'en' }),
    onOpen: () => unlockTts(),
    onMessageReceived: (response) => {
      const text = typeof response === 'string'
        ? response
        : (response?.response || response?.reply || response?.message || '');
      speakReply(text);
    }
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
