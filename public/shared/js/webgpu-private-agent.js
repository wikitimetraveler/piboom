/**
 * On-device WebGPU privacy agent for the calc-engine WebGPU research demo.
 * Loan inputs + chat stay in the browser; no server assistant APIs.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const MAX_BATCH = 64;
  const MAX_TOOL_ROUNDS = 4;
  const DEFAULT_STALL_TIMEOUT_MS = 12000;
  const DEFAULT_INFER_TIMEOUT_MS = 8000;
  const DEFAULT_MAX_TOKENS = 160;
  const INPUT_KEYS = ['g7', 'g8', 'g9', 'g12', 'g13', 'g14', 'd29'];
  const DEFAULT_MODEL_ID = 'SmolLM2-360M-Instruct-q4f32_1-MLC';
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

  function formatCentsAsDollars(cents) {
    const n = Number(cents);
    if (!Number.isFinite(n)) return '—';
    return (
      '$' +
      (n / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function parseNumericToken(raw) {
    if (raw === undefined || raw === null) return null;
    const cleaned = String(raw).trim().replace(/[$,%\s]/g, '');
    const m = cleaned.match(/^(-?\d+(?:\.\d+)?)(k)?$/i);
    if (!m) return null;
    const val = Number(m[1]) * (m[2] ? 1000 : 1);
    return Number.isFinite(val) ? val : null;
  }

  function inferLocalToolCall(userText) {
    const text = String(userText || '').trim();
    if (!text) return { tool: 'get_compare_snapshot' };

    const explicit = parseToolCall(text);
    if (explicit) return explicit;

    if (/f32|float|drift|miss\s+a\s+cent|missed\s+a\s+cent|ufmip|300000\.27|precision/i.test(text)) {
      return { tool: 'explain_f32_drift' };
    }

    if (/\bbatch\b|\bsweep\b|run_batch/i.test(text)) {
      let vary = 'd29';
      for (let i = 0; i < INPUT_KEYS.length; i++) {
        const k = INPUT_KEYS[i];
        if (new RegExp('\\b(?:fs_)?' + k + '\\b', 'i').test(text)) {
          vary = k;
          break;
        }
      }
      const stripped = text.replace(
        /\b(?:fs_)?(?:g7|g8|g9|g12|g13|g14|g15|g18|g19|g20|g22|g24|g28|d29|e29|g29|g30|g33|f32|i32|u32|binary64)\b/gi,
        ' '
      );
      const matches = stripped.match(/-?\d+(?:\.\d+)?k?/gi) || [];
      const values = matches
        .map((tok) => parseNumericToken(tok))
        .filter((v) => v !== null);
      return {
        tool: 'run_batch',
        vary,
        values: values.length ? values : [1.5, 1.75, 2.0],
      };
    }

    if (
      /what\s+if|scenario|run_scenario|\b(?:g7|g8|g9|g12|g13|g14|d29)\b\s*(?:=|:|is|to|at)\b|\b(?:balance|base\s+amount|max\s+loan|add-?on|fee)\b.*?\d/i.test(
        text
      )
    ) {
      const overlay = {};
      INPUT_KEYS.forEach((k) => {
        const re = new RegExp(
          '\\b(?:fs_)?' + k + '\\b(?:\\s*(?:=|:|is|to|at))?\\s*\\$?(-?[\\d,]+(?:\\.\\d+)?k?)',
          'i'
        );
        const m = text.match(re);
        if (m && m[1]) {
          const v = parseNumericToken(m[1]);
          if (v !== null) overlay[k] = v;
        }
      });

      if (!Object.keys(overlay).length) {
        const stripped = text.replace(
          /\b(?:fs_)?(?:g7|g8|g9|g12|g13|g14|g15|g18|g19|g20|g22|g24|g28|d29|e29|g29|g30|g33|f32|i32|u32)\b/gi,
          ' '
        );
        const numMatch = stripped.match(/\$?(-?[\d,]+(?:\.\d+)?k?)/i);
        const numVal = numMatch ? parseNumericToken(numMatch[1]) : null;
        if (numVal !== null) {
          if (/balance/i.test(text)) overlay.g9 = numVal;
          else if (/max\s+loan|\bcap\b/i.test(text)) overlay.g8 = numVal;
          else if (/base/i.test(text)) overlay.g7 = numVal;
          else if (/add-?on\s*b/i.test(text)) overlay.g13 = numVal;
          else if (/add-?on\s*c/i.test(text)) overlay.g14 = numVal;
          else if (/add-?on/i.test(text)) overlay.g12 = numVal;
          else if (/fee/i.test(text)) overlay.d29 = numVal;
          else overlay.g9 = numVal;
        }
      }
      return { tool: 'run_scenario', overlay };
    }

    if (/\bdag\b|\bgraph\b|\bnodes?\b|\bedges?\b|\bcascade\b|\btopology\b|explain_dag/i.test(text)) {
      return { tool: 'explain_dag' };
    }

    if (/\blive\s+inputs?\b|get_live_inputs/i.test(text)) {
      return { tool: 'get_live_inputs' };
    }

    return { tool: 'get_compare_snapshot' };
  }

  function formatLocalToolReply(call, result) {
    if (!result || result.error) {
      return 'Tool error: ' + (result && result.error ? result.error : 'unknown error');
    }
    const tool = call && call.tool;

    if (tool === 'explain_f32_drift') {
      const sign = result.deltaCents > 0 ? '+' : '';
      return (
        'On a $' +
        Number(result.baseDollars).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        ' base at ' +
        result.feePercent +
        '% fee, exact integer cents give ' +
        result.integerCents +
        ' ¢ (' +
        formatCentsAsDollars(result.integerCents) +
        '), while 32-bit float (f32) rounds to ' +
        result.f32RoundedCents +
        ' ¢ (' +
        formatCentsAsDollars(result.f32RoundedCents) +
        ', delta ' +
        sign +
        result.deltaCents +
        ' ¢). IEEE-754 f32 only has 24 mantissa bits (~7 decimal digits), so loan-sized dollar amounts lose sub-cent precision before rounding. Keep money in integer cents (i32) on GPU and binary64 calcMath on CPU.'
      );
    }

    if (tool === 'run_scenario') {
      const c = result.cents || {};
      const ovKeys = Object.keys((call && call.overlay) || {});
      const ovDesc = ovKeys.length
        ? ovKeys.map((k) => k + '=' + call.overlay[k]).join(', ')
        : 'live inputs';
      return (
        'What-if (' +
        ovDesc +
        ', form unchanged, ' +
        (result.source || 'cpu') +
        ' integer-cent kernel): add-ons g15=' +
        c.g15 +
        ' ¢ (' +
        formatCentsAsDollars(c.g15) +
        '), gap g20=' +
        c.g20 +
        ' ¢ (' +
        formatCentsAsDollars(c.g20) +
        '), base loan g24=' +
        c.g24 +
        ' ¢ (' +
        formatCentsAsDollars(c.g24) +
        '), exact fee e29=' +
        c.e29 +
        ' ¢, rounded fee g29=' +
        c.g29 +
        ' ¢ (' +
        formatCentsAsDollars(c.g29) +
        '), total loan g30=' +
        c.g30 +
        ' ¢ (' +
        formatCentsAsDollars(c.g30) +
        '), ratio g33=' +
        (Number(c.g33Hundredths || 0) / 100).toFixed(2) +
        '×.'
      );
    }

    if (tool === 'run_batch') {
      const rows = result.rows || [];
      const vary = result.vary || 'd29';
      const src = rows[0] && rows[0].source ? rows[0].source : 'cpu';
      const summary = rows
        .map(
          (r) =>
            vary +
            '=' +
            r[vary] +
            ' → g24=' +
            r.g24 +
            ' ¢, e29=' +
            r.e29 +
            ' ¢, g29=' +
            r.g29 +
            ' ¢, g30=' +
            r.g30 +
            ' ¢ (' +
            formatCentsAsDollars(r.g30) +
            ')'
        )
        .join(' | ');
      return 'Batch sweep (' + rows.length + ' runs via ' + src + ' integer-cent kernel): ' + summary + '.';
    }

    if (tool === 'explain_dag') {
      return (
        'FHA loan-amount DAG has ' +
        result.nodeCount +
        ' nodes and ' +
        result.edgeCount +
        ' edges across cascade depth ' +
        result.maxDepth +
        '. ' +
        (result.thesis || '')
      );
    }

    if (tool === 'get_live_inputs') {
      const inp = result.inputs || {};
      const pairs = INPUT_KEYS.filter((k) => inp[k] !== undefined).map((k) => k + '=' + inp[k]);
      return 'Live worksheet inputs (on-device): ' + pairs.join(', ') + '.';
    }

    const cpu = result.cpuIntegerCents || {};
    const ker = (result.kernel && result.kernel.cents) || cpu;
    const src = (result.kernel && result.kernel.source) || 'cpu';
    const match =
      cpu.g15 === ker.g15 &&
      cpu.g20 === ker.g20 &&
      cpu.g24 === ker.g24 &&
      cpu.e29 === ker.e29 &&
      cpu.g29 === ker.g29 &&
      cpu.g30 === ker.g30;
    return (
      'Live snapshot (' +
      src +
      ' kernel ' +
      (match ? 'matches' : 'differs from') +
      ' CPU integer cents): add-ons g15=' +
      ker.g15 +
      ' ¢ (' +
      formatCentsAsDollars(ker.g15) +
      '), gap g20=' +
      ker.g20 +
      ' ¢, base loan g24=' +
      ker.g24 +
      ' ¢ (' +
      formatCentsAsDollars(ker.g24) +
      '), fee e29=' +
      ker.e29 +
      ' ¢ → g29=' +
      ker.g29 +
      ' ¢, total g30=' +
      ker.g30 +
      ' ¢ (' +
      formatCentsAsDollars(ker.g30) +
      '), ratio g33=' +
      (Number(ker.g33Hundredths || 0) / 100).toFixed(2) +
      '×.'
    );
  }

  async function runLocalToolTurn(userText, bus) {
    const call = inferLocalToolCall(userText);
    const result = await bus.invoke(call);
    const reply = formatLocalToolReply(call, result);
    return {
      reply,
      toolTrace: [{ call, result }],
      mode: 'local-kernel',
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

  function createWebLlmWorker() {
    if (
      typeof Worker !== 'function' ||
      typeof Blob !== 'function' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return null;
    }
    try {
      const code = [
        'import * as webllm from ' + JSON.stringify(WEBLLM_CDN) + ';',
        'const handler = new webllm.WebWorkerMLCEngineHandler();',
        'self.onmessage = (msg) => handler.onmessage(msg);',
      ].join('\n');
      const blob = new Blob([code], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl, { type: 'module' });
      return {
        worker,
        terminate() {
          try {
            worker.terminate();
          } catch (_) {
            /* ignore */
          }
          try {
            if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(blobUrl);
          } catch (_) {
            /* ignore */
          }
        },
      };
    } catch (_) {
      return null;
    }
  }

  function createChatController(opts) {
    const o = opts || {};
    const bus = o.toolBus || createToolBus(o);
    const onProgress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
    const onGpuBusy = typeof o.onGpuBusy === 'function' ? o.onGpuBusy : () => {};
    const parseTool =
      typeof o.parseToolCall === 'function' ? o.parseToolCall : parseToolCall;
    const formatReply =
      typeof o.formatLocalToolReply === 'function'
        ? o.formatLocalToolReply
        : formatLocalToolReply;
    const runLocal =
      typeof o.runLocalToolTurn === 'function'
        ? o.runLocalToolTurn
        : runLocalToolTurn;
    const modelId = o.modelId || DEFAULT_MODEL_ID;
    const hasCustomImporter = typeof o.importWebLlm === 'function';
    const stallTimeoutMs =
      typeof o.stallTimeoutMs === 'number'
        ? o.stallTimeoutMs
        : hasCustomImporter
          ? 0
          : DEFAULT_STALL_TIMEOUT_MS;
    const inferTimeoutMs =
      typeof o.inferTimeoutMs === 'number'
        ? o.inferTimeoutMs
        : hasCustomImporter
          ? 0
          : DEFAULT_INFER_TIMEOUT_MS;
    let engine = null;
    let llmEnabled = true;
    let activeWorker = null;
    let cancelPendingLoad = null;
    let loading = false;
    let busy = false;
    const systemContent = o.systemPrompt
      ? o.systemExtra
        ? String(o.systemPrompt) + ' ' + String(o.systemExtra)
        : String(o.systemPrompt)
      : buildSystemPrompt(o.systemExtra);
    const messages = [{ role: 'system', content: systemContent }];

    function notifyGpuBusy() {
      onGpuBusy(Boolean(busy || loading), {
        loading: Boolean(loading),
        inferencing: Boolean(busy),
      });
    }

    function cleanupWorker() {
      if (activeWorker) {
        activeWorker.terminate();
        activeWorker = null;
      }
    }

    function cancelLoad() {
      if (typeof cancelPendingLoad === 'function') {
        cancelPendingLoad(new Error('Model load canceled — using instant on-device GPU kernel mode'));
      }
    }

    async function ensureEngine() {
      if (engine) return engine;
      if (loading) throw new Error('Model already loading');
      if (!detectWebGpuAvailable(o.gpu)) {
        throw new Error('WebGPU required for private on-device agent');
      }
      loading = true;
      notifyGpuBusy();
      let stallTimer = null;
      try {
        const webllm = await loadWebLlm(o.importWebLlm);
        let lastStepText = 'initializing';

        const createPromise = (async () => {
          const progressCb = (report) => {
            const text = report && report.text ? report.text : String(report || '');
            lastStepText = text || lastStepText;
            if (stallTimer && stallTimeoutMs > 0) {
              clearTimeout(stallTimer);
              stallTimer = setTimeout(() => {
                if (typeof cancelPendingLoad === 'function') {
                  cancelPendingLoad(
                    new Error(
                      'WebLLM stalled at "' +
                        lastStepText +
                        '" — using instant on-device GPU kernel mode'
                    )
                  );
                }
              }, stallTimeoutMs);
            }
            onProgress(text);
          };

          if (!hasCustomImporter && typeof webllm.CreateWebWorkerMLCEngine === 'function') {
            const w = createWebLlmWorker();
            if (w) {
              activeWorker = w;
              return webllm.CreateWebWorkerMLCEngine(w.worker, modelId, {
                initProgressCallback: progressCb,
              });
            }
          }

          return webllm.CreateMLCEngine(modelId, {
            initProgressCallback: progressCb,
          });
        })();

        const abortPromise = new Promise((_, reject) => {
          cancelPendingLoad = reject;
          if (stallTimeoutMs > 0) {
            stallTimer = setTimeout(() => {
              reject(
                new Error(
                  'WebLLM stalled at "' +
                    lastStepText +
                    '" — using instant on-device GPU kernel mode'
                )
              );
            }, stallTimeoutMs);
          }
        });

        engine = await Promise.race([createPromise, abortPromise]);
        llmEnabled = true;
        return engine;
      } catch (err) {
        cleanupWorker();
        throw err;
      } finally {
        if (stallTimer) clearTimeout(stallTimer);
        cancelPendingLoad = null;
        loading = false;
        // Clear GPU-busy when load was standalone (Load button). If chat
        // already set busy, completeOnce owns the clear after inference.
        notifyGpuBusy();
      }
    }

    async function completeOnce(history) {
      busy = true;
      notifyGpuBusy();
      let inferTimer = null;
      try {
        const eng = await ensureEngine();
        const reqPromise = eng.chat.completions.create({
          messages: history,
          temperature: 0.2,
          max_tokens: DEFAULT_MAX_TOKENS,
          stream: false,
        });
        const reply =
          inferTimeoutMs > 0
            ? await Promise.race([
                reqPromise,
                new Promise((_, reject) => {
                  inferTimer = setTimeout(() => {
                    const err = new Error(
                      'WebLLM inference timed out — using instant on-device kernel'
                    );
                    err.isInferenceTimeout = true;
                    reject(err);
                  }, inferTimeoutMs);
                }),
              ])
            : await reqPromise;
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
        if (inferTimer) clearTimeout(inferTimer);
        busy = false;
        notifyGpuBusy();
      }
    }

    async function chat(userText) {
      const text = String(userText || '').trim();
      if (!text) return { reply: '', toolTrace: [] };

      const useLlm = Boolean(llmEnabled && (engine || hasCustomImporter || o.autoLoadModel));
      if (!useLlm) {
        messages.push({ role: 'user', content: text });
        const localOut = await runLocal(text, bus);
        messages.push({ role: 'assistant', content: localOut.reply });
        return localOut;
      }

      messages.push({ role: 'user', content: text });
      const toolTrace = [];
      const seenCalls = new Set();
      let lastCall = null;
      let lastResult = null;
      let reply = '';

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          reply = await completeOnce(messages);
          const call = parseTool(reply);
          if (!call) {
            const finalReply =
              reply.trim() ||
              (lastCall && lastResult ? formatReply(lastCall, lastResult) : '');
            messages.push({ role: 'assistant', content: finalReply });
            return { reply: finalReply, toolTrace };
          }
          const sig = JSON.stringify(call);
          if (seenCalls.has(sig) && lastCall && lastResult) {
            const formatted = formatReply(lastCall, lastResult);
            messages.push({ role: 'assistant', content: formatted });
            return { reply: formatted, toolTrace };
          }
          seenCalls.add(sig);
          messages.push({ role: 'assistant', content: reply });
          const result = await bus.invoke(call);
          lastCall = call;
          lastResult = result;
          toolTrace.push({ call, result });
          messages.push({
            role: 'user',
            content:
              'Tool result for ' +
              call.tool +
              ' (explain in 1-2 short sentences using these exact numbers; do not output JSON):\n' +
              JSON.stringify(result),
          });
        }

        reply = await completeOnce(messages);
        const postLoopCall = parseTool(reply);
        if ((postLoopCall || !reply.trim()) && lastCall && lastResult) {
          reply = formatReply(lastCall, lastResult);
        }
        messages.push({ role: 'assistant', content: reply });
        return { reply, toolTrace };
      } catch (err) {
        if (err && err.isInferenceTimeout) {
          if (lastCall && lastResult) {
            const fallbackReply = formatReply(lastCall, lastResult);
            messages.push({ role: 'assistant', content: fallbackReply });
            return { reply: fallbackReply, toolTrace, mode: 'local-kernel-fallback' };
          }
          const localOut = await runLocal(text, bus);
          messages.push({ role: 'assistant', content: localOut.reply });
          return localOut;
        }
        throw err;
      }
    }

    return {
      modelId,
      messages,
      chat,
      ensureEngine,
      cancelLoad,
      isModelLoaded() {
        return Boolean(engine);
      },
      isLlmEnabled() {
        return Boolean(llmEnabled && engine);
      },
      setLlmEnabled(flag) {
        llmEnabled = Boolean(flag);
        return llmEnabled;
      },
      isLoading() {
        return Boolean(loading);
      },
      isBusy() {
        return busy || loading;
      },
      dispose() {
        cancelLoad();
        cleanupWorker();
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
      '    <p class="small text-muted mb-2">On-device WebGPU integer-cent tool agent + optional WebLLM. Loan inputs and chat stay in this browser — not our server assistants.</p>',
      '    <span class="badge text-bg-success border" id="cePrivacyBadge">Privacy: local only</span>',
      '    <span class="badge text-bg-light border ms-1" id="ceAgentStatus">' +
        (hasGpu ? 'WebGPU ready (on-device kernel)' : 'CPU fallback ready') +
        '</span>',
      '  </div>',
      '  <div class="ce-private-agent__controls my-2 d-flex flex-wrap gap-2 align-items-center">',
      '    <button type="button" class="btn btn-sm btn-outline-primary" id="ceAgentLoad"' +
        (hasGpu ? '' : ' disabled') +
        '>Load optional WebLLM</button>',
      '    <span class="small text-muted" id="ceAgentProgress">' +
        (hasGpu
          ? 'Instant on-device GPU kernel ready — click a prompt or ask below.'
          : 'WebGPU unavailable for WebLLM; instant local CPU integer-cent tools ready.') +
        '</span>',
      '  </div>',
      '  <div class="ce-private-agent__suggest d-flex flex-wrap gap-2 mb-2" id="ceAgentSuggest">',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Why can f32 miss a cent on the fee?">Why did fee miss a cent?</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="What if current balance g9 is 200000? Use run_scenario.">What if balance is $200k?</button>',
      '    <button type="button" class="btn btn-sm btn-outline-secondary" data-prompt="Batch fee percent d29 over 1.5, 1.75, 2.0 and compare g30 cents.">Batch fee 1.5–2.0%</button>',
      '  </div>',
      '  <div class="ce-private-agent__log border rounded p-2 mb-2" id="ceAgentLog" aria-live="polite"></div>',
      '  <form class="ce-private-agent__form d-flex gap-2" id="ceAgentForm">',
      '    <label class="visually-hidden" for="ceAgentInput">Message</label>',
      '    <input type="text" class="form-control form-control-sm" id="ceAgentInput" placeholder="Ask about the DAG, drift, or a what-if…" autocomplete="off">',
      '    <button type="submit" class="btn btn-sm btn-dark" id="ceAgentSend">Send</button>',
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
        return Boolean(o._gpuInferencing);
      },
    });

    const controller = createChatController({
      toolBus,
      modelId: o.modelId || DEFAULT_MODEL_ID,
      importWebLlm: o.importWebLlm,
      gpu: o.gpu,
      stallTimeoutMs: o.stallTimeoutMs,
      systemExtra: o.systemExtra,
      onProgress(text) {
        if (progressEl) progressEl.textContent = text || '';
      },
      onGpuBusy(flag, meta) {
        const isInf = Boolean(flag && meta && meta.inferencing);
        o._gpuBusy = Boolean(flag);
        o._gpuInferencing = isInf;
        if (typeof o.onGpuBusy === 'function') o.onGpuBusy(Boolean(flag), meta);
        if (statusEl && hasGpu) {
          if (!flag) {
            statusEl.textContent = controller.isLlmEnabled()
              ? 'WebLLM loaded (on-device)'
              : 'WebGPU ready (on-device kernel)';
          } else if (meta && meta.loading) {
            statusEl.textContent = 'Loading WebLLM in background…';
          } else {
            statusEl.textContent = 'GPU: model inferencing';
          }
        }
      },
    });

    function syncLoadButtonUi() {
      if (!loadBtn) return;
      if (controller.isModelLoaded()) {
        const active = controller.isLlmEnabled();
        loadBtn.disabled = false;
        loadBtn.textContent = active ? 'WebLLM: ON (toggle kernel)' : 'WebLLM: OFF (use WebLLM)';
        loadBtn.classList.toggle('btn-primary', active);
        loadBtn.classList.toggle('btn-outline-primary', !active);
        if (statusEl && hasGpu && !controller.isBusy()) {
          statusEl.textContent = active
            ? 'WebLLM loaded (on-device)'
            : 'WebGPU ready (on-device kernel)';
        }
        if (progressEl && !controller.isBusy()) {
          progressEl.textContent = active
            ? 'Ready (click button to switch to instant kernel)'
            : 'Instant kernel active (WebLLM cached in VRAM — click to re-enable)';
        }
      }
    }

    let sending = false;
    async function send(text) {
      if (sending) return;
      sending = true;
      appendBubble('user', text);
      if (input) input.value = '';
      try {
        const { reply, toolTrace } = await controller.chat(text);
        (toolTrace || []).forEach((t) => {
          appendBubble('tool', t.call.tool + ' → ' + JSON.stringify(t.result).slice(0, 280));
        });
        appendBubble('assistant', reply || '(empty reply)');
        if (statusEl && hasGpu && !controller.isBusy()) {
          statusEl.textContent = controller.isLlmEnabled()
            ? 'WebLLM loaded (on-device)'
            : 'WebGPU ready (on-device kernel)';
        }
      } catch (err) {
        appendBubble('assistant', 'Error: ' + (err && err.message ? err.message : String(err)));
        if (statusEl) {
          statusEl.textContent = hasGpu ? 'WebGPU ready (on-device kernel)' : 'CPU fallback ready';
        }
      } finally {
        sending = false;
      }
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', async () => {
        if (controller.isLoading()) {
          controller.cancelLoad();
          return;
        }
        if (controller.isModelLoaded()) {
          controller.setLlmEnabled(!controller.isLlmEnabled());
          syncLoadButtonUi();
          return;
        }
        loadBtn.textContent = 'Cancel load';
        try {
          await controller.ensureEngine();
          syncLoadButtonUi();
        } catch (err) {
          loadBtn.textContent = 'Load optional WebLLM';
          loadBtn.disabled = false;
          if (progressEl) {
            progressEl.textContent = err && err.message ? err.message : String(err);
          }
          if (statusEl && hasGpu) {
            statusEl.textContent = 'WebGPU ready (on-device kernel)';
          }
        }
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

    rootEl.querySelectorAll('#ceAgentSuggest [data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-prompt');
        if (!p || sending) return;
        send(p);
      });
    });

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
    DEFAULT_STALL_TIMEOUT_MS,
    INPUT_KEYS: INPUT_KEYS.slice(),
    DEFAULT_MODEL_ID,
    WEBLLM_CDN,
    SYSTEM_PROMPT,
    TOOL_NAMES: TOOL_NAMES.slice(),
    detectWebGpuAvailable,
    mergeInputs,
    parseToolCall,
    inferLocalToolCall,
    formatLocalToolReply,
    runLocalToolTurn,
    buildSystemPrompt,
    createToolBus,
    createChatController,
    loadWebLlm,
    mount,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
