# Python Service Architecture

**Author:** David Lane  
**Last Updated:** July 26, 2026

## Overview

The Python Service is a FastAPI-based microservice that complements the Node.js/Express backend with Python-specific capabilities like disaster data retrieval, Encompass RAG operations, text processing, and data analytics.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DevConnect Labs Stack                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────┐         ┌────────────────────────────────┐│
│  │     Node.js/Express Backend  │         │   Python/FastAPI Microservice  ││
│  │         (Port 3000)          │◄───────►│         (Port 8000)            ││
│  ├──────────────────────────────┤  HTTP   ├────────────────────────────────┤│
│  │                              │         │                                ││
│  │ • Web UI serving             │         │ CORE RESPONSIBILITIES:         ││
│  │ • API routes                 │         │                                ││
│  │ • Encompass OAuth/Hub        │         │ 1. Disaster Data Retrieval     ││
│  │ • LangChain/OpenAI           │         │    • PostGIS spatial queries   ││
│  │ • Socket.IO real-time        │         │    • Radius/distance calc      ││
│  │ • Loan CRUD operations       │         │    • Multi-source aggregation  ││
│  │ • Processor assignment       │         │                                ││
│  │ • Screen Test (form review)  │         │ 2. Encompass RAG               ││
│  │ • KML generation             │         │    • pgvector semantic search  ││
│  │                              │         │    • ICE knowledge retrieval   ││
│  └──────────────┬───────────────┘         │    • Encompass docs search     ││
│                 │                         │    • Hybrid keyword+vector     ││
│                 │                         │                                ││
│                 │                         │ 3. Text Processing             ││
│                 │                         │    • Keyword extraction        ││
│                 │                         │    • Field ID parsing          ││
│                 │                         │    • Readability scoring       ││
│                 │                         │    • Text summarization        ││
│                 │                         │                                ││
│                 │                         │ 4. Data Analytics              ││
│                 │                         │    • pandas/numpy operations   ││
│                 │                         │    • scikit-learn ML models    ││
│                 │                         │    • Statistical analysis      ││
│                 │                         │                                ││
│                 │                         └────────────┬───────────────────┘│
│                 │                                      │                     │
│                 │                                      │                     │
│                 ▼                                      ▼                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        PostgreSQL Database                             │ │
│  │                    (Shared by both services)                           │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐ │ │
│  │  │   Disasters      │  │  ICE Knowledge      │  │   Loans          │ │ │
│  │  │                  │  │  + Encompass Docs   │  │                  │ │ │
│  │  │ • FEMA           │  │                     │  │ • Pipeline data  │ │ │
│  │  │ • NASA FIRMS     │  │ • pgvector          │  │ • Address/coords │ │ │
│  │  │ • USGS           │  │   embeddings        │  │ • Risk scores    │ │ │
│  │  │ • NOAA/NWS       │  │ • Full-text search  │  │ • Milestones     │ │ │
│  │  │ • NHC            │  │ • Field metadata    │  │                  │ │ │
│  │  │ • PostGIS        │  │ • Code examples     │  │                  │ │ │
│  │  │   spatial        │  │                     │  │                  │ │ │
│  │  └──────────────────┘  └─────────────────────┘  └──────────────────┘ │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Other Tables:                                                    │ │ │
│  │  │  • langchain_memory (AI conversation history)                    │ │ │
│  │  │  • processor_assignment_config (Encompass per-env settings)      │ │ │
│  │  │  • heygen_knowledge_chunks (HeyGen API/video knowledge)          │ │ │
│  │  │  • lane_* tables (genealogy graph)                               │ │ │
│  │  │  • trees, records, etc. (discovery collections)                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                         │ │
│  │  Access Patterns:                                                       │ │
│  │  • Node.js → pg/Pool (traditional callback/promise style)              │ │
│  │  • Python → asyncpg (async/await, connection pooling)                  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                                                               │
│  External Dependencies:                                                      │
│  • OpenAI API (embeddings, GPT models)                                       │
│  • Encompass API (ICE OAuth, Hub, loan objects)                              │
│  • Google Maps API (geocoding, map display)                                  │
│  • HeyGen API (avatar video generation)                                      │
│  • FEMA/NASA/USGS/NOAA APIs (disaster data sources)                          │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Why Python + Node.js?

### Node.js Strengths (Main Backend)
- **Fast I/O** for web requests and real-time features
- **Rich ecosystem** for web development (Express, EJS, Socket.io)
- **Frontend build tools** (Webpack, Vite, etc.)
- **Native JSON handling** and REST API serving
- **Large existing codebase** with Encompass integrations

