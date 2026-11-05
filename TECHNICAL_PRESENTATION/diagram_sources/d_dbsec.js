'use strict';
const { box, group, arrow, doc, text, pill, C, MONO } = require('./lib');

// Helper to render a database table entity box
function entityBox(x, y, w, title, rows, c = 'db', tag = null) {
  const rowH = 19;
  const h = 34 + rows.length * rowH + 8;
  const k = C[c];
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#FFFFFF" stroke="${k.s}" stroke-width="1.8" filter="url(#sh)"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="32" rx="8" fill="${k.s}"/>`;
  s += `<rect x="${x}" y="${y + 24}" width="${w}" height="8" fill="${k.s}"/>`;
  s += text(x + 12, y + 21, title, { size: 13, weight: 700, color: '#FFFFFF', font: MONO });
  if (tag) s += pill(x + w - 8, y + 6, tag, 'warn', { size: 9, anchor: 'end' });
  
  rows.forEach((r, i) => {
    const ry = y + 36 + i * rowH;
    const [flag, col, type, extra] = r;
    if (i % 2 === 1) {
      s += `<rect x="${x + 2}" y="${ry - 2}" width="${w - 4}" height="${rowH}" fill="#F8FAFC"/>`;
    }
    // PK / FK / UK badge
    if (flag === 'PK') {
      s += pill(x + 8, ry + 1, 'PK', 'ok', { size: 8 });
    } else if (flag === 'FK') {
      s += pill(x + 8, ry + 1, 'FK', 'be', { size: 8 });
    } else if (flag === 'PF') {
      s += pill(x + 8, ry + 1, 'PK/FK', 'part', { size: 8 });
    } else if (flag === 'UQ') {
      s += pill(x + 8, ry + 1, 'UQ', 'ext', { size: 8 });
    }
    s += text(x + 44, ry + 12, col, { size: 11, weight: flag ? 700 : 500, color: '#1E293B', font: MONO });
    s += text(x + w - 10, ry + 12, type, { size: 10.5, color: '#64748B', anchor: 'end', font: MONO });
  });
  s += '</g>';
  return { svg: s, h, x, y, w, cx: x + w / 2, cy: y + h / 2 };
}

