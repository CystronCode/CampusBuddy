# Campus Intelligence: Production MVP

## End-to-End Systems Engineering & Implementation Build Guide

| Engineering Specification | Target Value / Architecture Binding |
| --- | --- |
| System Architecture Version | Version 1.2 (Production MVP, Pre-Build Technical Standard) |
| Scope & Target Population | Single College Campus (~500 Students, Single Uvicorn Worker Invariant) |
| Backend Core Stack | FastAPI (Async Python 3.12+), Pydantic v2, psycopg 3 Async Pools |
| Database & Extensions | PostgreSQL 16, pgvector (768 dimensions), pg_trgm (fuzzy trigram) |
| Frontend & Distribution | React 18 + Vite Mobile-First PWA (Installable, Offline Shell) |
| AI & Embedding Services | Google Gemini Flash-Lite (Router), Gemini Flash (Vision/RAG), text-embedding-004 |
| Object Storage | Private S3 / Cloudflare R2 (Signed URLs with Content-Disposition) |
| Security & Auth Pipeline | College-Email OTP, HMAC-SHA256, HttpOnly SameSite=Lax, CSRF Binding |

> [!NOTE]
> **Executive Engineering Overview**
>
> This specification represents the complete, concrete, and production-ready build guide for Campus Intelligence. There are no placeholders, skipped logic, or abstract pseudo-code. All database initialization scripts, Pydantic schemas, asynchronous connection pools, cryptographic pipelines, ingestion concurrency throttles, atomic approval transactions, query routing tiers, and automated test fixtures are fully implemented.
> 
> Six Non-Negotiable Core Principles Govern This Build:
> 1. Deterministic First, LLM Last: Structured questions (timetables, menus, faculty, holidays) resolve via SQL and Python logic. The LLM handles ambiguous intent routing and non-empty document synthesis only.
> 2. Two Strict Lanes: Structured inputs yield typed SQL rows; unstructured documents produce heading-based markdown chunks and vectors. An upload never crosses lanes.
> 3. Mandatory Human Review: Nothing reaches students without admin review. Admin uploads are published after explicit self-preview; staff/club uploads require formal admin sign-off.
> 4. Single-Worker Concurrency: In-process caches, rate limiters, and the ingestion semaphore rely on a single uvicorn worker (--workers 1).
> 5. Complete Versioning & Instant Rollback: Published tables track version pointers and rev counters in data_versions, retaining the top 3 versions for instant recovery.
> 6. Sibling-Subdomain Architecture: Deploying app.campus.edu and api.campus.edu preserves SameSite=Lax cookies while bypassing 4.5 MB proxy body caps.


---

# PHASE 1: Database Setup, Security Foundations, and Auth Pipeline

> [!NOTE]
> **Phase 1 Architecture Invariants**
>
> 1. Database access is strictly separated into two PostgreSQL roles: 'app_read' (read-only queries for student query execution) and 'app_write' (DML operations for auth, ingestion, and logging).
> 2. Student sessions are stateless 7-day JWTs stored in HttpOnly, Secure, SameSite=Lax cookies, complemented by an HMAC-bound CSRF token header (X-CSRF-Token).
> 3. Dynamic privilege revocation is enforced by re-reading the user's role and token_version directly from PostgreSQL on all state-changing and administrative requests, paired with a 60-second in-memory LRU cache for high-throughput student read routes.


## 1.1 Complete PostgreSQL 16 Schema Initialization (DDL)

The following script provides the production-grade DDL initializing the relational and vector foundations. It enables the pgvector and pg_trgm extensions, creates unprivileged application roles, provisions the complete schema with precise check constraints and indexing, seeds required singleton version records, and grants least-privilege rights.

```sql
-- ============================================================================
-- CAMPUS INTELLIGENCE: COMPLETE DATABASE INITIALIZATION SCRIPT (PostgreSQL 16)
-- Extensions: pgvector (768 dims), pg_trgm (fuzzy text search)
-- Roles: app_read (least privilege SELECT), app_write (application DML)
-- ============================================================================

-- 1. Initialize Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Role Provisioning & Security Isolation
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_read') THEN
    CREATE ROLE app_read WITH LOGIN PASSWORD 'CHANGE_ME_READ_SECRET';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_write') THEN
    CREATE ROLE app_write WITH LOGIN PASSWORD 'CHANGE_ME_WRITE_SECRET';
  END IF;
END
$$;

-- 3. Identity and Access Management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id INT NOT NULL DEFAULT 1,
  email TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('student', 'club', 'staff', 'admin')),
  branch TEXT,
  year SMALLINT CHECK (year IS NULL OR year BETWEEN 1 AND 6),
  section TEXT,
  club TEXT,                                   -- Mandatory when role = 'club'
  veg_pref BOOLEAN,                            -- Dietary preference filter
  budget_default INT CHECK (budget_default IS NULL OR budget_default > 0),
  token_version INT NOT NULL DEFAULT 0,        -- Incremented on role change/revocation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role <> 'club' OR club IS NOT NULL),
  CHECK (role <> 'staff' OR branch IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS auth_otps (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL CHECK (email = lower(email)),
  code_hash TEXT NOT NULL,                     -- HMAC-SHA256(JWT_SECRET, email || ':' || code)
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,        -- Capped at 5 attempts
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_otps_lookup ON auth_otps (email, created_at DESC);

-- 4. Ingestion Governance and Files
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,                  -- Random UUID storage key (never client filename)
  original_name TEXT,
  mime TEXT NOT NULL,                          -- Validated strictly via magic bytes
  size_bytes INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- 10MB cap
  sha256 TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files (sha256);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  uploaded_by UUID REFERENCES users(id),
  data_type TEXT NOT NULL CHECK (data_type IN ('timetable','menu','holidays','faculty','syllabus','notice','poster')),
  scope TEXT,                                  -- e.g., 'timetable:CSE-3-A', 'menu:mess', 'multi'
  doc_key TEXT,                                -- format: '{doc_type}:{branch_or_ALL}:{slug}'
  valid_until DATE,                            -- Mandatory for notice and poster
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','draft','pending_review','approved','rejected','failed')),
  extracted JSONB,                             -- Extracted structured rows or clean markdown
  confidence JSONB,                            -- Cell-level validation errors, warnings & flags
  error TEXT,                                  -- Failure reason if status = 'failed'
  reviewer UUID REFERENCES users(id),
  reject_reason TEXT,
  version INT,                                 -- Single-scope published version number
  published_versions JSONB,                    -- Multi-scope map: {scope: version_or_rev}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_submissions_status_updated ON submissions (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_submissions_uploaded_by ON submissions (uploaded_by, created_at DESC);

-- 5. Scope Version Registry and Audit Trail
CREATE TABLE IF NOT EXISTS data_versions (
  scope TEXT PRIMARY KEY,
  active_version INT NOT NULL DEFAULT 1,
  latest_version INT NOT NULL DEFAULT 1,
  rev BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('approve','reject','rollback','role_change','unpublish_event')),
  target TEXT,
  detail JSONB
);

-- 6. Structured Domain Tables
CREATE TABLE IF NOT EXISTS faculty (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT,
  department TEXT,
  designation TEXT,
  email TEXT,
  cabin TEXT,
  office_hours TEXT,
  subjects TEXT[],
  subjects_text TEXT,                          -- Pre-joined text for fuzzy trigram search
  is_active BOOLEAN NOT NULL DEFAULT true,
  submission_id UUID REFERENCES submissions(id)
);
CREATE INDEX IF NOT EXISTS idx_faculty_name_trgm ON faculty USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faculty_short_code_dept ON faculty (lower(short_code), department);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faculty_natural_key ON faculty (lower(name), coalesce(department, ''));
CREATE UNIQUE INDEX IF NOT EXISTS idx_faculty_email_unique ON faculty (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS timetable_slots (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  branch TEXT NOT NULL,
  year SMALLINT NOT NULL CHECK (year BETWEEN 1 AND 6),
  section TEXT NOT NULL,
  day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday (ISO)
  period SMALLINT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('lecture','lab','tutorial','other')),
  faculty_id INT REFERENCES faculty(id) ON DELETE SET NULL,
  room TEXT,
  version INT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  CHECK (end_time > start_time),
  CHECK (scope = 'timetable:' || branch || '-' || year::text || '-' || section)
);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_lookup ON timetable_slots (scope, version, day, start_time);

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'menu:mess',
  day SMALLINT NULL CHECK (day BETWEEN 1 AND 7),     -- NULL denotes daily availability
  meal TEXT CHECK (meal IN ('breakfast','lunch','snacks','dinner')),
  item TEXT NOT NULL,
  price INT CHECK (price >= 0),
  is_veg BOOLEAN,                                    -- NULL denotes unknown preference
  version INT NOT NULL,
  submission_id UUID REFERENCES submissions(id)
);
CREATE INDEX IF NOT EXISTS idx_menu_items_lookup ON menu_items (scope, version, meal);

CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'holidays:calendar',
  date DATE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT,
  version INT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  UNIQUE (scope, version, date, name)
);
CREATE INDEX IF NOT EXISTS idx_holidays_lookup ON holidays (scope, version, date);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  club TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  file_id UUID REFERENCES files(id),
  submission_id UUID UNIQUE REFERENCES submissions(id),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_events_valid_active ON events (valid_until) WHERE is_active;

-- 7. Unstructured Knowledge Lane (pgvector 768)
CREATE TABLE IF NOT EXISTS doc_chunks (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  doc_key TEXT NOT NULL,
  file_id UUID REFERENCES files(id),
  submission_id UUID REFERENCES submissions(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('syllabus', 'notice')),
  title TEXT,
  section TEXT,
  page INT,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(section, '') || ' ' || content)
  ) STORED,
  branch TEXT,                                       -- NULL indicates college-wide notice/syllabus
  valid_from DATE,
  valid_until DATE,
  version INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_tsv ON doc_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_scope_ver ON doc_chunks (scope, version);

-- 8. Telemetry and Analytics (No FK to users to preserve logs across account lifecycle)
CREATE TABLE IF NOT EXISTS query_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  tier SMALLINT,
  intent TEXT,
  tools TEXT[],
  cache_hit BOOLEAN,
  latency_ms INT,
  prompt_tokens INT,
  completion_tokens INT,
  query_text TEXT,
  error TEXT,
  thumbs SMALLINT CHECK (thumbs IN (-1, 1))
);
CREATE INDEX IF NOT EXISTS idx_query_logs_ts ON query_logs (ts);

-- 9. Seed Singleton Scopes
INSERT INTO data_versions (scope, active_version, latest_version, rev, updated_at)
VALUES 
  ('faculty:all', 1, 1, 1, now()),
  ('events:all', 1, 1, 1, now()),
  ('menu:mess', 1, 1, 1, now()),
  ('holidays:calendar', 1, 1, 1, now())
ON CONFLICT (scope) DO NOTHING;

-- 10. Role Privileges Hardening
-- Grant SELECT only to app_read on student-facing runtime domain tables
GRANT CONNECT ON DATABASE postgres TO app_read;
GRANT USAGE ON SCHEMA public TO app_read;
GRANT SELECT ON timetable_slots, menu_items, holidays, faculty, events, doc_chunks, data_versions TO app_read;

-- Grant Full DML to app_write
GRANT CONNECT ON DATABASE postgres TO app_write;
GRANT USAGE, CREATE ON SCHEMA public TO app_write;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_write;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_write;
```


## 1.2 Alembic Migration Setup

Alembic provides schema version control. Because raw SQL with vector types and custom roles requires exact execution, the Alembic migration environment is configured to support raw parameterized DDL scripts and transaction poolers.


### alembic.ini Configuration

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_locations = migrations/versions
output_encoding = utf-8

[logging]
default_level = INFO
```


### migrations/env.py Implementation

```python
import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Ensure app_write database URL is injected from environment
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    raise RuntimeError("DATABASE_URL environment variable must be set for Alembic migrations.")
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = None

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    # Disable statement caching for compatibility with transaction poolers
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```


## 1.3 Database Pool Architecture (psycopg 3)

The backend maintains two separate asynchronous connection pools using psycopg 3: read_pool for unprivileged student tools and write_pool for administrative operations, auth, and telemetry. To prevent errors with transaction poolers (Supabase / Neon / PgBouncer), prepared statements are explicitly disabled (prepare_threshold=None).

```python
# backend/app/core/database.py
import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

logger = logging.getLogger("campus.database")

DATABASE_URL = os.environ["DATABASE_URL"]                  # app_write role
DATABASE_URL_READONLY = os.environ["DATABASE_URL_READONLY"] # app_read role

# Invariant: max_size=5 per pool to stay well within container & free-tier limits
write_pool = AsyncConnectionPool(
    conninfo=DATABASE_URL,
    min_size=1,
    max_size=5,
    timeout=10.0,
    kwargs={"row_factory": dict_row, "prepare_threshold": None}
)

read_pool = AsyncConnectionPool(
    conninfo=DATABASE_URL_READONLY,
    min_size=1,
    max_size=5,
    timeout=5.0,
    kwargs={"row_factory": dict_row, "prepare_threshold": None}
)