### Python Strengths (Microservice)
- **Data science libraries** (pandas, numpy, scikit-learn)
- **Text processing** (NLTK, spaCy patterns)
- **PostGIS spatial queries** with asyncpg
- **pgvector semantic search** with numpy array operations
- **Async/await** with FastAPI for high-performance APIs
- **Type hints** for better code safety

## Service Communication

### Node.js → Python

The Node.js service calls Python endpoints via HTTP:

```javascript
// services/python-client.service.js
const axios = require('axios');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

async function getRecentDisasters(days = 90, state = null) {
  const response = await axios.get(`${PYTHON_SERVICE_URL}/api/disasters/recent`, {
    params: { days, state }
  });
  return response.data;
}

async function semanticSearchICE(queryEmbedding, limit = 10) {
  const response = await axios.post(
    `${PYTHON_SERVICE_URL}/api/rag/semantic-search-ice`,
    queryEmbedding,
    { params: { limit } }
  );
  return response.data;
}
```

### Python → PostgreSQL

Python uses `asyncpg` for async database operations:

```python
# database.py
import asyncpg
from config import Config

async_pool = None

async def init_async_pool():
    global async_pool
    async_pool = await asyncpg.create_pool(
        Config.DATABASE_URL,
        min_size=2,
        max_size=10
    )

async def execute_query(sql, *args):
    async with async_pool.acquire() as conn:
        return await conn.fetch(sql, *args)
```

## Core Services

### 1. Disaster Service (`services/disaster_service.py`)

Handles disaster data retrieval with spatial queries.

**Key Operations:**
- `get_recent_disasters()` - Time-windowed disaster queries
- `get_disasters_by_county()` - County-specific disasters
- `get_disasters_near_location()` - PostGIS radius search
- `get_disaster_stats()` - Aggregate statistics
- `get_disasters_by_type()` - Event type breakdown

**Example Query:**

```python
@staticmethod
async def get_disasters_near_location(lat, lng, radius_miles=50, days=None):
    """Get disasters within radius using PostGIS."""
    sql = """
        SELECT 
            id, source, source_id, event_type, title,
            state_abbr, county_name, lat, lng,
            start_time, end_time,
            ST_Distance(
                ST_MakePoint($1, $2)::geography,
                ST_MakePoint(lng, lat)::geography
            ) / 1609.34 AS distance_miles
        FROM disasters
        WHERE 
            ST_DWithin(
                ST_MakePoint($1, $2)::geography,
                ST_MakePoint(lng, lat)::geography,
                $3 * 1609.34
            )
            AND ($4::int IS NULL OR start_time >= NOW() - INTERVAL '1 day' * $4)
        ORDER BY distance_miles, start_time DESC
    """
    rows = await execute_query(sql, lng, lat, radius_miles, days)
    return [dict(row) for row in rows]
```

### 2. Encompass Service (`services/encompass_service.py`)

Provides access to ICE knowledge and Encompass documentation.

**Key Operations:**
- `get_ice_knowledge_summary()` - ICE knowledge stats
- `search_ice_knowledge()` - Keyword search on ICE
- `search_encompass_docs()` - Keyword search on Encompass docs
- `get_loan_field_info()` - Field ID metadata lookup

**Example:**

```python
@staticmethod
async def search_ice_knowledge(query, limit=10, source_type=None):
    """Search ICE knowledge base with keyword matching."""
    sql = """
        SELECT 
            id, source_type, title, content, url, tokens,
            ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
        FROM ice_knowledge_chunks
        WHERE 
            search_vector @@ plainto_tsquery('english', $1)
            AND ($2::text IS NULL OR source_type = $2)
        ORDER BY rank DESC
        LIMIT $3
    """
    rows = await execute_query(sql, query, source_type, limit)
    return [dict(row) for row in rows]
```

### 3. RAG Service (`services/rag_service.py`)

Handles Retrieval-Augmented Generation operations with pgvector.

**Key Operations:**
- `semantic_search_ice()` - Vector similarity search on ICE
- `semantic_search_docs()` - Vector similarity search on Encompass docs
- `hybrid_search()` - Combines keyword + semantic search
- `prepare_rag_context()` - Format results for LLM context
- `get_similar_documents()` - Find similar chunks

**Example Vector Search:**

```python
@staticmethod
async def semantic_search_ice(query_embedding, limit=10, similarity_threshold=0.7):
    """Perform semantic search using pgvector cosine similarity."""
    sql = """
        SELECT 
            id, source_type, title, content, url, tokens,
            1 - (embedding <=> $1::vector) AS similarity
        FROM ice_knowledge_chunks
        WHERE 
            embedding IS NOT NULL
            AND (1 - (embedding <=> $1::vector)) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
    """
    
    # Convert Python list to pgvector format
    embedding_str = f"[{','.join(map(str, query_embedding))}]"
    
    rows = await execute_query(sql, embedding_str, similarity_threshold, limit)
    return [dict(row) for row in rows]
```

