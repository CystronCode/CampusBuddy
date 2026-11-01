import time
import json
import asyncio
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, status, Query
from pydantic import BaseModel, Field
from app.core.database import get_write_db
from app.services.tier0_engine import match_tier0_rule, resolve_chip_payload
from app.services.router_engine import route_student_query
from app.services.tool_executor import execute_tool
from app.services.time_engine import calculate_next_class

logger = logging.getLogger("campus.chat")
router = APIRouter(prefix="/api", tags=["Student Queries"])

class ChatRequest(BaseModel):
    message: Optional[str] = None
    chip_id: Optional[str] = None

class FeedbackRequest(BaseModel):
    query_log_id: int
    thumbs: int = Field(..., description="1 for thumbs-up, -1 for thumbs-down")

async def log_telemetry_async(
    user_id: Optional[str],
    tier: int,
    intent: str,
    tools: List[str],
    cache_hit: bool,
    latency_ms: int,
    query_text: str,
    error: Optional[str] = None
) -> Optional[int]:
    """Asynchronously logs query metrics to query_logs without blocking the response."""
    try:
        async with get_write_db() as conn:
            cursor = await conn.execute(
                """INSERT INTO query_logs 
                   (user_id, tier, intent, tools, cache_hit, latency_ms, query_text, error)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (user_id, tier, intent, tools, cache_hit, latency_ms, query_text, error)
            )
            row = await cursor.fetchone()
            return row["id"] if row else None
    except Exception as exc:
        logger.debug("Async telemetry logging skipped: %s", exc)
        return None

@router.post("/chat")
async def chat_endpoint(
    payload: ChatRequest, 
    request: Request,
    background_tasks: BackgroundTasks
):
    start_time = time.perf_counter()
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    query_text = payload.message or payload.chip_id or ""
    user_id = str(user.get("id"))
    tier = 0
    tools_used: List[str] = []
    data_payload: Any = None
    response_text = ""
    cache_hit = False

    # 1. Tier 0 Fast Path Evaluation
    t0_match = None
    if payload.chip_id:
        t0_match = resolve_chip_payload(payload.chip_id)
    elif payload.message:
        t0_match = match_tier0_rule(payload.message, default_budget=user.get("budget_default"))

    if t0_match:
        tool_name, tool_args = t0_match
        tier = 0
        cache_hit = True
        tools_used = [tool_name]
        data_payload = await execute_tool(tool_name, tool_args, user)
        response_text = f"Here is the requested information for {tool_name.replace('_', ' ')}."
    else:
        # 2. Tier 1 Router Fallthrough
        tier = 1
        contract = await route_student_query(query_text, user)
        if contract.calls:
            tools_used = [c.tool for c in contract.calls]
            tasks = [execute_tool(c.tool, c.args, user) for c in contract.calls]
            results = await asyncio.gather(*tasks)
            data_payload = results
            
            # Formulate friendly synthesized summary
            summaries = []
            for r in results:
                if r.get("tool") == "search_docs":
                    summaries.append(r.get("answer", ""))
                elif r.get("tool") == "get_timetable":
                    summaries.append("Retrieved active timetable schedule.")
                elif r.get("tool") == "search_menu":
                    summaries.append(f"Found {len(r.get('items', []))} matching menu items.")
                elif r.get("tool") == "get_faculty":
                    summaries.append(f"Found {len(r.get('matches', []))} faculty records.")
                elif r.get("tool") == "get_holidays":
                    summaries.append("Retrieved academic calendar holidays.")
                elif r.get("tool") == "get_events":
                    summaries.append(f"Found {len(r.get('events', []))} upcoming events.")
            response_text = "\n\n".join(filter(None, summaries)) or "Processed your query."
        else:
            response_text = "I'm not sure how to assist with that query. Try asking about classes, mess menu, or notices."

    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # Queue telemetry logging in background
    background_tasks.add_task(
        log_telemetry_async,
        user_id=user_id,
        tier=tier,
        intent=tools_used[0] if tools_used else "unknown",
        tools=tools_used,
        cache_hit=cache_hit,
        latency_ms=latency_ms,
        query_text=query_text
    )

    return {
        "response": response_text,
        "tier": tier,
        "tools": tools_used,
        "data": data_payload,
        "latency_ms": latency_ms
    }

@router.get("/dashboard/next-class")
async def get_dashboard_next_class(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    branch = user.get("branch")
    year = user.get("year")
    section = user.get("section")

    if not branch or not year or not section:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail="Profile branch, year, and section required for next-class card."
        )

    result = await calculate_next_class(branch, year, section)
    return result

@router.get("/timetable")
async def get_timetable_endpoint(
    request: Request,
    scope: str = Query("today"),
    day: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    section: Optional[str] = Query(None)
):
    user = getattr(request.state, "user", {})
    context = {
        "branch": branch or user.get("branch", "CSE"),
        "year": year or user.get("year", 1),
        "section": section or user.get("section", "A")
    }
    return await execute_tool("get_timetable", {"scope": scope, "day": day}, context)

@router.get("/menu")
async def get_menu_endpoint(
    request: Request,
    veg: Optional[bool] = Query(None),
    max_price: Optional[int] = Query(None),
    meal: Optional[str] = Query(None),
    day: Optional[str] = Query(None)
):
    user = getattr(request.state, "user", {})
    return await execute_tool(
        "search_menu", 
        {"veg": veg, "max_price": max_price, "meal": meal, "day": day}, 
        user
    )

@router.get("/faculty")
async def get_faculty_endpoint(
    request: Request,
    q: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None)
):
    user = getattr(request.state, "user", {})
    return await execute_tool("get_faculty", {"name": name or q, "subject": subject or q}, user)

@router.get("/holidays")
async def get_holidays_endpoint(
    request: Request,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    user = getattr(request.state, "user", {})
    return await execute_tool("get_holidays", {"from": from_date, "to": to_date}, user)

@router.get("/events")
async def get_events_endpoint(
    request: Request,
    club: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    user = getattr(request.state, "user", {})
    return await execute_tool("get_events", {"club": club, "from": from_date, "to": to_date}, user)

@router.post("/feedback")
async def submit_feedback(payload: FeedbackRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    if payload.thumbs not in (-1, 1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thumbs rating must be 1 or -1.")

    try:
        async with get_write_db() as conn:
            await conn.execute(
                """UPDATE query_logs SET thumbs = %s WHERE id = %s""",
                (payload.thumbs, payload.query_log_id)
            )
    except Exception as exc:
        logger.warning("Feedback update failed: %s", exc)

    return {"message": "Feedback recorded successfully."}
