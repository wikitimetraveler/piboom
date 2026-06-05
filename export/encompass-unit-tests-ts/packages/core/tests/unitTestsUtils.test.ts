import { describe, expect, test } from 'vitest';
import {
  compareValues,
  getCompareModeFromRow,
  isBlankForTest,
  normalizeCompareMode,
} from '../src/compare/unitTestsUtils.js';

describe('unitTestsUtils compareValues', () => {
  test('equals mode preserves legacy string and case-insensitive match', () => {
    expect(compareValues('Hello', 'hello', 'equals')).toBe(true);
    expect(compareValues('100', '100', 'equals')).toBe(true);
    expect(compareValues('100', '101', 'equals')).toBe(false);
  });

  test('equals mode treats null/nothing as blank', () => {
    expect(compareValues('', 'null', 'equals')).toBe(true);
    expect(compareValues('Nothing', '', 'equals')).toBe(true);
    expect(isBlankForTest('NULL')).toBe(true);
  });

  test('approx mode tolerates floating-point drift', () => {
    expect(compareValues(0.1 + 0.2, 0.3, 'approx')).toBe(true);
    expect(compareValues(1.0, 1.02, 'approx', { epsilon: 0.01 })).toBe(false);
    expect(compareValues(1.0, 1.004, 'approx')).toBe(true);
  });

  test('date mode normalizes slash and ISO calendar days', () => {
    expect(compareValues('01/15/2025', '2025-01-15', 'date')).toBe(true);
    expect(compareValues('01/16/2025', '2025-01-15', 'date')).toBe(false);
  });

  test('contains and regex modes', () => {
    expect(compareValues('Refinance Conv', 'refi', 'contains')).toBe(true);
    expect(compareValues('ABC123', '^[A-Z]+\\d+$', 'regex')).toBe(true);
    expect(compareValues('abc', '^[A-Z]+$', 'regex')).toBe(false);
  });

  test('ordering modes use numeric coercion', () => {
    expect(compareValues('10', '5', 'gt')).toBe(true);
    expect(compareValues('5', '10', 'lte')).toBe(true);
    expect(compareValues('5', '5', 'not')).toBe(false);
  });

  test('normalizeCompareMode aliases', () => {
    expect(normalizeCompareMode('~')).toBe('approx');
    expect(normalizeCompareMode('>=')).toBe('gte');
    expect(normalizeCompareMode('dates')).toBe('date');
  });

  test('getCompareModeFromRow reads CompareMode or Operator columns', () => {
    expect(getCompareModeFromRow({ CompareMode: 'approx' })).toBe('approx');
    expect(getCompareModeFromRow({ Operator: 'contains' })).toBe('contains');
    expect(getCompareModeFromRow({ Step: 1 })).toBe('equals');
  });
});
