/**
 * On-device + OpenAI hazard agent for Unified Disasters (Loans · ops triage).
 * Instant/WebLLM stay in the browser; OpenAI modes hit chat-disaster-expert.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const API_ENDPOINT = '/api/loan-pipeline/ai/chat-disaster-expert';
  const MODES = {
    INSTANT: 'instant',
    WEBLLM: 'webllm',
    OPENAI_PROCESSOR: 'openai-processor',
    OPENAI_PORTFOLIO: 'openai-portfolio',
  };

  const TOOL_NAMES = [
    'get_selected_event',
    'get_nearby_loans',
    'get_nearby_cameras',
    'get_triage_note',
  ];

  const SYSTEM_PROMPT = [
    'You are the on-device hazard ops tutor on Unified Disasters.',
    'Privacy: Instant and WebLLM answers never leave this browser. Do not invent loan counts or camera names — call tools.',
    'disaster_risk_score is an ops triage rank (0–15), not a loss probability.',
    'Tools (reply with one JSON object when you need data):',
    '{"tool":"get_selected_event"}',
    '{"tool":"get_nearby_loans"}',
    '{"tool":"get_nearby_cameras"}',
    '{"tool":"get_triage_note"}',
    'After tool results, answer in plain language for a mortgage processor. Keep answers short.',
  ].join(' ');

  const EXPLAINER_HTML = [
    '<p class="mb-2"><strong>Instant on-device</strong> and <strong>WebLLM</strong> never call our assistant API. WebLLM is a small on-device model; the first load downloads weights and needs WebGPU.</p>',
    '<p class="mb-2"><strong>OpenAI</strong> uses the server assistants already on this page. Those calls send the selected event, filters, and a nearby-loan sample, and they can use conversation memory plus Stafford context.</p>',
    '<p class="mb-0"><code>disaster_risk_score</code> stays an ops triage rank, not a loss probability.</p>',
  ].join('');

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function triageBand(score) {
    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return 'unscored';
    if (n >= 10) return 'critical';
    if (n >= 7) return 'high';
    if (n >= 4) return 'moderate';
    return 'low';
  }

  function summarizeTriageBands(loans) {
    const bands = { critical: 0, high: 0, moderate: 0, low: 0, unscored: 0 };
    (loans || []).forEach((loan) => {
      const key = triageBand(loan && loan.disaster_risk_score);
      bands[key] = (bands[key] || 0) + 1;
    });
    return bands;
  }

  function parseToolCall(text) {
    if (!text || typeof text !== 'string') return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [];
    if (fence && fence[1]) candidates.push(fence[1].trim());
    const inline = text.match(/\{[\s\S]*"tool"\s*:\s*"[a-z0-9_]+"[\s\S]*\}/i);
    if (inline) candidates.push(inline[0]);
    candidates.push(text.trim());

    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i];
      try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) continue;
        const obj = JSON.parse(raw.slice(start, end + 1));
        if (!obj || typeof obj.tool !== 'string') continue;
        if (TOOL_NAMES.indexOf(obj.tool) < 0) continue;
        return obj;
      } catch (_) {
        /* try next */
      }
    }
    return null;
  }

  function inferLocalToolCall(userText) {
    const text = String(userText || '').trim();
    if (!text) return { tool: 'get_selected_event' };

    const explicit = parseToolCall(text);
    if (explicit) return explicit;

    if (/camera|webcam|cams?\b|fire\s+cam/i.test(text)) {
      return { tool: 'get_nearby_cameras' };
    }
    if (/loan|triage|nearby|exposure|portfolio|concentrat|within\s+\d/i.test(text)) {
      return { tool: 'get_nearby_loans' };
    }
    if (/ops\s+triage|not\s+a\s+(loss\s+)?probabilit|disaster_risk_score|triage\s+note/i.test(text)) {
      return { tool: 'get_triage_note' };
    }
    if (/summar|selected|hazard|event|disaster|what\s+is\s+this/i.test(text)) {
      return { tool: 'get_selected_event' };
    }
    return { tool: 'get_selected_event' };
  }

  function createToolBus(deps) {
    const d = deps || {};

    async function invoke(call) {
      const tool = call && call.tool;
      if (!tool || TOOL_NAMES.indexOf(tool) < 0) {
        return { error: 'unknown tool', tool };
      }

      if (tool === 'get_selected_event') {
        const event =
          typeof d.getSelectedDisaster === 'function' ? d.getSelectedDisaster() : null;
        const filters = typeof d.getFilters === 'function' ? d.getFilters() : {};
        return {
          tool,
          selected: event
            ? {
                title: event.title || event.declarationTitle || null,
                event_type: event.event_type || event.incidentType || null,
                state_abbr: event.state_abbr || event.state || null,
                county_name: event.county_name || event.county || null,
                start_time: event.start_time || event.declarationDate || null,
                source: event.source || event.data_source || null,
              }
            : null,
          filters: filters || {},
          note: 'disaster_risk_score is ops triage rank, not a loss probability',
        };
      }

      if (tool === 'get_nearby_loans') {
        const loans =
          typeof d.getNearbyLoans === 'function' ? d.getNearbyLoans() || [] : [];
        const sample = loans.slice(0, 8).map((loan) => ({
          loan_number: loan.loan_number || loan.loanNumber || null,
          disaster_risk_score: loan.disaster_risk_score,
          triage_band: triageBand(loan.disaster_risk_score),
          flood_zone: loan.flood_zone || loan.floodZone || null,
          distance_km: loan.distance_km != null ? loan.distance_km : loan.distanceKm,
          county: loan.county || loan.county_name || null,
          state: loan.state || loan.state_abbr || null,
        }));
        return {
          tool,
          count: loans.length,
          bands: summarizeTriageBands(loans),
          sample,
          note: 'disaster_risk_score is ops triage rank, not a loss probability',
        };
      }

      if (tool === 'get_nearby_cameras') {
        const cameras =
          typeof d.getNearbyCameras === 'function' ? d.getNearbyCameras() || [] : [];
        const sample = cameras.slice(0, 5).map((cam) => ({
          name: cam.name || cam.title || cam.camera_name || null,
          source: cam.source || cam.provider || null,
          distance_km: cam.distance_km != null ? cam.distance_km : cam.distanceKm,
          url: cam.url || cam.page_url || cam.link || null,
        }));
        return { tool, count: cameras.length, sample };
      }

      return {
        tool: 'get_triage_note',
        note:
          'disaster_risk_score is an ops triage rank (0–15) for processor prioritization — not a loss probability and not an actuarial estimate.',
      };
    }

    return {
      TOOL_NAMES: TOOL_NAMES.slice(),
      invoke,
    };
  }

  function formatLocalToolReply(call, result) {
    if (!result || result.error) {
      return 'Tool error: ' + (result && result.error ? result.error : 'unknown error');
    }
    const tool = call && call.tool;

    if (tool === 'get_triage_note') {
      return result.note || 'Ops triage rank is not a loss probability.';
    }

    if (tool === 'get_nearby_cameras') {
      const n = result.count || 0;
      if (!n) return 'No nearby hazard cameras are loaded for this selection yet.';
      const names = (result.sample || [])
        .map((c) => c.name || 'camera')
        .slice(0, 3)
        .join('; ');
      return (
        n +
        ' nearby camera' +
        (n === 1 ? '' : 's') +
        ' on the page' +
        (names ? ' (e.g. ' + names + ')' : '') +
        '. Open the Fire cameras panel to review feeds.'
      );
    }

    if (tool === 'get_nearby_loans') {
      const n = result.count || 0;
      if (!n) {
        return (
          'No nearby mocked loans are loaded yet. Select a disaster and wait for the Loans · ops triage grid. ' +
          'Reminder: disaster_risk_score is ops triage, not a probability.'
        );
      }
      const b = result.bands || {};
      return (
        n +
        ' nearby mocked loan' +
        (n === 1 ? '' : 's') +
        ' — triage bands: critical ' +
        (b.critical || 0) +
        ', high ' +
        (b.high || 0) +
        ', moderate ' +
        (b.moderate || 0) +
        ', low ' +
        (b.low || 0) +
        '. Scores are ops triage ranks, not loss probabilities.'
      );
    }

    const sel = result.selected;
    if (!sel) {
      return (
        'No disaster is selected yet. Pick an event in the grid to load loans, cameras, and triage context. ' +
        'disaster_risk_score remains an ops triage rank, not a probability.'
      );
    }
    const where = [sel.county_name, sel.state_abbr].filter(Boolean).join(', ');
    return (
      'Selected hazard: ' +
      (sel.title || sel.event_type || 'event') +
      (where ? ' · ' + where : '') +
      (sel.source ? ' · source ' + sel.source : '') +
      '. Nearby loan scores are ops triage ranks, not loss probabilities.'
    );
  }

  async function runLocalToolTurn(userText, bus) {
    const call = inferLocalToolCall(userText);
    const result = await bus.invoke(call);
    const reply = formatLocalToolReply(call, result);
    return {
      reply,
      toolTrace: [{ call, result }],
      mode: 'local-snapshot',
    };
  }

  function isOpenAiMode(mode) {
    return mode === MODES.OPENAI_PROCESSOR || mode === MODES.OPENAI_PORTFOLIO;
  }

  function privacyBadgeForMode(mode) {
    if (isOpenAiMode(mode)) {
      return {
        text: 'Privacy: sends this snapshot to our server',
        className: 'badge text-bg-warning border',
      };
    }
    return {
      text: 'Privacy: stays in this browser',
      className: 'badge text-bg-success border',
    };
  }

  async function postOpenAiChat(opts) {
    const o = opts || {};
    const message = String(o.message || '').trim();
    if (!message) return { reply: '', mode: 'openai' };

    const getContext =
      o.mode === MODES.OPENAI_PORTFOLIO
        ? o.getPortfolioContext
        : o.getProcessorContext;
    const context =
      typeof getContext === 'function' ? await Promise.resolve(getContext()) : {};

    const fetchFn = typeof o.fetchFn === 'function' ? o.fetchFn : fetch;
    const response = await fetchFn(o.apiEndpoint || API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: o.userId || 'anonymous',
        sessionId:
          o.sessionId ||
          (o.mode === MODES.OPENAI_PORTFOLIO
            ? 'unified-disaster-portfolio-panel'
            : 'unified-disaster-processor-panel'),
        context: context || {},
      }),
    });
    const data = await response.json();
    if (data && data.success && data.response) {
      return { reply: String(data.response), mode: 'openai', data };
    }
    const detail = String((data && (data.error || data.message)) || '').trim();
    throw new Error(detail || 'OpenAI disaster expert request failed');
  }

  function mount(opts) {
    const o = opts || {};
    const rootEl = o.panelRoot;
    if (!rootEl) return null;

    const PrivateAgent = root.WebGpuPrivateAgent;
    if (!PrivateAgent || typeof PrivateAgent.createChatController !== 'function') {
      rootEl.innerHTML =
        '<p class="small text-muted mb-0">WebGPU private agent unavailable.</p>';
      return null;
    }

    const hasGpu = PrivateAgent.detectWebGpuAvailable(o.gpu);
    let mode = MODES.INSTANT;

    rootEl.innerHTML = [
      '<div class="du-hazard-agent">',
      '  <div class="du-hazard-agent__head">',
      '    <h3 class="h6 mb-1">Hazard model · ask locally or via OpenAI</h3>',
      '    <p class="small text-muted mb-2">Answers from the selected event on this page, optional on-device WebLLM, or the existing disaster assistants.</p>',
      '    <span class="badge text-bg-success border" id="duHazardPrivacyBadge">Privacy: stays in this browser</span>',
      '    <span class="badge text-bg-light border ms-1" id="duHazardAgentStatus">' +
        (hasGpu ? 'Instant snapshot ready' : 'Instant snapshot ready (no WebGPU)') +
        '</span>',
      '  </div>',
      '  <div class="du-hazard-agent__controls my-2 d-flex flex-wrap gap-2 align-items-center">',
      '    <label class="visually-hidden" for="duHazardModelMode">Model</label>',
      '    <select class="form-select form-select-sm du-hazard-agent__mode" id="duHazardModelMode" style="max-width: 16rem;">',
      '      <option value="instant" selected>Instant on-device</option>',
      '      <option value="webllm"' +
        (hasGpu ? '' : ' disabled') +
        '>WebLLM (on-device)</option>',
      '      <option value="openai-processor">OpenAI · Processor</option>',
      '      <option value="openai-portfolio">OpenAI · Portfolio</option>',
      '    </select>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" id="duHazardModeHelp" aria-expanded="false" aria-controls="duHazardModeExplainer" title="What do these modes mean?">',
      '      <i class="bi bi-question-circle" aria-hidden="true"></i><span class="visually-hidden">Explain model modes</span>',
      '    </button>',
      '    <button type="button" class="btn btn-sm btn-outline-primary" id="duHazardWebLlmBtn" hidden>Load WebLLM</button>',
      '    <span class="small text-muted" id="duHazardProgress">Instant answers use the hazard already on this page — no download.</span>',
      '  </div>',
      '  <div class="du-hazard-agent__explainer small border rounded p-2 mb-2" id="duHazardModeExplainer" hidden>' +
        EXPLAINER_HTML +
        '</div>',
      '  <div class="du-hazard-agent__suggest d-flex flex-wrap gap-2 mb-2" id="duHazardSuggest">',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Triage nearby loans for the selected hazard.">Triage near this event</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Which nearby cameras should I check?">Cameras to check</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Summarize the selected hazard.">Summarize selected hazard</button>',
      '  </div>',
      '  <div class="du-hazard-agent__log border rounded p-2 mb-2" id="duHazardLog" aria-live="polite"></div>',
      '  <form class="du-hazard-agent__form d-flex gap-2" id="duHazardForm">',
      '    <label class="visually-hidden" for="duHazardInput">Message</label>',
      '    <input type="text" class="form-control form-control-sm" id="duHazardInput" placeholder="Ask about triage, cameras, or the selected event…" autocomplete="off">',
      '    <button type="submit" class="btn btn-sm btn-dark" id="duHazardSend">Send</button>',
      '  </form>',
      '</div>',
    ].join('\n');

    const logEl = rootEl.querySelector('#duHazardLog');
    const progressEl = rootEl.querySelector('#duHazardProgress');
    const statusEl = rootEl.querySelector('#duHazardAgentStatus');
    const privacyEl = rootEl.querySelector('#duHazardPrivacyBadge');
    const modeSelect = rootEl.querySelector('#duHazardModelMode');
    const helpBtn = rootEl.querySelector('#duHazardModeHelp');
    const explainerEl = rootEl.querySelector('#duHazardModeExplainer');
    const webLlmBtn = rootEl.querySelector('#duHazardWebLlmBtn');
    const form = rootEl.querySelector('#duHazardForm');
    const input = rootEl.querySelector('#duHazardInput');

    function appendBubble(role, text) {
      if (!logEl) return;
      const div = document.createElement('div');
      div.className = 'du-hazard-agent__msg du-hazard-agent__msg--' + role;
      div.innerHTML =
        '<strong>' +
        (role === 'user' ? 'You' : role === 'tool' ? 'Tool' : 'Agent') +
        ':</strong> <span>' +
        escapeHtml(text) +
        '</span>';
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function syncPrivacy() {
      const badge = privacyBadgeForMode(mode);
      if (privacyEl) {
        privacyEl.textContent = badge.text;
        privacyEl.className = badge.className;
      }
    }

    const toolBus = createToolBus({
      getSelectedDisaster: o.getSelectedDisaster,
      getFilters: o.getFilters,
      getNearbyLoans: o.getNearbyLoans,
      getNearbyCameras: o.getNearbyCameras,
    });

    const controller = PrivateAgent.createChatController({
      toolBus,
      modelId: o.modelId || PrivateAgent.DEFAULT_MODEL_ID,
      importWebLlm: o.importWebLlm,
      gpu: o.gpu,
      stallTimeoutMs: o.stallTimeoutMs,
      systemPrompt: SYSTEM_PROMPT,
      parseToolCall,
      formatLocalToolReply,
      runLocalToolTurn,
      onProgress(text) {
        if (progressEl) progressEl.textContent = text || '';
      },
      onGpuBusy(flag, meta) {
        if (!statusEl) return;
        if (!flag) {
          statusEl.textContent = controller.isLlmEnabled()
            ? 'WebLLM loaded (on-device)'
            : 'Instant snapshot ready';
        } else if (meta && meta.loading) {
          statusEl.textContent = 'Loading WebLLM…';
        } else {
          statusEl.textContent = 'GPU: model inferencing';
        }
      },
    });

    controller.setLlmEnabled(false);

    function syncWebLlmButton() {
      if (!webLlmBtn) return;
      const show = mode === MODES.WEBLLM;
      webLlmBtn.hidden = !show;
      if (!show) return;
      if (controller.isLoading()) {
        webLlmBtn.disabled = false;
        webLlmBtn.textContent = 'Cancel load';
        return;
      }
      if (controller.isModelLoaded()) {
        const active = controller.isLlmEnabled();
        webLlmBtn.disabled = false;
        webLlmBtn.textContent = active ? 'WebLLM: ON (toggle instant)' : 'WebLLM: OFF (use WebLLM)';
        webLlmBtn.classList.toggle('btn-primary', active);
        webLlmBtn.classList.toggle('btn-outline-primary', !active);
        return;
      }
      webLlmBtn.disabled = !hasGpu;
      webLlmBtn.textContent = 'Load WebLLM';
      webLlmBtn.classList.remove('btn-primary');
      webLlmBtn.classList.add('btn-outline-primary');
    }

    async function ensureWebLlmLoaded() {
      if (controller.isModelLoaded()) {
        controller.setLlmEnabled(true);
        syncWebLlmButton();
        return;
      }
      if (webLlmBtn) webLlmBtn.textContent = 'Cancel load';
      if (progressEl) progressEl.textContent = 'Loading WebLLM weights…';
      try {
        await controller.ensureEngine();
        controller.setLlmEnabled(true);
        if (progressEl) {
          progressEl.textContent = 'WebLLM ready — chat stays in this browser.';
        }
      } catch (err) {
        controller.setLlmEnabled(false);
        if (progressEl) {
          progressEl.textContent =
            (err && err.message ? err.message : String(err)) +
            ' — using Instant on-device answers.';
        }
        if (statusEl) statusEl.textContent = 'Instant snapshot ready';
      }
      syncWebLlmButton();
    }

    async function applyMode(nextMode) {
      mode = nextMode || MODES.INSTANT;
      syncPrivacy();
      if (mode === MODES.INSTANT) {
        controller.setLlmEnabled(false);
        if (progressEl) {
          progressEl.textContent =
            'Instant answers use the hazard already on this page — no download.';
        }
        if (statusEl && !controller.isBusy()) {
          statusEl.textContent = 'Instant snapshot ready';
        }
      } else if (mode === MODES.WEBLLM) {
        await ensureWebLlmLoaded();
      } else if (mode === MODES.OPENAI_PROCESSOR) {
        controller.setLlmEnabled(false);
        if (progressEl) {
          progressEl.textContent =
            'OpenAI · Processor sends this snapshot to our disaster expert API.';
        }
        if (statusEl) statusEl.textContent = 'OpenAI processor mode';
      } else if (mode === MODES.OPENAI_PORTFOLIO) {
        controller.setLlmEnabled(false);
        if (progressEl) {
          progressEl.textContent =
            'OpenAI · Portfolio sends this snapshot to our portfolio analyst API.';
        }
        if (statusEl) statusEl.textContent = 'OpenAI portfolio mode';
      }
      syncWebLlmButton();
    }

    let sending = false;
    async function send(text) {
      if (sending) return;
      sending = true;
      appendBubble('user', text);
      if (input) input.value = '';
      try {
        if (isOpenAiMode(mode)) {
          const out = await postOpenAiChat({
            message: text,
            mode,
            userId: o.userId,
            fetchFn: o.fetchFn,
            apiEndpoint: o.apiEndpoint || API_ENDPOINT,
            getProcessorContext: o.getProcessorContext,
            getPortfolioContext: o.getPortfolioContext,
          });
          appendBubble('assistant', out.reply || '(empty reply)');
        } else {
          if (
            mode === MODES.WEBLLM &&
            hasGpu &&
            !controller.isModelLoaded() &&
            !controller.isLlmEnabled()
          ) {
            await ensureWebLlmLoaded();
          }
          const { reply, toolTrace } = await controller.chat(text);
          (toolTrace || []).forEach((t) => {
            appendBubble(
              'tool',
              t.call.tool + ' → ' + JSON.stringify(t.result).slice(0, 280)
            );
          });
          appendBubble('assistant', reply || '(empty reply)');
        }
      } catch (err) {
        appendBubble('assistant', 'Error: ' + (err && err.message ? err.message : String(err)));
      } finally {
        sending = false;
        syncWebLlmButton();
      }
    }

    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        applyMode(modeSelect.value).catch((err) => {
          if (progressEl) {
            progressEl.textContent = err && err.message ? err.message : String(err);
          }
        });
      });
    }

    if (helpBtn && explainerEl) {
      helpBtn.addEventListener('click', () => {
        const open = explainerEl.hasAttribute('hidden');
        if (open) explainerEl.removeAttribute('hidden');
        else explainerEl.setAttribute('hidden', '');
        helpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    if (webLlmBtn) {
      webLlmBtn.addEventListener('click', async () => {
        if (controller.isLoading()) {
          controller.cancelLoad();
          return;
        }
        if (controller.isModelLoaded()) {
          controller.setLlmEnabled(!controller.isLlmEnabled());
          syncWebLlmButton();
          if (progressEl) {
            progressEl.textContent = controller.isLlmEnabled()
              ? 'WebLLM ready — chat stays in this browser.'
              : 'Instant snapshot active (WebLLM cached — toggle to re-enable).';
          }
          return;
        }
        await ensureWebLlmLoaded();
      });
    }

    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const text = input ? input.value.trim() : '';
        if (!text || sending) return;
        send(text);
      });
    }

    rootEl.querySelectorAll('#duHazardSuggest [data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-prompt');
        if (!p || sending) return;
        send(p);
      });
    });

    syncPrivacy();
    syncWebLlmButton();

    return {
      controller,
      toolBus,
      getMode() {
        return mode;
      },
      setMode(next) {
        if (modeSelect) modeSelect.value = next;
        return applyMode(next);
      },
      send,
      dispose() {
        controller.dispose();
        rootEl.innerHTML = '';
      },
    };
  }

  root.DisasterWebGpuAgent = {
    API_ENDPOINT,
    MODES,
    TOOL_NAMES: TOOL_NAMES.slice(),
    SYSTEM_PROMPT,
    parseToolCall,
    inferLocalToolCall,
    formatLocalToolReply,
    runLocalToolTurn,
    createToolBus,
    summarizeTriageBands,
    triageBand,
    privacyBadgeForMode,
    postOpenAiChat,
    mount,
  };
})(typeof window !== 'undefined' ? window : globalThis);
