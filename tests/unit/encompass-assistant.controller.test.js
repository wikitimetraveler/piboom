/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const chatMock = jest.fn();
const searchMock = jest.fn();
const summaryMock = jest.fn();
const graphMock = jest.fn();
const scrapeMock = jest.fn();
const sectionMock = jest.fn();

await jest.unstable_mockModule('../../services/encompass-assistant.service.js', () => ({
  default: {
    chatWithEncompassExpert: (...args) => chatMock(...args),
    searchEncompassKnowledge: (...args) => searchMock(...args),
    getEncompassExpertSummary: (...args) => summaryMock(...args),
    getEncompassKnowledgeGraph: (...args) => graphMock(...args),
    scrapeEncompassDocumentation: (...args) => scrapeMock(...args),
    getDocsSection: (...args) => sectionMock(...args)
  },
  chatWithEncompassExpert: (...args) => chatMock(...args),
  searchEncompassKnowledge: (...args) => searchMock(...args),
  getEncompassExpertSummary: (...args) => summaryMock(...args),
  getEncompassKnowledgeGraph: (...args) => graphMock(...args),
  scrapeEncompassDocumentation: (...args) => scrapeMock(...args),
  getDocsSection: (...args) => sectionMock(...args)
}));

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getUserConversationHistory: jest.fn().mockResolvedValue([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' }
  ]),
  clearUserConversationHistory: jest.fn().mockResolvedValue(true),
  persistConversationTurn: jest.fn().mockResolvedValue(true)
}));

await jest.unstable_mockModule('../../lib/encompass-docs-refresh-auth.js', () => ({
  requireEncompassDocsScrapeAccess: (_req, _res, next) => next()
}));

const router = (await import('../../controllers/encompass-assistant.controller.js')).default;
const memory = await import('../../services/langchain-memory.service.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const getRouteHandler = (routerInstance, method, path) => {
  const layers = routerInstance.stack.filter((stackLayer) => stackLayer.route?.path === path);
  for (const layer of layers) {
    const routeLayer = layer?.route?.stack.find((entry) => entry.method === method);
    if (routeLayer?.handle) return routeLayer.handle;
  }
  return undefined;
};

describe('encompass-assistant.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatMock.mockResolvedValue({
      message: 'mock-response',
      context: [{ title: 'Doc', retrieval: 'vector', score: 0.9 }],
      sources: [{ id: 'S1', title: 'Doc', retrieval: 'vector' }],
      retrieval: { hybrid: true, vectorHits: 1, keywordHits: 0 },
      mode: 'rag-chat',
      userId: 'encompass-anon',
      sessionId: 'encompass-dev-expert',
      model: 'gpt-4o-mini',
      openaiConfigured: true,
      timestamp: new Date().toISOString()
    });
    searchMock.mockResolvedValue([{ title: 'Hit', retrieval: 'keyword' }]);
    summaryMock.mockResolvedValue({
      openaiConfigured: true,
      encompassHubConfigured: false,
      docs: { totalSections: 28, vectorCount: 1 },
      ice: { totalRecords: 10, vectorCount: 2 },
      vectorStores: ['encompass_docs_chunks', 'ice_knowledge_chunks'],
      rag: { lanes: [] },
      repos: [],
      surfaces: [],
      quickPrompts: []
    });
    graphMock.mockResolvedValue({ nodes: [], links: [], summary: {} });
  });

  test('chat returns 400 when message is missing', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message is required' });
    expect(chatMock).not.toHaveBeenCalled();
  });

  test('chat returns AI response with context', async () => {
    const handler = getRouteHandler(router, 'post', '/chat');
    const req = { body: { message: 'Help me' }, query: {}, headers: {} };
    const res = createRes();

    await handler(req, res);

    expect(chatMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mock-response',
        context: expect.any(Array),
        retrieval: expect.objectContaining({ hybrid: true }),
        sources: expect.arrayContaining([
          expect.objectContaining({ id: 'S1', retrieval: expect.any(String) })
        ]),
        timestamp: expect.any(String)
      })
    );
  });

  test('search accepts source filter and returns data', async () => {
    const handler = getRouteHandler(router, 'get', '/search');
    const req = { query: { q: 'oauth', limit: '5', source: 'docs' } };
    const res = createRes();

    await handler(req, res);

    expect(searchMock).toHaveBeenCalledWith('oauth', { limit: 5, source: 'docs' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'oauth',
        results: 1,
        source: 'docs',
        data: expect.any(Array)
      })
    );
  });

  test('search returns 400 without q', async () => {
    const handler = getRouteHandler(router, 'get', '/search');
    const req = { query: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('health returns knowledge summary', async () => {
    const handler = getRouteHandler(router, 'get', '/health');
    const res = createRes();
    await handler({}, res);
    expect(summaryMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        openaiConfigured: true,
        knowledge: expect.any(Object)
      })
    );
  });

  test('graph returns graph payload', async () => {
    const handler = getRouteHandler(router, 'get', '/graph');
    const req = { query: { limit: '3' } };
    const res = createRes();
    await handler(req, res);
    expect(graphMock).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nodes: [], links: [] }));
  });

  test('history get and delete', async () => {
    const getHandler = getRouteHandler(router, 'get', '/history');
    const delHandler = getRouteHandler(router, 'delete', '/history');
    const req = { query: { userId: 'u1', sessionId: 's1' }, body: {}, headers: {} };
    const resGet = createRes();
    const resDel = createRes();

    await getHandler(req, resGet);
    await delHandler(req, resDel);

    expect(memory.getUserConversationHistory).toHaveBeenCalledWith('u1', 's1', 40);
    expect(memory.clearUserConversationHistory).toHaveBeenCalledWith('u1', 's1');
    expect(resDel.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, userId: 'u1', sessionId: 's1' })
    );
  });

  test('summary returns docs and ice', async () => {
    const handler = getRouteHandler(router, 'get', '/summary');
    const res = createRes();
    await handler({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        hybridRag: true,
        docs: expect.any(Object),
        ice: expect.any(Object)
      })
    );
  });
});
