/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getLifeMidDate,
  pickPresidentForMidDate,
  pickEraFigureForMidDate,
  US_PRESIDENCY_START
} from '../../public/family/js/lane-memorial-era-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const presPath = join(root, 'public/family/data/us-presidents-terms.json');
const figPath = join(root, 'public/family/data/era-figures.json');
const { terms } = JSON.parse(readFileSync(presPath, 'utf8'));
const { figures } = JSON.parse(readFileSync(figPath, 'utf8'));

describe('lane-memorial-era-api', () => {
  test('getLifeMidDate returns midpoint of birth and death', () => {
    const d = getLifeMidDate(1800, 1900);
    expect(d).toBeTruthy();
    expect(d.getUTCFullYear()).toBe(1850);
  });

  test('getLifeMidDate returns June of single known year', () => {
    const d = getLifeMidDate(1920, null);
    expect(d.getUTCFullYear()).toBe(1920);
  });

  test('pickPresidentForMidDate: Civil War — Lincoln for mid-1863', () => {
    const mid = new Date(Date.UTC(1863, 5, 15));
    const { term, mode } = pickPresidentForMidDate(terms, mid);
    expect(mode).toBe('overlap');
    expect(term.name).toBe('Abraham Lincoln');
  });

  test('pickPresidentForMidDate: before U.S. presidency', () => {
    const mid = new Date(Date.UTC(1750, 5, 15));
    const { mode, term } = pickPresidentForMidDate(terms, mid);
    expect(mode).toBe('before');
    expect(term).toBeNull();
  });

  test('pickEraFigureForMidDate: picks narrowest band when overlapping logic applies', () => {
    const mid = new Date(Date.UTC(1860, 5, 15));
    const fig = pickEraFigureForMidDate(figures, mid);
    expect(fig).toBeTruthy();
    expect(fig.label).toBe('Sojourner Truth');
  });

  test('all president terms have parseable start before end', () => {
    for (const t of terms) {
      const a = Date.parse(t.start);
      const b = Date.parse(t.end);
      expect(a).toBeLessThan(b);
    }
  });

  test('US_PRESIDENCY_START matches first president term', () => {
    const washington = terms.find((x) => x.name === 'George Washington');
    expect(washington.start).toBe(US_PRESIDENCY_START);
  });
});
