from datetime import date
import pytest
from fastapi import HTTPException
from backend.app.auth import resolve_actor
from backend.app.services import CampusService
from backend.app.router import parse_date, parse_time


def test_timetable_exact(env):
    rows = env.service.timetable("2026-10-29", "14:00")
    assert len(rows) == 1
    assert rows[0]["subject"] == "Linear Algebra"
    assert rows[0]["faculty"] == "Dr. Meera Nair"
    assert rows[0]["room"] == "A-304"


def test_effective_range(env):
    assert env.service.timetable("2030-10-29") == []


def test_weekend(env):
    assert env.service.timetable("2026-11-01") == []


def test_next_class(env):
    assert env.service.next_class()["start_time"] == "13:00:00"


def test_end_boundary(env):
    assert env.service.timetable("2026-10-28", "15:00") == []


def test_week(env):
    assert len(env.service.week("2026-10-28")) == 25


def test_price(env):
    assert all(r["price"] <= 80 for r in env.service.menu(80))


def test_veg(env):
    assert all(r["vegetarian"] and r["available"] for r in env.service.menu(100, True))


def test_highest_protein(env):
    rows = env.service.menu(120, True, sort="protein")
    assert rows[0]["name"] == "Tofu bowl"


def test_meal_math(env):
    rows = env.service.meals(100, True)
    assert rows
    for r in rows:
        assert r["total"] == sum(i["price"] for i in r["items"]) <= 100
        assert len({i["id"] for i in r["items"]}) == 2
        assert r["protein"] == sum(i["protein"] for i in r["items"])


def test_bad_budget(env):
    with pytest.raises(ValueError):
        env.service.menu(-1)


def test_bad_count(env):
    with pytest.raises(ValueError):
        env.service.meals(count=5)


def test_faculty(env):
    assert env.service.faculty(code="AIML-1")[0]["office"] == "Block A, Room 210"


def test_event_fit(env):
    event = env.service.events("2026-10-30", 1, "AI")[0]
    fit = env.service.event_fit(event)
    assert not fit["can_attend"]
    assert fit["clashes"]


def test_free_slots(env):
    slots = env.service.free_slots("2026-10-28")
    assert slots
    for slot in slots:
        assert slot["minutes"] >= 30
        assert not any(
            env.service.overlaps(slot, r)
            for r in env.service.timetable("2026-10-28") + env.service.events("2026-10-28", 1)
        )


def test_conflicts(env):
    assert env.service.conflicts("2026-10-28")


def test_date_interpretation():
    today = date(2026, 10, 28)
    assert parse_date("tomorrow", today) == date(2026, 10, 29)
    assert parse_date("friday", today) == date(2026, 10, 30)
    assert parse_date("2026-11-10", today) == date(2026, 11, 10)


def test_time_interpretation():
    assert parse_time("at 2 pm") == "14:00"
    assert parse_time("at 12 am") == "00:00"
    assert parse_time("at 14:30") == "14:30"


def test_unknown_tenant_denied(env):
    with pytest.raises(HTTPException):
        resolve_actor(env.db, env.user, env.other_tenant)


def test_private_emails(env):
    other = CampusService(env.db, resolve_actor(env.db, env.other, env.tenant), clock=env.service.clock)
    assert env.service.emails()
    assert not other.emails()


def test_tenant_records(env):
    mine = {r["id"] for r in env.service.menu()}
    other = CampusService(env.db, resolve_actor(env.db, env.other, env.other_tenant), clock=env.service.clock)
    assert not mine & {r["id"] for r in other.menu()}


def test_student_admin_denied(student):
    with pytest.raises(HTTPException):
        student.actor.require_admin()