// 8. DATABASE ER DIAGRAM
function erDiagram() {
  let b = '';
  // Category headers
  b += text(40, 105, 'IDENTITY & AUDIT', { size: 12, weight: 800, color: '#64748B' });
  b += text(360, 105, 'INGESTION GOVERNANCE', { size: 12, weight: 800, color: '#64748B' });
  b += text(760, 105, 'STRUCTURED DOMAIN TABLES', { size: 12, weight: 800, color: '#64748B' });
  b += text(1230, 105, 'KNOWLEDGE & TELEMETRY', { size: 12, weight: 800, color: '#64748B' });

  // Column 1: Identity & Security
  const u = entityBox(36, 120, 290, 'users', [
    ['PK', 'id', 'UUID (gen_random_uuid)'],
    ['', 'college_id', 'INT NOT NULL = 1'],
    ['UQ', 'email', 'TEXT UNIQUE CHECK(lower)'],
    ['', 'role', 'TEXT (student/club/staff/admin)'],
    ['', 'branch', 'TEXT (staff branch check)'],
    ['', 'year', 'SMALLINT (1-6)'],
    ['', 'section', 'TEXT'],
    ['', 'club', 'TEXT (mandatory if club)'],
    ['', 'veg_pref', 'BOOLEAN'],
    ['', 'budget_default', 'INT (>0)'],
    ['', 'token_version', 'INT DEFAULT 0'],
    ['', 'created_at', 'TIMESTAMPTZ DEFAULT now()'],
  ]);
  b += u.svg;

  const o = entityBox(36, 420, 290, 'auth_otps', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'email', 'TEXT NOT NULL CHECK(lower)'],
    ['', 'code_hash', 'TEXT NOT NULL (HMAC-SHA256)'],
    ['', 'expires_at', 'TIMESTAMPTZ (+10 min)'],
    ['', 'attempts', 'SMALLINT DEFAULT 0 (max 5)'],
    ['', 'consumed_at', 'TIMESTAMPTZ'],
    ['', 'created_at', 'TIMESTAMPTZ DEFAULT now()'],
  ]);
  b += o.svg;

  const al = entityBox(36, 610, 290, 'audit_log', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'ts', 'TIMESTAMPTZ DEFAULT now()'],
    ['FK', 'actor', 'UUID → users(id)'],
    ['', 'action', 'TEXT (approve/reject/...)'],
    ['', 'target', 'TEXT'],
    ['', 'detail', 'JSONB'],
  ]);
  b += al.svg;

  // Column 2: Ingestion & Governance
  const fl = entityBox(356, 120, 370, 'files', [
    ['PK', 'id', 'UUID (gen_random_uuid)'],
    ['', 'storage_path', 'TEXT NOT NULL (UUID.ext)'],
    ['', 'original_name', 'TEXT'],
    ['', 'mime', 'TEXT (magic bytes sniffed)'],
    ['', 'size_bytes', 'INT (<= 10MB cap)'],
    ['', 'sha256', 'TEXT NOT NULL (index)'],
    ['FK', 'uploaded_by', 'UUID → users(id)'],
    ['', 'created_at', 'TIMESTAMPTZ DEFAULT now()'],
  ]);
  b += fl.svg;

  const sub = entityBox(356, 335, 370, 'submissions', [
    ['PK', 'id', 'UUID (gen_random_uuid)'],
    ['FK', 'file_id', 'UUID → files(id)'],
    ['FK', 'uploaded_by', 'UUID → users(id)'],
    ['', 'data_type', 'TEXT (timetable/menu/...)'],
    ['', 'scope', 'TEXT (e.g. timetable:CSE-3-A)'],
    ['', 'doc_key', 'TEXT ({type}:{dept}:{slug})'],
    ['', 'valid_until', 'DATE (mandatory for notices)'],
    ['', 'status', 'TEXT (processing/draft/...)'],
    ['', 'extracted', 'JSONB (records payload)'],
    ['', 'confidence', 'JSONB (cell-level flags)'],
    ['', 'error', 'TEXT (failure reason)'],
    ['FK', 'reviewer', 'UUID → users(id)'],
    ['', 'reject_reason', 'TEXT'],
    ['', 'version', 'INT (published version)'],
    ['', 'published_versions', 'JSONB (multi-scope map)'],
    ['', 'created_at', 'TIMESTAMPTZ DEFAULT now()'],
    ['', 'updated_at', 'TIMESTAMPTZ DEFAULT now()'],
    ['', 'reviewed_at', 'TIMESTAMPTZ'],
  ]);
  b += sub.svg;

  const dv = entityBox(356, 735, 370, 'data_versions', [
    ['PK', 'scope', 'TEXT (e.g. timetable:CSE-3-A)'],
    ['', 'active_version', 'INT NOT NULL DEFAULT 1'],
    ['', 'latest_version', 'INT NOT NULL DEFAULT 1'],
    ['', 'rev', 'BIGINT NOT NULL DEFAULT 1'],
    ['', 'updated_at', 'TIMESTAMPTZ DEFAULT now()'],
  ]);
  b += dv.svg;

  // Column 3: Structured Domain Tables
  const fac = entityBox(756, 120, 440, 'faculty', [
    ['PK', 'id', 'SERIAL'],
    ['', 'name', 'TEXT NOT NULL (trgm gin index)'],
    ['', 'short_code', 'TEXT'],
    ['', 'department', 'TEXT'],
    ['', 'designation', 'TEXT'],
    ['UQ', 'email', 'TEXT (UNIQUE lowercase)'],
    ['', 'cabin', 'TEXT'],
    ['', 'office_hours', 'TEXT'],
    ['', 'subjects', 'TEXT[]'],
    ['', 'subjects_text', 'TEXT (pre-joined for trgm)'],
    ['', 'is_active', 'BOOLEAN DEFAULT true'],
    ['FK', 'submission_id', 'UUID → submissions(id)'],
  ]);
  b += fac.svg;

  const tt = entityBox(756, 410, 440, 'timetable_slots', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'scope', 'TEXT (= timetable:{branch}-{yr}-{sec})'],
    ['', 'branch', 'TEXT NOT NULL'],
    ['', 'year', 'SMALLINT (1-6)'],
    ['', 'section', 'TEXT NOT NULL'],
    ['', 'day', 'SMALLINT (1=Mon ... 7=Sun)'],
    ['', 'period', 'SMALLINT'],
    ['', 'start_time', 'TIME NOT NULL'],
    ['', 'end_time', 'TIME NOT NULL (end > start)'],
    ['', 'subject', 'TEXT NOT NULL'],
    ['', 'kind', 'TEXT (lecture/lab/tutorial/other)'],
    ['FK', 'faculty_id', 'INT → faculty(id) ON DELETE SET NULL'],
    ['', 'room', 'TEXT'],
    ['', 'version', 'INT NOT NULL'],
    ['FK', 'submission_id', 'UUID → submissions(id)'],
  ]);
  b += tt.svg;

  const mi = entityBox(756, 755, 220, 'menu_items', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'scope', 'TEXT (menu:mess)'],
    ['', 'day', 'SMALLINT (1-7)'],
    ['', 'meal', 'TEXT (breakfast/...)'],
    ['', 'item', 'TEXT NOT NULL'],
    ['', 'price', 'INT CHECK(>=0)'],
    ['', 'is_veg', 'BOOLEAN'],
    ['', 'version', 'INT NOT NULL'],
    ['FK', 'submission_id', 'UUID → submissions'],
  ]);
  b += mi.svg;

  const hol = entityBox(986, 755, 210, 'holidays', [
    ['PK', 'id', 'SERIAL'],
    ['', 'scope', 'TEXT (holidays:cal)'],
    ['', 'date', 'DATE NOT NULL'],
    ['', 'name', 'TEXT NOT NULL'],
    ['', 'kind', 'TEXT'],
    ['', 'version', 'INT NOT NULL'],
    ['FK', 'submission_id', 'UUID → submissions'],
  ]);
  b += hol.svg;

  // Column 4: Events, Knowledge & Telemetry
  const ev = entityBox(1226, 120, 338, 'events', [
    ['PK', 'id', 'SERIAL'],
    ['', 'title', 'TEXT NOT NULL'],
    ['', 'club', 'TEXT NOT NULL'],
    ['', 'description', 'TEXT'],
    ['', 'venue', 'TEXT'],
    ['', 'starts_at', 'TIMESTAMPTZ'],
    ['', 'ends_at', 'TIMESTAMPTZ (ends >= starts)'],
    ['', 'valid_until', 'TIMESTAMPTZ NOT NULL'],
    ['', 'is_active', 'BOOLEAN DEFAULT true'],
    ['FK', 'file_id', 'UUID → files(id)'],
    ['FK', 'submission_id', 'UUID UNIQUE → submissions(id)'],
  ]);
  b += ev.svg;

  const dc = entityBox(1226, 385, 338, 'doc_chunks', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'scope', 'TEXT NOT NULL'],
    ['', 'doc_key', 'TEXT NOT NULL'],
    ['FK', 'file_id', 'UUID → files(id)'],
    ['FK', 'submission_id', 'UUID → submissions(id)'],
    ['', 'doc_type', 'TEXT (syllabus / notice)'],
    ['', 'title', 'TEXT'],
    ['', 'section', 'TEXT'],
    ['', 'page', 'INT'],
    ['', 'chunk_index', 'INT NOT NULL'],
    ['', 'content', 'TEXT NOT NULL'],
    ['', 'embedding', 'vector(768) NOT NULL'],
    ['', 'embedding_model', 'TEXT NOT NULL'],
    ['', 'tsv', 'tsvector GENERATED ALWAYS'],
    ['', 'branch', 'TEXT (NULL = ALL)'],
    ['', 'valid_until', 'DATE'],
    ['', 'version', 'INT NOT NULL'],
  ]);
  b += dc.svg;

  const ql = entityBox(1226, 755, 338, 'query_logs', [
    ['PK', 'id', 'BIGSERIAL'],
    ['', 'ts', 'TIMESTAMPTZ DEFAULT now()'],
    ['', 'user_id', 'UUID (no FK by design)'],
    ['', 'tier', 'SMALLINT (0, 1, 2)'],
    ['', 'intent', 'TEXT'],
    ['', 'tools', 'TEXT[]'],
    ['', 'cache_hit', 'BOOLEAN'],
    ['', 'latency_ms', 'INT'],
    ['', 'query_text', 'TEXT'],
    ['', 'error', 'TEXT'],
    ['', 'thumbs', 'SMALLINT (-1, 1)'],
  ], 'be', 'TELEMETRY');
  b += ql.svg;

  // Relationship connectors (FKs)
  // users -> files.uploaded_by
  b += arrow([[326, 180], [356, 180]], { c: 'be' });
  // users -> submissions.uploaded_by
  b += arrow([[326, 260], [340, 260], [340, 390], [356, 390]], { c: 'be' });
  // users -> audit_log.actor
  b += arrow([[180, 368], [180, 610]], { c: 'be' });
  // files -> submissions.file_id
  b += arrow([[541, 305], [541, 335]], { c: 'be' });
  // submissions -> faculty
  b += arrow([[726, 360], [741, 360], [741, 150], [756, 150]], { c: 'be' });
  // submissions -> timetable_slots
  b += arrow([[726, 450], [756, 450]], { c: 'be' });
  // submissions -> menu_items
  b += arrow([[541, 715], [541, 730], [741, 730], [741, 780], [756, 780]], { c: 'be' });
  // submissions -> holidays
  b += arrow([[726, 680], [741, 680], [741, 745], [970, 745], [970, 780], [981, 780]], { c: 'be' });
  // submissions -> events
  b += arrow([[726, 345], [741, 345], [741, 110], [1210, 110], [1210, 150], [1226, 150]], { c: 'be' });
  // submissions -> doc_chunks
  b += arrow([[726, 480], [741, 480], [741, 375], [1210, 375], [1210, 420], [1226, 420]], { c: 'be' });
  // faculty -> timetable_slots.faculty_id
  b += arrow([[976, 375], [976, 410]], { c: 'db' });
  // files -> events.file_id
  b += arrow([[726, 140], [1226, 140]], { c: 'be', dashed: true });

  return doc(1600, 1020, 'Database ER Diagram', '13 tables in PostgreSQL 16 · Supabase-hosted · pgvector(768) + pg_trgm + tsvector', b, {
    legend: [['db', 'Domain entity'], ['be', 'Governance / Log'], ['ok', 'PK'], ['be', 'FK'], ['ext', 'Unique index']]
  });
}

