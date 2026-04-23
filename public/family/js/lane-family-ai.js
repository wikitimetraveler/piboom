/**
 * Lane Family hub — Lane guide (POST /api/genealogy/ai/chat).
 * Client keeps short history for multi-turn; server is stateless.
 */
(function () {
  'use strict';

  const API = '/api/genealogy/ai/chat';
  const MAX_TURNS = 6;
  let history = [];

  function getEl(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    const el = getEl('lfAiStatus');
    if (el) el.textContent = text || '';
  }

  function setReply(html, plain) {
    const el = getEl('lfAiReply');
    if (!el) return;
    if (plain) {
      el.removeAttribute('hidden');
      el.classList.add('lf-ai-reply--visible');
      el.innerHTML = html;
    } else {
      el.setAttribute('hidden', 'hidden');
      el.classList.remove('lf-ai-reply--visible');
      el.innerHTML = '';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatReplyAsHtml(text) {
    const p = escapeHtml(text).split(/\n\n+/);
    return p.map((chunk) => `<p class="lf-ai-para">${chunk.replace(/\n/g, '<br>')}</p>`).join('');
  }

  async function send() {
    const input = getEl('lfAiInput');
    const btn = getEl('lfAiSend');
    if (!input || !btn) return;
    const message = String(input.value || '').trim();
    if (!message) return;

    btn.disabled = true;
    setStatus('Asking the guide…');
    setReply('', false);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: history,
          pageContext: 'Lane Family hub (lane-family.html)'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || res.statusText || 'Request failed');
      }
      const answer = data.message != null ? String(data.message) : '';
      history.push({ user: message, assistant: answer });
      if (history.length > MAX_TURNS) {
        history = history.slice(-MAX_TURNS);
      }
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus('');
      setReply(
        `<div class="lf-ai-answer">${formatReplyAsHtml(answer)}<p class="lf-ai-para lf-ai-timestamp text-muted small mb-0">${escapeHtml(
          data.timestamp || ''
        )}</p></div>`,
        true
      );
      getEl('lfAiReply')?.focus({ preventScroll: true });
    } catch (e) {
      setStatus('');
      setReply(
        `<p class="lf-ai-error mb-0">${escapeHtml(e.message || 'Something went wrong.')}</p>`,
        true
      );
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    const input = getEl('lfAiInput');
    const btn = getEl('lfAiSend');
    if (!input || !btn) return;

    function sync() {
      const has = String(input.value || '').trim().length > 0;
      btn.disabled = !has;
    }

    input.addEventListener('input', sync);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        if (!btn.disabled) send();
      }
    });
    btn.addEventListener('click', send);
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