### 4. Text Processing Service (`services/text_processing_service.py`)

Text analysis and extraction utilities.

**Key Operations:**
- `clean_text()` - Normalize whitespace, remove special chars
- `extract_keywords()` - TF-IDF keyword extraction
- `extract_field_ids()` - Find Encompass field IDs (e.g., "4000", "CX.FIELDNAME")
- `extract_api_endpoints()` - Extract API paths from text
- `calculate_readability_score()` - Flesch reading ease
- `summarize_text()` - Extractive summarization

**Example:**

```python
@staticmethod
def extract_field_ids(text):
    """Extract Encompass field IDs from text."""
    import re
    
    # Pattern 1: Numeric field IDs (e.g., "4000", "VEND.X1")
    numeric_pattern = r'\b(?:VEND\.)?[A-Z]*\.?[0-9]{1,5}\b'
    
    # Pattern 2: CX/VL custom field IDs
    custom_pattern = r'\b(?:CX|VL)\.[A-Z_][A-Z0-9_]*\b'
    
    numeric_matches = re.findall(numeric_pattern, text)
    custom_matches = re.findall(custom_pattern, text)
    
    return list(set(numeric_matches + custom_matches))
```

## Database Access Patterns

### Async Pool

The service uses connection pooling for efficiency:

```python
# At startup
async def init_async_pool():
    global async_pool
    async_pool = await asyncpg.create_pool(
        Config.DATABASE_URL,
        min_size=2,     # Minimum connections
        max_size=10,    # Maximum connections
        command_timeout=60
    )

# Query helper
async def execute_query(sql, *args):
    async with async_pool.acquire() as conn:
        return await conn.fetch(sql, *args)
```

### Query Types

**1. Simple Query (multiple rows)**

```python
rows = await execute_query("SELECT * FROM disasters WHERE state_abbr = $1", "CA")
results = [dict(row) for row in rows]
```

**2. Single Row**

```python
row = await execute_one("SELECT * FROM disasters WHERE id = $1", disaster_id)
result = dict(row) if row else None
```

**3. Command (INSERT/UPDATE/DELETE)**

```python
await execute_command(
    "UPDATE disasters SET processed = true WHERE id = $1",
    disaster_id
)
```

**4. PostGIS Spatial Query**

```python
sql = """
    SELECT *, ST_Distance(
        ST_MakePoint($1, $2)::geography,
        ST_MakePoint(lng, lat)::geography
    ) / 1609.34 AS distance_miles
    FROM disasters
    WHERE ST_DWithin(
        ST_MakePoint($1, $2)::geography,
        ST_MakePoint(lng, lat)::geography,
        $3 * 1609.34
    )
"""
rows = await execute_query(sql, lng, lat, radius_miles)
```

**5. pgvector Similarity Search**

```python
sql = """
    SELECT *, 1 - (embedding <=> $1::vector) AS similarity
    FROM ice_knowledge_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
"""
embedding_str = f"[{','.join(map(str, query_embedding))}]"
rows = await execute_query(sql, embedding_str, limit)
```

## Configuration

### Environment Variables

The service reads from the same `.env` file as Node.js:

```env
# Python Service
PYTHON_SERVICE_HOST=127.0.0.1
PYTHON_SERVICE_PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Database (shared with Node.js)
DATABASE_URL=postgresql://user:password@localhost:5432/devconnect

# Optional API keys (reused from Node.js)
NASA_API_KEY=your_key_here
DISASTER_REFRESH_TOKEN=optional_token
```

### Config Module (`config.py`)

```python
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

class Config:
    # Service
    HOST = os.getenv('PYTHON_SERVICE_HOST', '127.0.0.1')
    PORT = int(os.getenv('PYTHON_SERVICE_PORT', '8000'))
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # Disaster settings
    DISASTER_ROLLING_WINDOW_DAYS = int(os.getenv('DISASTER_ROLLING_WINDOW_DAYS', '90'))
    
    # API keys
    NASA_API_KEY = os.getenv('NASA_API_KEY')
```

## Logging

Uses `structlog` for structured logging:

```python
import structlog

logger = structlog.get_logger()

# Log with context
logger.info("Fetching disasters", days=90, state="CA", event_type="wildfire")
logger.error("Database query failed", error=str(e), sql=sql)
```

**Output:**

