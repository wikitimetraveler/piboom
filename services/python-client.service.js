/**
 * Python Service Client
 * 
 * @file       python-client.service.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2026
 * 
 * @description
 * Client service for calling the Python task worker service.
 * Provides a bridge between Node.js and Python for tasks that
 * are better suited for Python (data processing, ML, analytics, etc.)
 * 
 * Features:
 * - HTTP client for Python service API calls
 * - Error handling and fallback logic
 * - Optional service availability checking
 * - Consistent response formatting
 * 
 * @dependencies
 * - axios for HTTP requests
 * 
 * ==============================================================================
 */

import axios from 'axios';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PYTHON_SERVICE_TIMEOUT = parseInt(process.env.PYTHON_SERVICE_TIMEOUT || '30000', 10);

/**
 * Python service client
 */
class PythonServiceClient {
  constructor() {
    this.baseURL = PYTHON_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: PYTHON_SERVICE_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if Python service is available
   */
  async isAvailable() {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data.status === 'healthy' || response.data.status === 'degraded';
    } catch (error) {
      console.warn('Python service not available:', error.message);
      return false;
    }
  }

  /**
   * Get recent disasters from Python service
   */
  async getRecentDisasters({ days, state, eventType } = {}) {
    try {
      const params = {};
      if (days) params.days = days;
      if (state) params.state = state;
      if (eventType) params.event_type = eventType;

      const response = await this.client.get('/api/disasters/recent', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch recent disasters from Python service:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Get disasters by county FIPS code
   */
  async getDisastersByCounty(countyFips, days = null) {
    try {
      const params = {};
      if (days) params.days = days;

      const response = await this.client.get(`/api/disasters/county/${countyFips}`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch county disasters from Python service:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Get disasters near a location
   */
  async getDisastersNear({ lat, lng, radius = 50, days = null } = {}) {
    try {
      const params = { lat, lng, radius };
      if (days) params.days = days;

      const response = await this.client.get('/api/disasters/near', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch nearby disasters from Python service:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Get disaster statistics
   */
  async getDisasterStats(days = null) {
    try {
      const params = {};
      if (days) params.days = days;

      const response = await this.client.get('/api/disasters/stats', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch disaster stats from Python service:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Get disasters grouped by type
   */
  async getDisastersByType(days = null) {
    try {
      const params = {};
      if (days) params.days = days;

      const response = await this.client.get('/api/disasters/by-type', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch disasters by type from Python service:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Generic GET request to Python service
   */
  async get(endpoint, params = {}) {
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      console.error(`Python service GET ${endpoint} failed:`, error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  /**
   * Generic POST request to Python service
   */
  async post(endpoint, data = {}) {
    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`Python service POST ${endpoint} failed:`, error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  // Encompass methods
  async getKnowledgeSummary() {
    return this.get('/api/encompass/knowledge-summary');
  }

  async searchICEKnowledge(query, { limit = 10, sourceType = null } = {}) {
    const params = { query, limit };
    if (sourceType) params.source_type = sourceType;
    return this.get('/api/encompass/search-ice', params);
  }

  async searchEncompassDocs(query, { limit = 10, category = null } = {}) {
    const params = { query, limit };
    if (category) params.category = category;
    return this.get('/api/encompass/search-docs', params);
  }

  async getFieldInfo(fieldId) {
    return this.get(`/api/encompass/field/${fieldId}`);
  }

  // RAG methods
  async semanticSearchICE(queryEmbedding, { limit = 10, similarityThreshold = 0.7 } = {}) {
    try {
      const response = await this.client.post('/api/rag/semantic-search-ice', queryEmbedding, {
        params: { limit, similarity_threshold: similarityThreshold }
      });
      return response.data;
    } catch (error) {
      console.error('Failed semantic search on ICE:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async semanticSearchDocs(queryEmbedding, { limit = 10, similarityThreshold = 0.7, category = null } = {}) {
    try {
      const params = { limit, similarity_threshold: similarityThreshold };
      if (category) params.category = category;
      const response = await this.client.post('/api/rag/semantic-search-docs', queryEmbedding, { params });
      return response.data;
    } catch (error) {
      console.error('Failed semantic search on docs:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async hybridSearch(query, { queryEmbedding = null, limit = 10, keywordWeight = 0.3, vectorWeight = 0.7 } = {}) {
    try {
      const response = await this.client.post('/api/rag/hybrid-search', {
        query,
        query_embedding: queryEmbedding,
        limit,
        keyword_weight: keywordWeight,
        vector_weight: vectorWeight
      });
      return response.data;
    } catch (error) {
      console.error('Failed hybrid search:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async prepareRAGContext(searchResults, maxTokens = 3000) {
    try {
      const response = await this.client.post('/api/rag/prepare-context', {
        search_results: searchResults,
        max_tokens: maxTokens
      });
      return response.data;
    } catch (error) {
      console.error('Failed to prepare RAG context:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async getSimilarDocuments(docId, { table = 'ice_knowledge_chunks', limit = 10 } = {}) {
    return this.get(`/api/rag/similar-documents/${docId}`, { table, limit });
  }

  // Text processing methods
  async cleanText(text) {
    try {
      const response = await this.client.post('/api/text/clean', { text });
      return response.data;
    } catch (error) {
      console.error('Failed to clean text:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async extractKeywords(text, { topN = 10, minLength = 3 } = {}) {
    try {
      const response = await this.client.post('/api/text/keywords', { text }, {
        params: { top_n: topN, min_length: minLength }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to extract keywords:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async extractFieldIds(text) {
    try {
      const response = await this.client.post('/api/text/extract-field-ids', { text });
      return response.data;
    } catch (error) {
      console.error('Failed to extract field IDs:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async extractApiEndpoints(text) {
    try {
      const response = await this.client.post('/api/text/extract-api-endpoints', { text });
      return response.data;
    } catch (error) {
      console.error('Failed to extract API endpoints:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async calculateReadability(text) {
    try {
      const response = await this.client.post('/api/text/readability', { text });
      return response.data;
    } catch (error) {
      console.error('Failed to calculate readability:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }

  async summarizeText(text, maxSentences = 3) {
    try {
      const response = await this.client.post('/api/text/summarize', { text }, {
        params: { max_sentences: maxSentences }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to summarize text:', error.message);
      throw new Error(`Python service error: ${error.message}`);
    }
  }
}

// Singleton instance
const pythonClient = new PythonServiceClient();

export default pythonClient;
