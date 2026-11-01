import pytest
import io
import os
import uuid
import jwt
import numpy as np
from datetime import datetime, date, timedelta, timezone
from fastapi.testclient import TestClient

os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-key-32-characters-long!"
os.environ["COLLEGE_EMAIL_DOMAIN"] = "college.edu"
os.environ["EMAIL_API_KEY"] = "re_mock_test_key"
os.environ["ALLOWED_ORIGINS"] = "https://app.campus.edu,http://testserver"

from app.main import app
from app.core.config import settings
from app.services.auth_service import (
    hash_otp_code, 
    generate_csrf_token, 
    verify_csrf_token,
    request_otp,
    verify_otp,
    _mock_otps
)
from app.core.middleware import (
    session_cache, 
    evict_session_cache, 
    set_mock_user_in_cache
)
from app.services.validators import run_deterministic_validators
from app.services.embedding_service import (
    validate_doc_key_namespace,
    chunk_markdown_by_headings,
    generate_l2_normalized_embeddings
)

client = TestClient(app, base_url="http://testserver")

# ============================================================================
# PHASE 1 TESTS
# ============================================================================

def test_v1_4_email_domain_enforcement():
    """V1.4: Reject emails not matching official college domain with HTTP 400."""
    resp = client.post(
        "/api/auth/otp/request",
        json={"email": "attacker@gmail.com"}
    )
    assert resp.status_code == 400
    assert "Registration restricted to official @college.edu" in resp.json()["detail"]

