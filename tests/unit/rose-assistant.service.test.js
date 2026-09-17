/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildSystemPrompt,
  GUIDE_NAME,
  AVATAR_NAME,
  chatWithRose,
  getRoseSummary,
} from '../../services/rose-assistant.service.js';

describe('rose-assistant.service', () => {
  test('guide names', () => {
    expect(GUIDE_NAME).toBe('Rose');
    expect(AVATAR_NAME).toBe('Rose');
  });

  test('buildSystemPrompt stays parlor astrology, not astronomy', () => {
    const prompt = buildSystemPrompt({
      sign: 'Cancer',
      spread: {
        sun: 'Cancer',
        situation: 'The Star',
        cross: 'The Tower',
        path: 'Ace of Cups',
      },
      birthDate: '1990-07-04',
      birthYear: 1990,
    });
    expect(prompt).toContain('Rose');
    expect(prompt).toContain('Cancer');
    expect(prompt).toMatch(/not astronomy|not a natal|Planetarium/i);
    expect(prompt).toContain('The Star');
    expect(prompt).toContain('The Tower');
    expect(prompt).toContain('Ace of Cups');
    expect(prompt).toContain('1990-07-04');
    expect(prompt).not.toMatch(/You are Carl/);
  });

  test('buildSystemPrompt answers only in Vietnamese when lang=vi', () => {
    const prompt = buildSystemPrompt({ lang: 'vi', sign: 'Leo' });
    expect(prompt).toMatch(/Answer only in Vietnamese|Tiếng Việt/i);
    expect(prompt).toContain('Leo');
  });

  test('summary lists twelve signs and full tarot', () => {
    const summary = getRoseSummary();
    expect(summary.guide).toBe('Rose');
    expect(summary.signCount).toBe(12);
    expect(summary.arcanaCount).toBe(22);
    expect(summary.tarotCount).toBe(78);
    expect(summary.elements).toEqual(['fire', 'earth', 'air', 'water']);
    expect(summary.languages).toEqual(['en', 'vi']);
  });

  test('buildSystemPrompt grounds Major Arcana', () => {
    const prompt = buildSystemPrompt({ arcana: 'The Tower' });
    expect(prompt).toMatch(/tarot expert|seventy-eight/i);
    expect(prompt).toContain('The Fool');
    expect(prompt).toContain('The World');
    expect(prompt).toContain('The Tower');
  });

  test('grounded chat reads a Major Arcana card without OpenAI', async () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await chatWithRose({ message: 'Read The Star for me' });
      expect(result.source).toBe('page-facts');
      expect(result.reply).toMatch(/Star|hope|Rose/i);
    } finally {
      if (prior != null) process.env.OPENAI_API_KEY = prior;
    }
  });

  test('grounded Vietnamese reply when lang=vi', async () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await chatWithRose({ message: '', lang: 'vi' });
      expect(result.lang).toBe('vi');
      expect(result.reply).toMatch(/Rose|ngày sinh|tarot/i);
    } finally {
      if (prior != null) process.env.OPENAI_API_KEY = prior;
    }
  });

  test('grounded chat names a sign without OpenAI', async () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await chatWithRose({ message: 'Read Cancer for me' });
      expect(result.guideName).toBe('Rose');
      expect(result.source).toBe('page-facts');
      expect(result.reply).toMatch(/Rose|crab|tide|Gift/i);
    } finally {
      if (prior != null) process.env.OPENAI_API_KEY = prior;
    }
  });

  test('grounded chat points astronomy questions at Carl', async () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await chatWithRose({ message: 'What is on the ISS tonight in astronomy?' });
      expect(result.reply).toMatch(/Carl|Planetarium/i);
    } finally {
      if (prior != null) process.env.OPENAI_API_KEY = prior;
    }
  });

  test('routes and identity files are wired', () => {
    const routes = readFileSync(join(process.cwd(), 'routes/index.routes.js'), 'utf8');
    expect(routes).toContain("api.use('/astrology'");
    const avatar = readFileSync(join(process.cwd(), 'AVATAR-ROSE.md'), 'utf8');
    expect(avatar).toContain('# Avatar: Rose');
    const demo = readFileSync(join(process.cwd(), 'data/rose-heygen-demo.json'), 'utf8');
    expect(demo).toContain('astrology-rose-intro');
  });
});
