import {
  __test__,
  getMilitaryDeepScanReport,
  getWarCampaignsSummary,
  getWarParticipants
} from '../../services/genealogy.service.js';

describe('genealogy war participant matching', () => {
  test('service signal detects troop/trooper language', () => {
    expect(__test__.hasServiceSignal('He joined the troops before the battle.')).toBe(true);
    expect(__test__.hasServiceSignal('A mounted trooper served in his company.')).toBe(true);
    expect(__test__.hasServiceSignal('No military context here.')).toBe(false);
  });

  test('scoreWarMatch can infer by service signal + war years', () => {
    const war = __test__.WAR_DEFINITIONS['revolutionary-war'];
    const person = {
      id: 999001,
      name: 'Synthetic Troop Case',
      birthYear: 1760,
      deathYear: 1820,
      text: 'A trooper of local company in New Hampshire frontier.',
      occupation: [],
      importMeta: {}
    };
    const scored = __test__.scoreWarMatch(person, war);
    expect(scored).toBeTruthy();
    expect(['medium', 'low', 'high']).toContain(scored.confidence);
    expect(Array.isArray(scored.evidence)).toBe(true);
  });

  test('plausibleAgeForWarInference rejects Mexican War for early 18th-century birth', () => {
    const mex = __test__.WAR_DEFINITIONS['mexican-american-war'];
    expect(__test__.plausibleAgeForWarInference(1701, null, mex.years)).toBe(false);
    expect(__test__.plausibleAgeForWarInference(1820, null, mex.years)).toBe(true);
  });

  test('colonial frontier militia matches Dummer/Westbrook Maine narrative (John Lane id 2903)', () => {
    const colonial = __test__.WAR_DEFINITIONS['colonial-frontier-militia'];
    const person = {
      id: 2903,
      name: 'John Lane',
      birthYear: 1701,
      text:
        'Lieutenant Governor Dummer and Col. Thomas Westbrook at York 1724 regarding Lieutenant John Lane and York County.',
      occupation: [],
      importMeta: {}
    };
    const scored = __test__.scoreWarMatch(person, colonial);
    expect(scored).toBeTruthy();
    expect(scored.confidence).toBe('medium');
  });

  test('early colonial birth does not infer-match Mexican-American War on generic military text', () => {
    const mex = __test__.WAR_DEFINITIONS['mexican-american-war'];
    const person = {
      id: 999002,
      name: 'OCR Colonial',
      birthYear: 1701,
      text: 'He entered military service early and became captain.',
      occupation: [],
      importMeta: {}
    };
    expect(__test__.scoreWarMatch(person, mex)).toBeNull();
  });

  test('war campaigns summary includes participant counts', () => {
    const summary = getWarCampaignsSummary();
    expect(summary).toBeTruthy();
    expect(Array.isArray(summary.campaigns)).toBe(true);
    summary.campaigns.forEach((campaign) => {
      expect(typeof campaign.slug).toBe('string');
      expect(typeof campaign.label).toBe('string');
      expect(typeof campaign.participantCount).toBe('number');
    });
  });

  test('existing endpoint helper still returns arrays for known slugs', () => {
    expect(Array.isArray(getWarParticipants('king-philips-war'))).toBe(true);
    expect(Array.isArray(getWarParticipants('revolutionary-war'))).toBe(true);
  });

  test('deep scan report returns conflict + suspicious sections', () => {
    const report = getMilitaryDeepScanReport();
    expect(report).toBeTruthy();
    expect(typeof report.scannedPeople).toBe('number');
    expect(typeof report.serviceSignalHits).toBe('number');
    expect(Array.isArray(report.conflicts)).toBe(true);
    expect(Array.isArray(report.suspiciousUnmatched)).toBe(true);
  });
});
