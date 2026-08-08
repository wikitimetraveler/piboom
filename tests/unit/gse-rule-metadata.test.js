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

  it('exposes Ginnie Mae delivery references (not an underwriting agency bucket)', () => {
    expect(metadata.deliveryExhibitLinks).toBeDefined();
    expect(Array.isArray(metadata.deliveryExhibitLinks.ginnie)).toBe(true);
    expect(metadata.deliveryExhibitLinks.ginnie.length).toBeGreaterThan(0);
    expect(metadata.agencyExhibitLinks.ginnie).toBeUndefined();

    const byId = new Map((metadata.sources || []).map((s) => [s.id, s]));
    for (const id of metadata.deliveryExhibitLinks.ginnie) {
      const source = byId.get(id);
      expect(source).toBeDefined();
      expect(source.url).toMatch(/^https:\/\/www\.ginniemae\.gov\//);
    }
  });

  it('exposes mortgage pooling primer references with resolvable source urls', () => {
    expect(Array.isArray(metadata.poolingExhibitLinks)).toBe(true);
    expect(metadata.poolingExhibitLinks.length).toBeGreaterThan(0);

    const byId = new Map((metadata.sources || []).map((s) => [s.id, s]));
    for (const id of metadata.poolingExhibitLinks) {
      const source = byId.get(id);
      expect(source).toBeDefined();
      expect(source.url).toMatch(/^https:\/\//);
    }

    expect(byId.get('FANNIE_MBS_SECURITIZATION')?.url).toContain('selling-guide.fanniemae.com');
    expect(byId.get('FREDDIE_MBS_OVERVIEW')?.url).toContain('freddiemac.com');
    expect(byId.get('FHFA_UMBS')?.url).toContain('fhfa.gov');
  });
});