def test_v1_3_otp_request_flow():
    """V1.3: Successful OTP request dispatched with HTTP 200."""
    resp = client.post(
        "/api/auth/otp/request",
        json={"email": "student@college.edu"}
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Verification code dispatched successfully."
    assert "student@college.edu" in _mock_otps

def test_v1_5_otp_max_attempts_lockout():
    """V1.5: 5 incorrect verification attempts return 400; 6th returns 429."""
    email = "lockout_test@college.edu"
    client.post("/api/auth/otp/request", json={"email": email})
    
    # Attempts 1 to 5 with wrong code
    for i in range(1, 6):
        resp = client.post("/api/auth/otp/verify", json={"email": email, "code": "000000"})
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Incorrect verification code."

    # 6th attempt exceeds max attempts
    resp_6 = client.post("/api/auth/otp/verify", json={"email": email, "code": "000000"})
    assert resp_6.status_code == 429
    assert resp_6.json()["detail"] == "Max verification attempts exceeded."

def test_otp_verify_and_session_issuance():
    """Verify correct OTP issues JWT session cookie and CSRF token."""
    email = "valid_user@college.edu"
    client.post("/api/auth/otp/request", json={"email": email})
    code = _mock_otps[email]["code"]

    resp = client.post("/api/auth/otp/verify", json={"email": email, "code": code})
    assert resp.status_code == 200
    data = resp.json()
    assert "csrf_token" in data
    assert "campus_session" in resp.cookies
    assert data["user"]["email"] == email

def test_healthz_endpoint():
    """GET /api/healthz returns 200 and health status."""
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_csrf_issuance():
    """GET /api/auth/csrf generates a signed CSRF token."""
    resp = client.get("/api/auth/csrf")
    assert resp.status_code == 200
    csrf_token = resp.json()["csrf_token"]
    assert ":" in csrf_token

def test_v1_6_csrf_token_enforcement():
    """V1.6: State-changing PATCH /api/me without valid X-CSRF-Token returns 403."""
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": "test_csrf@college.edu",
        "role": "student",
        "branch": "CSE",
        "year": 3,
        "section": "A",
        "token_version": 0
    }
    set_mock_user_in_cache(user_id, user_data)
    
    payload = {"sub": user_id, "token_version": 0, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    
    # Call without CSRF token
    resp = client.patch(
        "/api/me",
        json={"veg_pref": True},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 403
    assert "CSRF token validation failed" in resp.json()["detail"]

    # Call with valid CSRF token
    valid_csrf = generate_csrf_token(user_id, 0)
    resp_valid = client.patch(
        "/api/me",
        json={"veg_pref": True},
        headers={"X-CSRF-Token": valid_csrf},
        cookies={"campus_session": token}
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["user"]["veg_pref"] is True

def test_origin_header_validation():
    """State-changing requests with unauthorized origin must return 403."""
    user_id = str(uuid.uuid4())
    user_data = {"id": user_id, "email": "origin@college.edu", "role": "student", "token_version": 0}
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    resp = client.patch(
        "/api/me",
        json={"veg_pref": True},
        headers={"X-CSRF-Token": csrf, "Origin": "https://malicious-site.com"},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 403
    assert "Cross-origin request rejected" in resp.json()["detail"]

def test_v1_7_immediate_token_revocation():
    """Token version mismatch invalidates session immediately."""
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": "revoked@college.edu",
        "role": "admin",
        "token_version": 2 # User's token_version bumped in DB
    }
    set_mock_user_in_cache(user_id, user_data)
    
    # Stale token with token_version = 1
    stale_token = jwt.encode({"sub": user_id, "token_version": 1}, settings.JWT_SECRET, algorithm="HS256")

    resp = client.get("/api/me", cookies={"campus_session": stale_token})
    assert resp.status_code == 401
    assert "Session invalidated" in resp.json()["detail"]


# ============================================================================
# PHASE 2 TESTS
# ============================================================================

def test_v2_1_magic_byte_spoofing_rejection():
    """V2.1: Uploading renamed executable/invalid format returns 415."""
    user_id = str(uuid.uuid4())
    user_data = {"id": user_id, "email": "admin@college.edu", "role": "admin", "token_version": 0}
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    # Fake executable disguised as PDF
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 100

    resp = client.post(
        "/api/uploads",
        data={"data_type": "holidays"},
        files={"file": ("fake.pdf", fake_exe, "application/pdf")},
        headers={"X-CSRF-Token": csrf},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 415
    assert "Unsupported file format" in resp.json()["detail"]

def test_v2_2_size_ceiling_rejection():
    """V2.2: Files exceeding 10 MB limit are rejected with 413."""
    user_id = str(uuid.uuid4())
    user_data = {"id": user_id, "email": "admin@college.edu", "role": "admin", "token_version": 0}
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    # 10 MB + 10 bytes payload with valid PNG header
    oversized = b"\x89PNG\r\n\x1a\n" + b"\x00" * (10 * 1024 * 1024 + 10)

    resp = client.post(
        "/api/uploads",
        data={"data_type": "holidays"},
        files={"file": ("large.png", oversized, "image/png")},
        headers={"X-CSRF-Token": csrf},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 413
    assert "exceeds 10 MB limit" in resp.json()["detail"]

def test_v2_3_pdf_page_cap_rejection():
    """V2.3: PDF exceeding 50 pages is rejected with 422."""
    import pypdf
    writer = pypdf.PdfWriter()
    for _ in range(51):
        writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    user_id = str(uuid.uuid4())
    user_data = {"id": user_id, "email": "admin@college.edu", "role": "admin", "token_version": 0}
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    resp = client.post(
        "/api/uploads",
        data={"data_type": "holidays"},
        files={"file": ("51pages.pdf", pdf_bytes, "application/pdf")},
        headers={"X-CSRF-Token": csrf},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 422
    assert "PDF exceeds 50 pages maximum" in resp.json()["detail"]

def test_rbac_student_upload_rejection():
    """Students are strictly forbidden from uploading (403)."""
    user_id = str(uuid.uuid4())
    user_data = {"id": user_id, "email": "student@college.edu", "role": "student", "token_version": 0}
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 50

    resp = client.post(
        "/api/uploads",
        data={"data_type": "poster"},
        files={"file": ("event.png", valid_png, "image/png")},
        headers={"X-CSRF-Token": csrf},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 403
    assert "Students cannot upload files" in resp.json()["detail"]

def test_rbac_staff_branch_restriction():
    """Staff cannot upload timetables for branches other than their own."""
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id, 
        "email": "staff@college.edu", 
        "role": "staff", 
        "branch": "CSE", 
        "token_version": 0
    }
    set_mock_user_in_cache(user_id, user_data)
    token = jwt.encode({"sub": user_id, "token_version": 0}, settings.JWT_SECRET, algorithm="HS256")
    csrf = generate_csrf_token(user_id, 0)

    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 50

    # Staff with branch CSE trying to upload timetable for ECE
    resp = client.post(
        "/api/uploads",
        data={"data_type": "timetable", "branch": "ECE", "year": 2, "section": "A"},
        files={"file": ("tt.png", valid_png, "image/png")},
        headers={"X-CSRF-Token": csrf},
        cookies={"campus_session": token}
    )
    assert resp.status_code == 403
    assert "Staff can only upload timetables for their own branch" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_v2_5_deterministic_timetable_error():
    """V2.5: Validator flags end_time <= start_time with hard error."""
    bad_slots = [
        {"day": 1, "start_time": "11:00", "end_time": "10:00", "subject": "Math"}
    ]
    flags = await run_deterministic_validators("timetable", bad_slots, {"branch": "CSE"})
    assert flags["has_errors"] is True
    assert "0.end_time" in flags["cells"]
    assert flags["cells"]["0.end_time"]["type"] == "error"

@pytest.mark.asyncio
async def test_v2_6_deterministic_overlap_warning():
    """V2.6: Validator flags overlapping slots with a warning (not hard error)."""
    overlapping_slots = [
        {"day": 1, "start_time": "09:00", "end_time": "11:00", "subject": "Batch A Lab"},
        {"day": 1, "start_time": "09:00", "end_time": "11:00", "subject": "Batch B Lab"}
    ]
    flags = await run_deterministic_validators("timetable", overlapping_slots, {"branch": "CSE"})
    assert flags["has_errors"] is False
    assert flags["has_warnings"] is True
    assert "1.overlap" in flags["cells"]
    assert flags["cells"]["1.overlap"]["type"] == "warning"

@pytest.mark.asyncio
async def test_menu_validators():
    """Menu validator flags invalid price, unknown meal, and missing is_veg."""
    menu_data = [
        {"meal": "invalid_meal", "item": "Dish", "price": -5, "is_veg": None}
    ]
    flags = await run_deterministic_validators("menu", menu_data, {})
    assert flags["has_errors"] is True
    assert flags["has_warnings"] is True
    assert "0.price" in flags["cells"]
    assert "0.meal" in flags["cells"]
    assert "0.is_veg" in flags["cells"]

@pytest.mark.asyncio
async def test_holidays_validators():
    """Holidays validator checks non-empty name and +/- 2-year date window."""
    holidays_data = [
        {"name": "", "date": "2035-01-01"}
    ]
    flags = await run_deterministic_validators("holidays", holidays_data, {})
    assert flags["has_errors"] is True
    assert "0.name" in flags["cells"]
    assert "0.date" in flags["cells"]

@pytest.mark.asyncio
async def test_v2_7_embedding_dimension_and_l2_norm():
    """V2.7: Embeddings are strictly 768-dimensional and L2-normalized to 1.0."""
    texts = ["Computer Science Operating Systems Syllabus", "Campus Hostel Rules"]
    embeddings = await generate_l2_normalized_embeddings(texts)
    assert len(embeddings) == 2
    for emb in embeddings:
        assert len(emb) == 768
        norm = np.linalg.norm(np.array(emb))
        assert abs(norm - 1.0) < 0.001

def test_v2_8_doc_key_namespace_and_isolation():
    """V2.8: Validate doc_key regex and staff cross-branch isolation."""
    # Valid doc keys
    validate_doc_key_namespace("syllabus:CSE:os-lab", user_role="staff", user_branch="CSE")
    validate_doc_key_namespace("notice:ALL:exam-schedule", user_role="admin", user_branch=None)

    # Invalid regex
    with pytest.raises(ValueError):
        validate_doc_key_namespace("invalid_namespace", user_role="admin", user_branch=None)

    # Staff trying to publish under different branch
    with pytest.raises(PermissionError):
        validate_doc_key_namespace("syllabus:CSE:sem5", user_role="staff", user_branch="ECE")

def test_heading_chunker():
    """Heading chunker splits markdown strictly by headings and adds hierarchical prefix."""
    markdown = """
# Mathematics 101
This is the introduction to calculus and linear algebra.

## Unit 1: Differentiation
Differentiation is the process of finding the derivative of a function.
"""
    chunks = chunk_markdown_by_headings("Math Syllabus", markdown)
    assert len(chunks) == 2
    assert chunks[0]["title"] == "Math Syllabus"
    assert chunks[0]["section"] == "Mathematics 101"
    assert "Math Syllabus > Mathematics 101:" in chunks[0]["content"]
    assert chunks[1]["section"] == "Unit 1: Differentiation"
    assert "Math Syllabus > Unit 1: Differentiation:" in chunks[1]["content"]

def test_auth_logout():
    """POST /api/auth/logout clears session cookie."""
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out successfully."

def test_mime_type_sniffing_matrix():
    """Verify magic-byte detection for DOCX, XLSX, JPEG, and WEBP."""
    from app.routers.uploads import sniff_mime_type
    import zipfile

    # DOCX
    buf_docx = io.BytesIO()
    with zipfile.ZipFile(buf_docx, 'w') as z:
        z.writestr('word/document.xml', '<w:document/>')
    assert sniff_mime_type(buf_docx.getvalue()) == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    # XLSX
    buf_xlsx = io.BytesIO()
    with zipfile.ZipFile(buf_xlsx, 'w') as z:
        z.writestr('xl/workbook.xml', '<workbook/>')
    assert sniff_mime_type(buf_xlsx.getvalue()) == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # JPEG
    assert sniff_mime_type(b"\xff\xd8\xff\xe0" + b"\x00" * 20) == "image/jpeg"

    # WEBP
    assert sniff_mime_type(b"RIFF\x20\x00\x00\x00WEBPVP8 " + b"\x00" * 20) == "image/webp"

@pytest.mark.asyncio
async def test_faculty_validators():
    """Faculty validator flags empty name."""
    faculty_data = [
        {"name": "", "email": "prof@college.edu", "department": "CSE"}
    ]
    flags = await run_deterministic_validators("faculty", faculty_data, {})
    assert flags["has_errors"] is True
    assert "0.name" in flags["cells"]

@pytest.mark.asyncio
async def test_notices_and_posters_validators():
    """Notice/poster validator flags past valid_until dates."""
    # Past date
    flags_past = await run_deterministic_validators("notice", {}, {"valid_until": "2020-01-01"})
    assert flags_past["has_errors"] is True
    assert "valid_until" in flags_past["cells"]

    # Future date
    flags_future = await run_deterministic_validators("poster", {}, {"valid_until": "2030-12-31"})
    assert flags_future["has_errors"] is False

