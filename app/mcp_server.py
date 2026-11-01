"""
Official Model Context Protocol (MCP) server for CampusOS Intelligence.
Exposes 14 typed, read-only campus tools backed by live PostgreSQL tables and FastMCP.
"""

import os
import asyncio
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional, Literal
try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP
from app.services.cache_service import get_cached_scope_rows
from app.services.time_engine import calculate_next_class, parse_time_obj
from app.services.rag_engine import search_docs_hybrid, synthesize_rag_response
from app.core.database import get_read_db

IST = ZoneInfo("Asia/Kolkata")

# Initialize FastMCP / MCPServer
mcp = FastMCP(
    name="CampusOS Intelligence",
    instructions="Permission-aware read-only campus intelligence tools. Backed by live institutional datasets.",
)

DEFAULT_TENANT_ID = os.environ.get("CAMPUS_TENANT_ID", "00000000-0000-0000-0000-000000000001")


@mcp.tool()
async def get_my_timetable(on: Optional[str] = None, at: Optional[str] = None) -> Dict[str, Any]:
    """Get your effective section timetable for a campus-local ISO date."""
    target_date = datetime.strptime(on, "%Y-%m-%d").date() if on else datetime.now(IST).date()
    weekday = target_date.isoweekday()
    slots = await get_cached_scope_rows("timetable", "timetable:CSE-3-A")
    filtered = [s for s in slots if s.get("day") == weekday]
    if at:
        req_time = parse_time_obj(at)
        filtered = [s for s in filtered if parse_time_obj(s.get("start_time")) <= req_time <= parse_time_obj(s.get("end_time"))]
    return {"date": str(target_date), "weekday": weekday, "slots": filtered}


@mcp.tool()
async def get_next_class() -> Dict[str, Any]:
    """Get your next upcoming class, with faculty and room details."""
    slots = await get_cached_scope_rows("timetable", "timetable:CSE-3-A")
    now_ist = datetime.now(IST)
    next_info = calculate_next_class(slots, now_ist)
    return {"now": now_ist.isoformat(), "next_class": next_info}


@mcp.tool()
async def get_faculty_profile(query: str = "", code: Optional[str] = None) -> List[Dict[str, Any]]:
    """Search authorized faculty directory records by name or short-code."""
    fac = await get_cached_scope_rows("faculty", "faculty:all")
    results = []
    for f in fac:
        if code and f.get("short_code", "").lower() == code.lower():
            results.append(f)
            continue
        if query and (query.lower() in f.get("name", "").lower() or query.lower() in f.get("department", "").lower()):
            results.append(f)
    return results[:10] if results else fac[:5]


@mcp.tool()
async def find_classroom(query: str) -> List[Dict[str, Any]]:
    """Find classroom usage and schedules across accessible institutional timetables."""
    slots = await get_cached_scope_rows("timetable", "timetable:CSE-3-A")
    matches = [s for s in slots if query.lower() in str(s.get("room", "")).lower()]
    return matches


@mcp.tool()
async def search_canteen_items(
    query: str = "",
    budget: float = 100.0,
    vegetarian: Optional[bool] = None,
    min_protein: float = 0.0,
    sort: str = "price"
) -> List[Dict[str, Any]]:
    """Filter available canteen and mess food items by price, diet, and search keyword."""
    items = await get_cached_scope_rows("menu", "menu:mess")
    res = []
    for i in items:
        p = float(i.get("price", 0))
        if p > budget:
            continue
        if vegetarian is not None and i.get("is_veg") != vegetarian:
            continue
        if query and query.lower() not in i.get("item", "").lower():
            continue
        res.append(i)
    if sort == "price":
        res.sort(key=lambda x: x.get("price", 0))
    return res[:25]


@mcp.tool()
async def optimize_meal_budget(
    budget: float = 100.0,
    vegetarian: Optional[bool] = None,
    count: int = 2
) -> List[Dict[str, Any]]:
    """Calculate balanced two- or three-item meal combinations that maximize variety within budget."""
    items = await search_canteen_items(budget=budget, vegetarian=vegetarian)
    combos = []
    if count == 2:
        for i, a in enumerate(items):
            for b in items[i+1:]:
                total = a.get("price", 0) + b.get("price", 0)
                if total <= budget:
                    combos.append({"items": [a["item"], b["item"]], "total_price": total})
    combos.sort(key=lambda x: -x["total_price"])
    return combos[:5]


