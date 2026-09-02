/**
 * Development work by David Lane
 */
import { buildSystemPrompt, GUIDE_NAME, AVATAR_NAME } from '../../services/planetarium-assistant.service.js';

describe('planetarium-assistant.service', () => {
  test('guide and avatar names', () => {
    expect(GUIDE_NAME).toBe('Carl');
    expect(AVATAR_NAME).toBe('Zed');
  });

  test('buildSystemPrompt embeds live sky context', () => {
    const prompt = buildSystemPrompt({
      observerLabel: 'Hampton Falls, NH',
      lat: '42.90°',
      lon: '-70.86°',
      dateLocal: '2026-08-31 21:00',
      facing: 'south',
      moonPhase: 'Waxing gibbous',
      caption: 'Jupiter high in the south',
      planets: [{ name: 'Jupiter', alt: 42, az: 180 }],
      asterisms: ['Orion', 'Big Dipper'],
    });
    expect(prompt).toContain('Carl');
    expect(prompt).toContain('Zed');
    expect(prompt).toContain('Hampton Falls, NH');
    expect(prompt).toContain('Jupiter high in the south');
    expect(prompt).toContain('Orion');
  });

  test('buildSystemPrompt works with empty context', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('No live sky context');
  });
});