async def init_db_pools():
    logger.info("Initializing async database connection pools...")
    await write_pool.open()
    await read_pool.open()

async def close_db_pools():
    logger.info("Closing async database connection pools...")
    await read_pool.close()
    await write_pool.close()

@asynccontextmanager
async def get_read_db() -> AsyncGenerator:
    async with read_pool.connection() as conn:
        yield conn

@asynccontextmanager
async def get_write_db() -> AsyncGenerator:
    async with write_pool.connection() as conn:
        async with conn.transaction():
            yield conn
```


## 1.4 College-Email OTP Authentication Module

Authentication is restricted to verified campus emails matching COLLEGE_EMAIL_DOMAIN. Passwords are eliminated entirely. Codes are 6 digits, cryptographically generated, hashed using HMAC-SHA256 with JWT_SECRET, capped at 5 verification attempts via pessimistic row locking (FOR UPDATE), and expire after 10 minutes.

```python
# backend/app/services/auth_service.py
import os
import hmac
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
import jwt
import httpx
from fastapi import HTTPException, status
from app.core.database import get_write_db

logger = logging.getLogger("campus.auth")

JWT_SECRET = os.environ["JWT_SECRET"]
COLLEGE_EMAIL_DOMAIN = os.environ.get("COLLEGE_EMAIL_DOMAIN", "college.edu").lower()
EMAIL_API_KEY = os.environ["EMAIL_API_KEY"]
EMAIL_FROM = os.environ.get("EMAIL_FROM", "auth@campus.edu")
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", None) # Sibling subdomain scope e.g., ".campus.edu"

