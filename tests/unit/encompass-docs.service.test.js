/**
 * Development work by David Lane
 *
 * Unit tests for the Encompass Developer Connect docs RAG store service.
 */
import { jest } from '@jest/globals';
import encompassDocsService from '../../services/encompass-docs.service.js';

describe('encompass-docs.service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('escapeRegex', () => {
    test('escapes regex metacharacters', () => {
      expect(encompassDocsService.escapeRegex('a.b*c+d?')).toBe('a\\.b\\*c\\+d\\?');
      expect(encompassDocsService.escapeRegex('(group)[set]{n}')).toBe('\\(group\\)\\[set\\]\\{n\\}');
    });

    test('tolerates null/undefined', () => {
      expect(encompassDocsService.escapeRegex(null)).toBe('');
      expect(encompassDocsService.escapeRegex(undefined)).toBe('');
    });
  });

  describe('normalizeContent', () => {
    test('returns strings unchanged', () => {
      expect(encompassDocsService.normalizeContent('hello world')).toBe('hello world');
    });

    test('unwraps legacy nested scrape-result objects', () => {
      const legacy = { title: 'X', url: 'u', content: 'real text', scrapedAt: 'now' };
      expect(encompassDocsService.normalizeContent(legacy)).toBe('real text');
    });

    test('unwraps doubly-nested content objects', () => {
      const doubled = { content: { content: 'deep text' } };
      expect(encompassDocsService.normalizeContent(doubled)).toBe('deep text');
    });

    test('coerces null/number to safe strings', () => {
      expect(encompassDocsService.normalizeContent(null)).toBe('');
      expect(encompassDocsService.normalizeContent(42)).toBe('42');
    });
  });

  describe('mergeSections', () => {
    test('new sections win and unmatched existing are retained', () => {
      const existing = [
        { title: 'Welcome', category: 'overview', content: 'old welcome' },
        { title: 'API Keys', category: 'authentication', content: 'old keys' },
      ];
      const fresh = [
        { title: 'Welcome', category: 'overview', content: 'new welcome' },
      ];

      const merged = encompassDocsService.mergeSections(existing, fresh);
      const byTitle = Object.fromEntries(merged.map((s) => [s.title, s.content]));

      expect(merged).toHaveLength(2);
      expect(byTitle.Welcome).toBe('new welcome');
      expect(byTitle['API Keys']).toBe('old keys');
    });

    test('matching is case-insensitive on title + category', () => {
      const existing = [{ title: 'Welcome', category: 'Overview', content: 'old' }];
      const fresh = [{ title: 'welcome', category: 'overview', content: 'new' }];

      const merged = encompassDocsService.mergeSections(existing, fresh);
      expect(merged).toHaveLength(1);
      expect(merged[0].content).toBe('new');
    });
  });

  describe('searchDocs', () => {
    const mockStore = {
      lastUpdated: '2026-07-18T00:00:00.000Z',
      sections: [
        { title: 'Authorization', category: 'authentication', url: 'a', content: 'OAuth token authorization bearer flow' },
        { title: 'Documents', category: 'use-cases', url: 'd', content: 'eFolder document upload and retrieval' },
      ],
    };

    test('ranks title/content matches and returns string content', async () => {
      jest.spyOn(encompassDocsService, 'loadDocs').mockResolvedValue(mockStore);

      const results = await encompassDocsService.searchDocs('authorization token', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Authorization');
      expect(typeof results[0].content).toBe('string');
      expect(results[0].score).toBeGreaterThan(0);
    });

    test('does not throw on regex-special query (escapeRegex)', async () => {
      jest.spyOn(encompassDocsService, 'loadDocs').mockResolvedValue(mockStore);

      const results = await encompassDocsService.searchDocs('c++ (token) [scope]', 5);
      expect(Array.isArray(results)).toBe(true);
    });

    test('normalizes legacy nested content without throwing', async () => {
      jest.spyOn(encompassDocsService, 'loadDocs').mockResolvedValue({
        lastUpdated: 'x',
        sections: [
          { title: 'Legacy', category: 'guides', content: { content: 'nested authorization text' } },
        ],
      });

      const results = await encompassDocsService.searchDocs('authorization', 5);
      expect(results).toHaveLength(1);
      expect(typeof results[0].content).toBe('string');
    });

    test('returns [] when store is empty', async () => {
      jest.spyOn(encompassDocsService, 'loadDocs').mockResolvedValue(null);
      const results = await encompassDocsService.searchDocs('anything', 5);
      expect(results).toEqual([]);
    });
  });
});
