/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

process.env.OPENAI_API_KEY = 'test-key';

await jest.unstable_mockModule('openai', () => ({
  default: class {
    constructor() {
      this.chat = { completions: { create: jest.fn() } };
    }
  }
}));

await jest.unstable_mockModule('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getConversationChain: jest.fn().mockResolvedValue({
    chain: { call: jest.fn().mockResolvedValue({ response: 'langchain-reply' }) }
  }),
  getUserConversationHistory: jest.fn().mockResolvedValue([]),
  clearUserConversationHistory: jest.fn().mockResolvedValue(true),
  getUserConversationStats: jest.fn().mockResolvedValue({ message_count: 2 })
}));

const { chatWithLangChain } = await import('../../controllers/chat.controller.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('chat.controller', () => {
  test('chatWithLangChain returns 400 when message is missing', async () => {
    const req = { body: { userId: 'user-1' } };
    const res = createRes();

    await chatWithLangChain(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message is required' });
  });

  test('chatWithLangChain returns response when valid', async () => {
    const req = { body: { message: 'Hello', userId: 'user-1' } };
    const res = createRes();

    await chatWithLangChain(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        response: 'langchain-reply',
        userId: 'user-1',
        memoryType: 'langchain-postgresql'
      })
    );
  });
});
