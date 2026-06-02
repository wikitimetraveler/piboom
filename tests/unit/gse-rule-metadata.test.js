/**
 * Development work by David Lane
 */
import { describe, expect, it } from '@jest/globals';
import { readSources } from '../../services/gse-source.service.js';

describe('gse rule-metadata.json', () => {
  const metadata = readSources();

  it('parses and exposes agencyExhibitLinks for all exhibit agencies', () => {
    expect(metadata.agencyExhibitLinks).toBeDefined();
    const agencies = ['fannie', 'freddie', 'fha', 'va', 'usda'];
    for (const agency of agencies) {
      expect(Array.isArray(metadata.agencyExhibitLinks[agency])).toBe(true);
      expect(metadata.agencyExhibitLinks[agency].length).toBeGreaterThan(0);
    }
  });

  it('resolves every agencyExhibitLinks id to a source with url', () => {
    const byId = new Map((metadata.sources || []).map((s) => [s.id, s]));
    for (const [agency, ids] of Object.entries(metadata.agencyExhibitLinks || {})) {
      for (const id of ids) {
        const source = byId.get(id);
        expect(source).toBeDefined();
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('includes FHA mortgagee letters and VA circulars sources', () => {
    const byId = new Map((metadata.sources || []).map((s) => [s.id, s]));
    expect(byId.get('FHA_MORTGAGEE_LETTERS')?.url).toContain('mortgagee_letters');
    expect(byId.get('VA_CIRCULARS')?.url).toContain('lenders_circulars');
  });
});
