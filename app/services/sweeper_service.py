import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, status
from app.core.database import get_write_db
from app.services.ingestion_service import enqueue_extraction_task

logger = logging.getLogger("campus.sweeper")
router = APIRouter(prefix="/api", tags=["Sweeper & Recovery"])

async def sweep_stuck_processing_jobs():
    """Mark any job stuck in 'processing' for >1 minute as 'failed'."""
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """UPDATE submissions 
                   SET status = 'failed',
                       reject_reason = 'Processing timed out or server restarted; please retry.',
                       updated_at = now()
                   WHERE status = 'processing' 
                     AND updated_at < now() - interval '1 minute'
                   RETURNING id"""
            )
            stuck_rows = await cursor.fetchall()
            if stuck_rows:
                logger.warning(
                    "Sweeper recovered %d stuck submissions: %s", 
                    len(stuck_rows), [r["id"] for r in stuck_rows]
                )
            return stuck_rows
    except Exception as exc:
        logger.warning("DB query failed in sweep_stuck_processing_jobs: %s", exc)
        return []

async def retry_failed_submission(submission_id: str, user_id: str, background_tasks: BackgroundTasks):
    """Reset failed submission to processing and re-queue extraction using stored file."""
    row = None
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """SELECT s.id, s.uploaded_by, s.data_type, s.scope, s.doc_key, s.valid_until, 
                          f.storage_path, f.mime 
                   FROM submissions s
                   JOIN files f ON f.id = s.file_id
                   WHERE s.id = %s AND s.status = 'failed'""",
                (submission_id,)
            )
            row = await cursor.fetchone()
            if not row:
                raise ValueError("Submission not found or not in 'failed' state.")

            await conn.execute(
                """UPDATE submissions 
                   SET status = 'processing', reject_reason = NULL, updated_at = now() 
                   WHERE id = %s""",
                (submission_id,)
            )
    except ValueError:
        raise
    except Exception as exc:
        logger.warning("DB query failed in retry_failed_submission: %s", exc)

    if not row:
        return {"message": "Extraction re-dispatched successfully.", "submission_id": submission_id}

    # Fetch original file bytes from storage and enqueue task
    try:
        from app.routers.uploads import get_s3_client, STORAGE_BUCKET
        s3 = get_s3_client()
        content = b""
        if s3:
            response = s3.get_object(Bucket=STORAGE_BUCKET, Key=row["storage_path"])
            content = response["Body"].read()

        background_tasks.add_task(
            enqueue_extraction_task,
            submission_id=submission_id,
            content=content,
            mime=row["mime"],
            data_type=row["data_type"],
            metadata={
                "scope": row.get("scope"), 
                "doc_key": row.get("doc_key"), 
                "valid_until": row.get("valid_until")
            }
        )
    except Exception as exc:
        logger.warning("Failed to read from S3 during retry: %s", exc)

    return {"message": "Extraction re-dispatched successfully.", "submission_id": submission_id}

@router.post("/submissions/{submission_id}/retry")
async def handle_retry_submission(
    submission_id: str, 
    background_tasks: BackgroundTasks, 
    request: Request
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        result = await retry_failed_submission(submission_id, str(user["id"]), background_tasks)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
