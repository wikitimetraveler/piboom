# Python Service - Quick Start Summary

## What Was Added

Your DevConnect Labs project now has a Python service for advanced data processing tasks that complement your Node.js server.

## Features Added

### 1. Disaster Data Processing
- Recent disasters retrieval
- County-level disaster lookup
- Spatial queries (near location)
- Disaster statistics and aggregations
- Breakdown by event type

### 2. Encompass Knowledge & RAG
- **ICE Knowledge Base** - Search your ICE repos and knowledge sources
- **Encompass Documentation** - Search scraped Developer Connect docs
- **Field Information** - Look up Encompass field IDs
- **Semantic Search** - Vector similarity search with pgvector
- **Hybrid Search** - Combined keyword + semantic search
- **RAG Context Preparation** - Format search results for LLM prompts
- **Document Similarity** - Find related knowledge chunks

### 3. Text Processing
- Text cleaning and normalization
- Keyword extraction
- Field ID extraction (e.g., "4000", "URLA.X75")
- API endpoint extraction
- Readability metrics
- Extractive summarization

## Quick Start

### 1. Install Dependencies
```bash
npm run python:install
```

### 2. Start the Service
```bash
npm run python:dev
```

The service runs on `http://localhost:8000`

### 3. Test It
```bash
# Test disasters endpoint
curl http://localhost:8000/api/disasters/stats

# Test health check
curl http://localhost:8000/health

# View interactive docs
open http://localhost:8000/docs
```

### 4. Run Examples
```bash
# Disaster data example
npm run example:python-disasters

# Encompass RAG example
npm run example:encompass-rag

# Full RAG workflow with OpenAI
npm run example:rag-workflow
```

## Usage in Node.js

```javascript
import pythonClient from './services/python-client.service.js';

// Check availability
const isAvailable = await pythonClient.isAvailable();

// Get disaster stats
const stats = await pythonClient.getDisasterStats(90);

// Search ICE knowledge
const results = await pythonClient.searchICEKnowledge('loan validation', {
  limit: 10
});

// Extract field IDs from code
const fieldIds = await pythonClient.extractFieldIds(codeSnippet);

// Prepare RAG context
const context = await pythonClient.prepareRAGContext(searchResults, 3000);
```

## Project Structure

```
python-service/
├── main.py                         # FastAPI app with all endpoints
├── config.py                       # Configuration from .env
├── database.py                     # Async Postgres connections
├── requirements.txt                # Dependencies
├── services/
│   ├── disaster_service.py         # Disaster operations
│   ├── encompass_service.py        # Encompass knowledge retrieval
│   ├── rag_service.py              # RAG operations
│   └── text_processing_service.py  # Text analysis
└── README.md

Node.js Integration:
├── services/python-client.service.js  # Node.js client
├── examples/
│   ├── python-service-example.js      # Basic usage
│   ├── encompass-rag-example.js       # Encompass features
│   └── rag-workflow-example.js        # Full RAG workflow
└── docs/
    ├── PYTHON_SERVICE.md              # Main documentation
    └── PYTHON_SERVICE_ENCOMPASS_RAG.md # Encompass guide
```

## API Endpoints

### Disasters
- `GET /api/disasters/recent` - Recent disasters
- `GET /api/disasters/county/{fips}` - By county
- `GET /api/disasters/near` - Spatial search
- `GET /api/disasters/stats` - Statistics
- `GET /api/disasters/by-type` - Grouped by type

### Encompass
- `GET /api/encompass/knowledge-summary` - Knowledge base summary
- `GET /api/encompass/search-ice` - Search ICE knowledge
- `GET /api/encompass/search-docs` - Search Encompass docs
- `GET /api/encompass/field/{id}` - Field information

### RAG
- `POST /api/rag/semantic-search-ice` - Vector search on ICE
- `POST /api/rag/semantic-search-docs` - Vector search on docs
- `POST /api/rag/hybrid-search` - Combined keyword + semantic
- `POST /api/rag/prepare-context` - Format context for LLMs
- `GET /api/rag/similar-documents/{id}` - Find similar docs

### Text Processing
- `POST /api/text/clean` - Clean text
- `POST /api/text/keywords` - Extract keywords
- `POST /api/text/extract-field-ids` - Find field IDs
- `POST /api/text/extract-api-endpoints` - Find endpoints
- `POST /api/text/readability` - Calculate metrics
- `POST /api/text/summarize` - Create summary

