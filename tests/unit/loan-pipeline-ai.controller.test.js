import { jest } from '@jest/globals';

const chainCallMock = jest.fn().mockResolvedValue({ response: 'pipeline-response' });

await jest.unstable_mockModule('../../services/langchain-memory.service.js', () => ({
  getConversationChain: jest.fn().mockResolvedValue({
    chain: { call: chainCallMock }
  })
}));

await jest.unstable_mockModule('../../services/loan-pipeline.service.js', () => ({
  getAllLoans: jest.fn().mockResolvedValue([]),
  getPipelineStats: jest.fn().mockResolvedValue({})
}));

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: jest.fn()
}));

const {
  chatWithAI,
  chatWithDisasterExpert
} = await import('../../controllers/loan-pipeline-ai.controller.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('loan-pipeline-ai.controller', () => {
  test('chatWithAI returns 400 when message is missing', async () => {
    const req = { body: { userId: 'user-1' } };
    const res = createRes();

    await chatWithAI(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Message is required'
    });
  });

  test('chatWithAI returns response when valid', async () => {
    const req = { body: { message: 'Hello', userId: 'user-1' } };
    const res = createRes();

    await chatWithAI(req, res);

    expect(chainCallMock).toHaveBeenCalledWith({ input: 'Hello' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        response: 'pipeline-response'
      })
    );
  });

  test('chatWithDisasterExpert returns response when valid', async () => {
    const req = { body: { message: 'Risk?', userId: 'user-1' } };
    const res = createRes();

    await chatWithDisasterExpert(req, res);

    expect(chainCallMock).toHaveBeenCalledWith({ input: 'Risk?' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        response: 'pipeline-response'
      })
    );
  });
});
