"""
Python Service Main Application
FastAPI server for handling Python-specific tasks.
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
import structlog

from config import Config
from database import init_async_pool, close_async_pool, health_check
from services.disaster_service import DisasterService
from services.encompass_service import EncompassService
from services.rag_service import RAGService
from services.text_processing_service import TextProcessingService

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer()
    ]
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    logger.info("Starting Python service", host=Config.HOST, port=Config.PORT)
    
    # Startup
    await init_async_pool()
    logger.info("Database pool initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Python service")
    await close_async_pool()
    logger.info("Database pool closed")


app = FastAPI(
    title="DevConnect Labs - Python Service",
    description="Python task worker for disaster retrieval and data processing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware to allow Node.js server to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "DevConnect Labs - Python Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "disasters": {
                "recent": "/api/disasters/recent",
                "by_county": "/api/disasters/county/{county_fips}",
                "near": "/api/disasters/near",
                "stats": "/api/disasters/stats",
                "by_type": "/api/disasters/by-type"
            },
            "encompass": {
                "knowledge_summary": "/api/encompass/knowledge-summary",
                "search_ice": "/api/encompass/search-ice",
                "search_docs": "/api/encompass/search-docs",
                "field_info": "/api/encompass/field/{field_id}"
            },
            "rag": {
                "semantic_search_ice": "/api/rag/semantic-search-ice",
                "semantic_search_docs": "/api/rag/semantic-search-docs",
                "hybrid_search": "/api/rag/hybrid-search",
                "prepare_context": "/api/rag/prepare-context",
                "similar_documents": "/api/rag/similar-documents/{doc_id}"
            },
            "text": {
                "clean": "/api/text/clean",
                "keywords": "/api/text/keywords",
                "field_ids": "/api/text/extract-field-ids",
                "api_endpoints": "/api/text/extract-api-endpoints",
                "readability": "/api/text/readability",
                "summarize": "/api/text/summarize"
            }
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    db_healthy = await health_check()
    
    return {
        "status": "healthy" if db_healthy else "degraded",
        "database": "connected" if db_healthy else "disconnected",
        "service": "running"
    }


@app.get("/api/disasters/recent")
async def get_recent_disasters(
    days: Optional[int] = Query(None, description="Number of days to look back"),
    state: Optional[str] = Query(None, description="Filter by state abbreviation"),
    event_type: Optional[str] = Query(None, description="Filter by event type")
):
    """Get recent disasters within rolling window."""
    try:
        disasters = await DisasterService.get_recent_disasters(
            days=days,
            state_abbr=state,
            event_type=event_type
        )
        
        return {
            "success": True,
            "count": len(disasters),
            "disasters": disasters
        }
    except Exception as e:
        logger.error("Failed to fetch recent disasters", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/disasters/county/{county_fips}")
async def get_disasters_by_county(
    county_fips: str,
    days: Optional[int] = Query(None, description="Number of days to look back")
):
    """Get disasters for a specific county."""
    if len(county_fips) != 5:
        raise HTTPException(status_code=400, detail="County FIPS must be 5 digits")
    
    try:
        disasters = await DisasterService.get_disasters_by_county(
            county_fips=county_fips,
            days=days
        )
        
        return {
            "success": True,
            "county_fips": county_fips,
            "count": len(disasters),
            "disasters": disasters
        }
    except Exception as e:
        logger.error("Failed to fetch county disasters", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/disasters/near")
async def get_disasters_near(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: float = Query(50, description="Search radius in miles"),
    days: Optional[int] = Query(None, description="Number of days to look back")
):
    """Get disasters near a location."""
    try:
        disasters = await DisasterService.get_disasters_near_location(
            lat=lat,
            lng=lng,
            radius_miles=radius,
            days=days
        )
        
        return {
            "success": True,
            "location": {"lat": lat, "lng": lng},
            "radius_miles": radius,
            "count": len(disasters),
            "disasters": disasters
        }
    except Exception as e:
        logger.error("Failed to fetch nearby disasters", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/disasters/stats")
async def get_disaster_stats(
    days: Optional[int] = Query(None, description="Number of days to look back")
):
    """Get aggregate disaster statistics."""
    try:
        stats = await DisasterService.get_disaster_stats(days=days)
        
        return {
            "success": True,
            "days": days or Config.DISASTER_ROLLING_WINDOW_DAYS,
            "stats": stats
        }
    except Exception as e:
        logger.error("Failed to fetch disaster stats", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/disasters/by-type")
async def get_disasters_by_type(
    days: Optional[int] = Query(None, description="Number of days to look back")
):
    """Get disaster count grouped by event type."""
    try:
        breakdown = await DisasterService.get_disasters_by_type(days=days)
        
        return {
            "success": True,
            "days": days or Config.DISASTER_ROLLING_WINDOW_DAYS,
            "breakdown": breakdown
        }
    except Exception as e:
        logger.error("Failed to fetch disasters by type", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Encompass Endpoints
@app.get("/api/encompass/knowledge-summary")
async def get_knowledge_summary():
    """Get ICE knowledge base summary."""
    try:
        summary = await EncompassService.get_ice_knowledge_summary()
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error("Failed to get knowledge summary", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/encompass/search-ice")
async def search_ice_knowledge(
    query: str = Query(..., description="Search query"),
    limit: int = Query(10, description="Max results"),
    source_type: Optional[str] = Query(None, description="Filter by source type")
):
    """Search ICE knowledge base."""
    try:
        results = await EncompassService.search_ice_knowledge(
            query=query,
            limit=limit,
            source_type=source_type
        )
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        logger.error("Failed to search ICE knowledge", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/encompass/search-docs")
async def search_encompass_docs(
    query: str = Query(..., description="Search query"),
    limit: int = Query(10, description="Max results"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Search Encompass documentation."""
    try:
        results = await EncompassService.search_encompass_docs(
            query=query,
            limit=limit,
            category=category
        )
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        logger.error("Failed to search Encompass docs", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/encompass/field/{field_id}")
async def get_field_info(field_id: str):
    """Get information about an Encompass field ID."""
    try:
        info = await EncompassService.get_loan_field_info(field_id)
        if not info:
            raise HTTPException(status_code=404, detail=f"Field {field_id} not found")
        return {"success": True, "field_info": info}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get field info", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# RAG Endpoints
@app.post("/api/rag/semantic-search-ice")
async def semantic_search_ice(
    query_embedding: List[float],
    limit: int = Query(10, description="Max results"),
    similarity_threshold: float = Query(0.7, description="Minimum similarity")
):
    """Perform semantic search on ICE knowledge."""
    try:
        if len(query_embedding) != 1536:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 1536-dimension vector, got {len(query_embedding)}"
            )
        
        results = await RAGService.semantic_search_ice(
            query_embedding=query_embedding,
            limit=limit,
            similarity_threshold=similarity_threshold
        )
        return {"success": True, "count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed semantic search on ICE", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/semantic-search-docs")
async def semantic_search_docs(
    query_embedding: List[float],
    limit: int = Query(10, description="Max results"),
    similarity_threshold: float = Query(0.7, description="Minimum similarity"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Perform semantic search on Encompass docs."""
    try:
        if len(query_embedding) != 1536:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 1536-dimension vector, got {len(query_embedding)}"
            )
        
        results = await RAGService.semantic_search_docs(
            query_embedding=query_embedding,
            limit=limit,
            similarity_threshold=similarity_threshold,
            category=category
        )
        return {"success": True, "count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed semantic search on docs", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/hybrid-search")
async def hybrid_search(
    query: str,
    query_embedding: Optional[List[float]] = None,
    limit: int = Query(10, description="Max results"),
    keyword_weight: float = Query(0.3, description="Keyword weight"),
    vector_weight: float = Query(0.7, description="Vector weight")
):
    """Perform hybrid search combining keyword and semantic."""
    try:
        if query_embedding and len(query_embedding) != 1536:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 1536-dimension vector, got {len(query_embedding)}"
            )
        
        results = await RAGService.hybrid_search(
            query=query,
            query_embedding=query_embedding,
            limit=limit,
            keyword_weight=keyword_weight,
            vector_weight=vector_weight
        )
        return {"success": True, "count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed hybrid search", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/prepare-context")
async def prepare_rag_context(
    search_results: List[Dict[str, Any]],
    max_tokens: int = Query(3000, description="Max context tokens")
):
    """Prepare RAG context from search results."""
    try:
        context_string, included_sources = await RAGService.prepare_rag_context(
            search_results=search_results,
            max_tokens=max_tokens
        )
        return {
            "success": True,
            "context": context_string,
            "sources_used": len(included_sources),
            "sources": included_sources
        }
    except Exception as e:
        logger.error("Failed to prepare RAG context", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/similar-documents/{doc_id}")
async def get_similar_documents(
    doc_id: int,
    table: str = Query("ice_knowledge_chunks", description="Table name"),
    limit: int = Query(10, description="Max results")
):
    """Find similar documents."""
    try:
        # Validate table name
        valid_tables = ["ice_knowledge_chunks", "encompass_docs_chunks"]
        if table not in valid_tables:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid table. Must be one of: {valid_tables}"
            )
        
        results = await RAGService.get_similar_documents(
            doc_id=doc_id,
            table_name=table,
            limit=limit
        )
        return {"success": True, "count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to find similar documents", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Text Processing Endpoints
@app.post("/api/text/clean")
async def clean_text(text: str):
    """Clean and normalize text."""
    try:
        cleaned = TextProcessingService.clean_text(text)
        return {"success": True, "cleaned_text": cleaned}
    except Exception as e:
        logger.error("Failed to clean text", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/text/keywords")
async def extract_keywords(
    text: str,
    top_n: int = Query(10, description="Number of keywords"),
    min_length: int = Query(3, description="Minimum keyword length")
):
    """Extract keywords from text."""
    try:
        keywords = TextProcessingService.extract_keywords(
            text=text,
            top_n=top_n,
            min_length=min_length
        )
        return {"success": True, "keywords": keywords}
    except Exception as e:
        logger.error("Failed to extract keywords", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/text/extract-field-ids")
async def extract_field_ids(text: str):
    """Extract Encompass field IDs from text."""
    try:
        field_ids = TextProcessingService.extract_field_ids(text)
        return {"success": True, "field_ids": field_ids, "count": len(field_ids)}
    except Exception as e:
        logger.error("Failed to extract field IDs", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/text/extract-api-endpoints")
async def extract_api_endpoints(text: str):
    """Extract API endpoints from text."""
    try:
        endpoints = TextProcessingService.extract_api_endpoints(text)
        return {"success": True, "endpoints": endpoints, "count": len(endpoints)}
    except Exception as e:
        logger.error("Failed to extract API endpoints", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/text/readability")
async def calculate_readability(text: str):
    """Calculate readability metrics."""
    try:
        metrics = TextProcessingService.calculate_readability_score(text)
        return {"success": True, "metrics": metrics}
    except Exception as e:
        logger.error("Failed to calculate readability", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/text/summarize")
async def summarize_text(
    text: str,
    max_sentences: int = Query(3, description="Maximum sentences in summary")
):
    """Create extractive summary of text."""
    try:
        summary = TextProcessingService.summarize_text(
            text=text,
            max_sentences=max_sentences
        )
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error("Failed to summarize text", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=Config.HOST,
        port=Config.PORT,
        reload=Config.DEBUG,
        log_level=Config.LOG_LEVEL.lower()
    )
