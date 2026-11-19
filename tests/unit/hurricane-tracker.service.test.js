/**
 * Hurricane Tracker — county CPA, wind swath, Governor SoE (state-specific), FEMA windows
 */
import { describe, test, expect } from '@jest/globals';
import {
  haversineMiles,
  pointInPolygon,
  closestPointOnTrack,
  classifyWindSwathTier,
  getGovernorSoeLag,
  predictDeclarationTimeline,
  predictImpactedCounties,
  summarizeGovernorAnnouncementsByState,
  GOVERNOR_SOE_LAG_HOURS,
  GOVERNOR_INLAND_SOE_LAG_HOURS,
  getReplayStorm,
  getAdvisory,
  saffirSimpsonCategory,
} from '../../services/hurricane-tracker.service.js';

describe('haversineMiles / pointInPolygon', () => {
  test('distance between nearby Gulf points is finite', () => {
    const d = haversineMiles(27.5, -82.5, 27.6, -82.4);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(20);
  });

  test('point inside cone polygon', () => {
    const ring = [
      [-84, 26],
      [-81, 26],
      [-81, 29],
      [-84, 29],
      [-84, 26],
    ];
    expect(pointInPolygon(-82.5, 27.5, ring)).toBe(true);
    expect(pointInPolygon(-90, 27.5, ring)).toBe(false);
  });
});

describe('closestPointOnTrack / classifyWindSwathTier', () => {
  const track = [
    { tauH: 0, lat: 25, lng: -84, windKt: 100, category: 3 },
    { tauH: 24, lat: 27, lng: -82.5, windKt: 110, category: 3 },
    { tauH: 48, lat: 29, lng: -81, windKt: 70, category: 1 },
  ];

  test('CPA returns nearest tau', () => {
    const cpa = closestPointOnTrack(27.1, -82.4, track);
    expect(cpa.distanceMiles).toBeLessThan(50);
    expect(cpa.tauH).toBe(24);
  });

  test('tier classification by distance and radii', () => {
    expect(classifyWindSwathTier(20, { kt64: 40, kt50: 80, kt34: 140 }, false).tier).toBe('core_64kt');
    expect(classifyWindSwathTier(55, { kt64: 40, kt50: 80, kt34: 140 }, false).tier).toBe('swath_50kt');
    expect(classifyWindSwathTier(100, { kt64: 40, kt50: 80, kt34: 140 }, true).tier).toBe('ts_34kt');
    expect(classifyWindSwathTier(110, { kt64: 0, kt50: 0, kt34: 0 }, false).tier).toBe('fringe');
    expect(classifyWindSwathTier(200, {}, false).tier).toBe('outside');
  });
});

describe('Governor SoE varies by state', () => {
  test('FL coastal SoE is earlier than inland TN cascade', () => {
    const fl = getGovernorSoeLag('FL', 'core_64kt');
    const tn = getGovernorSoeLag('TN', 'ts_34kt');
    expect(fl.typical).toBeLessThan(0);
    expect(tn.typical).toBeGreaterThanOrEqual(0);
    expect(fl.typical).toBeLessThan(tn.typical);
  });

  test('TX lag table differs from DEFAULT inland', () => {
    expect(GOVERNOR_SOE_LAG_HOURS.TX.typical).toBe(-36);
    expect(GOVERNOR_INLAND_SOE_LAG_HOURS.DEFAULT_INLAND.typical).toBe(24);
  });

  test('predictDeclarationTimeline includes governorSoe with state note', () => {
    const landfall = '2024-10-09T20:00:00.000Z';
    const fl = predictDeclarationTimeline({
      landfallAt: landfall,
      category: 4,
      impactTier: 'core_64kt',
      stateAbbr: 'FL',
    });
    const tn = predictDeclarationTimeline({
      landfallAt: landfall,
      category: 4,
      impactTier: 'ts_34kt',
      stateAbbr: 'TN',
    });
    expect(fl.governorSoe.state).toBe('FL');
    expect(fl.governorSoe.windowTypical).toBeTruthy();
    expect(tn.governorSoe.state).toBe('TN');
    expect(new Date(fl.governorSoe.windowTypical).getTime()).toBeLessThan(
      new Date(tn.governorSoe.windowTypical).getTime()
    );
    expect(fl.femaDr.likelyPrograms).toMatch(/IA/);
    expect(tn.femaDr.windowStart).toBeTruthy();
  });
});

describe('replay storm county prediction', () => {
  test('Milton landfall advisory impacts FL counties and groups Governor SoE by state', () => {
    const storm = getReplayStorm('milton-2024');
    expect(storm).toBeTruthy();
    const adv = getAdvisory(storm, 3);
    expect(adv.label).toBe('Landfall');
    const counties = predictImpactedCounties(storm, adv);
    expect(counties.length).toBeGreaterThan(5);
    expect(counties.some((c) => c.state_abbr === 'FL')).toBe(true);
    expect(counties[0].governorSoe).toBeTruthy();
    expect(counties[0].declarationTimeline.femaEm).toBeTruthy();

    const byState = summarizeGovernorAnnouncementsByState(counties);
    expect(byState.some((s) => s.state_abbr === 'FL')).toBe(true);
    const fl = byState.find((s) => s.state_abbr === 'FL');
    expect(fl.typicalSoe).toBeTruthy();
    expect(fl.note).toMatch(/varies by state/i);
  });

  test('saffirSimpsonCategory thresholds', () => {
    expect(saffirSimpsonCategory(150)).toBe(4);
    expect(saffirSimpsonCategory(80)).toBe(1);
    expect(saffirSimpsonCategory(50)).toBe(0);
  });
});
