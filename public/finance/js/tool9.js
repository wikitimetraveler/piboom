/**
 * The Screen Test - tool9.js
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
  const summarizeFuncBtn = document.getElementById('summarizeFuncBtn');
  const checkIssuesBtn = document.getElementById('checkIssuesBtn');
  const extractResult = document.getElementById('extractResult');
  const extractResultText = document.getElementById('extractResultText');
  const formOverviewPanel = document.getElementById('formOverviewPanel');
  const overviewSummary = document.getElementById('overviewSummary');
  const overviewFunctionality = document.getElementById('overviewFunctionality');
  const fieldsTableBody = document.getElementById('fieldsTableBody');
  const fieldSearchInput = document.getElementById('fieldSearchInput');
  const calculationsList = document.getElementById('calculationsList');
  const voiceHelp = document.getElementById('voiceHelp');
  const closeVoiceHelp = document.getElementById('closeVoiceHelp');
  const toggleVoiceHelp = document.getElementById('toggleVoiceHelp');

  let chatContext = [];
  let lastParsed = null;

  /**
   * Parse Encompass manifest XML. Extract full field structure and form logic.
   * Manifest format: <package><CustomFieldList><Field id="..." /><Calculation>...</Calculation>
   */
  function parseManifest(xmlText) {
    const fieldIds = new Set();
    const calculations = [];
    const refsFromCalcs = new Set();
    const customFields = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      if (doc.querySelector('parsererror')) {
        return { error: 'Invalid XML' };
      }

      const formList = doc.querySelectorAll('Form[id]');
      const formNames = Array.from(formList).map((f) => f.getAttribute('mname') || f.getAttribute('id')).filter(Boolean);

      const fields = doc.querySelectorAll('CustomFieldList Field[id]');
      fields.forEach((field) => {
        const id = field.getAttribute('id');
        if (!id) return;
        fieldIds.add(id);

        const options = Array.from(field.querySelectorAll(':scope > Option')).map((o) => o.textContent.trim());
        const calcEl = field.querySelector(':scope > Calculation');
        const expr = calcEl ? calcEl.textContent.trim() : null;
        const audits = Array.from(field.querySelectorAll(':scope > Audit[fieldid]')).map((a) => ({
          fieldid: a.getAttribute('fieldid'),
          data: a.getAttribute('data') || 'Timestamp',
        }));

        if (expr) {
          calculations.push({ fieldId: id, expr });
          const matches = expr.match(/\[([^\]]+)\]/g);
          if (matches) {
            matches.forEach((m) => refsFromCalcs.add(m.slice(1, -1).trim()));
          }
        }

        audits.forEach((a) => a.fieldid && fieldIds.add(a.fieldid));

        customFields.push({
          id,
          desc: field.getAttribute('desc') || '',
          type: field.getAttribute('type') || 'STRING',
          maxlength: field.getAttribute('maxlength'),
          options: options.length ? options : null,
          calculation: expr,
          audit: audits.length ? audits : null,
        });
      });

      const typeCounts = {};
      customFields.forEach((f) => {
        const t = f.type.split(/[\s(]/)[0] || 'OTHER';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });

      return {
        fieldIds: Array.from(fieldIds).sort(),
        calcRefs: Array.from(refsFromCalcs).sort(),
        calculations,
        customFields,
        formNames,
        typeCounts,
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
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);
      u.rate = isMobile ? 1.0 : 0.9;
      u.pitch = 1;
      window.speechSynthesis.cancel();
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

  function renderOverview(parsed) {
    if (!parsed || parsed.error || !formOverviewPanel) return;

    formOverviewPanel.style.display = 'block';

    // Summary badges
    const badges = [
      { label: 'Fields', value: parsed.customFields?.length || parsed.fieldIds?.length || 0, cls: 'badge-primary' },
      { label: 'Calculations', value: parsed.calculations?.length || 0, cls: 'badge-info' },
      { label: 'Forms', value: (parsed.formNames || []).length || 1, cls: 'badge-secondary' },
    ];
    (parsed.typeCounts || {}).DROPDOWN && badges.push({ label: 'Dropdowns', value: parsed.typeCounts.DROPDOWN, cls: 'badge-success' });
    (parsed.typeCounts || {}).DATE && badges.push({ label: 'Dates', value: parsed.typeCounts.DATE, cls: 'badge-warning' });

    if (overviewSummary) {
      overviewSummary.innerHTML = badges
        .map((b) => `<span class="badge ${b.cls} mr-2 mb-2">${b.label}: ${b.value}</span>`)
        .join('');
    }

    // Functionality summary
    const func = [];
    if (parsed.formNames?.length) func.push(`<strong>Forms:</strong> ${parsed.formNames.join(', ')}`);
    if (parsed.calculations?.length) {
      const calcRefs = new Set();
      (parsed.calculations || []).forEach((c) => (c.expr.match(/\[([^\]]+)\]/g) || []).forEach((m) => calcRefs.add(m.slice(1, -1))));
      func.push(`<strong>Calculated fields:</strong> ${parsed.calculations.map((c) => c.fieldId).join(', ')}`);
      if (calcRefs.size) func.push(`<strong>References in calcs:</strong> ${[...calcRefs].slice(0, 12).join(', ')}${calcRefs.size > 12 ? '…' : ''}`);
    }
    const auditFields = (parsed.customFields || []).filter((f) => f.audit?.length);
    if (auditFields.length) func.push(`<strong>Audit fields:</strong> ${auditFields.map((f) => f.id).join(', ')}`);
    if (overviewFunctionality) overviewFunctionality.innerHTML = func.length ? func.join('<br class="my-1">') : '<em>No additional metadata</em>';

    // Custom fields table (fallback: build from fieldIds if no customFields)
    let fields = parsed.customFields || [];
    if (!fields.length && parsed.fieldIds?.length) {
      fields = parsed.fieldIds.map((id) => ({ id, desc: '', type: '—', options: null, calculation: null, audit: null }));
    }
    function filterAndRenderFields() {
      const q = (fieldSearchInput?.value || '').toLowerCase();
      const filtered = q ? fields.filter((f) => `${f.id} ${f.desc} ${f.type}`.toLowerCase().includes(q)) : fields;
      if (!fieldsTableBody) return;
      fieldsTableBody.innerHTML = filtered
        .map(
          (f) => `
        <tr>
          <td><code class="small">${escapeHtml(f.id)}</code></td>
          <td class="small">${escapeHtml(f.desc || '—')}</td>
          <td><span class="badge badge-light border text-dark">${escapeHtml(f.type)}</span></td>
          <td class="small">${f.options ? `<span class="text-muted" title="${escapeHtml(f.options.slice(0, 5).join(', ') + (f.options.length > 5 ? ' …' : ''))}">${f.options.length} options</span>` : f.audit ? `<span class="text-info">Audit: ${escapeHtml(f.audit.map((a) => a.fieldid).join(', '))}</span>` : f.calculation ? '<span class="text-success">Has calc</span>' : '—'}</td>
        </tr>`
        )
        .join('');
    }
    filterAndRenderFields();
    if (fieldSearchInput) fieldSearchInput.oninput = fieldSearchInput.onsearch = filterAndRenderFields;

    // Calculations list
    const calcs = parsed.calculations || [];
    if (calculationsList) {
      calculationsList.innerHTML = calcs
        .map(
          (c) => {
            const refs = (c.expr.match(/\[([^\]]+)\]/g) || []).map((m) => m.slice(1, -1));
            return `
          <div class="list-group-item d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start">
              <code class="small font-weight-bold">${escapeHtml(c.fieldId)}</code>
              ${refs.length ? `<span class="badge badge-light text-dark small">${refs.length} refs</span>` : ''}
            </div>
            <pre class="small mt-1 mb-0 text-muted" style="white-space: pre-wrap; max-height: 4rem; overflow: hidden;">${escapeHtml(c.expr)}</pre>
            ${refs.length ? `<div class="mt-1"><small class="text-info">Refs: ${refs.slice(0, 8).map((r) => escapeHtml(r)).join(', ')}${refs.length > 8 ? '…' : ''}</small></div>` : ''}
          </div>`;
          }
        )
        .join('');
    }
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
    renderOverview(parsed);
    addMessage('assistant', `Extracted ${parsed.fieldIds.length} field IDs and ${parsed.calculations.length} calculations. Review the Form Overview above or ask me to analyze.`);
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

  function handleSummarizeFunctionality() {
    const code = getFormCode();
    if (!code) {
      addMessage('assistant', 'Please paste or upload manifest XML first.');
      return;
    }
    if (!lastParsed || lastParsed.error) {
      const parsed = parseManifest(code);
      lastParsed = parsed;
      if (parsed.error) {
        addMessage('assistant', `Could not parse manifest: ${parsed.error}`);
        return;
      }
      renderOverview(parsed);
    }
    const msg = 'Summarize the overall functionality of this form. What business logic does it implement? Group by: (1) calculated fields and their purpose, (2) dropdown/option-driven behavior, (3) audit trails, (4) any workflows or dependencies between fields. Be concise and actionable.';
    if (lastParsed && !lastParsed.error) {
      sendToReviewer(msg + ` Extracted: ${lastParsed.customFields?.length || lastParsed.fieldIds?.length || 0} fields, ${lastParsed.calculations?.length || 0} calculations.`, code);
    } else {
      sendToReviewer(msg, code);
    }
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
  summarizeFuncBtn?.addEventListener('click', handleSummarizeFunctionality);
  checkIssuesBtn?.addEventListener('click', handleCheckIssues);

  clearChatBtn?.addEventListener('click', () => {
    chatContext = [];
    if (aiChatMessages) aiChatMessages.innerHTML = '';
    addMessage('assistant', 'Hi! I\'m The Screen Test — form-code-specific. Paste manifest XML, extract field IDs, then ask me to analyze or check for issues.');
  });

  ttsToggleBtn?.addEventListener('click', () => {
    window.reviewerSpeakResponses = !window.reviewerSpeakResponses;
    ttsToggleBtn.classList.toggle('active', !!window.reviewerSpeakResponses);
  });

  closeVoiceHelp?.addEventListener('click', () => voiceHelp?.classList.remove('show'));
  toggleVoiceHelp?.addEventListener('click', () => voiceHelp?.classList.toggle('show'));

  addMessage('assistant', 'Hi! I\'m The Screen Test — form-code-specific. Paste manifest XML, extract field IDs, then click "Check for Issues" or ask me to analyze.');
  initVoice();
})();
