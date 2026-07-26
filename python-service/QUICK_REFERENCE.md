# Python Service - Quick Reference Card

## Start/Stop

```bash
# Install dependencies
npm run python:install

# Start (development with auto-reload)
npm run python:dev

# Start (production)
npm run python:start

# Check if running
curl http://localhost:8000/health
```

## Common Operations

### Search ICE Knowledge
```javascript
const results = await pythonClient.searchICEKnowledge('loan validation', {
  limit: 10,
  sourceType: 'repo'
});
```

### Search Encompass Docs
```javascript
const docs = await pythonClient.searchEncompassDocs('OAuth', {
  limit: 5,
  category: 'authentication'
});
```

### Get Field Info
```javascript
const info = await pythonClient.getFieldInfo('4000');
```

### Extract Field IDs
```javascript
const { field_ids } = await pythonClient.extractFieldIds(text);
// Returns: ["4000", "URLA.X75", "Loan.LoanAmount"]
```

### Hybrid Search
```javascript
const results = await pythonClient.hybridSearch('custom fields', {
  limit: 10,
  keywordWeight: 0.3,
  vectorWeight: 0.7
});
```

### Prepare RAG Context
```javascript
const { context, sources } = await pythonClient.prepareRAGContext(
  searchResults,
  3000 // max tokens
);
```

### Get Disaster Stats
```javascript
const stats = await pythonClient.getDisasterStats(90); // last 90 days
```

### Find Nearby Disasters
```javascript
const nearby = await pythonClient.getDisastersNear({
  lat: 33.6,
  lng: -117.9,
  radius: 50
});
```

## cURL Examples

### Health Check
```bash
curl http://localhost:8000/health
```

### Search ICE
```bash
curl "http://localhost:8000/api/encompass/search-ice?query=loan&limit=5"
```

### Get Field Info
```bash
curl http://localhost:8000/api/encompass/field/4000
```

### Extract Keywords
```bash
curl -X POST http://localhost:8000/api/text/keywords \
  -H "Content-Type: application/json" \
  -d '{"text": "The Encompass API provides loan data access..."}'
```

### Disaster Stats
```bash
curl "http://localhost:8000/api/disasters/stats?days=90"
```

## Full RAG Workflow

```javascript
// 1. Search knowledge base
const results = await pythonClient.searchICEKnowledge(
  'How do I validate custom fields?',
  { limit: 10 }
);

// 2. Prepare context
const { context, sources } = await pythonClient.prepareRAGContext(
  results.results,
  3000
);

// 3. Use with OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: `You are an Encompass expert. Context: ${context}`
    },
    {
      role: 'user',
      content: 'How do I validate custom fields?'
    }
  ]
});
```

## Error Handling

```javascript
try {
  const results = await pythonClient.searchICEKnowledge(query);
  // Use results
} catch (error) {
  if (!await pythonClient.isAvailable()) {
    console.error('Python service not available');
    // Start with: npm run python:dev
  } else {
    console.error('Search failed:', error.message);
  }
}
```

## Interactive API Docs

Open in browser while service is running:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/encompass/search-ice` | GET | Search ICE knowledge |
| `/api/encompass/search-docs` | GET | Search Encompass docs |
| `/api/encompass/field/{id}` | GET | Get field info |
| `/api/rag/hybrid-search` | POST | Keyword + semantic search |
| `/api/rag/prepare-context` | POST | Format RAG context |
| `/api/text/extract-field-ids` | POST | Extract field IDs |
| `/api/disasters/stats` | GET | Disaster statistics |

## Useful Client Methods

```javascript
// Check availability
await pythonClient.isAvailable()

// Encompass
await pythonClient.getKnowledgeSummary()
await pythonClient.searchICEKnowledge(query, options)
await pythonClient.searchEncompassDocs(query, options)
await pythonClient.getFieldInfo(fieldId)

// RAG
await pythonClient.hybridSearch(query, options)
await pythonClient.prepareRAGContext(results, maxTokens)
await pythonClient.getSimilarDocuments(docId, options)

// Text processing
await pythonClient.extractFieldIds(text)
await pythonClient.extractApiEndpoints(text)
await pythonClient.extractKeywords(text, options)
await pythonClient.calculateReadability(text)
await pythonClient.summarizeText(text, maxSentences)

// Disasters
await pythonClient.getDisasterStats(days)
await pythonClient.getRecentDisasters(options)
await pythonClient.getDisastersNear(options)
```

## Configuration

In `.env`:
```env
# Python Service
PYTHON_SERVICE_HOST=127.0.0.1
PYTHON_SERVICE_PORT=8000

# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/devconnect

# Optional
DEBUG=false
LOG_LEVEL=INFO
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Service won't start | Check Python version: `python --version` (needs 3.10+) |
| No search results | Run: `npm run build:ice-knowledge` |
| Connection refused | Check service: `curl http://localhost:8000/health` |
| Port in use | Change port in `.env`: `PYTHON_SERVICE_PORT=8001` |

## Examples

Run the example scripts:
```bash
npm run example:python-disasters      # Basic disaster examples
npm run example:encompass-rag          # Encompass RAG features
npm run example:rag-workflow           # Full RAG workflow
```

## Links

- [Full Documentation](../docs/PYTHON_SERVICE.md)
- [Encompass RAG Guide](../docs/PYTHON_SERVICE_ENCOMPASS_RAG.md)
- [Quick Start Summary](../PYTHON_SERVICE_SUMMARY.md)
- [Interactive API Docs](http://localhost:8000/docs)
