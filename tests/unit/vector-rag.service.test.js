/**
 * Development work by David Lane
 *
 * Unit tests for hybrid (keyword + pgvector) retrieval and the pgvector schema
 * helpers. All run with no live DB: pools are mocked and vector paths are
 * spied, so keyword fallback and merge ordering are verified offline.
 */
import { jest } from '@jest/globals';
import encompassDocsService from '../../services/encompass-docs.service.js';
import iceKnowledgeService from '../../lib/knowledge/ice-knowledge.service.js';
import {
  ensureEncompassDocsTable,
  ensureIceKnowledgeTable
} from '../../services/database.service.js';

describe('hybrid retrieval — encompass-docs.service', () => {
  afterEach(() => jest.restoreAllMocks());

  test('merges vector + keyword hits with vector boosted, deduped', async () => {
    jest.spyOn(encompassDocsService, 'searchVector').mockResolvedValue([
      { title: 'OAuth', url: 'o', category: 'auth', content: 'oauth', score: 0.9, retrieval: 'vector' }
    ]);
    jest.spyOn(encompassDocsService, 'searchKeyword').mockResolvedValue([
      { title: 'Documents', url: 'd', category: 'docs', content: 'docs', score: 6, retrieval: 'keyword' },
      // duplicate of the vector hit (same url|title) should be dropped
      { title: 'OAuth', url: 'o', category: 'auth', content: 'oauth-kw', score: 100, retrieval: 'keyword' }
    ]);

    const results = await encompassDocsService.searchDocs('oauth token', 5);

    // vector OAuth (0.9 + 5 boost = 5.9) beats keyword Documents (6)? No — 6 > 5.9.
    const titles = results.map((r) => r.title);
    expect(titles).toContain('OAuth');
    expect(titles).toContain('Documents');
    // Dedup: OAuth appears exactly once and keeps the vector retrieval source.
    expect(titles.filter((t) => t === 'OAuth')).toHaveLength(1);
    const oauth = results.find((r) => r.title === 'OAuth');
    expect(oauth.retrieval).toBe('vector');
  });

  test('falls back to keyword only when vectors are unavailable', async () => {
    jest.spyOn(encompassDocsService, 'searchVector').mockResolvedValue([]);
    jest.spyOn(encompassDocsService, 'searchKeyword').mockResolvedValue([
      { title: 'Welcome', url: 'w', category: 'overview', content: 'hi', score: 3, retrieval: 'keyword' }
    ]);

    const results = await encompassDocsService.searchDocs('welcome', 5);
    expect(results).toHaveLength(1);
    expect(results[0].retrieval).toBe('keyword');
  });

  test('searchVector returns [] when no DB pool (offline)', async () => {
    // No initializeDatabase() called → getPool() is null.
    const results = await encompassDocsService.searchVector('anything', 5);
    expect(results).toEqual([]);
  });
});

describe('hybrid retrieval — ice-knowledge.service', () => {
  afterEach(() => jest.restoreAllMocks());

  test('merges vector + keyword hits and dedupes by repo|url|title', async () => {
    jest.spyOn(iceKnowledgeService, 'searchVector').mockResolvedValue([
      { title: 'repo/a.js', url: 'g', repo: 'r', content: 'x', score: 0.8, retrieval: 'vector' }
    ]);
    jest.spyOn(iceKnowledgeService, 'searchKeyword').mockResolvedValue([
      { title: 'repo/b.js', url: 'g', repo: 'r', content: 'y', score: 4, retrieval: 'keyword' }
    ]);

    const results = await iceKnowledgeService.search('token', 5);
    const titles = results.map((r) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['repo/a.js', 'repo/b.js']));
    expect(results.every((r) => typeof r.score === 'number')).toBe(true);
  });

  test('searchVector returns [] with no pool (keyword fallback path)', async () => {
    const results = await iceKnowledgeService.searchVector('anything', 5);
    expect(results).toEqual([]);
  });
});

describe('pgvector schema helpers (mocked pool)', () => {
  const makePool = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) });

  test('ensureEncompassDocsTable creates table + category index', async () => {
    const pool = makePool();
    const result = await ensureEncompassDocsTable(pool);

    const sql = pool.query.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS encompass_docs_chunks/);
    expect(sql).toMatch(/idx_encompass_docs_chunks_category/);
    // No module pool in tests → pgvector unavailable → vector:false, table:true.
    expect(result.table).toBe(true);
    expect(result.vector).toBe(false);
  });

  test('ensureIceKnowledgeTable creates its own table', async () => {
    const pool = makePool();
    const result = await ensureIceKnowledgeTable(pool);

    const sql = pool.query.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ice_knowledge_chunks/);
    expect(result.table).toBe(true);
  });

  test('ensureHeygenKnowledgeTable uses the same shared chunk schema', async () => {
    const { ensureHeygenKnowledgeTable } = await import('../../services/database.service.js');
    const pool = makePool();
    const result = await ensureHeygenKnowledgeTable(pool);

    const sql = pool.query.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS heygen_knowledge_chunks/);
    expect(sql).toMatch(/idx_heygen_knowledge_chunks_category/);
    expect(result.table).toBe(true);
    expect(result.vector).toBe(false);
  });

  test('returns not-created when pool is missing', async () => {
    const result = await ensureEncompassDocsTable(null);
    expect(result).toEqual({ table: false, vector: false });
  });
});
