/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { describe, test, expect } from '@jest/globals';
import {
  sanitizeFilterPage,
  normalizePresetConfig,
  isValidPresetId,
  PRESETS_MAX_COUNT
} from '../../services/lane-pdf-gallery-presets.service.js';

describe('lane-pdf-gallery-presets.service', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  test('sanitizeFilterPage empty or valid page', () => {
    expect(sanitizeFilterPage('')).toBe('');
    expect(sanitizeFilterPage('16')).toBe('16');
    expect(sanitizeFilterPage('0')).toBe('');
    expect(sanitizeFilterPage('-1')).toBe('');
  });

  test('normalizePresetConfig fills defaults', () => {
    expect(normalizePresetConfig({})).toEqual({
      filterPage: '',
      filterCandidateIds: '',
      showServerDenied: true
    });
    expect(
      normalizePresetConfig({
        filterPage: '12',
        filterCandidateIds: '1 2',
        showServerDenied: false
      })
    ).toEqual({
      filterPage: '12',
      filterCandidateIds: '1 2',
      showServerDenied: false
    });
    expect(normalizePresetConfig({ showHidden: false }).showServerDenied).toBe(false);
  });

  test('isValidPresetId', () => {
    expect(isValidPresetId(validUuid)).toBe(true);
    expect(isValidPresetId('not-uuid')).toBe(false);
  });

  test('PRESETS_MAX_COUNT is bounded', () => {
    expect(PRESETS_MAX_COUNT).toBeGreaterThanOrEqual(8);
    expect(PRESETS_MAX_COUNT).toBeLessThanOrEqual(12);
  });
});
