/**
 * Development work by David Lane
 */
import { groundedReply, chatWithReed } from '../../services/studio-assistant.service.js';

describe('studio-assistant.service', () => {
  const original = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  test('groundedReply mentions listening password', () => {
    const reply = groundedReply('what is the listen password');
    expect(reply.toLowerCase()).toContain('reel1');
  });

  test('chatWithReed falls back when OpenAI is unset', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await chatWithReed({ message: 'how do I record' });
    expect(result.guideName).toBe('Reed');
    expect(result.source).toBe('grounded');
    expect(result.reply.toLowerCase()).toMatch(/arm|record|track/);
  });
});
