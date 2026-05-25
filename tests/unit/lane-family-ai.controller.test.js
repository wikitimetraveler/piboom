/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { jest } from '@jest/globals';

let invokeMock;

await jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      invokeMock = jest.fn().mockResolvedValue({ content: 'lane-guide-reply' });
      this.invoke = invokeMock;
    }
  }
}));

await jest.unstable_mockModule('@langchain/core/messages', () => ({
  HumanMessage: class {
    constructor(c) {
      this.content = c;
    }
  },
  SystemMessage: class {
    constructor(c) {
      this.content = c;
    }
  },
  AIMessage: class {
    constructor(c) {
      this.content = c;
    }
  }
}));

const router = (await import('../../controllers/lane-family-ai.controller.js')).default;

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

describe('lane-family-ai.controller', () => {
  const prevKey = process.env.OPENAI_API_KEY;

  afterAll(() => {
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  test('returns 400 when message is missing', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Message is required' });
  });

  test('returns 503 when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: { message: 'Hello' } };
    const res = createRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('OPENAI') })
    );
  });

  test('returns AI message when configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: { message: 'What is the memorial wall?' } };
    const res = createRes();
    await handler(req, res);
    expect(invokeMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'lane-guide-reply',
        timestamp: expect.any(String)
      })
    );
  });
});
