import logging
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from app.services.cache_service import get_cached_scope_rows
from app.services.time_engine import calculate_next_class, parse_time_obj
from app.services.rag_engine import search_docs_hybrid, synthesize_rag_response

logger = logging.getLogger("campus.tools")
IST = ZoneInfo("Asia/Kolkata")

WEEKDAY_MAP = {
    "monday": 1, "tuesday": 2, "wednesday": 3,
    "thursday": 4, "friday": 5, "saturday": 6, "sunday": 7
}

async def execute_tool(
    tool_name: str, 
    args: Any, 
    user_context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes a single read-only campus tool.
    Strictly injects verified user identity (branch, year, section) server-side.
    """
    if hasattr(args, "model_dump"):
        args = {k: v for k, v in args.model_dump().items() if v is not None}
    elif not isinstance(args, dict):
        args = {}
    branch = user_context.get("branch", "CSE")
    year = user_context.get("year", 1)
    section = user_context.get("section", "A")
    scope = f"timetable:{branch}-{year}-{section}"

    if tool_name == "get_timetable":
        sub_scope = args.get("scope", "today")
        if sub_scope == "next":
            result = await calculate_next_class(branch, year, section)
            return {"tool": "get_timetable", "type": "next_class", "data": result}

        slots = await get_cached_scope_rows("timetable_slots", scope)
        now_ist = datetime.now(IST)
        
        if sub_scope == "today":
            iso_day = now_ist.isoweekday()
            day_slots = [s for s in slots if s.get("day") == iso_day]
            day_slots.sort(key=lambda s: parse_time_obj(s["start_time"]))
            return {
                "tool": "get_timetable", 
                "scope": "today", 
                "day_name": now_ist.strftime("%A"),
                "slots": day_slots
            }
        elif sub_scope == "day":
            raw_day = str(args.get("day", now_ist.strftime("%A"))).lower()
            target_day_num = WEEKDAY_MAP.get(raw_day, now_ist.isoweekday())
            day_slots = [s for s in slots if s.get("day") == target_day_num]
            day_slots.sort(key=lambda s: parse_time_obj(s["start_time"]))
            return {
                "tool": "get_timetable", 
                "scope": "day", 
                "day_name": raw_day.capitalize(),
                "slots": day_slots
            }
        elif sub_scope == "week":
            return {"tool": "get_timetable", "scope": "week", "slots": slots}
        else:
            return {"tool": "get_timetable", "slots": slots}

    elif tool_name == "find_free_slots":
        slots = await get_cached_scope_rows("timetable_slots", scope)
        day_str = str(args.get("day", datetime.now(IST).strftime("%A"))).lower()
        target_day = WEEKDAY_MAP.get(day_str, datetime.now(IST).isoweekday())
        day_slots = [s for s in slots if s.get("day") == target_day]
        day_slots.sort(key=lambda s: parse_time_obj(s["start_time"]))
        return {
            "tool": "find_free_slots", 
            "day": day_str, 
            "occupied_slots": len(day_slots), 
            "slots": day_slots
        }

    elif tool_name == "get_faculty":
        fac_list = await get_cached_scope_rows("faculty", "faculty:all")
        query_name = str(args.get("name", "")).lower()
        query_subject = str(args.get("subject", "")).lower()
        
        matches = []
        for f in fac_list:
            name_match = not query_name or query_name in f.get("name", "").lower()
            subj_text = str(f.get("subjects_text", "")).lower()
            subj_match = not query_subject or query_subject in subj_text
            if name_match and subj_match:
                matches.append(f)
        return {"tool": "get_faculty", "matches": matches[:5]}

    elif tool_name == "search_menu":
        items = await get_cached_scope_rows("menu_items", "menu:mess")
        is_veg = args.get("veg")
        max_price = args.get("max_price")
        meal = args.get("meal")
        
        filtered = []
        for it in items:
            if is_veg is not None and it.get("is_veg") != is_veg:
                continue
            if max_price is not None and (it.get("price") is None or it["price"] > max_price):
                continue
            if meal and it.get("meal", "").lower() != str(meal).lower():
                continue
            filtered.append(it)
        return {"tool": "search_menu", "items": filtered}

    elif tool_name == "get_holidays":
        hols = await get_cached_scope_rows("holidays", "holidays:calendar")
        return {"tool": "get_holidays", "holidays": hols}

    elif tool_name == "get_events":
        events = await get_cached_scope_rows("events", "events:all")
        club_filter = args.get("club")
        if club_filter:
            events = [e for e in events if e.get("club", "").lower() == str(club_filter).lower()]
        return {"tool": "get_events", "events": events}

    elif tool_name == "search_docs":
        q = args.get("query", "")
        doc_type = args.get("doc_type")
        chunks = await search_docs_hybrid(q, user_branch=user_context.get("branch"), doc_type=doc_type)
        if not chunks:
            # Query holidays / academic calendar dates if question relates to exams, semester dates, or holidays
            hols = await get_cached_scope_rows("holidays", "holidays:calendar")
            q_lower = q.lower()
            matching_hols = [
                h for h in hols
                if any(k in h.get("name", "").lower() for k in ("exam", "semester", "cie", "quiz", "test", "holiday", "working day", "hall ticket", "admission", "induction", "makeup"))
                and (
                    ("exam" in q_lower and "exam" in h.get("name", "").lower())
                    or ("sem" in q_lower and "sem" in h.get("name", "").lower())
                    or ("quiz" in q_lower and "quiz" in h.get("name", "").lower())
                    or ("cie" in q_lower and "cie" in h.get("name", "").lower())
                    or any(word in h.get("name", "").lower() for word in q_lower.split() if len(word) > 3)
                )
            ]
            if matching_hols:
                lines = [f"- {h['name']}: {h['date']}" for h in matching_hols]
                matched_text = f"According to the Academic Calendar:\n" + "\n".join(lines)
                return {
                    "tool": "search_docs",
                    "chunks_count": len(matching_hols),
                    "answer": matched_text,
                    "chunks": [{"title": "Academic Calendar", "section": "Exam & Semester Dates", "content": matched_text}]
                }
        synth_text = await synthesize_rag_response(q, chunks)
        return {
            "tool": "search_docs", 
            "chunks_count": len(chunks), 
            "answer": synth_text, 
            "chunks": chunks
        }

    return {"tool": tool_name, "error": f"Unknown tool: {tool_name}"}
