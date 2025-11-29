import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

    return {
      lastIndexed: data.lastIndexed,
      totalRecords: data.records.length,
      counts
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

  async search(query, limit = 5) {
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
          score
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export default new IceKnowledgeService();

