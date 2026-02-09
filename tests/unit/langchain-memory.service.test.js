import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({
    query: queryMock
  })
}));

await jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(options) {
      this.options = options;
    }
  }
}));

await jest.unstable_mockModule('langchain/memory', () => ({
  BufferMemory: class {
    constructor(options) {
      this.options = options;
    }
  }
}));

await jest.unstable_mockModule('langchain/chains', () => ({
  ConversationChain: class {
    constructor({ llm, memory }) {
      this.llm = llm;
      this.memory = memory;
    }
  }
}));

await jest.unstable_mockModule('langchain/stores/message/in_memory', () => ({
  ChatMessageHistory: class {
    constructor() {
      this.messages = [];
    }
    async addMessage(message) {
      this.messages.push(message);
    }
    async clear() {
      this.messages = [];
    }
  }
}));

await jest.unstable_mockModule('@langchain/core/messages', () => ({
  HumanMessage: class {
    constructor(content) {
      this.content = content;
    }
  },
  AIMessage: class {
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

const {
  getConversationChain,
  getUserConversationHistory,
  clearUserConversationHistory
} = await import('../../services/langchain-memory.service.js');

describe('langchain-memory.service', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('getConversationChain returns chain with memory', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const result = await getConversationChain('user-1', 'prompt');

    expect(result.chain).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(result.chatHistory).toBeDefined();
  });

  test('getUserConversationHistory returns chronological rows', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { role: 'assistant', content: 'later', created_at: '2024-01-02' },
        { role: 'user', content: 'earlier', created_at: '2024-01-01' }
      ]
    });

    const history = await getUserConversationHistory('user-1', 'default', 2);

    expect(history[0].content).toBe('earlier');
    expect(history[1].content).toBe('later');
  });

  test('clearUserConversationHistory returns true on success', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const cleared = await clearUserConversationHistory('user-1', 'default');

    expect(cleared).toBe(true);
  });
});
