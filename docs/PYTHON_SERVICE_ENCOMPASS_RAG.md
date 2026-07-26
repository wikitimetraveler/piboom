# Python Service - Encompass & RAG Operations

## Overview

The Python service provides advanced data processing capabilities for Encompass loan data retrieval and RAG (Retrieval Augmented Generation) operations. These endpoints complement the Node.js server with Python's strengths in data science, NLP, and vector operations.

## Why Python for RAG?

Python excels at:
- **Vector operations**: NumPy/SciPy for efficient embedding calculations
- **Text processing**: Advanced NLP with regex, tokenization, and analysis
- **Semantic search**: Efficient similarity calculations and ranking
- **Data processing**: Pandas for bulk operations on knowledge bases
- **Machine learning**: Easy integration with ML libraries

## Services Overview

### 1. EncompassService
Handles Encompass knowledge base operations:
- ICE knowledge summary and search
- Encompass documentation search
- Loan field information retrieval

### 2. RAGService
Core RAG operations:
- Semantic search with vector embeddings
- Hybrid search (keyword + semantic)
- Context preparation for LLM prompts
- Document similarity analysis
- Text chunking and hashing

### 3. TextProcessingService
Advanced text analysis:
- Text cleaning and normalization
- Keyword extraction
- Field ID extraction
- API endpoint extraction
- Readability metrics
- Extractive summarization

## API Endpoints

### Encompass Knowledge Base

#### Get Knowledge Summary
```bash
GET /api/encompass/knowledge-summary
```

Returns summary of ICE knowledge base and Encompass docs:
```json
{
  "success": true,
  "summary": {
    "vector_available": true,
    "vector_count": 1234,
    "encompass_docs_count": 456
  }
}
```

#### Search ICE Knowledge
```bash
GET /api/encompass/search-ice?query=loan%20application&limit=10
```

Keyword search on ICE knowledge base:
```json
{
  "success": true,
  "count": 5,
  "results": [
    {
      "id": 123,
      "source_type": "repo",
      "title": "Loan Application Form",
      "excerpt": "...",
      "url": "...",
      "rank": 0.842
    }
  ]
}
```

#### Search Encompass Docs
```bash
GET /api/encompass/search-docs?query=OAuth&category=authentication
```

Search Encompass Developer Connect documentation:
```json
{
  "success": true,
  "count": 3,
  "results": [
    {
      "id": 45,
      "category": "authentication",
      "title": "OAuth 2.0 Guide",
      "url": "https://...",
      "rank": 0.923
    }
  ]
}
```

#### Get Field Information
```bash
GET /api/encompass/field/4000
```

Get information about a specific Encompass field:
```json
{
  "success": true,
  "field_info": {
    "field_id": "4000",
    "references": [
      {
        "title": "Custom Field Documentation",
        "excerpt": "Field 4000 is used for...",
        "url": "..."
      }
    ]
  }
}
```

### RAG Operations

#### Semantic Search on ICE Knowledge
```bash
POST /api/rag/semantic-search-ice?limit=10&similarity_threshold=0.7
Content-Type: application/json

[0.123, 0.456, ...] # 1536-dimension embedding vector
```

Performs vector similarity search:
```json
{
  "success": true,
  "count": 5,
  "results": [
    {
      "id": 789,
      "title": "Loan Processing Guide",
      "similarity": 0.891,
      "excerpt": "..."
    }
  ]
}
```

#### Semantic Search on Encompass Docs
```bash
POST /api/rag/semantic-search-docs?limit=10&category=guides
Content-Type: application/json

[0.123, 0.456, ...] # 1536-dimension embedding vector
```

Vector search on documentation:
```json
{
  "success": true,
  "count": 4,
  "results": [
    {
      "id": 234,
      "category": "guides",
      "title": "API Best Practices",
      "similarity": 0.867,
      "url": "..."
    }
  ]
}
```

#### Hybrid Search
```bash
POST /api/rag/hybrid-search
Content-Type: application/json

{
  "query": "custom fields validation",
  "query_embedding": [0.123, 0.456, ...],  # optional
  "limit": 10,
  "keyword_weight": 0.3,
  "vector_weight": 0.7
}
```

Combines keyword and semantic search with weighted scoring:
```json
{
  "success": true,
  "count": 8,
  "results": [
    {
      "id": 345,
      "title": "Custom Field Validation",
      "keyword_score": 0.456,
      "vector_score": 0.823,
      "combined_score": 0.713,
      "excerpt": "..."
    }
  ]
}
```

#### Prepare RAG Context
```bash
POST /api/rag/prepare-context?max_tokens=3000
Content-Type: application/json

{
  "search_results": [
    {
      "title": "Document 1",
      "content": "...",
      "url": "..."
    }
  ]
}
```

