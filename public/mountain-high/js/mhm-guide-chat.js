/**
 * Sage chat + Google TTS
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const AVATAR = '/mountain-high/assets/sage-portrait.svg';
const SAGE_TTS = 'en-US-Neural2-F';
const SAGE_OPTS = { preferFemale: true, gender: 'female', pitch: 1.5, speakingRate: 0.98 };

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

async function speakSage(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  unlockTts();
  if (window.MhmHeygen?.speak) {
    window.MhmHeygen.speak(clean);
  }
  if (typeof window.speakWithGoogle === 'function') {
    try {
      await window.speakWithGoogle(clean, SAGE_TTS, SAGE_OPTS);
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
  widget.open?.() || widget.toggle?.();
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
    sessionId: 'mountain-high-sage',
    title: 'Sage',
    buttonTitle: 'Ask Sage',
    inputPlaceholder: 'Ask about types, the origins map, or a lockout in Long Beach / L.A.…',
    avatarUrl: AVATAR,
    welcomeHtml: `<img src="${AVATAR}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #e8d5a3"/>
      <p>Hey — I'm <strong>Sage</strong>. Twenty-one and over. Flip a type card, or ask about locksmiths in <strong>Long Beach and L.A.</strong></p>
      <small class="text-muted">Try: "What's the difference between indica and sativa?" or "Do you cover Long Beach?"</small>`,
    getContext: () => ({ page: 'mountain-high', age: '21+' }),
    onOpen: () => unlockTts(),
    onMessageReceived: (response) => {
      const text =
        typeof response === 'string'
          ? response
          : response?.response || response?.reply || response?.message || '';
      speakSage(text);
    },
  });

  window.aiChatWidget = widget;
  window.MhmAskSage = openChat;
  window.MhmSpeakSage = speakSage;

  document.getElementById('mhmAskSage')?.addEventListener('click', () => {
    document.getElementById('mhmGuide')?.classList.remove('is-compact');
    openChat();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
