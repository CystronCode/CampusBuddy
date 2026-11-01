import logging
from typing import Dict, Any, List, Optional, Tuple
from app.core.database import get_read_db

logger = logging.getLogger("campus.cache")

# In-memory storage keyed by (scope, rev)
_scope_cache: Dict[Tuple[str, int], List[Dict[str, Any]]] = {}

# Mock fallback storage for test environments without live PostgreSQL
_mock_store: Dict[str, List[Dict[str, Any]]] = {}

def evict_scope_cache(scope: str):
    """Evicts all cached versions and revisions for a given scope."""
    keys_to_remove = [k for k in _scope_cache.keys() if k[0] == scope]
    for k in keys_to_remove:
        _scope_cache.pop(k, None)
    logger.debug("Evicted raw-row cache for scope '%s' (%d entries)", scope, len(keys_to_remove))

def set_mock_scope_rows(scope: str, rows: List[Dict[str, Any]]):
    """Helper to seed raw rows for tests."""
    _mock_store[scope] = rows
    _scope_cache[(scope, 1)] = rows

async def get_cached_scope_rows(table: str, scope: str) -> List[Dict[str, Any]]:
    """
    Fetches raw domain rows filtered by the active version in data_versions.
    Cached strictly by (scope, rev).
    """
    active_version = 1
    rev = 1

    try:
        async with get_read_db() as conn:
            cursor = await conn.execute(
                """SELECT active_version, rev FROM data_versions WHERE scope = %s""",
                (scope,)
            )
            ver_row = await cursor.fetchone()
            if ver_row:
                active_version = ver_row["active_version"]
                rev = ver_row["rev"]

            cache_key = (scope, rev)
            if cache_key in _scope_cache:
                return _scope_cache[cache_key]

            rows: List[Dict[str, Any]] = []

            if table in ("timetable_slots", "timetable"):
                parts = scope.replace("timetable:", "").replace("-", ":").split(":")
                if len(parts) >= 3:
                    try:
                        b_val, y_val, s_val = parts[0], int(parts[1]), parts[2]
                        c = await conn.execute(
                            """SELECT id, branch, year, section, 
                                      COALESCE(day_of_week, day) AS day_of_week,
                                      COALESCE(day, day_of_week) AS day, 
                                      start_time, end_time, 
                                      COALESCE(subject_code, subject) AS subject_code,
                                      COALESCE(subject_name, subject) AS subject_name,
                                      COALESCE(subject, subject_name) AS subject, 
                                      COALESCE(room_no, room) AS room_no,
                                      COALESCE(room, room_no) AS room, 
                                      faculty_code, faculty_code AS short_code, version 
                               FROM timetable_slots 
                               WHERE branch = %s AND year = %s AND section = %s AND version = %s 
                               ORDER BY COALESCE(day_of_week, day), start_time""",
                            (b_val, y_val, s_val, active_version)
                        )
                    except ValueError:
                        c = await conn.execute(
                            """SELECT id, branch, year, section, 
                                      COALESCE(day_of_week, day) AS day_of_week,
                                      COALESCE(day, day_of_week) AS day, 
                                      start_time, end_time, 
                                      COALESCE(subject_code, subject) AS subject_code,
                                      COALESCE(subject_name, subject) AS subject_name,
                                      COALESCE(subject, subject_name) AS subject, 
                                      COALESCE(room_no, room) AS room_no,
                                      COALESCE(room, room_no) AS room, 
                                      faculty_code, faculty_code AS short_code, version 
                               FROM timetable_slots 
                               WHERE version = %s 
                               ORDER BY COALESCE(day_of_week, day), start_time""",
                            (active_version,)
                        )
                else:
                    c = await conn.execute(
                        """SELECT id, branch, year, section, 
                                  COALESCE(day_of_week, day) AS day_of_week,
                                  COALESCE(day, day_of_week) AS day, 
                                  start_time, end_time, 
                                  COALESCE(subject_code, subject) AS subject_code,
                                  COALESCE(subject_name, subject) AS subject_name,
                                  COALESCE(subject, subject_name) AS subject, 
                                  COALESCE(room_no, room) AS room_no,
                                  COALESCE(room, room_no) AS room, 
                                  faculty_code, faculty_code AS short_code, version 
                           FROM timetable_slots 
                           WHERE version = %s 
                           ORDER BY COALESCE(day_of_week, day), start_time""",
                        (active_version,)
                    )
                rows = await c.fetchall()

            elif table in ("menu_items", "menu"):
                c = await conn.execute(
                    """SELECT DISTINCT ON (lower(item_name), lower(COALESCE(meal, '')))
                              id, facility, 
                              day_of_week, day_of_week AS day, 
                              meal, item_name, item_name AS item, 
                              price, is_veg, version 
                       FROM menu_items 
                       WHERE version IN (
                           SELECT DISTINCT version FROM menu_items ORDER BY version DESC LIMIT 3
                       )
                       ORDER BY lower(item_name), lower(COALESCE(meal, '')), version DESC""",
                )
                rows = await c.fetchall()

            elif table == "holidays":
                c = await conn.execute(
                    """SELECT id, date, name, version 
                       FROM holidays 
                       WHERE version = %s 
                       ORDER BY date""",
                    (active_version,)
                )
                rows = await c.fetchall()

            elif table == "faculty":
                c = await conn.execute(
                    """SELECT id, short_code,
                              COALESCE(full_name, name) AS full_name,
                              COALESCE(name, full_name) AS name, 
                              email, cabin, designation,
                              COALESCE(branch, department) AS branch,
                              COALESCE(department, branch) AS department,
                              office_hours, subjects, subjects_text, is_active 
                       FROM faculty 
                       WHERE is_active = true 
                       ORDER BY COALESCE(full_name, name)"""
                )
                rows = await c.fetchall()

            elif table == "events":
                c = await conn.execute(
                    """SELECT id, title, description, organizer, organizer AS club, 
                              venue, start_time, start_time AS starts_at, 
                              end_time, end_time AS ends_at, poster_url, is_active 
                       FROM events 
                       WHERE is_active = true 
                       ORDER BY start_time NULLS LAST"""
                )
                rows = await c.fetchall()

            elif table == "doc_chunks":
                c = await conn.execute(
                    """SELECT id, doc_key, doc_title, doc_title AS title, 
                              section, content, branch, valid_until, version 
                       FROM doc_chunks 
                       WHERE doc_key = %s AND version = %s""",
                    (scope, active_version)
                )
                rows = await c.fetchall()

            _scope_cache[cache_key] = [dict(r) for r in rows]
            return _scope_cache[cache_key]

    except Exception as exc:
        logger.warning("DB read in get_cached_scope_rows failed, checking mock store: %s", exc)
        if scope in _mock_store:
            return _mock_store[scope]
        return []
