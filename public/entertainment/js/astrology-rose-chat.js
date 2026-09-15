/**
 * Rose parlor chat for the astrology page
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const PORTRAIT = '/entertainment/assets/rose-guide-portrait-256.png';
const WELCOME = `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c44860"/>
    <p>I'm <strong>Rose</strong>. I read the twelve signs and a full seventy-eight-card tarot — ask how to shuffle, or flip a card. Playful parlor guidance — not the night sky.</p>
    <small class="text-muted">Try: "Read The Tower" · "How do I use the deck?" · "Read Cancer for me" · Use Stop / Mute in the chat header to cut her off.</small>`;

function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
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
  if (window.AstrologyHeygen && typeof window.AstrologyHeygen.speak === 'function') {
    await window.AstrologyHeygen.speak(clean);
    return;
  }
  if (typeof window.speakNarrationAwaitEnd === 'function') {
    await window.speakNarrationAwaitEnd(clean, {
      voice: 'en-US-Neural2-F',
      preferFemale: true,
      speakingRate: 0.94,
      volume: 0.9,
    });
    return;
  }
  if (typeof window.speakWithGoogle === 'function') {
    await window.speakWithGoogle(clean, 'en-US-Neural2-F', {
      preferFemale: true,
      speakingRate: 0.94,
      volume: 0.9,
    });
  }
}

function currentContext() {
  const spread = window.AstrologyPage?.lastSpread?.();
  const detail = document.getElementById('astroDetail');
  return {
    sign: detail?.dataset?.sign || '',
    spread: spread
      ? { sun: spread.sun?.name, cross: spread.cross?.name, path: spread.path?.name }
      : undefined,
  };
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
    apiEndpoint: '/api/astrology/assistant/chat',
    userId: 'astrology-guest',
    sessionId: 'astrology-rose',
    title: 'Rose',
    buttonTitle: 'Ask Rose',
    inputPlaceholder: 'Ask Rose about a sign or tarot card…',
    welcomeHtml: WELCOME,
    avatarUrl: PORTRAIT,
    getContext: currentContext,
    onOpen: () => unlockTts(),
    onMessageSent: () => unlockTts(),
    onMessageReceived: (response) => {
      const text = typeof response === 'string' ? response : response?.reply || response?.response || '';
      speakReply(text);
    },
  });
  window.aiChatWidget = widget;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}

window.AstrologyRose = {
  ask: openChat,
  speak: speakReply,
};
