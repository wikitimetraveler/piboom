/**
 * Bud Master chat + Google TTS (female Neural2-F)
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const AVATAR = '/mountain-high/assets/bud-master-portrait.webp';
const BUD_TTS = 'en-US-Neural2-F';
const BUD_OPTS = { preferFemale: true, gender: 'female', pitch: 1.5, speakingRate: 0.98 };

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

async function speakBud(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  unlockTts();
  if (window.MhmHeygen?.speak) {
    window.MhmHeygen.speak(clean);
  }
  if (typeof window.speakWithGoogle === 'function') {
    try {
      await window.speakWithGoogle(clean, BUD_TTS, BUD_OPTS);
      return;
    } catch (_) {
      /* fall through */
    }
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  }
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
  if (/origins|landrace|map|hindu|kush|afghani|thai/i.test(message)) {
    document.getElementById('mhmOrigins')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (/lock|locksmith|lockout|key/i.test(message)) {
    document.getElementById('mhmFooterLock')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function initChat() {
  const widget = new AIChatWidget({
    apiEndpoint: '/api/mountain-high/assistant/chat',
    userId: 'mhm-guest',
    sessionId: 'mountain-high-bud',
    title: 'Bud Master',
    buttonTitle: 'Ask Bud Master',
    inputPlaceholder: 'Ask about types, homegrown vs indoor, the origins map, or a lockout in Long Beach / L.A.…',
    avatarUrl: AVATAR,
    welcomeHtml: `<img src="${AVATAR}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #e8d5a3;object-fit:cover"/>
      <p>Hey — I'm <strong>Bud Master</strong>. Hippie botanist, grow expert, twenty-one and over. Flip a type card, or ask about locksmiths in <strong>Long Beach and L.A.</strong></p>
      <small class="text-muted">Try: "What's the difference between indica and sativa?" or "Do you cover Long Beach?"</small>`,
    getContext: () => ({ page: 'mountain-high', age: '21+' }),
    onOpen: () => unlockTts(),
    onMessageReceived: (response) => {
      const text =
        typeof response === 'string'
          ? response
          : response?.response || response?.reply || response?.message || '';
      speakBud(text);
    },
  });

  window.aiChatWidget = widget;
  window.MhmAskJill = openChat;
  window.MhmSpeakJill = speakBud;
  window.MhmAskBud = openChat;
  window.MhmSpeakBud = speakBud;

  document.getElementById('mhmAskJill')?.addEventListener('click', () => {
    document.getElementById('mhmGuide')?.classList.remove('is-compact');
    openChat();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
