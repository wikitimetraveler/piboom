/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
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

  test('Barbary Wars includes external research note for Enoch S. Lane (not in Vol. I)', () => {
    expect(__test__.WAR_DEFINITIONS['barbary-wars']).toBeTruthy();
    const participants = getWarParticipants('barbary-wars');
    expect(participants.length).toBeGreaterThanOrEqual(1);
    const enoch = participants.find((p) => String(p.person?.id) === 'ext-enoch-s-lane');
    expect(enoch).toBeTruthy();
    expect(enoch.associationType).toBe('external-research');
    expect(enoch.confidence).toBe('high');
    expect(enoch.evidence.join(' ')).toMatch(/Enterprize/i);
    expect(enoch.associationNotes.join(' ')).toMatch(/Not found in Lane Genealogies Vol\. I/i);
    const summary = getWarCampaignsSummary();
    expect(summary.campaigns.some((c) => c.slug === 'barbary-wars' && c.participantCount >= 1)).toBe(
      true
    );
  });

  test('deep scan report returns conflict + suspicious sections', () => {
    const report = getMilitaryDeepScanReport();
    expect(report).toBeTruthy();
    expect(typeof report.scannedPeople).toBe('number');
    expect(typeof report.serviceSignalHits).toBe('number');
    expect(Array.isArray(report.conflicts)).toBe(true);
    expect(Array.isArray(report.suspiciousUnmatched)).toBe(true);
  });

  test('OCR fold thc→the before revolution anchor detection', () => {
    expect(__test__.ocrFoldMilitaryHaystack('army of thc Revolution')).toContain('the Revolution');
    const sig = __test__.summarizeMilitarySignal({
      id: 1,
      name: 'X',
      birthYear: 1734,
      text: 'lieutenant in the army of thc Revolution',
      occupation: [],
      importMeta: {}
    });
    expect(__test__.hasRevolutionaryEraAnchorInEvidence(sig)).toBe(true);
  });

  test('War of 1812 digit keyword requires word boundary (1813 is not 1812)', () => {
    const w1812 = __test__.WAR_DEFINITIONS['war-of-1812'];
    expect(__test__.hasKeyword('d. 27 Feb., 1813, ae. 79', w1812.keywords)).toBe(false);
    expect(__test__.hasKeyword('enlisted in 1812 under Hull', w1812.keywords)).toBe(true);
  });

  test('Prescott spouse paragraph: Revolutionary family-associated; no French and Indian inference', () => {
    const fiw = __test__.WAR_DEFINITIONS['french-and-indian-war'];
    const rev = __test__.WAR_DEFINITIONS['revolutionary-war'];
    const kp = __test__.WAR_DEFINITIONS['king-philips-war'];
    const w1812 = __test__.WAR_DEFINITIONS['war-of-1812'];
    const person = {
      id: 201001,
      name: 'Mary Lane',
      birthYear: 1734,
      deathYear: '',
      text:
        "V. MARy 4, b. 6 Dec., 1734, m. 1 Jan., I 756, CAPTAIN JAMEs (s. of Eben and Abi.) PREsco TT of Hampton Falls, b. 5 Dec. 1733. He was selectman for years, a lieutenant in the army of thc Revolution; resided on the homc place, and d. 27 Feb., 1813, ae. 79.",
      occupation: [],
      importMeta: {}
    };
    expect(__test__.scoreWarMatch(person, fiw)).toBeNull();
    expect(__test__.scoreWarMatch(person, kp)).toBeNull();
    expect(__test__.scoreWarMatch(person, w1812)).toBeNull();
    const scoredRev = __test__.scoreWarMatch(person, rev);
    expect(scoredRev).toBeTruthy();
    expect(scoredRev.associationType).toBe('family-associated');
    expect(scoredRev.associationNotes.join(' ')).toMatch(/spouse or in-law/i);
  });
});
