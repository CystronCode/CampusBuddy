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
