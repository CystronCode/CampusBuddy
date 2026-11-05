'use strict';
const { box, group, arrow, doc, text, pill, C, MONO } = require('./lib');

// 11. USE CASE DIAGRAM
function useCase() {
  let b = '';

  // Actors (Left side)
  const actors = [
    { id: 'student', title: 'Student', sub: 'alex student (CSE-3-A)', c: 'fe', y: 140 },
    { id: 'admin', title: 'Institution Admin', sub: 'campus admin (full access)', c: 'be', y: 340 },
    { id: 'staff', title: 'Faculty / Staff', sub: 'scoped to own branch', c: 'part', y: 550 },
    { id: 'club', title: 'Club Organizer', sub: 'scoped to club posters', c: 'ext', y: 730 },
  ];

  actors.forEach(a => {
    b += box({ x: 36, y: a.y, w: 220, h: 84, title: a.title, lines: [a.sub], c: a.c, align: 'center', ts: 14, ls: 11.5 });
  });

  // System Boundary Box
  b += `<rect x="320" y="90" width="1244" height="790" rx="16" fill="#F8FAFC" stroke="#7C3AED" stroke-width="2"/>`;
  b += `<rect x="320" y="90" width="280" height="34" rx="10" fill="#7C3AED"/>`;
  b += text(336, 113, 'SYSTEM BOUNDARY: CAMPUSOS MVP', { size: 12, weight: 800, color: '#FFFFFF' });

  // Use cases grouped by functional area
  const uc = (x, y, w, h, title, status = 'ACTIVE', statusC = 'ok', lines = []) => {
    let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#FFFFFF" stroke="${C[statusC].s}" stroke-width="1.6" filter="url(#sh)"/>`;
    s += pill(x + w - 12, y + 6, status, statusC, { size: 8.5, anchor: 'end' });
    s += text(x + 20, y + 26, title, { size: 12.5, weight: 700, color: '#0F172A' });
    lines.forEach((l, i) => {
      s += text(x + 20, y + 44 + i * 15, l, { size: 10.5, color: '#475569' });
    });
    s += '</g>';
    return s;
  };

  // Student Use Cases
  b += uc(350, 140, 340, 76, 'UC-1: Real-Time Natural Language Chat', 'ACTIVE', 'ok', ['Ask questions on classes, meals, exams & faculty', 'Streamed responses via SSE with interactive cards']);
  b += uc(350, 230, 340, 76, 'UC-2: View Personalized Daily Dashboard', 'ACTIVE', 'ok', ['Next class countdown timer & upcoming slots', 'High-priority campus notices & scheduled events']);
  b += uc(350, 320, 340, 76, 'UC-3: Interactive Timetable & Free Intervals', 'ACTIVE', 'ok', ['Weekly schedule view by day (Mon-Sun)', 'Identifies 90-minute gaps between lecture blocks']);
  b += uc(350, 410, 340, 76, 'UC-4: Canteen Browsing & Meal Combos', 'ACTIVE', 'ok', ['Filter vegetarian meals under budget (₹100/₹150)', 'Calculates nutritional macros & total cost']);
  b += uc(350, 500, 340, 76, 'UC-5: Faculty Directory & Cabin Finder', 'ACTIVE', 'ok', ['Fuzzy search by name, short code or subject', 'Displays cabin room, office hours and contact']);
  b += uc(350, 590, 340, 76, 'UC-6: Academic Calendar & Events', 'ACTIVE', 'ok', ['Exam milestone deadlines (CIE / SEE)', 'Club workshops & campus-wide gatherings']);
  b += uc(350, 680, 340, 76, 'UC-7: Adjust Diet & Budget Preferences', 'IN-MEMORY', 'warn', ['Preferences stored in Python memory dict', 'Does not persist across server restarts']);

  // Admin Use Cases
  b += uc(740, 140, 370, 76, 'UC-8: Multimodal Document Ingestion', 'ACTIVE', 'ok', ['Upload PDF, Excel (XLSX) or Word timetables/menus', 'Extracts tabular data into JSON preview']);
  b += uc(740, 230, 370, 76, 'UC-9: Review & Cell-Level Record Editing', 'ACTIVE', 'ok', ['Inspect extraction confidence and warnings', 'Direct inline cell editing before publishing']);
  b += uc(740, 320, 370, 76, 'UC-10: Atomic Approval & Version Bump', 'ACTIVE', 'ok', ['Atomically commits rows under version N+1', 'Evicts in-process raw-row cache across scopes']);
  b += uc(740, 410, 370, 76, 'UC-11: RAG Unstructured Embedding Indexing', 'ACTIVE', 'ok', ['Chunks notices/syllabi & generates 768-d vectors', 'Enables hybrid pgvector + full-text search']);
  b += uc(740, 500, 370, 76, 'UC-12: Live System & Telemetry Monitoring', 'ACTIVE', 'ok', ['Live table row counts and execution traces', 'Displays active LLM providers and verified tests']);
  b += uc(740, 590, 370, 76, 'UC-13: Scope Rollback & Emergency Invalidation', 'LEGACY ONLY', 'gray', ['Implemented in /api/admin/scopes/rollback', 'Dormant in active Next.js user interface']);
  b += uc(740, 680, 370, 76, 'UC-14: Sync External Calendar & Gmail', 'MOCK ONLY', 'warn', ['Simulates Google Calendar / Gmail integration', 'Returns static mock records on sync button click']);

  // External / Client Tools
  b += uc(1160, 140, 370, 76, 'UC-15: FastMCP Tool Consumption', 'NO AUTH', 'warn', ['14 tools callable via Streamable FastMCP server', 'Timetable, next class, faculty, meal budget, etc.']);
  b += uc(1160, 230, 370, 76, 'UC-16: Detect Schedule Conflicts', 'STUB', 'warn', ['MCP tool returns empty array [] stub', 'Logic not implemented in tool executor']);
  b += uc(1160, 320, 370, 76, 'UC-17: Legacy Institutional OTP Delivery', 'LEGACY ONLY', 'gray', ['Delivers 6-digit transactional code via Resend', 'SessionSecurityMiddleware validates cookie + CSRF']);
  b += uc(1160, 410, 370, 76, 'UC-18: Role-Scoped Club Poster Submission', 'LEGACY ONLY', 'gray', ['Allows club accounts to upload event banners', 'Enforces mandatory valid_until expiration date']);
  b += uc(1160, 500, 370, 76, 'UC-19: Automatic Stuck-Job Startup Sweeper', 'ACTIVE', 'ok', ['Recovers jobs stuck in processing during crash', 'Executed automatically during FastAPI lifespan']);

  // Connection arrows from actors to use cases
  // Student -> UC-1..6
  b += arrow([[256, 170], [350, 170]], { c: 'fe' });
  b += arrow([[256, 175], [300, 175], [300, 260], [350, 260]], { c: 'fe' });
  b += arrow([[256, 180], [290, 180], [290, 350], [350, 350]], { c: 'fe' });
  b += arrow([[256, 185], [280, 185], [280, 440], [350, 440]], { c: 'fe' });
  b += arrow([[256, 190], [270, 190], [270, 530], [350, 530]], { c: 'fe' });
  b += arrow([[256, 195], [260, 195], [260, 620], [350, 620]], { c: 'fe' });

  // Admin -> UC-8..12 (routed through top & bottom channels to avoid crossing any box)
  b += arrow([[256, 360], [280, 360], [280, 112], [720, 112], [720, 178], [740, 178]], { c: 'be' });
  b += arrow([[256, 370], [290, 370], [290, 118], [725, 118], [725, 268], [740, 268]], { c: 'be' });
  b += arrow([[256, 380], [300, 380], [300, 124], [730, 124], [730, 358], [740, 358]], { c: 'be' });
  b += arrow([[256, 390], [300, 390], [300, 810], [725, 810], [725, 448], [740, 448]], { c: 'be' });
  b += arrow([[256, 400], [290, 400], [290, 818], [720, 818], [720, 538], [740, 538]], { c: 'be' });

  // Staff -> UC-18
  b += arrow([[256, 590], [280, 590], [280, 826], [1145, 826], [1145, 448], [1160, 448]], { c: 'part', dashed: true });

  // Club -> UC-18
  b += arrow([[256, 770], [270, 770], [270, 834], [1150, 834], [1150, 460], [1160, 460]], { c: 'ext', dashed: true });

  return doc(1600, 940, 'System Use Case Diagram', 'Actual capabilities of verified user roles: implemented vs dormant vs mocked capabilities', b, {
    legend: [['fe', 'Student actor'], ['be', 'Admin actor'], ['ok', 'Implemented & Active'], ['warn', 'Mock / In-memory / Open'], ['gray', 'Legacy / Dormant', true]]
  });
}

