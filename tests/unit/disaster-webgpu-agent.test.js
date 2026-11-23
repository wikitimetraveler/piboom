/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import '../../public/shared/js/webgpu-private-agent.js';
import '../../public/finance/js/disaster-webgpu-agent.js';

const { DisasterWebGpuAgent, WebGpuPrivateAgent } = globalThis;

describe('DisasterWebGpuAgent', () => {
  const sampleDisaster = {
    title: 'County Flood Warning',
    event_type: 'Flood',
    state_abbr: 'TX',
    county_name: 'Harris',
    source: 'NWS',
  };

  const sampleLoans = [
    { loan_number: 'L1', disaster_risk_score: 11, flood_zone: 'A', distance_km: 3 },
    { loan_number: 'L2', disaster_risk_score: 5, flood_zone: 'X', distance_km: 12 },
    { loan_number: 'L3', disaster_risk_score: 2, flood_zone: 'X', distance_km: 40 },
  ];

  const sampleCameras = [
    { name: 'Hilltop Cam', source: 'AlertWildfire', distance_km: 8 },
  ];

  function makeDeps(overrides = {}) {
    return {
      getSelectedDisaster: () => sampleDisaster,
      getFilters: () => ({ state: 'TX', county: 'Harris', sources: [], events: [] }),
      getNearbyLoans: () => sampleLoans,
      getNearbyCameras: () => sampleCameras,
      ...overrides,
    };
  }

  test('exports tools, modes, and privacy helpers', () => {
    expect(typeof DisasterWebGpuAgent.mount).toBe('function');
    expect(typeof DisasterWebGpuAgent.createToolBus).toBe('function');
    expect(DisasterWebGpuAgent.API_ENDPOINT).toBe(
      '/api/loan-pipeline/ai/chat-disaster-expert'
    );
    expect(DisasterWebGpuAgent.TOOL_NAMES).toEqual(
      expect.arrayContaining([
        'get_selected_event',
        'get_nearby_loans',
        'get_nearby_cameras',
        'get_triage_note',
      ])
    );
    expect(DisasterWebGpuAgent.SYSTEM_PROMPT).toMatch(/ops triage/i);
    expect(DisasterWebGpuAgent.privacyBadgeForMode('instant').text).toMatch(
      /stays in this browser/i
    );
    expect(DisasterWebGpuAgent.privacyBadgeForMode('openai-processor').text).toMatch(
      /sends this snapshot to our server/i
    );
  });

  test('instant local reply uses page snapshot and does not call assistant URL', async () => {
    const fetchFn = jest.fn();
    const bus = DisasterWebGpuAgent.createToolBus(makeDeps());
    const controller = WebGpuPrivateAgent.createChatController({
      toolBus: bus,
      systemPrompt: DisasterWebGpuAgent.SYSTEM_PROMPT,
      parseToolCall: DisasterWebGpuAgent.parseToolCall,
      formatLocalToolReply: DisasterWebGpuAgent.formatLocalToolReply,
      runLocalToolTurn: DisasterWebGpuAgent.runLocalToolTurn,
    });
    controller.setLlmEnabled(false);

    const out = await controller.chat('Triage nearby loans for the selected hazard.');
    expect(out.mode).toBe('local-snapshot');
    expect(out.toolTrace[0].call.tool).toBe('get_nearby_loans');
    expect(out.toolTrace[0].result.count).toBe(3);
    expect(out.reply).toMatch(/3 nearby mocked loan/i);
    expect(out.reply).toMatch(/ops triage/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('OpenAI mode is the only path that posts to chat-disaster-expert', async () => {
    const fetchFn = jest.fn(async () => ({
      json: async () => ({ success: true, response: 'Processor suggests flood insurance check.' }),
    }));
    const getProcessorContext = jest.fn(async () => ({
      expertProfile: 'processor',
      selectedDisaster: sampleDisaster,
    }));
    const getPortfolioContext = jest.fn(async () => ({
      expertProfile: 'portfolio',
      selectedDisaster: sampleDisaster,
    }));

    const processorOut = await DisasterWebGpuAgent.postOpenAiChat({
      message: 'What should I verify?',
      mode: DisasterWebGpuAgent.MODES.OPENAI_PROCESSOR,
      fetchFn,
      getProcessorContext,
      getPortfolioContext,
      userId: 'tester',
    });
    expect(processorOut.reply).toMatch(/flood insurance/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(
      '/api/loan-pipeline/ai/chat-disaster-expert'
    );
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.context.expertProfile).toBe('processor');
    expect(getProcessorContext).toHaveBeenCalled();
    expect(getPortfolioContext).not.toHaveBeenCalled();

    fetchFn.mockClear();
    getProcessorContext.mockClear();

    await DisasterWebGpuAgent.postOpenAiChat({
      message: 'Where are we concentrated?',
      mode: DisasterWebGpuAgent.MODES.OPENAI_PORTFOLIO,
      fetchFn,
      getProcessorContext,
      getPortfolioContext,
      userId: 'tester',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).context.expertProfile).toBe(
      'portfolio'
    );
    expect(getPortfolioContext).toHaveBeenCalled();
  });

  test('WebLLM-off still answers locally via createChatController hooks', async () => {
    const create = jest.fn();
    const importWebLlm = jest.fn(async () => ({
      CreateMLCEngine: jest.fn(async () => ({
        chat: { completions: { create } },
      })),
    }));
    const bus = DisasterWebGpuAgent.createToolBus(makeDeps());
    const controller = WebGpuPrivateAgent.createChatController({
      gpu: {},
      importWebLlm,
      toolBus: bus,
      systemPrompt: DisasterWebGpuAgent.SYSTEM_PROMPT,
      parseToolCall: DisasterWebGpuAgent.parseToolCall,
      formatLocalToolReply: DisasterWebGpuAgent.formatLocalToolReply,
      runLocalToolTurn: DisasterWebGpuAgent.runLocalToolTurn,
    });

    await controller.ensureEngine();
    controller.setLlmEnabled(false);

    const out = await controller.chat('Which nearby cameras should I check?');
    expect(out.mode).toBe('local-snapshot');
    expect(out.toolTrace[0].call.tool).toBe('get_nearby_cameras');
    expect(out.reply).toMatch(/Hilltop Cam/);
    expect(create).not.toHaveBeenCalled();
  });

  test('mount returns null without panelRoot and binds when panelRoot is provided', () => {
    expect(DisasterWebGpuAgent.mount({})).toBeNull();
    expect(DisasterWebGpuAgent.mount({ panelRoot: null })).toBeNull();

    const kids = [];
    const panelRoot = {
      innerHTML: '',
      querySelector(sel) {
        return kids.find((el) => el.id && sel === '#' + el.id) || null;
      },
      querySelectorAll(sel) {
        if (sel === '#duHazardSuggest [data-prompt]') {
          return kids.filter((el) => el.getAttribute && el.getAttribute('data-prompt'));
        }
        return [];
      },
    };
    // Minimal DOM stub: assign ids after innerHTML set via property trap
    Object.defineProperty(panelRoot, 'innerHTML', {
      set(html) {
        this._html = html;
        kids.length = 0;
        const idRe = /id="([^"]+)"/g;
        let m;
        while ((m = idRe.exec(html))) {
          const id = m[1];
          const el = {
            id,
            textContent: '',
            className: '',
            hidden: false,
            disabled: false,
            value: id === 'duHazardModelMode' ? 'instant' : '',
            setAttribute() {},
            getAttribute(name) {
              return name === 'data-prompt' ? null : null;
            },
            addEventListener() {},
            classList: { toggle() {}, remove() {}, add() {} },
            appendChild() {},
            scrollTop: 0,
            scrollHeight: 0,
            hasAttribute() {
              return true;
            },
            removeAttribute() {},
          };
          kids.push(el);
        }
      },
      get() {
        return this._html || '';
      },
    });

    const mounted = DisasterWebGpuAgent.mount({
      panelRoot,
      getSelectedDisaster: () => sampleDisaster,
      getFilters: () => ({}),
      getNearbyLoans: () => sampleLoans,
      getNearbyCameras: () => sampleCameras,
    });
    expect(mounted).not.toBeNull();
    expect(mounted.getMode()).toBe('instant');
    expect(typeof mounted.send).toBe('function');
    mounted.dispose();
  });

  test('createChatController accepts disaster systemPrompt override without calc tutor default', async () => {
    const fetchFn = jest.fn();
    const bus = DisasterWebGpuAgent.createToolBus(makeDeps());
    const controller = WebGpuPrivateAgent.createChatController({
      toolBus: bus,
      systemPrompt: DisasterWebGpuAgent.SYSTEM_PROMPT,
      parseToolCall: DisasterWebGpuAgent.parseToolCall,
      formatLocalToolReply: DisasterWebGpuAgent.formatLocalToolReply,
      runLocalToolTurn: DisasterWebGpuAgent.runLocalToolTurn,
    });

    expect(controller.messages[0].role).toBe('system');
    expect(controller.messages[0].content).toBe(DisasterWebGpuAgent.SYSTEM_PROMPT);
    expect(controller.messages[0].content).not.toMatch(/Private GPU calc tutor/i);

    const out = await controller.chat('Summarize the selected hazard.');
    expect(out.toolTrace[0].call.tool).toBe('get_selected_event');
    expect(out.reply).toMatch(/County Flood Warning/);
    expect(out.reply).toMatch(/ops triage/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('inferLocalToolCall routes camera and triage phrasing', () => {
    expect(DisasterWebGpuAgent.inferLocalToolCall('cameras to check').tool).toBe(
      'get_nearby_cameras'
    );
    expect(
      DisasterWebGpuAgent.inferLocalToolCall('Is disaster_risk_score a probability?').tool
    ).toBe('get_triage_note');
    expect(DisasterWebGpuAgent.summarizeTriageBands(sampleLoans)).toEqual({
      critical: 1,
      high: 0,
      moderate: 1,
      low: 1,
      unscored: 0,
    });
  });
});