// 9. AUTHENTICATION & RBAC DIAGRAM
function authRbac() {
  let b = '';

  // Side-by-side comparison: Active Next.js /v1 vs Legacy /api
  b += group({ x: 36, y: 100, w: 740, h: 420, label: 'Active Authentication Path (/v1/auth/login)', c: 'warn', sub: 'Used by frontend-next UI in production' });
  b += box({ x: 56, y: 150, w: 200, h: 90, title: 'Client Form', lines: ['campus-app.tsx', 'zod loginSchema', 'Demo credentials provided'], c: 'fe' });
  b += box({ x: 300, y: 150, w: 220, h: 90, title: 'In-Code Verification', lines: ['v1_compat.py', 'Hard-coded demo accounts', 'NO DB query / NO hash check'], c: 'warn', tag: 'CRITICAL', tagC: 'warn' });
  b += box({ x: 556, y: 150, w: 200, h: 90, title: 'Token Issuance', lines: ['HS256 JWT (exp: 14 days)', 'Claims: sub, role, name', 'Returned in JSON body'], c: 'be' });

  b += arrow([[256, 195], [300, 195]], { c: 'be' });
  b += arrow([[520, 195], [556, 195]], { c: 'be' });

  b += box({ x: 56, y: 280, w: 280, h: 100, title: 'Client Storage', lines: ['localStorage["campusos_session"]', 'Attached as Authorization: Bearer <token>', 'Plus X-Tenant-ID header'], c: 'fe' });
  b += box({ x: 390, y: 280, w: 366, h: 100, title: 'Server Validation: _resolve_v1_user()', lines: ['jwt.decode(token, verify_signature=False)', 'Accepts any role declared in claims', 'Fallback to alex student if student in email'], c: 'warn', tag: 'VULNERABILITY', tagC: 'warn' });

  b += arrow([[156, 240], [156, 280]], { c: 'fe' });
  b += arrow([[336, 330], [390, 330]], { c: 'warn' });

  b += box({ x: 56, y: 410, w: 700, h: 80, title: 'Role Access Control in /v1 Routes', lines: [
    '• student: Chat, overview, view timetable/menu/faculty/events, patch own preferences (in-memory).',
    '• institution_admin: Guarded by _require_admin() — ingestion preview/retry/confirm, inline CRUD.'
  ], c: 'be', ts: 12.5, ls: 11 });

  // Legacy /api OTP Path
  b += group({ x: 824, y: 100, w: 740, h: 420, label: 'Legacy Hardened Authentication (/api/auth)', c: 'gray', sub: 'Implemented in backend; dormant because active UI uses /v1' });
  b += box({ x: 844, y: 150, w: 190, h: 90, title: '1 · OTP Request', lines: ['POST /api/auth/otp/request', 'Rate-limit: 3 / min', 'HMAC-SHA256 hash in DB'], c: 'gray' });
  b += box({ x: 1060, y: 150, w: 220, h: 90, title: '2 · Resend Email', lines: ['Delivers 6-digit numeric OTP', 'Expires in 10 minutes', 'Logged in console if mock'], c: 'ext' });
  b += box({ x: 1306, y: 150, w: 238, h: 90, title: '3 · OTP Verify', lines: ['SELECT ... FOR UPDATE', 'Max 5 attempts cap', 'Mark consumed, upsert user'], c: 'db' });

  b += arrow([[1034, 195], [1060, 195]], { c: 'gray' });
  b += arrow([[1280, 195], [1306, 195]], { c: 'gray' });

  b += box({ x: 844, y: 280, w: 320, h: 100, title: '4 · Session Cookie Issuance', lines: ['Set-Cookie: campus_session (JWT, 7 days)', 'HttpOnly, SameSite=Lax, Secure=true', 'Path=/api  (isolated scope)'], c: 'ok' });
  b += box({ x: 1200, y: 280, w: 344, h: 100, title: '5 · CSRF Token Delivery', lines: ['X-CSRF-Token generated via HMAC', 'HMAC-SHA256(JWT_SECRET, uid:token_ver)', 'Mandatory for POST/PATCH/DELETE'], c: 'ok' });

  b += arrow([[1425, 240], [1425, 260], [1004, 260], [1004, 280]], { c: 'ok' });
  b += arrow([[1004, 260], [1372, 260], [1372, 280]], { c: 'ok' });

  b += box({ x: 844, y: 410, w: 700, h: 80, title: 'Enforcement in SessionSecurityMiddleware', lines: [
    'Origin header validation on state-changing requests · Immediate DB re-read on privileged routes',
    'token_version revocation check · Evicts 60s LRU session cache on change · Strict 4-role RBAC'
  ], c: 'ok', ts: 12.5, ls: 11 });

  // RBAC Permission Matrix (Bottom)
  b += group({ x: 36, y: 550, w: 1528, h: 360, label: 'Role-Based Access Control (RBAC) Permission Comparison Matrix', c: 'be' });
  const cols = [
    { label: 'System Action / Endpoint', w: 360, mono: true },
    { label: 'Student', w: 260 },
    { label: 'Club Organizer', w: 260 },
    { label: 'Staff / Faculty', w: 260 },
    { label: 'Institution Admin', w: 328 },
  ];
  const rows = [
    ['GET /v1/overview, /v1/timetable, /v1/menu', { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }],
    ['POST /v1/chat, /v1/chat/stream', { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }, { t: 'ALLOWED', c: 'ok' }],
    ['POST /v1/ingestion/preview (upload)', { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'ALLOWED (unverified bearer)', c: 'ok' }],
    ['POST /v1/ingestion/{id}/confirm (publish)', { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'ALLOWED (runs approve)', c: 'ok' }],
    ['PATCH /v1/timetable/{id}, menu/{id}', { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'ALLOWED (rev++)', c: 'ok' }],
    ['Legacy: POST /api/uploads', { t: 'DENIED (403)', c: 'warn' }, { t: 'POSTER ONLY (valid_until mandatory)', c: 'part' }, { t: 'OWN BRANCH timetable/notice', c: 'part' }, { t: 'FULL ACCESS (all data types)', c: 'ok' }],
    ['Legacy: POST /api/submissions/{id}/approve', { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'DENIED (403)', c: 'warn' }, { t: 'ALLOWED (DB verified)', c: 'ok' }],
    ['FastMCP: Streamable HTTP (/mcp/*)', { t: 'UNAUTHENTICATED (Exempt from auth)', c: 'warn' }, { t: 'UNAUTHENTICATED', c: 'warn' }, { t: 'UNAUTHENTICATED', c: 'warn' }, { t: 'UNAUTHENTICATED', c: 'warn' }],
  ];
  b += require('./lib').table(56, 590, cols, rows, { rh: 36, hh: 36, fs: 11.5 });

  return doc(1600, 1020, 'Authentication & RBAC Architecture', 'Discrepancy between production /v1 bearer handling and dormant /api hardened cookie pipeline', b, {
    legend: [['fe', 'Frontend UI'], ['be', 'Backend'], ['db', 'PostgreSQL'], ['ok', 'Hardened'], ['warn', 'Security risk']]
  });
}

