/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { describe, expect, it } from '@jest/globals';
import { normalizeGenealogyGeocodeCacheKey } from '../../services/genealogy-geocode-cache.service.js';

describe('genealogy-geocode-cache.service', () => {
  describe('normalizeGenealogyGeocodeCacheKey', () => {
    it('collapses whitespace and lowercases', () => {
      expect(normalizeGenealogyGeocodeCacheKey('  Boston,\tMass  ')).toBe('boston, mass');
    });

    it('returns empty when not a usable string', () => {
      expect(normalizeGenealogyGeocodeCacheKey('')).toBe('');
      expect(normalizeGenealogyGeocodeCacheKey(null)).toBe('');
    });
  });
});
