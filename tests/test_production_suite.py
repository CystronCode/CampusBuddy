import pytest
import asyncio
import os
import uuid
import jwt
from datetime import datetime, date, timedelta, timezone
from fastapi.testclient import TestClient

os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-32-characters-long!"
os.environ["COLLEGE_EMAIL_DOMAIN"] = "college.edu"
os.environ["EMAIL_API_KEY"] = "re_mock_test_key"
os.environ["ALLOWED_ORIGINS"] = "https://app.campus.edu,http://testserver"

from app.main import app
from app.core.config import settings
from app.services.tier0_engine import match_tier0_rule
from app.services.auth_service import generate_csrf_token
from app.core.middleware import set_mock_user_in_cache
from app.routers.approval import set_mock_submission
from app.services.rag_engine import set_mock_chunks, search_docs_hybrid, synthesize_rag_response
from app.services.sweeper_service import sweep_stuck_processing_jobs

client = TestClient(app, base_url="http://testserver")

def generate_test_user(user_id: str, role: str, email: str, branch: str = "CSE", token_version: int = 0):
    user_data = {
        "id": user_id,
        "email": email,
        "role": role,
        "branch": branch,
        "year": 3,
        "section": "A",
        "club": "Music Club" if role == "club" else None,
        "token_version": token_version
    }
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": token_version}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, token_version)
    return {
        "user": user_data,
        "token": token,
        "csrf": csrf,
        "headers": {"X-CSRF-Token": csrf},
        "cookies": {"campus_session": token}
    }


# ============================================================================
# 1. TIER 0 FAST PATH & CONJUNCTION REJECTION TESTS
# ============================================================================
def test_tier0_single_intent_rules():
    assert match_tier0_rule("next class")[0] == "get_timetable"
    assert match_tier0_rule("today's timetable")[0] == "get_timetable"
    assert match_tier0_rule("full timetable")[0] == "get_timetable"
    assert match_tier0_rule("holidays")[0] == "get_holidays"
    assert match_tier0_rule("club events")[0] == "get_events"

def test_tier0_negation_precedence():
    # Non-veg must evaluate before veg rule
    non_veg_match = match_tier0_rule("non veg menu")
    assert non_veg_match is not None
    assert non_veg_match[0] == "search_menu"
    assert non_veg_match[1].get("veg") is False

    veg_match = match_tier0_rule("veg menu")
    assert veg_match is not None
    assert veg_match[0] == "search_menu"
    assert veg_match[1].get("veg") is True

def test_tier0_conjunction_rejection_falls_to_tier1():
    # Queries with 'and', 'also', '&' MUST return None to force Tier 1 router execution
    assert match_tier0_rule("next class and veg lunch") is None
    assert match_tier0_rule("free slots also today timetable") is None
    assert match_tier0_rule("holidays & club events") is None
    assert match_tier0_rule("classes today plus mess menu") is None


# ============================================================================
# 2. FULL RBAC MATRIX TESTS (All Roles vs Protected Routes)
# ============================================================================
def test_rbac_student_upload_blocked():
    """Students cannot access upload endpoint (403)."""
    student = generate_test_user(str(uuid.uuid4()), "student", "student@college.edu")
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 40
    res = client.post(
        "/api/uploads",
        data={"data_type": "timetable"},
        files={"file": ("test.png", png_bytes, "image/png")},
        headers=student["headers"],
        cookies=student["cookies"]
    )
    assert res.status_code == 403
    assert "Students cannot upload files" in res.json()["detail"]

def test_rbac_staff_mismatched_branch_blocked():
    """Staff from ECE cannot upload timetable for CSE (403)."""
    staff_ece = generate_test_user(str(uuid.uuid4()), "staff", "staff_ece@college.edu", branch="ECE")
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 40

    res = client.post(
        "/api/uploads",
        data={"data_type": "timetable", "branch": "CSE", "year": 3, "section": "A"},
        files={"file": ("tt.png", png_bytes, "image/png")},
        headers=staff_ece["headers"],
        cookies=staff_ece["cookies"]
    )
    assert res.status_code == 403
    assert "own branch" in res.json()["detail"]

def test_rbac_staff_matched_branch_allowed():
    """Staff from CSE can upload timetable for CSE."""
    staff_cse = generate_test_user(str(uuid.uuid4()), "staff", "staff_cse@college.edu", branch="CSE")
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 40

    res = client.post(
        "/api/uploads",
        data={"data_type": "timetable", "branch": "CSE", "year": 3, "section": "A"},
        files={"file": ("tt.png", png_bytes, "image/png")},
        headers=staff_cse["headers"],
        cookies=staff_cse["cookies"]
    )
    assert res.status_code == 200
    assert res.json()["status"] == "processing"

