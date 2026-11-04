import os
import json
import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from cachetools import TTLCache
from app.core.config import settings

logger = logging.getLogger("campus.router")
GEMINI_API_KEY = settings.GEMINI_API_KEY
GEMINI_MODEL_ROUTER = settings.GEMINI_MODEL_ROUTER

router_cache: TTLCache[str, Any] = TTLCache(maxsize=1000, ttl=86400) # 24-hour LRU router cache
_ai_clients: List[genai.Client] = []
CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
]

def get_ai_clients() -> List[genai.Client]:
    global _ai_clients
    if not _ai_clients:
        for k in settings.GEMINI_API_KEYS:
            if k and not k.startswith("mock"):
                try:
                    _ai_clients.append(genai.Client(api_key=k))
                except Exception as e:
                    logger.warning("Could not initialize genai.Client in router: %s", e)
    return _ai_clients

def get_ai_client() -> Optional[genai.Client]:
    clients = get_ai_clients()
    return clients[0] if clients else None

class ToolArgs(BaseModel):
    scope: Optional[str] = None
    day: Optional[str] = None
    at: Optional[str] = None
    name: Optional[str] = None
    subject: Optional[str] = None
    veg: Optional[bool] = None
    max_price: Optional[int] = None
    meal: Optional[str] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    club: Optional[str] = None
    query: Optional[str] = None
    doc_type: Optional[str] = None

class ToolCall(BaseModel):
    tool: str = Field(..., description="One of get_timetable, find_free_slots, get_faculty, search_menu, get_holidays, get_events, search_docs")
    args: ToolArgs = Field(default_factory=ToolArgs)

class RouterContract(BaseModel):
    calls: List[ToolCall] = Field(default_factory=list, max_length=3)
    needs_clarification: bool = False
    clarifying_question: Optional[str] = None
    confidence: float = Field(0.9, ge=0.0, le=1.0)

def normalize_query_for_cache(q: str) -> str:
    return "".join(c for c in q.lower().strip() if c.isalnum() or c.isspace())

async def route_student_query(query_text: str, user_context: Dict[str, Any]) -> RouterContract:
    """
    Tier 1 query router powered by Groq LPU (Qwen 27B) with Gemini Flash fallback.
    Guarantees ZERO identity leakage (user_id, branch, year, section are absent from prompt).
    """
    cache_key = normalize_query_for_cache(query_text)
    if cache_key in router_cache:
        logger.info("Router cache hit for: %s", cache_key)
        return router_cache[cache_key]

    ist_now = datetime.now(ZoneInfo("Asia/Kolkata"))
    current_weekday = ist_now.strftime("%A")
    current_date = ist_now.strftime("%Y-%m-%d")

    system_instruction = f"""You are the Campus Intelligence Query Router for a college campus.
Current IST Context: {current_weekday}, {current_date} (Asia/Kolkata).
Route the student query to at most 3 independent tools:
- get_timetable(scope: 'next'|'today'|'day'|'week', day?: ISO weekday name)
- find_free_slots(day: weekday name, at?: 'HH:MM')
- get_faculty(name?: string, subject?: string)
- search_menu(veg?: boolean, max_price?: int, meal?: 'breakfast'|'lunch'|'snacks'|'dinner', day?: weekday name)
- get_holidays(from?: symbolic_or_YYYY-MM-DD, to?: symbolic_or_YYYY-MM-DD)
- get_events(from?: symbolic_or_YYYY-MM-DD, to?: symbolic_or_YYYY-MM-DD, club?: string)
- search_docs(query: string, doc_type?: 'syllabus'|'notice')

RULES:
1. Output valid JSON matching the schema. No markdown formatting.
2. Symbolic dates allowed: today, tomorrow, this_week_start, this_week_end, next_week_start, monday..sunday.
3. Identity fields (branch, year, section) are NOT accepted as arguments; they are injected automatically server-side.
4. For multi-intent queries ('cheap veg lunch and free at 1?'), return multiple tool calls.
"""

    # 1. Fast Groq LPU Router (sub-second latency)
    if settings.GROQ_API_KEY:
        try:
            from app.services.llm_provider import call_groq
            groq_prompt = (
                f"{system_instruction}\n"
                f'Student Query: "{query_text}"\n'
                "Respond strictly with JSON schema: "
                '{"calls": [{"tool": "name", "args": {...}}], "needs_clarification": false, "confidence": 0.95}'
            )
            groq_res = await call_groq(
                messages=[
                    {"role": "system", "content": "You are the Campus Intelligence Query Router. Output strictly valid JSON."},
                    {"role": "user", "content": groq_prompt}
                ],
                temperature=0.0,
                response_format_json=True,
                max_tokens=150,
                timeout_sec=4.0
            )
            if groq_res:
                parsed_data = json.loads(groq_res)
                contract = RouterContract(**parsed_data)
                if contract.confidence >= 0.7 and not contract.needs_clarification:
                    router_cache[cache_key] = contract
                return contract
        except Exception as e:
            logger.warning("Groq router error: %s, falling back to Gemini.", e)

    # 2. Gemini Router Fallback
    clients = get_ai_clients()
    if clients:
        for client in clients:
            for model_name in CANDIDATE_MODELS:
                try:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            client.models.generate_content,
                            model=model_name,
                            contents=[types.Part.from_text(text=query_text)],
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                response_mime_type="application/json",
                                response_schema=RouterContract,
                                temperature=0.0
                            )
                        ),
                        timeout=6.0,
                    )
                    parsed_data = json.loads(response.text)
                    contract = RouterContract(**parsed_data)
                    
                    # Cache confident routing decisions
                    if contract.confidence >= 0.7 and not contract.needs_clarification:
                        router_cache[cache_key] = contract

                    return contract
                except Exception as e:
                    logger.warning("Router model %s failed/timed out (%s), trying next.", model_name, str(e))

    # 3. Offline/fallback rule-based router for testing environments
    calls = []
    q_lower = query_text.lower()
    if any(k in q_lower for k in ("menu", "lunch", "food", "breakfast", "snacks", "dinner", "price", "cost", "dosa", "idli", "idly", "vada", "coffee", "tea", "uttappa", "uttapam", "pongal", "upma", "meal", "canteen", "mess")):
        calls.append(ToolCall(tool="search_menu", args={"veg": True if ("veg" in q_lower and "non" not in q_lower) else None}))
    if any(k in q_lower for k in ("class", "timetable", "free", "schedule", "lecture", "lab", "period")):
        calls.append(ToolCall(tool="get_timetable", args={"scope": "week" if "week" in q_lower else "today"}))
    if any(k in q_lower for k in ("faculty", "professor", "teacher", "hod", "cabin")):
        calls.append(ToolCall(tool="get_faculty", args={}))
    if any(k in q_lower for k in ("holiday", "calendar")):
        calls.append(ToolCall(tool="get_holidays", args={}))
    if any(k in q_lower for k in ("syllabus", "exam", "notice", "cie", "quiz", "semester")):
        calls.append(ToolCall(tool="search_docs", args={"query": query_text}))

    contract = RouterContract(calls=calls[:3], needs_clarification=False, confidence=0.8)
    router_cache[cache_key] = contract
    return contract
