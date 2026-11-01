import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Any
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from app.core.config import settings, ensure_ipv4_supabase_url

logger = logging.getLogger("campus.database")

DATABASE_URL = ensure_ipv4_supabase_url(os.environ.get("DATABASE_URL", settings.DATABASE_URL))
DATABASE_URL_READONLY = ensure_ipv4_supabase_url(os.environ.get("DATABASE_URL_READONLY", settings.DATABASE_URL_READONLY))

# Invariant: max_size=5 per pool to stay well within container & free-tier limits
# prepare_threshold=None explicitly disables prepared statements for transaction pooler compatibility (Supabase / Neon / PgBouncer)
write_pool = AsyncConnectionPool(
    conninfo=DATABASE_URL,
    min_size=1,
    max_size=5,
    timeout=10.0,
    max_lifetime=1800.0,
    max_idle=300.0,
    check=AsyncConnectionPool.check_connection,
    open=False,
    kwargs={"row_factory": dict_row, "prepare_threshold": None}
)

read_pool = AsyncConnectionPool(
    conninfo=DATABASE_URL_READONLY,
    min_size=1,
    max_size=5,
    timeout=5.0,
    max_lifetime=1800.0,
    max_idle=300.0,
    check=AsyncConnectionPool.check_connection,
    open=False,
    kwargs={"row_factory": dict_row, "prepare_threshold": None}
)

# Allow database connection override for unit testing / mock harnesses
_override_read_db = None
_override_write_db = None

def set_db_overrides(read_db=None, write_db=None):
    global _override_read_db, _override_write_db
    _override_read_db = read_db
    _override_write_db = write_db

async def init_db_pools():
    logger.info("Initializing async database connection pools...")
    try:
        await write_pool.open()
        await read_pool.open()
        logger.info("Async database connection pools initialized successfully.")
    except Exception as exc:
        logger.warning("Could not connect to database pools during initialization: %s", exc)

async def close_db_pools():
    logger.info("Closing async database connection pools...")
    try:
        await read_pool.close()
    except Exception as exc:
        logger.warning("Error closing read pool: %s", exc)
    try:
        await write_pool.close()
    except Exception as exc:
        logger.warning("Error closing write pool: %s", exc)

@asynccontextmanager
async def get_read_db() -> AsyncGenerator[Any, None]:
    if _override_read_db is not None:
        async with _override_read_db() as conn:
            yield conn
        return
    async with read_pool.connection() as conn:
        yield conn

@asynccontextmanager
async def get_write_db() -> AsyncGenerator[Any, None]:
    if _override_write_db is not None:
        async with _override_write_db() as conn:
            yield conn
        return
    async with write_pool.connection() as conn:
        async with conn.transaction():
            yield conn
