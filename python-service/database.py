"""
Database connection management for Python service.
Provides async connection pool using asyncpg and sync connections using psycopg2.
"""
import asyncpg
import psycopg2
from psycopg2 import pool
from contextlib import asynccontextmanager, contextmanager
from typing import Optional
import structlog

from config import Config

logger = structlog.get_logger()

# Connection pools
_async_pool: Optional[asyncpg.Pool] = None
_sync_pool: Optional[pool.ThreadedConnectionPool] = None


async def init_async_pool():
    """Initialize async connection pool."""
    global _async_pool
    
    if _async_pool is None:
        try:
            logger.info("Initializing async database pool", url=Config.DATABASE_URL.split('@')[1] if '@' in Config.DATABASE_URL else 'local')
            _async_pool = await asyncpg.create_pool(
                Config.DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("Async database pool initialized")
        except Exception as e:
            logger.error("Failed to initialize async pool", error=str(e))
            raise
    
    return _async_pool


def init_sync_pool():
    """Initialize sync connection pool for blocking operations."""
    global _sync_pool
    
    if _sync_pool is None:
        try:
            logger.info("Initializing sync database pool")
            _sync_pool = pool.ThreadedConnectionPool(
                minconn=2,
                maxconn=10,
                dsn=Config.DATABASE_URL
            )
            logger.info("Sync database pool initialized")
        except Exception as e:
            logger.error("Failed to initialize sync pool", error=str(e))
            raise
    
    return _sync_pool


async def close_async_pool():
    """Close async connection pool."""
    global _async_pool
    
    if _async_pool:
        logger.info("Closing async database pool")
        await _async_pool.close()
        _async_pool = None


def close_sync_pool():
    """Close sync connection pool."""
    global _sync_pool
    
    if _sync_pool:
        logger.info("Closing sync database pool")
        _sync_pool.closeall()
        _sync_pool = None


@asynccontextmanager
async def get_async_connection():
    """Get async database connection from pool."""
    pool = await init_async_pool()
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)


@contextmanager
def get_sync_connection():
    """Get sync database connection from pool."""
    pool = init_sync_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


async def execute_query(query: str, *args):
    """Execute a query and return results."""
    async with get_async_connection() as conn:
        return await conn.fetch(query, *args)


async def execute_one(query: str, *args):
    """Execute a query and return one result."""
    async with get_async_connection() as conn:
        return await conn.fetchrow(query, *args)


async def execute_command(query: str, *args):
    """Execute a command (INSERT, UPDATE, DELETE)."""
    async with get_async_connection() as conn:
        return await conn.execute(query, *args)


async def health_check() -> bool:
    """Check if database connection is healthy."""
    try:
        async with get_async_connection() as conn:
            result = await conn.fetchval('SELECT 1')
            return result == 1
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return False
