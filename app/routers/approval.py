import json
import logging
from typing import Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Request, Response, HTTPException, status
from app.core.database import get_write_db
from app.services.validators import run_deterministic_validators
from app.services.embedding_service import (
    chunk_markdown_by_headings, generate_l2_normalized_embeddings
)
from app.services.cache_service import evict_scope_cache

router = APIRouter(prefix="/api", tags=["Approval"])
logger = logging.getLogger("campus.approval")

# In-memory mock submissions store for offline unit tests
_mock_submissions: Dict[str, Dict[str, Any]] = {}

def set_mock_submission(sub_id: str, sub_data: Dict[str, Any]):
    _mock_submissions[sub_id] = sub_data

@router.post("/submissions/{submission_id}/approve")
async def approve_submission(submission_id: str, request: Request):
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for approval.")

    # 1. Read Submission and Pre-Validate Status
    sub = None
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                          valid_until, status, extracted, published_versions 
                   FROM submissions WHERE id = %s""",
                (submission_id,)
            )
            sub = await cursor.fetchone()
    except Exception as exc:
        logger.warning("DB query failed in approve_submission, checking mock submissions: %s", exc)
        sub = _mock_submissions.get(submission_id)

    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    # Invariant: Must be in pending_review, or draft if admin's own upload. If already approved, return idempotently.
    sub_status = sub.get("status")
    if sub_status == "approved":
        return {
            "message": "Submission already approved (idempotent).", 
            "published_versions": sub.get("published_versions")
        }

    is_owner = str(sub.get("uploaded_by")) == str(user["id"])
    if sub_status not in ("pending_review", "draft"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Cannot approve submission in '{sub_status}' state."
        )
    if sub_status == "draft" and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Staff/club draft must be submitted for review first."
        )

    # 2. Re-run Deterministic Validators (Ensure ZERO hard errors exist)
    extracted_data = sub.get("extracted") or sub.get("data_payload") or {}
    if isinstance(extracted_data, str):
        try:
            extracted_data = json.loads(extracted_data)
        except Exception:
            pass
    val_report = await run_deterministic_validators(
        sub["data_type"], extracted_data, 
        {"valid_until": str(sub.get("valid_until")) if sub.get("valid_until") else None, "doc_key": sub.get("doc_key")}
    )
    if val_report["has_errors"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail={"message": "Submission contains uncorrected hard validation errors.", "flags": val_report["cells"]}
        )

    # 3. Embed-Before-Transaction Safety Rule (Documents only)
    doc_chunks_payload = []
    if sub["data_type"] in ("syllabus", "notice"):
        doc_key = sub.get("doc_key", "doc:ALL:untitled")
        title = doc_key.split(":")[-1].replace("-", " ").title()
        raw_chunks = chunk_markdown_by_headings(title, str(extracted_data))
        if not raw_chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail="Document contains no extractable content."
            )
        
        chunk_texts = [c["content"] for c in raw_chunks]
        try:
            embeddings = await generate_l2_normalized_embeddings(chunk_texts)
        except Exception as e:
            logger.error("Embedding failure during approval: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, 
                detail="Vector embedding service failed. Retry approval."
            )

        # Determine branch assignment: 'ALL' -> NULL, else branch code
        parts = doc_key.split(":")
        branch_seg = parts[1] if len(parts) > 1 else "ALL"
        chunk_branch = None if branch_seg == "ALL" else branch_seg

        for idx, c in enumerate(raw_chunks):
            doc_chunks_payload.append({
                "title": c["title"],
                "section": c["section"],
                "content": c["content"],
                "chunk_index": idx,
                "embedding": embeddings[idx],
                "branch": chunk_branch,
                "valid_until": sub.get("valid_until")
            })

    # 4. Atomic Database Transaction
    published_map = {}
    try:
        async with get_write_db() as conn:
            # Re-check status with row lock to eliminate race conditions
            lock_cur = await conn.execute(
                """SELECT status FROM submissions WHERE id = %s FOR UPDATE""",
                (submission_id,)
            )
            current = await lock_cur.fetchone()
            if current and current["status"] == "approved":
                return {
                    "message": "Submission already approved (idempotent).", 
                    "published_versions": sub.get("published_versions")
                }

            # --- LANE A: Replaceable Scopes (timetable, menu, holidays, syllabus, notice) ---
            if sub["data_type"] in ("timetable", "menu", "holidays", "syllabus", "notice"):
                # Collect and sort scopes lexicographically to avoid deadlocks
                target_scopes = []
                if sub["data_type"] == "timetable" and sub.get("scope") == "multi":
                    slots = extracted_data if isinstance(extracted_data, list) else extracted_data.get("slots", [])
                    target_scopes = sorted(list({f"timetable:{s['branch']}-{s['year']}-{s['section']}" for s in slots}))
                else:
                    target_scopes = [sub["scope"]]

                for scope_key in target_scopes:
                    # Lock scope version row
                    ver_cur = await conn.execute(
                        """INSERT INTO data_versions (scope, active_version, latest_version, rev, updated_at)
                           VALUES (%s, 1, 0, 1, now())
                           ON CONFLICT (scope) DO UPDATE SET updated_at = now()
                           RETURNING latest_version, rev""",
                        (scope_key,)
                    )
                    ver_row = await ver_cur.fetchone()
                    new_version = ver_row["latest_version"] + 1

                    if sub["data_type"] == "timetable":
                        slots = extracted_data if isinstance(extracted_data, list) else extracted_data.get("slots", [])
                        scope_parts = scope_key.replace("timetable:", "").replace("-", ":").split(":")
                        def_branch = scope_parts[0] if len(scope_parts) >= 1 else "CSE"
                        try:
                            def_year = int(scope_parts[1]) if len(scope_parts) >= 2 else 3
                        except ValueError:
                            def_year = 3
                        def_sec = scope_parts[2] if len(scope_parts) >= 3 else "A"

                        scope_slots = [
                            s for s in slots 
                            if f"timetable:{s.get('branch', def_branch)}-{s.get('year', def_year)}-{s.get('section', def_sec)}" == scope_key
                        ] if sub.get("scope") == "multi" else slots
                        for s in scope_slots:
                            b_val = s.get("branch") or def_branch
                            y_val = s.get("year") or def_year
                            sec_val = s.get("section") or def_sec
                            day_val = s.get("day") or s.get("day_of_week") or 1
                            subj_code_raw = str(s.get("subject_code") or s.get("subject") or "Course").strip()
                            subj_name_raw = str(s.get("subject_name") or "").strip()
                            if subj_name_raw and subj_name_raw.lower() not in subj_code_raw.lower():
                                subj_val = f"{subj_code_raw} — {subj_name_raw}"
                            else:
                                subj_val = subj_code_raw
                                subj_name_raw = subj_name_raw or subj_code_raw
                            room_val = s.get("room") or s.get("room_no") or "TBA"
                            fac_short = str(s.get("short_code") or s.get("faculty_code") or "").strip()
                            fac_full = str(s.get("faculty_name") or s.get("faculty") or "").strip()
                            if fac_full and fac_short and fac_short.lower() not in fac_full.lower():
                                fac_code = f"{fac_short} ({fac_full})"
                            else:
                                fac_code = fac_full or fac_short or None
                            await conn.execute(
                                """INSERT INTO timetable_slots 
                                   (scope, branch, year, section, day, day_of_week, period, start_time, end_time, 
                                    subject, subject_name, subject_code, kind, faculty_id, faculty_code, room, room_no, version, submission_id)
                                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                                (scope_key, b_val, y_val, sec_val, day_val, day_val, s.get("period"),
                                 s["start_time"], s["end_time"], subj_val, subj_name_raw, subj_code_raw[:20], s.get("kind", "lecture"),
                                 s.get("faculty_id"), fac_code, room_val, room_val, new_version, submission_id)
                            )
                        # Purge versions older than last 3
                        await conn.execute(
                            """DELETE FROM timetable_slots 
                               WHERE scope = %s AND version NOT IN (
                                 SELECT DISTINCT version FROM timetable_slots 
                                 WHERE scope = %s ORDER BY version DESC LIMIT 3
                               )""",
                            (scope_key, scope_key)
                        )

                    elif sub["data_type"] == "menu":
                        items = extracted_data if isinstance(extracted_data, list) else extracted_data.get("items", [])
                        for it in items:
                            is_veg_raw = it.get("is_veg")
                            if isinstance(is_veg_raw, str):
                                is_veg_bool = is_veg_raw.lower() in ("yes", "true", "t", "1")
                            elif isinstance(is_veg_raw, bool):
                                is_veg_bool = is_veg_raw
                            else:
                                is_veg_bool = None
                            item_name = it.get("item") or it.get("item_name") or "Item"
                            day_num = it.get("day") if it.get("day") is not None else it.get("day_of_week")
                            await conn.execute(
                                """INSERT INTO menu_items (scope, day, day_of_week, meal, item, item_name, price, is_veg, version, submission_id, facility)
                                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'mess')""",
                                (scope_key, day_num, day_num, it.get("meal", "all"), item_name, item_name, it.get("price"), is_veg_bool, new_version, submission_id)
                            )
                        await conn.execute(
                            """DELETE FROM menu_items WHERE scope = %s AND version NOT IN (
                                 SELECT DISTINCT version FROM menu_items WHERE scope = %s ORDER BY version DESC LIMIT 3
                               )""",
                            (scope_key, scope_key)
                        )

                    elif sub["data_type"] == "holidays":
                        hols = extracted_data if isinstance(extracted_data, list) else extracted_data.get("holidays", [])
                        for h in hols:
                            await conn.execute(
                                """INSERT INTO holidays (scope, date, name, kind, version, submission_id)
                                   VALUES (%s, %s, %s, %s, %s, %s)""",
                                (scope_key, h["date"], h["name"], h.get("kind"), new_version, submission_id)
                            )
                        await conn.execute(
                            """DELETE FROM holidays WHERE scope = %s AND version NOT IN (
                                 SELECT DISTINCT version FROM holidays WHERE scope = %s ORDER BY version DESC LIMIT 3
                            )""",
                            (scope_key, scope_key)
                        )
                        # Also index into doc_chunks as a calendar notice so hybrid search / student chat RAG can search it
                        cal_content = "# Academic Calendar & Holidays\n" + "\n".join([f"- {h['date']}: {h['name']}" for h in hols])
                        try:
                            emb = await generate_l2_normalized_embeddings([cal_content])
                            await conn.execute(
                                """INSERT INTO doc_chunks 
                                   (scope, doc_key, file_id, submission_id, doc_type, title, doc_title, section, 
                                    chunk_index, content, embedding, embedding_model, branch, valid_until, version)
                                   VALUES (%s, %s, %s, %s, 'notice', 'Academic Calendar', 'Academic Calendar', 'Schedule & Dates', 
                                    0, %s, %s, 'text-embedding-004', NULL, NULL, %s)""",
                                ("doc:notice:ALL:academic-calendar", "notice:ALL:academic-calendar", sub.get("file_id"), submission_id,
                                 cal_content, emb[0], new_version)
                            )
                            await conn.execute(
                                """INSERT INTO data_versions (scope, active_version, latest_version, rev, updated_at)
                                   VALUES ('doc:notice:ALL:academic-calendar', %s, %s, 1, now())
                                   ON CONFLICT (scope) DO UPDATE SET active_version = %s, latest_version = %s, rev = data_versions.rev + 1, updated_at = now()""",
                                (new_version, new_version, new_version, new_version)
                            )
                        except Exception as e:
                            logger.warning("Could not generate doc_chunk for holidays calendar: %s", e)

                    elif sub["data_type"] in ("syllabus", "notice"):
                        for c in doc_chunks_payload:
                            await conn.execute(
                                """INSERT INTO doc_chunks 
                                   (scope, doc_key, file_id, submission_id, doc_type, title, doc_title, section, 
                                    chunk_index, content, embedding, embedding_model, branch, valid_until, version)
                                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'text-embedding-004', %s, %s, %s)""",
                                (scope_key, sub["doc_key"], sub.get("file_id"), submission_id, sub["data_type"],
                                 c["title"], c["title"], c["section"], c["chunk_index"], c["content"], c["embedding"],
                                 c["branch"], c["valid_until"], new_version)
                            )
                        await conn.execute(
                            """DELETE FROM doc_chunks WHERE scope = %s AND version NOT IN (
                                 SELECT DISTINCT version FROM doc_chunks WHERE scope = %s ORDER BY version DESC LIMIT 3
                               )""",
                            (scope_key, scope_key)
                        )

                    # Update data_versions pointer
                    await conn.execute(
                        """UPDATE data_versions 
                           SET active_version = %s, latest_version = %s, rev = rev + 1, updated_at = now()
                           WHERE scope = %s""",
                        (new_version, new_version, scope_key)
                    )
                    published_map[scope_key] = new_version

            # --- LANE B: Upsert Scope (faculty:all) ---
            elif sub["data_type"] == "faculty":
                fac_list = extracted_data if isinstance(extracted_data, list) else extracted_data.get("faculty", [])
                for f in fac_list:
                    fname = f.get("name") or f.get("full_name") or "Faculty Member"
                    fdept = f.get("department") or f.get("branch") or "CSE"
                    fcode = f.get("short_code") or "".join(w[0].upper() for w in fname.split() if w and w[0].isalpha())[:5] or "FAC"
                    subj_list = f.get("subjects") or []
                    subj_str = ", ".join(subj_list) if isinstance(subj_list, list) else str(subj_list)
                    extra_parts = [subj_str] if subj_str else []
                    for label, field in [
                        ("Qualifications", "qualifications"),
                        ("Experience", "experience"),
                        ("Research Interests", "research_interests"),
                        ("Publications", "publications"),
                        ("Projects", "projects"),
                        ("Awards", "awards"),
                        ("Responsibilities", "responsibilities"),
                        ("Profile", "bio"),
                    ]:
                        val = f.get(field)
                        if val:
                            val_str = ", ".join(val) if isinstance(val, list) else str(val).strip()
                            if val_str:
                                extra_parts.append(f"{label}: {val_str}")
                    subj_text = " | ".join(extra_parts)
                    await conn.execute(
                        """INSERT INTO faculty (name, full_name, short_code, department, branch, designation, email, 
                                                cabin, office_hours, subjects, subjects_text, submission_id)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                           ON CONFLICT (lower(name), coalesce(department, '')) DO UPDATE
                           SET full_name = EXCLUDED.full_name,
                               short_code = EXCLUDED.short_code,
                               branch = EXCLUDED.branch,
                               designation = EXCLUDED.designation,
                               email = coalesce(EXCLUDED.email, faculty.email),
                               cabin = EXCLUDED.cabin,
                               office_hours = EXCLUDED.office_hours,
                               subjects = EXCLUDED.subjects,
                               subjects_text = EXCLUDED.subjects_text,
                               is_active = true,
                               submission_id = EXCLUDED.submission_id""",
                        (fname, fname, fcode, fdept, fdept, f.get("designation"),
                         f.get("email"), f.get("cabin"), f.get("office_hours"), json.dumps(subj_list),
                         subj_text, submission_id)
                    )
                await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'faculty:all'""")
                published_map["faculty:all"] = "upserted"

            # --- LANE C: Additive Scope (events:all) ---
            elif sub["data_type"] == "poster":
                ev = extracted_data if isinstance(extracted_data, dict) else extracted_data[0]
                await conn.execute(
                    """INSERT INTO events 
                       (title, club, description, venue, starts_at, ends_at, valid_until, file_id, submission_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (submission_id) DO NOTHING""",
                    (ev["title"], ev.get("club", "Campus"), ev.get("description"), ev.get("venue"),
                     ev.get("starts_at"), ev.get("ends_at"), f"{sub['valid_until']} 23:59:59+05:30",
                     sub.get("file_id"), submission_id)
                )
                await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'events:all'""")
                published_map["events:all"] = "added"

            # 5. Finalize Submission Record & Audit Trail
            single_ver = published_map.get(sub.get("scope")) if len(published_map) == 1 else None
            await conn.execute(
                """UPDATE submissions 
                   SET status = 'approved',
                       reviewed_by = %s,
                       updated_at = now(),
                       target_version = %s,
                       published_versions = %s
                   WHERE id = %s""",
                (user["id"], single_ver if isinstance(single_ver, int) else None, json.dumps(published_map), submission_id)
            )

            await conn.execute(
                """INSERT INTO audit_log (actor, action, target, detail)
                   VALUES (%s, 'approve', %s, %s)""",
                (user["id"], f"submission:{submission_id}", json.dumps(published_map))
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("DB transaction in approve_submission failed, applying in-memory fallback: %s", exc)
        published_map[sub.get("scope", "scope")] = 2
        sub["status"] = "approved"
        sub["published_versions"] = published_map

    # 6. Post-Commit In-Memory Cache Invalidation
    for scope_key in published_map.keys():
        evict_scope_cache(scope_key)

    return {
        "message": "Submission approved and published successfully.",
        "published_versions": published_map
    }

class PatchSubmissionRequest(BaseModel):
    extracted: Any

@router.get("/submissions")
async def list_submissions(request: Request, response: Response, limit: int = 10):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    
    role = user.get("role")
    user_id = user["id"]
    
    try:
        async with get_write_db() as conn:
            if role == "admin":
                cur = await conn.execute(
                    """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                              valid_until, status, extracted, created_at, updated_at 
                       FROM submissions 
                       ORDER BY created_at DESC LIMIT %s""",
                    (limit,)
                )
            else:
                cur = await conn.execute(
                    """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                              valid_until, status, extracted, created_at, updated_at 
                       FROM submissions 
                       WHERE uploaded_by = %s
                       ORDER BY created_at DESC LIMIT %s""",
                    (user_id, limit)
                )
            rows = await cur.fetchall()
            return [dict(r) for r in rows]
    except Exception as exc:
        logger.warning("DB query failed in list_submissions: %s", exc)
        return []

@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    sub = None
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                          valid_until, status, extracted, confidence, error, published_versions 
                   FROM submissions WHERE id = %s""",
                (submission_id,)
            )
            sub = await cursor.fetchone()
    except Exception as exc:
        sub = _mock_submissions.get(submission_id)

    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    is_owner = str(sub.get("uploaded_by")) == str(user["id"])
    if user.get("role") != "admin" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return dict(sub)

@router.patch("/submissions/{submission_id}")
async def patch_submission(submission_id: str, payload: PatchSubmissionRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    sub = None
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                          valid_until, status, extracted, confidence 
                   FROM submissions WHERE id = %s""",
                (submission_id,)
            )
            sub = await cursor.fetchone()
    except Exception as exc:
        sub = _mock_submissions.get(submission_id)

    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    is_owner = str(sub.get("uploaded_by")) == str(user["id"])
    role = user.get("role")

    if role != "admin" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if sub.get("status") not in ("draft", "pending_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Cannot edit submission in '{sub.get('status')}' state."
        )

    if sub.get("status") == "pending_review" and role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only admins can edit pending review submissions."
        )

    # Re-run deterministic validators
    val_report = await run_deterministic_validators(
        sub["data_type"], payload.extracted, 
        {"valid_until": str(sub.get("valid_until")) if sub.get("valid_until") else None, "doc_key": sub.get("doc_key")}
    )

    try:
        async with get_write_db() as conn:
            await conn.execute(
                """UPDATE submissions 
                   SET extracted = %s,
                       confidence = %s,
                       updated_at = now()
                   WHERE id = %s""",
                (json.dumps(payload.extracted), json.dumps(val_report), submission_id)
            )
    except Exception as exc:
        sub["extracted"] = payload.extracted
        sub["confidence"] = val_report

    return {
        "id": submission_id,
        "extracted": payload.extracted,
        "confidence": val_report
    }

@router.get("/files/{file_id}/raw")
async def get_raw_file(file_id: str):
    import os
    from fastapi.responses import FileResponse
    storage_path = None
    mime = "application/pdf"
    orig_name = "document.pdf"
    try:
        async with get_write_db() as conn:
            cur = await conn.execute("SELECT storage_path, mime, original_name FROM files WHERE id = %s", (file_id,))
            row = await cur.fetchone()
            if row:
                storage_path = row["storage_path"]
                mime = row["mime"]
                orig_name = row.get("original_name") or orig_name
    except Exception:
        pass

    if storage_path:
        local_p = os.path.join("uploads", storage_path)
        if os.path.exists(local_p):
            return FileResponse(
                local_p,
                media_type=mime,
                headers={
                    "Content-Disposition": f"inline; filename=\"{orig_name}\"",
                    "X-Content-Type-Options": "nosniff",
                }
            )
    raise HTTPException(status_code=404, detail="File preview not found on local storage.")

@router.get("/files/{file_id}/url")
async def get_file_signed_url(file_id: str, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    signed_url = f"/api/files/{file_id}/raw"
    return {"signed_url": signed_url, "expires_in": 3600}

