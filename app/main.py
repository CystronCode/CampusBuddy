import sys
import asyncio
import logging
from contextlib import asynccontextmanager

# Configure Windows event loop policy for psycopg 3 async compatibility
if sys.platform == "win32":
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db_pools, close_db_pools
from app.core.middleware import SessionSecurityMiddleware
from app.routers.auth import router as auth_router
from app.routers.me import router as me_router
from app.routers.health import router as health_router
from app.routers.uploads import router as uploads_router
from app.routers.approval import router as approval_router
from app.routers.admin_actions import router as admin_actions_router
from app.services.sweeper_service import router as sweeper_router, sweep_stuck_processing_jobs
from app.routers.student_queries import router as student_queries_router
from app.routers.v1_compat import router as v1_compat_router
from app.mcp_server import mcp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("campus.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Campus Intelligence API initializing...")
    await init_db_pools()
    # Execute stuck job sweeper on startup
    await sweep_stuck_processing_jobs()
    yield
    logger.info("Campus Intelligence API shutting down...")
    await close_db_pools()

app = FastAPI(
    title="Campus Intelligence API",
    version="1.0.0",
    description="Production MVP Backend for Campus Intelligence",
    lifespan=lifespan
)

# CORS Middleware for web browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=settings.ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Session Security & CSRF Middleware
app.add_middleware(SessionSecurityMiddleware)

# Mount Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(me_router)
app.include_router(uploads_router)
app.include_router(approval_router)
app.include_router(admin_actions_router)
app.include_router(sweeper_router)
app.include_router(student_queries_router)
app.include_router(v1_compat_router)

# Mount Official FastMCP Streamable HTTP Server
app.mount(
    "/mcp",
    mcp.streamable_http_app(streamable_http_path="/", json_response=True, stateless_http=True)
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
