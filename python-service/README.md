# Python Service - DevConnect Labs

Python-based task worker for handling operations that complement the Node.js server, such as disaster data retrieval, data processing, and analytics.

## Features

- **FastAPI** web framework for high-performance async APIs
- **PostgreSQL** access using the same database as Node.js
- **Disaster data services** with spatial queries
- **Async/await** support for efficient I/O operations
- **Structured logging** for production debugging
- **CORS enabled** for Node.js integration

## Setup

### 1. Install Python Dependencies

```bash
# From python-service directory
pip install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

The Python service reads from the same `.env` file as the Node.js server (in the parent directory).

Add these optional Python-specific variables to your `.env`:

```env
# Python Service Configuration
PYTHON_SERVICE_HOST=127.0.0.1
PYTHON_SERVICE_PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Required (already in your .env for Node.js)
DATABASE_URL=postgresql://user:password@localhost:5432/devconnect

# Optional disaster API keys (reused from Node.js)
NASA_API_KEY=your_key_here
DISASTER_REFRESH_TOKEN=optional_token
```

### 3. Run the Service

```bash
# From python-service directory
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The service will start on `http://localhost:8000`

### LiveKit Agents worker (optional, separate process)

Reed (StarBand) and Wolfman Dave join LiveKit rooms from a worker, not from FastAPI.

```bash
cd python-service
pip install -r requirements-livekit.txt
python livekit_agent/worker.py start
```

Or from the repo root: `npm run python:livekit-agent`.

Uses `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `OPENAI_API_KEY`. Set `LIVEKIT_AGENT_NAME=WolfmanDave` for the booth.

### 4. View API Documentation

FastAPI automatically generates interactive API docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Health & Info

- `GET /` - Service information
- `GET /health` - Health check (includes database status)

### Disaster Data

- `GET /api/disasters/recent` - Get recent disasters
  - Query params: `?days=90&state=CA&event_type=wildfire`
  
- `GET /api/disasters/county/{county_fips}` - Get disasters by county
  - Example: `/api/disasters/county/06059` (Orange County, CA)
  
- `GET /api/disasters/near` - Get disasters near a location
  - Query params: `?lat=33.6&lng=-117.9&radius=50&days=90`
  
- `GET /api/disasters/stats` - Get aggregate disaster statistics
  - Query params: `?days=90`
  
- `GET /api/disasters/by-type` - Get disaster breakdown by type
  - Query params: `?days=90`

### Encompass Knowledge & RAG

- `GET /api/encompass/knowledge-summary` - Get ICE knowledge summary
- `GET /api/encompass/search-ice` - Search ICE knowledge base
  - Query params: `?query=loan&limit=10&source_type=repo`
  
- `GET /api/encompass/search-docs` - Search Encompass documentation
  - Query params: `?query=OAuth&limit=10&category=authentication`
  
- `GET /api/encompass/field/{field_id}` - Get loan field information
  - Example: `/api/encompass/field/4000`

### RAG Operations

- `POST /api/rag/semantic-search-ice` - Semantic search on ICE knowledge
  - Body: `[0.1, 0.2, ...]` (1536-dim embedding)
  - Query params: `?limit=10&similarity_threshold=0.7`
  
- `POST /api/rag/semantic-search-docs` - Semantic search on Encompass docs
  - Body: `[0.1, 0.2, ...]` (1536-dim embedding)
  - Query params: `?limit=10&similarity_threshold=0.7&category=authentication`
  
- `POST /api/rag/hybrid-search` - Hybrid keyword + semantic search
  - Body: `{"query": "custom fields", "query_embedding": [...], "limit": 10}`
  
- `POST /api/rag/prepare-context` - Prepare RAG context from results
  - Body: `{"search_results": [...], "max_tokens": 3000}`
  
- `GET /api/rag/similar-documents/{doc_id}` - Find similar documents
  - Query params: `?table=ice_knowledge_chunks&limit=10`

### Text Processing

- `POST /api/text/clean` - Clean and normalize text
- `POST /api/text/keywords` - Extract keywords
  - Query params: `?top_n=10&min_length=3`
  
- `POST /api/text/extract-field-ids` - Extract Encompass field IDs
- `POST /api/text/extract-api-endpoints` - Extract API endpoints
- `POST /api/text/readability` - Calculate readability metrics
- `POST /api/text/summarize` - Create extractive summary
  - Query params: `?max_sentences=3`

## Project Structure

```
python-service/
├── main.py                         # FastAPI application
├── config.py                       # Configuration from .env
├── database.py                     # Database connection pooling
├── requirements.txt                # Python dependencies
├── services/
│   └── disaster_service.py         # Disaster data service
└── README.md                       # This file
```

## Usage Examples

### From Node.js Server

Call the Python service from your Node.js code:

```javascript
const axios = require('axios');

async function getDisasterStats() {
  const response = await axios.get('http://localhost:8000/api/disasters/stats', {
    params: { days: 90 }
  });
  return response.data;
}
```

### From Python Scripts

```python
import httpx

async def get_recent_disasters():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'http://localhost:8000/api/disasters/recent',
            params={'state': 'CA', 'days': 30}
        )
        return response.json()
```

### From Browser/Frontend

```javascript
fetch('http://localhost:8000/api/disasters/near?lat=33.6&lng=-117.9&radius=50')
  .then(res => res.json())
  .then(data => console.log(data));
```

## Adding New Services

1. Create a new service file in `services/`:

```python
# services/my_service.py
class MyService:
    @staticmethod
    async def do_something():
        # Your logic here
        pass
```

2. Add endpoints in `main.py`:

```python
from services.my_service import MyService

@app.get("/api/my-endpoint")
async def my_endpoint():
    result = await MyService.do_something()
    return {"success": True, "data": result}
```

## Database Access

The service provides both async and sync database access:

```python
from database import execute_query, execute_one, execute_command

# Async query
async def get_data():
    rows = await execute_query("SELECT * FROM table WHERE id = $1", 123)
    return [dict(row) for row in rows]

# Single row
async def get_one():
    row = await execute_one("SELECT * FROM table WHERE id = $1", 123)
    return dict(row) if row else None

# Command (INSERT/UPDATE/DELETE)
async def update_data():
    await execute_command("UPDATE table SET field = $1 WHERE id = $2", "value", 123)
```

## Running in Production

### Using npm Scripts

Add to the main `package.json`:

```json
{
  "scripts": {
    "python:start": "cd python-service && python main.py",
    "python:dev": "cd python-service && uvicorn main:app --reload",
    "start:all": "npm-run-all --parallel start python:start"
  }
}
```

### Using Process Manager (PM2)

```bash
pm2 start python-service/main.py --name python-service --interpreter python3
```

### Using systemd (Linux)

Create `/etc/systemd/system/python-service.service`:

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

## Logging

The service uses structured logging. Logs include:

- Timestamp (ISO format)
- Log level
- Message
- Contextual data (request params, errors, etc.)

Example log output:

```
2026-07-26T07:11:00Z [info] Fetching recent disasters days=90 state=CA
2026-07-26T07:11:00Z [info] Database query executed rows=147
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Error message here"
}
```

HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

## Testing

Test the service:

```bash
# Health check
curl http://localhost:8000/health

# Get recent disasters
curl "http://localhost:8000/api/disasters/recent?days=30&state=CA"

# Get disaster stats
curl http://localhost:8000/api/disasters/stats
```

## Next Steps

- Add authentication/authorization
- Implement caching (Redis)
- Add background task processing (Celery)
- Add more data processing services
- Implement rate limiting
- Add comprehensive error tracking
