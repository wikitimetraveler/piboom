/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

let invokeMock;

await jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      invokeMock = jest.fn().mockResolvedValue({ content: 'unit-test-response' });
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
  }
}));

await jest.unstable_mockModule('../../services/encompass-docs.service.js', () => ({
  default: {
    searchDocs: jest.fn().mockResolvedValue([
      { title: 'Doc', content: 'Content', repo: 'developer-connect' }
    ])
  }
}));

await jest.unstable_mockModule('../../lib/knowledge/ice-knowledge.service.js', () => ({
  default: {
    search: jest.fn().mockResolvedValue([{ title: 'KB', content: 'KB content', repo: 'ice' }])
  }
}));

const router = (await import('../../controllers/unit-tests-ai.controller.js')).default;

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

describe('unit-tests-ai.controller', () => {
  test('chat returns 400 when message is missing', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message is required' });
  });

  test('chat returns AI response with context', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: { message: 'How to test?' } };
    const res = createRes();

    await handler(req, res);

    expect(invokeMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        structuredAnalysis: expect.any(Array),
        message: 'unit-test-response',
        context: expect.any(Array),
        timestamp: expect.any(String)
      })
    );
  });
});
