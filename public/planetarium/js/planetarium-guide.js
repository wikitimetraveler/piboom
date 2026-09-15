/**
 * Carl — AstroAI planetarium guide (voice + chat)
 * Development work by David Lane
 */
import AIChatWidget from '/shared/ai-chat-widget.js';

const WELCOME_THEATER = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">👽</span>
  <p>I'm <strong>Carl</strong>, your AstroAI guide — constellations, planets, moon phases, and what's up tonight.</p>
  <p class="small text-muted mb-0">Zigzag (our alien presenter) lip-syncs on video when HeyGen is live. Tap <strong>Ask Carl</strong> and speak — voice is on by default.</p>
  <small class="text-muted">Try: "What's that bright thing in the south?" or "Tell me about Orion tonight."</small>
</div>`;

const WELCOME_FIELD = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">🔭</span>
  <p>I'm <strong>Carl</strong>, your field AstroAI guide — tap a star or planet, then ask.</p>
  <p class="small text-muted mb-0">Voice is on by default. Face locks the sky to your phone heading outdoors.</p>
  <small class="text-muted">Try: "Show me Jupiter" or "What's that bright thing in the south?"</small>
</div>`;

const WELCOME_WORLD = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">🪐</span>
  <p>I'm <strong>Carl</strong>, your AstroAI guide for this world page — globe, missions, and research notes.</p>
  <p class="small text-muted mb-0">Voice is on by default. Ask about the landmark, spacecraft history, or how this body looks in tonight's sky.</p>
  <small class="text-muted">Try: "Tell me about the landmark" or "What missions visited here?"</small>
</div>`;

const WELCOME_SPACEX = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">🚀</span>
  <p>I'm <strong>Carl</strong>, your AstroAI guide for the SpaceX pad — Falcon 1, Falcon 9, Falcon Heavy, and Starship.</p>
  <p class="small text-muted mb-0">Zigzag is in the hangar with Elon. Tap <strong>Ask Carl</strong> and speak — voice is on by default.</p>
  <small class="text-muted">Try: "Walk me through Falcon Heavy" or "What's the next launch?"</small>
</div>`;

const WELCOME_STATION = `<div class="plan-carl-welcome">
  <span class="plan-carl-welcome__avatar" aria-hidden="true">🛰️</span>
  <p>I'm <strong>Carl</strong>, your AstroAI guide for the ISS station world — modules, crew, and the view over Earth.</p>
  <p class="small text-muted mb-0">Zigzag is walking the stack. Tap <strong>Ask Carl</strong> and speak — voice is on by default.</p>
  <small class="text-muted">Try: "Who is sleeping in Harmony?" or "What is Cupola for?"</small>
</div>`;

const ALIENIGENA_HANDOFF = 'Carl has the sky on this one.';
const ROSE_HANDOFF =
  "That's Rose's parlor — tropical signs and a full tarot deck, not the real sky. Opening her page for you.";

function isAstrologyIntent(text) {
  return /\b(zodiac|horoscope|sun sign|moon sign|rising sign|tarot|astrology|major arcana|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|the fool|the magician|the tower|the star|the moon|the sun|the world)\b/i.test(
    String(text || '')
  );
}

function handoffToRose(text) {
  const widget = window.aiChatWidget;
  if (widget && typeof widget.addMessage === 'function') {
    widget.addMessage(ROSE_HANDOFF, 'assistant');
  }
  const q = String(text || '').trim();
  const url = new URL('/entertainment/astrology.html', window.location.origin);
  if (/\breading\b|\bspread\b|\bbirthday\b/i.test(q)) url.searchParams.set('reading', '1');
  const signMatch = q.match(
    /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i
  );
  if (signMatch) url.searchParams.set('sign', signMatch[1].toLowerCase());
  window.setTimeout(() => {
    window.location.href = url.pathname + url.search;
  }, 900);
}

function isSpacexPage() {
  return !!(document.body?.classList.contains('plan-spacex') || window.PlanetariumSpacex);
}

function isStationPage() {
  return !!(document.body?.classList.contains('plan-station') || window.PlanetariumStation);
}

function isWorldPage() {
  return !!(window.__PLANETARIUM_WORLD || document.body?.classList.contains('plan-world-page'));
}

