'use strict';
const { box, group, arrow, doc, text, pill, C } = require('./lib');

const LEG = [['fe', 'Frontend'], ['be', 'Backend'], ['db', 'Data'], ['ext', 'External service'], ['gray', 'Legacy / not used by active UI', true], ['warn', 'Mock · volatile · risk', true]];

// 1. HIGH-LEVEL SYSTEM ARCHITECTURE
function highLevel() {
  let b = '';
  b += text(125, 130, 'USERS', { size: 12.5, weight: 800, color: '#64748B', anchor: 'middle' });
  b += box({ x: 40, y: 200, w: 170, h: 74, title: 'Student', lines: ['Web browser'], c: 'gray', align: 'center' });
  b += box({ x: 40, y: 310, w: 170, h: 74, title: 'Institution Admin', lines: ['Web browser'], c: 'gray', align: 'center' });

  b += group({ x: 235, y: 100, w: 340, h: 700, label: 'Frontend', c: 'fe', sub: 'Hosting: Vercel (inferred from CORS allow-list)' });
  b += box({ x: 255, y: 160, w: 300, h: 190, title: 'frontend-next  (active UI)', c: 'fe', tag: 'ACTIVE', tagC: 'ok', lines: [
    'Next.js 16 · React 19 · TypeScript', 'Client-rendered app shell (campus-app.tsx)', 'Views: Dashboard, Chat, Browse, Admin, Settings',
    'Session JSON kept in localStorage', 'Sends Bearer JWT + X-Tenant-ID', 'next.config rewrites /v1/* and /api/* to backend'] });
  b += box({ x: 255, y: 380, w: 300, h: 92, title: 'Supabase Auth (external)', c: 'ext', dashed: true, tag: 'OPTIONAL', tagC: 'part', lines: [
    'Fallback login + password reset only', 'Active only if NEXT_PUBLIC_SUPABASE_* set'] });
  b += box({ x: 255, y: 505, w: 300, h: 112, title: 'frontend/  (Vite SPA)', c: 'gray', dashed: true, tag: 'LEGACY', tagC: 'gray', lines: [
    'Vite 6 · React 18 · axios', 'HttpOnly cookie session + CSRF → /api/*', 'Deployment target: UNVERIFIED'] });

  b += group({ x: 600, y: 100, w: 575, h: 700, label: 'Backend · FastAPI (Python)', c: 'be', sub: 'Single Uvicorn process · hosting: Render (inferred from keep-alive workflow)' });
  b += box({ x: 620, y: 158, w: 535, h: 58, title: 'CORS  →  SessionSecurityMiddleware', c: 'be', ts: 13.5, ls: 11.5, lines: ['Cookie-JWT + CSRF checks apply to /api/* only; /v1/*, /mcp and public paths are exempt'] });
  b += box({ x: 620, y: 240, w: 170, h: 118, title: '/v1  router', c: 'be', tag: 'USED BY UI', tagC: 'ok', ls: 11.5, lines: ['v1_compat.py', '~35 endpoints', 'Bearer token (unverified)'] });
  b += box({ x: 802, y: 240, w: 170, h: 118, title: '/api  routers', c: 'gray', tag: 'LEGACY', tagC: 'gray', ls: 11.5, lines: ['auth, me, uploads,', 'approval, admin, queries', 'Cookie JWT + CSRF'] });
  b += box({ x: 984, y: 240, w: 171, h: 118, title: '/mcp  FastMCP', c: 'be', tag: 'NO AUTH', tagC: 'warn', ls: 11.5, lines: ['14 MCP tools', 'Streamable HTTP', '(2 tools are stubs)'] });

  b += group({ x: 620, y: 385, w: 535, h: 400, label: 'Shared service layer (app/services)', c: 'be' });
  b += box({ x: 635, y: 430, w: 250, h: 130, title: 'Query engine', c: 'be', ls: 11.5, lines: ['Tier 0: regex rules (tier0_engine)', 'Tier 1: LLM router → tool calls', 'tool_executor (timetable, menu, …)', 'Hybrid RAG: pgvector + FTS (RRF)'] });
  b += box({ x: 895, y: 430, w: 250, h: 130, title: 'Ingestion pipeline', c: 'be', ls: 11.5, lines: ['Parse PDF / XLSX / DOCX', 'Gemini vision → JSON (Groq fallback)', 'Deterministic validators', 'FastAPI BackgroundTasks (in-process)'] });
  b += box({ x: 635, y: 580, w: 250, h: 100, title: 'Caches (in-process)', c: 'be', ls: 11.5, lines: ['Scope rows keyed by (scope, rev)', 'Router cache 24 h · session cache 60 s'] });
  b += box({ x: 895, y: 580, w: 250, h: 100, title: 'In-memory state', c: 'warn', dashed: true, tag: 'VOLATILE', ls: 11.5, lines: ['Chat conversations & messages', 'User prefs · integration flags'] });
  b += box({ x: 635, y: 700, w: 510, h: 70, title: 'Support services', c: 'be', ts: 13, ls: 11.5, lines: ['auth_service · llm_provider · embedding_service · time_engine · sweeper (startup recovery)'] });

  b += group({ x: 1200, y: 100, w: 370, h: 345, label: 'Data', c: 'db' });
  b += box({ x: 1218, y: 145, w: 334, h: 140, title: 'Supabase PostgreSQL 16', c: 'db', ls: 11.5, lines: ['Extensions: pgvector (768-d), pg_trgm', '13 tables (see ER diagram)', 'Read pool (app_read) + write pool (app_write)', 'psycopg3 async pools, max 5 each', 'Supavisor pooler :6543 (ap-northeast-1)'] });
  b += box({ x: 1218, y: 315, w: 160, h: 112, title: 'Local disk', c: 'warn', dashed: true, tag: 'EPHEMERAL', ls: 11, lines: ['./uploads/', 'Used by /v1 ingestion', '+ raw file preview'] });
  b += box({ x: 1392, y: 315, w: 160, h: 112, title: 'S3 / R2 bucket', c: 'gray', dashed: true, tag: 'UNVERIFIED', tagC: 'gray', ls: 11, lines: ['boto3, optional', 'Legacy /api/uploads', 'only'] });

  b += group({ x: 1200, y: 470, w: 370, h: 330, label: 'External services', c: 'ext' });
  b += box({ x: 1218, y: 512, w: 334, h: 62, title: 'Groq API  (LLM_PROVIDER default)', c: 'ext', ts: 13.5, ls: 11.5, lines: ['Query routing + answer synthesis'] });
  b += box({ x: 1218, y: 588, w: 334, h: 76, title: 'Google Gemini API  (google-genai)', c: 'ext', ts: 13.5, ls: 11.5, lines: ['Vision extraction · embeddings (768-d)', 'Fallback router / synthesis LLM'] });
  b += box({ x: 1218, y: 678, w: 334, h: 50, title: 'Resend  — OTP e-mail (legacy /api)', c: 'ext', ts: 13, lines: [] });
  b += box({ x: 1218, y: 740, w: 334, h: 50, title: 'GitHub Actions — cron every 10 min', c: 'infra', ts: 13, lines: [] });

  // connections
  b += arrow([[210, 237], [255, 237]], { c: 'fe' });
  b += arrow([[210, 347], [232, 347], [232, 300], [255, 300]], { c: 'fe' });
  b += arrow([[405, 350], [405, 380]], { c: 'ext', dashed: true });
  b += arrow([[555, 255], [595, 255], [595, 300], [620, 300]], { c: 'fe', label: ['/v1/*', 'Bearer'], lx: 583, ly: 228 });
  b += arrow([[555, 560], [588, 560], [588, 187], [620, 187]], { c: 'gray', dashed: true, label: ['/api/*', 'cookie'], lx: 584, ly: 480 });
  b += arrow([[887, 216], [887, 240]], { c: 'gray' });
  b += arrow([[705, 358], [705, 385]], { c: 'be' });
  b += arrow([[887, 358], [887, 385]], { c: 'gray' });
  b += arrow([[1070, 358], [1070, 385]], { c: 'be' });
  b += arrow([[1155, 470], [1185, 470], [1185, 215], [1218, 215]], { c: 'db', both: true, label: 'SQL', lx: 1185, ly: 330 });
  b += arrow([[1145, 500], [1172, 500], [1172, 395], [1218, 395]], { c: 'warn' });
  b += arrow([[1155, 543], [1218, 543]], { c: 'ext' });
  b += arrow([[1155, 626], [1218, 626]], { c: 'ext' });
  b += arrow([[1155, 703], [1218, 703]], { c: 'ext', dashed: true });
  b += arrow([[1218, 765], [1177, 765]], { c: 'infra', label: 'GET /health', lx: 1196, ly: 785 });
  return doc(1600, 880, 'High-Level System Architecture', 'Actual runtime components and connections, as implemented in the repository', b, { legend: LEG, legendW: 900 });
}

