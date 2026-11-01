from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from app.core.database import get_read_db
from app.services.cache_service import get_cached_scope_rows

IST = ZoneInfo("Asia/Kolkata")

def parse_time_obj(t_val: Any) -> time:
    if isinstance(t_val, time):
        return t_val
    t_str = str(t_val).strip()
    return datetime.strptime(t_str, "%H:%M" if len(t_str) == 5 else "%H:%M:%S").time()

async def calculate_next_class(
    branch: str, 
    year: int, 
    section: str, 
    override_now: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Computes current ongoing vs next upcoming class dynamically in Python in the Asia/Kolkata timezone.
    Skips Sundays and academic calendar holidays.
    Looks ahead up to 7 days for the first class of the next working day.
    """
    scope = f"timetable:{branch}-{year}-{section}"
    now_ist = override_now if override_now else datetime.now(IST)
    current_date = now_ist.date()
    current_time = now_ist.time()
    today_iso_day = now_ist.isoweekday()  # 1=Mon, 7=Sun

    # 1. Fetch active timetable slots from raw-row cache
    slots = await get_cached_scope_rows("timetable_slots", scope)
    if not slots:
        return {"status": "no_timetable", "message": "No active timetable published for your section."}

    # 2. Fetch active calendar holidays
    holidays_raw = await get_cached_scope_rows("holidays", "holidays:calendar")
    holiday_dates = set()
    for h in holidays_raw:
        try:
            d_val = h.get("date")
            if isinstance(d_val, date):
                holiday_dates.add(d_val)
            elif d_val:
                holiday_dates.add(datetime.strptime(str(d_val)[:10], "%Y-%m-%d").date())
        except Exception:
            pass

    # Helper to find slots on a given ISO weekday
    def slots_on_day(day_num: int) -> List[Dict[str, Any]]:
        day_slots = [s for s in slots if s.get("day") == day_num]
        return sorted(day_slots, key=lambda x: parse_time_obj(x["start_time"]))

    # 3. Check if today is a working day (Not Sunday and Not Holiday)
    is_today_working = (today_iso_day != 7) and (current_date not in holiday_dates)

    if is_today_working:
        today_slots = slots_on_day(today_iso_day)
        # Check ongoing class
        ongoing = next(
            (s for s in today_slots if parse_time_obj(s["start_time"]) <= current_time < parse_time_obj(s["end_time"])), 
            None
        )
        # Check upcoming class today
        upcoming_today = next(
            (s for s in today_slots if parse_time_obj(s["start_time"]) > current_time), 
            None
        )

        if ongoing or upcoming_today:
            return {
                "status": "active",
                "ongoing": ongoing,
                "next_class": upcoming_today,
                "is_today": True
            }

    # 4. Scan forward up to 7 days for the next working day's first class
    for day_offset in range(1, 8):
        target_date = current_date + timedelta(days=day_offset)
        target_iso_day = target_date.isoweekday()

        if target_iso_day == 7 or target_date in holiday_dates:
            continue  # Skip Sunday or Holiday

        target_slots = slots_on_day(target_iso_day)
        if target_slots:
            return {
                "status": "upcoming_day",
                "ongoing": None,
                "next_class": target_slots[0],
                "target_date": target_date.isoformat(),
                "day_name": target_date.strftime("%A"),
                "is_today": False
            }

    return {"status": "no_classes", "message": "No upcoming classes found in the next 7 days."}