// 10. SECURITY ARCHITECTURE DIAGRAM
function secArch() {
  let b = '';
  // Defense in Depth Layers
  const layers = [
    {
      title: 'Layer 1: Network & Edge Security',
      c: 'infra',
      items: [
        ['CORS Middleware', 'Restricts origins via regex allow-list (Vercel, Render, localhost). Supports credentials.'],
        ['Security Headers', 'Next.js headers: X-Content-Type-Options: nosniff, Referrer-Policy, X-Frame-Options: DENY, Permissions-Policy.'],
        ['Keep-Alive Cron', 'GitHub Actions pings /health every 10 min to avoid Render free container cold starts.'],
      ]
    },
    {
      title: 'Layer 2: Transport & Identity Assurance',
      c: 'be',
      items: [
        ['Transport Layer', 'HTTPS enforced on Vercel and Render cloud edges; encrypted in transit.'],
        ['Token Architecture', 'Active /v1: Bearer HS256 JWT stored in browser localStorage. exp: 14 days.'],
        ['Token Verification Gap', 'CRITICAL: v1_compat.py calls jwt.decode(verify_signature=False). Subject to forged role claims.'],
        ['Legacy Cookie Auth', 'Hardened /api: HttpOnly SameSite=Lax cookie + HMAC-SHA256 CSRF verification.'],
      ]
    },
    {
      title: 'Layer 3: Ingestion & Input Sanitization',
      c: 'ok',
      items: [
        ['Magic-Byte Sniffing', 'Strict binary validation: PDF (%PDF-), XLSX (PK zip), DOCX, JPEG/PNG. Never trusts filename extension.'],
        ['File Size Caps', 'Enforced 10 MB maximum upload limit via MAX_UPLOAD_BYTES check before disk write.'],
        ['Deterministic Row Validation', 'Cell-level validation: day range (1-7), time sequence (end > start), meal types, and required fields.'],
        ['Prompt Injection Isolation', 'RAG text passed to Gemini/Groq as user context with constrained system instructions.'],
      ]
    },
    {
      title: 'Layer 4: Data Layer Isolation & Least Privilege',
      c: 'db',
      items: [
        ['Dual DB Roles', 'app_read: SELECT-only permissions on domain tables. app_write: Full DML for ingestion/approval.'],
        ['Connection Pooling', 'psycopg3 AsyncConnectionPool with max 5 connections, timeout=5-10s, prepare_threshold=None (pooler safe).'],
        ['SQL Injection Defense', '100% parameterised queries across all SQL calls (%s placeholders). Zero string interpolation in queries.'],
        ['Branch Isolation', 'Hybrid RAG queries enforce branch matching: branch IS NULL OR branch = user_branch OR branch = "ALL".'],
      ]
    },
    {
      title: 'Layer 5: Gaps & Threat Surface',
      c: 'warn',
      items: [
        ['FastMCP Server Open', '/mcp is mounted with zero authentication. Anyone can call all 14 tools if network-exposed.'],
        ['Local Disk Storage', 'Uploaded files stored on Render ephemeral disk (./uploads/). Lost on container restart.'],
        ['In-Memory Chat Storage', 'Conversations, chat messages, and user profile overrides live in Python dictionaries, not in DB.'],
        ['Hard-Coded Admin Bypass', 'Approval endpoint hard-codes fallback admin UUID 8c5f6b46-c167-43c3-93bf-84304a37239f.'],
      ]
    }
  ];

  const colW = 290, gap = 14, x0 = 36;
  layers.forEach((l, i) => {
    const x = x0 + i * (colW + gap);
    const k = C[l.c];
    b += `<rect x="${x}" y="100" width="${colW}" height="760" rx="12" fill="${k.f}" stroke="${k.s}" stroke-width="1.8"/>`;
    b += `<rect x="${x}" y="100" width="${colW}" height="50" rx="12" fill="${k.s}"/>`;
    b += `<rect x="${x}" y="138" width="${colW}" height="12" fill="${k.s}"/>`;
    b += text(x + 14, 131, l.title, { size: 13, weight: 700, color: '#FFFFFF' });

    let curY = 166;
    l.items.forEach(([t, desc]) => {
      const isWarn = l.c === 'warn' || t.includes('Gap') || t.includes('Open');
      const itemK = isWarn ? C.warn : C.gray;
      b += `<rect x="${x + 10}" y="${curY}" width="${colW - 20}" height="130" rx="8" fill="#FFFFFF" stroke="${itemK.s}" stroke-width="${isWarn ? 1.5 : 1}"/>`;
      b += text(x + 20, curY + 22, t, { size: 12.5, weight: 700, color: isWarn ? C.warn.t : '#0F172A' });
      
      // Multi-line description
      const words = desc.split(' ');
      let line = '', lineY = curY + 42;
      for (const w of words) {
        if ((line + w).length > 32) {
          b += text(x + 20, lineY, line, { size: 11, color: '#334155' });
          lineY += 16;
          line = w + ' ';
        } else {
          line += w + ' ';
        }
      }
      if (line) b += text(x + 20, lineY, line, { size: 11, color: '#334155' });

      curY += 142;
    });
  });

  return doc(1600, 890, 'Security Architecture & Threat Surface', 'Defense-in-depth evaluation: implemented controls vs verified vulnerabilities in source code', b, {
    legend: [['infra', 'Edge / Network'], ['be', 'Transport / Auth'], ['ok', 'Input / Sanitization'], ['db', 'Data Isolation'], ['warn', 'Threat / Risk']]
  });
}

function register(reg) {
  reg('03_DATABASE_SECURITY/database_er_diagram', erDiagram);
  reg('03_DATABASE_SECURITY/authentication_rbac', authRbac);
  reg('03_DATABASE_SECURITY/security_architecture', secArch);
}

module.exports = { register };
