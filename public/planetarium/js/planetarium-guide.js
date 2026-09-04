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

const PLANET_ALIASES = {
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
};

/** Client-side slew when the visitor says "show me Jupiter / M42 / Orion". */
async function trySlewFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const show =
    raw.match(
      /\b(?:show|center|find|goto|go\s+to|slew|point\s+(?:me\s+)?(?:at|to)|where\s+is)\s+(?:me\s+)?(?:the\s+)?(.+?)(?:\?|$)/i
    ) || raw.match(/^\s*(moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|m\d{1,3}|orion|iss)\s*$/i);
  if (!show) return false;
  let target = String(show[1] || show[0] || '')
    .replace(/\b(please|tonight|now|in the sky)\b/gi, '')
    .trim()
    .toLowerCase();
  if (!target || target.length > 48) return false;

  const P = window.Planetarium;
  const Engine = window.CelestialEngine;
  const live = P?._live;
  if (!P || !live?.getState) return false;
  const st = live.getState();

  const planetKey = PLANET_ALIASES[target] || PLANET_ALIASES[target.replace(/\s+/g, '')];
  if (planetKey && Engine) {
    const body = Engine.bodyAltAz(planetKey, st.date, st.observer);
    if (body) {
      P.selectSkyObject(
        { type: 'planet', id: body.id, name: body.name, alt: body.alt, az: body.az, ra: body.ra, dec: body.dec },
        { center: true }
      );
      return true;
    }
  }

  if (target === 'iss' && st.issPos && Number.isFinite(st.issPos.az)) {
    P.selectSkyObject(
      { type: 'iss', id: 'iss', name: 'ISS', alt: st.issPos.alt, az: st.issPos.az },
      { center: true }
    );
    return true;
  }

  // Catalog / Messier
  try {
    const res = await fetch('/api/planetarium/catalog/search?q=' + encodeURIComponent(target));
    const data = await res.json();
    const hit = (data.results || [])[0];
    if (hit && P.objectAltAz) {
      const pos = P.objectAltAz(hit.ra, hit.dec);
      P.selectSkyObject(
        {
          type: 'catalog',
          id: hit.id,
          name: hit.name,
          alt: pos?.alt ?? null,
          az: pos?.az ?? null,
          ra: hit.ra,
          dec: hit.dec,
        },
        { center: true }
      );
      return true;
    }
  } catch (_) {
    /* ignore */
  }

  // Constellation by name
  const constellation = (st.constellationData || []).find(
    (c) => c.id === target || String(c.name).toLowerCase() === target || String(c.name).toLowerCase().includes(target)
  );
  if (constellation && Engine) {
    let alt = 0;
    let az = 0;
    let n = 0;
    (constellation.lines || []).forEach((seg) => {
      (seg || []).forEach((pt) => {
        if (!pt || pt.length < 2) return;
        const aa = Engine.equatorialToAltAz(pt[0], pt[1], st.date, st.observer);
        if (aa.alt < 0) return;
        alt += aa.alt;
        az += aa.az;
        n += 1;
      });
    });
    if (n) {
      P.selectSkyObject(
        {
          type: 'constellation',
          id: constellation.id,
          name: constellation.name,
          alt: alt / n,
          az: az / n,
        },
        { center: true }
      );
      return true;
    }
  }
  return false;
}

function bindSkyContextRefresh() {
  ['planDate', 'planTime', 'planFacing', 'planNow', 'planTonight', 'planGeolocate', 'planPlay'].forEach((id) => {
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
    inputPlaceholder: 'What is up tonight? Show me Jupiter…',
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

  if (typeof widget.sendMessage === 'function') {
    const origSend = widget.sendMessage.bind(widget);
    widget.sendMessage = async (msg) => {
      try {
        await trySlewFromText(msg);
      } catch (_) {
        /* slew optional */
      }
      return origSend(msg);
    };
  }

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
