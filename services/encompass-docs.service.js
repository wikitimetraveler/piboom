import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EncompassDocsService {
  constructor() {
    this.baseUrl = 'https://developer.icemortgagetechnology.com/developer-connect/docs';
    this.docsCache = new Map();
    this.docsPath = path.join(__dirname, '..', 'data', 'encompass-docs.json');
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

      for (const section of sections) {
        try {
          const content = await this.scrapeSection(section.url, section.title);
          if (content) {
            docs.sections.push({
              ...section,
              content,
              wordCount: content.split(' ').length
            });
            console.log(`✅ Scraped: ${section.title}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to scrape ${section.title}:`, error.message);
        }
      }

      // Save to cache
      await this.saveDocs(docs);
      console.log(`📚 Scraped ${docs.sections.length} documentation sections`);
      
      return docs;
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
        console.log(`📚 Loaded ${docs.sections.length} documentation sections from cache`);
        return docs;
      }
      return null;
    } catch (error) {
      console.error('Error loading documentation:', error);
      return null;
    }
  }

  // Search documentation
  async searchDocs(query, limit = 5) {
    try {
      const docs = await this.loadDocs();
      if (!docs || !docs.sections) {
        return [];
      }

      const results = [];
      const queryLower = query.toLowerCase();

      for (const section of docs.sections) {
        const content = section.content || '';
        const title = section.title || '';
        
        // Simple text matching (can be enhanced with fuzzy search)
        const titleMatch = title.toLowerCase().includes(queryLower);
        const contentMatch = content.toLowerCase().includes(queryLower);
        
        if (titleMatch || contentMatch) {
          // Calculate relevance score
          let score = 0;
          if (titleMatch) score += 10;
          if (contentMatch) score += 5;
          
          // Count occurrences
          const titleOccurrences = (title.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
          const contentOccurrences = (content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
          
          score += titleOccurrences * 3;
          score += contentOccurrences;

          results.push({
            ...section,
            score,
            relevance: score > 15 ? 'high' : score > 5 ? 'medium' : 'low'
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

      return {
        totalSections: docs.sections.length,
        lastUpdated: docs.lastUpdated,
        categories,
        totalWords: docs.sections.reduce((sum, section) => sum + (section.wordCount || 0), 0)
      };
    } catch (error) {
      console.error('Error getting documentation summary:', error);
      return null;
    }
  }
}

export default new EncompassDocsService();