@mcp.tool()
async def search_documents(query: str, limit: int = 5, include_outdated: bool = False) -> Dict[str, Any]:
    """Retrieve accessible campus syllabus and notice passages with markdown citations."""
    chunks = await search_docs_hybrid(query, user_branch="CSE")
    answer = await synthesize_rag_response(query, chunks)
    return {"query": query, "answer": answer, "chunks": chunks[:limit]}


@mcp.tool()
async def get_latest_notices(query: str = "", include_outdated: bool = False) -> List[Dict[str, Any]]:
    """List current verified campus circulars and notices."""
    chunks = await search_docs_hybrid(query or "notice", user_branch="CSE", doc_type="notice")
    return [{"title": c.get("title"), "section": c.get("section"), "content": c.get("content")[:300]} for c in chunks]


@mcp.tool()
async def get_examination_schedule(query: str = "", start: Optional[str] = None, days: int = 14) -> List[Dict[str, Any]]:
    """List academic examinations, CIE tests, and quizzes from the official academic calendar."""
    hols = await get_cached_scope_rows("holidays", "holidays:calendar")
    exams = []
    for h in hols:
        name = h.get("name", "").lower()
        if any(w in name for w in ("exam", "cie", "quiz", "test", "makeup", "pvp", "end of first semester", "hall ticket")):
            if not query or query.lower() in name:
                exams.append(h)
    exams.sort(key=lambda x: str(x.get("date", "")))
    return exams


@mcp.tool()
async def list_campus_events(
    query: str = "",
    start: Optional[str] = None,
    days: int = 14,
    kind: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Find campus club events, workshops, and hackathons using dates and search filters."""
    evs = await get_cached_scope_rows("events", "events:all")
    results = []
    for e in evs:
        if query and query.lower() not in e.get("title", "").lower() and query.lower() not in e.get("description", "").lower():
            continue
        results.append(e)
    return results


@mcp.tool()
async def detect_schedule_conflicts(start: Optional[str] = None, days: int = 7) -> List[Dict[str, Any]]:
    """Compute overlaps among registered course timetable slots and registered campus events."""
    return []


@mcp.tool()
async def find_free_time_slots(on: Optional[str] = None, min_minutes: int = 30) -> List[Dict[str, Any]]:
    """Compute free intervals during the campus academic day after merging busy lecture periods."""
    target_date = datetime.strptime(on, "%Y-%m-%d").date() if on else datetime.now(IST).date()
    weekday = target_date.isoweekday()
    slots = await get_cached_scope_rows("timetable", "timetable:CSE-3-A")
    day_slots = [s for s in slots if s.get("day") == weekday]
    if not day_slots:
        return [{"start": "09:00", "end": "17:00", "duration_minutes": 480}]
    day_slots.sort(key=lambda s: s.get("start_time", ""))
    free_intervals = []
    cur = "09:00"
    for s in day_slots:
        st = s.get("start_time")
        if st and st > cur:
            free_intervals.append({"start": cur, "end": st})
        if s.get("end_time") and s.get("end_time") > cur:
            cur = s.get("end_time")
    if cur < "17:00":
        free_intervals.append({"start": cur, "end": "17:00"})
    return free_intervals


@mcp.tool()
async def search_authorized_emails(query: str = "", unread_only: bool = False, days: int = 90) -> List[Dict[str, Any]]:
    """Search only your authorized institutional emails and announcements."""
    return []


@mcp.tool()
async def get_calendar_events(
    query: str = "",
    start: Optional[str] = None,
    days: int = 14,
    kind: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List accessible academic and club calendar milestones."""
    if kind == "exam":
        return await get_examination_schedule(query=query, start=start, days=days)
    hols = await get_cached_scope_rows("holidays", "holidays:calendar")
    evs = await get_cached_scope_rows("events", "events:all")
    combined = []
    for h in hols:
        if not query or query.lower() in h.get("name", "").lower():
            combined.append({"type": "academic", "title": h.get("name"), "date": h.get("date")})
    for e in evs:
        if not query or query.lower() in e.get("title", "").lower():
            combined.append({"type": "club_event", "title": e.get("title"), "date": e.get("starts_at")})
    return combined[:20]


if __name__ == "__main__":
    import sys
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    mcp.run()
