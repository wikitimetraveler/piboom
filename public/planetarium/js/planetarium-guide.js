/**
 * Carl — AstroAI planetarium guide (voice + chat)
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const WELCOME = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">👽</span>
  <p>I'm <strong>Carl</strong>, your AstroAI guide — constellations, planets, moon phases, and what's up tonight.</p>
  <p class="small text-muted mb-0">Zed (our alien presenter) lip-syncs on video when HeyGen is live. Tap <strong>Ask Carl</strong> and speak — voice is on by default.</p>
  <small class="text-muted">Try: "What's that bright thing in the south?" or "Tell me about Orion tonight."</small>
</div>`;

const ZED_HANDOFF = 'Carl has the sky on this one.';

function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

async function speakReply(text) {
  const clean = forSpeech(text);
  if (!clean) return;
  if (typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(clean, 'en-US-Standard-D');
  }
  const heygen = window.PlanetariumHeygen;
  if (heygen?.isLive?.() && typeof heygen.speak === 'function') {
    try {
      await heygen.speak(ZED_HANDOFF);
      await heygen.speak(clean);
    } catch (_) {
      /* TTS optional */
    }
    return;
  }
  heygen?.speak?.(clean);
}

/** Fresh dome snapshot every Carl turn (date, facing, selection). */
function getSkyContext() {
  const live = window.Planetarium?.getSkyContext?.() || {};
  return {
    ...live,
    clientSentAt: new Date().toISOString(),
  };
}

function openChat(prefill, { startVoice = false } = {}) {
  const widget = window.aiChatWidget;
  if (!widget) return;
  if (typeof widget.open === 'function') widget.open();
  else widget.toggle?.();

  const message = String(prefill || '').trim();
  if (message && typeof widget.sendMessage === 'function') {
    window.setTimeout(() => widget.sendMessage(message), 180);
    return;
  }

  if (startVoice && typeof widget.toggleVoice === 'function') {
    window.setTimeout(() => {
      try {
        const voice = widget.ensureVoiceRecognition?.();
        const already = voice && widget.isVoiceListening?.(voice);
        if (!already) widget.toggleVoice();
      } catch (_) {
        widget.toggleVoice();
      }
    }, 220);
  }
}

function noteSkyControlsChanged() {
  const status = document.getElementById('planStatus');
  if (status && !document.fullscreenElement) {
    status.textContent = 'Sky updated — Ask Carl for a fresh read.';
  }
}

function bindSkyContextRefresh() {
  ['planDate', 'planTime', 'planFacing', 'planNow', 'planTonight', 'planGeolocate'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.tagName === 'BUTTON' ? 'click' : 'change';
    el.addEventListener(ev, () => {
      window.setTimeout(noteSkyControlsChanged, 40);
    });
  });
}

function initChat() {
  const widget = new AIChatWidget({
    apiEndpoint: '/api/planetarium/assistant/chat',
    userId: 'planetarium-guest',
    sessionId: 'planetarium-carl',
    title: 'Carl · AstroAI',
    buttonTitle: 'Ask Carl about the sky',
    inputPlaceholder: 'What is up tonight? Orion? Jupiter?',
    welcomeHtml: WELCOME,
    getContext: () => ({ skyContext: getSkyContext() }),
    onMessageSent: () => {
      if (typeof window.aiChatWidget?.open === 'function') window.aiChatWidget.open();
    },
    onMessageReceived: (response) => {
      if (typeof window.aiChatWidget?.open === 'function') window.aiChatWidget.open();
      speakReply(response);
    },
  });

  window.aiChatWidget = widget;

  document.getElementById('planAskCarl')?.addEventListener('click', () => {
    openChat(null, { startVoice: true });
  });
  window.PlanetariumAskCarl = (msg) => openChat(msg, { startVoice: !msg });
  bindSkyContextRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