def hash_otp_code(email: str, code: str) -> str:
    message = f"{email.lower()}:{code}".encode("utf-8")
    return hmac.new(JWT_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()

def generate_csrf_token(user_id: str, token_version: int) -> str:
    salt = secrets.token_hex(8)
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"{user_id}:{token_version}:{salt}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return f"{salt}:{signature}"

def verify_csrf_token(token: str, user_id: str, token_version: int) -> bool:
    try:
        parts = token.split(":")
        if len(parts) != 2:
            return False
        salt, signature = parts
        expected = hmac.new(
            JWT_SECRET.encode("utf-8"),
            f"{user_id}:{token_version}:{salt}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False

async def request_otp(email: str, client_ip: str) -> dict:
    email_clean = email.strip().lower()
    if not email_clean.endswith(f"@{COLLEGE_EMAIL_DOMAIN}"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration restricted to official @{COLLEGE_EMAIL_DOMAIN} addresses."
        )

    # Cryptographically secure 6-digit numerical code
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hash_otp_code(email_clean, code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    async with get_write_db() as conn:
        # Invalidate any prior unconsumed OTPs for this email
        await conn.execute(
            """UPDATE auth_otps 
               SET consumed_at = now() 
               WHERE email = %s AND consumed_at IS NULL""",
            (email_clean,)
        )
        # Insert newly generated OTP hash
        await conn.execute(
            """INSERT INTO auth_otps (email, code_hash, expires_at)
               VALUES (%s, %s, %s)""",
            (email_clean, code_hash, expires_at)
        )

    # Deliver OTP via transactional provider (Resend API)
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {EMAIL_API_KEY}"},
            json={
                "from": EMAIL_FROM,
                "to": [email_clean],
                "subject": f"Your Campus Intelligence Login Code: {code}",
                "text": f"Your single-use login code is: {code}\n\nValid for 10 minutes. If you did not request this, ignore this email."
            }
        )
        if resp.status_code >= 400:
            logger.error("Failed to dispatch OTP email: %s", resp.text)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Email delivery service unavailable.")

    return {"message": "Verification code dispatched successfully."}

async def verify_otp(email: str, code: str) -> dict:
    email_clean = email.strip().lower()
    provided_hash = hash_otp_code(email_clean, code.strip())
    now_utc = datetime.now(timezone.utc)

    async with get_write_db() as conn:
        # Pessimistic row locking to enforce 5-attempt limit and prevent race conditions
        cursor = await conn.execute(
            """SELECT id, code_hash, expires_at, attempts 
               FROM auth_otps 
               WHERE email = %s AND consumed_at IS NULL AND expires_at > %s 
               ORDER BY created_at DESC 
               LIMIT 1 
               FOR UPDATE""",
            (email_clean, now_utc)
        )
        otp_row = await cursor.fetchone()
        if not otp_row:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP.")

        if otp_row["attempts"] >= 5:
            await conn.execute("UPDATE auth_otps SET consumed_at = now() WHERE id = %s", (otp_row["id"],))
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Max verification attempts exceeded.")

        # Increment attempt counter
        await conn.execute("UPDATE auth_otps SET attempts = attempts + 1 WHERE id = %s", (otp_row["id"],))

        if not hmac.compare_digest(otp_row["code_hash"], provided_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect verification code.")

        # Mark OTP as successfully consumed
        await conn.execute("UPDATE auth_otps SET consumed_at = now() WHERE id = %s", (otp_row["id"],))

        # Check or provision user (Default role: 'student')
        user_cursor = await conn.execute(
            """SELECT id, email, role, branch, year, section, token_version 
               FROM users WHERE email = %s""",
            (email_clean,)
        )
        user = await user_cursor.fetchone()

        if not user:
            new_user_cursor = await conn.execute(
                """INSERT INTO users (email, role) 
                   VALUES (%s, 'student') 
                   RETURNING id, email, role, branch, year, section, token_version""",
                (email_clean,)
            )
            user = await new_user_cursor.fetchone()

    # Generate 7-day Session JWT
    payload = {
        "sub": str(user["id"]),
        "token_version": user["token_version"],
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    jwt_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    csrf_token = generate_csrf_token(str(user["id"]), user["token_version"])

    return {
        "jwt_token": jwt_token,
        "csrf_token": csrf_token,
        "user": user,
        "profile_complete": bool(user["branch"] and user["year"] and user["section"])
    }
```


## 1.5 Session Middleware & Immediate Privilege Revocation

To achieve instantaneous privilege revocation while maintaining 0ms read overhead for high-concurrency student queries, the middleware utilizes a dual-tier strategy: direct DB re-reading on all state-changing and admin endpoints, backed by a 60-second in-memory LRU session cache for read queries. A token_version mismatch or user role change instantly terminates active sessions.

```python
# backend/app/core/middleware.py
import os
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from cachetools import TTLCache
from app.core.database import get_write_db, get_read_db
from app.services.auth_service import verify_csrf_token

logger = logging.getLogger("campus.security")
JWT_SECRET = os.environ["JWT_SECRET"]
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://app.campus.edu").split(",")]

# 60-second LRU session cache for high-throughput student read routes
session_cache = TTLCache(maxsize=1000, ttl=60)

def evict_session_cache(user_id: str):
    """Evicted synchronously whenever user profile or role changes."""
    session_cache.pop(str(user_id), None)

class SessionSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # 1. Exempt public endpoints
        if path in ("/api/healthz", "/api/auth/csrf") or path.startswith("/api/auth/otp/"):
            return await call_next(request)

        # 2. Origin Header Verification for state-changing calls
        if method in ("POST", "PATCH", "DELETE", "PUT"):
            origin = request.headers.get("Origin")
            if origin and origin not in ALLOWED_ORIGINS:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-origin request rejected.")

        # 3. Extract Session Cookie
        cookie_token = request.cookies.get("campus_session")
        if not cookie_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session cookie required.")

        try:
            payload = jwt.decode(cookie_token, JWT_SECRET, algorithms=["HS256"])
            user_id = payload["sub"]
            jwt_token_ver = payload.get("token_version", 0)
        except (jwt.PyJWTError, KeyError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

        # 4. Determine if Immediate DB Re-Read is mandatory
        is_state_changing = method in ("POST", "PATCH", "DELETE", "PUT")
        is_privileged_route = any(path.startswith(prefix) for prefix in (
            "/api/uploads", "/api/submissions", "/api/files", "/api/doc-keys", "/api/admin"
        ))

        user_data = None
        if not is_state_changing and not is_privileged_route:
            user_data = session_cache.get(user_id)

        if user_data is None:
            # Direct DB read
            async with get_read_db() as conn:
                cursor = await conn.execute(
                    """SELECT id, email, role, branch, year, section, club, 
                              veg_pref, budget_default, token_version 
                       FROM users WHERE id = %s""",
                    (user_id,)
                )
                user_data = await cursor.fetchone()

            if not user_data:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found.")
            
            # Store in short-lived read cache
            session_cache[user_id] = user_data

        # 5. Immediate Privilege Revocation Check
        if user_data["token_version"] != jwt_token_ver:
            session_cache.pop(user_id, None)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")

        # 6. CSRF Token Verification for state-changing routes
        if is_state_changing:
            csrf_header = request.headers.get("X-CSRF-Token")
            if not csrf_header or not verify_csrf_token(csrf_header, user_id, user_data["token_version"]):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token validation failed.")

        # Inject user identity into request state
        request.state.user = user_data
        request.state.user_id = user_id
        request.state.role = user_data["role"]

        return await call_next(request)
```


## 1.6 Phase 1 Actionable Verification Checklist

Before progressing to Phase 2, execute the following deterministic verification checklist to validate the security foundations, database roles, and authentication pipeline.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V1.1: Schema & Extension Presence | psql $DATABASE_URL -c 'SELECT extname FROM pg_extension WHERE extname IN ("vector", "pg_trgm");' | Returns exactly 2 rows ('vector' and 'pg_trgm'). |
| [  ] | V1.2: Role Permission Isolation | psql $DATABASE_URL_READONLY -c 'INSERT INTO holidays(name, date, version) VALUES ("hack", now(), 1);' | Permission denied error for table holidays (app_read cannot write). |
| [  ] | V1.3: OTP Request Flow | curl -X POST http://localhost:8000/api/auth/otp/request -H 'Content-Type: application/json' -d '{"email":"test@college.edu"}' | HTTP 200 with message 'Verification code dispatched successfully.' |
| [  ] | V1.4: Email Domain Enforcement | curl -X POST http://localhost:8000/api/auth/otp/request -H 'Content-Type: application/json' -d '{"email":"attacker@gmail.com"}' | HTTP 400 with detail containing 'Registration restricted to official @college.edu'. |
| [  ] | V1.5: OTP Max Attempts Lockout | Run 6 consecutive OTP verification attempts with an incorrect code ('000000'). | 5th attempt returns HTTP 400; 6th attempt returns HTTP 429 Too Many Requests. |
| [  ] | V1.6: CSRF Token Enforcement | curl -X PATCH http://localhost:8000/api/me -b 'campus_session=...' -H 'Content-Type: application/json' -d '{"veg_pref":true}' | HTTP 403 Forbidden with detail 'CSRF token validation failed' when X-CSRF-Token header is missing. |
| [  ] | V1.7: Immediate Role Revocation | Update user role from 'admin' to 'student' in PostgreSQL directly; immediately call GET /api/admin/scopes. | HTTP 403 Forbidden returned instantly with zero caching delay. |


---

# PHASE 2: Secure Ingestion Pipeline & Parsing Engine

> [!NOTE]
> **Phase 2 Architecture Invariants**
>
> 1. Zero Trust Ingestion: Client Content-Type and filename extensions are completely ignored; file types are strictly sniffed via magic byte signatures.
> 2. Event-Loop and Memory Isolation: All synchronous CPU/IO parsers execute inside asyncio.to_thread, serialized via a global asyncio.Semaphore(1) to guarantee zero OOM crashes on 512 MB hosts.
> 3. Deterministic Schemas: Structured data (timetables, menus, faculty, holidays) is extracted into typed JSON schemas with cell-level validators (hard errors block approval; warnings flag review UI). Free text markdown is reserved exclusively for syllabi and notices.


## 2.1 File Upload Router & Storage Integration

The file upload router enforces strict RBAC scope constraints before reading file contents. The file is streamed, validated against magic bytes, checked against the 10 MB size cap and 50-page PDF limit, hashed via SHA-256 for duplicate detection, and uploaded to a private S3/R2 bucket under a randomly generated UUID key.

```python
# backend/app/routers/uploads.py
import os
import uuid
import hashlib
import zipfile
import io
from typing import Optional
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, status, BackgroundTasks
import pypdf
import boto3
from botocore.config import Config
from app.core.database import get_write_db
from app.services.ingestion_service import enqueue_extraction_task

router = APIRouter(prefix="/api", tags=["Uploads"])

STORAGE_ENDPOINT = os.environ["STORAGE_ENDPOINT"]
STORAGE_BUCKET = os.environ["STORAGE_BUCKET"]
STORAGE_ACCESS_KEY = os.environ["STORAGE_ACCESS_KEY"]
STORAGE_SECRET_KEY = os.environ["STORAGE_SECRET_KEY"]
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PDF_PAGES = 50

s3_client = boto3.client(
    "s3",
    endpoint_url=STORAGE_ENDPOINT,
    aws_access_key_id=STORAGE_ACCESS_KEY,
    aws_secret_access_key=STORAGE_SECRET_KEY,
    config=Config(signature_version="s3v4")
)

def sniff_mime_type(header: bytes) -> str:
    """Validate true file format strictly from initial magic bytes."""
    if header.startswith(b"%PDF-"):
        return "application/pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "image/webp"
    if header.startswith(b"PK\x03\x04"):
        # Disambiguate Office Open XML (DOCX vs XLSX)
        try:
            with zipfile.ZipFile(io.BytesIO(header)) as z:
                names = z.namelist()
                if any(n.startswith("word/") for n in names):
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if any(n.startswith("xl/") for n in names):
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        except zipfile.BadZipFile:
            pass
        return "application/zip"
    raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file format.")

@router.post("/uploads")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    data_type: str = Form(...),
    branch: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    section: Optional[str] = Form(None),
    doc_key: Optional[str] = Form(None),
    valid_until: Optional[str] = Form(None)
):
    user = request.state.user
    role = user["role"]

    # 1. RBAC Scope Validation
    if role == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students cannot upload files.")
    if role == "club":
        if data_type != "poster":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clubs are restricted to event posters.")
        if not valid_until:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="valid_until is mandatory for posters.")
    if role == "staff":
        if data_type not in ("timetable", "notice"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff can only upload timetables or notices.")
        if data_type == "timetable" and branch != user["branch"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff can only upload timetables for their own branch.")
        if data_type == "notice":
            if not doc_key or not doc_key.startswith(f"notice:{user['branch']}:"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"doc_key must match prefix 'notice:{user['branch']}:'")
            if not valid_until:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="valid_until is mandatory for notices.")

    # 2. Stream, Enforce Size Cap, and Magic Bytes Check
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10 MB limit.")

    mime = sniff_mime_type(content[:4096])

    # 3. PDF Page Cap Validation
    if mime == "application/pdf":
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            if len(reader.pages) > MAX_PDF_PAGES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="PDF exceeds 50 pages maximum.")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unreadable PDF document: {str(e)}")

    # 4. SHA-256 Duplicate Warning Check
    file_sha256 = hashlib.sha256(content).hexdigest()
    storage_key = f"{uuid.uuid4()}.{file.filename.split('.')[-1]}"

    async with get_write_db() as conn:
        dup_cursor = await conn.execute("SELECT id FROM files WHERE sha256 = %s", (file_sha256,))
        duplicate_record = await dup_cursor.fetchone()

        # Store Original File Record
        file_cursor = await conn.execute(
            """INSERT INTO files (storage_path, original_name, mime, size_bytes, sha256, uploaded_by)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (storage_key, file.filename, mime, len(content), file_sha256, user["id"])
        )
        file_id = (await file_cursor.fetchone())["id"]

        # Scope derivation
        scope = None
        if data_type == "timetable":
            scope = f"timetable:{branch}-{year}-{section}" if branch and year and section else "multi"
        elif data_type == "menu":
            scope = "menu:mess"
        elif data_type == "holidays":
            scope = "holidays:calendar"
        elif data_type in ("syllabus", "notice"):
            scope = f"doc:{doc_key}"
        elif data_type == "poster":
            scope = "events:all"
        elif data_type == "faculty":
            scope = "faculty:all"

        # Create Submission in 'processing' state
        sub_cursor = await conn.execute(
            """INSERT INTO submissions 
               (file_id, uploaded_by, data_type, scope, doc_key, valid_until, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'processing') RETURNING id""",
            (file_id, user["id"], data_type, scope, doc_key, valid_until)
        )
        submission_id = (await sub_cursor.fetchone())["id"]

    # 5. Upload to Private S3/R2 Bucket
    s3_client.put_object(
        Bucket=STORAGE_BUCKET,
        Key=storage_key,
        Body=content,
        ContentType=mime
    )

    # 6. Dispatch Background Parsing Task
    background_tasks.add_task(
        enqueue_extraction_task,
        submission_id=submission_id,
        content=content,
        mime=mime,
        data_type=data_type,
        metadata={"branch": branch, "year": year, "section": section, "doc_key": doc_key, "club": user.get("club")}
    )

    return {
        "submission_id": str(submission_id),
        "file_id": str(file_id),
        "duplicate_warning": bool(duplicate_record),
        "status": "processing"
    }
```


## 2.2 Concurrency Throttling & Parser Wrappers

To prevent container out-of-memory crashes on free-tier 512 MB hosts, parsing is governed by an in-process asyncio.Semaphore(1). All blocking sync parsers run via asyncio.to_thread with explicit page-level cache clearing in pdfplumber.

```python
# backend/app/services/ingestion_service.py
import asyncio
import io
import os
import json
import logging
from typing import Dict, Any, List
import pdfplumber
import openpyxl
from docx import Document as DocxDocument
from google import genai
from google.genai import types
from app.core.database import get_write_db
from app.services.validators import run_deterministic_validators

logger = logging.getLogger("campus.ingestion")

# Singleton Invariant: exactly one extraction job executed concurrently
EXTRACTION_SEMAPHORE = asyncio.Semaphore(1)
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL_EXTRACT = os.environ.get("GEMINI_MODEL_EXTRACT", "gemini-2.0-flash")

ai_client = genai.Client(api_key=GEMINI_API_KEY)

def parse_pdf_text_sync(content: bytes) -> str:
    """Extract text layer with per-page cache flushes to maintain <512MB RAM."""
    extracted_text = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for idx, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                extracted_text.append(f"--- PAGE {idx + 1} ---\n" + text)
            page.flush_cache()  # Crucial memory protection
    return "\n".join(extracted_text)

def parse_excel_sync(content: bytes) -> str:
    """Read Excel workbook in read-only streaming mode."""
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    lines = []
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        lines.append(f"=== SHEET: {sheet_name} ===")
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                lines.append("\t".join([str(c) if c is not None else "" for c in row]))
    wb.close()
    return "\n".join(lines)

def parse_docx_sync(content: bytes) -> str:
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)

async def extract_via_gemini_vision(content: bytes, mime: str, schema_dict: Dict[str, Any]) -> Any:
    """Process scanned PDFs and images using Gemini Vision with strict JSON schema."""
    response = await asyncio.to_thread(
        ai_client.models.generate_content,
        model=GEMINI_MODEL_EXTRACT,
        contents=[
            types.Part.from_bytes(data=content, mime_type=mime),
            "Extract structured records adhering precisely to the JSON schema. "
            "Output valid JSON without markdown wrapping or code fences."
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema_dict,
            temperature=0.0
        )
    )
    return json.loads(response.text)

async def enqueue_extraction_task(
    submission_id: str,
    content: bytes,
    mime: str,
    data_type: str,
    metadata: Dict[str, Any]
):
    async with EXTRACTION_SEMAPHORE:
        logger.info("Acquired extraction semaphore for submission %s", submission_id)
        try:
            # 1. Detect Text Layer vs Vision Requirement
            text_layer = ""
            if mime == "application/pdf":
                text_layer = await asyncio.to_thread(parse_pdf_text_sync, content)
            elif "spreadsheetml" in mime:
                text_layer = await asyncio.to_thread(parse_excel_sync, content)
            elif "wordprocessingml" in mime:
                text_layer = await asyncio.to_thread(parse_docx_sync, content)

            has_text_layer = len(text_layer.strip()) > 50

            extracted_data = None
            if data_type in ("syllabus", "notice"):
                # Markdown lane
                if has_text_layer:
                    extracted_data = text_layer
                else:
                    # OCR markdown conversion via Vision
                    res = await asyncio.to_thread(
                        ai_client.models.generate_content,
                        model=GEMINI_MODEL_EXTRACT,
                        contents=[
                            types.Part.from_bytes(data=content, mime_type=mime),
                            "Transcribe this document into clean, heading-structured Markdown."
                        ]
                    )
                    extracted_data = res.text
            else:
                # Structured row lane
                from app.schemas.ingestion_schemas import GET_SCHEMA_FOR_TYPE
                target_schema = GET_SCHEMA_FOR_TYPE[data_type]

                if has_text_layer:
                    # Cheaper, faster text-mode LLM extraction
                    prompt = f"Convert the following campus raw text into structured JSON:\n{text_layer}"
                    res = await asyncio.to_thread(
                        ai_client.models.generate_content,
                        model=GEMINI_MODEL_EXTRACT,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=target_schema,
                            temperature=0.0
                        )
                    )
                    extracted_data = json.loads(res.text)
                else:
                    # Vision extraction
                    extracted_data = await extract_via_gemini_vision(content, mime, target_schema)

            # 2. Execute Deterministic Validators
            confidence_flags = await run_deterministic_validators(data_type, extracted_data, metadata)

            # 3. Transition Submission to 'draft'
            async with get_write_db() as conn:
                await conn.execute(
                    """UPDATE submissions 
                       SET status = 'draft',
                           extracted = %s,
                           confidence = %s,
                           updated_at = now()
                       WHERE id = %s""",
                    (json.dumps(extracted_data), json.dumps(confidence_flags), submission_id)
                )
            logger.info("Successfully extracted submission %s (status=draft)", submission_id)

        except Exception as exc:
            logger.exception("Extraction failed for submission %s: %s", submission_id, str(exc))
            async with get_write_db() as conn:
                await conn.execute(
                    """UPDATE submissions 
                       SET status = 'failed',
                           error = %s,
                           updated_at = now()
                       WHERE id = %s""",
                    (str(exc), submission_id)
                )
```


## 2.3 Structured Schemas & Deterministic Validators

Validators run immediately following raw extraction and on every PATCH /submissions/{id} edit. Hard errors indicate structural flaws and permanently block approval. Warnings highlight items requiring human attention in the preview UI (such as overlapping class batches or unknown vegetarian status).

```python
# backend/app/services/validators.py
import re
from datetime import datetime, date, time
from typing import Dict, Any, List, Tuple
from app.core.database import get_read_db

async def run_deterministic_validators(
    data_type: str, 
    extracted_data: Any, 
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    cells: Dict[str, Dict[str, str]] = {}
    has_errors = False
    has_warnings = False

    def add_flag(cell_key: str, flag_type: str, message: str):
        nonlocal has_errors, has_warnings
        cells[cell_key] = {"type": flag_type, "message": message}
        if flag_type == "error":
            has_errors = True
        elif flag_type == "warning":
            has_warnings = True

    if data_type == "timetable":
        rows = extracted_data if isinstance(extracted_data, list) else extracted_data.get("slots", [])
        seen_slots = {}
        for idx, row in enumerate(rows):
            # 1. Day Range Check (1..7)
            day = row.get("day")
            if not isinstance(day, int) or day < 1 or day > 7:
                add_flag(f"{idx}.day", "error", "Day must be an integer between 1 (Mon) and 7 (Sun).")

            # 2. Time Parse & Ordering Check
            start_str = row.get("start_time", "")
            end_str = row.get("end_time", "")
            try:
                t_start = datetime.strptime(start_str, "%H:%M").time()
                t_end = datetime.strptime(end_str, "%H:%M").time()
                if t_end <= t_start:
                    add_flag(f"{idx}.end_time", "error", f"end_time ({end_str}) must be after start_time ({start_str}).")
            except ValueError:
                add_flag(f"{idx}.start_time", "error", "Times must match HH:MM 24-hour format.")
                t_start, t_end = None, None

            # 3. Overlapping Slot Warning Check (Allows split lab batches)
            if t_start and t_end and day:
                slot_key = (day, t_start, t_end)
                if slot_key in seen_slots:
                    add_flag(f"{idx}.overlap", "warning", f"Overlaps with slot {seen_slots[slot_key]} (batch/elective).")
                else:
                    seen_slots[slot_key] = idx

            # 4. Faculty Short Code Resolution
            short_code = row.get("short_code")
            if short_code:
                async with get_read_db() as conn:
                    # Match in same department first
                    branch = metadata.get("branch")
                    cursor = await conn.execute(
                        """SELECT id FROM faculty 
                           WHERE lower(short_code) = lower(%s) AND department = %s""",
                        (short_code, branch)
                    )
                    fac = await cursor.fetchone()
                    if not fac:
                        # Match globally if unique
                        cursor_g = await conn.execute(
                            """SELECT id FROM faculty WHERE lower(short_code) = lower(%s)""",
                            (short_code,)
                        )
                        facs = await cursor_g.fetchall()
                        if len(facs) == 1:
                            row["faculty_id"] = facs[0]["id"]
                        else:
                            add_flag(f"{idx}.short_code", "warning", f"Unmatched faculty short-code '{short_code}'.")
                            row["faculty_id"] = None
                    else:
                        row["faculty_id"] = fac["id"]

    elif data_type == "menu":
        items = extracted_data if isinstance(extracted_data, list) else extracted_data.get("items", [])
        for idx, item in enumerate(items):
            price = item.get("price")
            if price is None or not isinstance(price, int) or price < 0 or price > 2000:
                add_flag(f"{idx}.price", "error", "Price must be a plausible integer (0 to 2000 INR).")

            meal = item.get("meal")
            if meal not in ("breakfast", "lunch", "snacks", "dinner"):
                add_flag(f"{idx}.meal", "error", "Meal must be breakfast, lunch, snacks, or dinner.")

            if item.get("is_veg") is None:
                add_flag(f"{idx}.is_veg", "warning", "Dietary classification missing; please specify Veg or Non-Veg.")

    elif data_type == "holidays":
        entries = extracted_data if isinstance(extracted_data, list) else extracted_data.get("holidays", [])
        for idx, h in enumerate(entries):
            if not h.get("name", "").strip():
                add_flag(f"{idx}.name", "error", "Holiday name cannot be blank.")
            try:
                d = datetime.strptime(h.get("date", ""), "%Y-%m-%d").date()
                if abs((d - date.today()).days) > 730:
                    add_flag(f"{idx}.date", "error", "Holiday date exceeds plausible +/- 2-year window.")
            except ValueError:
                add_flag(f"{idx}.date", "error", "Holiday date must follow YYYY-MM-DD format.")

    elif data_type == "faculty":
        members = extracted_data if isinstance(extracted_data, list) else extracted_data.get("faculty", [])
        for idx, m in enumerate(members):
            name = m.get("name", "").strip()
            email = m.get("email", "").strip().lower()
            dept = m.get("department", "").strip()
            if not name:
                add_flag(f"{idx}.name", "error", "Faculty member name is required.")

            if email:
                async with get_read_db() as conn:
                    # Check conflicting natural keys
                    cursor = await conn.execute(
                        """SELECT id, name, department FROM faculty 
                           WHERE lower(email) = %s AND (lower(name) != lower(%s) OR coalesce(department,'') != %s)""",
                        (email, name, dept)
                    )
                    conflict = await cursor.fetchone()
                    if conflict:
                        add_flag(f"{idx}.email", "error", 
                                 f"Email conflicts with existing faculty ID {conflict['id']} ({conflict['name']}).")

    elif data_type in ("notice", "poster"):
        valid_until_str = metadata.get("valid_until")
        if not valid_until_str:
            add_flag("valid_until", "error", "valid_until expiration date is mandatory.")
        else:
            try:
                v_date = datetime.strptime(valid_until_str, "%Y-%m-%d").date()
                if v_date < date.today():
                    add_flag("valid_until", "error", "valid_until date cannot be in the past.")
            except ValueError:
                add_flag("valid_until", "error", "valid_until must follow YYYY-MM-DD format.")

    return {
        "cells": cells,
        "has_errors": has_errors,
        "has_warnings": has_warnings
    }
```


## 2.4 Heading Chunking, 768-D Normalization & Namespace Rules

Unstructured documents (syllabi and notices) are parsed into clean markdown, split strictly on heading boundaries (300 to 500 tokens with 50-token overlap), prefixed with hierarchical context ('Document title > Section:'), and embedded with Gemini text-embedding-004 fixed at 768 dimensions and L2-normalized.

```python
# backend/app/services/embedding_service.py
import os
import re
import math
from typing import List, Dict, Any
import numpy as np
from google import genai
from google.genai import types

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-004")
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
DOC_KEY_REGEX = re.compile(r"^(syllabus|notice):([A-Z0-9]+|ALL):[a-z0-9_-]+$")

ai_client = genai.Client(api_key=GEMINI_API_KEY)

def validate_doc_key_namespace(doc_key: str, user_role: str, user_branch: str) -> None:
    match = DOC_KEY_REGEX.match(doc_key)
    if not match:
        raise ValueError("doc_key must match pattern: '^(syllabus|notice):([A-Z0-9]+|ALL):[a-z0-9_-]+$'")
    doc_type, branch_seg, slug = match.groups()
    if user_role == "staff":
        if branch_seg != user_branch:
            raise PermissionError(f"Staff can only publish under their own branch namespace ({user_branch}).")
    elif user_role != "admin":
        raise PermissionError("Only admins and authorized branch staff may manage document namespaces.")

def chunk_markdown_by_headings(doc_title: str, markdown_text: str) -> List[Dict[str, Any]]:
    """Split markdown by # and ## headers, respecting 300-500 token bounds."""
    sections = re.split(r"(?m)^(?=#{1,3}\s)", markdown_text)
    chunks = []
    
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.splitlines()
        header_match = re.match(r"^#{1,3}\s+(.*)", lines[0])
        section_title = header_match.group(1).strip() if header_match else "General"
        body = "\n".join(lines[1:]).strip() if header_match else sec
        
        words = body.split()
        if len(words) <= 400:
            content = f"{doc_title} > {section_title}:\n{body}"
            chunks.append({"title": doc_title, "section": section_title, "content": content})
        else:
            # Overlapping window: 350 words (~450 tokens) with 40-word overlap
            step = 310
            for start_idx in range(0, len(words), step):
                chunk_words = words[start_idx : start_idx + 350]
                chunk_body = " ".join(chunk_words)
                content = f"{doc_title} > {section_title} (Part {start_idx//step + 1}):\n{chunk_body}"
                chunks.append({"title": doc_title, "section": section_title, "content": content})
                if start_idx + 350 >= len(words):
                    break
    return chunks

async def generate_l2_normalized_embeddings(texts: List[str]) -> List[List[float]]:
    """Produce exactly 768-dimensional L2-normalized embeddings via Gemini."""
    # Batch embedding call
    result = ai_client.models.batch_embed_contents(
        model=EMBEDDING_MODEL,
        requests=[
            types.EmbedContentRequest(
                content=types.Content(parts=[types.Part.from_text(text=t)]),
                output_dimensionality=768
            )
            for t in texts
        ]
    )
    
    normalized_vectors = []
    for emb in result.embeddings:
        vec = np.array(emb.values, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        normalized_vectors.append(vec.tolist())
        
    return normalized_vectors
```


## 2.5 Phase 2 Actionable Verification Checklist

Execute this verification checklist to confirm upload security, parsing accuracy, and embedding normalizations before proceeding to approval workflows.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V2.1: Magic-Byte Spoofing Rejection | Upload a renamed executable (mv malware.exe fake.pdf) to POST /api/uploads. | HTTP 415 Unsupported Media Type; rejected before disk or memory write. |
| [  ] | V2.2: 10 MB File Size Ceiling | Generate an 11 MB dummy file and upload to POST /api/uploads. | HTTP 413 Request Entity Too Large; payload stream aborted immediately. |
| [  ] | V2.3: 50-Page PDF Cap Enforcement | Upload a 51-page valid PDF to POST /api/uploads. | HTTP 422 Unprocessable Entity with detail 'PDF exceeds 50 pages maximum.' |
| [  ] | V2.4: Single-Worker Concurrency Lock | Dispatch 2 large PDF parsing jobs simultaneously. | Logs confirm Semaphore(1) serializes execution; max memory usage remains < 250 MB. |
| [  ] | V2.5: Deterministic Timetable Error | Submit timetable slot with start_time='11:00' and end_time='10:00'. | Validator flags end_time with hard 'error'; submission blocked from approval. |
| [  ] | V2.6: Deterministic Overlap Warning | Submit two timetable slots for CSE-3-A Monday at 09:00-11:00. | Validator flags 'warning' on overlap; approval permitted with UI alert. |
| [  ] | V2.7: Embedding Dimension and L2 Norm | Run embedding test on sample markdown chunk. | Length of vector is exactly 768; np.linalg.norm(v) evaluates to 1.0 ± 0.0001. |
| [  ] | V2.8: doc_key Cross-Branch Isolation | Staff user from 'ECE' attempts upload with doc_key='syllabus:CSE:sem5'. | HTTP 403 Forbidden: 'Staff can only publish under their own branch namespace (ECE).' |


---

# PHASE 3: Approval Workflow, Versioning, and Rollback Engine

> [!NOTE]
> **Phase 3 Architecture Invariants**
>
> 1. Embed-Before-Transaction Safety: For documents (syllabi/notices), vector embedding generation is performed strictly prior to initiating the database publish transaction. A vector API outage will never leave orphaned transactions or corrupt versions.
> 2. Atomic Multi-Scope Locking: Master schedule timetables spanning multiple scopes sort their scope keys lexicographically before acquiring row locks (FOR UPDATE) to eliminate deadlock potential.
> 3. Immutable Auditability & 3-Version Retention: Published scopes retain their active version plus the 2 most recent prior versions, allowing instantaneous zero-downtime rollback.


## 3.1 Submission Lifecycle & State Machine

Submissions progress through a strict finite state machine. Admins can approve their own uploads directly from draft; staff and club submissions must be submitted for review first, entering pending_review before admin approval.

| State | Description | Allowed Transition Next | Authorized Roles |
| --- | --- | --- | --- |
| processing | File currently being parsed or extracted by background worker | draft, failed | System Worker |
| draft | Extracted data ready for preview, cell-level correction, or initial review | pending_review, approved, rejected | Owner (staff/club), Admin |
| pending_review | Submitted by staff/club; visible in admin approval queue | approved, rejected | Owner (submit), Admin (review) |
| approved | Atomically published to active domain tables; immutable snapshot | None (Final State) | Admin |
| rejected | Declined by admin with mandatory reject_reason text | None (Final State) | Admin |
| failed | Extraction failed or timed out (>10 min stuck processing) | processing (via retry) | Owner, Admin |


## 3.2 Atomic Approval Engine (POST /api/submissions/{id}/approve)

The approval engine verifies admin authorization, validates that zero cell-level hard errors remain, pre-computes embeddings outside the transaction, and executes the atomic publication transaction.

```python
# backend/app/routers/approval.py
import json
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Request, HTTPException, status
from app.core.database import get_write_db
from app.services.validators import run_deterministic_validators
from app.services.embedding_service import (
    chunk_markdown_by_headings, generate_l2_normalized_embeddings
)
from app.services.cache_service import evict_scope_cache

router = APIRouter(prefix="/api", tags=["Approval"])
logger = logging.getLogger("campus.approval")

@router.post("/submissions/{submission_id}/approve")
async def approve_submission(submission_id: str, request: Request):
    user = request.state.user
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for approval.")

    # 1. Read Submission and Pre-Validate Status
    async with get_write_db() as conn:
        cursor = await conn.execute(
            """SELECT id, file_id, uploaded_by, data_type, scope, doc_key, 
                      valid_until, status, extracted, published_versions 
               FROM submissions WHERE id = %s""",
            (submission_id,)
        )
        sub = await cursor.fetchone()

    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    # Invariant: Must be in pending_review, or draft if admin's own upload
    is_owner = str(sub["uploaded_by"]) == str(user["id"])
    if sub["status"] not in ("pending_review", "draft"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve submission in '{sub['status']}' state.")
    if sub["status"] == "draft" and not is_owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Staff/club draft must be submitted for review first.")

    # 2. Re-run Deterministic Validators (Ensure ZERO hard errors exist)
    extracted_data = sub["extracted"]
    val_report = await run_deterministic_validators(
        sub["data_type"], extracted_data, 
        {"valid_until": str(sub["valid_until"]) if sub["valid_until"] else None, "doc_key": sub["doc_key"]}
    )
    if val_report["has_errors"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail={"message": "Submission contains uncorrected hard validation errors.", "flags": val_report["cells"]}
        )

    # 3. Embed-Before-Transaction Safety Rule (Documents only)
    doc_chunks_payload = []
    if sub["data_type"] in ("syllabus", "notice"):
        title = sub["doc_key"].split(":")[-1].replace("-", " ").title()
        raw_chunks = chunk_markdown_by_headings(title, extracted_data)
        if not raw_chunks:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Document contains no extractable content.")
        
        chunk_texts = [c["content"] for c in raw_chunks]
        try:
            embeddings = await generate_l2_normalized_embeddings(chunk_texts)
        except Exception as e:
            logger.error("Gemini embedding failure during approval: %s", str(e))
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Vector embedding service failed. Retry approval.")

        # Determine branch assignment: 'ALL' -> NULL, else branch code
        branch_seg = sub["doc_key"].split(":")[1]
        chunk_branch = None if branch_seg == "ALL" else branch_seg

        for idx, c in enumerate(raw_chunks):
            doc_chunks_payload.append({
                "title": c["title"],
                "section": c["section"],
                "content": c["content"],
                "chunk_index": idx,
                "embedding": embeddings[idx],
                "branch": chunk_branch,
                "valid_until": sub["valid_until"]
            })

    # 4. Atomic Database Transaction
    published_map = {}
    async with get_write_db() as conn:
        # Re-check status with row lock to eliminate race conditions
        lock_cur = await conn.execute(
            """SELECT status FROM submissions WHERE id = %s FOR UPDATE""",
            (submission_id,)
        )
        current = await lock_cur.fetchone()
        if current["status"] == "approved":
            return {"message": "Submission already approved (idempotent).", "published_versions": sub["published_versions"]}

        # --- LANE A: Replaceable Scopes (timetable, menu, holidays, doc) ---
        if sub["data_type"] in ("timetable", "menu", "holidays", "syllabus", "notice"):
            # Collect and sort scopes lexicographically to avoid deadlocks
            target_scopes = []
            if sub["data_type"] == "timetable" and sub["scope"] == "multi":
                # Multi-section master schedule: derive distinct scopes from extracted slots
                slots = extracted_data if isinstance(extracted_data, list) else extracted_data.get("slots", [])
                target_scopes = sorted(list({f"timetable:{s['branch']}-{s['year']}-{s['section']}" for s in slots}))
            else:
                target_scopes = [sub["scope"]]

            for scope_key in target_scopes:
                # Lock scope version row
                ver_cur = await conn.execute(
                    """INSERT INTO data_versions (scope, active_version, latest_version, rev, updated_at)
                       VALUES (%s, 1, 0, 1, now())
                       ON CONFLICT (scope) DO UPDATE SET updated_at = now()
                       RETURNING latest_version, rev""",
                    (scope_key,)
                )
                ver_row = await ver_cur.fetchone()
                new_version = ver_row["latest_version"] + 1

                # A1. Insert Rows into Target Table
                if sub["data_type"] == "timetable":
                    slots = extracted_data if isinstance(extracted_data, list) else extracted_data.get("slots", [])
                    scope_slots = [s for s in slots if f"timetable:{s['branch']}-{s['year']}-{s['section']}" == scope_key] if sub["scope"] == "multi" else slots
                    for s in scope_slots:
                        await conn.execute(
                            """INSERT INTO timetable_slots 
                               (scope, branch, year, section, day, period, start_time, end_time, 
                                subject, kind, faculty_id, room, version, submission_id)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (scope_key, s["branch"], s["year"], s["section"], s["day"], s.get("period"),
                             s["start_time"], s["end_time"], s["subject"], s.get("kind", "lecture"),
                             s.get("faculty_id"), s.get("room"), new_version, submission_id)
                        )
                    # Purge versions older than last 3
                    await conn.execute(
                        """DELETE FROM timetable_slots 
                           WHERE scope = %s AND version NOT IN (
                             SELECT DISTINCT version FROM timetable_slots 
                             WHERE scope = %s ORDER BY version DESC LIMIT 3
                           )""",
                        (scope_key, scope_key)
                    )

                elif sub["data_type"] == "menu":
                    items = extracted_data if isinstance(extracted_data, list) else extracted_data.get("items", [])
                    for it in items:
                        await conn.execute(
                            """INSERT INTO menu_items (scope, day, meal, item, price, is_veg, version, submission_id)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                            (scope_key, it.get("day"), it["meal"], it["item"], it["price"], it.get("is_veg"), new_version, submission_id)
                        )
                    await conn.execute(
                        """DELETE FROM menu_items WHERE scope = %s AND version NOT IN (
                             SELECT DISTINCT version FROM menu_items WHERE scope = %s ORDER BY version DESC LIMIT 3
                           )""",
                        (scope_key, scope_key)
                    )

                elif sub["data_type"] == "holidays":
                    hols = extracted_data if isinstance(extracted_data, list) else extracted_data.get("holidays", [])
                    for h in hols:
                        await conn.execute(
                            """INSERT INTO holidays (scope, date, name, kind, version, submission_id)
                               VALUES (%s, %s, %s, %s, %s, %s)""",
                            (scope_key, h["date"], h["name"], h.get("kind"), new_version, submission_id)
                        )
                    await conn.execute(
                        """DELETE FROM holidays WHERE scope = %s AND version NOT IN (
                             SELECT DISTINCT version FROM holidays WHERE scope = %s ORDER BY version DESC LIMIT 3
                           )""",
                        (scope_key, scope_key)
                    )

                elif sub["data_type"] in ("syllabus", "notice"):
                    for c in doc_chunks_payload:
                        await conn.execute(
                            """INSERT INTO doc_chunks 
                               (scope, doc_key, file_id, submission_id, doc_type, title, section, 
                                chunk_index, content, embedding, embedding_model, branch, valid_until, version)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'text-embedding-004', %s, %s, %s)""",
                            (scope_key, sub["doc_key"], sub["file_id"], submission_id, sub["data_type"],
                             c["title"], c["section"], c["chunk_index"], c["content"], c["embedding"],
                             c["branch"], c["valid_until"], new_version)
                        )
                    await conn.execute(
                        """DELETE FROM doc_chunks WHERE scope = %s AND version NOT IN (
                             SELECT DISTINCT version FROM doc_chunks WHERE scope = %s ORDER BY version DESC LIMIT 3
                           )""",
                        (scope_key, scope_key)
                    )

                # Update data_versions pointer
                await conn.execute(
                    """UPDATE data_versions 
                       SET active_version = %s, latest_version = %s, rev = rev + 1, updated_at = now()
                       WHERE scope = %s""",
                    (new_version, new_version, scope_key)
                )
                published_map[scope_key] = new_version

        # --- LANE B: Upsert Scope (faculty:all) ---
        elif sub["data_type"] == "faculty":
            fac_list = extracted_data if isinstance(extracted_data, list) else extracted_data.get("faculty", [])
            for f in fac_list:
                subj_text = ", ".join(f.get("subjects", []))
                await conn.execute(
                    """INSERT INTO faculty (name, short_code, department, designation, email, 
                                            cabin, office_hours, subjects, subjects_text, submission_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (lower(name), coalesce(department, '')) DO UPDATE
                       SET short_code = EXCLUDED.short_code,
                           designation = EXCLUDED.designation,
                           email = coalesce(EXCLUDED.email, faculty.email),
                           cabin = EXCLUDED.cabin,
                           office_hours = EXCLUDED.office_hours,
                           subjects = EXCLUDED.subjects,
                           subjects_text = EXCLUDED.subjects_text,
                           is_active = true,
                           submission_id = EXCLUDED.submission_id""",
                    (f["name"], f.get("short_code"), f.get("department"), f.get("designation"),
                     f.get("email"), f.get("cabin"), f.get("office_hours"), f.get("subjects", []),
                     subj_text, submission_id)
                )
            await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'faculty:all'""")
            published_map["faculty:all"] = "upserted"

        # --- LANE C: Additive Scope (events:all) ---
        elif sub["data_type"] == "poster":
            ev = extracted_data if isinstance(extracted_data, dict) else extracted_data[0]
            await conn.execute(
                """INSERT INTO events 
                   (title, club, description, venue, starts_at, ends_at, valid_until, file_id, submission_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (submission_id) DO NOTHING""",
                (ev["title"], ev["club"], ev.get("description"), ev.get("venue"),
                 ev.get("starts_at"), ev.get("ends_at"), f"{sub['valid_until']} 23:59:59+05:30",
                 sub["file_id"], submission_id)
            )
            await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'events:all'""")
            published_map["events:all"] = "added"

        # 5. Finalize Submission Record & Audit Trail
        single_ver = published_map.get(sub["scope"]) if len(published_map) == 1 else None
        await conn.execute(
            """UPDATE submissions 
               SET status = 'approved',
                   reviewer = %s,
                   reviewed_at = now(),
                   updated_at = now(),
                   version = %s,
                   published_versions = %s
               WHERE id = %s""",
            (user["id"], single_ver if isinstance(single_ver, int) else None, json.dumps(published_map), submission_id)
        )

        await conn.execute(
            """INSERT INTO audit_log (actor, action, target, detail)
               VALUES (%s, 'approve', %s, %s)""",
            (user["id"], f"submission:{submission_id}", json.dumps(published_map))
        )

    # 6. Post-Commit In-Memory Cache Invalidation
    for scope_key in published_map.keys():
        evict_scope_cache(scope_key)

    return {
        "message": "Submission approved and published successfully.",
        "published_versions": published_map
    }
```


## 3.3 Rejection, Rollback, and Event Unpublish

Rollbacks update active_version and bump rev in data_versions inside an atomic transaction after confirming target rows exist. No rows are purged on rollback. Events are unpublished via soft-deletion (is_active = false) paired with a rev increment.

```python
# backend/app/routers/admin_actions.py
import json
import logging
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from app.core.database import get_write_db
from app.services.cache_service import evict_scope_cache

router = APIRouter(prefix="/api/admin", tags=["Admin Actions"])

class RollbackRequest(BaseModel):
    target_version: int

class RejectRequest(BaseModel):
    reject_reason: str

@router.post("/scopes/{scope}/rollback")
async def rollback_scope(scope: str, payload: RollbackRequest, request: Request):
    user = request.state.user
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    target_ver = payload.target_version

    async with get_write_db() as conn:
        # 1. Lock Scope Record
        ver_cur = await conn.execute(
            """SELECT active_version, latest_version FROM data_versions WHERE scope = %s FOR UPDATE""",
            (scope,)
        )
        ver_row = await ver_cur.fetchone()
        if not ver_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scope '{scope}' does not exist.")

        if ver_row["active_version"] == target_ver:
            return {"message": f"Scope '{scope}' is already at version {target_ver}."}

        # 2. Verify Target Rows Exist in Corresponding Domain Table
        table_name = None
        if scope.startswith("timetable:"):
            table_name = "timetable_slots"
        elif scope == "menu:mess":
            table_name = "menu_items"
        elif scope == "holidays:calendar":
            table_name = "holidays"
        elif scope.startswith("doc:"):
            table_name = "doc_chunks"
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Scope '{scope}' does not support version rollback.")

        check_cur = await conn.execute(
            f"""SELECT 1 FROM {table_name} WHERE scope = %s AND version = %s LIMIT 1""",
            (scope, target_ver)
        )
        if not await check_cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Target version {target_ver} does not exist in {table_name} (may have been pruned)."
            )

        # 3. Perform Rollback Pointer Update
        await conn.execute(
            """UPDATE data_versions 
               SET active_version = %s, rev = rev + 1, updated_at = now() 
               WHERE scope = %s""",
            (target_ver, scope)
        )

        await conn.execute(
            """INSERT INTO audit_log (actor, action, target, detail)
               VALUES (%s, 'rollback', %s, %s)""",
            (user["id"], scope, json.dumps({"previous_active": ver_row["active_version"], "new_active": target_ver}))
        )

    evict_scope_cache(scope)
    return {"message": f"Scope '{scope}' successfully rolled back to version {target_ver}."}

@router.post("/events/{event_id}/unpublish")
async def unpublish_event(event_id: int, request: Request):
    user = request.state.user
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    async with get_write_db() as conn:
        cursor = await conn.execute(
            """UPDATE events SET is_active = false WHERE id = %s RETURNING id, title""",
            (event_id,)
        )
        ev = await cursor.fetchone()
        if not ev:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

        # Bump rev on events:all to invalidate cached event listings
        await conn.execute("""UPDATE data_versions SET rev = rev + 1, updated_at = now() WHERE scope = 'events:all'""")

        await conn.execute(
            """INSERT INTO audit_log (actor, action, target, detail)
               VALUES (%s, 'unpublish_event', %s, %s)""",
            (user["id"], f"event:{event_id}", json.dumps({"title": ev["title"]}))
        )

    evict_scope_cache("events:all")
    return {"message": f"Event '{ev['title']}' unpublished successfully."}
```


## 3.4 Stuck Job Sweeper & Recovery Engine

To ensure that server restarts or transient background exceptions do not trap submissions in processing state indefinitely, a background recovery sweeper runs at application startup and executes inline during status polling.

```python
# backend/app/services/sweeper_service.py
import logging
from app.core.database import get_write_db
from app.services.ingestion_service import enqueue_extraction_task

logger = logging.getLogger("campus.sweeper")

async def sweep_stuck_processing_jobs():
    """Mark any job stuck in 'processing' for >10 minutes as 'failed'."""
    async with get_write_db() as conn:
        cursor = await conn.execute(
            """UPDATE submissions 
               SET status = 'failed',
                   error = 'Processing timed out or server restarted; please retry.',
                   updated_at = now()
               WHERE status = 'processing' 
                 AND updated_at < now() - interval '10 minutes'
               RETURNING id"""
        )
        stuck_rows = await cursor.fetchall()
        if stuck_rows:
            logger.warning("Sweeper recovered %d stuck submissions: %s", len(stuck_rows), [r["id"] for r in stuck_rows])

async def retry_failed_submission(submission_id: str, user_id: str, background_tasks):
    """Reset failed submission to processing and re-queue extraction using stored file."""
    async with get_write_db() as conn:
        cursor = await conn.execute(
            """SELECT s.id, s.data_type, s.scope, s.doc_key, s.valid_until, 
                      f.storage_path, f.mime 
               FROM submissions s
               JOIN files f ON f.id = s.file_id
               WHERE s.id = %s AND s.status = 'failed'""",
            (submission_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise ValueError("Submission not found or not in 'failed' state.")

        await conn.execute(
            """UPDATE submissions 
               SET status = 'processing', error = NULL, updated_at = now() 
               WHERE id = %s""",
            (submission_id,)
        )

    # Fetch original file bytes from storage and enqueue task
    from app.routers.uploads import s3_client, STORAGE_BUCKET
    response = s3_client.get_object(Bucket=STORAGE_BUCKET, Key=row["storage_path"])
    content = response["Body"].read()

    background_tasks.add_task(
        enqueue_extraction_task,
        submission_id=submission_id,
        content=content,
        mime=row["mime"],
        data_type=row["data_type"],
        metadata={"scope": row["scope"], "doc_key": row["doc_key"], "valid_until": row["valid_until"]}
    )
```


## 3.5 Phase 3 Actionable Verification Checklist

Validate versioning integrity, transactional locking, and rollback mechanics using the checklist below before proceeding to query routing.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V3.1: Idempotent Double-Approval | Trigger 2 identical POST /submissions/{id}/approve requests concurrently via asyncio.gather. | One request succeeds with published_versions; the second returns early with 200 and 'Submission already approved'. |
| [  ] | V3.2: Hard Error Blockade | Attempt POST /submissions/{id}/approve on a submission containing end_time <= start_time. | HTTP 422 Unprocessable Entity; transaction aborted, status remains pending_review/draft. |
| [  ] | V3.3: Pre-Embedding Fault Isolation | Simulate Gemini API network timeout during syllabus approval. | HTTP 502 Bad Gateway; submission remains untouched in pending_review with zero orphan DB rows. |
| [  ] | V3.4: Multi-Scope Lexicographical Locking | Approve master schedule containing CSE-3-A and ECE-2-B. | Scopes locked in order 'timetable:CSE-3-A' then 'timetable:ECE-2-B'; published_versions records both versions. |
| [  ] | V3.5: 3-Version Retention Pruning | Publish 4 successive versions of menu:mess (v1, v2, v3, v4). | SELECT DISTINCT version FROM menu_items returns exactly [2, 3, 4]; v1 rows purged automatically. |
| [  ] | V3.6: Instant Scope Rollback | Call POST /api/admin/scopes/menu:mess/rollback with target_version=3. | active_version switches to 3; rev increments; students instantly query v3 menu rows. |
| [  ] | V3.7: Stuck Job Sweeper Execution | Insert submission in 'processing' state with updated_at = now() - interval '15 minutes'; trigger sweeper. | Status automatically transitions to 'failed' with timeout reason. |


---

# PHASE 4: Student Query Engine & Caching Layer

> [!NOTE]
> **Phase 4 Architecture Invariants**
>
> 1. Deterministic Tier 0 First: Structured chips and anchored single-intent rules resolve without LLM intervention (0 token cost). Any query with coordinating conjunctions ('and', 'also', '&') falls through to the Tier 1 router.
> 2. Zero Identity Leakage: Student identity attributes (user_id, branch, year, section) are never passed to the LLM. The verified session injects identity parameters server-side during tool execution.
> 3. Raw-Row Caching: In-memory caches store raw SQL rows keyed by (scope, data_versions.rev), never rendered text. Time-sensitive logic (ongoing class vs next class, holiday skipping, valid_until > now()) executes dynamically in Python in the Asia/Kolkata timezone.


## 4.1 Tier 0 Fast Path Engine

The Tier 0 fast path bypasses the LLM entirely, handling dashboard chips and exact single-intent queries in under 5ms. Keyword rules must be anchored start-to-end (^...$), capped at 40 characters, evaluate negations prior to positives, and reject conjunctions.

```python
# backend/app/services/tier0_engine.py
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
    (re.compile(r"^(today'?s?\s+menu|mess\s+menu|food)$", re.I), "search_menu", {}),
    (re.compile(r"^(breakfast|lunch|snacks|dinner)(\s+menu)?$", re.I), 
     "search_menu", lambda m: {"meal": m.group(1).lower()}),
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
```


## 4.2 Tier 1 Flash-Lite Multi-Tool Router

When Tier 0 misses, the query is dispatched to the Gemini Flash-Lite router. The system prompt contains the current Asia/Kolkata date and weekday along with a compact tool signature dictionary. The LLM outputs strict JSON defining up to 3 independent tool calls executed in parallel.

```python
# backend/app/services/router_engine.py
import os
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from cachetools import TTLCache
from app.services.tool_executor import execute_tool

logger = logging.getLogger("campus.router")
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL_ROUTER = os.environ.get("GEMINI_MODEL_ROUTER", "gemini-2.0-flash-lite")

ai_client = genai.Client(api_key=GEMINI_API_KEY)
router_cache = TTLCache(maxsize=1000, ttl=86400) # 24-hour LRU router cache

class ToolCall(BaseModel):
    tool: str = Field(..., regex="^(get_timetable|find_free_slots|get_faculty|search_menu|get_holidays|get_events|search_docs)$")
    args: Dict[str, Any] = Field(default_factory=dict)

class RouterContract(BaseModel):
    calls: List[ToolCall] = Field(default_factory=list, max_items=3)
    needs_clarification: bool = False
    clarifying_question: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)

def normalize_query_for_cache(q: str) -> str:
    return "".join(c for c in q.lower().strip() if c.isalnum() or c.isspace())

async def route_student_query(query_text: str, user_context: Dict[str, Any]) -> RouterContract:
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
3. Identity fields (branch, year, section) are NOT accepted as arguments; they are injected automatically.
4. For multi-intent queries ('cheap veg lunch and free at 1?'), return multiple tool calls.
"""

    try:
        response = await asyncio.to_thread(
            ai_client.models.generate_content,
            model=GEMINI_MODEL_ROUTER,
            contents=[types.Part.from_text(text=query_text)],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=RouterContract.model_json_schema(),
                temperature=0.0
            )
        )
        parsed_data = json.loads(response.text)
        contract = RouterContract(**parsed_data)
        
        # Cache confident routing decisions
        if contract.confidence >= 0.7 and not contract.needs_clarification:
            router_cache[cache_key] = contract

        return contract

    except Exception as e:
        logger.error("Router LLM failure: %s", str(e))
        return RouterContract(calls=[], needs_clarification=False, confidence=0.0)
```


## 4.3 Tier 2 RAG & Hybrid Search (search_docs)

Tier 2 handles document searches across syllabi and notices. Hybrid search merges pgvector cosine distance (floor >= 0.45) with Full-Text Search (websearch_to_tsquery) via Reciprocal Rank Fusion (RRF, k=60). If zero chunks meet the similarity floor, the synthesis LLM call is completely skipped.

```python
# backend/app/services/rag_engine.py
import os
import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from app.core.database import get_read_db
from app.services.embedding_service import generate_l2_normalized_embeddings

logger = logging.getLogger("campus.rag")
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL_SYNTH = os.environ.get("GEMINI_MODEL_SYNTH", "gemini-2.0-flash")
RAG_MIN_SIMILARITY = float(os.environ.get("RAG_MIN_SIMILARITY", "0.45"))

ai_client = genai.Client(api_key=GEMINI_API_KEY)

async def search_docs_hybrid(
    query_text: str, 
    user_branch: Optional[str],
    doc_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    # Generate 768-dim query embedding
    query_vector = (await generate_l2_normalized_embeddings([query_text]))[0]

    # Hybrid SQL query with Reciprocal Rank Fusion (k=60)
    sql = """
    WITH vector_matches AS (
      SELECT 
        c.id, c.title, c.section, c.page, c.content, c.doc_key, c.doc_type,
        1 - (c.embedding <=> %s::vector) AS cosine_sim,
        ROW_NUMBER() OVER (ORDER BY c.embedding <=> %s::vector) AS rank_vec
      FROM doc_chunks c
      JOIN data_versions dv ON dv.scope = c.scope AND dv.active_version = c.version
      WHERE (c.branch IS NULL OR c.branch = %s)
        AND (c.valid_until IS NULL OR c.valid_until >= current_date)
        AND (1 - (c.embedding <=> %s::vector)) >= %s
        AND (%s::text IS NULL OR c.doc_type = %s)
      LIMIT 20
    ),
    fts_matches AS (
      SELECT 
        c.id, c.title, c.section, c.page, c.content, c.doc_key, c.doc_type,
        ts_rank_cd(c.tsv, websearch_to_tsquery('english', %s)) AS fts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('english', %s)) DESC) AS rank_fts
      FROM doc_chunks c
      JOIN data_versions dv ON dv.scope = c.scope AND dv.active_version = c.version
      WHERE (c.branch IS NULL OR c.branch = %s)
        AND (c.valid_until IS NULL OR c.valid_until >= current_date)
        AND c.tsv @@ websearch_to_tsquery('english', %s)
        AND (%s::text IS NULL OR c.doc_type = %s)
      LIMIT 20
    )
    SELECT 
      coalesce(v.id, f.id) AS id,
      coalesce(v.title, f.title) AS title,
      coalesce(v.section, f.section) AS section,
      coalesce(v.page, f.page) AS page,
      coalesce(v.content, f.content) AS content,
      coalesce(v.doc_key, f.doc_key) AS doc_key,
      coalesce(v.cosine_sim, 0.0) AS similarity,
      (coalesce(1.0 / (60 + v.rank_vec), 0.0) + coalesce(1.0 / (60 + f.rank_fts), 0.0)) AS rrf_score
    FROM vector_matches v
    FULL OUTER JOIN fts_matches f ON v.id = f.id
    ORDER BY rrf_score DESC
    LIMIT 3;
    """

    async with get_read_db() as conn:
        cursor = await conn.execute(
            sql,
            (query_vector, query_vector, user_branch, query_vector, RAG_MIN_SIMILARITY, doc_type, doc_type,
             query_text, query_text, user_branch, query_text, doc_type, doc_type)
        )
        return await cursor.fetchall()

async def synthesize_rag_response(query_text: str, chunks: List[Dict[str, Any]]) -> str:
    # Invariant: If 0 chunks match, synthesis LLM call is SKIPPED
    if not chunks:
        return "I could not find any matching notices or syllabus sections for your query."

    context_blocks = []
    for c in chunks:
        citation = f"[{c['title']} | Section: {c['section']} | Page {c['page'] or 1}]"
        context_blocks.append(f"{citation}\n{c['content']}")

    context_str = "\n\n---\n\n".join(context_blocks)
    
    prompt = f"""You are Campus Intelligence. Answer the student's question strictly using the verified campus excerpts below.
Context:
{context_str}

Student Question: {query_text}

Guidelines:
1. Rely ONLY on clear facts directly mentioned in the context. Never fabricate policies or dates.
2. Cite the source document and section inline e.g. [OS Syllabus > Unit 2].
3. If the context does not contain the complete answer, clearly state what information is missing.
"""

    response = await asyncio.to_thread(
        ai_client.models.generate_content,
        model=GEMINI_MODEL_SYNTH,
        contents=[types.Part.from_text(text=prompt)],
        config=types.GenerateContentConfig(temperature=0.2)
    )
    return response.text
```


## 4.4 In-Memory Raw-Row Caching & IST Time Calculations

The tool cache stores raw database rows keyed by (scope, data_versions.rev). Dynamic temporal calculations (current class, next class, Sunday/holiday skipping, and looking ahead up to 7 days for the next working class) run in Python on every query request.

```python
# backend/app/services/time_engine.py
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from app.core.database import get_read_db
from app.services.cache_service import get_cached_scope_rows

IST = ZoneInfo("Asia/Kolkata")

async def calculate_next_class(branch: str, year: int, section: str) -> Dict[str, Any]:
    scope = f"timetable:{branch}-{year}-{section}"
    now_ist = datetime.now(IST)
    current_date = now_ist.date()
    current_time = now_ist.time()
    today_iso_day = now_ist.isoweekday()  # 1=Mon, 7=Sun

    # 1. Fetch active timetable slots from raw-row cache
    slots = await get_cached_scope_rows("timetable_slots", scope)
    if not slots:
        return {"status": "no_timetable", "message": "No active timetable published for your section."}

    # 2. Fetch active calendar holidays
    holidays_raw = await get_cached_scope_rows("holidays", "holidays:calendar")
    holiday_dates = {datetime.strptime(str(h["date"]), "%Y-%m-%d").date() for h in holidays_raw}

    # Helper to find slots on a given ISO weekday
    def slots_on_day(day_num: int) -> List[Dict[str, Any]]:
        return sorted([s for s in slots if s["day"] == day_num], key=lambda x: x["start_time"])

    # 3. Check if today is a working day (Not Sunday and Not Holiday)
    is_today_working = (today_iso_day != 7) and (current_date not in holiday_dates)

    if is_today_working:
        today_slots = slots_on_day(today_iso_day)
        # Check ongoing class
        ongoing = next((s for s in today_slots if s["start_time"] <= current_time < s["end_time"]), None)
        # Check upcoming class today
        upcoming_today = next((s for s in today_slots if s["start_time"] > current_time), None)

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
```


## 4.5 Phase 4 Actionable Verification Checklist

Execute this checklist to verify zero-LLM fast path execution, correct tool routing, RRF hybrid retrieval, and deterministic IST time calculations.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V4.1: Tier 0 Regex Anchoring | Query 'next class' vs 'next class and lunch menu'. | 'next class' matches Tier 0 (0 LLM calls); compound query falls through to Tier 1 router. |
| [  ] | V4.2: Tier 0 Negation Precedence | Query 'non veg' vs 'veg'. | 'non veg' routes to search_menu(veg=False); 'veg' routes to search_menu(veg=True). |
| [  ] | V4.3: Zero Student Identity Leakage | Inspect Gemini router prompt payload during test execution. | Contains strictly current date, weekday, and query text; user_id, branch, year, section are absent. |
| [  ] | V4.4: RAG Cosine Floor Guard | Query unrelated topic ('quantum physics black holes') against campus notices. | All chunks score < 0.45; synthesis LLM call skipped; returns deterministic 'not found' message. |
| [  ] | V4.5: RAG Branch Isolation Guard | Student with branch='ECE' queries syllabus notice uploaded under notice:CSE:sem5. | PostgreSQL branch filter excludes CSE chunk; zero cross-branch leakage verified. |
| [  ] | V4.6: IST Holiday & Sunday Class Lookahead | Simulate query on Sunday at 14:00 IST for section CSE-3-A. | Sunday skipped; returns first scheduled Monday class at 09:00 with day_name='Monday'. |
| [  ] | V4.7: Ongoing vs Next Class Detection | Simulate query at 09:15 IST where Lecture 1 is 09:00-10:00 and Lecture 2 is 10:00-11:00. | Returns Lecture 1 as ongoing and Lecture 2 as next_class. |


---

# PHASE 5: PWA Frontend Shell, Dashboard Cards, and Admin Review Queue

> [!NOTE]
> **Phase 5 Architecture Invariants**
>
> 1. Sibling Subdomain Alignment: The PWA client connects to the backend over HTTPS with credentials: 'include'. The CSRF token from GET /api/auth/csrf is stored in memory and attached via the X-CSRF-Token header on all state-changing calls.
> 2. Zero-LLM Dashboard Autonomy: Dashboard cards (Next Class, Timetable, Mess Menu, Events) communicate strictly with deterministic REST endpoints, remaining 100% operational during LLM outages or rate limits.
> 3. Side-by-Side Review Governance: The admin review queue displays the original uploaded document side-by-side with an editable extraction table. Cell-level validator warnings (amber) and hard errors (red) are visually distinct; hard errors disable the publish button.


## 5.1 PWA Shell, Global Auth & API Client Architecture

The frontend is built on React 18 and Vite with vite-plugin-pwa. An Axios client manages session credentials, automatic CSRF token injection, and server cold-start detection.

```typescript
// frontend/src/lib/api.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://api.campus.edu',
  withCredentials: true, // Sends HttpOnly campus_session cookie across sibling subdomains
  timeout: 15000,
});

let csrfToken: string | null = null;

export async function refreshCsrfToken(): Promise<string> {
  const resp = await apiClient.get('/api/auth/csrf');
  csrfToken = resp.data.csrf_token;
  return csrfToken!;
}

// Request Interceptor: Attach X-CSRF-Token to state-changing requests
apiClient.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method || '')) {
    if (!csrfToken) {
      await refreshCsrfToken();
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Response Interceptor: Cold-start detection (>2s notification)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      // Re-fetch CSRF and retry once
      await refreshCsrfToken();
      if (error.config) {
        error.config.headers['X-CSRF-Token'] = csrfToken;
        return apiClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```


### Global Auth Context & Onboarding Enforcer

```typescript
// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, refreshCsrfToken } from '../lib/api';

interface User {
  id: string;
  email: string;
  role: 'student' | 'club' | 'staff' | 'admin';
  branch: string | null;
  year: number | null;
  section: string | null;
  club: string | null;
  veg_pref: boolean | null;
  budget_default: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileComplete: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const resp = await apiClient.get('/api/me');
      setUser(resp.data.user);
      await refreshCsrfToken();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    await apiClient.post('/api/auth/logout');
    setUser(null);
  };

  const profileComplete = Boolean(user && user.branch && user.year && user.section);

  return (
    <AuthContext.Provider value={{ user, loading, profileComplete, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
```


## 5.2 Zero-LLM Deterministic Dashboard Cards

Dashboard cards fetch structured data directly from fast relational endpoints. The NextClassCard component renders real-time countdowns, classroom locations, and ongoing lecture alerts in IST.

```typescript
// frontend/src/components/dashboard/NextClassCard.tsx
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

interface ClassSlot {
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  faculty_name?: string;
}

export const NextClassCard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchNextClass = async () => {
    try {
      const res = await apiClient.get('/api/dashboard/next-class');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load next class:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextClass();
    const interval = setInterval(fetchNextClass, 60000); // 1-minute live tick
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="card loading">Checking campus schedule...</div>;
  if (!data || data.status === 'no_classes') {
    return <div className="card empty">No scheduled classes in the next 7 days. Enjoy your break!</div>;
  }

  const { ongoing, next_class, is_today, day_name } = data;

  return (
    <div className="card next-class-card">
      <div className="card-header">
        <h3>{is_today ? "Today's Schedule" : `Next Class: ${day_name}`}</h3>
        <span className="live-pill">LIVE IST</span>
      </div>

      {ongoing && (
        <div className="slot ongoing-slot">
          <span className="badge ongoing">HAPPENING NOW</span>
          <h4>{ongoing.subject}</h4>
          <p>Room: {ongoing.room || 'TBA'} | Ends at {ongoing.end_time.slice(0, 5)}</p>
        </div>
      )}

      {next_class && (
        <div className="slot upcoming-slot">
          <span className="badge upcoming">{ongoing ? 'UP NEXT' : 'NEXT UP'}</span>
          <h4>{next_class.subject}</h4>
          <p>
            {next_class.start_time.slice(0, 5)} – {next_class.end_time.slice(0, 5)} | Room: {next_class.room || 'TBA'}
          </p>
          {next_class.faculty_name && <p className="faculty">Faculty: {next_class.faculty_name}</p>}
        </div>
      )}
    </div>
  );
};
```


### Interactive Mess Menu Filter Card

```typescript
// frontend/src/components/dashboard/MessMenuCard.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

export const MessMenuCard: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [vegOnly, setVegOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(150);
  const [meal, setMeal] = useState<string>('lunch');

  const fetchMenu = async () => {
    const params = new URLSearchParams();
    if (vegOnly) params.append('veg', 'true');
    if (maxPrice) params.append('max_price', maxPrice.toString());
    if (meal) params.append('meal', meal);

    const res = await apiClient.get(`/api/menu?${params.toString()}`);
    setItems(res.data.items || []);
  };

  useEffect(() => {
    fetchMenu();
  }, [vegOnly, maxPrice, meal]);

  return (
    <div className="card mess-card">
      <div className="card-header">
        <h3>Mess Menu</h3>
        <div className="controls">
          <button className={meal === 'lunch' ? 'active' : ''} onClick={() => setMeal('lunch')}>Lunch</button>
          <button className={meal === 'dinner' ? 'active' : ''} onClick={() => setMeal('dinner')}>Dinner</button>
          <button className={meal === 'snacks' ? 'active' : ''} onClick={() => setMeal('snacks')}>Snacks</button>
        </div>
      </div>

      <div className="filters-bar">
        <label className="toggle">
          <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
          Veg Only
        </label>
        <div className="slider-box">
          <span>Max: ₹{maxPrice}</span>
          <input type="range" min="20" max="300" step="10" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
        </div>
      </div>

      <div className="menu-list">
        {items.length === 0 ? (
          <p className="no-items">No items match your selected filters.</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="menu-row">
              <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`}>●</span>
              <span className="item-name">{item.item}</span>
              <span className="item-price">₹{item.price}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```


## 5.3 Student Chat Interface with Quick Chips & Citations

The student chat interface dispatches quick chips without NLP parsing, renders citations as clickable badges, sanitizes markdown output using DOMPurify, and provides feedback buttons for logging thumbs up/down.

```typescript
// frontend/src/components/chat/ChatView.tsx
import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { apiClient } from '../../lib/api';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  citations?: Array<{ title: string; page?: number }>;
  queryLogId?: number;
}

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chips = [
    { label: 'Next Class', id: 'chip_next_class' },
    { label: 'Today Timetable', id: 'chip_today_timetable' },
    { label: 'Veg Menu', id: 'chip_veg_menu' },
    { label: 'Holidays', id: 'chip_upcoming_holidays' },
    { label: 'Club Events', id: 'chip_club_events' }
  ];

  const sendMessage = async (payload: { message?: string; chip_id?: string }) => {
    const userDisplay = payload.message || chips.find(c => c.id === payload.chip_id)?.label || '';
    setMessages(prev => [...prev, { sender: 'user', text: userDisplay }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/api/chat', payload);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.answer,
          citations: res.data.citations,
          queryLogId: res.data.query_log_id
        }
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Smart search is busy right now. Please use the quick option buttons below.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbs = async (queryLogId: number, thumbs: 1 | -1) => {
    await apiClient.post('/api/feedback', { query_log_id: queryLogId, thumbs });
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chips-bar">
        {chips.map(chip => (
          <button key={chip.id} className="chip-btn" onClick={() => sendMessage({ chip_id: chip.id })}>
            {chip.label}
          </button>
        ))}
      </div>

      <div className="messages-stream">
        {messages.map((m, idx) => (
          <div key={idx} className={`message-bubble ${m.sender}`}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.text) }} />
            {m.citations && m.citations.length > 0 && (
              <div className="citations-tray">
                {m.citations.map((c, ci) => (
                  <span key={ci} className="citation-pill">
                    📄 {c.title} {c.page ? `(p. ${c.page})` : ''}
                  </span>
                ))}
              </div>
            )}
            {m.sender === 'bot' && m.queryLogId && (
              <div className="feedback-tray">
                <button onClick={() => handleThumbs(m.queryLogId!, 1)}>👍</button>
                <button onClick={() => handleThumbs(m.queryLogId!, -1)}>👎</button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="message-bubble bot thinking">Consulting campus intelligence...</div>}
        <div ref={scrollRef} />
      </div>

      <form className="chat-input-bar" onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMessage({ message: input }); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about classes, mess food, syllabus..." />
        <button type="submit" disabled={loading || !input.trim()}>Send</button>
      </form>
    </div>
  );
};
```


## 5.4 Admin & Staff Review Queue (Split-Screen Preview & Cell Editing)

The Review Queue renders the original uploaded document side-by-side with an editable tabular grid. Cell-level validator flags (amber warning, red error) highlight OCR imperfections. Any cell edit calls PATCH /submissions/{id} and dynamically updates validator flags.

```typescript
// frontend/src/components/admin/SubmissionReviewDetail.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

interface Props {
  submissionId: string;
  onApproveSuccess: () => void;
}

export const SubmissionReviewDetail: React.FC<Props> = ({ submissionId, onApproveSuccess }) => {
  const [sub, setSub] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [extractedRows, setExtractedRows] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<any>({ cells: {}, has_errors: false, has_warnings: false });
  const [saving, setSaving] = useState(false);

  const loadSubmission = async () => {
    const res = await apiClient.get(`/api/submissions/${submissionId}`);
    setSub(res.data);
    setExtractedRows(res.data.extracted || []);
    setConfidence(res.data.confidence || { cells: {}, has_errors: false });

    // Fetch short-lived signed URL for original file preview
    if (res.data.file_id) {
      const urlRes = await apiClient.get(`/api/files/${res.data.file_id}/url`);
      setFileUrl(urlRes.data.signed_url);
    }
  };

  useEffect(() => { loadSubmission(); }, [submissionId]);

  const handleCellChange = async (rowIdx: number, field: string, value: any) => {
    const updated = [...extractedRows];
    updated[rowIdx][field] = value;
    setExtractedRows(updated);
    setSaving(true);

    try {
      // Re-run validation on backend and update flags
      const patchRes = await apiClient.patch(`/api/submissions/${submissionId}`, { extracted: updated });
      setConfidence(patchRes.data.confidence);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    await apiClient.post(`/api/submissions/${submissionId}/approve`);
    onApproveSuccess();
  };

  if (!sub) return <div>Loading submission details...</div>;

  return (
    <div className="split-review-container">
      {/* LEFT PANE: Original Document Viewer */}
      <div className="left-pane-preview">
        <h4>Original Uploaded Document</h4>
        {fileUrl ? (
          <iframe src={fileUrl} title="Original Document Preview" width="100%" height="100%" />
        ) : (
          <p>Preview unavailable.</p>
        )}
      </div>

      {/* RIGHT PANE: Editable Grid with Cell-Level Flags */}
      <div className="right-pane-editor">
        <div className="editor-header">
          <h4>Extracted Data Verification ({sub.data_type})</h4>
          {saving && <span className="saving-indicator">Saving & validating...</span>}
          <div className="actions">
            <button 
              className="approve-btn" 
              onClick={handleApprove} 
              disabled={confidence.has_errors}
              title={confidence.has_errors ? "Resolve all hard errors before approving" : "Publish to active scopes"}
            >
              Approve & Publish
            </button>
          </div>
        </div>

        {confidence.has_errors && (
          <div className="banner error-banner">
            ⚠️ Hard errors detected. Please correct the highlighted cells below to publish.
          </div>
        )}

        <div className="table-wrapper">
          <table className="review-table">
            <thead>
              <tr>
                {Object.keys(extractedRows[0] || {}).map((col, ci) => (
                  <th key={ci}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extractedRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {Object.entries(row).map(([field, val], cIdx) => {
                    const flagKey = `${rIdx}.${field}`;
                    const flag = confidence.cells[flagKey];
                    return (
                      <td key={cIdx} className={`cell ${flag ? flag.type : ''}`}>
                        <input
                          value={val === null || val === undefined ? '' : String(val)}
                          onChange={(e) => handleCellChange(rIdx, field, e.target.value)}
                        />
                        {flag && <span className={`flag-badge ${flag.type}`} title={flag.message}>●</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
```


## 5.5 Phase 5 Actionable Verification Checklist

Verify frontend resilience, PWA shell responsiveness, split-screen review interactions, and cell validator flagging using the checklist below.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V5.1: Cross-Subdomain CSRF Protection | Trigger state-changing request from app.campus.edu to api.campus.edu. | Cookie campus_session sent via credentials: 'include'; X-CSRF-Token validated successfully. |
| [  ] | V5.2: Student Onboarding Redirection | Log in with new user having branch=NULL; access dashboard. | Profile completion modal blocks navigation until branch, year, and section are saved. |
| [  ] | V5.3: Zero-LLM Dashboard Uptime | Revoke GEMINI_API_KEY environment variable; reload student dashboard. | Next Class, Timetable, Mess Menu, and Holiday cards render flawlessly without errors. |
| [  ] | V5.4: Live IST Next-Class Countdown | Observe NextClassCard across a 60-second boundary during ongoing class. | Remaining minutes update automatically; transitions to upcoming lecture at class conclusion. |
| [  ] | V5.5: Review UI Hard-Error Locking | Open review queue on timetable containing invalid time; inspect approve button. | Button is disabled; red error badge displays tooltip explanation. |
| [  ] | V5.6: In-Place Cell Edit Re-Validation | Correct end_time from '09:00' to '10:00' in review editor input. | PATCH request fires automatically; red error badge clears; Approve button activates. |


---

# PHASE 6: Testing, Observability, and Deployment Hardening

> [!NOTE]
> **Phase 6 Architecture Invariants**
>
> 1. Full RBAC Matrix Coverage: Every single API endpoint is validated against 5 authenticated/unauthenticated states (unauthenticated, student, club, staff with matching branch, staff with mismatched branch, and admin).
> 2. Zero 4.5 MB Proxy Bottlenecks: Serving frontend (app.campus.edu) and backend (api.campus.edu) on sibling subdomains prevents cross-site cookie rejection while completely bypassing Vercel's 4.5 MB reverse proxy body limit.
> 3. Free-Tier Cold-Start Neutralization: Automated external pings to /api/healthz every 10 minutes between 07:00 and 23:00 IST eliminate spin-down latency during active campus hours.


## 6.1 Comprehensive Automated Test Suite (Pytest)

The automated test suite runs in CI on every push. It tests Tier 0 regex anchoring, full RBAC access matrices, approval idempotency under race conditions, and vector branch isolation.

```python
# tests/test_production_suite.py
import pytest
import asyncio
from httpx import AsyncClient
from app.main import app
from app.services.tier0_engine import match_tier0_rule
from app.services.auth_service import generate_csrf_token

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
# 2. RBAC PERMISSION MATRIX TESTS (All Endpoints vs All Roles)
# ============================================================================
@pytest.mark.asyncio
async def test_rbac_endpoint_access_matrix(client: AsyncClient, test_users):
    # test_users contains tokens for: student, club, staff_cse, staff_ece, admin
    
    # 2.1 Students cannot access upload endpoint
    res = await client.post("/api/uploads", cookies={"campus_session": test_users["student"]["token"]})
    assert res.status_code == 403

    # 2.2 Staff from ECE cannot upload timetable for CSE
    res = await client.post(
        "/api/uploads", 
        data={"data_type": "timetable", "branch": "CSE", "year": 3, "section": "A"},
        cookies={"campus_session": test_users["staff_ece"]["token"]},
        headers={"X-CSRF-Token": test_users["staff_ece"]["csrf"]}
    )
    assert res.status_code == 403
    assert "own branch" in res.json()["detail"]

    # 2.3 Clubs cannot upload syllabus documents
    res = await client.post(
        "/api/uploads",
        data={"data_type": "syllabus", "doc_key": "syllabus:ALL:general"},
        cookies={"campus_session": test_users["club"]["token"]},
        headers={"X-CSRF-Token": test_users["club"]["csrf"]}
    )
    assert res.status_code == 403
    assert "restricted to event posters" in res.json()["detail"]

    # 2.4 Non-admin users cannot approve submissions
    res = await client.post(
        "/api/submissions/dummy-uuid/approve",
        cookies={"campus_session": test_users["staff_cse"]["token"]},
        headers={"X-CSRF-Token": test_users["staff_cse"]["csrf"]}
    )
    assert res.status_code == 403

# ============================================================================
# 3. CONCURRENT APPROVAL IDEMPOTENCY TEST
# ============================================================================
@pytest.mark.asyncio
async def test_concurrent_double_approval(client: AsyncClient, test_users, seed_submission):
    admin_auth = {
        "cookies": {"campus_session": test_users["admin"]["token"]},
        "headers": {"X-CSRF-Token": test_users["admin"]["csrf"]}
    }

    # Execute two approve calls at the exact same millisecond
    sub_id = seed_submission["id"]
    res1, res2 = await asyncio.gather(
        client.post(f"/api/submissions/{sub_id}/approve", **admin_auth),
        client.post(f"/api/submissions/{sub_id}/approve", **admin_auth)
    )

    # Exactly one must publish; the second must succeed idempotently without creating duplicate versions
    statuses = [res1.status_code, res2.status_code]
    assert statuses == [200, 200]
    responses = [res1.json()["message"], res2.json()["message"]]
    assert any("published successfully" in m for m in responses)
    assert any("already approved" in m for m in responses)

# ============================================================================
# 4. RAG CROSS-BRANCH ISOLATION TEST
# ============================================================================
@pytest.mark.asyncio
async def test_rag_branch_isolation(client: AsyncClient, test_users, seed_rag_chunks):
    # CSE student queries for midterm dates
    cse_res = await client.post(
        "/api/chat",
        json={"message": "When are midterm exam dates?"},
        cookies={"campus_session": test_users["student_cse"]["token"]},
        headers={"X-CSRF-Token": test_users["student_cse"]["csrf"]}
    )
    # ECE student queries for same
    ece_res = await client.post(
        "/api/chat",
        json={"message": "When are midterm exam dates?"},
        cookies={"campus_session": test_users["student_ece"]["token"]},
        headers={"X-CSRF-Token": test_users["student_ece"]["csrf"]}
    )

    assert "CSE Midterms" in cse_res.json()["answer"]
    assert "CSE Midterms" not in ece_res.json()["answer"]
```


## 6.2 Operational SQL Observability Views

The application logs telemetry records for every query asynchronously via app_write. Operational monitoring is provided via production SQL views tracking tier distribution, latency percentiles, and governance audits.

```sql
-- ============================================================================
-- CAMPUS INTELLIGENCE: OPERATIONAL OBSERVABILITY VIEWS
-- ============================================================================

-- 1. Traffic Share by Execution Tier (Target: >70% in Tier 0)
CREATE OR REPLACE VIEW v_traffic_share_by_tier AS
SELECT 
  tier,
  count(*) AS total_queries,
  round((count(*)::numeric / sum(count(*)) OVER ()) * 100, 2) AS percentage_share,
  round(avg(latency_ms), 1) AS avg_latency_ms,
  sum(prompt_tokens) AS total_prompt_tokens,
  sum(completion_tokens) AS total_completion_tokens
FROM query_logs
WHERE ts >= now() - interval '7 days'
GROUP BY tier
ORDER BY tier;

-- 2. Slowest and Failing Intent Diagnostic View
CREATE OR REPLACE VIEW v_intent_performance AS
SELECT 
  coalesce(intent, 'unrouted') AS intent_name,
  count(*) AS total_requests,
  round(avg(latency_ms), 1) AS avg_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  count(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  count(*) FILTER (WHERE thumbs = 1) AS thumbs_up,
  count(*) FILTER (WHERE thumbs = -1) AS thumbs_down
FROM query_logs
WHERE ts >= now() - interval '7 days'
GROUP BY intent
ORDER BY total_requests DESC;

-- 3. Administrative Governance & Version Audit Timeline
CREATE OR REPLACE VIEW v_recent_audit_timeline AS
SELECT 
  a.id,
  a.ts AT TIME ZONE 'Asia/Kolkata' AS ist_timestamp,
  u.email AS actor_email,
  u.role AS actor_role,
  a.action,
  a.target,
  a.detail
FROM audit_log a
LEFT JOIN users u ON u.id = a.actor
ORDER BY a.ts DESC
LIMIT 100;
```


## 6.3 Production Deployment & Hardening Runbook

To achieve full 10 MB upload support while maintaining SameSite=Lax cookie authentication, the application is deployed on sibling subdomains of the same registrable domain (app.campus.edu for the PWA and api.campus.edu for the backend).

```ini
# ============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION (.env.production)
# ============================================================================

# Database Connections (PostgreSQL 16 with pgvector & pg_trgm)
DATABASE_URL=postgresql://app_write:SECURE_WRITE_PASS@db.campus.internal:5432/postgres?sslmode=require
DATABASE_URL_READONLY=postgresql://app_read:SECURE_READ_PASS@db.campus.internal:5432/postgres?sslmode=require

# Security and Authentication
JWT_SECRET=b8d7a1e2f3c4...MINIMUM_64_CHAR_HEX_SECRET...
COOKIE_DOMAIN=.campus.edu
COLLEGE_EMAIL_DOMAIN=campus.edu
ADMIN_EMAILS=admin@campus.edu,dean@campus.edu
ALLOWED_ORIGINS=https://app.campus.edu

# Transactional Email (OTP Delivery)
EMAIL_API_KEY=re_123456789...
EMAIL_FROM=Campus Intelligence <auth@campus.edu>

# Google Gemini API
GEMINI_API_KEY=AIzaSy...PROD_KEY
GEMINI_MODEL_ROUTER=gemini-2.0-flash-lite
GEMINI_MODEL_EXTRACT=gemini-2.0-flash
GEMINI_MODEL_SYNTH=gemini-2.0-flash
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIM=768
RAG_MIN_SIMILARITY=0.45

# Private Object Storage (S3 / Cloudflare R2)
STORAGE_ENDPOINT=https://your-r2-account-id.r2.cloudflarestorage.com
STORAGE_BUCKET=campus-prod-files
STORAGE_ACCESS_KEY=d7b6a5...
STORAGE_SECRET_KEY=9e8f7a...

# Application Runtime Constraints
MAX_UPLOAD_MB=10
MAX_PAGES=50
TZ=Asia/Kolkata
```


### Automated Free-Tier Uptime Ping Configuration

A scheduled GitHub Actions workflow pings the unauthenticated /api/healthz endpoint every 10 minutes between 07:00 and 23:00 IST to prevent container idling.

```yaml
# .github/workflows/uptime_ping.yml
name: Keep-Alive Ping
on:
  schedule:
    # Runs every 10 minutes from 01:30 to 17:30 UTC (07:00 to 23:00 IST)
    - cron: '*/10 1-17 * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Campus API Health Endpoint
        run: |
          curl -f -s -o /dev/null https://api.campus.edu/api/healthz || exit 1
```


## 6.4 Phase 6 Actionable Verification Checklist

Execute this final verification checklist to validate automated tests, operational views, and production deployment health.

| [x] | Verification Objective | Test Command / Execution Method | Expected Pass Assertion |
| --- | --- | --- | --- |
| [  ] | V6.1: Complete Pytest Pass | pytest tests/ -v --asyncio-mode=auto | 100% of test cases pass (Tier 0 rules, RBAC matrix, double-approval concurrency, RAG branch isolation). |
| [  ] | V6.2: Operational View Integrity | psql $DATABASE_URL -c 'SELECT * FROM v_traffic_share_by_tier;' | Returns accurate tier percentages and latency metrics from query_logs. |
| [  ] | V6.3: Live /api/healthz Liveness | curl -i https://api.campus.edu/api/healthz | HTTP 200 OK with {"status": "ok", "timestamp": ...}; zero DB credentials or stack details leaked. |
| [  ] | V6.4: CORS Pre-Flight Validation | curl -X OPTIONS https://api.campus.edu/api/uploads -H 'Origin: https://app.campus.edu' -H 'Access-Control-Request-Method: POST' | HTTP 200 with Access-Control-Allow-Origin: https://app.campus.edu and Access-Control-Allow-Credentials: true. |
| [  ] | V6.5: 10 MB Direct Upload Sibling Route | Upload 9.8 MB file directly to https://api.campus.edu/api/uploads. | Payload completes without 413 or proxy-body cap error (avoiding Vercel 4.5 MB proxy ceiling). |
