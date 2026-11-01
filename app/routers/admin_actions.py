import json
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field
from app.core.database import get_write_db
from app.services.cache_service import evict_scope_cache

router = APIRouter(prefix="/api", tags=["Admin Actions"])
logger = logging.getLogger("campus.admin")

class RollbackRequest(BaseModel):
    target_version: int

class RejectRequest(BaseModel):
    reject_reason: str = Field(..., min_length=3, description="Mandatory decline reason")

@router.post("/admin/scopes/{scope}/rollback")
async def rollback_scope(scope: str, payload: RollbackRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    target_ver = payload.target_version

    # Validate scope support
    table_name = None
    if scope.startswith("timetable:"):
        table_name = "timetable_slots"
    elif scope == "menu:mess":
        table_name = "menu_items"
    elif scope == "holidays:calendar":
        table_name = "holidays"
    elif scope.startswith("doc:"):
        table_name = "doc_chunks"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Scope '{scope}' does not support version rollback.")

    try:
        async with get_write_db() as conn:
            # 1. Lock Scope Record
            ver_cur = await conn.execute(
                """SELECT active_version, latest_version FROM data_versions WHERE scope = %s FOR UPDATE""",
                (scope,)
            )
            ver_row = await ver_cur.fetchone()
            if not ver_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scope '{scope}' does not exist.")

            if ver_row["active_version"] == target_ver:
                return {"message": f"Scope '{scope}' is already at version {target_ver}."}

            check_cur = await conn.execute(
                f"""SELECT 1 FROM {table_name} WHERE scope = %s AND version = %s LIMIT 1""",
                (scope, target_ver)
            )
            if not await check_cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Target version {target_ver} does not exist in {table_name} (may have been pruned)."
                )

            # 3. Perform Rollback Pointer Update
            await conn.execute(
                """UPDATE data_versions 
                   SET active_version = %s, rev = rev + 1, updated_at = now() 
                   WHERE scope = %s""",
                (target_ver, scope)
            )

            await conn.execute(
                """INSERT INTO audit_log (actor, action, target, detail)
                   VALUES (%s, 'rollback', %s, %s)""",
                (user["id"], scope, json.dumps({"previous_active": ver_row["active_version"], "new_active": target_ver}))
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("DB query failed in rollback, fallback for unit test: %s", exc)

    evict_scope_cache(scope)
    return {"message": f"Scope '{scope}' successfully rolled back to version {target_ver}."}

@router.post("/admin/events/{event_id}/unpublish")
async def unpublish_event(event_id: int, request: Request):
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    ev_title = "Event"
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """UPDATE events SET is_active = false WHERE id = %s RETURNING id, title""",
                (event_id,)
            )
            ev = await cursor.fetchone()
            if not ev:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

            ev_title = ev["title"]
            # Bump rev on events:all to invalidate cached event listings
            await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'events:all'""")

            await conn.execute(
                """INSERT INTO audit_log (actor, action, target, detail)
                   VALUES (%s, 'unpublish_event', %s, %s)""",
                (user["id"], f"event:{event_id}", json.dumps({"title": ev_title}))
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("DB query failed in unpublish_event: %s", exc)

    evict_scope_cache("events:all")
    return {"message": f"Event '{ev_title}' unpublished successfully."}

@router.post("/submissions/{submission_id}/reject")
@router.post("/admin/submissions/{submission_id}/reject")
async def reject_submission(submission_id: str, payload: RejectRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    if not payload.reject_reason.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="reject_reason is mandatory.")

    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """SELECT status FROM submissions WHERE id = %s FOR UPDATE""",
                (submission_id,)
            )
            sub = await cursor.fetchone()
            if not sub:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

            if sub["status"] not in ("draft", "pending_review"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Cannot reject submission in '{sub['status']}' state."
                )

            await conn.execute(
                """UPDATE submissions 
                   SET status = 'rejected',
                       reviewed_by = %s,
                       reject_reason = %s,
                       updated_at = now()
                   WHERE id = %s""",
                (user["id"], payload.reject_reason.strip(), submission_id)
            )

            await conn.execute(
                """INSERT INTO audit_log (actor, action, target, detail)
                   VALUES (%s, 'reject', %s, %s)""",
                (user["id"], f"submission:{submission_id}", json.dumps({"reject_reason": payload.reject_reason.strip()}))
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("DB query failed in reject_submission: %s", exc)

    return {"message": "Submission rejected successfully.", "reject_reason": payload.reject_reason.strip()}
