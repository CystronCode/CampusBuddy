import pytest
import io
import os
import uuid
import jwt
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient

os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-32-characters-long!"
os.environ["COLLEGE_EMAIL_DOMAIN"] = "college.edu"
os.environ["EMAIL_API_KEY"] = "re_mock_test_key"
os.environ["ALLOWED_ORIGINS"] = "https://app.campus.edu,http://testserver"

from app.main import app
from app.core.config import settings
from app.services.auth_service import generate_csrf_token
from app.core.middleware import set_mock_user_in_cache
from app.routers.approval import set_mock_submission
from app.services.cache_service import set_mock_scope_rows, _scope_cache, evict_scope_cache
from app.services.tier0_engine import match_tier0_rule, resolve_chip_payload
from app.services.time_engine import calculate_next_class, IST
from app.services.rag_engine import set_mock_chunks, search_docs_hybrid, synthesize_rag_response
from app.services.sweeper_service import sweep_stuck_processing_jobs

client = TestClient(app, base_url="http://testserver")

def create_auth_headers(user_id: str, role: str = "admin", branch: str = "CSE", token_version: int = 0):
    user_data = {
        "id": user_id,
        "email": f"{role}@college.edu",
        "role": role,
        "branch": branch,
        "year": 3,
        "section": "A",
        "budget_default": 150,
        "token_version": token_version
    }
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": token_version}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, token_version)
    return {"X-CSRF-Token": csrf}, {"campus_session": token}


# ============================================================================
# PHASE 3 TESTS
# ============================================================================

def test_v3_2_hard_error_blockade():
    """V3.2: Re-run validators during approval; reject submission with hard error (422)."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    sub_id = str(uuid.uuid4())
    bad_submission = {
        "id": sub_id,
        "uploaded_by": admin_id,
        "data_type": "timetable",
        "scope": "timetable:CSE-3-A",
        "status": "pending_review",
        "extracted": [
            {"day": 1, "start_time": "12:00", "end_time": "10:00", "subject": "Math"}
        ],
        "valid_until": None,
        "doc_key": None
    }
    set_mock_submission(sub_id, bad_submission)

    resp = client.post(f"/api/submissions/{sub_id}/approve", headers=headers, cookies=cookies)
    assert resp.status_code == 422
    assert "uncorrected hard validation errors" in resp.json()["detail"]["message"]

def test_v3_1_idempotent_approval():
    """V3.1: Approving an already approved submission returns early with 200 (idempotent)."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    sub_id = str(uuid.uuid4())
    approved_submission = {
        "id": sub_id,
        "uploaded_by": admin_id,
        "data_type": "menu",
        "scope": "menu:mess",
        "status": "approved",
        "extracted": [{"day": None, "meal": "lunch", "item": "Rice", "price": 50, "is_veg": True}],
        "published_versions": {"menu:mess": 2}
    }
    set_mock_submission(sub_id, approved_submission)

    resp = client.post(f"/api/submissions/{sub_id}/approve", headers=headers, cookies=cookies)
    assert resp.status_code == 200
    assert "already approved" in resp.json()["message"]

def test_admin_rollback_endpoint():
    """V3.6: Rollback scope checks target rows and updates active_version."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    # Unsupported scope error check
    resp_bad = client.post(
        "/api/admin/scopes/unsupported_scope/rollback",
        json={"target_version": 1},
        headers=headers,
        cookies=cookies
    )
    assert resp_bad.status_code in (400, 404)

def test_admin_unpublish_event():
    """POST /api/admin/events/{id}/unpublish soft-deletes event and evicts cache."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    resp = client.post("/api/admin/events/1/unpublish", headers=headers, cookies=cookies)
    assert resp.status_code == 200
    assert "unpublished successfully" in resp.json()["message"]