// 2. TECHNOLOGY STACK
function techStack() {
  let b = '';
  const cols = [
    { t: 'Frontend (active)', c: 'fe', sub: 'frontend-next/package.json', items: [
      ['Next.js', '^16 (App Router, webpack build)'], ['React / React-DOM', '^19.2'], ['TypeScript', '^5.9'], ['Tailwind CSS', '^4.1 (+ @tailwindcss/postcss)'],
      ['react-hook-form + zod', 'form validation'], ['@supabase/supabase-js', '^2.80 (optional auth)'], ['lucide-react', 'icons'], ['CVA · clsx · tailwind-merge', 'styling utils'] ] },
    { t: 'Backend', c: 'be', sub: 'requirements.txt (Python version: UNKNOWN)', items: [
      ['FastAPI', '>=0.115'], ['Uvicorn [standard]', '>=0.30 (Procfile)'], ['Pydantic v2 [email]', 'request/response models'], ['PyJWT', 'HS256 tokens'],
      ['cachetools', 'TTL / LRU caches'], ['httpx', 'Groq + Resend calls'], ['mcp (FastMCP)', 'MCP server at /mcp'], ['boto3', 'S3/R2 client (optional)'], ['numpy', 'vector normalisation'] ] },
    { t: 'Data & Documents', c: 'db', sub: 'scripts/init_db.sql · migrations/', items: [
      ['PostgreSQL 16', 'Supabase-hosted (prod)'], ['pgvector', 'vector(768) embeddings'], ['pg_trgm', 'fuzzy faculty search'], ['tsvector FTS', 'generated column + GIN'],
      ['psycopg 3 [binary,pool]', 'async connection pools'], ['Alembic scripts', 'present; alembic not in requirements'], ['pdfplumber · pypdf', 'PDF text'], ['openpyxl · python-docx', 'XLSX / DOCX'] ] },
    { t: 'AI / LLM', c: 'ext', sub: 'app/core/config.py defaults', items: [
      ['Groq Cloud API', 'default provider (LLM_PROVIDER=groq)'], ['Groq model', 'GROQ_MODEL (default qwen/qwen3.8-27b)'], ['Google Gemini', 'google-genai SDK, multi-key pool'], ['Gemini model', 'GEMINI_MODEL_* (gemini-3-flash-preview)'],
      ['Embeddings', 'gemini-embedding-001 → 768-d, L2-normalised'], ['Hybrid RAG', 'cosine ≥ 0.45 + FTS, RRF k=60'] ] },
    { t: 'Infra & Tooling', c: 'infra', sub: 'deployment evidence in repo', items: [
      ['Render', 'backend host (inferred: URL in workflow)'], ['Vercel', 'frontend host (inferred: CORS list)'], ['Supabase', 'managed Postgres (pooler URL)'], ['GitHub Actions', 'keep-alive cron (*/10 min)'],
      ['Docker Compose', 'local pgvector/pgvector:pg16'], ['Resend', 'OTP e-mail (legacy flow)'], ['pytest + pytest-asyncio', '3 backend test files'], ['Playwright + axe-core', 'E2E spec (frontend-next)'] ] },
  ];
  const W = 296, G = 12, X0 = 36;
  cols.forEach((col, i) => {
    const x = X0 + i * (W + G), k = C[col.c];
    b += `<rect x="${x}" y="100" width="${W}" height="660" rx="14" fill="${k.f}" stroke="${k.s}" stroke-width="1.5"/>`;
    b += `<rect x="${x}" y="100" width="${W}" height="56" rx="14" fill="${k.s}"/><rect x="${x}" y="140" width="${W}" height="16" fill="${k.s}"/>`;
    b += text(x + 18, 127, col.t, { size: 17, weight: 700, color: '#fff' });
    b += text(x + 18, 147, col.sub, { size: 11, color: '#fff' });
    col.items.forEach((it, j) => {
      const y = 172 + j * 64;
      b += `<rect x="${x + 12}" y="${y}" width="${W - 24}" height="54" rx="8" fill="#fff" stroke="${k.s}" stroke-opacity="0.35"/>`;
      b += text(x + 26, y + 22, it[0], { size: 14, weight: 700, color: k.t });
      b += text(x + 26, y + 41, it[1], { size: 11.5, color: '#475569' });
    });
  });
  b += `<rect x="36" y="775" width="1528" height="58" rx="10" fill="#F8FAFC" stroke="#CBD5E1"/>`;
  b += text(54, 798, 'Legacy frontend (frontend/, deployment UNVERIFIED; the active UI does not call it):', { size: 12.5, weight: 700, color: '#334155' });
  b += text(54, 819, 'Vite 6 · React 18 · axios · DOMPurify · vite-plugin-pwa.   Not used: no Redis, no message queue, no ORM (raw parameterised SQL), no container orchestration.', { size: 12.5, color: '#475569' });
  return doc(1600, 870, 'Technology Stack', 'Only technologies declared in manifests AND referenced in source code', b);
}

