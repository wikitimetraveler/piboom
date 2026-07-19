/**
 * Development work by David Lane
 * HeyGen API Expert panel — LangChain chat, mic input, Google TTS.
 */
(function () {
  const SESSION_KEY = 'heygen-api-expert-session';
  const USER_KEY = 'heygen-api-expert-user';

  function $(id) {
    return document.getElementById(id);
  }

  function ensureIds() {
    let userId = localStorage.getItem(USER_KEY);
    if (!userId) {
      userId = `heygen-web-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(USER_KEY, userId);
    }
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = 'heygen-api-expert';
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return { userId, sessionId };
  }

  function appendMessage(role, text, sources) {
    const log = $('hvlExpertLog');
    if (!log) return;
    const row = document.createElement('div');
    row.className = `hvl-expert-msg hvl-expert-msg--${role}`;
    const body = document.createElement('div');
    body.className = 'hvl-expert-msg-body';
    body.textContent = text;
    row.appendChild(body);

    if (role === 'assistant' && Array.isArray(sources) && sources.length) {
      const cite = document.createElement('ul');
      cite.className = 'hvl-expert-sources';
      sources.forEach((s) => {
        const li = document.createElement('li');
        if (s.url) {
          const a = document.createElement('a');
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = `${s.id || ''} ${s.title || 'Source'}`.trim();
          li.appendChild(a);
        } else {
          li.textContent = `${s.id || ''} ${s.title || 'Source'}`.trim();
        }
        cite.appendChild(li);
      });
      row.appendChild(cite);
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function setStatus(msg, isError) {
    const el = $('hvlExpertStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('text-danger', Boolean(isError));
  }

  let lastAiResponse = '';
  let recognition = null;
  let listening = false;

  function speakAiResponse(text) {
    const clean = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    if (typeof window.speakWithGoogle === 'function') {
      window.speakWithGoogle(clean.substring(0, 500), 'en-US-Standard-D', { speakingRate: 0.95 }).catch(() => {});
    } else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(clean.substring(0, 500));
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = $('hvlExpertVoiceBtn');
    if (!SpeechRecognition || !btn) {
      if (btn) btn.style.display = 'none';
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const input = $('hvlExpertInput');
      if (input && transcript) {
        input.value = transcript;
        sendMessage({ speak: true });
      }
    };
    recognition.onerror = () => {
      listening = false;
      updateVoiceBtn();
      setStatus('Voice recognition error — try typing.', true);
    };
    recognition.onend = () => {
      listening = false;
      updateVoiceBtn();
    };

    btn.addEventListener('click', () => {
      if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
      if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
      if (listening) {
        recognition.stop();
        listening = false;
        updateVoiceBtn();
        return;
      }
      try {
        recognition.start();
        listening = true;
        updateVoiceBtn();
        setStatus('Listening…');
      } catch {
        setStatus('Could not start microphone.', true);
      }
    });
  }

  function updateVoiceBtn() {
    const btn = $('hvlExpertVoiceBtn');
    const icon = $('hvlExpertVoiceIcon');
    if (!btn || !icon) return;
    btn.classList.toggle('listening', listening);
    icon.className = listening ? 'bi bi-mic-fill' : 'bi bi-mic';
    btn.title = listening ? 'Stop listening' : 'Voice input';
  }

  async function sendMessage(opts = {}) {
    const input = $('hvlExpertInput');
    const sendBtn = $('hvlExpertSendBtn');
    const message = (input?.value || '').trim();
    if (!message) return;

    const { userId, sessionId } = ensureIds();
    appendMessage('user', message);
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    setStatus('Thinking…');

    try {
      const res = await fetch('/api/heygen-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId, sessionId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.details || `Chat failed (${res.status})`);
      }
      const reply = data.message || data.response || '';
      lastAiResponse = reply;
      appendMessage('assistant', reply, data.sources || []);
      setStatus(
        data.sources?.length
          ? `Answered with ${data.sources.length} source(s)${data.sources.some((s) => s.retrieval === 'vector') ? ' · vector RAG' : ''}.`
          : 'Answered (no retrieval hits — general knowledge).'
      );
      const tapBtn = $('hvlExpertTapHear');
      if (tapBtn) tapBtn.style.display = reply ? 'inline-flex' : 'none';
      if (opts.speak !== false) speakAiResponse(reply);
    } catch (err) {
      appendMessage('assistant', `Sorry — ${err.message}`);
      setStatus(err.message, true);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input?.focus();
    }
  }

  async function clearHistory() {
    const { userId, sessionId } = ensureIds();
    try {
      await fetch(`/api/heygen-assistant/history?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      const log = $('hvlExpertLog');
      if (log) log.innerHTML = '';
      appendMessage('assistant', 'Conversation cleared. Ask anything about HeyGen v3, Video Agent, avatars, or this repo’s /api/heygen wrappers.');
      setStatus('History cleared.');
      lastAiResponse = '';
      const tapBtn = $('hvlExpertTapHear');
      if (tapBtn) tapBtn.style.display = 'none';
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch('/api/heygen-assistant/health');
      const data = await res.json();
      const badge = $('hvlExpertHealth');
      if (!badge) return;
      const n = data.knowledge?.totalRecords ?? 0;
      const v = data.knowledge?.vectorCount ?? 0;
      badge.textContent = data.ok
        ? `${n} docs${v ? ` · ${v} vectors` : ''}`
        : 'offline';
    } catch {
      const badge = $('hvlExpertHealth');
      if (badge) badge.textContent = 'offline';
    }
  }

  function bindQuick(q) {
    const input = $('hvlExpertInput');
    if (input) input.value = q;
    sendMessage({ speak: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('hvlExpertPanel')) return;

    ensureIds();
    initVoice();
    loadHealth();

    appendMessage(
      'assistant',
      'HeyGen API Expert ready — ask about Video Agent, /v3/videos, avatars, translation, or DevConnect Labs wrappers. Mic + TTS enabled.'
    );

    $('hvlExpertSendBtn')?.addEventListener('click', () => sendMessage({ speak: true }));
    $('hvlExpertInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage({ speak: true });
      }
    });
    $('hvlExpertClearBtn')?.addEventListener('click', clearHistory);
    $('hvlExpertTapHear')?.addEventListener('click', () => speakAiResponse(lastAiResponse));

    document.querySelectorAll('[data-hvl-expert-q]').forEach((btn) => {
      btn.addEventListener('click', () => bindQuick(btn.getAttribute('data-hvl-expert-q')));
    });
  });
})();
