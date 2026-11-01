import logging
from datetime import datetime, date, time
from typing import Dict, Any, List, Optional
from app.core.database import get_read_db

logger = logging.getLogger("campus.validators")

async def run_deterministic_validators(
    data_type: str, 
    extracted_data: Any, 
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Evaluates extracted content against domain rules.
    Hard errors block approval.
    Warnings highlight items requiring reviewer attention in UI.
    """
    cells: Dict[str, Dict[str, str]] = {}
    has_errors = False
    has_warnings = False

    def add_flag(cell_key: str, flag_type: str, message: str):
        nonlocal has_errors, has_warnings
        cells[cell_key] = {"type": flag_type, "message": message}
        if flag_type == "error":
            has_errors = True
        elif flag_type == "warning":
            has_warnings = True

    if data_type == "timetable":
        rows = []
        if isinstance(extracted_data, list):
            rows = extracted_data
        elif isinstance(extracted_data, dict):
            rows = extracted_data.get("slots", [])
        
        seen_slots = {}
        for idx, row in enumerate(rows):
            # 1. Day Range Check (1..7)
            day = row.get("day")
            if not isinstance(day, int) or day < 1 or day > 7:
                add_flag(f"{idx}.day", "error", "Day must be an integer between 1 (Mon) and 7 (Sun).")

            # 2. Time Parse & Ordering Check
            start_str = str(row.get("start_time", "")).strip()
            end_str = str(row.get("end_time", "")).strip()
            t_start = None
            t_end = None
            try:
                t_start = datetime.strptime(start_str, "%H:%M").time()
                t_end = datetime.strptime(end_str, "%H:%M").time()
                if t_end <= t_start:
                    add_flag(f"{idx}.end_time", "error", f"end_time ({end_str}) must be after start_time ({start_str}).")
            except ValueError:
                add_flag(f"{idx}.start_time", "error", "Times must match HH:MM 24-hour format.")

            # 3. Overlapping Slot Warning Check (Allows split lab batches / electives)
            if t_start and t_end and isinstance(day, int) and 1 <= day <= 7:
                slot_key = (day, t_start, t_end)
                if slot_key in seen_slots:
                    add_flag(f"{idx}.overlap", "warning", f"Overlaps with slot {seen_slots[slot_key]} (batch/elective).")
                else:
                    seen_slots[slot_key] = idx

            # 4. Faculty Short Code Resolution
            short_code = row.get("short_code")
            if short_code:
                short_code_clean = str(short_code).strip()
                branch = metadata.get("branch")
                resolved = False
                try:
                    async with get_read_db() as conn:
                        # Match in same department first
                        cursor = await conn.execute(
                            """SELECT id FROM faculty 
                               WHERE lower(short_code) = lower(%s) AND department = %s""",
                            (short_code_clean, branch)
                        )
                        fac = await cursor.fetchone()
                        if fac:
                            row["faculty_id"] = fac["id"]
                            resolved = True
                        else:
                            # Match globally if unique
                            cursor_g = await conn.execute(
                                """SELECT id FROM faculty WHERE lower(short_code) = lower(%s)""",
                                (short_code_clean,)
                            )
                            facs = await cursor_g.fetchall()
                            if len(facs) == 1:
                                row["faculty_id"] = facs[0]["id"]
                                resolved = True
                except Exception as exc:
                    logger.debug("Faculty resolution DB check skipped/failed: %s", exc)

                if not resolved:
                    add_flag(f"{idx}.short_code", "warning", f"Unmatched faculty short-code '{short_code}'.")
                    row["faculty_id"] = None

    elif data_type == "menu":
        items = []
        if isinstance(extracted_data, list):
            items = extracted_data
        elif isinstance(extracted_data, dict):
            items = extracted_data.get("items", [])

        for idx, item in enumerate(items):
            price = item.get("price")
            if price is None or not isinstance(price, int) or price < 0 or price > 2000:
                add_flag(f"{idx}.price", "error", "Price must be a plausible integer (0 to 2000 INR).")

            meal = str(item.get("meal", "")).lower()
            if meal not in ("breakfast", "lunch", "snacks", "dinner"):
                add_flag(f"{idx}.meal", "error", "Meal must be breakfast, lunch, snacks, or dinner.")

            if item.get("is_veg") is None:
                add_flag(f"{idx}.is_veg", "warning", "Dietary classification missing; please specify Veg or Non-Veg.")

    elif data_type == "holidays":
        entries = []
        if isinstance(extracted_data, list):
            entries = extracted_data
        elif isinstance(extracted_data, dict):
            entries = extracted_data.get("holidays", [])

        for idx, h in enumerate(entries):
            if not str(h.get("name", "")).strip():
                add_flag(f"{idx}.name", "error", "Holiday name cannot be blank.")
            date_str = str(h.get("date", "")).strip()
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                if abs((d - date.today()).days) > 730:
                    add_flag(f"{idx}.date", "error", "Holiday date exceeds plausible +/- 2-year window.")
            except ValueError:
                add_flag(f"{idx}.date", "error", "Holiday date must follow YYYY-MM-DD format.")

    elif data_type == "faculty":
        members = []
        if isinstance(extracted_data, list):
            members = extracted_data
        elif isinstance(extracted_data, dict):
            members = extracted_data.get("faculty", [])

        for idx, m in enumerate(members):
            name = str(m.get("name", "")).strip()
            email = str(m.get("email", "")).strip().lower()
            dept = str(m.get("department", "")).strip()
            if not name:
                add_flag(f"{idx}.name", "error", "Faculty member name is required.")

            if email:
                try:
                    async with get_read_db() as conn:
                        cursor = await conn.execute(
                            """SELECT id, name, department FROM faculty 
                               WHERE lower(email) = %s AND (lower(name) != lower(%s) OR coalesce(department,'') != %s)""",
                            (email, name, dept)
                        )
                        conflict = await cursor.fetchone()
                        if conflict:
                            add_flag(
                                f"{idx}.email", 
                                "error", 
                                f"Email conflicts with existing faculty ID {conflict['id']} ({conflict['name']})."
                            )
                except Exception as exc:
                    logger.debug("Faculty conflict DB check skipped: %s", exc)

    elif data_type in ("notice", "poster"):
        valid_until_str = metadata.get("valid_until")
        if not valid_until_str:
            add_flag("valid_until", "error", "valid_until expiration date is mandatory.")
        else:
            try:
                v_date = datetime.strptime(str(valid_until_str).strip(), "%Y-%m-%d").date()
                if v_date < date.today():
                    add_flag("valid_until", "error", "valid_until date cannot be in the past.")
            except ValueError:
                add_flag("valid_until", "error", "valid_until must follow YYYY-MM-DD format.")

    return {
        "cells": cells,
        "has_errors": has_errors,
        "has_warnings": has_warnings
    }
