/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

let invokeMock;

await jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      invokeMock = jest.fn().mockResolvedValue({ content: 'HeyGen mock answer [S1]' });
      this.invoke = invokeMock;
    }
  }
}));

await jest.unstable_mockModule('@langchain/core/messages', () => ({
  HumanMessage: class {
    constructor(content) {
      this.content = content;
    }
  },
  SystemMessage: class {
    constructor(content) {
      this.content = content;
    }
  },
  AIMessage: class {
    constructor(content) {
      this.content = content;
    }
  }
}));

await jest.unstable_mockModule('../../services/heygen-knowledge.service.js', () => ({
  default: {
    search: jest.fn().mockResolvedValue([
      {
        title: 'Video Agent',
        content: 'POST /v3/video-agents',
        category: 'video-agent',
        url: 'https://developers.heygen.com/docs/video-agent',
        retrieval: 'keyword',
        score: 10
      }
    ]),
    getSummary: jest.fn().mockResolvedValue({ totalRecords: 2, vectorCount: 0 })
  }
}));

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getUserConversationHistory: jest.fn().mockResolvedValue([]),
  clearUserConversationHistory: jest.fn().mockResolvedValue(true),
  persistConversationTurn: jest.fn().mockResolvedValue(true)
}));

await jest.unstable_mockModule('../../services/openai-agent-model.js', () => ({
  resolveOpenAiAgentModel: jest.fn(() => 'gpt-4o-mini')
}));

await jest.unstable_mockModule('../../services/heygen.service.js', () => ({
  heygenConfigured: jest.fn(() => true)
}));

const router = (await import('../../controllers/heygen-assistant.controller.js')).default;

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const getRouteHandler = (routerInstance, method, path) => {
  const layer = routerInstance.stack.find((stackLayer) => stackLayer.route?.path === path);
  const routeLayer = layer?.route?.stack.find((entry) => entry.method === method);
  return routeLayer?.handle;
};

describe('heygen-assistant.controller', () => {
  const prevKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  test('chat returns 400 when message is missing', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: {}, headers: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message is required' });
  });

  test('chat returns AI response with sources and persists turn', async () => {
    const memory = await import('../../services/langchain-memory.service.js');
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = {
      body: { message: 'What is Video Agent?', userId: 'u1', sessionId: 'heygen-api-expert' },
      headers: {}
    };
    const res = createRes();

    await handler(req, res);

    expect(invokeMock).toHaveBeenCalled();
    expect(memory.persistConversationTurn).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'HeyGen mock answer [S1]',
        sources: expect.arrayContaining([
          expect.objectContaining({ id: 'S1', title: 'Video Agent' })
        ])
      })
    );
  });
});