## Environment Variables

Add to your `.env` file:

```env
# Python Service (optional overrides)
PYTHON_SERVICE_HOST=127.0.0.1
PYTHON_SERVICE_PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Required (already in your .env)
DATABASE_URL=postgresql://user:password@localhost:5432/devconnect
```

## npm Scripts Added

```json
{
  "python:install": "Install Python dependencies",
  "python:start": "Start Python service (production)",
  "python:dev": "Start Python service (development with auto-reload)",
  "example:python-disasters": "Run disaster data example",
  "example:encompass-rag": "Run Encompass RAG example",
  "example:rag-workflow": "Run complete RAG workflow"
}
```

## Documentation

- **[Main Guide](docs/PYTHON_SERVICE.md)** - Complete Python service documentation
- **[Encompass RAG Guide](docs/PYTHON_SERVICE_ENCOMPASS_RAG.md)** - Detailed Encompass & RAG operations
- **[API Docs](http://localhost:8000/docs)** - Interactive API documentation (when service is running)

## Common Use Cases

### 1. Loan Field Lookup
```javascript
const fieldInfo = await pythonClient.getFieldInfo('4000');
console.log(fieldInfo.field_info.references);
```

### 2. Smart Documentation Search
```javascript
const results = await pythonClient.searchEncompassDocs('OAuth authentication', {
  category: 'authentication',
  limit: 5
});
```

### 3. Code Analysis
```javascript
const fieldIds = await pythonClient.extractFieldIds(codeSnippet);
const endpoints = await pythonClient.extractApiEndpoints(codeSnippet);
```

### 4. RAG with OpenAI
```javascript
// 1. Search knowledge base
const results = await pythonClient.hybridSearch('custom fields validation');

// 2. Prepare context
const { context } = await pythonClient.prepareRAGContext(results.results, 3000);

// 3. Query OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: `Context: ${context}` },
    { role: 'user', content: 'How do I validate custom fields?' }
  ]
});
```

### 5. Disaster Risk Assessment
```javascript
const nearby = await pythonClient.getDisastersNear({
  lat: 33.6,
  lng: -117.9,
  radius: 50
});

const stats = await pythonClient.getDisastersByType(90);
```

## Next Steps

1. **Start the service**: `npm run python:dev`
2. **Run an example**: `npm run example:encompass-rag`
3. **View API docs**: Open http://localhost:8000/docs
4. **Read the guides**: See `docs/PYTHON_SERVICE_ENCOMPASS_RAG.md`
5. **Integrate**: Use `pythonClient` in your Node.js code

## Benefits

### Why Python for These Tasks?

1. **Vector Operations** - NumPy for efficient similarity calculations
2. **Text Processing** - Better NLP libraries and regex handling
3. **Data Science** - Pandas for bulk data operations
4. **Machine Learning** - Easy integration with ML libraries
5. **Scientific Computing** - SciPy for advanced algorithms

### Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Node.js       │         │   Python         │
│   Server        │◄───────►│   Service        │
│   (Port 3000)   │  HTTP   │   (Port 8000)    │
└────────┬────────┘         └─────────┬────────┘
         │                            │
         │      ┌──────────────┐      │
         └─────►│  PostgreSQL  │◄─────┘
                │   Database   │
                └──────────────┘
```

Both services share the same database and work together:
- Node.js handles web requests, Encompass API, real-time features
- Python handles data processing, RAG, text analysis, vector operations

## Troubleshooting

### Service won't start
```bash
# Check Python version (needs 3.10+)
python --version

# Reinstall dependencies
npm run python:install

# Check DATABASE_URL
echo $DATABASE_URL
```

### No search results
```bash
# Build ICE knowledge
npm run build:ice-knowledge

# Scrape Encompass docs
npm run scrape:encompass-docs

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ice_knowledge_chunks;"
```

### Connection errors
```bash
# Check service is running
curl http://localhost:8000/health

# Check port isn't in use
netstat -an | grep 8000
```

## Resources

- **FastAPI**: https://fastapi.tiangolo.com/
- **pgvector**: https://github.com/pgvector/pgvector
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **RAG Guide**: https://www.pinecone.io/learn/retrieval-augmented-generation/

---

**You're all set!** The Python service is ready to handle Encompass data retrieval and RAG operations alongside your Node.js server.
