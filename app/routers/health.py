from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.database import get_read_db

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/healthz")
async def healthz():
    db_status = "connected"
    try:
        async with get_read_db() as conn:
            cursor = await conn.execute("SELECT 1 as healthy")
            row = await cursor.fetchone()
            if not row or row["healthy"] != 1:
                db_status = "degraded"
    except Exception:
        db_status = "unavailable"

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status
    }
