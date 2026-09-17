/**
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import '../../public/entertainment/js/astrology-arcana.js';
import { buildSystemPrompt, getRoseSummary, chatWithRose } from '../../services/rose-assistant.service.js';
import { getRoseDemoShort, pickRoseVoice } from '../../services/rose-heygen.service.js';
import { buildSystemPrompt as buildCarlPrompt } from '../../services/planetarium-assistant.service.js';

const { AstrologyArcana } = globalThis;

describe('AstrologyArcana tarot deck', () => {
  test('lists twenty-two Major Arcana and a full seventy-eight-card deck', () => {
    expect(AstrologyArcana.ARCANA).toHaveLength(22);
    expect(AstrologyArcana.MINORS).toHaveLength(56);
    expect(AstrologyArcana.DECK).toHaveLength(78);
    expect(AstrologyArcana.ARCANA[0].id).toBe('the-fool');
    expect(AstrologyArcana.ARCANA[21].id).toBe('the-world');
    AstrologyArcana.DECK.forEach((card) => {
      expect(card.name).toBeTruthy();
      expect(card.oracle).toMatch(/Rose/);
      expect(card.askRose).toMatch(/Read/);
      expect(card.image).toMatch(/\/entertainment\/assets\/tarot\//);
      expect(card.commonsFile).toBeTruthy();
    });
  });

  test('cardById resolves majors and minors', () => {
    expect(AstrologyArcana.cardById('the-tower').name).toBe('The Tower');
    expect(AstrologyArcana.cardById('ace-of-cups').name).toBe('Ace of Cups');
    expect(AstrologyArcana.cardById('missing')).toBeNull();
  });

  test('cardsBySuit filters the parlor deck', () => {
    expect(AstrologyArcana.cardsBySuit('major')).toHaveLength(22);
    expect(AstrologyArcana.cardsBySuit('wands')).toHaveLength(14);
    expect(AstrologyArcana.cardsBySuit('all')).toHaveLength(78);
  });

  test('spreadFromDeck deals three unique upright cards deterministically', () => {
    const a = AstrologyArcana.spreadFromDeck(12345);
    const b = AstrologyArcana.spreadFromDeck(12345);
    const c = AstrologyArcana.spreadFromDeck(99999);
    expect(a.situation.id).toBeTruthy();
    expect(a.cross.id).toBeTruthy();
    expect(a.path.id).toBeTruthy();
    expect(new Set([a.situation.id, a.cross.id, a.path.id]).size).toBe(3);
    expect(b.situation.id).toBe(a.situation.id);
    expect(b.cross.id).toBe(a.cross.id);
    expect(b.path.id).toBe(a.path.id);
    expect(c.situation.id).not.toBe(a.situation.id);
  });

  test('fact sheet teaches how to use the deck', () => {
    const sheet = AstrologyArcana.factSheet();
    expect(sheet).toMatch(/How Rose uses the deck/i);
    expect(sheet).toMatch(/Minor Arcana/);
    expect(sheet).toMatch(/Ace of Wands/);
  });
});

describe('Rose + Carl handoff prompts', () => {
  test('Rose prompt grounds full tarot expertise', () => {
    const prompt = buildSystemPrompt({ arcana: 'The Star' });
    expect(prompt).toMatch(/tarot expert|using and reading/i);
    expect(prompt).toContain('seventy-eight');
    expect(prompt).toContain('The Fool');
    expect(prompt).toContain('The World');
    expect(prompt).toContain('Ace of Cups');
    expect(prompt).toContain('The Star');
  });

  test('summary counts full tarot deck', () => {
    const summary = getRoseSummary();
    expect(summary.tarotCount).toBe(78);
    expect(summary.arcanaCount).toBe(22);
  });

  test('grounded chat teaches how to use tarot without OpenAI', async () => {
    const prior = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await chatWithRose({ message: 'How do I shuffle and read tarot?' });
      expect(result.source).toBe('page-facts');
      expect(result.reply).toMatch(/Shuffle|Situation|Wands|Cups/i);
    } finally {
      if (prior != null) process.env.OPENAI_API_KEY = prior;
    }
  });

  test('Carl prompt redirects zodiac to Rose', () => {
    const prompt = buildCarlPrompt({});
    expect(prompt).toMatch(/Rose|astrology\.html/i);
    expect(prompt).toMatch(/zodiac|horoscope|tarot/i);
  });
});

describe('rose-heygen.service', () => {
  test('demo short script and voice picker', () => {
    const demo = getRoseDemoShort();
    expect(demo.script).toMatch(/Rose/);
    expect(demo.script).toMatch(/seventy-eight|tarot/i);
    expect(demo.localPath).toContain('astrology-rose-intro.mp4');
    const voice = pickRoseVoice([
      { id: '1', name: 'Warm Storyteller', gender: 'female', language: 'English' },
      { id: '2', name: 'Bass Man', gender: 'male', language: 'English' },
    ]);
    expect(voice.voiceId).toBe('1');
  });

  test('demo payload exposes spokenScript like disaster briefing', async () => {
    const { getRoseDemoPayload } = await import('../../services/rose-heygen.service.js');
    const payload = getRoseDemoPayload();
    expect(payload.spokenTitle).toMatch(/Rose/);
    expect(payload.spokenScript).toMatch(/Rose/);
    expect(payload.googleVoice).toMatch(/en-US/);
    expect(payload.heygenVideoLocalShort).toMatch(/astrology-rose-intro\.mp4/);
    expect(payload.allowIntroVideo).toBe(true);

    const vi = getRoseDemoPayload({ lang: 'vi' });
    expect(vi.lang).toBe('vi');
    expect(vi.spokenScript).toMatch(/Rose/);
    expect(vi.googleVoice).toMatch(/^vi-VN/);
    expect(vi.heygenVideoLocalShort).toMatch(/astrology-rose-intro-vi\.mp4/);
    expect(vi.heygenVideoLocalShort).not.toMatch(/astrology-rose-intro\.mp4$/);
    expect(vi.allowIntroVideo).toBe(true);
  });

  test('getRoseDemoShort and pickRoseVoice are language-aware', async () => {
    const { getRoseDemoShort, pickRoseVoice } = await import('../../services/rose-heygen.service.js');
    expect(getRoseDemoShort('vi').script).toMatch(/Tôi là Rose/);
    expect(getRoseDemoShort('vi').voiceLanguage).toBe('Vietnamese');
    expect(getRoseDemoShort('vi').localPath).toContain('-vi.mp4');
    const voice = pickRoseVoice(
      [
        { id: 'en1', name: 'Warm Storyteller', gender: 'female', language: 'English' },
        { id: 'vi1', name: 'HuyenTrang', gender: 'female', language: 'Vietnamese' },
        { id: 'vi2', name: 'Son Tran', gender: 'male', language: 'Vietnamese' },
      ],
      'vi'
    );
    expect(voice.voiceId).toBe('vi1');
    expect(
      pickRoseVoice([{ id: 'vi2', name: 'Son Tran', gender: 'male', language: 'Vietnamese' }], 'vi')
    ).toBeNull();
  });

  test('create script and npm entries exist', () => {
    expect(existsSync(join(process.cwd(), 'scripts/tools/create-rose-heygen-avatar.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'scripts/tools/fetch-rose-tarot-images.mjs'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['create:rose-heygen-avatar']).toBeTruthy();
    expect(pkg.scripts['generate:rose-heygen-demo']).toBeTruthy();
    expect(pkg.scripts['fetch:rose-tarot-images']).toBeTruthy();
  });
});

describe('planetarium guide handoff wiring', () => {
  test('guide script detects astrology intent and Rose URL', () => {
    const js = readFileSync(join(process.cwd(), 'public/planetarium/js/planetarium-guide.js'), 'utf8');
    expect(js).toContain('isAstrologyIntent');
    expect(js).toContain('handoffToRose');
    expect(js).toContain('/entertainment/astrology.html');
  });
});

describe('astrology page tarot wiring', () => {
  test('page labels the gallery Tarot cards with suit filters', () => {
    const html = readFileSync(join(process.cwd(), 'public/entertainment/astrology.html'), 'utf8');
    expect(html).toContain('Tarot cards');
    expect(html).toContain('data-tarot-suit="pentacles"');
    expect(html).toContain('id="astroTarotFilters"');
    const js = readFileSync(join(process.cwd(), 'public/entertainment/js/astrology.js'), 'utf8');
    expect(js).toContain('astro-tarot-art');
    expect(js).toContain('applyTarotFilter');
  });
});
