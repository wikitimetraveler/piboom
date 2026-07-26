"""
RAG (Retrieval Augmented Generation) Service.
Handles embedding generation, semantic search, and context preparation.
"""
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import structlog
import json
import hashlib

from database import execute_query, execute_one, execute_command
from config import Config

logger = structlog.get_logger()


class RAGService:
    """Service for RAG operations."""
    
    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = 1200,
        overlap: int = 150
    ) -> List[str]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Text to chunk
            chunk_size: Target chunk size in characters
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        text = text.strip()
        
        if not text:
            return []
        
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(len(text), start + chunk_size)
            chunks.append(text[start:end])
            
            if end >= len(text):
                break
            
            start = max(0, end - overlap)
        
        return chunks
    
    @staticmethod
    def hash_content(text: str) -> str:
        """
        Generate content hash for deduplication.
        
        Args:
            text: Content to hash
            
        Returns:
            32-character hex hash
        """
        return hashlib.sha256(text.encode('utf-8')).hexdigest()[:32]
    
    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec_a: First vector
            vec_b: Second vector
            
        Returns:
            Similarity score (0-1)
        """
        a = np.array(vec_a)
        b = np.array(vec_b)
        
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot_product / (norm_a * norm_b))
    
    @staticmethod
    async def semantic_search_ice(
        query_embedding: List[float],
        limit: int = 10,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search on ICE knowledge using vector similarity.
        
        Args:
            query_embedding: Query vector (1536 dimensions)
            limit: Max results
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of results with similarity scores
        """
        try:
            # Convert embedding to pgvector format
            vector_str = '[' + ','.join(map(str, query_embedding)) + ']'
            
            sql = """
                SELECT 
                    id, source_type, repo, path, title, 
                    excerpt, url, tags, chunk_index,
                    1 - (embedding <=> $1::vector) as similarity
                FROM ice_knowledge_chunks
                WHERE embedding IS NOT NULL
                  AND (1 - (embedding <=> $1::vector)) >= $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
            """
            
            logger.info(
                "Performing semantic search on ICE knowledge",
                limit=limit,
                threshold=similarity_threshold
            )
            
            rows = await execute_query(sql, vector_str, similarity_threshold, limit)
            results = [dict(row) for row in rows]
            
            logger.info("Semantic search complete", results=len(results))
            return results
            
        except Exception as e:
            logger.error("Failed semantic search on ICE knowledge", error=str(e))
            raise
    
    @staticmethod
    async def semantic_search_docs(
        query_embedding: List[float],
        limit: int = 10,
        similarity_threshold: float = 0.7,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search on Encompass docs using vector similarity.
        
        Args:
            query_embedding: Query vector
            limit: Max results
            similarity_threshold: Minimum similarity score
            category: Optional category filter
            
        Returns:
            List of results with similarity scores
        """
        try:
            vector_str = '[' + ','.join(map(str, query_embedding)) + ']'
            
            sql = """
                SELECT 
                    id, category, title, url, chunk_index,
                    content_hash,
                    1 - (embedding <=> $1::vector) as similarity
                FROM encompass_docs_chunks
                WHERE embedding IS NOT NULL
                  AND (1 - (embedding <=> $1::vector)) >= $2
            """
            params = [vector_str, similarity_threshold]
            
            if category:
                sql += " AND category = $3"
                params.append(category)
            
            sql += " ORDER BY embedding <=> $1::vector LIMIT $" + str(len(params) + 1)
            params.append(limit)
            
            logger.info(
                "Performing semantic search on Encompass docs",
                limit=limit,
                threshold=similarity_threshold,
                category=category
            )
            
            rows = await execute_query(sql, *params)
            results = [dict(row) for row in rows]
            
            logger.info("Semantic search complete", results=len(results))
            return results
            
        except Exception as e:
            logger.error("Failed semantic search on Encompass docs", error=str(e))
            raise
    
    @staticmethod
    async def hybrid_search(
        query: str,
        query_embedding: Optional[List[float]] = None,
        limit: int = 10,
        keyword_weight: float = 0.3,
        vector_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining keyword and semantic search.
        
        Args:
            query: Search query text
            query_embedding: Optional query vector
            limit: Max results
            keyword_weight: Weight for keyword scores
            vector_weight: Weight for vector scores
            
        Returns:
            Combined and re-ranked results
        """
        try:
            # Keyword search on ICE knowledge
            keyword_sql = """
                SELECT 
                    id, source_type, repo, path, title, 
                    excerpt, url, tags, chunk_index,
                    ts_rank(
                        to_tsvector('english', content),
                        plainto_tsquery('english', $1)
                    ) as keyword_score,
                    0.0 as vector_score
                FROM ice_knowledge_chunks
                WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
                LIMIT $2
            """
            
            keyword_results = await execute_query(keyword_sql, query, limit * 2)
            results_map = {row['id']: dict(row) for row in keyword_results}
            
            # Vector search if embedding provided
            if query_embedding:
                vector_str = '[' + ','.join(map(str, query_embedding)) + ']'
                
                vector_sql = """
                    SELECT 
                        id,
                        1 - (embedding <=> $1::vector) as vector_score
                    FROM ice_knowledge_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> $1::vector
                    LIMIT $2
                """
                
                vector_results = await execute_query(vector_sql, vector_str, limit * 2)
                
                # Merge vector scores
                for row in vector_results:
                    row_id = row['id']
                    if row_id in results_map:
                        results_map[row_id]['vector_score'] = float(row['vector_score'])
                    else:
                        # Fetch the record
                        record = await execute_one(
                            """
                            SELECT id, source_type, repo, path, title, 
                                   excerpt, url, tags, chunk_index
                            FROM ice_knowledge_chunks 
                            WHERE id = $1
                            """,
                            row_id
                        )
                        if record:
                            record_dict = dict(record)
                            record_dict['keyword_score'] = 0.0
                            record_dict['vector_score'] = float(row['vector_score'])
                            results_map[row_id] = record_dict
            
            # Calculate combined scores
            for result in results_map.values():
                kw_score = float(result.get('keyword_score', 0))
                vec_score = float(result.get('vector_score', 0))
                result['combined_score'] = (
                    keyword_weight * kw_score + vector_weight * vec_score
                )
            
            # Sort by combined score
            ranked_results = sorted(
                results_map.values(),
                key=lambda x: x['combined_score'],
                reverse=True
            )[:limit]
            
            logger.info(
                "Hybrid search complete",
                query=query,
                results=len(ranked_results)
            )
            
            return ranked_results
            
        except Exception as e:
            logger.error("Failed hybrid search", error=str(e))
            raise
    
    @staticmethod
    async def prepare_rag_context(
        search_results: List[Dict[str, Any]],
        max_tokens: int = 3000,
        chars_per_token: float = 4.0
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Prepare context string from search results for RAG prompts.
        
        Args:
            search_results: Results from semantic/hybrid search
            max_tokens: Maximum context tokens
            chars_per_token: Approximate characters per token
            
        Returns:
            Tuple of (context_string, included_sources)
        """
        max_chars = int(max_tokens * chars_per_token)
        context_parts = []
        included_sources = []
        current_length = 0
        
        for i, result in enumerate(search_results):
            # Format result as context
            source_info = f"Source {i+1}"
            if result.get('title'):
                source_info += f": {result['title']}"
            if result.get('url'):
                source_info += f" ({result['url']})"
            
            content = result.get('excerpt') or result.get('content', '')
            
            # Format as context block
            block = f"\n\n{source_info}\n{content}"
            block_length = len(block)
            
            if current_length + block_length > max_chars:
                # Try to fit a truncated version
                remaining = max_chars - current_length
                if remaining > 200:  # Only if meaningful space left
                    truncated_content = content[:remaining-100] + "..."
                    block = f"\n\n{source_info}\n{truncated_content}"
                    context_parts.append(block)
                    included_sources.append(result)
                break
            
            context_parts.append(block)
            included_sources.append(result)
            current_length += block_length
        
        context_string = ''.join(context_parts)
        
        logger.info(
            "Prepared RAG context",
            sources_used=len(included_sources),
            total_chars=len(context_string),
            estimated_tokens=len(context_string) / chars_per_token
        )
        
        return context_string, included_sources
    
    @staticmethod
    async def get_similar_documents(
        doc_id: int,
        table_name: str = 'ice_knowledge_chunks',
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Find similar documents based on vector similarity.
        
        Args:
            doc_id: Document ID to find similar to
            table_name: Table name (ice_knowledge_chunks or encompass_docs_chunks)
            limit: Max results
            
        Returns:
            List of similar documents
        """
        try:
            # Get the source document's embedding
            source_doc = await execute_one(
                f"SELECT embedding FROM {table_name} WHERE id = $1 AND embedding IS NOT NULL",
                doc_id
            )
            
            if not source_doc or not source_doc.get('embedding'):
                return []
            
            # Find similar documents
            sql = f"""
                SELECT 
                    id, title, url,
                    1 - (embedding <=> $1) as similarity
                FROM {table_name}
                WHERE id != $2
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> $1
                LIMIT $3
            """
            
            rows = await execute_query(sql, source_doc['embedding'], doc_id, limit)
            results = [dict(row) for row in rows]
            
            logger.info(
                "Found similar documents",
                doc_id=doc_id,
                table=table_name,
                results=len(results)
            )
            
            return results
            
        except Exception as e:
            logger.error("Failed to find similar documents", error=str(e))
            raise
