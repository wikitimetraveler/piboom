/**
 * Development work by David Lane
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/gse-knowledge.service.js', () => ({
  default: {
    getSummary: jest.fn(async () => ({
      totalRecords: 3,
      vectorCount: 0,
      vectorAvailable: false,
      counts: { pooling: 2, arm: 1 },
      table: 'gse_knowledge_chunks'
    })),
    getGraph: jest.fn(async () => ({
      nodes: [{ id: 'hub:gse', kind: 'hub', label: 'GSE knowledge' }],
      links: [],
      summary: { totalRecords: 3 }
    })),
    search: jest.fn(async () => [
      {
        title: 'Mortgage Pooling Mbs',
        category: 'pooling',
        content: 'UMBS and TBA',
        url: '',
        retrieval: 'keyword',
        score: 8
      }
    ])
  }
}));

jest.unstable_mockModule('../../services/finance-loan-expert.service.js', () => ({
  askLoanProgramExpert: jest.fn(() => ({
    success: true,
    recommendation: 'Rules recommendation',
    expertMode: 'general-guidance',
    rationale: ['r1'],
    requiredVerifications: ['v1'],
    overlayRisks: [],
    citations: []
  }))
}));

jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getUserConversationHistory: jest.fn(async () => []),
  clearUserConversationHistory: jest.fn(async () => true),
  persistConversationTurn: jest.fn(async () => undefined)
}));

jest.unstable_mockModule('../../services/openai-agent-model.js', () => ({
  resolveOpenAiAgentModel: jest.fn(() => 'gpt-4o-mini')
}));

const { getGseAssistantHealth, getGseKnowledgeSearch, postGseAssistantChat } = await import(
  '../../controllers/gse-assistant.controller.js'
);

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('gse-assistant.controller', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('health returns knowledge summary', async () => {
    const res = mockRes();
    await getGseAssistantHealth({}, res);
    expect(res.body.ok).toBe(true);
    expect(res.body.knowledge.totalRecords).toBe(3);
  });

  it('search returns hybrid hits', async () => {
    const res = mockRes();
    await getGseKnowledgeSearch({ query: { q: 'UMBS', limit: '4' } }, res);
    expect(res.body.results).toBe(1);
    expect(res.body.data[0].title).toContain('Pooling');
  });

  it('chat falls back to rules when OpenAI is missing but scenario is present', async () => {
    const res = mockRes();
    await postGseAssistantChat(
      {
        body: {
          message: 'Compare HomeReady',
          scenario: { creditScore: 720, state: 'CA', county: 'Orange', loanAmount: 400000 }
        },
        headers: {}
      },
      res
    );
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('rules-fallback');
    expect(res.body.recommendation).toContain('Rules');
    expect(res.body.sources.length).toBe(1);
  });
});