// 12. DEPLOYMENT ARCHITECTURE DIAGRAM
function deployArch() {
  let b = '';

  // Edge / Client Tier
  b += group({ x: 36, y: 100, w: 320, h: 685, label: 'Client Tier', c: 'gray', sub: 'End-user browser runtime' });
  b += box({ x: 56, y: 160, w: 280, h: 140, title: 'Desktop / Mobile Browser', lines: [
    'Next.js 16 Client App (React 19)',
    'Session saved in localStorage',
    'HTTP Authorization: Bearer <token>',
    'EventSource SSE Stream Reader'
  ], c: 'gray' });

  b += box({ x: 56, y: 340, w: 280, h: 120, title: 'External MCP Client', lines: [
    'Cursor / Claude Desktop / CLI',
    'Streamable HTTP FastMCP Client',
    'Direct access to /mcp endpoint',
    'NO credentials required'
  ], c: 'warn', tag: 'NO AUTH', tagC: 'warn' });

  b += box({ x: 56, y: 500, w: 280, h: 120, title: 'GitHub Actions Runner', lines: [
    'Workflow: uptime_ping.yml',
    'Runs cron every 10 minutes',
    'curl -f $TARGET/health',
    'Prevents container hibernation'
  ], c: 'infra' });

  // Frontend Hosting Tier (Vercel)
  b += group({ x: 390, y: 100, w: 340, h: 685, label: 'Frontend Edge (Vercel)', c: 'fe', sub: 'Production URL: campusos-mvp.vercel.app' });
  b += box({ x: 410, y: 160, w: 300, h: 220, title: 'Vercel Edge & Serverless', lines: [
    'next build (webpack output)',
    'Global Edge CDN Caching',
    'Reverse Proxy Rewrites (next.config):',
    '  /v1/:path*  →  $BACKEND_URL/v1/:path*',
    '  /api/:path* →  $BACKEND_URL/api/:path*',
    'Security Headers (CSP, nosniff, DENY)',
    'Public SSL/TLS Edge Termination'
  ], c: 'fe' });

  b += box({ x: 410, y: 420, w: 300, h: 140, title: 'Supabase Auth (Cloud)', lines: [
    'Provider: AWS ap-northeast-1',
    'Client SDK: @supabase/supabase-js',
    'Fallback for password reset',
    'Optional: dormant if keys omitted'
  ], c: 'ext', dashed: true, tag: 'OPTIONAL', tagC: 'part' });

  // Backend Hosting Tier (Render Web Service)
  b += group({ x: 764, y: 100, w: 380, h: 685, label: 'Backend Host (Render Cloud)', c: 'be', sub: 'Production URL: campusos-api-5662.onrender.com' });
  b += box({ x: 784, y: 160, w: 340, h: 230, title: 'FastAPI / Uvicorn Service', lines: [
    'Container: Python Linux Web Service',
    'Entrypoint: Procfile (uvicorn app.main:app)',
    'Port: $PORT (dynamic binding)',
    'Lifespan: Database pool initialization',
    'BackgroundTasks: Ingestion OCR & parsing',
    'Startup Sweeper: Cleans stuck jobs',
    'Memory: In-memory session & chat dicts'
  ], c: 'be' });

  b += box({ x: 784, y: 430, w: 340, h: 120, title: 'Ephemeral Storage (./uploads)', lines: [
    'Local Container Disk (Render)',
    'Stores uploaded raw PDF/XLSX files',
    'Volatile: Deleted on redeploy/spin-down',
    'Retry depends on file remaining on disk'
  ], c: 'warn', tag: 'EPHEMERAL', tagC: 'warn' });

  // Data & AI Services Tier
  b += group({ x: 1178, y: 100, w: 386, h: 685, label: 'Managed Data & AI Tier', c: 'db', sub: 'External Cloud APIs & Managed DB' });
  b += box({ x: 1198, y: 160, w: 346, h: 170, title: 'Supabase Managed PostgreSQL 16', lines: [
    'Host: aws-0-ap-northeast-1.pooler.supabase.com:6543',
    'Supavisor Transaction Pooler (IPv4)',
    'Dual pools: app_read & app_write (max 5 each)',
    'Extensions: pgvector (768-d), pg_trgm, tsvector',
    '13 persistent relational tables'
  ], c: 'db' });

  b += box({ x: 1198, y: 350, w: 346, h: 110, title: 'Groq Cloud Inference (LPU)', lines: [
    'Model: qwen/qwen3.8-27b (OpenAI API spec)',
    'Tier 1 Query Intent Routing (< 500 ms)',
    'Faculty and document answer synthesis',
    'Rate-limit safety: 950-token output cap'
  ], c: 'ext' });

  b += box({ x: 1198, y: 480, w: 346, h: 120, title: 'Google Gemini API (google-genai)', lines: [
    'Model: gemini-3-flash-preview',
    'Multimodal Vision Ingestion & OCR',
    'Embedding: gemini-embedding-001 (768-d)',
    'Multi-key rotating client pool'
  ], c: 'ext' });

  b += box({ x: 1198, y: 620, w: 346, h: 80, title: 'Resend Transactional Email', lines: [
    'REST API for OTP delivery (legacy /api)',
    'Mock mode fallback (re_mock_test_key)'
  ], c: 'gray', dashed: true });

  // Inter-tier connections (clean non-overlapping orthogonal paths)
  b += arrow([[336, 210], [410, 210]], { c: 'fe', label: 'HTTPS / TLS', lx: 373, ly: 195 });
  // FastMCP client routes through horizontal corridor at y=400 between Vercel Edge and Supabase Auth
  b += arrow([[336, 400], [745, 400], [745, 270], [784, 270]], { c: 'warn', label: '/mcp (direct)', lx: 540, ly: 388 });
  // GitHub Actions Runner routes below Supabase Auth at y=640
  b += arrow([[336, 560], [360, 560], [360, 640], [755, 640], [755, 305], [784, 305]], { c: 'infra', label: 'GET /health', lx: 540, ly: 628 });
  // Next.js rewrites
  b += arrow([[710, 240], [784, 240]], { c: 'be', label: 'Rewritten /v1 & /api', lx: 747, ly: 225 });
  // Render -> Data & AI services
  b += arrow([[1124, 210], [1198, 210]], { c: 'db', both: true, label: 'TCP :6543 (Pooler)', lx: 1161, ly: 190 });
  b += arrow([[1124, 290], [1198, 380]], { c: 'ext', both: true, label: 'HTTPS (Groq)', lx: 1161, ly: 330 });
  b += arrow([[1124, 330], [1198, 510]], { c: 'ext', both: true, label: 'HTTPS (Gemini)', lx: 1161, ly: 420 });

  return doc(1600, 900, 'Deployment Architecture', 'Physical infrastructure, hosting providers, network boundaries and runtime configuration', b, {
    legend: [['gray', 'Client'], ['fe', 'Vercel Edge'], ['be', 'Render Host'], ['db', 'Supabase DB'], ['ext', 'AI APIs'], ['warn', 'Ephemeral / Open']]
  });
}

