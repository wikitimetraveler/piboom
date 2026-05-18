/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { describe, test, expect } from '@jest/globals';
import {
  isValidClientId,
  isValidPlateImageId,
  validateClientPlateIds
} from '../../services/lane-pdf-gallery-hides.service.js';

describe('lane-pdf-gallery-hides.service validation', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  test('isValidClientId accepts standard UUID lowercase', () => {
    expect(isValidClientId(validUuid)).toBe(true);
  });

  test('isValidClientId trims whitespace', () => {
    expect(isValidClientId(`  ${validUuid}  `)).toBe(true);
  });

  test('isValidClientId rejects non-uuid', () => {
    expect(isValidClientId('not-a-uuid')).toBe(false);
    expect(isValidClientId('')).toBe(false);
    expect(isValidClientId(null)).toBe(false);
  });

  test('isValidPlateImageId matches p#/i#', () => {
    expect(isValidPlateImageId('p12-i0')).toBe(true);
    expect(isValidPlateImageId('p1-i99')).toBe(true);
  });

  test('isValidPlateImageId rejects bad shapes', () => {
    expect(isValidPlateImageId('plate-12-0')).toBe(false);
    expect(isValidPlateImageId('p12-i')).toBe(false);
    expect(isValidPlateImageId('')).toBe(false);
  });

  test('validateClientPlateIds pairs ok', () => {
    expect(validateClientPlateIds(validUuid, 'p1-i2')).toEqual({ ok: true });
  });

  test('validateClientPlateIds rejects bad client', () => {
    const r = validateClientPlateIds('x', 'p1-i2');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/clientId/i);
  });

  test('validateClientPlateIds rejects bad image id', () => {
    const r = validateClientPlateIds(validUuid, 'nope');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/image/i);
  });
});
