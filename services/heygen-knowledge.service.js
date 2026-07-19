/**
 * Development work by David Lane
 * HeyGen API knowledge: file JSON keyword search + optional Postgres pgvector RAG.
 */
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, isPgvectorAvailable, ensureHeygenKnowledgeTable } from './database.service.js';
import {
  embedQuery as embedQueryUtil,
  toVectorLiteral,
  DEFAULT_EMBEDDING_MODEL
} from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '..', 'data', 'knowledge', 'heygen-sources.json');
const EMBEDDING_MODEL = process.env.HEYGEN_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

class HeygenKnowledgeService {
  constructor() {
    this.cache = null;
  }

  escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async loadKnowledge(force = false) {
    if (!force && this.cache) return this.cache;

    if (!fs.existsSync(DATA_PATH)) {
      this.cache = { lastIndexed: null, records: [], vectorReady: false };
      return this.cache;
    }

    try {
      const raw = await fsp.readFile(DATA_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      this.cache = {
        lastIndexed: parsed.lastIndexed || null,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        vectorReady: Boolean(parsed.vectorReady)
      };
      return this.cache;
    } catch (err) {
      console.error('❌ Failed to load HeyGen knowledge:', err.message);
      this.cache = { lastIndexed: null, records: [], vectorReady: false };
      return this.cache;
    }
  }

  async getSummary() {
    const data = await this.loadKnowledge();
    const pool = getPool();
    let vectorCount = 0;
    let vectorAvailable = false;
    if (pool) {
      try {
        vectorAvailable = await isPgvectorAvailable();
        if (vectorAvailable) {
          const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM heygen_knowledge_chunks WHERE embedding IS NOT NULL`
          );
          vectorCount = rows[0]?.n || 0;
        }
      } catch {
        /* ignore */
      }
    }

    const counts = data.records.reduce((acc, record) => {
      const type = record.category || record.sourceType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      lastIndexed: data.lastIndexed,
      totalRecords: data.records.length,
      counts,
      vectorAvailable,
      vectorCount,
      embeddingModel: EMBEDDING_MODEL
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

    const tokens = queryLower.split(/\s+/).filter((t) => t.length > 2);
    for (const token of tokens) {
      if (title.includes(token)) score += 3;
      if (content.includes(token)) score += 1;
    }

    const safeQuery = this.escapeRegex(queryLower);
    const occurrences = safeQuery
      ? (content.match(new RegExp(safeQuery, 'g')) || []).length
      : 0;
    score += Math.min(occurrences, 8);

    return score;
  }

  async searchKeyword(query, limit = 6) {
    const data = await this.loadKnowledge();
    if (!query || !data.records.length) return [];

    const queryLower = query.toLowerCase();
    const results = [];

    for (const record of data.records) {
      const score = this.calculateScore(record, queryLower);
      if (score > 0) {
        results.push({
          title: record.title,
          category: record.category || record.sourceType || 'heygen',
          content: record.excerpt || record.content?.slice(0, 500) || '',
          url: record.url || '',
          sourceType: record.sourceType || 'heygen_doc',
          score,
          retrieval: 'keyword'
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score || `${a.title}`.localeCompare(`${b.title}`))
      .slice(0, Math.max(1, limit));
  }

  async embedQuery(query) {
    try {
      return await embedQueryUtil(query, EMBEDDING_MODEL);
    } catch (err) {
      console.warn('⚠️ HeyGen vector query embedding skipped:', err.message);
      return null;
    }
  }

  async searchVector(query, limit = 6) {
    const pool = getPool();
    if (!pool) return [];

    const ready = await isPgvectorAvailable();
    if (!ready) return [];

    await ensureHeygenKnowledgeTable(pool);

    const embedding = await this.embedQuery(query);
    if (!embedding) return [];

    const vectorLiteral = toVectorLiteral(embedding);
    try {
      const { rows } = await pool.query(
        `SELECT title, url, category, content, metadata,
                1 - (embedding <=> $1::vector) AS score
         FROM heygen_knowledge_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, Math.max(1, limit)]
      );

      return rows.map((row) => ({
        title: row.title,
        category: row.category || 'heygen',
        content: (row.content || '').slice(0, 850),
        url: row.url || '',
        sourceType: row.metadata?.sourceType || 'heygen_doc',
        score: Number(row.score) || 0,
        retrieval: 'vector'
      }));
    } catch (err) {
      console.warn('⚠️ HeyGen vector search failed:', err.message);
      return [];
    }
  }

  /**
   * Hybrid search: prefer pgvector when available, merge with keyword fallback.
   */
  async search(query, limit = 6) {
    if (!query) return [];

    const [vectorHits, keywordHits] = await Promise.all([
      this.searchVector(query, limit),
      this.searchKeyword(query, limit)
    ]);

    const merged = [];
    const seen = new Set();
    const ingest = (item, boost = 0) => {
      const key = `${(item.url || '').toLowerCase()}|${(item.title || '').toLowerCase()}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push({
        ...item,
        score: (Number(item.score) || 0) + boost
      });
    };

    vectorHits.forEach((item) => ingest(item, 5));
    keywordHits.forEach((item) => ingest(item, 0));

    return merged
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, Math.max(1, limit));
  }
}

const heygenKnowledgeService = new HeygenKnowledgeService();
export default heygenKnowledgeService;
