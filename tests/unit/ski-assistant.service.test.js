/**
 * Development work by David Lane
 */
import { buildSystemPrompt, GUIDE_NAME } from '../../services/ski-assistant.service.js';

describe('ski-assistant.service', () => {
  test('Ridge prompt includes catalog stops, 21+, and Wrightwood vs Medicinals', () => {
    expect(GUIDE_NAME).toBe('Ridge');
    const prompt = buildSystemPrompt({
      destinations: [
        {
          name: 'Mountain High',
          area: 'Wrightwood',
          score: 'go',
          baseFt: 6600,
          summitFt: 8200,
          driveMin: 95,
          highways: ['CA-2'],
          weather: { tempF: 28, freezeLevelFt: 5000 },
          alerts: [],
          chainsLikely: true,
        },
      ],
      stops: [
        { name: 'Pine Thrift', kind: 'thrift', town: 'Wrightwood', source: 'live' },
        { name: 'Summit Smoke', kind: 'smoke', town: 'Cajon', source: 'live' },
      ],
      pageContext: { selectedDestination: 'mountain-high', page: 'drive' },
    });
    expect(prompt).toContain('Ridge');
    expect(prompt).toContain('21');
    expect(prompt).toContain('Pine Thrift');
    expect(prompt).toContain('Summit Smoke');
    expect(prompt).toContain('Mountain High');
    expect(prompt).toMatch(/Medicinals/);
    expect(prompt).toMatch(/Do not invent hours|Never invent hours/i);
    expect(prompt).toMatch(/Caltrans/i);
    expect(prompt).toContain('mountain-high');
    expect(prompt).toMatch(/Drive desk/i);
  });

  test('Ridge gets the selected resort run table and the selected run', () => {
    const prompt = buildSystemPrompt({
      destinations: [
        { id: 'mountain-high', name: 'Mountain High', dem: 'wrightwood', area: 'Wrightwood', highways: [] },
        { id: 'snow-summit', name: 'Snow Summit', dem: 'big-bear', area: 'Big Bear', highways: [] },
      ],
      pageContext: { selectedDestination: 'snow-summit', page: 'areas', selectedRun: 'Westridge' },
    });
    expect(prompt).toContain('Selected run on the trail map: Westridge');
    expect(prompt).toMatch(/\(Snow Summit; (Easier|Beginner|More difficult|Most difficult|Experts only|Unrated)\)/);
    expect(prompt).not.toContain('(Mountain High;');
    expect(prompt).toMatch(/faces (N|NE|NW|E|SE|S|SW|W)/);
    expect(prompt).toMatch(/open\/closed status/i);
  });
});
