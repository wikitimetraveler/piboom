/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../services/conditions-assistant.service.js', () => ({
  default: {
    getConditionsExpertSummary: jest.fn().mockResolvedValue({
      title: 'Enhanced Conditions Expert',
      conceptCount: 6,
      apiCount: 12,
      faqCount: 5,
      handoff: { available: false },
    }),
    searchConditionsKnowledge: jest.fn().mockResolvedValue([
      { title: 'Types vs templates', content: 'Types first', category: 'concept', score: 2 },
    ]),
    chatWithConditionsExpert: jest.fn().mockResolvedValue({
      reply: 'Create types before templates. [S1]',
      citations: [{ id: 'S1', title: 'Types vs templates', url: null }],
      handoffAvailable: false,
    }),
  },
}));

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getUserConversationHistory: jest.fn().mockResolvedValue([]),
  clearUserConversationHistory: jest.fn().mockResolvedValue(true),
}));

const router = (await import('../../controllers/conditions-assistant.controller.js')).default;

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

describe('conditions-assistant.controller', () => {
  it('returns health with expert summary', async () => {
    const handler = getRouteHandler(router, 'get', '/health');
    const res = createRes();
    await handler({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        expert: expect.objectContaining({ title: 'Enhanced Conditions Expert' }),
      }),
    );
  });

  it('requires a chat message', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const res = createRes();
    await handler({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns chat reply and citations', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const res = createRes();
    await handler({ body: { message: 'Types or templates first?' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        reply: expect.stringContaining('types'),
        citations: expect.any(Array),
      }),
    );
  });
});