Prepares context string for LLM prompts:
```json
{
  "success": true,
  "context": "\n\nSource 1: Document 1 (https://...)\nContent here...",
  "sources_used": 5,
  "sources": [...]
}
```

#### Find Similar Documents
```bash
GET /api/rag/similar-documents/123?table=ice_knowledge_chunks&limit=10
```

Find documents similar to a reference document:
```json
{
  "success": true,
  "count": 7,
  "results": [
    {
      "id": 456,
      "title": "Related Document",
      "similarity": 0.845
    }
  ]
}
```

### Text Processing

#### Clean Text
```bash
POST /api/text/clean
Content-Type: application/json

{
  "text": "  Extra   spaces and\n\nweird\t\tformatting  "
}
```

Returns cleaned text:
```json
{
  "success": true,
  "cleaned_text": "Extra spaces and weird formatting"
}
```

#### Extract Keywords
```bash
POST /api/text/keywords?top_n=10&min_length=3
Content-Type: application/json

{
  "text": "The Encompass API provides loan data access..."
}
```

Extracts frequent keywords:
```json
{
  "success": true,
  "keywords": [
    {"keyword": "encompass", "frequency": 5},
    {"keyword": "loan", "frequency": 4},
    {"keyword": "data", "frequency": 3}
  ]
}
```

#### Extract Field IDs
```bash
POST /api/text/extract-field-ids
Content-Type: application/json

{
  "text": "Use Fields.4000 and Loan.LoanAmount with URLA.X75"
}
```

Extracts Encompass field identifiers:
```json
{
  "success": true,
  "field_ids": ["4000", "Loan.LoanAmount", "URLA.X75"],
  "count": 3
}
```

#### Extract API Endpoints
```bash
POST /api/text/extract-api-endpoints
Content-Type: application/json

{
  "text": "Use /encompass/v1/loans and /api/pipeline endpoints"
}
```

Extracts API endpoints:
```json
{
  "success": true,
  "endpoints": ["/encompass/v1/loans", "/api/pipeline"],
  "count": 2
}
```

#### Calculate Readability
```bash
POST /api/text/readability
Content-Type: application/json

{
  "text": "This is sample text. It has multiple sentences..."
}
```

Returns readability metrics:
```json
{
  "success": true,
  "metrics": {
    "sentences": 12,
    "words": 145,
    "syllables": 234,
    "avg_words_per_sentence": 12.08,
    "avg_syllables_per_word": 1.61
  }
}
```

#### Summarize Text
```bash
POST /api/text/summarize?max_sentences=3
Content-Type: application/json

{
  "text": "Long document text here..."
}
```

Creates extractive summary:
```json
{
  "success": true,
  "summary": "First key sentence. Second key sentence. Third key sentence."
}
```

## Integration Examples

### Node.js Integration

```javascript
import pythonClient from './services/python-client.service.js';

// Search ICE knowledge
const results = await pythonClient.searchICEKnowledge('loan validation', {
  limit: 10
});

// Get field information
const fieldInfo = await pythonClient.getFieldInfo('4000');

// Extract field IDs from text
const fieldIds = await pythonClient.extractFieldIds(documentText);

// Prepare RAG context
const context = await pythonClient.prepareRAGContext(searchResults, 3000);
```

### Direct HTTP Calls

```javascript
const axios = require('axios');

// Search Encompass docs
const response = await axios.get('http://localhost:8000/api/encompass/search-docs', {
  params: {
    query: 'OAuth authentication',
    limit: 5,
    category: 'authentication'
  }
});

const docs = response.data.results;
```

### With OpenAI Embeddings

```javascript
import OpenAI from 'openai';
import pythonClient from './services/python-client.service.js';

const openai = new OpenAI();

// Generate query embedding
const embeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'How do I validate custom fields?'
});

const queryEmbedding = embeddingResponse.data[0].embedding;

// Semantic search
const results = await pythonClient.semanticSearchICE(queryEmbedding, {
  limit: 10,
  similarityThreshold: 0.7
});

// Prepare context for ChatGPT
const { context, sources } = await pythonClient.prepareRAGContext(
  results.results,
  3000
);

// Use in ChatGPT prompt
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `You are an Encompass API expert. Use this context: ${context}`
    },
    {
      role: 'user',
      content: 'How do I validate custom fields?'
    }
  ]
});
```

## Database Schema

The Python service expects these PostgreSQL tables:

### ice_knowledge_chunks
```sql
CREATE TABLE ice_knowledge_chunks (
  id SERIAL PRIMARY KEY,
  source_type TEXT,
  repo TEXT,
  path TEXT,
  title TEXT,
  excerpt TEXT,
  content TEXT,
  url TEXT,
  tags TEXT[],
  chunk_index INTEGER,
  content_hash CHAR(32),
  embedding vector(1536)
);

CREATE INDEX ON ice_knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON ice_knowledge_chunks USING gin(to_tsvector('english', content));
```