// 3. COMPONENT ARCHITECTURE
function component() {
  let b = '';
  // Frontend layer
  b += group({ x: 36, y: 100, w: 1528, h: 190, label: 'Presentation layer — frontend-next/src', c: 'fe' });
  const fe = [
    ['campus-app.tsx', ['Login · session restore', 'App shell · navigation', 'Dashboard (overview)', 'Menu / budget view']],
    ['chat-view.tsx', ['Chat UI · SSE parsing', 'Conversation history', 'result-cards.tsx render']],
    ['browse-view.tsx', ['Timetable · Menu · Meals', 'Faculty · Events', 'Notices · Calendar', 'Inline admin edits']],
    ['admin-view.tsx', ['Upload + ingestion jobs', 'Review / edit records', 'System monitor', 'Memberships (static)']],
    ['settings-view.tsx', ['Profile preferences', 'Integrations (mock)', 'Personal import']],
    ['lib/api.ts', ['fetch wrapper (Bearer)', 'streamChat() SSE reader', 'Supabase client (opt.)']],
  ];
  fe.forEach((f, i) => b += box({ x: 52 + i * 252, y: 150, w: 238, h: 125, title: f[0], lines: f[1], c: 'fe', ls: 11.5, ts: 14 }));

  // API layer
  b += group({ x: 36, y: 315, w: 1528, h: 150, label: 'API layer — app/routers + app/mcp_server.py', c: 'be' });
  const api = [
    ['v1_compat.py  (/v1)', 'be', 'USED BY UI', 'ok', ['Auth (demo), me, timetable, menu, meals,', 'faculty, events, notices, chat, ingestion, admin']],
    ['student_queries.py  (/api)', 'gray', 'LEGACY', 'gray', ['/chat, /timetable, /menu, /faculty,', '/holidays, /events, /feedback']],
    ['auth · me · uploads  (/api)', 'gray', 'LEGACY', 'gray', ['OTP login, profile, RBAC uploads']],
    ['approval · admin_actions  (/api)', 'gray', 'LEGACY', 'gray', ['Approve / reject / rollback / unpublish']],
    ['mcp_server.py  (/mcp)', 'be', 'NO AUTH', 'warn', ['14 FastMCP tools over', 'cache + RAG services']],
  ];
  api.forEach((a, i) => b += box({ x: 52 + i * 302, y: 362, w: 290, h: 88, title: a[0], c: a[1], tag: a[2], tagC: a[3], lines: a[4], ls: 11.5, ts: 13.5 }));

  // Service layer
  b += group({ x: 36, y: 490, w: 1528, h: 200, label: 'Service layer — app/services', c: 'be' });
  const svc = [
    ['tier0_engine', 'Regex fast-path → tool'], ['router_engine', 'LLM intent → ToolCalls'], ['tool_executor', 'Runs 7 tool types'], ['rag_engine', 'Hybrid search + synthesis'],
    ['llm_provider', 'Groq ⇄ Gemini fallback'], ['embedding_service', 'Chunk + embed (768-d)'], ['ingestion_service', 'Parse + AI extraction'], ['validators', 'Row-level checks'],
    ['cache_service', '(scope, rev) row cache'], ['time_engine', 'Next-class calculation'], ['auth_service', 'OTP, JWT, CSRF HMAC'], ['sweeper_service', 'Stuck-job recovery'],
  ];
  svc.forEach((s, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    b += box({ x: 52 + col * 252, y: 535 + row * 75, w: 238, h: 62, title: s[0], lines: [s[1]], c: 'be', ts: 13.5, ls: 11.5 });
  });

  // Data layer
  b += group({ x: 36, y: 715, w: 1528, h: 110, label: 'Data & integration layer', c: 'db' });
  const d = [['core/database.py', 'read_pool / write_pool → PostgreSQL', 'db'], ['core/middleware.py', 'Session + CSRF (legacy /api)', 'be'], ['./uploads (disk)', 'Uploaded source files', 'warn'],
    ['Groq API', 'httpx → chat completions', 'ext'], ['Gemini API', 'genai.Client (vision, embed)', 'ext'], ['Resend API', 'OTP e-mail delivery', 'ext']];
  d.forEach((x, i) => b += box({ x: 52 + i * 252, y: 755, w: 238, h: 58, title: x[0], lines: [x[1]], c: x[2], ts: 13.5, ls: 11.5 }));

  // layer arrows
  [[400, 290, 315, 'HTTP /v1 (JSON, SSE)'], [800, 465, 490, 'function calls'], [1200, 690, 715, 'SQL · HTTPS · file I/O']].forEach(([x, y1, y2, l]) => {
    b += arrow([[x, y1], [x, y2]], { c: 'be', w: 2.4, label: l, lx: x + 110, ly: (y1 + y2) / 2 });
  });
  return doc(1600, 905, 'Component Architecture', 'Major modules, their responsibilities and layer dependencies', b, { legend: LEG, legendW: 900 });
}

module.exports = { highLevel, techStack, component, LEG };
