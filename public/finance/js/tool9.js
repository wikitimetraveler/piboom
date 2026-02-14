/**
 * The Code Clairvoyant - tool9.js
 * Encompass manifest XML review. Form objects only (CustomFieldList, Field, Calculation).
 * Voice activated. Zen design.
 */
(function () {
  const formCodeInput = document.getElementById('formCodeInput');
  const formCodeFile = document.getElementById('formCodeFile');
  const aiChatMessages = document.getElementById('aiChatMessages');
  const aiChatInput = document.getElementById('aiChatInput');
  const aiChatSendBtn = document.getElementById('aiChatSendBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const ttsToggleBtn = document.getElementById('ttsToggleBtn');
  const askReviewBtn = document.getElementById('askReviewBtn');
  const extractFieldsBtn = document.getElementById('extractFieldsBtn');
  const checkIssuesBtn = document.getElementById('checkIssuesBtn');
  const extractResult = document.getElementById('extractResult');
  const extractResultText = document.getElementById('extractResultText');
  const voiceHelp = document.getElementById('voiceHelp');
  const closeVoiceHelp = document.getElementById('closeVoiceHelp');
  const toggleVoiceHelp = document.getElementById('toggleVoiceHelp');

  let chatContext = [];
  let lastParsed = null;

  /**
   * Parse Encompass manifest XML. Extract field IDs and form logic (Calculations).
   * Manifest format: <package><CustomFieldList><Field id="..." /><Calculation>...</Calculation>
   */
  function parseManifest(xmlText) {
    const fieldIds = new Set();
    const calculations = [];
    const refsFromCalcs = new Set();

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      if (doc.querySelector('parsererror')) {
        return { error: 'Invalid XML' };
      }

      const fields = doc.querySelectorAll('Field[id]');
      fields.forEach((field) => {
        const id = field.getAttribute('id');
        if (id) fieldIds.add(id);

        const calc = field.querySelector('Calculation');
        if (calc) {
          const expr = calc.textContent.trim();
          calculations.push({ fieldId: id, expr });
          const matches = expr.match(/\[([^\]]+)\]/g);
          if (matches) {
            matches.forEach((m) => refsFromCalcs.add(m.slice(1, -1).trim()));
          }
        }

        field.querySelectorAll('Audit[fieldid]').forEach((audit) => {
          const fid = audit.getAttribute('fieldid');
          if (fid) fieldIds.add(fid);
        });
      });

      const allRefs = new Set([...refsFromCalcs]);
      refsFromCalcs.forEach((r) => {
        const base = r.replace(/^[#@]/, '').split('#')[0].split('@')[0];
        if (base && !fieldIds.has(base)) allRefs.add(base);
      });

      return {
        fieldIds: Array.from(fieldIds).sort(),
        calcRefs: Array.from(refsFromCalcs).sort(),
        calculations,
        summary: `${fieldIds.size} fields, ${calculations.length} with calculations`,
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  function getFormCode() {
    return formCodeInput ? String(formCodeInput.value || '').trim() : '';
  }

  function formatMessageContent(content) {
    return content
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addMessage(role, content, options = {}) {
    if (!aiChatMessages) return;
    const div = document.createElement('div');
    div.className = `ai-chat-message ${role}`;
    const safeContent = role === 'user' ? escapeHtml(content) : formatMessageContent(content);
    div.innerHTML = `
      <div class="ai-chat-message-avatar">${role === 'user' ? '<i class="bi-person"></i>' : '<i class="bi-robot"></i>'}</div>
      <div class="ai-chat-message-content">
        ${safeContent}
        <div class="ai-chat-message-timestamp">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    aiChatMessages.appendChild(div);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    if (role === 'assistant' && options.speakResponse && content && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(content.substring(0, 500));
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }

  async function sendToReviewer(message, formCode = null) {
    const code = formCode !== null ? formCode : getFormCode();
    addMessage('user', message);
    chatContext.push(message);
    if (aiChatInput) aiChatInput.value = '';
    aiChatSendBtn.disabled = true;

    try {
      const res = await fetch('/api/reviewer/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, formCode: code || undefined, context: chatContext.slice(-10) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = data.message ? ` ${data.message}` : '';
        throw new Error((data.error || 'Request failed') + hint);
      }
      addMessage('assistant', data.message, { speakResponse: !!window.reviewerSpeakResponses });
      chatContext.push(data.message);
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      aiChatSendBtn.disabled = false;
    }
  }

  function handleSend() {
    const msg = aiChatInput?.value?.trim();
    if (msg) sendToReviewer(msg);
  }

  function handleExtract() {
    const code = getFormCode();
    if (!code) {
      addMessage('assistant', 'Please paste or upload manifest XML first.');
      return;
    }
    const parsed = parseManifest(code);
    lastParsed = parsed;
    if (parsed.error) {
      addMessage('assistant', `Could not parse manifest: ${parsed.error}`);
      return;
    }
    const lines = [
      `Field IDs (${parsed.fieldIds.length}):`,
      parsed.fieldIds.slice(0, 50).join(', '),
      parsed.fieldIds.length > 50 ? `... and ${parsed.fieldIds.length - 50} more` : '',
      '',
      'Calculations (form logic):',
      ...parsed.calculations.slice(0, 10).map((c) => `  ${c.fieldId}: ${c.expr.slice(0, 80)}${c.expr.length > 80 ? '...' : ''}`),
      parsed.calculations.length > 10 ? `  ... and ${parsed.calculations.length - 10} more` : '',
    ];
    if (extractResultText) extractResultText.textContent = lines.filter(Boolean).join('\n');
    if (extractResult) extractResult.style.display = 'block';
    addMessage('assistant', `Extracted ${parsed.fieldIds.length} field IDs and ${parsed.calculations.length} calculations. Review the extracted list above or ask me to analyze.`);
  }

  function handleAskReview() {
    const code = getFormCode();
    if (!code) {
      addMessage('assistant', 'Please paste or upload manifest XML first.');
      return;
    }
    let msg = 'Please analyze this manifest (form objects). Explain field IDs, calculations, dependencies, and any improvements.';
    if (lastParsed && !lastParsed.error) {
      msg += `\n\nExtracted: ${lastParsed.fieldIds.length} fields, ${lastParsed.calculations.length} calculations.`;
    }
    sendToReviewer(msg, code);
  }

  function handleCheckIssues() {
    const code = getFormCode();
    if (!code) {
      addMessage('assistant', 'Please paste or upload manifest XML first, then click Check for Issues.');
      return;
    }
    let msg = 'Check this form code for issues. List any problems found: calculation errors, invalid field references, type mismatches, deprecated patterns, circular dependencies, or missing fields. Be specific with field IDs.';
    if (lastParsed && !lastParsed.error) {
      msg += ` Extracted: ${lastParsed.fieldIds.length} fields, ${lastParsed.calculations.length} calculations.`;
    }
    sendToReviewer(msg, code);
  }

  function handleVoiceCommand(raw) {
    const cmd = String(raw || '').toLowerCase().trim();
    if (cmd.includes('check') && (cmd.includes('issue') || cmd.includes('problem'))) {
      handleCheckIssues();
    } else if (cmd.includes('review form') || cmd.includes('analyze form')) {
      handleAskReview();
    } else if (cmd.includes('show commands') || cmd.includes('voice guide')) {
      voiceHelp?.classList.add('show');
    } else if (cmd.includes('hide commands') || cmd.includes('close')) {
      voiceHelp?.classList.remove('show');
    } else if (cmd.length > 2) {
      aiChatInput.value = raw;
      handleSend();
    }
  }

  function initVoice() {
    if (typeof initVoiceWidget !== 'function') return;
    initVoiceWidget({
      position: 'bottom-right',
      theme: 'blue',
      onCommand: handleVoiceCommand,
    });
  }

  formCodeFile?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (formCodeInput) formCodeInput.value = r.result || '';
    };
    r.readAsText(f);
    e.target.value = '';
  });

  aiChatSendBtn?.addEventListener('click', handleSend);
  aiChatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
  askReviewBtn?.addEventListener('click', handleAskReview);
  extractFieldsBtn?.addEventListener('click', handleExtract);
  checkIssuesBtn?.addEventListener('click', handleCheckIssues);

  clearChatBtn?.addEventListener('click', () => {
    chatContext = [];
    if (aiChatMessages) aiChatMessages.innerHTML = '';
    addMessage('assistant', 'Hi! I\'m The Code Clairvoyant — form-code-specific. Paste manifest XML, extract field IDs, then ask me to analyze or check for issues.');
  });

  ttsToggleBtn?.addEventListener('click', () => {
    window.reviewerSpeakResponses = !window.reviewerSpeakResponses;
    ttsToggleBtn.classList.toggle('active', !!window.reviewerSpeakResponses);
  });

  closeVoiceHelp?.addEventListener('click', () => voiceHelp?.classList.remove('show'));
  toggleVoiceHelp?.addEventListener('click', () => voiceHelp?.classList.toggle('show'));

  addMessage('assistant', 'Hi! I\'m The Code Clairvoyant — form-code-specific. Paste manifest XML, extract field IDs, then click "Check for Issues" or ask me to analyze.');
  initVoice();
})();
