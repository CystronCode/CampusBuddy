import re
from typing import Optional, Dict, Any, Tuple

CONJUNCTION_PATTERN = re.compile(r"\b(and|also|plus|&)\b", re.IGNORECASE)

RULES = [
    # Timetable Rules
    (re.compile(r"^(next\s+class|upcoming\s+class)$", re.I), "get_timetable", {"scope": "next"}),
    (re.compile(r"^(today'?s?\s+timetable|classes\s+today)$", re.I), "get_timetable", {"scope": "today"}),
    (re.compile(r"^(full\s+timetable|weekly\s+timetable|schedule)$", re.I), "get_timetable", {"scope": "week"}),
    (re.compile(r"^(monday|tuesday|wednesday|thursday|friday|saturday)\s+timetable$", re.I), 
     "get_timetable", lambda m: {"scope": "day", "day": m.group(1).lower()}),

    # Mess Menu Rules (Negation evaluated before positive)
    (re.compile(r"^non\s*[-]?\s*veg(\s+menu|\s+items)?$", re.I), "search_menu", {"veg": False}),
    (re.compile(r"^(pure\s+)?veg(\s+menu|\s+items)?$", re.I), "search_menu", {"veg": True}),
    (re.compile(r"^(today'?s?\s+menu|mess\s+menu|food|what'?s?\s+on\s+(the\s+)?menu|canteen\s+menu)\??$", re.I), "search_menu", {}),
    (re.compile(r"^(breakfast|lunch|snacks|dinner)(\s+menu|\s+items)?\??$", re.I), 
     "search_menu", lambda m: {"meal": m.group(1).lower()}),
    (re.compile(r"^(?:what\s+is\s+|what'?s?\s+)?(?:the\s+)?(?:price|cost|rate)\s+of\s+.+$", re.I), "search_menu", {}),
    (re.compile(r"^how\s+much\s+(?:is|for)\s+.+$", re.I), "search_menu", {}),
    (re.compile(r"^(under|below)\s+(?:₹|rs\.?\s*)?(\d{1,4})$", re.I), 
     "search_menu", lambda m: {"max_price": int(m.group(2))}),

    # Holidays and Events
    (re.compile(r"^(holidays|upcoming\s+holidays|holiday\s+list)$", re.I), "get_holidays", {}),
    (re.compile(r"^(club\s+events|events|what'?s?\s+happening)$", re.I), "get_events", {})
]

def match_tier0_rule(query_text: str, default_budget: Optional[int] = None) -> Optional[Tuple[str, Dict[str, Any]]]:
    q = query_text.strip()
    if len(q) > 40:
        return None

    # Compound queries containing coordinating conjunctions must fall through to Tier 1 router
    if CONJUNCTION_PATTERN.search(q):
        return None

    # Special handling for 'under budget' without numerical amount
    if re.match(r"^(under|below)\s+my\s+budget$", q, re.I):
        if default_budget:
            return "search_menu", {"max_price": default_budget}
        return None

    for pattern, tool_name, arg_spec in RULES:
        match = pattern.match(q)
        if match:
            args = arg_spec(match) if callable(arg_spec) else dict(arg_spec)
            return tool_name, args

    return None

def resolve_chip_payload(chip_id: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    chips = {
        "chip_next_class": ("get_timetable", {"scope": "next"}),
        "chip_today_timetable": ("get_timetable", {"scope": "today"}),
        "chip_weekly_timetable": ("get_timetable", {"scope": "week"}),
        "chip_mess_menu": ("search_menu", {}),
        "chip_veg_menu": ("search_menu", {"veg": True}),
        "chip_upcoming_holidays": ("get_holidays", {}),
        "chip_club_events": ("get_events", {})
    }
    return chips.get(chip_id)
