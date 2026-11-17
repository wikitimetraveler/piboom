/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import {
  calculateRiskScore,
  floodZoneTriageWeight,
  declarationTriageContribution,
  distanceTriageWeight,
  FLOOD_ZONE_TRIAGE_WEIGHTS,
} from '../../services/disaster-risk.service.js';
import { resolveFemaDeclarationFields } from '../../services/disasters.service.js';

describe('floodZoneTriageWeight', () => {
  test('uses explicit zone table (not substring heuristics)', () => {
    expect(floodZoneTriageWeight('AE')).toBe(FLOOD_ZONE_TRIAGE_WEIGHTS.AE);
    expect(floodZoneTriageWeight('VE')).toBe(FLOOD_ZONE_TRIAGE_WEIGHTS.VE);
    expect(floodZoneTriageWeight('A')).toBe(FLOOD_ZONE_TRIAGE_WEIGHTS.A);
    expect(floodZoneTriageWeight('AH')).toBe(FLOOD_ZONE_TRIAGE_WEIGHTS.AH);
    expect(floodZoneTriageWeight('D')).toBe(FLOOD_ZONE_TRIAGE_WEIGHTS.D);
    expect(floodZoneTriageWeight('X')).toBe(0);
    expect(floodZoneTriageWeight('X', 'Shaded X')).toBe(1);
  });

  test('prefix-matches known FEMA codes', () => {
    expect(floodZoneTriageWeight('AE')).toBe(4);
    expect(floodZoneTriageWeight('A99')).toBe(3);
  });
});

describe('declarationTriageContribution', () => {
  test('falls back to raw count without distances', () => {
    expect(declarationTriageContribution({
      disasterCount: 4,
      disasters: [{ incidentBeginDate: '2026-07-01' }],
    })).toBe(4);
  });

  test('applies distance × recency when distances present', () => {
    const recent = new Date().toISOString();
    const score = declarationTriageContribution({
      disasterCount: 1,
      disasters: [{ distanceMiles: 5, incidentBeginDate: recent }],
    });
    expect(score).toBe(1);
    expect(distanceTriageWeight(5)).toBe(1);
  });
});

describe('calculateRiskScore (ops triage)', () => {
  test('adds flood zone weight to declaration contribution', () => {
    const score = calculateRiskScore(
      { disasterCount: 2, disasters: [{}, {}] },
      { flood_zone: 'AE' },
      { useDistanceRecency: false }
    );
    expect(score).toBe(6);
  });

  test('caps at 15', () => {
    const score = calculateRiskScore(
      { disasterCount: 20, disasters: Array(20).fill({}) },
      { flood_zone: 'VE' },
      { useDistanceRecency: false }
    );
    expect(score).toBe(14);
  });
});

describe('resolveFemaDeclarationFields', () => {
  test('uses deterministic source_id from disasterNumber + placeCode and newer declarationDate as start_time', () => {
    const row1 = resolveFemaDeclarationFields({
      id: 'ephemeral-uuid-1',
      disasterNumber: 4955,
      state: 'FL',
      fipsStateCode: '12',
      fipsCountyCode: '037',
      placeCode: '99037',
      designatedArea: 'Franklin (County)',
      incidentType: 'Hurricane',
      declarationTitle: 'HURRICANE ISAIAS',
      declarationDate: '2026-10-27T00:00:00.000Z',
      incidentBeginDate: '2026-10-06T00:00:00.000Z',
    });
    const row2 = resolveFemaDeclarationFields({
      id: 'ephemeral-uuid-2',
      disasterNumber: 4955,
      state: 'FL',
      fipsStateCode: '12',
      fipsCountyCode: '037',
      placeCode: '99037',
      designatedArea: 'Franklin (County)',
      incidentType: 'Hurricane',
      declarationTitle: 'HURRICANE ISAIAS',
      declarationDate: '2026-10-27T00:00:00.000Z',
      incidentBeginDate: '2026-10-06T00:00:00.000Z',
    });

    expect(row1.source_id).toBe('fema-4955-99037');
    expect(row2.source_id).toBe(row1.source_id);
    expect(row1.start_time).toBe('2026-10-27T00:00:00.000Z');
    expect(row1.county_fips).toBe('12037');
    expect(row1.county_name).toBe('Franklin');
  });
});

