/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import '../../public/shared/calcEngineLibrary.js';
import '../../public/shared/calculationEngine.js';
import '../../public/shared/js/webgpu-private-agent.js';

const { WebGpuPrivateAgent, calcMath, createFHACalculatorConfig } = globalThis;

describe('WebGpuPrivateAgent', () => {
  test('exports mount, tool bus, and privacy system prompt', () => {
    expect(typeof WebGpuPrivateAgent.mount).toBe('function');
    expect(typeof WebGpuPrivateAgent.createToolBus).toBe('function');
    expect(WebGpuPrivateAgent.SYSTEM_PROMPT).toMatch(/never leave this browser/i);
    expect(WebGpuPrivateAgent.SYSTEM_PROMPT).toMatch(/Do not suggest server APIs/i);
    expect(WebGpuPrivateAgent.TOOL_NAMES).toEqual(
      expect.arrayContaining([
        'get_live_inputs',
        'get_compare_snapshot',
        'explain_dag',
        'explain_f32_drift',
        'run_scenario',
        'run_batch',
      ])
    );
    expect(WebGpuPrivateAgent.MAX_BATCH).toBe(64);
  });

  test('buildSystemPrompt includes privacy instruction', () => {
    const p = WebGpuPrivateAgent.buildSystemPrompt('Extra context.');
    expect(p).toContain(WebGpuPrivateAgent.SYSTEM_PROMPT);
    expect(p).toMatch(/Extra context/);
  });

  test('mergeInputs overlays what-if fields without dropping base', () => {
    const merged = WebGpuPrivateAgent.mergeInputs(
      { g7: 400000, g8: 360000, g9: 222000, g12: 1, g13: 2, g14: 3, d29: 1.75 },
      { g9: 200000, d29: 2 }
    );
    expect(merged.g7).toBe(400000);
    expect(merged.g9).toBe(200000);
    expect(merged.d29).toBe(2);
    expect(merged.g12).toBe(1);
  });

  test('parseToolCall reads fenced and inline JSON tool calls', () => {
    expect(
      WebGpuPrivateAgent.parseToolCall('```json\n{"tool":"explain_dag"}\n```')
    ).toEqual({ tool: 'explain_dag' });
    expect(
      WebGpuPrivateAgent.parseToolCall(
        'I will check.\n{"tool":"run_scenario","overlay":{"g9":200000}}\nDone.'
      )
    ).toEqual({ tool: 'run_scenario', overlay: { g9: 200000 } });
    expect(WebGpuPrivateAgent.parseToolCall('no tools here')).toBeNull();
    expect(WebGpuPrivateAgent.parseToolCall('{"tool":"hack_server"}')).toBeNull();
  });

  test('detectWebGpuAvailable follows navigator.gpu', () => {
    expect(WebGpuPrivateAgent.detectWebGpuAvailable({})).toBe(true);
    expect(WebGpuPrivateAgent.detectWebGpuAvailable(null)).toBe(false);
    expect(WebGpuPrivateAgent.detectWebGpuAvailable(undefined)).toBe(false);
  });

  test('tool bus run_scenario merges overlay and returns integer cents', async () => {
    const bus = WebGpuPrivateAgent.createToolBus({
      calcMath,
      getLiveInputs: () => ({
        g7: 400000,
        g8: 360000,
        g9: 222000,
        g12: 180000,
        g13: 40000,
        g14: 24000,
        d29: 1.75,
      }),
      preferCpu: () => true,
    });
    const out = await bus.invoke({ tool: 'run_scenario', overlay: { g9: 200000 } });
    expect(out.appliedToForm).toBe(false);
    expect(out.source).toBe('cpu');
    expect(out.inputs.g9).toBe(200000);
    expect(out.cents.g15).toBe(calcMath.fhaLoanAmountIntegerCents(out.inputs).g15);
    expect(out.cents.g30).toBe(calcMath.fhaLoanAmountIntegerCents(out.inputs).g30);
  });

  test('tool bus run_batch caps at MAX_BATCH and varies one key', async () => {
    const bus = WebGpuPrivateAgent.createToolBus({
      calcMath,
      getLiveInputs: () => ({
        g7: 400000,
        g8: 360000,
        g9: 222000,
        g12: 180000,
        g13: 40000,
        g14: 24000,
        d29: 1.75,
      }),
      preferCpu: true,
    });
    const values = Array.from({ length: 70 }, (_, i) => 1 + i * 0.01);
    const out = await bus.invoke({ tool: 'run_batch', vary: 'd29', values });
    expect(out.capped).toBe(true);
    expect(out.count).toBe(WebGpuPrivateAgent.MAX_BATCH);
    expect(out.rows).toHaveLength(WebGpuPrivateAgent.MAX_BATCH);
    expect(out.rows[0].d29).toBe(values[0]);
    expect(typeof out.rows[0].g30).toBe('number');
  });

  test('tool bus explain_dag and explain_f32_drift use local data only', async () => {
    const bus = WebGpuPrivateAgent.createToolBus({
      calcMath,
      getLayout: () => ({
        maxDepth: 2,
        nodes: [
          { id: 'fs_g12', label: 'G12', depth: 0, isResult: false },
          { id: 'fs_g15', label: 'G15', depth: 1, isResult: true },
        ],
        edges: [{ from: 'fs_g12', to: 'fs_g15', calculation: 'sumRounded' }],
      }),
    });
    const dag = await bus.invoke({ tool: 'explain_dag' });
    expect(dag.nodeCount).toBe(2);
    expect(dag.edges[0].from).toBe('fs_g12');
    expect(dag.thesis).toMatch(/CPU calcMath/);

    const drift = await bus.invoke({ tool: 'explain_f32_drift' });
    expect(drift.integerCents).toBe(calcMath.FHA_F32_UFMIP_DIVERGENCE.integerCents);
    expect(drift.deltaCents).not.toBe(0);
    expect(drift.claim).toMatch(/integer cents/i);
  });

  test('createFHACalculatorConfig still available for DAG context builders', () => {
    const config = createFHACalculatorConfig({ prefix: 'fs' });
    expect(config.groups.length).toBeGreaterThan(0);
  });

  test('tool bus assertNoNetwork rejects assistant API URLs', () => {
    const bus = WebGpuPrivateAgent.createToolBus({ calcMath });
    expect(() => bus.assertNoNetwork('/api/encompass-assistant/chat')).toThrow(/must not call/i);
    expect(() => bus.assertNoNetwork('/api/jordan/assistant/chat')).toThrow(/must not call/i);
    expect(() => bus.assertNoNetwork(WebGpuPrivateAgent.WEBLLM_CDN)).not.toThrow();
  });

  test('preferCpu skips GPU kernel path', async () => {
    const gpuSpy = jest.fn(async () => ({
      source: 'gpu',
      cents: { g30: 1 },
    }));
    const bus = WebGpuPrivateAgent.createToolBus({
      calcMath,
      getLiveInputs: () => ({
        g7: 100000,
        g8: 90000,
        g9: 50000,
        g12: 10000,
        g13: 0,
        g14: 0,
        d29: 1.75,
      }),
      runIntegerKernel: gpuSpy,
      preferCpu: () => true,
    });
    const out = await bus.invoke({ tool: 'run_scenario', overlay: {} });
    expect(gpuSpy).not.toHaveBeenCalled();
    expect(out.source).toBe('cpu');
    expect(out.cents).toEqual(
      expect.objectContaining({
        g15: expect.any(Number),
        g30: expect.any(Number),
      })
    );
  });

  test('createChatController uses mocked WebLLM and local tools only', async () => {
    const replies = [
      '{"tool":"get_live_inputs"}',
      'Your live base amount is 400000 dollars. Inputs stayed on-device.',
    ];
    let step = 0;
    const create = jest.fn(async () => ({
      choices: [{ message: { content: replies[Math.min(step++, replies.length - 1)] } }],
    }));
    const fakeEngine = { chat: { completions: { create } } };
    const importWebLlm = jest.fn(async () => ({
      CreateMLCEngine: jest.fn(async () => fakeEngine),
    }));
    const busyFlags = [];
    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm,
      modelId: 'test-model',
      onGpuBusy: (f) => busyFlags.push(f),
      toolBus: WebGpuPrivateAgent.createToolBus({
        calcMath,
        getLiveInputs: () => ({
          g7: 400000,
          g8: 360000,
          g9: 222000,
          g12: 180000,
          g13: 40000,
          g14: 24000,
          d29: 1.75,
        }),
        preferCpu: true,
      }),
    });

    const { reply, toolTrace } = await controller.chat('Show live inputs');
    expect(importWebLlm).toHaveBeenCalled();
    expect(toolTrace).toHaveLength(1);
    expect(toolTrace[0].call.tool).toBe('get_live_inputs');
    expect(toolTrace[0].result.inputs.g7).toBe(400000);
    expect(reply).toMatch(/400000/);
    expect(busyFlags).toContain(true);
    expect(busyFlags[busyFlags.length - 1]).toBe(false);
    expect(create.mock.calls.every((c) => !JSON.stringify(c).includes('/api/'))).toBe(true);
  });

  test('ensureEngine clears GPU busy after standalone load (does not stick paused)', async () => {
    const busyEvents = [];
    const importWebLlm = jest.fn(async () => ({
      CreateMLCEngine: jest.fn(async () => ({
        chat: { completions: { create: jest.fn() } },
      })),
    }));
    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm,
      modelId: 'test-model',
      onGpuBusy: (flag, meta) => busyEvents.push({ flag, meta }),
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    await controller.ensureEngine();
    expect(controller.isBusy()).toBe(false);
    expect(busyEvents.some((e) => e.flag === true && e.meta && e.meta.loading)).toBe(true);
    expect(busyEvents[busyEvents.length - 1]).toEqual({
      flag: false,
      meta: { loading: false, inferencing: false },
    });
  });

  test('ensureEngine failure clears GPU busy so DAG can resume', async () => {
    const busyFlags = [];
    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm: jest.fn(async () => {
        throw new Error('CDN blocked');
      }),
      modelId: 'test-model',
      onGpuBusy: (f) => busyFlags.push(f),
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    await expect(controller.ensureEngine()).rejects.toThrow(/CDN blocked/);
    expect(controller.isBusy()).toBe(false);
    expect(busyFlags).toContain(true);
    expect(busyFlags[busyFlags.length - 1]).toBe(false);
  });

  test('chat answers immediately via on-device kernel tools when WebLLM is not loaded', async () => {
    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      toolBus: WebGpuPrivateAgent.createToolBus({
        calcMath,
        getLiveInputs: () => ({
          g7: 400000,
          g8: 360000,
          g9: 222000,
          g12: 180000,
          g13: 40000,
          g14: 24000,
          d29: 1.75,
        }),
        preferCpu: true,
      }),
    });

    const driftRes = await controller.chat('Why can f32 miss a cent on the fee?');
    expect(driftRes.toolTrace).toHaveLength(1);
    expect(driftRes.toolTrace[0].call.tool).toBe('explain_f32_drift');
    expect(driftRes.reply).toMatch(/525000 ¢/);

    const scenRes = await controller.chat('What if current balance g9 is 200000? Use run_scenario.');
    expect(scenRes.toolTrace).toHaveLength(1);
    expect(scenRes.toolTrace[0].call).toEqual({
      tool: 'run_scenario',
      overlay: { g9: 200000 },
    });
    expect(scenRes.reply).toMatch(/g30=/);

    const batchRes = await controller.chat(
      'Batch fee percent d29 over 1.5, 1.75, 2.0 and compare g30 cents.'
    );
    expect(batchRes.toolTrace).toHaveLength(1);
    expect(batchRes.toolTrace[0].call).toEqual({
      tool: 'run_batch',
      vary: 'd29',
      values: [1.5, 1.75, 2.0],
    });
    expect(batchRes.toolTrace[0].result.rows).toHaveLength(3);
  });

  test('ensureEngine stall watchdog aborts hung "Start to fetch params" load and clears busy', async () => {
    const busyFlags = [];
    const importWebLlm = jest.fn(async () => ({
      CreateMLCEngine: jest.fn(
        (_modelId, opts) =>
          new Promise(() => {
            if (opts && typeof opts.initProgressCallback === 'function') {
              opts.initProgressCallback({ text: 'Start to fetch params' });
            }
          })
      ),
    }));

    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm,
      stallTimeoutMs: 40,
      onGpuBusy: (f) => busyFlags.push(f),
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    await expect(controller.ensureEngine()).rejects.toThrow(/Start to fetch params/i);
    expect(controller.isBusy()).toBe(false);
    expect(busyFlags[busyFlags.length - 1]).toBe(false);
  });

  test('setLlmEnabled toggles between loaded WebLLM and instant local kernel without losing engine', async () => {
    const create = jest.fn(async () => ({
      choices: [{ message: { content: 'LLM answer: 525000 ¢' } }],
    }));
    const importWebLlm = jest.fn(async () => ({
      CreateMLCEngine: jest.fn(async () => ({
        chat: { completions: { create } },
      })),
    }));

    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm,
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    await controller.ensureEngine();
    expect(controller.isModelLoaded()).toBe(true);
    expect(controller.isLlmEnabled()).toBe(true);

    controller.setLlmEnabled(false);
    expect(controller.isLlmEnabled()).toBe(false);
    const kernelOut = await controller.chat('Why can f32 miss a cent on the fee?');
    expect(kernelOut.mode).toBe('local-kernel');
    expect(create).not.toHaveBeenCalled();

    controller.setLlmEnabled(true);
    expect(controller.isLlmEnabled()).toBe(true);
    const llmOut = await controller.chat('Explain that');
    expect(llmOut.reply).toMatch(/LLM answer/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('chat breaks out of duplicate tool calls from small models and falls back on inference timeout', async () => {
    const repeatCreate = jest.fn(async () => ({
      choices: [{ message: { content: '{"tool":"explain_f32_drift"}' } }],
    }));
    const repeatController = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm: async () => ({
        CreateMLCEngine: async () => ({
          chat: { completions: { create: repeatCreate } },
        }),
      }),
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    const repeatOut = await repeatController.chat('Why can f32 miss a cent on the fee?');
    expect(repeatCreate).toHaveBeenCalledTimes(2);
    expect(repeatOut.toolTrace).toHaveLength(1);
    expect(repeatOut.reply).toMatch(/525000 ¢/);

    const hungController = WebGpuPrivateAgent.createChatController({
      gpu: {},
      inferTimeoutMs: 30,
      importWebLlm: async () => ({
        CreateMLCEngine: async () => ({
          chat: { completions: { create: () => new Promise(() => {}) } },
        }),
      }),
      toolBus: WebGpuPrivateAgent.createToolBus({ calcMath, preferCpu: true }),
    });

    const fallbackOut = await hungController.chat('Why can f32 miss a cent on the fee?');
    expect(hungController.isBusy()).toBe(false);
    expect(fallbackOut.toolTrace).toHaveLength(1);
    expect(fallbackOut.reply).toMatch(/525000 ¢/);
  });
});
