# Python Service Documentation

## Overview

The Python service is a FastAPI-based task worker that handles operations better suited for Python than Node.js, such as:

- **Disaster data retrieval and analysis** - Spatial queries and aggregations
- **Encompass knowledge retrieval** - ICE knowledge base and documentation search
- **RAG operations** - Semantic search, hybrid search, context preparation
- **Text processing** - NLP, keyword extraction, field ID parsing
- **Complex data processing** - Vector operations, similarity calculations
- **Scientific computing** - NumPy/SciPy for efficient computations

It runs as a separate service alongside the Node.js server and shares the same PostgreSQL database.

**See also:**
- [Encompass & RAG Operations Guide](./PYTHON_SERVICE_ENCOMPASS_RAG.md) - Detailed guide for Encompass-specific features

## Architecture

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

## Quick Start

### 1. Install Dependencies

```bash
npm run python:install
```

Or manually:

```bash
cd python-service
pip install -r requirements.txt
```

### 2. Configure Environment

The Python service reads from the same `.env` file as Node.js. Ensure `DATABASE_URL` is set:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/devconnect
```

Optional Python-specific settings:

```env
PYTHON_SERVICE_HOST=127.0.0.1
PYTHON_SERVICE_PORT=8000
DEBUG=false
LOG_LEVEL=INFO
```

### 3. Start the Service

Development mode (auto-reload):

```bash
npm run python:dev
```

Production mode:

```bash
npm run python:start
```

### 4. Verify It's Running

```bash
curl http://localhost:8000/health
```

Or visit http://localhost:8000/docs for interactive API documentation.

## API Endpoints

### Health & Info

#### `GET /`
Service information and endpoint list.

#### `GET /health`
Health check with database status.

```json
{
  "status": "healthy",
  "database": "connected",
  "service": "running"
}
```

### Disaster Endpoints

#### `GET /api/disasters/recent`
Get recent disasters within rolling window.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 90)
- `state` (optional): Filter by state abbreviation (e.g., "CA")
- `event_type` (optional): Filter by event type

**Example:**
```bash
curl "http://localhost:8000/api/disasters/recent?days=30&state=CA"
```

#### `GET /api/disasters/county/{county_fips}`
Get disasters for a specific county.

**Parameters:**
- `county_fips`: 5-digit FIPS code (e.g., "06059" for Orange County, CA)

**Query Parameters:**
- `days` (optional): Number of days to look back

**Example:**
```bash
curl "http://localhost:8000/api/disasters/county/06059?days=90"
```

#### `GET /api/disasters/near`
Get disasters near a location using spatial queries.

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Search radius in miles (default: 50)
- `days` (optional): Number of days to look back

**Example:**
```bash
curl "http://localhost:8000/api/disasters/near?lat=33.6&lng=-117.9&radius=50"
```

#### `GET /api/disasters/stats`
Get aggregate disaster statistics.

**Query Parameters:**
- `days` (optional): Number of days to look back

**Example:**
```bash
curl "http://localhost:8000/api/disasters/stats?days=90"
```

**Response:**
```json
{
  "success": true,
  "days": 90,
  "stats": {
    "total_disasters": 1234,
    "affected_counties": 456,
    "affected_states": 42,
    "event_types": 8,
    "event_type_list": ["wildfire", "flood", "hurricane", ...],
    "sources": ["FEMA", "NASA", "NOAA"]
  }
}
```

#### `GET /api/disasters/by-type`
Get disaster count grouped by event type.

**Query Parameters:**
- `days` (optional): Number of days to look back

**Example:**
```bash
curl "http://localhost:8000/api/disasters/by-type?days=30"
```

## Integration with Node.js

### Using the Python Client Service

The Node.js server includes a Python client service for easy integration:

```javascript
import pythonClient from './services/python-client.service.js';

// Check availability
const isAvailable = await pythonClient.isAvailable();

// Get disaster stats
const stats = await pythonClient.getDisasterStats(90);

// Get recent disasters
const disasters = await pythonClient.getRecentDisasters({
  state: 'CA',
  days: 30
});

// Get disasters near location
const nearby = await pythonClient.getDisastersNear({
  lat: 33.7175,
  lng: -117.8311,
  radius: 50
});
```

### Adding to Express Routes

```javascript
import express from 'express';
import pythonClient from '../services/python-client.service.js';

const router = express.Router();