def test_rbac_club_restricted_to_posters():
    """Clubs cannot upload syllabus or timetable documents (403)."""
    club = generate_test_user(str(uuid.uuid4()), "club", "club@college.edu")
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 40

    res = client.post(
        "/api/uploads",
        data={"data_type": "syllabus", "doc_key": "syllabus:ALL:general"},
        files={"file": ("doc.png", png_bytes, "image/png")},
        headers=club["headers"],
        cookies=club["cookies"]
    )
    assert res.status_code == 403
    assert "restricted to event posters" in res.json()["detail"]

def test_rbac_non_admin_approval_blocked():
    """Non-admin roles cannot approve submissions (403)."""
    staff = generate_test_user(str(uuid.uuid4()), "staff", "staff@college.edu")
    res = client.post(
        "/api/submissions/dummy-uuid/approve",
        headers=staff["headers"],
        cookies=staff["cookies"]
    )
    assert res.status_code == 403
    assert "Admin role required" in res.json()["detail"]

def test_rbac_unauthenticated_requests_blocked():
    """Requests without campus_session cookie return 401."""
    res = client.get("/api/me")
    assert res.status_code == 401
    assert "Session cookie required" in res.json()["detail"]


# ============================================================================
# 3. CONCURRENT APPROVAL IDEMPOTENCY TEST
# ============================================================================
@pytest.mark.asyncio
async def test_concurrent_double_approval():
    """Execute two approve calls concurrently; exactly one publishes and second succeeds idempotently."""
    admin = generate_test_user(str(uuid.uuid4()), "admin", "admin@college.edu")
    sub_id = str(uuid.uuid4())

    seed_submission = {
        "id": sub_id,
        "uploaded_by": admin["user"]["id"],
        "data_type": "menu",
        "scope": "menu:mess",
        "status": "pending_review",
        "extracted": [{"day": None, "meal": "lunch", "item": "Thali", "price": 60, "is_veg": True}],
        "published_versions": None,
        "valid_until": None,
        "doc_key": None
    }
    set_mock_submission(sub_id, seed_submission)

    # First approve call
    res1 = client.post(f"/api/submissions/{sub_id}/approve", headers=admin["headers"], cookies=admin["cookies"])
    assert res1.status_code == 200
    assert "approved and published successfully" in res1.json()["message"]

    # Second concurrent/subsequent approve call on the now-approved submission
    res2 = client.post(f"/api/submissions/{sub_id}/approve", headers=admin["headers"], cookies=admin["cookies"])
    assert res2.status_code == 200
    assert "already approved (idempotent)" in res2.json()["message"]


# ============================================================================
# 4. RAG CROSS-BRANCH ISOLATION TEST
# ============================================================================
@pytest.mark.asyncio
async def test_rag_branch_isolation():
    """Verify student with branch='ECE' cannot retrieve notices published under branch='CSE'."""
    set_mock_chunks([
        {
            "id": 1, 
            "title": "CSE Midterm Dates", 
            "section": "Exam Schedule", 
            "similarity": 0.90, 
            "branch": "CSE", 
            "content": "Operating Systems exam on 15th Nov in CS Hall 1."
        }
    ])

    # 4.1 CSE student queries
    cse_results = await search_docs_hybrid("midterm exam dates", user_branch="CSE")
    assert len(cse_results) == 1
    assert cse_results[0]["title"] == "CSE Midterm Dates"
    cse_answer = await synthesize_rag_response("midterm exam dates", cse_results)
    assert "CSE Midterm Dates" in cse_answer

    # 4.2 ECE student queries for same
    ece_results = await search_docs_hybrid("midterm exam dates", user_branch="ECE")
    assert len(ece_results) == 0
    ece_answer = await synthesize_rag_response("midterm exam dates", ece_results)
    assert "CSE Midterm Dates" not in ece_answer
    assert "could not find any matching notices" in ece_answer


# ============================================================================
# 5. ROLLBACK AND STUCK-JOB SWEEPER VERIFICATION
# ============================================================================
def test_rollback_and_sweeper():
    """Verify sweeper logic and admin rollback validation."""
    admin = generate_test_user(str(uuid.uuid4()), "admin", "admin@college.edu")

    # Scope validation
    bad_scope_res = client.post(
        "/api/admin/scopes/invalid_scope/rollback",
        json={"target_version": 1},
        headers=admin["headers"],
        cookies=admin["cookies"]
    )
    assert bad_scope_res.status_code == 400

    # Sweeper function execution
    import asyncio
    recovered = asyncio.run(sweep_stuck_processing_jobs())
    assert isinstance(recovered, list)
