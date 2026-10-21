/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACT_SHEET = path.join(
  __dirname,
  '../../data/knowledge/encompass-dev-expert.json'
);

let invokeMock;
let persistMock;
let historyMock;

await jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor() {
      invokeMock = jest.fn().mockResolvedValue({ content: 'service-mock-response' });
      this.invoke = invokeMock;
    }
  }
}));

await jest.unstable_mockModule('@langchain/core/messages', () => ({
  HumanMessage: class {
    constructor(content) {
      this.content = content;
      this._role = 'human';
    }
  },
  SystemMessage: class {
    constructor(content) {
      this.content = content;
      this._role = 'system';
    }
  },
  AIMessage: class {
    constructor(content) {
      this.content = content;
      this._role = 'ai';
    }
  }
}));

await jest.unstable_mockModule('../../services/encompass-docs.service.js', () => ({
  default: {
    searchDocs: jest.fn().mockResolvedValue([
      {
        title: 'Authorization',
        content: 'OAuth 2.0 Bearer tokens',
        url: 'https://example.com/auth',
        category: 'authentication',
        retrieval: 'vector',
        score: 0.9
      }
    ]),
    getDocsSummary: jest.fn().mockResolvedValue({
      totalSections: 28,
      vectorAvailable: true,
      vectorCount: 12,
      categories: { authentication: 3 }
    }),
    loadDocs: jest.fn().mockResolvedValue({
      lastUpdated: '2026-01-01',
      sections: [
        {
          title: 'Authorization',
          category: 'authentication',
          content: 'OAuth content',
          url: 'https://example.com/auth'
        },
        {
          title: 'Loan Pipeline',
          category: 'use-cases',
          content: 'Pipeline cursor',
          url: 'https://example.com/pipeline'
        }
      ]
    }),
    scrapeDocumentation: jest.fn().mockResolvedValue({
      sections: [{ title: 'Welcome' }],
      lastUpdated: '2026-01-01'
    })
  }
}));

await jest.unstable_mockModule('../../lib/knowledge/ice-knowledge.service.js', () => ({
  default: {
    search: jest.fn().mockResolvedValue([
      {
        title: 'Postman › Token',
        content: 'POST token',
        category: 'Postman Collection',
        sourceType: 'api_reference',
        repo: 'Encompass Developer Connect',
        retrieval: 'keyword',
        score: 8
      },
      {
        title: 'imt-exp20-token-exchange/oauth.js',
        content: 'token exchange sample',
        sourceType: 'code_reference',
        repo: 'imt-exp20-token-exchange',
        retrieval: 'keyword',
        score: 6
      }
    ]),
    getSummary: jest.fn().mockResolvedValue({
      totalRecords: 4072,
      vectorAvailable: true,
      vectorCount: 100,
      counts: { code_reference: 2500, api_reference: 1500 }
    }),
    loadKnowledge: jest.fn().mockResolvedValue({
      lastIndexed: '2026-01-01',
      records: [
        {
          title: 'oauth.js',
          sourceType: 'code_reference',
          repo: 'imt-exp20-token-exchange',
          excerpt: 'token',
          url: 'https://github.com/example'
        }
      ]
    })
  }
}));

persistMock = jest.fn().mockResolvedValue(true);
historyMock = jest.fn().mockResolvedValue([
  { role: 'user', content: 'prior question' },
  { role: 'assistant', content: 'prior answer' }
]);

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getUserConversationHistory: (...args) => historyMock(...args),
  clearUserConversationHistory: jest.fn().mockResolvedValue(true),
  persistConversationTurn: (...args) => persistMock(...args)
}));

await jest.unstable_mockModule('../../services/openai-agent-model.js', () => ({
  resolveOpenAiAgentModel: jest.fn().mockReturnValue('gpt-4o-mini'),
  OPENAI_AGENT_MODEL_DEFAULT: 'gpt-4o'
}));

const service = await import('../../services/encompass-assistant.service.js');
const docsService = (await import('../../services/encompass-docs.service.js')).default;
const iceService = (await import('../../lib/knowledge/ice-knowledge.service.js')).default;

describe('encompass-assistant.service', () => {
  const prevKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = prevKey;
    jest.clearAllMocks();
  });

  test('fact sheet file exists and includes ICE repos + quick prompts', async () => {
    const raw = await readFile(FACT_SHEET, 'utf8');
    const json = JSON.parse(raw);
    expect(json.iceRepos.length).toBe(8);
    expect(json.quickPrompts.length).toBeGreaterThanOrEqual(5);
    expect(json.devconnectSurfaces.some((s) => s.path.includes('encompass-assistant'))).toBe(
      true
    );
  });

  test('searchEncompassKnowledge merges docs, ICE, and curated hits', async () => {
    const hits = await service.searchEncompassKnowledge('OAuth authentication token', {
      limit: 10,
      source: 'all'
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(docsService.searchDocs).toHaveBeenCalled();
    expect(iceService.search).toHaveBeenCalled();
    expect(hits.some((h) => h.title === 'Authorization' || h.retrieval === 'curated')).toBe(true);
  });

  test('searchEncompassKnowledge respects source=postman filter', async () => {
    const hits = await service.searchEncompassKnowledge('token', {
      limit: 10,
      source: 'postman'
    });
    expect(docsService.searchDocs).not.toHaveBeenCalled();
    expect(iceService.search).toHaveBeenCalled();
    expect(hits.every((h) => /postman|api_reference/i.test(`${h.category} ${h.sourceType}`))).toBe(
      true
    );
  });

  test('getEncompassKnowledgeGraph returns hub nodes and links', async () => {
    const graph = await service.getEncompassKnowledgeGraph(2);
    expect(graph.nodes.some((n) => n.kind === 'hub')).toBe(true);
    expect(graph.nodes.some((n) => n.kind === 'category')).toBe(true);
    expect(graph.links.length).toBeGreaterThan(0);
    expect(graph.summary.totalRecords).toBeGreaterThan(0);
  });

  test('getEncompassExpertSummary exposes rag lanes and repos', async () => {
    const summary = await service.getEncompassExpertSummary();
    expect(summary.hybridRag).toBe(true);
    expect(summary.rag.lanes.length).toBeGreaterThanOrEqual(2);
    expect(summary.repos.length).toBe(8);
    expect(summary.quickPrompts.length).toBeGreaterThan(0);
  });

  test('chatWithEncompassExpert uses memory and returns sources', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const result = await service.chatWithEncompassExpert({
      message: 'How do I authenticate?',
      userId: 'u1',
      sessionId: 'encompass-dev-expert'
    });
    expect(result.message).toBe('service-mock-response');
    expect(result.mode).toBe('rag-chat');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.retrieval.hybrid).toBe(true);
    expect(invokeMock).toHaveBeenCalled();
    expect(persistMock).toHaveBeenCalled();
    expect(historyMock).toHaveBeenCalledWith('u1', 'encompass-dev-expert', 16);
  });

  test('chatWithEncompassExpert returns retrieval-fallback without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await service.chatWithEncompassExpert({
      message: 'OAuth help',
      userId: 'anon',
      sessionId: 's1'
    });
    expect(result.mode).toBe('retrieval-fallback');
    expect(result.openaiConfigured).toBe(false);
    expect(result.message).toMatch(/OPENAI_API_KEY is not configured/);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('chatWithEncompassExpert rejects empty message', async () => {
    await expect(service.chatWithEncompassExpert({ message: '  ' })).rejects.toMatchObject({
      status: 400
    });
  });
});
