/**
 * Development work by David Lane
 *
 * Unit tests for shared knowledge embedding helpers (chunking, hashing,
 * vector literal, and no-key embedQuery fallback).
 */
import { jest } from '@jest/globals';
import {
  chunkText,
  hashContent,
  toVectorLiteral,
  embedQuery,
  DEFAULT_EMBEDDING_MODEL
} from '../../lib/knowledge/embedding-utils.js';

describe('embedding-utils', () => {
  describe('chunkText', () => {
    test('returns [] for empty/blank input', () => {
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   \n  ')).toEqual([]);
      expect(chunkText(null)).toEqual([]);
    });

    test('returns a single chunk when under size', () => {
      expect(chunkText('short text', 1200)).toEqual(['short text']);
    });

    test('splits long text into overlapping chunks that cover the content', () => {
      const text = 'abcdefghij'.repeat(30); // 300 chars
      const chunks = chunkText(text, 100, 20);
      expect(chunks.length).toBeGreaterThan(1);
      // Overlap: each chunk (except last) is exactly `size`.
      expect(chunks[0]).toHaveLength(100);
      // Reassembling accounting for overlap reproduces the original length window.
      expect(chunks.join('').length).toBeGreaterThanOrEqual(text.length);
    });
  });

  describe('hashContent', () => {
    test('is deterministic and 32 hex chars', () => {
      const h1 = hashContent('hello');
      const h2 = hashContent('hello');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{32}$/);
    });

    test('changes when content changes', () => {
      expect(hashContent('a')).not.toBe(hashContent('b'));
    });
  });

  describe('toVectorLiteral', () => {
    test('formats a numeric array as a pgvector literal', () => {
      expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
    });
  });

  describe('embedQuery', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    afterEach(() => {
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
      jest.restoreAllMocks();
    });

    test('returns null with no API key (silent keyword fallback)', async () => {
      delete process.env.OPENAI_API_KEY;
      const fetchSpy = jest.spyOn(global, 'fetch');
      const result = await embedQuery('anything');
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('returns null for empty query even with a key', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const fetchSpy = jest.spyOn(global, 'fetch');
      const result = await embedQuery('');
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  test('exposes the default embedding model', () => {
    expect(typeof DEFAULT_EMBEDDING_MODEL).toBe('string');
    expect(DEFAULT_EMBEDDING_MODEL.length).toBeGreaterThan(0);
  });
});
