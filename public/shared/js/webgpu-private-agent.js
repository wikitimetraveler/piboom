/**
 * On-device WebGPU privacy agent for the calc-engine WebGPU research demo.
 * Loan inputs + chat stay in the browser; no server assistant APIs.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const MAX_BATCH = 64;
  const MAX_TOOL_ROUNDS = 4;
  const INPUT_KEYS = ['g7', 'g8', 'g9', 'g12', 'g13', 'g14', 'd29'];
  const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
  const WEBLLM_CDN = 'https://esm.run/@mlc-ai/web-llm';

  const SYSTEM_PROMPT = [
    'You are the Private GPU calc tutor on the WebGPU loan-amount research page.',
    'Privacy: loan inputs and this chat never leave this browser. Do not suggest server APIs.',
    'Never invent dollar or cent amounts — call tools, then explain the returned numbers.',
    'Tools (reply with one JSON object when you need data):',
    '{"tool":"get_live_inputs"}',
    '{"tool":"get_compare_snapshot"}',
    '{"tool":"explain_dag"}',
    '{"tool":"explain_f32_drift"}',
    '{"tool":"run_scenario","overlay":{"g9":200000}}',
    '{"tool":"run_batch","vary":"d29","values":[1.5,1.75,2.0]}',
    'After tool results arrive, answer in plain language for a mortgage engineer.',
    'Keep answers short. Prefer integer cents over float dollars when discussing money.',
  ].join(' ');

  const TOOL_NAMES = [
    'get_live_inputs',
    'get_compare_snapshot',
    'explain_dag',
    'explain_f32_drift',
    'run_scenario',
    'run_batch',
  ];

  function detectWebGpuAvailable(gpu) {
    const navGpu =
      gpu !== undefined
        ? gpu
        : typeof navigator !== 'undefined'
          ? navigator.gpu
          : undefined;
    return Boolean(navGpu);
  }

  function mergeInputs(base, overlay) {
    const out = {};
    INPUT_KEYS.forEach((k) => {
      if (base && base[k] !== undefined && base[k] !== null && base[k] !== '') {
        out[k] = base[k];
      }
    });
    if (!overlay || typeof overlay !== 'object') return out;
    INPUT_KEYS.forEach((k) => {
      if (overlay[k] !== undefined && overlay[k] !== null && overlay[k] !== '') {
        out[k] = overlay[k];
      }
    });
    return out;
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

  function buildSystemPrompt(extra) {
    if (!extra) return SYSTEM_PROMPT;
    return SYSTEM_PROMPT + ' ' + String(extra);
  }

  function assertNoNetwork(url) {
    const s = String(url || '');
    if (/\/api\/[^/]*assistant/i.test(s) || /assistant\/chat/i.test(s)) {
      throw new Error('Private agent tools must not call server assistant APIs');
    }
  }

  function createToolBus(deps) {
    const d = deps || {};
    const math = d.calcMath || root.calcMath;

    async function resolveCents(input) {
      const preferCpu = typeof d.preferCpu === 'function' ? d.preferCpu() : Boolean(d.preferCpu);
      if (!preferCpu && typeof d.runIntegerKernel === 'function') {
        const run = await d.runIntegerKernel(input);
        if (run && run.cents) {
          return { source: run.source || 'gpu', cents: run.cents };
        }
      }
      if (!math || typeof math.fhaLoanAmountIntegerCents !== 'function') {
        throw new Error('calcMath.fhaLoanAmountIntegerCents unavailable');
      }
      return { source: 'cpu', cents: math.fhaLoanAmountIntegerCents(input) };
    }

    async function invoke(call) {
      const tool = call && call.tool;
      if (!tool) return { error: 'missing tool' };
      if (TOOL_NAMES.indexOf(tool) < 0) return { error: 'unknown tool', tool };

      if (tool === 'get_live_inputs') {
        const inputs = typeof d.getLiveInputs === 'function' ? d.getLiveInputs() : {};
        return { tool, inputs: mergeInputs(inputs, null) };
      }

      if (tool === 'get_compare_snapshot') {
        if (typeof d.getCompareSnapshot === 'function') {
          return { tool, ...(await d.getCompareSnapshot()) };
        }
        const inputs = typeof d.getLiveInputs === 'function' ? d.getLiveInputs() : {};
        const live = mergeInputs(inputs, null);
        const cpu =
          math && typeof math.fhaLoanAmountIntegerCents === 'function'
            ? math.fhaLoanAmountIntegerCents(live)
            : null;
        const resolved = await resolveCents(live);
        return {
          tool,
          inputs: live,
          calcMathNote: 'Worksheet live cells use binary64 calcMath; compare cents below.',
          cpuIntegerCents: cpu,
          kernel: resolved,
        };
      }

      if (tool === 'explain_dag') {
        const layout =
          typeof d.getLayout === 'function'
            ? d.getLayout()
            : { nodes: [], edges: [], maxDepth: 0 };
        const nodes = (layout.nodes || []).map((n) => ({
          id: n.id,
          label: n.label,
          depth: n.depth,
          isResult: Boolean(n.isResult),
        }));
        const edges = (layout.edges || []).map((e) => ({
          from: e.from,
          to: e.to,
          calculation: e.calculation || '',
        }));
        return {
          tool,
          maxDepth: layout.maxDepth || 0,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodes,
          edges,
          thesis:
            'CPU calcMath owns live money; WebGPU paints the cascade and can verify integer cents.',
        };
      }

      if (tool === 'explain_f32_drift') {
        const fx = math && math.FHA_F32_UFMIP_DIVERGENCE;
        if (!fx) return { tool, error: 'FHA_F32_UFMIP_DIVERGENCE missing' };
        const f32Dollars =
          math && typeof math.multiplyPercentageF32 === 'function'
            ? math.multiplyPercentageF32([fx.g24Dollars, fx.d29])
            : null;
        const f32C =
          f32Dollars == null ? null : Math.round(f32Dollars * 100 + Number.EPSILON);
        return {
          tool,
          baseDollars: fx.g24Dollars,
          feePercent: fx.d29,
          integerCents: fx.integerCents,
          f32RoundedCents: f32C,
          deltaCents: f32C == null ? null : f32C - fx.integerCents,
          claim: 'Default GPU f32 dollar floats can miss loan-sized cents; use integer cents.',
        };
      }

      if (tool === 'run_scenario') {
        const base = typeof d.getLiveInputs === 'function' ? d.getLiveInputs() : {};
        const merged = mergeInputs(base, call.overlay || {});
        const resolved = await resolveCents(merged);
        return {
          tool,
          appliedToForm: false,
          inputs: merged,
          source: resolved.source,
          cents: resolved.cents,
        };
      }

      if (tool === 'run_batch') {
        const vary = call.vary || 'd29';
        let values = Array.isArray(call.values) ? call.values.slice() : [];
        if (values.length > MAX_BATCH) {
          values = values.slice(0, MAX_BATCH);
        }
        if (!values.length) {
          return { tool, error: 'values required', maxBatch: MAX_BATCH };
        }
        if (INPUT_KEYS.indexOf(vary) < 0) {
          return { tool, error: 'invalid vary key', vary, allowed: INPUT_KEYS.slice() };
        }
        const base = typeof d.getLiveInputs === 'function' ? d.getLiveInputs() : {};
        const rows = [];
        for (let i = 0; i < values.length; i++) {
          const overlay = {};
          overlay[vary] = values[i];
          const merged = mergeInputs(base, overlay);
          const resolved = await resolveCents(merged);
          rows.push({
            [vary]: values[i],
            source: resolved.source,
            g24: resolved.cents.g24,
            e29: resolved.cents.e29,
            g29: resolved.cents.g29,
            g30: resolved.cents.g30,
            g33Hundredths: resolved.cents.g33Hundredths,
          });
        }
        return {
          tool,
          vary,
          capped: Array.isArray(call.values) && call.values.length > MAX_BATCH,
          maxBatch: MAX_BATCH,
          count: rows.length,
          rows,
        };
      }

      return { error: 'unhandled tool', tool };
    }

    return {
      TOOL_NAMES: TOOL_NAMES.slice(),
      MAX_BATCH,
      INPUT_KEYS: INPUT_KEYS.slice(),
      invoke,
      mergeInputs,
      assertNoNetwork,
    };
  }

  async function loadWebLlm(importFn) {
    const importer =
      typeof importFn === 'function'
        ? importFn
        : (url) => import(/* webpackIgnore: true */ url);
    assertNoNetwork(WEBLLM_CDN);
    const mod = await importer(WEBLLM_CDN);
    if (!mod || typeof mod.CreateMLCEngine !== 'function') {
      throw new Error('WebLLM CreateMLCEngine unavailable');
    }
    return mod;
  }

  function createChatController(opts) {
    const o = opts || {};
    const bus = o.toolBus || createToolBus(o);
    const onProgress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
    const onGpuBusy = typeof o.onGpuBusy === 'function' ? o.onGpuBusy : () => {};
    const modelId = o.modelId || DEFAULT_MODEL_ID;
    let engine = null;
    let loading = false;
    let busy = false;
    const messages = [{ role: 'system', content: buildSystemPrompt(o.systemExtra) }];

    function notifyGpuBusy() {
      onGpuBusy(Boolean(busy || loading), {
        loading: Boolean(loading),
        inferencing: Boolean(busy),
      });
    }

    async function ensureEngine() {
      if (engine) return engine;
      if (loading) throw new Error('Model already loading');
      if (!detectWebGpuAvailable(o.gpu)) {
        throw new Error('WebGPU required for private on-device agent');
      }
      loading = true;
      notifyGpuBusy();
      try {
        const webllm = await loadWebLlm(o.importWebLlm);
        engine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: (report) => {
            onProgress(report && report.text ? report.text : String(report || ''));
          },
        });
        return engine;
      } finally {
        loading = false;
        // Clear GPU-busy when load was standalone (Load button). If chat
        // already set busy, completeOnce owns the clear after inference.
        notifyGpuBusy();
      }
    }

    async function completeOnce(history) {
      busy = true;
      notifyGpuBusy();
      try {
        const eng = await ensureEngine();
        const reply = await eng.chat.completions.create({
          messages: history,
          temperature: 0.2,
          stream: false,
        });
        const content =
          reply &&
          reply.choices &&
          reply.choices[0] &&
          reply.choices[0].message &&
          reply.choices[0].message.content
            ? reply.choices[0].message.content
            : '';
        return String(content || '');
      } finally {
        busy = false;
        notifyGpuBusy();
      }
    }

    async function chat(userText) {
      const text = String(userText || '').trim();
      if (!text) return { reply: '', toolTrace: [] };
      messages.push({ role: 'user', content: text });
      const toolTrace = [];
      let reply = '';

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        reply = await completeOnce(messages);
        const call = parseToolCall(reply);
        if (!call) {
          messages.push({ role: 'assistant', content: reply });
          return { reply, toolTrace };
        }
        messages.push({ role: 'assistant', content: reply });
        const result = await bus.invoke(call);
        toolTrace.push({ call, result });
        messages.push({
          role: 'user',
          content:
            'Tool result for ' +
            call.tool +
            ' (use these exact numbers; do not invent money):\n' +
            JSON.stringify(result),
        });
      }

      reply = await completeOnce(messages);
      messages.push({ role: 'assistant', content: reply });
      return { reply, toolTrace };
    }

    return {
      modelId,
      messages,
      chat,
      ensureEngine,
      isBusy() {
        return busy || loading;
      },
      dispose() {
        engine = null;
        busy = false;
        loading = false;
        notifyGpuBusy();
      },
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(opts) {
    const o = opts || {};
    const rootEl = o.panelRoot;
    if (!rootEl) return null;

    const hasGpu = detectWebGpuAvailable(o.gpu);
    rootEl.innerHTML = [
      '<div class="ce-private-agent">',
      '  <div class="ce-private-agent__head">',
      '    <h2 class="h5 mb-1">Private GPU agent</h2>',
      '    <p class="small text-muted mb-2">On-device WebLLM via WebGPU. Loan inputs and chat stay in this browser — not our server assistants.</p>',
      '    <span class="badge text-bg-success border" id="cePrivacyBadge">Privacy: local only</span>',
      '    <span class="badge text-bg-light border ms-1" id="ceAgentStatus">' +
        (hasGpu ? 'WebGPU detected' : 'WebGPU required') +
        '</span>',
      '  </div>',
      '  <div class="ce-private-agent__controls my-2 d-flex flex-wrap gap-2 align-items-center">',
      '    <button type="button" class="btn btn-sm btn-primary" id="ceAgentLoad"' +
        (hasGpu ? '' : ' disabled') +
        '>Load on-device model</button>',
      '    <span class="small text-muted" id="ceAgentProgress"></span>',
      '  </div>',
      '  <div class="ce-private-agent__suggest d-flex flex-wrap gap-2 mb-2" id="ceAgentSuggest">',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Why can f32 miss a cent on the fee?">Why did fee miss a cent?</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="What if current balance g9 is 200000? Use run_scenario.">What if balance is $200k?</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Batch fee percent d29 over 1.5, 1.75, 2.0 and compare g30 cents.">Batch fee 1.5–2.0%</button>',
      '  </div>',
      '  <div class="ce-private-agent__log border rounded p-2 mb-2" id="ceAgentLog" aria-live="polite"></div>',
      '  <form class="ce-private-agent__form d-flex gap-2" id="ceAgentForm">',
      '    <label class="visually-hidden" for="ceAgentInput">Message</label>',
      '    <input type="text" class="form-control form-control-sm" id="ceAgentInput" placeholder="Ask about the DAG, drift, or a what-if…" ' +
        (hasGpu ? '' : 'disabled ') +
        'autocomplete="off">',
      '    <button type="submit" class="btn btn-sm btn-dark" id="ceAgentSend"' +
        (hasGpu ? '' : ' disabled') +
        '>Send</button>',
      '  </form>',
      '</div>',
    ].join('\n');

    const logEl = rootEl.querySelector('#ceAgentLog');
    const progressEl = rootEl.querySelector('#ceAgentProgress');
    const statusEl = rootEl.querySelector('#ceAgentStatus');
    const loadBtn = rootEl.querySelector('#ceAgentLoad');
    const form = rootEl.querySelector('#ceAgentForm');
    const input = rootEl.querySelector('#ceAgentInput');

    function appendBubble(role, text) {
      if (!logEl) return;
      const div = document.createElement('div');
      div.className = 'ce-private-agent__msg ce-private-agent__msg--' + role;
      div.innerHTML =
        '<strong>' +
        (role === 'user' ? 'You' : role === 'tool' ? 'Tool' : 'Agent') +
        ':</strong> <span>' +
        escapeHtml(text) +
        '</span>';
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }

    const toolBus = createToolBus({
      calcMath: o.calcMath || root.calcMath,
      getLiveInputs: o.getLiveInputs,
      getCompareSnapshot: o.getCompareSnapshot,
      getLayout: o.getLayout,
      runIntegerKernel: o.runIntegerKernel,
      preferCpu: () => {
        if (typeof o.preferCpu === 'function') return o.preferCpu();
        return Boolean(o._gpuBusy);
      },
    });

    const controller = createChatController({
      toolBus,
      modelId: o.modelId || DEFAULT_MODEL_ID,
      importWebLlm: o.importWebLlm,
      gpu: o.gpu,
      systemExtra: o.systemExtra,
      onProgress(text) {
        if (progressEl) progressEl.textContent = text || '';
      },
      onGpuBusy(flag, meta) {
        o._gpuBusy = Boolean(flag);
        if (typeof o.onGpuBusy === 'function') o.onGpuBusy(Boolean(flag), meta);
        if (statusEl && hasGpu) {
          if (!flag) {
            statusEl.textContent = 'WebGPU ready';
          } else if (meta && meta.loading) {
            statusEl.textContent = 'GPU: loading model (DAG paused)';
          } else {
            statusEl.textContent = 'GPU: model busy (DAG paused)';
          }
        }
      },
    });

    async function send(text) {
      appendBubble('user', text);
      if (input) input.value = '';
      try {
        const { reply, toolTrace } = await controller.chat(text);
        (toolTrace || []).forEach((t) => {
          appendBubble('tool', t.call.tool + ' → ' + JSON.stringify(t.result).slice(0, 280));
        });
        appendBubble('assistant', reply || '(empty reply)');
        if (statusEl && hasGpu && !controller.isBusy()) {
          statusEl.textContent = 'WebGPU ready';
        }
      } catch (err) {
        appendBubble('assistant', 'Error: ' + (err && err.message ? err.message : String(err)));
        if (statusEl) statusEl.textContent = hasGpu ? 'Error' : 'WebGPU required';
      }
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', async () => {
        loadBtn.disabled = true;
        try {
          await controller.ensureEngine();
          if (statusEl) statusEl.textContent = 'Model loaded (on-device)';
          if (progressEl) progressEl.textContent = 'Ready';
        } catch (err) {
          if (progressEl) {
            progressEl.textContent = err && err.message ? err.message : String(err);
          }
          if (statusEl && hasGpu) statusEl.textContent = 'Error';
          loadBtn.disabled = false;
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const text = input ? input.value.trim() : '';
        if (!text || controller.isBusy()) return;
        send(text);
      });
    }

    rootEl.querySelectorAll('#ceAgentSuggest [data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-prompt');
        if (!p || controller.isBusy()) return;
        send(p);
      });
    });

    if (!hasGpu && progressEl) {
      progressEl.textContent =
        'WebGPU required for private on-device agent. Calc graph still works with CPU fallback.';
    }

    return {
      controller,
      toolBus,
      dispose() {
        controller.dispose();
        rootEl.innerHTML = '';
      },
    };
  }

  root.WebGpuPrivateAgent = {
    MAX_BATCH,
    MAX_TOOL_ROUNDS,
    INPUT_KEYS: INPUT_KEYS.slice(),
    DEFAULT_MODEL_ID,
    WEBLLM_CDN,
    SYSTEM_PROMPT,
    TOOL_NAMES: TOOL_NAMES.slice(),
    detectWebGpuAvailable,
    mergeInputs,
    parseToolCall,
    buildSystemPrompt,
    createToolBus,
    createChatController,
    loadWebLlm,
    mount,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
