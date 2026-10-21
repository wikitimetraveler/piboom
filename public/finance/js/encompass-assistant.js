/**
 * Development work by David Lane
 * Encompass Developer AI Expert — chat UI, code formatter, knowledge bank, voice/TTS.
 */
(function () {
  'use strict';

  const API = '/api/encompass';
  const SESSION_KEY = 'encompass-dev-expert-session';
  const USER_KEY = 'encompass-dev-expert-user';
  const DEFAULT_SESSION = 'encompass-dev-expert';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureIds() {
    let userId = localStorage.getItem(USER_KEY);
    if (!userId) {
      userId = `encompass-web-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(USER_KEY, userId);
    }
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = DEFAULT_SESSION;
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return { userId, sessionId };
  }

  let lastAiResponse = '';
  let recognition = null;
  let listening = false;
  let searchSource = 'all';
  let knowledgeConstellation = null;
  let lastSources = [];

  function setStatus(msg, isError) {
    const el = $('eaStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('text-danger', Boolean(isError));
  }

  function formatSourceType(type) {
    const map = {
      code_reference: 'Code Reference',
      api_reference: 'Postman / API',
      official_doc: 'Developer Connect',
      curated: 'Curated',
      knowledge: 'ICE Knowledge'
    };
    return map[type] || type || '';
  }

  function highlightMethods(html) {
    return html.replace(
      /\b(GET|POST|PATCH|PUT|DELETE)\b/g,
      (m) => `<span class="ea-method ${m.toLowerCase()}">${m}</span>`
    );
  }

  function linkCitations(html, sources) {
    return html.replace(/\[S(\d+)\]/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      const src = Array.isArray(sources) ? sources[idx] : null;
      const href = src?.url || `#source-S${num}`;
      const title = escapeHtml(src?.title || `Source ${num}`);
      return `<a class="ea-cite-ref" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${title}">[S${num}]</a>`;
    });
  }

  function renderMarkdown(text, sources) {
    let raw = String(text || '');
    const blocks = [];
    raw = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const id = blocks.length;
      blocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
      return `\n%%CODEBLOCK_${id}%%\n`;
    });

    let html = escapeHtml(raw);
    html = html.replace(/^### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?:\n(?!<li>)|$)/g, (m) => {
      if (m.includes('<ul')) return m;
      return `<ul>${m.replace(/\n/g, '')}</ul>`;
    });
    html = html
      .split(/\n{2,}/)
      .map((para) => {
        const t = para.trim();
        if (!t) return '';
        if (t.startsWith('<h') || t.startsWith('<ul') || t.startsWith('%%CODEBLOCK_')) return t;
        return `<p>${t.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    html = highlightMethods(html);
    html = linkCitations(html, sources);

    blocks.forEach((block, id) => {
      const safeCode = escapeHtml(block.code);
      const blockHtml = `<div class="ea-code-block">
        <div class="ea-code-head">
          <span>${escapeHtml(block.lang)}</span>
          <button type="button" data-ea-copy="${id}">Copy</button>
        </div>
        <pre><code id="ea-code-${id}">${safeCode}</code></pre>
      </div>`;
      html = html.replace(`%%CODEBLOCK_${id}%%`, blockHtml);
      // store raw for copy
      window.__eaCodeBlocks = window.__eaCodeBlocks || {};
      window.__eaCodeBlocks[id] = block.code;
    });

    return html;
  }

  function buildSourcesHtml(sources) {
    if (!Array.isArray(sources) || !sources.length) return '';
    const items = sources
      .map((s) => {
        const title = escapeHtml(s.title || 'Source');
        const link = s.url
          ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
          : title;
        const meta = [s.id, formatSourceType(s.sourceType), s.repo, s.retrieval, s.category]
          .filter(Boolean)
          .map(escapeHtml)
          .join(' · ');
        const path = s.path ? `<div class="meta">${escapeHtml(s.path)}</div>` : '';
        const snip = s.content || s.excerpt
          ? `<div class="snippet">${escapeHtml(String(s.content || s.excerpt).slice(0, 220))}</div>`
          : '';
        return `<li id="source-${escapeHtml(s.id || '')}"><strong>${link}</strong><div class="meta">${meta}</div>${path}${snip}</li>`;
      })
      .join('');
    return `<details class="ea-sources" open><summary>Sources (${sources.length})</summary><ul>${items}</ul></details>`;
  }

  function appendMessage(role, text, sources) {
    const log = $('eaMessages');
    if (!log) return;
    const row = document.createElement('div');
    row.className = `ea-msg ${role === 'user' ? 'user' : 'ai'}`;

    if (role === 'user') {
      row.innerHTML = `<div class="ea-msg-label">You</div><div class="ea-msg-body">${escapeHtml(text)}</div>`;
    } else {
      const body = renderMarkdown(text, sources);
      row.innerHTML = `<div class="ea-msg-label">Encompass Dev Expert</div><div class="ea-msg-body">${body}</div>${buildSourcesHtml(sources)}`;
      row.querySelectorAll('[data-ea-copy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-ea-copy');
          const code = (window.__eaCodeBlocks && window.__eaCodeBlocks[id]) || '';
          navigator.clipboard?.writeText(code).then(() => {
            btn.textContent = 'Copied';
            setTimeout(() => {
              btn.textContent = 'Copy';
            }, 1200);
          }).catch(() => {});
        });
      });
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping(on) {
    const el = $('eaTyping');
    if (!el) return;
    el.classList.toggle('on', Boolean(on));
  }

  function speakAiResponse(text) {
    const clean = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    if (!$('eaSpeakToggle')?.checked) return;
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

  function stopSpeech() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = $('eaVoiceBtn');
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
      const input = $('eaInput');
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
    const btn = $('eaVoiceBtn');
    const icon = $('eaVoiceIcon');
    if (!btn || !icon) return;
    btn.classList.toggle('listening', listening);
    icon.className = listening ? 'bi bi-mic-fill' : 'bi bi-mic';
    btn.title = listening ? 'Stop listening' : 'Voice input';
  }

  async function sendMessage(opts = {}) {
    const input = $('eaInput');
    const sendBtn = $('eaSendBtn');
    const message = (input?.value || '').trim();
    if (!message) return;

    const { userId, sessionId } = ensureIds();
    appendMessage('user', message);
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    showTyping(true);
    setStatus('Thinking…');

    try {
      const res = await fetch(`${API}/chat`, {
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
      lastSources = data.sources || data.context || [];
      appendMessage('assistant', reply, lastSources);
      updateConstellation(lastSources);
      const mode = data.mode === 'retrieval-fallback' ? ' · retrieval fallback' : '';
      setStatus(
        data.sources?.length
          ? `Answered with ${data.sources.length} source(s)${
              data.sources.some((s) => s.retrieval === 'vector') ? ' · vector RAG' : ''
            }${mode}.`
          : `Answered${mode}.`
      );
      const tapBtn = $('eaTapHear');
      if (tapBtn) tapBtn.style.display = reply ? 'inline-flex' : 'none';
      if (opts.speak !== false) speakAiResponse(reply);
    } catch (err) {
      appendMessage('assistant', `Sorry — ${err.message}`);
      setStatus(err.message, true);
    } finally {
      showTyping(false);
      if (sendBtn) sendBtn.disabled = false;
      input?.focus();
    }
  }

  async function clearHistory() {
    const { userId, sessionId } = ensureIds();
    try {
      await fetch(
        `${API}/history?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' }
      );
      const log = $('eaMessages');
      if (log) log.innerHTML = '';
      appendMessage(
        'assistant',
        'Conversation cleared. Ask about OAuth, Pipeline, Field Reader/Writer, Enhanced Conditions, TPO Connect, webhooks, or ICE sample repos.'
      );
      setStatus('History cleared.');
      lastAiResponse = '';
      lastSources = [];
      const tapBtn = $('eaTapHear');
      if (tapBtn) tapBtn.style.display = 'none';
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function layoutKnowledgeGraph(nodes) {
    const width = 640;
    const height = 280;
    const cx = width / 2;
    const cy = height / 2;
    const positioned = new Map();
    const hubs = nodes.filter((n) => n.kind === 'hub');
    const cats = nodes.filter((n) => n.kind === 'category');
    const docs = nodes.filter((n) => n.kind === 'document');

    hubs.forEach((n) => positioned.set(n.id, { x: cx, y: cy, ...n }));
    cats.forEach((n, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(cats.length, 1) - Math.PI / 2;
      const r = 95;
      positioned.set(n.id, {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        ...n
      });
    });
    docs.forEach((n, i) => {
      const parentCat = [...positioned.values()].find(
        (p) => p.kind === 'category' && String(n.id).includes(String(p.id).replace('cat:', ''))
      ) || { x: cx, y: cy };
      // simpler: attach to nearest category by index
      const catList = [...positioned.values()].filter((p) => p.kind === 'category');
      const parent = catList[i % Math.max(catList.length, 1)] || { x: cx, y: cy };
      const angle = (Math.PI * 2 * i) / Math.max(docs.length, 1);
      const r = 36;
      positioned.set(n.id, {
        x: parent.x + Math.cos(angle) * r,
        y: parent.y + Math.sin(angle) * r,
        ...n
      });
      void parentCat;
    });
    return positioned;
  }

  function renderKnowledgeGraph(graph) {
    const svg = $('eaKnowledgeGraph');
    if (!svg) return;
    const nodes = graph?.nodes || [];
    const links = graph?.links || [];
    const positioned = layoutKnowledgeGraph(nodes);

    const linkSvg = links
      .map((link) => {
        const a = positioned.get(link.source);
        const b = positioned.get(link.target);
        if (!a || !b) return '';
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#64748b" stroke-opacity="0.35" stroke-width="1.2" />`;
      })
      .join('');

    const nodeSvg = [...positioned.values()]
      .map((n) => {
        const fill =
          n.kind === 'hub' ? '#0f766e' : n.kind === 'category' ? '#2563eb' : '#94a3b8';
        const r = n.kind === 'hub' ? 20 : n.kind === 'category' ? 12 : 6;
        const label =
          n.kind === 'document'
            ? ''
            : `<text x="${n.x}" y="${n.y + r + 11}" text-anchor="middle" font-size="10" fill="#cbd5e1">${escapeHtml(
                String(n.label || '').slice(0, 16)
              )}</text>`;
        return `<g><circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1.5" />${label}</g>`;
      })
      .join('');

    svg.setAttribute('viewBox', '0 0 640 280');
    svg.innerHTML = `${linkSvg}${nodeSvg}`;

    const caption = $('eaKnowledgeGraphCaption');
    if (caption && graph?.summary) {
      const s = graph.summary;
      caption.textContent = `${s.totalRecords || 0} slips · ${s.vectorCount || 0} vectors · indexed ${
        s.lastIndexed ? new Date(s.lastIndexed).toLocaleString() : 'n/a'
      }`;
    }
  }

  function updateConstellation(rows) {
    if (!knowledgeConstellation) return;
    knowledgeConstellation.setNeighbors(rows || []);
    const caption = $('eaConstellationCaption');
    if (caption) {
      const n = Array.isArray(rows) ? rows.length : 0;
      caption.textContent = n
        ? `${n} RAG neighbor(s) · backend ${knowledgeConstellation.backend} · click a glow for the source`
        : 'Constellation paints server-returned RAG neighbors. Search or chat to populate.';
    }
  }

  async function bootConstellation() {
    const canvas = $('eaKnowledgeConstellation');
    if (!canvas || !window.WebGpuKnowledgeConstellation) return;
    try {
      knowledgeConstellation = await window.WebGpuKnowledgeConstellation.mount({
        canvas,
        onSelect(n) {
          if (n?.url) window.open(n.url, '_blank', 'noopener,noreferrer');
        }
      });
    } catch (err) {
      console.warn('Knowledge constellation failed', err);
    }
  }

  function renderHits(rows) {
    const host = $('eaKnowledgeHits');
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<li class="text-muted">No matches in the knowledge bank.</li>';
      updateConstellation([]);
      return;
    }
    host.innerHTML = rows
      .map((row) => {
        const title = escapeHtml(row.title || 'Untitled');
        const meta = escapeHtml(
          [row.retrieval, formatSourceType(row.sourceType), row.repo, row.category]
            .filter(Boolean)
            .join(' · ')
        );
        const excerpt = escapeHtml(String(row.content || row.excerpt || '').slice(0, 180));
        const link = row.url
          ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
          : title;
        return `<li><div><strong>${link}</strong></div><div class="hit-meta">${meta}</div><div>${excerpt}</div></li>`;
      })
      .join('');
    updateConstellation(rows);
  }

  async function runKnowledgeSearch() {
    const q = ($('eaKnowledgeSearch')?.value || '').trim();
    if (!q) return;
    try {
      const res = await fetch(
        `${API}/search?q=${encodeURIComponent(q)}&limit=10&source=${encodeURIComponent(searchSource)}`
      );
      const data = await res.json();
      renderHits(data.data || []);
      setStatus(`Found ${data.results || 0} knowledge hit(s).`);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function renderQuickPrompts(prompts) {
    const host = $('eaQuickPrompts');
    if (!host) return;
    if (!Array.isArray(prompts) || !prompts.length) return;
    host.innerHTML = prompts
      .map(
        (p) =>
          `<button type="button" class="ea-chip" data-q="${escapeHtml(p.question)}"><i class="bi bi-lightning"></i>${escapeHtml(
            p.label
          )}</button>`
      )
      .join('');
    host.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = $('eaInput');
        if (input) input.value = btn.getAttribute('data-q');
        sendMessage({ speak: true });
      });
    });
  }

  function renderRepos(repos) {
    const host = $('eaRepoList');
    if (!host || !Array.isArray(repos)) return;
    host.innerHTML = repos
      .map(
        (r) =>
          `<a class="ea-repo-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(
            r.summary || ''
          )}"><i class="bi bi-github"></i> ${escapeHtml(r.name)}</a>`
      )
      .join('');
  }

  function renderSurfaces(surfaces) {
    const host = $('eaSurfaceList');
    if (!host || !Array.isArray(surfaces)) return;
    host.innerHTML = surfaces
      .filter((s) => s.path && String(s.path).startsWith('/'))
      .map(
        (s) =>
          `<a class="ea-repo-link" href="${escapeHtml(s.path)}" title="${escapeHtml(s.purpose || '')}"><i class="bi bi-box-arrow-up-right"></i> ${escapeHtml(
            s.name
          )}</a>`
      )
      .join('');
  }

  async function loadHealth() {
    try {
      const [healthRes, graphRes] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/graph?limit=3`)
      ]);
      const health = await healthRes.json().catch(() => ({}));
      const graph = await graphRes.json().catch(() => ({}));
      const k = health.knowledge || {};
      const docs = k.docs || {};
      const ice = k.ice || {};

      const dot = $('eaHealthDot');
      const label = $('eaHealthLabel');
      const ok = Boolean(health.ok && health.openaiConfigured);
      if (dot) {
        dot.classList.toggle('ok', ok);
        dot.classList.toggle('warn', health.ok && !health.openaiConfigured);
        dot.classList.toggle('bad', !health.ok);
      }
      if (label) {
        label.textContent = ok
          ? 'ready'
          : health.openaiConfigured === false
            ? 'OPENAI off (retrieval fallback)'
            : 'unavailable';
      }

      const docsBadge = $('eaDocsBadge');
      if (docsBadge) {
        docsBadge.textContent = `${docs.totalSections || 0} Dev Connect docs · ${docs.vectorCount || 0} vectors`;
      }
      const iceBadge = $('eaIceBadge');
      if (iceBadge) {
        iceBadge.textContent = `${ice.totalRecords || 0} ICE records · ${ice.vectorCount || 0} vectors`;
      }
      const ragBadge = $('eaRagBadge');
      if (ragBadge) {
        ragBadge.textContent = 'hybrid RAG · two currents, one dock';
      }
      const modelBadge = $('eaModelBadge');
      if (modelBadge) {
        modelBadge.textContent = health.openaiConfigured ? 'OpenAI on' : 'OpenAI off';
      }

      renderQuickPrompts(k.quickPrompts);
      renderRepos(k.repos);
      renderSurfaces(k.surfaces);
      renderKnowledgeGraph(graph);
    } catch {
      const label = $('eaHealthLabel');
      if (label) label.textContent = 'unreachable';
      const dot = $('eaHealthDot');
      if (dot) {
        dot.classList.add('bad');
        dot.classList.remove('ok');
      }
    }
  }

  function renderEncompassTools() {
    const grid = $('encompassToolGrid');
    const section = $('encompassAppsSection');
    if (!grid || !window.MENU_CONFIG) return;
    const loggedIn = typeof window.isLoggedIn === 'function' && window.isLoggedIn();
    const tools =
      typeof window.MENU_CONFIG.getMortgageTools === 'function'
        ? window.MENU_CONFIG.getMortgageTools(loggedIn)
        : window.MENU_CONFIG.ENCOMPASS_TOOLS || [];
    grid.innerHTML = window.MENU_CONFIG.renderDomainGridItems(tools, {
      loggedIn,
      category: 'Mortgage'
    });
    if (section) section.hidden = !loggedIn || !grid.innerHTML;
    const current = (location.pathname || '').toLowerCase();
    grid.querySelectorAll('.domain-tile').forEach((tile) => {
      const href = (tile.getAttribute('href') || '').toLowerCase();
      tile.classList.toggle('active', href && (current === href || current.endsWith(href)));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureIds();
    initVoice();
    loadHealth();
    bootConstellation();
    renderEncompassTools();

    appendMessage(
      'assistant',
      'Encompass Developer AI Expert ready — ask about OAuth, Pipeline cursors, V3 Field Reader/Writer, Enhanced Conditions, TPO Connect / SSF, webhooks, Postman, or our ICE sample repos. Mic + Google TTS available; answers cite hybrid RAG sources.'
    );

    const dt = $('dt');
    if (dt) dt.textContent = new Date().toLocaleDateString();

    $('eaSendBtn')?.addEventListener('click', () => sendMessage({ speak: true }));
    $('eaInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage({ speak: true });
      }
    });
    $('eaClearBtn')?.addEventListener('click', clearHistory);
    $('eaTapHear')?.addEventListener('click', () => speakAiResponse(lastAiResponse));
    $('eaReplayBtn')?.addEventListener('click', () => speakAiResponse(lastAiResponse));
    $('eaStopBtn')?.addEventListener('click', stopSpeech);
    $('btnEaKnowledgeSearch')?.addEventListener('click', runKnowledgeSearch);
    $('eaKnowledgeSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runKnowledgeSearch();
      }
    });

    document.querySelectorAll('[data-ea-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        searchSource = btn.getAttribute('data-ea-source') || 'all';
        document.querySelectorAll('[data-ea-source]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('[data-ea-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = $('eaInput');
        if (input) input.value = btn.getAttribute('data-ea-q');
        sendMessage({ speak: true });
      });
    });

    window.addEventListener('user-logged-in', renderEncompassTools);
    window.addEventListener('storage', renderEncompassTools);
  });
})();
