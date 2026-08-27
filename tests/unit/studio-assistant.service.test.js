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
    expect(reply.toLowerCase()).toMatch(/sleeve|lounge/);
  });

  test('groundedReply describes the acoustic guitar lanes', () => {
    const reply = groundedReply('how do I track acoustic guitar');
    expect(reply.toLowerCase()).toMatch(/neck/);
    expect(reply.toLowerCase()).toMatch(/body/);
    expect(reply.toLowerCase()).toMatch(/pcm|wood/);
  });

  test('chatWithReed falls back when OpenAI is unset', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await chatWithReed({ message: 'how do I record' });
    expect(result.guideName).toBe('Reed');
    expect(result.source).toBe('grounded');
    expect(result.reply.toLowerCase()).toMatch(/arm|record|track/);
  });

  test('groundedReply explains mic preamp for quiet mics', () => {
    const reply = groundedReply('the mic is too quiet');
    expect(reply.toLowerCase()).toMatch(/preamp/);
    expect(reply.toLowerCase()).toMatch(/\+10 dB|\+10 db|10 dB/i);
  });
});
