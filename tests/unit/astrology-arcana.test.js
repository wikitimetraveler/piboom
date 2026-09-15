/**
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import '../../public/entertainment/js/astrology-arcana.js';
import { buildSystemPrompt } from '../../services/rose-assistant.service.js';
import { getRoseDemoShort, pickRoseVoice } from '../../services/rose-heygen.service.js';
import { buildSystemPrompt as buildCarlPrompt } from '../../services/planetarium-assistant.service.js';

const { AstrologyArcana } = globalThis;

describe('AstrologyArcana', () => {
  test('lists twenty-two Major Arcana in order', () => {
    expect(AstrologyArcana.ARCANA).toHaveLength(22);
    expect(AstrologyArcana.ARCANA[0].id).toBe('the-fool');
    expect(AstrologyArcana.ARCANA[21].id).toBe('the-world');
    AstrologyArcana.ARCANA.forEach((card, index) => {
      expect(card.number).toBe(index);
      expect(card.name).toBeTruthy();
      expect(card.oracle).toMatch(/Rose/);
      expect(card.askRose).toMatch(/Read/);
    });
  });

  test('cardById resolves trump cards', () => {
    expect(AstrologyArcana.cardById('the-tower').name).toBe('The Tower');
    expect(AstrologyArcana.cardById('missing')).toBeNull();
  });
});

describe('Rose + Carl handoff prompts', () => {
  test('Rose prompt grounds Major Arcana', () => {
    const prompt = buildSystemPrompt({ arcana: 'The Star' });
    expect(prompt).toContain('Major Arcana');
    expect(prompt).toContain('The Fool');
    expect(prompt).toContain('The World');
    expect(prompt).toContain('The Star');
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
  });

  test('create script and npm entries exist', () => {
    expect(existsSync(join(process.cwd(), 'scripts/tools/create-rose-heygen-avatar.mjs'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['create:rose-heygen-avatar']).toBeTruthy();
    expect(pkg.scripts['generate:rose-heygen-demo']).toBeTruthy();
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
