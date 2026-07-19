/**
 * Development work by David Lane
 */
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, isPgvectorAvailable, ensureIceKnowledgeTable } from '../../services/database.service.js';
import { embedQuery as embedQueryUtil, DEFAULT_EMBEDDING_MODEL } from './embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IceKnowledgeService {
  constructor() {
    this.dataPath = path.join(__dirname, '..', '..', 'data', 'knowledge', 'ice-sources.json');
    this.cache = null;
    this.cacheKey = null;
  }

  escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async loadKnowledge(force = false) {
    if (!force && this.cache) {
      return this.cache;
    }

    if (!fs.existsSync(this.dataPath)) {
      this.cache = { lastIndexed: null, records: [] };
      return this.cache;
    }

    try {
      const raw = await fsp.readFile(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw);
      this.cache = {
        lastIndexed: parsed.lastIndexed || null,
        records: parsed.records || []
      };
      this.cacheKey = `${parsed.lastIndexed}|${parsed.records?.length ?? 0}`;
      return this.cache;
    } catch (err) {
      console.error('❌ Failed to load ICE knowledge base:', err.message);
      this.cache = { lastIndexed: null, records: [] };
      return this.cache;
    }
  }

  async getSummary() {
    const data = await this.loadKnowledge();
    const counts = data.records.reduce((acc, record) => {
      const type = record.sourceType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const pool = getPool();
    let vectorAvailable = false;
    let vectorCount = 0;
    if (pool) {
      try {
        vectorAvailable = await isPgvectorAvailable();
        if (vectorAvailable) {
          const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM ice_knowledge_chunks WHERE embedding IS NOT NULL`
          );
          vectorCount = rows[0]?.n || 0;
        }
      } catch {
        /* ignore */
      }
    }

    return {
      lastIndexed: data.lastIndexed,
      totalRecords: data.records.length,
      counts,
      vectorAvailable,
      vectorCount,
      embeddingModel: DEFAULT_EMBEDDING_MODEL
    };
  }

  calculateScore(record, queryLower) {
    let score = 0;
    const title = record.title?.toLowerCase() || '';
    const excerpt = record.excerpt?.toLowerCase() || '';
    const content = record.content?.toLowerCase() || '';
    const tags = Array.isArray(record.tags) ? record.tags.join(' ').toLowerCase() : '';

    if (title.includes(queryLower)) score += 10;
    if (excerpt.includes(queryLower)) score += 5;
    if (content.includes(queryLower)) score += 3;
    if (tags.includes(queryLower)) score += 2;

    const safeQuery = this.escapeRegex(queryLower);
    const occurrences = safeQuery
      ? (content.match(new RegExp(safeQuery, 'g')) || []).length
      : 0;
    score += occurrences;

    return score;
  }

  // Keyword search over the committed JSON index (always-on fallback)
  async searchKeyword(query, limit = 5) {
    if (!query) return [];
    const data = await this.loadKnowledge();
    if (!data.records.length) return [];

    const queryLower = query.toLowerCase();
    const results = [];

    for (const record of data.records) {
      const score = this.calculateScore(record, queryLower);
      if (score > 0) {
        results.push({
          title: record.title,
          category: record.category || record.sourceType || 'reference',
          content: record.excerpt || record.content?.slice(0, 400) || '',
          url: record.url || '',
          sourceType: record.sourceType,
          repo: record.repo,
          path: record.path,
          tags: record.tags || [],
          score,
          retrieval: 'keyword'
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Embed a query for vector search; null when no API key (silent fallback).
  async embedQuery(query) {
    try {
      return await embedQueryUtil(query, DEFAULT_EMBEDDING_MODEL);
    } catch (err) {
      console.warn('⚠️ ice-knowledge vector query embedding skipped:', err.message);
      return null;
    }
  }

  // Semantic search over Postgres pgvector; [] when DB/pgvector/key unavailable.
  async searchVector(query, limit = 5) {
    const pool = getPool();
    if (!pool || !query) return [];

    const ready = await isPgvectorAvailable();
    if (!ready) return [];

    try {
      await ensureIceKnowledgeTable(pool);
    } catch {
      return [];
    }

    const embedding = await this.embedQuery(query);
    if (!embedding) return [];

    const vectorLiteral = `[${embedding.join(',')}]`;
    try {
      const { rows } = await pool.query(
        `SELECT title, url, category, content, metadata,
                1 - (embedding <=> $1::vector) AS score
         FROM ice_knowledge_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, Math.max(1, limit)]
      );

      return rows.map((row) => ({
        title: row.title,
        category: row.category || row.metadata?.sourceType || 'reference',
        content: (row.content || '').slice(0, 400),
        url: row.url || '',
        sourceType: row.metadata?.sourceType,
        repo: row.metadata?.repo,
        path: row.metadata?.path,
        tags: row.metadata?.tags || [],
        score: Number(row.score) || 0,
        retrieval: 'vector'
      }));
    } catch (err) {
      console.warn('⚠️ ice-knowledge vector search failed:', err.message);
      return [];
    }
  }

  /**
   * Hybrid knowledge search: pgvector when available, merged with the always-on
   * keyword fallback. Signature is unchanged for existing callers.
   */
  async search(query, limit = 5) {
    if (!query) return [];

    const [vectorHits, keywordHits] = await Promise.all([
      this.searchVector(query, limit),
      this.searchKeyword(query, limit)
    ]);

    const merged = [];
    const seen = new Set();
    const ingest = (item, boost = 0) => {
      const key = `${(item.repo || '').toLowerCase()}|${(item.url || '').toLowerCase()}|${(item.title || '').toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ ...item, score: (Number(item.score) || 0) + boost });
    };

    vectorHits.forEach((item) => ingest(item, 5));
    keywordHits.forEach((item) => ingest(item, 0));

    return merged
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, Math.max(1, limit));
  }
}

export default new IceKnowledgeService();
