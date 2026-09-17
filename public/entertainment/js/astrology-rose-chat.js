/**
 * Rose parlor chat for the astrology page
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const PORTRAIT = '/entertainment/assets/rose-guide-portrait-256.png';

function i18n() {
  return window.AstrologyI18N;
}

function welcomeHtml() {
  const portrait = `<img src="${PORTRAIT}" alt="" style="width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #c44860"/>`;
  const body = i18n()?.t?.('chatWelcome') ||
    "I'm <strong>Rose</strong>. I read the twelve signs and a full seventy-eight-card tarot — ask how to shuffle, or flip a card. Playful parlor guidance — not the night sky.";
  const hint = i18n()?.t?.('chatHint') ||
    'Try: "Read The Tower" · "How do I use the deck?" · "Read Cancer for me" · Use Stop / Mute in the chat header to cut her off.';
  const withName = String(body).replace(/\bRose\b/, '<strong>Rose</strong>');
  return `${portrait}
    <p>${withName}</p>
    <small class="text-muted">${hint}</small>`;
}

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
    i18n()?.unlockAudio?.();
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
  if (i18n()?.speak) {
    await i18n().speak(clean);
    return;
  }
  const profile = i18n()?.voiceProfile?.() || { voice: 'en-US-Neural2-F' };
  if (typeof window.speakNarrationAwaitEnd === 'function') {
    await window.speakNarrationAwaitEnd(clean, {
      voice: profile.voice,
      preferFemale: true,
      speakingRate: 0.94,
      volume: 0.9,
    });
    return;
  }
  if (typeof window.speakWithGoogle === 'function') {
    await window.speakWithGoogle(clean, profile.voice, {
      preferFemale: true,
      speakingRate: 0.94,
      volume: 0.9,
    });
  }
}

function currentContext() {
  const spread = window.AstrologyPage?.lastSpread?.();
  const detail = document.getElementById('astroDetail');
  const birthDate = window.AstrologyPage?.birthDate?.() || spread?.birthDate || '';
  return {
    lang: i18n()?.lang?.() || 'en',
    sign: detail?.dataset?.sign || '',
    arcana: window.AstrologyPage?.lastFlippedArcana?.() || '',
    birthDate,
    birthYear: birthDate ? Number(String(birthDate).slice(0, 4)) : undefined,
    spread: spread
      ? {
          sun: spread.sun?.name,
          situation: spread.situation?.name,
          cross: spread.cross?.name,
          path: spread.path?.name,
        }
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

function applyLanguage(widget) {
  if (!widget) return;
  widget.welcomeHtml = welcomeHtml();
  widget.inputPlaceholder = i18n()?.t?.('chatPlaceholder') || 'Ask Rose about a sign or tarot card…';
  const input = document.querySelector('#aiChatInput, .ai-chat-input');
  if (input) input.setAttribute('placeholder', widget.inputPlaceholder);
  const welcome = document.querySelector('#aiChatMessages .ai-chat-welcome');
  if (welcome) welcome.innerHTML = widget.welcomeHtml;
}

function initChat() {
  const widget = new AIChatWidget({
    apiEndpoint: '/api/astrology/assistant/chat',
    userId: 'astrology-guest',
    sessionId: 'astrology-rose',
    title: 'Rose',
    buttonTitle: 'Ask Rose',
    inputPlaceholder: i18n()?.t?.('chatPlaceholder') || 'Ask Rose about a sign or tarot card…',
    welcomeHtml: welcomeHtml(),
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
  applyLanguage(widget);
  i18n()?.onChange?.(() => applyLanguage(widget));
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
