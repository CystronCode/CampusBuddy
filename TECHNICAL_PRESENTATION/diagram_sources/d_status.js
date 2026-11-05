'use strict';
const { box, group, arrow, doc, text, pill, C, MONO, table } = require('./lib');

// 15. FEATURE IMPLEMENTATION MATRIX
function implMatrix() {
  let b = '';

  const cols = [
    { label: 'Feature / Capability Area', w: 340, mono: false },
    { label: 'Status', w: 170 },
    { label: 'Implemented Code Component', w: 320, mono: true },
    { label: 'Verified Implementation Details & Deviations', w: 698 },
  ];

  const rows = [
    { section: '1. Intelligent Querying & Chat Assistant' },
    ['Tier 0 Fast Path (Regex)', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/tier0_engine.py', 'Regex rules match timetable, mess menu, holidays without LLM overhead. Sub-millisecond execution.'],
    ['Tier 1 LLM Router', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/router_engine.py', 'Groq LPU (Qwen 27B) maps natural language queries to ToolCalls. 24h LRU router cache. Gemini Flash fallback.'],
    ['Tier 2 Hybrid RAG Search', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/rag_engine.py', 'Cosine similarity (>= 0.45) on pgvector(768) + tsvector English FTS combined via Reciprocal Rank Fusion (k=60).'],
    ['Streaming SSE Chat', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/v1_compat.py', 'POST /v1/chat/stream chunks pre-computed answer into 48-char SSE delta slices at 10ms intervals.'],
    ['Chat History Persistence', { t: 'PARTIAL / VOLATILE', c: 'part' }, 'app/routers/v1_compat.py', 'Stored in Python dict (_conversations, _messages) in process RAM. Lost on container restart.'],
    ['Query Logs Telemetry', { t: 'PARTIAL', c: 'part' }, 'app/routers/student_queries.py', 'Legacy /api/chat writes to query_logs table; active /v1/chat endpoint DOES NOT insert into query_logs.'],

    { section: '2. Multimodal Document Ingestion & Approval' },
    ['Magic-Byte Sniffing', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/uploads.py', 'Strict binary header verification (PDF, XLSX, DOCX, JPEG/PNG). Never trusts client-reported MIME or filename.'],
    ['Multimodal Table Extraction', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/ingestion_service.py', 'Gemini 3 Flash Vision converts document pages to structured JSON. Groq document parser fallback.'],
    ['Deterministic Validation', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/validators.py', 'Validates ISO days (1-7), time sequence (end > start), meal categories, confidence flags.'],
    ['Interactive Ingestion Grid', { t: 'IMPLEMENTED', c: 'ok' }, 'frontend-next/src/components/admin-view.tsx', 'Admin inspects extracted JSON preview, corrects cell values, retries failed jobs via PATCH/POST.'],
    ['Atomic Scope Publishing', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/approval.py', 'Commits records under version N+1, increments data_versions.rev, evicts (scope, rev) cache.'],
    ['Private Cloud S3 Storage', { t: 'NOT CONFIGURED', c: 'warn' }, 'app/routers/uploads.py', 'boto3 S3 client falls back to local disk (./uploads/) on Render container because S3 credentials are mock.'],

    { section: '3. Domain Modules & Operations' },
    ['Weekly Course Timetable', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/v1_compat.py', 'Cached domain slots filtered by branch, year, section. Legend maps course codes to faculty names.'],
    ['Next Class Countdown', { t: 'IMPLEMENTED', c: 'ok' }, 'app/services/time_engine.py', 'Calculates next lecture based on current Asia/Kolkata weekday and time against timetable_slots.'],
    ['Meal Budget Optimizer', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/v1_compat.py', 'GET /v1/meals computes pairs of menu items fitting under student budget limit with macros.'],
    ['Faculty Directory & Cabin', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/v1_compat.py', 'Trigram search on faculty name and subjects. Displays room/cabin, office hours, and email.'],
    ['Academic Calendar & Events', { t: 'IMPLEMENTED', c: 'ok' }, 'app/routers/v1_compat.py', 'Combines events table with holidays table. Auto-classifies CIE/SEE exam deadlines.'],
    ['External Integrations', { t: 'MOCK IMPLEMENTATION', c: 'warn' }, 'app/routers/v1_compat.py', 'Google Calendar & Gmail buttons simulate OAuth connect/sync and return static mock responses.'],
    ['FastMCP Agent Protocol', { t: 'IMPLEMENTED (OPEN)', c: 'part' }, 'app/mcp_server.py', '14 FastMCP tools exposed via streamable HTTP. 12 active, 2 stubs (detect_conflicts, search_emails). NO AUTH.'],
  ];

  b += table(36, 110, cols, rows, { rh: 29, hh: 36, fs: 11 });

  return doc(1600, 890, 'Feature Implementation Matrix', 'Implementation audit of all system capabilities: Implemented vs Partial vs Mock vs Missing', b, {
    legend: [['ok', 'Fully Implemented'], ['part', 'Partial / In-Memory / Open'], ['warn', 'Mock / Not Configured'], ['gray', 'Section Header']]
  });
}

// 16. CURRENT ARCHITECTURE LIMITATIONS
function limitations() {
  let b = '';

  const issues = [
    {
      title: '1. In-Memory Volatility & Stateless Backend Mismatch',
      c: 'warn',
      tag: 'DATA LOSS RISK',
      points: [
        'Chat History Lost on Reboot: Conversations and message history (_conversations, _messages) live exclusively in Python process memory dictionaries.',
        'User Preference Drift: Custom student department/semester overrides saved via PATCH /v1/me exist only in _user_prefs RAM dict.',
        'No Distributed Cache: cachetools LRU cache is process-local. Multiple backend instances would serve stale scope revisions.'
      ]
    },
    {
      title: '2. Ephemeral Container Storage on Render Free Tier',
      c: 'warn',
      tag: 'STORAGE BOTTLENECK',
      points: [
        'Local Disk Uploads: Documents uploaded via /v1/ingestion/preview are saved to local ./uploads directory inside the Render container.',
        'Redeploy Wipes Source Files: On container spin-down or new deployment, all previously uploaded PDFs/XLSX files are permanently erased.',
        'Re-indexing Failure: POST /v1/ingestion/{id}/retry fails with 410 Gone once the ephemeral container is recycled.'
      ]
    },
    {
      title: '3. Token Verification Gap in /v1 Compatibility Bridge',
      c: 'warn',
      tag: 'PRIVILEGE ESCALATION',
      points: [
        'Unverified JWT Claims: v1_compat.py calls jwt.decode(token, verify_signature=False) to extract user_id and role.',
        'Forged Admin Privilege: Any client can craft a local token claiming role: institution_admin to access restricted ingestion endpoints.',
        'Disconnect from Middleware: SessionSecurityMiddleware is explicitly bypassed for all /v1/* endpoints to support client headers.'
      ]
    },
    {
      title: '4. Model Context Protocol (FastMCP) Security Gap',
      c: 'warn',
      tag: 'UNPROTECTED SURFACE',
      points: [
        'Unauthenticated /mcp Mount: app.mount("/mcp", ...) has no authentication barrier, session check or API key validation.',
        'Direct Data Exfiltration: Any party with network access to the API can invoke get_my_timetable, search_canteen_items, or search_documents.',
        'Unimplemented Tool Stubs: detect_schedule_conflicts and search_authorized_emails return hardcoded empty arrays [].'
      ]
    },
    {
      title: '5. Single-Tenant Database & Hardcoded Scopes',
      c: 'part',
      tag: 'SCALABILITY BOUNDARY',
      points: [
        'Hardcoded Tenant ID: All /v1 requests use constant DEFAULT_TENANT_ID ("00000000-0000-4000-8000-000000000001").',
        'RVCE Scopes Hard-Coded: Default timetable scope is fixed to timetable:CSE-3-A in multiple routers.',
        'Static Legend Fallback: Course code mappings (e.g. MA231TF) are hardcoded in Python dictionaries rather than dynamic DB tables.'
      ]
    },
    {
      title: '6. Free-Tier Rate Limits & Cold Start Hibernation',
      c: 'part',
      tag: 'LATENCY BOTTLENECK',
      points: [
        'Render Cold Starts: Free tier spins down after 15 minutes of inactivity; GitHub Actions ping (every 10 min) mitigates but cannot eliminate.',
        'Groq Rate Limit Protection: Inference capped at 950 tokens to respect Groq on-demand tier limits (1000 OTPM).',
        'Supavisor Pool Limit: Database pools restricted to max_size=5 to avoid exceeding Supabase free-tier connection thresholds.'
      ]
    }
  ];

  const colW = 750, gap = 20, x0 = 36;
  issues.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = x0 + col * (colW + gap);
    const y = 100 + row * 255;
    const k = C[it.c];

    b += `<rect x="${x}" y="${y}" width="${colW}" height="240" rx="12" fill="${k.f}" stroke="${k.s}" stroke-width="1.8"/>`;
    b += `<rect x="${x}" y="${y}" width="${colW}" height="42" rx="12" fill="${k.s}"/>`;
    b += `<rect x="${x}" y="${y + 30}" width="${colW}" height="12" fill="${k.s}"/>`;
    b += text(x + 16, y + 26, it.title, { size: 14, weight: 700, color: '#FFFFFF' });
    b += pill(x + colW - 12, y + 8, it.tag, 'warn', { size: 9, anchor: 'end' });

    it.points.forEach((pt, j) => {
      const py = y + 58 + j * 58;
      const [bold, ...rest] = pt.split(':');
      b += `<rect x="${x + 12}" y="${py}" width="${colW - 24}" height="50" rx="6" fill="#FFFFFF" stroke="${k.s}" stroke-opacity="0.3"/>`;
      b += `<circle cx="${x + 24}" cy="${py + 16}" r="4" fill="${k.s}"/>`;
      b += text(x + 36, py + 18, bold + ':', { size: 12, weight: 700, color: '#0F172A' });
      
      const words = rest.join(':').trim().split(' ');
      let line = '', lineY = py + 34;
      for (const w of words) {
        if ((line + w).length > 76) {
          b += text(x + 36, lineY, line, { size: 11, color: '#334155' });
          lineY += 15;
          line = w + ' ';
        } else {
          line += w + ' ';
        }
      }
      if (line) b += text(x + 36, lineY, line, { size: 11, color: '#334155' });
    });
  });

  return doc(1600, 910, 'Current Architecture Limitations & Known Gaps', 'Technical debt, performance bottlenecks, storage volatility and security risks verified in codebase', b, {
    legend: [['warn', 'High Impact / Risk'], ['part', 'Medium Impact / Scalability Constraint']]
  });
}

function register(reg) {
  reg('05_PROJECT_STATUS/feature_implementation_matrix', implMatrix);
  reg('05_PROJECT_STATUS/architecture_limitations', limitations);
}

module.exports = { register };