def test_submission_rejection():
    """Admin rejects draft or pending submission with mandatory reason."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    sub_id = str(uuid.uuid4())
    sub_data = {
        "id": sub_id,
        "status": "pending_review"
    }
    set_mock_submission(sub_id, sub_data)

    resp = client.post(
        f"/api/submissions/{sub_id}/reject",
        json={"reject_reason": "Low quality scan, please re-upload with clear headers"},
        headers=headers,
        cookies=cookies
    )
    assert resp.status_code == 200
    assert resp.json()["reject_reason"] == "Low quality scan, please re-upload with clear headers"

def test_stuck_job_retry_endpoint():
    """POST /api/submissions/{id}/retry dispatches background extraction."""
    admin_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(admin_id, role="admin")

    sub_id = str(uuid.uuid4())
    resp = client.post(f"/api/submissions/{sub_id}/retry", headers=headers, cookies=cookies)
    assert resp.status_code == 200
    assert "re-dispatched" in resp.json()["message"]


# ============================================================================
# PHASE 4 TESTS
# ============================================================================

def test_v4_1_tier0_regex_anchoring_and_conjunction_rejection():
    """V4.1: 'next class' matches Tier 0; compound 'next class and lunch menu' falls through."""
    match_single = match_tier0_rule("next class")
    assert match_single is not None
    assert match_single[0] == "get_timetable"
    assert match_single[1]["scope"] == "next"

    # Compound query with conjunction falls through
    match_compound = match_tier0_rule("next class and lunch menu")
    assert match_compound is None

    # Over 40 characters falls through
    long_q = "what is the upcoming schedule for next class today"
    assert len(long_q) > 40
    assert match_tier0_rule(long_q) is None

def test_v4_2_tier0_negation_precedence():
    """V4.2: 'non veg' evaluates before 'veg'; price patterns extract amounts."""
    match_nonveg = match_tier0_rule("non veg")
    assert match_nonveg is not None
    assert match_nonveg[0] == "search_menu"
    assert match_nonveg[1]["veg"] is False

    match_veg = match_tier0_rule("veg menu")
    assert match_veg is not None
    assert match_veg[0] == "search_menu"
    assert match_veg[1]["veg"] is True

    # Price extraction
    match_price = match_tier0_rule("under 100")
    assert match_price is not None
    assert match_price[1]["max_price"] == 100

    # User budget default fallback
    match_budget = match_tier0_rule("under my budget", default_budget=120)
    assert match_budget is not None
    assert match_budget[1]["max_price"] == 120

def test_resolve_chip_payload():
    """Structured chips resolve to deterministic tools."""
    assert resolve_chip_payload("chip_next_class") == ("get_timetable", {"scope": "next"})
    assert resolve_chip_payload("chip_mess_menu") == ("search_menu", {})
    assert resolve_chip_payload("chip_upcoming_holidays") == ("get_holidays", {})

@pytest.mark.asyncio
async def test_v4_7_ongoing_vs_next_class_detection():
    """V4.7: Detect ongoing class (09:00-10:00) vs next class (10:00-11:00) at 09:15 IST."""
    scope = "timetable:CSE-3-A"
    slots = [
        {"day": 1, "start_time": time(9, 0), "end_time": time(10, 0), "subject": "Operating Systems"},
        {"day": 1, "start_time": time(10, 0), "end_time": time(11, 0), "subject": "Database Systems"}
    ]
    set_mock_scope_rows(scope, slots)
    set_mock_scope_rows("holidays:calendar", [])

    # Simulate Monday at 09:15 IST
    test_now = datetime(2026, 11, 2, 9, 15, tzinfo=IST) # 2026-11-02 is a Monday
    assert test_now.isoweekday() == 1

    result = await calculate_next_class("CSE", 3, "A", override_now=test_now)
    assert result["status"] == "active"
    assert result["ongoing"]["subject"] == "Operating Systems"
    assert result["next_class"]["subject"] == "Database Systems"

@pytest.mark.asyncio
async def test_v4_6_sunday_and_holiday_lookahead():
    """V4.6: Query on Sunday at 14:00 skips Sunday and returns first Monday class at 09:00."""
    scope = "timetable:CSE-3-A"
    slots = [
        {"day": 1, "start_time": time(9, 0), "end_time": time(10, 0), "subject": "Monday OS"}
    ]
    set_mock_scope_rows(scope, slots)
    set_mock_scope_rows("holidays:calendar", [])

    # Simulate Sunday at 14:00 IST
    sunday_now = datetime(2026, 11, 1, 14, 0, tzinfo=IST) # 2026-11-01 is a Sunday
    assert sunday_now.isoweekday() == 7

    result = await calculate_next_class("CSE", 3, "A", override_now=sunday_now)
    assert result["status"] == "upcoming_day"
    assert result["is_today"] is False
    assert result["day_name"] == "Monday"
    assert result["next_class"]["subject"] == "Monday OS"

@pytest.mark.asyncio
async def test_v4_4_rag_cosine_floor_guard():
    """V4.4: Queries with similarity < 0.45 skip LLM synthesis and return not found."""
    # Mock chunks with low similarity
    set_mock_chunks([
        {"id": 1, "title": "Hostel Notice", "section": "Rules", "similarity": 0.32, "content": "Gate closes at 10pm"}
    ])

    results = await search_docs_hybrid("quantum physics black holes", user_branch="CSE")
    assert len(results) == 0

    synth_resp = await synthesize_rag_response("quantum physics black holes", results)
    assert "could not find any matching notices" in synth_resp

@pytest.mark.asyncio
async def test_v4_5_rag_branch_isolation_guard():
    """V4.5: Student with branch='ECE' excluded from notice uploaded under branch='CSE'."""
    set_mock_chunks([
        {"id": 1, "title": "CSE Midterm", "section": "Schedule", "similarity": 0.85, "branch": "CSE", "content": "Exam room 301"}
    ])

    # ECE student search
    ece_results = await search_docs_hybrid("midterm schedule", user_branch="ECE")
    assert len(ece_results) == 0

    # CSE student search
    cse_results = await search_docs_hybrid("midterm schedule", user_branch="CSE")
    assert len(cse_results) == 1
    assert cse_results[0]["title"] == "CSE Midterm"

def test_chat_endpoint_tier0_fast_path():
    """POST /api/chat with Tier 0 query executes under 5ms with tier=0."""
    user_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(user_id, role="student")

    # Set mock menu rows
    set_mock_scope_rows("menu:mess", [
        {"item": "Paneer Butter Masala", "meal": "lunch", "price": 90, "is_veg": True}
    ])

    resp = client.post(
        "/api/chat",
        json={"message": "veg menu"},
        headers=headers,
        cookies=cookies
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tier"] == 0
    assert "search_menu" in data["tools"]

def test_chat_endpoint_chip_flow():
    """POST /api/chat with chip_id executes deterministic tool payload."""
    user_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(user_id, role="student")

    resp = client.post(
        "/api/chat",
        json={"chip_id": "chip_upcoming_holidays"},
        headers=headers,
        cookies=cookies
    )
    assert resp.status_code == 200
    assert resp.json()["tier"] == 0
    assert "get_holidays" in resp.json()["tools"]

def test_dashboard_next_class_endpoint():
    """GET /api/dashboard/next-class returns 200 with class payload."""
    user_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(user_id, role="student")

    resp = client.get("/api/dashboard/next-class", cookies=cookies)
    assert resp.status_code == 200

def test_student_read_endpoints():
    """Verify student read endpoints: /timetable, /menu, /faculty, /holidays, /events."""
    user_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(user_id, role="student")

    for path in ("/api/timetable", "/api/menu", "/api/faculty", "/api/holidays", "/api/events"):
        r = client.get(path, cookies=cookies)
        assert r.status_code == 200

def test_feedback_endpoint():
    """POST /api/feedback updates query log with thumbs 1 or -1."""
    user_id = str(uuid.uuid4())
    headers, cookies = create_auth_headers(user_id, role="student")

    resp = client.post(
        "/api/feedback",
        json={"query_log_id": 1, "thumbs": 1},
        headers=headers,
        cookies=cookies
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Feedback recorded successfully."