router.get('/api/disasters/python-stats', async (req, res) => {
  try {
    const stats = await pythonClient.getDisasterStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Adding New Services

### 1. Create a Service Module

Create `python-service/services/my_service.py`:

```python
"""My Service Description."""
from typing import List, Dict, Any
import structlog

from database import execute_query

logger = structlog.get_logger()

class MyService:
    @staticmethod
    async def do_something(param: str) -> List[Dict[str, Any]]:
        """Do something useful."""
        logger.info("Doing something", param=param)
        
        rows = await execute_query(
            "SELECT * FROM table WHERE field = $1",
            param
        )
        
        return [dict(row) for row in rows]
```

### 2. Add Endpoints

Add to `python-service/main.py`:

```python
from services.my_service import MyService

@app.get("/api/my-endpoint")
async def my_endpoint(param: str = Query(...)):
    try:
        result = await MyService.do_something(param)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Failed to do something", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

### 3. Add Client Methods

Add to `services/python-client.service.js`:

```javascript
async doSomething(param) {
  try {
    const response = await this.client.get('/api/my-endpoint', {
      params: { param }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to do something:', error.message);
    throw new Error(`Python service error: ${error.message}`);
  }
}
```

## Database Access

The Python service provides async database utilities:

```python
from database import (
    execute_query,      # Multi-row SELECT
    execute_one,        # Single-row SELECT
    execute_command,    # INSERT/UPDATE/DELETE
    get_async_connection  # Manual connection management
)

# Query multiple rows
async def get_items():
    rows = await execute_query("SELECT * FROM items WHERE active = $1", True)
    return [dict(row) for row in rows]

# Query single row
async def get_item(id: int):
    row = await execute_one("SELECT * FROM items WHERE id = $1", id)
    return dict(row) if row else None

# Execute command
async def update_item(id: int, name: str):
    await execute_command("UPDATE items SET name = $1 WHERE id = $2", name, id)

# Manual connection (for transactions)
async def complex_operation():
    async with get_async_connection() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE table1 SET field = $1", value)
            await conn.execute("UPDATE table2 SET field = $1", value)
```

## Development

### Running Tests

(Add when tests are created)

```bash
cd python-service
pytest tests/
```

### Code Style

Format code with black:

```bash
pip install black
black python-service/
```

Lint with flake8:

```bash
pip install flake8
flake8 python-service/
```

### Interactive API Documentation

FastAPI automatically generates interactive docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Use these to:
- Browse all endpoints
- See request/response schemas
- Test endpoints interactively
- Generate API client code

## Deployment

### Development

```bash
npm run python:dev
```

### Production (Render, Heroku, etc.)

Add to `Procfile`:

```
web: node server.js
worker: cd python-service && python main.py
```

Or use separate services:

**Node.js service Procfile:**
```
web: node server.js
```

**Python service Procfile:**
```
web: cd python-service && uvicorn main:app --host 0.0.0.0 --port $PORT
```

### PM2 Process Manager

```json
{
  "apps": [
    {
      "name": "node-server",
      "script": "server.js"
    },
    {
      "name": "python-service",
      "script": "main.py",
      "cwd": "python-service",
      "interpreter": "python3"
    }
  ]
}
```

Start with:

```bash
pm2 start ecosystem.config.json
```

### Docker

Create `python-service/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
```

Build and run:

```bash
docker build -t python-service ./python-service
docker run -p 8000:8000 --env-file .env python-service
```

## Troubleshooting

### Service Won't Start

1. Check DATABASE_URL in .env:
   ```bash
   cat .env | grep DATABASE_URL
   ```

2. Test database connection:
   ```bash
   psql $DATABASE_URL
   ```

3. Check Python version (requires 3.10+):
   ```bash
   python --version
   ```

### Connection Refused

1. Verify service is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check port isn't in use:
   ```bash
   netstat -an | grep 8000
   ```

3. Try different port:
   ```bash
   PYTHON_SERVICE_PORT=8001 npm run python:dev
   ```

### Database Errors

1. Check database is running:
   ```bash
   pg_isready
   ```

2. Verify database permissions:
   ```sql
   SELECT current_user, current_database();
   ```

3. Test query manually:
   ```sql
   SELECT COUNT(*) FROM disasters;
   ```

## Performance

### Connection Pooling

The service uses connection pooling with these defaults:

- **Async pool**: 2-10 connections
- **Sync pool**: 2-10 connections
- **Command timeout**: 60 seconds

Adjust in `database.py` if needed.

### Caching

For expensive operations, consider adding Redis caching:

```python
import redis
r = redis.from_url(os.getenv('REDIS_URL'))

async def get_cached_stats():
    cached = r.get('disaster:stats')
    if cached:
        return json.loads(cached)
    
    stats = await DisasterService.get_disaster_stats()
    r.setex('disaster:stats', 300, json.dumps(stats))  # 5 min cache
    return stats
```

## Future Enhancements

Potential additions:

- [ ] Machine learning models for disaster prediction
- [ ] Real-time data processing with WebSocket support
- [ ] Background task processing with Celery
- [ ] Redis caching layer
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] Comprehensive test suite
- [ ] Data export endpoints (CSV, Excel)
- [ ] Batch processing endpoints
- [ ] Admin interface

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [asyncpg Documentation](https://magicstack.github.io/asyncpg/)
- [uvicorn Documentation](https://www.uvicorn.org/)
- [Python asyncio](https://docs.python.org/3/library/asyncio.html)
