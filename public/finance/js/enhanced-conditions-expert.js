/**
 * Development work by David Lane
 * Enhanced Conditions Expert chat UI.
 */
(() => {
  const API = '/api/encompass-conditions/assistant';
  const SESSION_ID = 'enhanced-conditions-expert';
  const USER_ID = `ece-${Math.random().toString(36).slice(2, 10)}`;

  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const clearBtn = document.getElementById('clearBtn');
  const ttsToggle = document.getElementById('ttsToggle');
  const healthDot = document.getElementById('healthDot');
  const healthLabel = document.getElementById('healthLabel');
  const knowledgeStatus = document.getElementById('knowledgeStatus');
  const externalDocs = document.getElementById('externalDocs');

  /** @type {{ role: string, content: string }[]} */
  let history = [];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function addMessage(role, content, citations = []) {
    const div = document.createElement('div');
    div.className = `ece-msg ${role === 'user' ? 'user' : 'ai'}`;
    let html = escapeHtml(content);
    if (citations?.length) {
      const items = citations
        .map((cite) => {
          const label = escapeHtml(`${cite.id}: ${cite.title || 'Source'}`);
          if (cite.url) {
            return `<li><a href="${escapeHtml(cite.url)}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
          }
          return `<li>${label}</li>`;
        })
        .join('');
      html += `<div class="cite"><strong>Sources</strong><ul class="mb-0 ps-3">${items}</ul></div>`;
    }
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function speak(text) {
    if (!ttsToggle?.checked || !text) return;
    try {
      if (window.DevConnectTTS?.speakWithGoogle) {
        window.DevConnectTTS.speakWithGoogle(text);
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    } catch {
      // ignore TTS failures
    }
  }

  async function refreshStatus() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      const ok = Boolean(data.ok && data.openaiConfigured);
      healthDot.classList.toggle('ok', ok);
      healthDot.classList.toggle('bad', !ok);
      healthLabel.textContent = ok ? 'ready' : data.openaiConfigured === false ? 'OPENAI_API_KEY missing' : 'unavailable';

      const expert = data.expert || {};
      const handoff = expert.handoff || {};
      const s = handoff.summary;
      const lanes = expert.rag?.lanes || [];
      const laneLines = lanes
        .map((lane) => {
          const mode = lane.vectorReady ? 'vector+keyword' : lane.table?.includes('fact-sheet') ? 'always on' : 'keyword';
          return `<div>· ${escapeHtml(lane.label)} — <strong>${mode}</strong></div>`;
        })
        .join('');
      knowledgeStatus.innerHTML = [
        `<div><strong>${escapeHtml(expert.title || 'Enhanced Conditions Expert')}</strong></div>`,
        `<div>${expert.conceptCount || 0} concepts · ${expert.apiCount || 0} APIs · ${expert.faqCount || 0} FAQs</div>`,
        laneLines ? `<div class="mt-2"><strong>RAG lanes</strong>${laneLines}</div>` : '',
        handoff.available && s
          ? `<div class="mt-2">Handoff on disk: <strong>${s.conditionsConverted}</strong> templates, `
            + `<strong>${s.conditionTypes}</strong> types, <strong>${s.aclProfiles}</strong> ACL profiles</div>`
          : '<div class="mt-2">No handoff pack on disk yet — run Condition Manager first.</div>',
      ].join('');

      const links = Array.isArray(expert.officialLinks) ? expert.officialLinks : [];
      if (!links.length) {
        externalDocs.innerHTML = 'No external docs listed.';
      } else {
        const byGroup = new Map();
        for (const link of links) {
          const group = link.group || 'Docs';
          if (!byGroup.has(group)) byGroup.set(group, []);
          byGroup.get(group).push(link);
        }
        externalDocs.innerHTML = [...byGroup.entries()]
          .map(([group, items]) => {
            const anchors = items
              .map(
                (link) =>
                  `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a>`,
              )
              .join('');
            return `<div class="ece-docs-group"><strong>${escapeHtml(group)}</strong>${anchors}</div>`;
          })
          .join('');
      }
    } catch {
      healthDot.classList.add('bad');
      healthLabel.textContent = 'unreachable';
      knowledgeStatus.textContent = 'Could not load expert summary.';
      if (externalDocs) externalDocs.textContent = 'Could not load external docs.';
    }
  }

  async function sendMessage(raw) {
    const message = String(raw || '').trim();
    if (!message) return;

    addMessage('user', message);
    history.push({ role: 'user', content: message });
    input.value = '';
    sendBtn.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'ece-msg ai';
    typing.textContent = 'Thinking…';
    messagesEl.appendChild(typing);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: history.slice(0, -1),
          userId: USER_ID,
          sessionId: SESSION_ID,
        }),
      });
      const data = await res.json();
      typing.remove();
      if (!res.ok) {
        addMessage('ai', data.error || 'Chat failed.');
        return;
      }
      const reply = data.reply || data.response || data.message || '';
      addMessage('ai', reply, data.citations || []);
      history.push({ role: 'assistant', content: reply });
      if (history.length > 16) history = history.slice(-16);
      speak(reply);
    } catch (error) {
      typing.remove();
      addMessage('ai', `Sorry — ${error.message || 'network error'}.`);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value);
    }
  });

  clearBtn?.addEventListener('click', async () => {
    history = [];
    messagesEl.innerHTML = '';
    addMessage(
      'ai',
      'Cleared. Ask about types vs templates, persona access, the handoff pack, or Postman create order.',
    );
    try {
      await fetch(`${API}/history?userId=${encodeURIComponent(USER_ID)}&sessionId=${encodeURIComponent(SESSION_ID)}`, {
        method: 'DELETE',
      });
    } catch {
      // local clear is enough
    }
  });

  document.querySelectorAll('.ece-chip[data-q]').forEach((btn) => {
    btn.addEventListener('click', () => sendMessage(btn.getAttribute('data-q')));
  });

  addMessage(
    'ai',
    'I consolidate Enhanced Conditions migration guidance, ICE APIs, persona access rules, and your local handoff pack. What do you want to clarify first?',
  );
  refreshStatus();
})();
