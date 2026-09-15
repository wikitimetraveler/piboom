/**
 * David — West PA / East Ohio expert chat (avatar + Google TTS).
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const AVATAR = '/family/assets/david-lane-time-traveler-scene.png';

const WELCOME = `<img src="${AVATAR}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c48a3a;object-fit:cover"/>
  <p>Welcome — I'm <strong>David</strong>, your scholastic expert for <strong>western Pennsylvania</strong> and <strong>eastern Ohio</strong>. Ask about Buhl Park, steel, Amish roads, sports, music, or Youngstown’s <strong>1970s</strong> Cleveland–Pittsburgh rackets war.</p>
  <small class="text-muted">Try: "What happened in Youngstown in the 1970s?" or "What was the bug?" · Replies speak with Google TTS.</small>`;

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
  if (typeof window.isAgentSpeechMuted === 'function' && window.isAgentSpeechMuted()) return;
  unlockTts();
  if (typeof window.stopSpeech === 'function') window.stopSpeech();
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
    title: 'David · West PA & East Ohio',
    buttonTitle: 'Ask David — West PA & East Ohio history',
    inputPlaceholder: 'Ask about Buhl Park, Youngstown, steel, Lettermen…',
    welcomeHtml: WELCOME,
    avatarUrl: AVATAR,
    getContext: () => ({ lang: 'en', region: 'west-pa-east-ohio' }),
    onOpen: () => unlockTts(),
    onMessageReceived: (response) => {
      const text =
        typeof response === 'string'
          ? response
          : response?.response || response?.reply || response?.message || '';
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
