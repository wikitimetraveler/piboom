"""
Encompass Data Service - Python implementation.
Handles Encompass loan data retrieval and processing.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import structlog

from database import execute_query, execute_one, execute_command
from config import Config

logger = structlog.get_logger()


class EncompassService:
    """Service for Encompass loan data operations."""
    
    @staticmethod
    async def get_ice_knowledge_summary() -> Dict[str, Any]:
        """
        Get ICE knowledge base summary.
        
        Returns:
            Summary with record counts and stats
        """
        try:
            # Check if pgvector is available
            pgvector_check = await execute_one(
                "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') as available"
            )
            vector_available = pgvector_check['available'] if pgvector_check else False
            
            stats = {
                "vector_available": vector_available,
                "vector_count": 0,
                "encompass_docs_count": 0
            }
            
            if vector_available:
                # Count ICE knowledge chunks with embeddings
                ice_count = await execute_one(
                    "SELECT COUNT(*)::int as n FROM ice_knowledge_chunks WHERE embedding IS NOT NULL"
                )
                stats["vector_count"] = ice_count['n'] if ice_count else 0
                
                # Count Encompass docs chunks
                docs_count = await execute_one(
                    "SELECT COUNT(*)::int as n FROM encompass_docs_chunks"
                )
                stats["encompass_docs_count"] = docs_count['n'] if docs_count else 0
            
            logger.info("Retrieved ICE knowledge summary", **stats)
            return stats
            
        except Exception as e:
            logger.error("Failed to get ICE knowledge summary", error=str(e))
            raise
    
    @staticmethod
    async def search_ice_knowledge(
        query: str,
        limit: int = 10,
        source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search ICE knowledge base using keyword search.
        
        Args:
            query: Search query
            limit: Max results
            source_type: Filter by source type
            
        Returns:
            List of matching knowledge records
        """
        try:
            # Build query with text search
            sql = """
                SELECT 
                    id, source_type, repo, path, title, 
                    excerpt, url, tags, chunk_index,
                    ts_rank(
                        to_tsvector('english', content),
                        plainto_tsquery('english', $1)
                    ) as rank
                FROM ice_knowledge_chunks
                WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            """
            params = [query]
            
            if source_type:
                sql += " AND source_type = $2"
                params.append(source_type)
            
            sql += " ORDER BY rank DESC, chunk_index ASC LIMIT $" + str(len(params) + 1)
            params.append(limit)
            
            logger.info("Searching ICE knowledge", query=query, limit=limit)
            
            rows = await execute_query(sql, *params)
            results = [dict(row) for row in rows]
            
            logger.info("ICE knowledge search complete", results=len(results))
            return results
            
        except Exception as e:
            logger.error("Failed to search ICE knowledge", error=str(e))
            raise
    
    @staticmethod
    async def search_encompass_docs(
        query: str,
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search Encompass documentation.
        
        Args:
            query: Search query
            limit: Max results
            category: Filter by category
            
        Returns:
            List of matching doc sections
        """
        try:
            sql = """
                SELECT 
                    id, category, title, url, chunk_index,
                    content_hash,
                    ts_rank(
                        to_tsvector('english', content),
                        plainto_tsquery('english', $1)
                    ) as rank
                FROM encompass_docs_chunks
                WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            """
            params = [query]
            
            if category:
                sql += " AND category = $2"
                params.append(category)
            
            sql += " ORDER BY rank DESC, chunk_index ASC LIMIT $" + str(len(params) + 1)
            params.append(limit)
            
            logger.info("Searching Encompass docs", query=query, limit=limit)
            
            rows = await execute_query(sql, *params)
            results = [dict(row) for row in rows]
            
            logger.info("Encompass docs search complete", results=len(results))
            return results
            
        except Exception as e:
            logger.error("Failed to search Encompass docs", error=str(e))
            raise
    
    @staticmethod
    async def get_loan_field_info(field_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about an Encompass field ID.
        
        Args:
            field_id: Field ID (e.g., "4000", "1172", "URLA.X75")
            
        Returns:
            Field information if found
        """
        try:
            # Search ICE knowledge for field references
            rows = await execute_query(
                """
                SELECT 
                    title, excerpt, content, url, source_type
                FROM ice_knowledge_chunks
                WHERE content ILIKE $1
                ORDER BY chunk_index ASC
                LIMIT 5
                """,
                f"%{field_id}%"
            )
            
            if not rows:
                return None
            
            # Combine results
            field_info = {
                "field_id": field_id,
                "references": [dict(row) for row in rows]
            }
            
            logger.info("Retrieved loan field info", field_id=field_id)
            return field_info
            
        except Exception as e:
            logger.error("Failed to get loan field info", error=str(e))
            raise
