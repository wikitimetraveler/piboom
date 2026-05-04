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

  function setSendingUi(disabled, btn) {
    if (btn) btn.disabled = disabled;
  }

  /**
   * @param {string} message
   * @param {{ fromChip?: boolean }} [opts]
   */
  async function sendLaneGuide(message, opts) {
    const input = getEl('lfAiInput');
    const btn = getEl('lfAiSend');
    const trimmed = String(message || '').trim();
    if (!trimmed) return;

    setSendingUi(true, btn);
    setStatus(opts?.fromChip ? 'Asking about compilers…' : 'Asking the guide…');
    setReply('', false);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: history,
          pageContext: 'Lane Family hub (lane-family.html) — Lane guide; suggested prompts may relate to compilers and site navigation.'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || res.statusText || 'Request failed');
      }
      const answer = data.message != null ? String(data.message) : '';
      history.push({ user: trimmed, assistant: answer });
      if (history.length > MAX_TURNS) {
        history = history.slice(-MAX_TURNS);
      }
      if (input && !opts?.fromChip) input.value = '';
      if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
      syncSendButtonState();
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
      setSendingUi(false, btn);
    }
  }

  async function sendFromInput() {
    const input = getEl('lfAiInput');
    if (!input) return;
    await sendLaneGuide(input.value, {});
  }

  function syncSendButtonState() {
    const input = getEl('lfAiInput');
    const btn = getEl('lfAiSend');
    if (!input || !btn) return;
    btn.disabled = String(input.value || '').trim().length === 0;
  }

  function bindSuggestedPromptButtons() {
    const host = getEl('lfAiSuggestedPrompts');
    if (!host) return;
    host.querySelectorAll('[data-lf-ai-prompt]').forEach((el) => {
      el.addEventListener('click', () => {
        const prompt = el.getAttribute('data-lf-ai-prompt');
        if (prompt != null && String(prompt).trim()) {
          void sendLaneGuide(String(prompt).trim(), { fromChip: true });
        }
      });
    });
  }

  function init() {
    const input = getEl('lfAiInput');
    const btn = getEl('lfAiSend');
    if (!input || !btn) return;

    input.addEventListener('input', syncSendButtonState);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        if (!btn.disabled) void sendFromInput();
      }
    });
    btn.addEventListener('click', () => void sendFromInput());
    bindSuggestedPromptButtons();
    syncSendButtonState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