function worldIdFromPage() {
  const w = window.__PLANETARIUM_WORLD;
  if (w && typeof w === 'object' && w.id) return String(w.id);
  try {
    const id = new URLSearchParams(window.location.search).get('id') ||
      new URLSearchParams(window.location.search).get('body');
    return id ? String(id).toLowerCase() : 'mars';
  } catch (_) {
    return 'mars';
  }
}

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
  if (typeof window.isAgentSpeechMuted === 'function' && window.isAgentSpeechMuted()) return;
  try {
    window.ensureAudioUnlock?.();
    window.primeSpeechSynthesis?.();
  } catch (_) {
    /* ignore */
  }
  if (typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(clean, 'en-US-Standard-D');
  }
  const heygen = window.PlanetariumHeygen;
  if (heygen?.isLive?.() && typeof heygen.speak === 'function') {
    try {
      await heygen.speak(ALIENIGENA_HANDOFF);
      await heygen.speak(clean);
    } catch (_) {
      /* TTS optional */
    }
    return;
  }
  heygen?.speak?.(clean);
}

/** Fresh dome / world snapshot every Carl turn. */
function getSkyContext() {
  if (isStationPage() && typeof window.PlanetariumStation?.getCarlContext === 'function') {
    return {
      ...window.PlanetariumStation.getCarlContext(),
      clientSentAt: new Date().toISOString(),
    };
  }
  if (isSpacexPage() && typeof window.PlanetariumSpacex?.getCarlContext === 'function') {
    return {
      ...window.PlanetariumSpacex.getCarlContext(),
      clientSentAt: new Date().toISOString(),
    };
  }
  if (isWorldPage() && typeof window.__PLANETARIUM_WORLD?.getSkyContext === 'function') {
    return {
      ...window.__PLANETARIUM_WORLD.getSkyContext(),
      clientSentAt: new Date().toISOString(),
    };
  }
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
  const fieldApp = !!(window.__PLANETARIUM_FIELD || document.body?.classList.contains('plan-field'));
  const worldApp = isWorldPage();
  const spacexApp = isSpacexPage();
  const stationApp = isStationPage();
  const worldId = worldApp ? worldIdFromPage() : null;
  const widget = new AIChatWidget({
    apiEndpoint: '/api/planetarium/assistant/chat',
    userId: 'planetarium-guest',
    sessionId: stationApp
      ? 'planetarium-carl-station'
      : spacexApp
        ? 'planetarium-carl-spacex'
        : worldApp
          ? 'planetarium-carl-' + worldId
          : 'planetarium-carl',
    title: stationApp
      ? 'Carl · ISS'
      : spacexApp
        ? 'Carl · SpaceX'
        : worldApp
          ? 'Carl · ' + (window.__PLANETARIUM_WORLD?.name || worldId || 'World')
          : 'Carl · AstroAI',
    buttonTitle: stationApp
      ? 'Ask Carl about the space station'
      : spacexApp
        ? 'Ask Carl about SpaceX rockets'
        : worldApp
          ? 'Ask Carl about this world'
          : 'Ask Carl about the sky',
    inputPlaceholder: stationApp
      ? 'Ask about Destiny, Cupola, who is aboard…'
      : spacexApp
        ? 'Ask about Falcon 9, Starship, the next launch…'
        : worldApp
          ? 'Tell me about this world…'
          : 'What is up tonight? Show me Jupiter…',
    welcomeHtml: stationApp
      ? WELCOME_STATION
      : spacexApp
        ? WELCOME_SPACEX
        : worldApp
          ? WELCOME_WORLD
          : fieldApp
            ? WELCOME_FIELD
            : WELCOME_THEATER,
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
      if (isAstrologyIntent(msg)) {
        if (!widget.isOpen && typeof widget.open === 'function') widget.open();
        if (typeof widget.addMessage === 'function') widget.addMessage(String(msg || ''), 'user');
        handoffToRose(msg);
        return;
      }
      if (!worldApp && !spacexApp && !stationApp) {
        try {
          await trySlewFromText(msg);
        } catch (_) {
          /* slew optional */
        }
      }
      return origSend(msg);
    };
  }

  document.querySelectorAll('#planAskCarl, #sxAskCarl, #stAskCarl').forEach((btn) => {
    btn.addEventListener('click', () => {
      openChat(null, { startVoice: true });
    });
  });
  window.PlanetariumAskCarl = (msg) => openChat(msg, { startVoice: !msg });
  if (!worldApp && !spacexApp && !stationApp) bindSkyContextRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
