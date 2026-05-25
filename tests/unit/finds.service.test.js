/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import { computeTreasureScore, scoreLabelFromScore } from '../../services/finds.service.js';

describe('finds.service treasure score', () => {
  test('scoreLabelFromScore buckets', () => {
    expect(scoreLabelFromScore(0)).toBe('low');
    expect(scoreLabelFromScore(39)).toBe('low');
    expect(scoreLabelFromScore(40)).toBe('medium');
    expect(scoreLabelFromScore(69)).toBe('medium');
    expect(scoreLabelFromScore(70)).toBe('high');
    expect(scoreLabelFromScore(100)).toBe('high');
  });

  test('empty payload yields low score', () => {
    const { score, scoreLabel } = computeTreasureScore({});
    expect(score).toBe(0);
    expect(scoreLabel).toBe('low');
  });

  test('signed numbered framed adds base points', () => {
    const { score } = computeTreasureScore({
      identification: { signed: true, numbered: true, confidence: 0 },
      condition: { framed: true, overall: 'good' },
      acquisition: {},
      valuation: {},
    });
    expect(score).toBe(45);
  });

  test('realisticHigh >= 2x pricePaid adds bonus', () => {
    const { score } = computeTreasureScore({
      identification: {},
      condition: {},
      acquisition: { pricePaid: 100 },
      valuation: { realisticHigh: 250 },
    });
    expect(score).toBe(25);
  });

  test('poor condition subtracts', () => {
    const { score } = computeTreasureScore({
      identification: { signed: true },
      condition: { overall: 'poor' },
      acquisition: {},
      valuation: {},
    });
    expect(score).toBe(5);
  });

  test('high confidence adds 10', () => {
    const { score } = computeTreasureScore({
      identification: { confidence: 0.85 },
      condition: {},
      acquisition: {},
      valuation: {},
    });
    expect(score).toBe(10);
  });

  test('matching maker and probableMaker adds 10 once', () => {
    const { score } = computeTreasureScore({
      identification: {
        maker: 'Lee White',
        probableMaker: 'lee white',
        confidence: 0,
      },
      condition: {},
      acquisition: {},
      valuation: {},
    });
    expect(score).toBe(10);
  });

  test('clamps to 0-100', () => {
    const { score } = computeTreasureScore({
      identification: {
        signed: true,
        numbered: true,
        confidence: 1,
        maker: 'x',
        probableMaker: 'x',
      },
      condition: { framed: true, overall: 'good' },
      acquisition: { pricePaid: 1 },
      valuation: { realisticHigh: 1000 },
    });
    // 20+15+10+10+10+25 = 90
    expect(score).toBe(90);
  });
});