// 13. FEATURE ARCHITECTURE MAP
function featArch() {
  let b = '';

  const modules = [
    {
      title: '1. Multimodal Ingestion Engine',
      c: 'be',
      desc: 'Parses raw administrative documents into verified database records',
      feats: [
        'Magic-Byte Header Sniffer: Validates PDF, XLSX, DOCX, images.',
        'Gemini Vision Table Extractor: Converts tabular PDFs to structured JSON.',
        'High-Speed Groq Document Parser: Fallback text-based record extraction.',
        'Deterministic Row Validator: Validates day numbers, start/end sequence.',
        'Interactive Admin Review Grid: In-browser cell correction before publishing.',
        'Atomic Scope Publisher: Version bump (rev++), cache eviction, dual-indexing.'
      ]
    },
    {
      title: '2. 3-Tier Intelligent Query Engine',
      c: 'be',
      desc: 'Hierarchical query resolution providing sub-second campus intelligence',
      feats: [
        'Tier 0 Deterministic Engine: Zero-latency regex pattern matcher for common chips.',
        'Tier 1 Groq LPU Router: Maps free-form questions to structured tool contracts.',
        '24-Hour LRU Router Cache: Memorizes normalized query classifications.',
        'Tier 2 Hybrid RAG: Reciprocal Rank Fusion of pgvector (768-d) + tsvector FTS.',
        'Dual LLM Cascading Provider: Groq LPU primary with Gemini Flash fallback.',
        'SSE Token Streamer: Low-latency character-chunked response delivery.'
      ]
    },
    {
      title: '3. Academic Timetable & Scheduling',
      c: 'db',
      desc: 'Complete course schedule management with faculty mapping',
      feats: [
        'Dynamic Scope Resolution: timetable:{branch}-{year}-{section} isolation.',
        'Next-Class Countdown: Timezone-aware (Asia/Kolkata) next class calculation.',
        'Free Interval Computation: Detects gaps in lecture blocks (e.g. 12:30-14:00).',
        'Direct Admin Inline CRUD: Add, update or delete slots directly from table.',
        'Course & Faculty Legend: Resolves course codes (MA231TF) to faculty names.'
      ]
    },
    {
      title: '4. Canteen & Meal Budget Optimizer',
      c: 'ok',
      desc: 'Campus mess dining menus with dietary and financial filters',
      feats: [
        'Meal Filtering by Service: Breakfast, lunch, snacks, and dinner schedules.',
        'Nutritional & Dietary Preferences: Pure vegetarian filtering toggle.',
        'Budget Optimization Engine: Recommends two-item combos within student budget.',
        'Nutritional Estimation: Computes total calories and protein grams per combo.',
        'Direct Menu Management: Admin inline addition and item price adjustment.'
      ]
    },
    {
      title: '5. Faculty Directory & Cabin Finder',
      c: 'db',
      desc: 'Instant lookup for professors, cabins, office hours and subjects',
      feats: [
        'Fuzzy Trigram Search: pg_trgm similarity across faculty names and subjects.',
        'Cabin & Office Hours Lookup: Displays physical campus location of faculty.',
        'AI Faculty Recommendation: Synthesizes direct recommendation for inquiries.',
        'Direct Profile Editing: Admin updates cabin, designation and email inline.'
      ]
    },
    {
      title: '6. Governance, Observability & MCP',
      c: 'infra',
      desc: 'Enterprise operations, telemetry logging and agent protocol',
      feats: [
        'FastMCP HTTP Server: 14 tools exposed via Model Context Protocol.',
        'Audit Logging & Scope Revisions: Non-repudiation logging in audit_log.',
        'Startup Stuck-Job Sweeper: Recovers dangling jobs interrupted by reboots.',
        'Dual PostgreSQL Connection Pools: Physical separation of read and write traffic.',
        'Live Telemetry Dashboard: Database table sizes and recent query latencies.'
      ]
    }
  ];

  const colW = 492, gap = 16, x0 = 36;
  modules.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = x0 + col * (colW + gap);
    const y = 100 + row * 380;
    const k = C[m.c];

    b += `<rect x="${x}" y="${y}" width="${colW}" height="360" rx="12" fill="${k.f}" stroke="${k.s}" stroke-width="1.8"/>`;
    b += `<rect x="${x}" y="${y}" width="${colW}" height="54" rx="12" fill="${k.s}"/>`;
    b += `<rect x="${x}" y="${y + 40}" width="${colW}" height="14" fill="${k.s}"/>`;
    b += text(x + 18, y + 26, m.title, { size: 14.5, weight: 700, color: '#FFFFFF' });
    b += text(x + 18, y + 44, m.desc, { size: 11, color: '#F1F5F9' });

    m.feats.forEach((f, j) => {
      const fy = y + 74 + j * 46;
      const [bold, ...rest] = f.split(':');
      b += `<rect x="${x + 12}" y="${fy}" width="${colW - 24}" height="40" rx="6" fill="#FFFFFF" stroke="${k.s}" stroke-opacity="0.3"/>`;
      b += `<circle cx="${x + 24}" cy="${fy + 20}" r="4" fill="${k.s}"/>`;
      b += text(x + 36, fy + 18, bold + ':', { size: 11.5, weight: 700, color: '#0F172A' });
      b += text(x + 36, fy + 32, rest.join(':').trim(), { size: 10.5, color: '#475569' });
    });
  });

  return doc(1600, 890, 'Feature Architecture Map', 'Functional capabilities, sub-features and component relationships across the application', b, {
    legend: [['be', 'AI & Ingestion'], ['db', 'Domain Modules'], ['ok', 'Dining / Optimization'], ['infra', 'Governance & MCP']]
  });
}

function register(reg) {
  reg('04_PRODUCT_DEPLOYMENT/use_case_diagram', useCase);
  reg('04_PRODUCT_DEPLOYMENT/deployment_architecture', deployArch);
  reg('04_PRODUCT_DEPLOYMENT/feature_architecture', featArch);
}

module.exports = { register };
