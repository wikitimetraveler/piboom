/**
 * Development work by David Lane
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, isPgvectorAvailable, ensureEncompassDocsTable } from './database.service.js';
import { embedQuery as embedQueryUtil, DEFAULT_EMBEDDING_MODEL } from '../lib/knowledge/embedding-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EncompassDocsService {
  constructor() {
    this.baseUrl = 'https://developer.icemortgagetechnology.com/developer-connect/docs';
    this.docsCache = new Map();
    this.docsPath = path.join(__dirname, '..', 'data', 'encompass-docs.json');
    // Polite delay between scrape requests to avoid Developer Connect rate limiting (429).
    this.scrapeDelayMs = Number(process.env.ENCOMPASS_DOCS_SCRAPE_DELAY_MS || 1200) || 1200;
  }

  delay(ms) {
    if (!ms || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  sectionKey(section) {
    return `${section?.category || ''}|${section?.title || ''}`.toLowerCase();
  }

  // Freshly scraped sections win; previously stored sections are retained
  // when the new scrape did not capture them (e.g. rate-limited requests).
  mergeSections(existingSections = [], newSections = []) {
    const byKey = new Map();
    for (const section of existingSections) {
      byKey.set(this.sectionKey(section), section);
    }
    for (const section of newSections) {
      byKey.set(this.sectionKey(section), section);
    }
    return Array.from(byKey.values());
  }

  tokenizeQuery(query) {
    const text = `${query ?? ''}`.toLowerCase();
    return text
      .split(/[^a-z0-9]+/i)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);
  }

  // Escape user/query text before building a RegExp
  escapeRegex(text) {
    return `${text ?? ''}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Coerce a section's content into a searchable string.
  // Tolerates legacy records where content was stored as the scrape result object.
  normalizeContent(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value.content === 'string') return value.content;
      if (value.content && typeof value.content === 'object') {
        return this.normalizeContent(value.content);
      }
    }
    return String(value);
  }

  // Scrape and cache Encompass documentation
  async scrapeDocumentation() {
    try {
      console.log('📚 Scraping Encompass Developer Connect documentation...');
      
      const docs = {
        lastUpdated: new Date().toISOString(),
        sections: []
      };

      // Main sections to scrape
      const sections = [
        { url: '/welcome', title: 'Welcome', category: 'overview' },
        { url: '/api-keys', title: 'API Keys', category: 'authentication' },
        { url: '/authorization', title: 'Authorization', category: 'authentication' },
        { url: '/user-management', title: 'User Management', category: 'authentication' },
        { url: '/use-case-matrix', title: 'Use Case Matrix', category: 'use-cases' },
        { url: '/loan-manufacturing', title: 'Loan Manufacturing', category: 'use-cases' },
        { url: '/loan-pipeline', title: 'Loan Pipeline', category: 'use-cases' },
        { url: '/product-and-pricing', title: 'Product and Pricing', category: 'use-cases' },
        { url: '/compliance', title: 'Compliance', category: 'use-cases' },
        { url: '/documents', title: 'Documents', category: 'use-cases' },
        { url: '/loan-data-extracts', title: 'Loan Data Extracts', category: 'use-cases' },
        { url: '/loan-folders', title: 'Loan Folders', category: 'use-cases' },
        { url: '/compliance-calendar-date-calculator-api', title: 'Compliance Calendar Date Calculator API', category: 'guides' },
        { url: '/encompass-sdk-to-api-migration', title: 'Encompass SDK to API Migration', category: 'guides' },
        { url: '/efc-webhook', title: 'EFC Webhook', category: 'guides' },
        { url: '/encompass-loan-data-dictionary', title: 'Encompass Loan Data Dictionary', category: 'guides' },
        { url: '/encompass-tpo-connect', title: 'Encompass TPO Connect', category: 'guides' },
        { url: '/encompass-customization', title: 'Encompass Customization', category: 'guides' },
        { url: '/ice-ppe-partner', title: 'ICE PPE Partner', category: 'guides' },
        { url: '/point-of-sale-integration', title: 'Point of Sale Integration', category: 'guides' },
        { url: '/send-encompass-docs', title: 'Send Encompass Docs', category: 'guides' },
        { url: '/working-with-enhanced-conditions', title: 'Working with Enhanced Conditions', category: 'guides' },
        { url: '/best-practices', title: 'Best Practices', category: 'resources' },
        { url: '/frequently-asked-questions', title: 'Frequently Asked Questions', category: 'resources' },
        { url: '/knowledge-articles', title: 'Knowledge Articles', category: 'resources' },
        { url: '/v3-for-cloud-storage', title: 'V3 for Cloud Storage', category: 'resources' },
        { url: '/postman-collection', title: 'Encompass Developer Connect Postman Collection', category: 'resources' },
        { url: '/postman-environments', title: 'Encompass 3-Environment Collection', category: 'resources' }
      ];

      let firstRequest = true;
      for (const section of sections) {
        try {
          if (!firstRequest) await this.delay(this.scrapeDelayMs);
          firstRequest = false;
          const scraped = await this.scrapeSection(section.url, section.title);
          const content = this.normalizeContent(scraped);
          if (content) {
            docs.sections.push({
              ...section,
              url: scraped?.url || `${this.baseUrl}${section.url}`,
              content,
              scrapedAt: scraped?.scrapedAt || new Date().toISOString(),
              wordCount: content.split(/\s+/).filter(Boolean).length
            });
            console.log(`✅ Scraped: ${section.title}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to scrape ${section.title}:`, error.message);
        }
      }

      // Merge with any existing store so a partial (rate-limited) scrape
      // augments rather than destroys previously captured sections.
      const existing = await this.loadDocs();
      const merged = {
        lastUpdated: docs.lastUpdated,
        sections: this.mergeSections(existing?.sections || [], docs.sections)
      };

      await this.saveDocs(merged);
      console.log(`📚 Scraped ${docs.sections.length} sections (store now has ${merged.sections.length})`);

      return merged;
    } catch (error) {
      console.error('❌ Error scraping Encompass documentation:', error);
      throw error;
    }
  }

  // Scrape individual section
  async scrapeSection(url, title) {
    try {
      const fullUrl = `${this.baseUrl}${url}`;
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Extract main content
      let content = '';
      
      // Try different selectors for content
      const contentSelectors = [
        'main',
        '.content',
        '.documentation',
        '.markdown-body',
        'article',
        '.page-content'
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          break;
        }
      }

      // If no main content found, get body text
      if (!content) {
        content = $('body').text().trim();
      }

      // Clean up content
      content = content
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
        .trim();

      return {
        title,
        url: fullUrl,
        content,
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error scraping ${title}:`, error.message);
      return null;
    }
  }

  // Save documentation to file
  async saveDocs(docs) {
    try {
      const dir = path.dirname(this.docsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.docsPath, JSON.stringify(docs, null, 2));
      console.log(`💾 Saved documentation to ${this.docsPath}`);
    } catch (error) {
      console.error('Error saving documentation:', error);
    }
  }

  // Load documentation from cache
  async loadDocs() {
    try {
      if (fs.existsSync(this.docsPath)) {
        const data = fs.readFileSync(this.docsPath, 'utf8');
        const docs = JSON.parse(data);
        if (docs && Array.isArray(docs.sections)) {
          docs.sections = docs.sections.map((section) => ({
            ...section,
            content: this.normalizeContent(section.content)
          }));
        }
        console.log(`📚 Loaded ${docs?.sections?.length || 0} documentation sections from cache`);
        return docs;
      }
      return null;
    } catch (error) {
      console.error('Error loading documentation:', error);
      return null;
    }
  }

  // Keyword search over the committed JSON store (always-on fallback)
  async searchKeyword(query, limit = 5) {
    try {
      const docs = await this.loadDocs();
      if (!docs || !docs.sections) {
        return [];
      }

      const results = [];
      const queryLower = `${query ?? ''}`.toLowerCase();
      const tokens = this.tokenizeQuery(query);

      for (const section of docs.sections) {
        const content = this.normalizeContent(section.content);
        const title = section.title || '';
        const titleLower = title.toLowerCase();
        const contentLower = content.toLowerCase();
        
        const titleMatch = queryLower && titleLower.includes(queryLower);
        const contentMatch = queryLower && contentLower.includes(queryLower);

        let tokenHits = 0;
        let tokenScore = 0;
        for (const token of tokens) {
          const safeToken = this.escapeRegex(token);
          const inTitle = titleLower.includes(token);
          const contentOccurrences = safeToken
            ? (contentLower.match(new RegExp(safeToken, 'g')) || []).length
            : 0;
          if (inTitle) {
            tokenHits += 1;
            tokenScore += 4;
          }
          if (contentOccurrences > 0) {
            tokenHits += 1;
            tokenScore += Math.min(8, contentOccurrences);
          }
        }
        
        if (titleMatch || contentMatch || tokenHits > 0) {
          // Calculate relevance score
          let score = 0;
          if (titleMatch) score += 10;
          if (contentMatch) score += 5;
          score += tokenScore;
          
          // Count occurrences
          const safeQuery = this.escapeRegex(queryLower);
          const titleOccurrences = safeQuery ? (titleLower.match(new RegExp(safeQuery, 'g')) || []).length : 0;
          const contentOccurrences = safeQuery ? (contentLower.match(new RegExp(safeQuery, 'g')) || []).length : 0;
          
          score += titleOccurrences * 3;
          score += contentOccurrences;

          results.push({
            ...section,
            content,
            sourceType: section.sourceType || 'official_doc',
            score,
            tokenHits,
            relevance: score > 15 ? 'high' : score > 5 ? 'medium' : 'low',
            retrieval: 'keyword'
          });
        }
      }

      // Sort by score and return top results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching documentation:', error);
      return [];
    }
  }

  // Embed a query for vector search; null when no API key (silent fallback).
  async embedQuery(query) {
    try {
      return await embedQueryUtil(query, DEFAULT_EMBEDDING_MODEL);
    } catch (err) {
      console.warn('⚠️ encompass-docs vector query embedding skipped:', err.message);
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
      await ensureEncompassDocsTable(pool);
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
         FROM encompass_docs_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, Math.max(1, limit)]
      );

      return rows.map((row) => ({
        title: row.title,
        category: row.category || 'reference',
        content: (row.content || '').slice(0, 850),
        url: row.url || '',
        sourceType: row.metadata?.sourceType || 'official_doc',
        score: Number(row.score) || 0,
        retrieval: 'vector'
      }));
    } catch (err) {
      console.warn('⚠️ encompass-docs vector search failed:', err.message);
      return [];
    }
  }

  /**
   * Hybrid documentation search: pgvector when available, merged with the
   * always-on keyword fallback. Signature is unchanged for existing callers.
   */
  async searchDocs(query, limit = 5) {
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
      merged.push({ ...item, score: (Number(item.score) || 0) + boost });
    };

    vectorHits.forEach((item) => ingest(item, 5));
    keywordHits.forEach((item) => ingest(item, 0));

    return merged
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, Math.max(1, limit));
  }

  // Get documentation summary
  async getDocsSummary() {
    try {
      const docs = await this.loadDocs();
      if (!docs) {
        return 'No documentation available. Run scrapeDocumentation() first.';
      }

      const categories = {};
      docs.sections.forEach(section => {
        const category = section.category || 'other';
        if (!categories[category]) {
          categories[category] = 0;
        }
        categories[category]++;
      });

      const pool = getPool();
      let vectorAvailable = false;
      let vectorCount = 0;
      if (pool) {
        try {
          vectorAvailable = await isPgvectorAvailable();
          if (vectorAvailable) {
            const { rows } = await pool.query(
              `SELECT COUNT(*)::int AS n FROM encompass_docs_chunks WHERE embedding IS NOT NULL`
            );
            vectorCount = rows[0]?.n || 0;
          }
        } catch {
          /* ignore */
        }
      }

      return {
        totalSections: docs.sections.length,
        lastUpdated: docs.lastUpdated,
        categories,
        totalWords: docs.sections.reduce((sum, section) => sum + (section.wordCount || 0), 0),
        vectorAvailable,
        vectorCount,
        embeddingModel: DEFAULT_EMBEDDING_MODEL
      };
    } catch (error) {
      console.error('Error getting documentation summary:', error);
      return null;
    }
  }
}

export default new EncompassDocsService();