```
2026-07-26T11:30:00Z [info] Fetching disasters days=90 state=CA event_type=wildfire
2026-07-26T11:30:01Z [info] Database query executed rows=147
```

## API Documentation

FastAPI auto-generates interactive API docs:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

These provide:
- Endpoint descriptions
- Parameter documentation
- Request/response schemas
- Try-it-out functionality

## Running the Service

### Development

```bash
# Activate virtual environment
cd python-service
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
python main.py
```

### Production

**Option 1: npm scripts**

```json
{
  "scripts": {
    "python:start": "cd python-service && python main.py",
    "start:all": "npm-run-all --parallel start python:start"
  }
}
```

**Option 2: PM2**

```bash
pm2 start python-service/main.py --name python-service --interpreter python3
```

**Option 3: systemd**

```ini
[Unit]
Description=DevConnect Labs Python Service
After=network.target postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/piBoom/python-service
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## Performance Characteristics

### Async I/O

All database operations are async, allowing concurrent requests:

```python
# Multiple requests can run concurrently
async def handle_request():
    disasters = await get_disasters()      # Non-blocking
    loans = await get_nearby_loans()       # Non-blocking
    cameras = await get_nearby_cameras()   # Non-blocking
    return combine_results(disasters, loans, cameras)
```

### Connection Pooling

- **Min size:** 2 connections (always available)
- **Max size:** 10 connections (scales under load)
- **Auto-reconnect** on connection loss

### Response Times

Typical response times (localhost):
- Simple queries: 5-15ms
- PostGIS spatial queries: 10-30ms
- Vector similarity search: 20-50ms
- Text processing: < 5ms

## Error Handling

All endpoints return consistent error responses:

```python
@app.get("/api/disasters/recent")
async def get_recent_disasters(...):
    try:
        disasters = await DisasterService.get_recent_disasters(...)
        return {"success": True, "disasters": disasters}
    except Exception as e:
        logger.error("Failed to fetch disasters", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

**Error Response:**

```json
{
  "detail": "Database connection failed: timeout"
}
```

## Testing

### Health Check

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "database": "connected",
  "service": "running"
}
```

### Test Endpoints

```bash
# Recent disasters
curl "http://localhost:8000/api/disasters/recent?days=30&state=CA"

# Nearby disasters
curl "http://localhost:8000/api/disasters/near?lat=33.6&lng=-117.9&radius=50"

# Disaster stats
curl http://localhost:8000/api/disasters/stats

# ICE knowledge search
curl "http://localhost:8000/api/encompass/search-ice?query=custom+fields&limit=5"

# Text processing
curl -X POST http://localhost:8000/api/text/clean \
  -H "Content-Type: application/json" \
  -d '"This   has   extra    spaces!"'
```

## Extension Points

### Adding New Services

1. Create service file:

```python
# services/my_service.py
class MyService:
    @staticmethod
    async def my_operation(param):
        rows = await execute_query("SELECT * FROM table WHERE field = $1", param)
        return [dict(row) for row in rows]
```

2. Add endpoints in `main.py`:

```python
from services.my_service import MyService

@app.get("/api/my-endpoint")
async def my_endpoint(param: str):
    try:
        result = await MyService.my_operation(param)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

### Adding Dependencies

```bash
pip install new-package
pip freeze > requirements.txt
```

## Future Enhancements

### Planned Features

- **Caching** (Redis) for frequent queries
- **Background tasks** (Celery) for long-running operations
- **Authentication** (JWT tokens from Node.js)
- **Rate limiting** per client
- **Prometheus metrics** for monitoring
- **Comprehensive error tracking** (Sentry)

### Potential Services

- **Geospatial analysis** (polygon intersections, heatmaps)
- **Machine learning models** (disaster prediction, risk scoring)
- **Image processing** (disaster satellite imagery analysis)
- **NLP operations** (document classification, entity extraction)
- **Time series analysis** (disaster trends, forecasting)

## References

- **FastAPI:** https://fastapi.tiangolo.com/
- **asyncpg:** https://magicstack.github.io/asyncpg/
- **PostGIS:** https://postgis.net/
- **pgvector:** https://github.com/pgvector/pgvector
- **structlog:** https://www.structlog.org/

## Summary

The Python Service complements Node.js by:

1. **Handling data-intensive operations** with pandas/numpy
2. **Providing spatial queries** with PostGIS via asyncpg
3. **Enabling semantic search** with pgvector and numpy
4. **Processing text** with Python NLP libraries
5. **Maintaining separation of concerns** (Node.js = web, Python = data)

Both services share the same PostgreSQL database, with Python optimized for async operations and data processing while Node.js handles web serving and user-facing features.