### encompass_docs_chunks
```sql
CREATE TABLE encompass_docs_chunks (
  id SERIAL PRIMARY KEY,
  category TEXT,
  title TEXT,
  url TEXT,
  content TEXT,
  chunk_index INTEGER,
  content_hash CHAR(32),
  embedding vector(1536)
);

CREATE INDEX ON encompass_docs_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON encompass_docs_chunks USING gin(to_tsvector('english', content));
```

## Performance Tips

### 1. Use Hybrid Search
Combine keyword and semantic search for best results:
```javascript
const results = await pythonClient.hybridSearch('custom fields', {
  queryEmbedding: embedding,
  keywordWeight: 0.3,
  vectorWeight: 0.7
});
```

### 2. Adjust Similarity Threshold
Lower threshold for more results, higher for precision:
```javascript
// More results (may include less relevant)
const broadResults = await pythonClient.semanticSearchICE(embedding, {
  similarityThreshold: 0.5
});

// Fewer, more relevant results
const preciseResults = await pythonClient.semanticSearchICE(embedding, {
  similarityThreshold: 0.85
});
```

### 3. Batch Text Processing
```javascript
// Process multiple texts efficiently
const texts = ['text1', 'text2', 'text3'];
const results = await Promise.all(
  texts.map(text => pythonClient.extractFieldIds(text))
);
```

### 4. Context Size Management
Adjust based on model limits:
```javascript
// GPT-4: 8k context
const contextGPT4 = await pythonClient.prepareRAGContext(results, 6000);

// GPT-3.5: 4k context
const contextGPT35 = await pythonClient.prepareRAGContext(results, 3000);
```

## Common Use Cases

### 1. Loan Field Lookup Assistant
```javascript
async function lookupField(fieldId) {
  const info = await pythonClient.getFieldInfo(fieldId);
  if (!info) {
    return `Field ${fieldId} not found in knowledge base`;
  }
  
  const context = await pythonClient.prepareRAGContext(
    info.field_info.references,
    2000
  );
  
  return context.context;
}
```

### 2. Smart Documentation Search
```javascript
async function smartDocSearch(query) {
  // Get embedding
  const embedding = await getEmbedding(query);
  
  // Hybrid search
  const results = await pythonClient.hybridSearch(query, {
    queryEmbedding: embedding,
    limit: 20
  });
  
  return results.results.map(r => ({
    title: r.title,
    url: r.url,
    relevance: r.combined_score
  }));
}
```

### 3. Code Analysis
```javascript
async function analyzeCode(codeSnippet) {
  // Extract field IDs
  const fields = await pythonClient.extractFieldIds(codeSnippet);
  
  // Extract endpoints
  const endpoints = await pythonClient.extractApiEndpoints(codeSnippet);
  
  // Get field documentation
  const fieldDocs = await Promise.all(
    fields.field_ids.map(id => pythonClient.getFieldInfo(id))
  );
  
  return {
    fields: fields.field_ids,
    endpoints: endpoints.endpoints,
    documentation: fieldDocs
  };
}
```

### 4. Content Quality Check
```javascript
async function checkDocumentQuality(text) {
  const readability = await pythonClient.calculateReadability(text);
  const keywords = await pythonClient.extractKeywords(text, { topN: 10 });
  
  return {
    readability: readability.metrics,
    mainTopics: keywords.keywords,
    recommendation: 
      readability.metrics.avg_words_per_sentence > 25 
        ? 'Consider shorter sentences'
        : 'Readability is good'
  };
}
```

## Troubleshooting

### pgvector Not Available
If vector operations fail:

1. Install pgvector extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Check if tables have embeddings:
```sql
SELECT COUNT(*) FROM ice_knowledge_chunks WHERE embedding IS NOT NULL;
```

3. Build embeddings:
```bash
npm run build:ice-knowledge
```

### Search Returns No Results
1. Check if data is indexed:
```sql
SELECT COUNT(*) FROM ice_knowledge_chunks;
SELECT COUNT(*) FROM encompass_docs_chunks;
```

2. Verify text search configuration:
```sql
SELECT to_tsvector('english', 'loan application');
```

3. Try keyword-only search first

### Slow Semantic Search
1. Create indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_ice_embedding 
  ON ice_knowledge_chunks 
  USING ivfflat (embedding vector_cosine_ops);
```

2. Adjust similarity threshold
3. Reduce result limit

## Future Enhancements

Planned features:
- [ ] Batch embedding generation
- [ ] Document clustering
- [ ] Topic modeling
- [ ] Entity extraction (borrower names, loan amounts)
- [ ] Automated field mapping suggestions
- [ ] Knowledge graph generation
- [ ] Multi-language support
- [ ] Custom RAG strategies

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [RAG Best Practices](https://www.pinecone.io/learn/retrieval-augmented-generation/)
