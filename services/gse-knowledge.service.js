/**
 * Development work by David Lane
 * GSE / mortgage knowledge: file JSON keyword search + optional Postgres pgvector RAG.
 */
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, isPgvectorAvailable, ensureGseKnowledgeTable } from './database.service.js';
import {
  embedQuery as embedQueryUtil,
  toVectorLiteral,
  DEFAULT_EMBEDDING_MODEL
} from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '..', 'data', 'knowledge', 'gse-sources.json');
const EMBEDDING_MODEL = process.env.GSE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

class GseKnowledgeService {
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
      console.error('❌ Failed to load GSE knowledge:', err.message);
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
          await ensureGseKnowledgeTable(pool);
          const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM gse_knowledge_chunks WHERE embedding IS NOT NULL`
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
      embeddingModel: EMBEDDING_MODEL,
      store: 'gse-sources.json',
      table: 'gse_knowledge_chunks'
    };
  }

  /**
   * Graphical knowledge-bank snapshot: category nodes + sample document nodes + edges.
   */
  async getGraph(limitPerCategory = 4) {
    const data = await this.loadKnowledge();
    const summary = await this.getSummary();
    const byCategory = new Map();

    for (const record of data.records) {
      const cat = record.category || record.sourceType || 'unknown';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(record);
    }

    const nodes = [];
    const links = [];
    const hubId = 'hub:gse';
    nodes.push({
      id: hubId,
      label: 'GSE knowledge',
      kind: 'hub',
      size: Math.max(18, Math.min(36, 12 + data.records.length)),
      meta: { total: data.records.length, vectors: summary.vectorCount }
    });

    for (const [category, rows] of byCategory) {
      const catId = `cat:${category}`;
      nodes.push({
        id: catId,
        label: category,
        kind: 'category',
        size: Math.max(12, Math.min(28, 8 + rows.length * 2)),
        meta: { count: rows.length }
      });
      links.push({ source: hubId, target: catId, kind: 'contains' });

      const sample = rows.slice(0, Math.max(1, limitPerCategory));
      sample.forEach((row, idx) => {
        const docId = `doc:${category}:${idx}:${String(row.id || row.title).slice(0, 40)}`;
        nodes.push({
          id: docId,
          label: String(row.title || 'Untitled').slice(0, 48),
          kind: 'document',
          size: 8,
          meta: {
            category,
            url: row.url || '',
            retrieval: 'index',
            excerpt: String(row.excerpt || row.content || '').slice(0, 160)
          }
        });
        links.push({ source: catId, target: docId, kind: 'indexes' });
      });
    }

    return {
      summary,
      nodes,
      links,
      generatedAt: new Date().toISOString()
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
          category: record.category || record.sourceType || 'gse',
          content: record.excerpt || record.content?.slice(0, 500) || '',
          url: record.url || '',
          sourceType: record.sourceType || 'gse_doc',
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
      console.warn('⚠️ GSE vector query embedding skipped:', err.message);
      return null;
    }
  }

  async searchVector(query, limit = 6) {
    const pool = getPool();
    if (!pool) return [];

    const ready = await isPgvectorAvailable();
    if (!ready) return [];

    await ensureGseKnowledgeTable(pool);

    const embedding = await this.embedQuery(query);
    if (!embedding) return [];

    const vectorLiteral = toVectorLiteral(embedding);
    try {
      const { rows } = await pool.query(
        `SELECT title, url, category, content, metadata,
                1 - (embedding <=> $1::vector) AS score
         FROM gse_knowledge_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, Math.max(1, limit)]
      );

      return rows.map((row) => ({
        title: row.title,
        category: row.category || 'gse',
        content: (row.content || '').slice(0, 850),
        url: row.url || '',
        sourceType: row.metadata?.sourceType || 'gse_doc',
        score: Number(row.score) || 0,
        retrieval: 'vector'
      }));
    } catch (err) {
      console.warn('⚠️ GSE vector search failed:', err.message);
      return [];
    }
  }

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

const gseKnowledgeService = new GseKnowledgeService();
export default gseKnowledgeService;
