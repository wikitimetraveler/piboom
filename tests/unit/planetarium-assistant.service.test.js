/**
 * Development work by David Lane
 */
import { buildSystemPrompt, GUIDE_NAME, AVATAR_NAME } from '../../services/planetarium-assistant.service.js';

describe('planetarium-assistant.service', () => {
  test('guide and avatar names', () => {
    expect(GUIDE_NAME).toBe('Carl');
    expect(AVATAR_NAME).toBe('Zigzag');
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
    expect(prompt).toContain('Zigzag');
    expect(prompt).toContain('Hampton Falls, NH');
    expect(prompt).toContain('Jupiter high in the south');
    expect(prompt).toContain('Orion');
  });

  test('buildSystemPrompt works with empty context', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('No live sky context');
  });

  test('buildSystemPrompt embeds world dossier', () => {
    const prompt = buildSystemPrompt({
      worldId: 'mars',
      world: {
        id: 'mars',
        name: 'Mars',
        kicker: 'Red planet',
        lede: 'A cold desert world.',
        credit: 'NASA / JPL · Viking',
        physical: { radiusKm: 3390, dayHours: 24.6, yearDays: 687, moons: 2, tiltDeg: 25.2 },
        landmark: { label: 'Olympus Mons', blurb: 'Tallest volcano.' },
        missions: [{ name: 'Viking 1 & 2', year: 1976, note: 'First soft landings.' }],
        researchNotes: ['A Martian day is a sol.'],
        folklore: 'Canal myths are folklore.',
        carlFocus: 'Highlight Olympus Mons.',
      },
    });
    expect(prompt).toContain('Open planet world dossier');
    expect(prompt).toContain('Mars');
    expect(prompt).toContain('Olympus Mons');
    expect(prompt).toContain('Viking');
    expect(prompt).toContain('Canal myths');
    expect(prompt).toContain('Highlight Olympus Mons');
  });

  test('buildSystemPrompt embeds SpaceX pad context', () => {
    const prompt = buildSystemPrompt({
      surface: 'spacex',
      spacex: {
        focusRocket: 'Falcon Heavy',
        vehicles: 'Falcon 1 (5), Falcon 9 (796)',
        launchCount: 853,
        successCount: 800,
        nextLaunch: 'Sep 13, 2026 · O3b mPower',
      },
    });
    expect(prompt).toContain('SpaceX pad');
    expect(prompt).toContain('Falcon Heavy');
    expect(prompt).toContain('O3b mPower');
    expect(prompt).toContain('Zigzag');
  });
});
