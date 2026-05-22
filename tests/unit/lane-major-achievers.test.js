/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const achieversPath = join(root, 'data/lane-major-achievers.json');
const issue02Path = join(root, 'data/lane-magazine-issue-02.json');

describe('lane-major-achievers.json', () => {
  let doc;

  beforeAll(() => {
    doc = JSON.parse(readFileSync(achieversPath, 'utf8'));
  });

  test('parses and documents 22 achievers', () => {
    expect(doc.version).toBe(1);
    expect(Array.isArray(doc.achievers)).toBe(true);
    expect(doc.achievers.length).toBe(22);
    expect(doc.stats.totalAchievers).toBe(22);
  });

  test('each achiever has required fields', () => {
    const slugs = new Set();
    doc.achievers.forEach((entry) => {
      expect(entry.slug).toEqual(expect.any(String));
      expect(entry.slug.length).toBeGreaterThan(0);
      expect(slugs.has(entry.slug)).toBe(false);
      slugs.add(entry.slug);
      expect(['A', 'B', 'C']).toContain(entry.tier);
      expect(entry.displayName).toEqual(expect.any(String));
      expect(entry.achievementSummary).toEqual(expect.any(String));
      expect(entry.achievementSummary.length).toBeGreaterThan(10);
    });
  });

  test('tier counts match stats', () => {
    const tierA = doc.achievers.filter((a) => a.tier === 'A').length;
    const tierB = doc.achievers.filter((a) => a.tier === 'B').length;
    const tierC = doc.achievers.filter((a) => a.tier === 'C').length;
    expect(doc.stats.tierA).toBe(tierA);
    expect(doc.stats.tierB).toBe(tierB);
    expect(doc.stats.tierC).toBe(tierC);
  });
});

describe('lane-magazine-issue-02.json', () => {
  test('loads achievers-themed issue with spreads', () => {
    const issue = JSON.parse(readFileSync(issue02Path, 'utf8'));
    expect(issue.issueId).toBe('lane-magazine-issue-02');
    expect(Array.isArray(issue.spreads)).toBe(true);
    expect(issue.spreads.length).toBeGreaterThanOrEqual(8);
    expect(issue.spreads.some((s) => s.id === 'achievers-index')).toBe(true);
  });
});
