'use strict';
const { box, group, arrow, doc, text, pill, sequence, C, MONO } = require('./lib');

// 4. DATA FLOW DIAGRAM
function dfd() {
  let b = '';
  const lane = (y, t) => text(40, y, t, { size: 12.5, weight: 800, color: '#64748B' });
  b += lane(104, 'WRITE PATH — document ingestion (institution admin)');
  b += lane(410, 'STORAGE');
  b += lane(606, 'READ PATH — questions and browsing (student / admin)');

  // write lane
  b += box({ x: 40, y: 120, w: 200, h: 110, title: 'Admin file upload', c: 'gray', ls: 11.5, lines: ['PDF · XLSX · DOCX · image', 'kind: timetable / menu /', 'holidays / faculty'] });
  b += box({ x: 290, y: 120, w: 230, h: 110, title: '1 · Intake', c: 'be', ls: 11.5, lines: ['POST /v1/ingestion/preview', 'Magic-byte MIME sniff', 'SHA-256 · UUID storage key'] });
  b += box({ x: 570, y: 120, w: 250, h: 110, title: '2 · AI extraction', c: 'be', ls: 11.5, lines: ['FastAPI BackgroundTask', 'Text parse (pdfplumber/openpyxl/docx)', 'Structured JSON + normalisation'] });
  b += box({ x: 870, y: 120, w: 230, h: 110, title: '3 · Review & edit', c: 'be', ls: 11.5, lines: ['UI polls GET /v1/ingestion', 'PATCH …/{id}/records', 'POST …/{id}/retry'] });
  b += box({ x: 1150, y: 120, w: 410, h: 110, title: '4 · Publish  (POST …/{id}/confirm → approve_submission)', c: 'be', ts: 13.5, ls: 11.5, lines: ['Insert rows under a new version · validators', 'syllabus/notice: chunk + embed (768-d) → doc_chunks', 'Bump data_versions · evict scope cache'] });
  b += box({ x: 590, y: 250, w: 200, h: 44, title: 'Gemini (Groq fallback)', c: 'ext', ts: 12.5, align: 'center' });
  b += arrow([[240, 175], [290, 175]], { c: 'gray' });
  b += arrow([[520, 175], [570, 175]], { c: 'be' });
  b += arrow([[820, 175], [870, 175]], { c: 'be' });
  b += arrow([[1100, 175], [1150, 175]], { c: 'be' });
  b += arrow([[690, 230], [690, 250]], { c: 'ext', both: true });

  // storage band
  b += box({ x: 290, y: 425, w: 230, h: 110, title: 'files + ./uploads', c: 'db', tag: 'DISK EPHEMERAL', ls: 11.5, lines: ['files: metadata, sha256', './uploads: raw bytes (local)'] });
  b += box({ x: 570, y: 425, w: 530, h: 110, title: 'submissions', c: 'db', ls: 11.5, lines: ['status: processing → draft / pending_review → approved | rejected | failed', 'extracted JSONB (records) · confidence JSONB (validation flags)', 'error · reviewer · published version'] });
  b += box({ x: 1150, y: 425, w: 150, h: 110, title: 'Domain tables', c: 'db', ts: 13.5, ls: 11, lines: ['timetable_slots', 'menu_items · faculty', 'holidays · events'] });
  b += box({ x: 1310, y: 425, w: 120, h: 110, title: 'doc_chunks', c: 'db', ts: 13.5, ls: 11, lines: ['vector(768)', 'tsvector FTS'] });
  b += box({ x: 1440, y: 425, w: 120, h: 110, title: 'data_versions', c: 'db', ts: 13, ls: 11, lines: ['scope →', 'active_version', 'rev'] });
  b += arrow([[405, 230], [405, 425]], { c: 'db', label: 'file bytes', ly: 330 });
  b += arrow([[500, 230], [500, 320], [610, 320], [610, 425]], { c: 'db', label: 'status = processing', lx: 555, ly: 360 });
  b += arrow([[805, 230], [805, 425]], { c: 'db', label: 'extracted JSONB', ly: 370 });
  b += arrow([[985, 230], [985, 425]], { c: 'db', label: 'edited records', ly: 330 });
  b += arrow([[1225, 230], [1225, 425]], { c: 'db', label: 'rows v+1', ly: 300 });
  b += arrow([[1370, 230], [1370, 425]], { c: 'db', label: 'chunks', ly: 340 });
  b += arrow([[1500, 230], [1500, 425]], { c: 'db', label: 'version++', ly: 380 });
  // inline edits
  b += box({ x: 40, y: 425, w: 200, h: 110, title: 'Admin inline edits', c: 'gray', ls: 11.5, lines: ['Browse view (admin)', 'timetable · menu · faculty', 'POST / PATCH / DELETE'] });
  b += arrow([[240, 480], [262, 480], [262, 562], [1205, 562], [1205, 535]], { c: 'db', label: 'direct row write + data_versions.rev++', lx: 470, ly: 562 });

  // read lane
  b += box({ x: 40, y: 625, w: 200, h: 100, title: 'Question', c: 'gray', ls: 11.5, lines: ['Chat input', 'POST /v1/chat/stream'] });
  b += box({ x: 290, y: 625, w: 230, h: 100, title: 'Route', c: 'be', ls: 11.5, lines: ['Tier 0: regex rules', 'else LLM router → tool calls', '24 h router cache'] });
  b += box({ x: 570, y: 625, w: 250, h: 225, title: 'Data access', c: 'be', ls: 11.5, lines: ['tool_executor', 'cache_service: rows by', '  (scope, active_version, rev)', 'rag_engine: hybrid search', '  pgvector cosine ≥ 0.45 + FTS', '  (query embedded via Gemini)', 'Browse handlers format JSON'] });
  b += box({ x: 870, y: 625, w: 230, h: 100, title: 'Synthesise', c: 'be', ls: 11.5, lines: ['LLM text for faculty + docs', 'Templated text for timetable,', 'menu, holidays, events'] });
  b += box({ x: 1150, y: 670, w: 190, h: 60, title: 'Conversations', c: 'warn', dashed: true, tag: 'IN-MEMORY', ts: 13.5, ls: 11, lines: ['Python dict, not persisted'] });
  b += box({ x: 1380, y: 610, w: 180, h: 110, title: 'Chat answer', c: 'fe', ls: 11.5, lines: ['SSE delta chunks', '+ result: text, records,', 'sources, follow-ups'] });
  b += box({ x: 40, y: 770, w: 200, h: 80, title: 'Browse / dashboard', c: 'gray', ls: 11.5, lines: ['GET /v1/overview, timetable,', 'menu, faculty, events …'] });
  b += box({ x: 1380, y: 770, w: 180, h: 80, title: 'Views rendered', c: 'fe', ls: 11.5, lines: ['Dashboard · Browse', 'Admin monitor'] });
  b += box({ x: 300, y: 745, w: 210, h: 40, title: 'Groq → Gemini fallback', c: 'ext', ts: 12, align: 'center' });
  b += box({ x: 880, y: 745, w: 210, h: 40, title: 'Groq → Gemini fallback', c: 'ext', ts: 12, align: 'center' });
  b += arrow([[240, 675], [290, 675]], { c: 'gray' });
  b += arrow([[520, 675], [570, 675]], { c: 'be' });
  b += arrow([[820, 675], [870, 675]], { c: 'be' });
  b += arrow([[1100, 640], [1380, 640]], { c: 'fe', label: 'SSE stream', lx: 1240, ly: 640 });
  b += arrow([[1100, 700], [1150, 700]], { c: 'warn' });
  b += arrow([[405, 725], [405, 745]], { c: 'ext', both: true });
  b += arrow([[985, 725], [985, 745]], { c: 'ext', both: true });
  b += arrow([[240, 810], [570, 810]], { c: 'gray', label: 'no LLM', lx: 405, ly: 810 });
  b += arrow([[820, 815], [1380, 815]], { c: 'fe', label: 'JSON', lx: 1240, ly: 815 });
  b += arrow([[1180, 535], [1180, 582], [745, 582], [745, 625]], { c: 'db', dashed: true });
  b += arrow([[1370, 535], [1370, 596], [785, 596], [785, 625]], { c: 'db', dashed: true, label: 'reads (read-only pool)', lx: 1010, ly: 596 });
  b += `<rect x="1150" y="745" width="190" height="16" fill="none"/>`;
  b += text(1245, 760, 'Note: /v1 chat does not write query_logs', { size: 10.5, color: '#7F1D1D', anchor: 'middle', italic: true });
  return doc(1600, 960, 'Data Flow Diagram', 'How data enters, is processed, stored and served — /v1 code paths used by the active UI', b, {
    legend: [['gray', 'External actor'], ['be', 'Process'], ['db', 'Data store / write'], ['ext', 'External AI service'], ['fe', 'Output'], ['warn', 'Volatile store', true]] });
}

// 5. END-TO-END WORKFLOW (swimlanes)
function e2e() {
  let b = '';
  const lanes = [['Users', 'gray'], ['Next.js UI', 'fe'], ['FastAPI /v1', 'be'], ['Background task', 'be'], ['AI services', 'ext'], ['PostgreSQL / disk', 'db']];
  const LY = 100, LH = 118, X0 = 170, CW = 128, BW = 118, BH = 84;
  lanes.forEach(([n, c], i) => {
    const y = LY + i * LH, k = C[c];
    b += `<rect x="36" y="${y}" width="1528" height="${LH}" fill="${i % 2 ? '#FFFFFF' : '#F8FAFC'}" stroke="#E2E8F0"/>`;
    b += `<rect x="36" y="${y}" width="124" height="${LH}" fill="${k.f}" stroke="${k.s}" stroke-opacity="0.4"/>`;
    b += text(98, y + LH / 2 + 5, n, { size: 13, weight: 700, color: k.t, anchor: 'middle' });
  });
  const P = {};
  const step = (id, col, ln, n, title, lines, c) => {
    const x = X0 + col * CW, y = LY + ln * LH + (LH - BH) / 2;
    P[id] = { x, y, cx: x + BW / 2, cy: y + BH / 2, r: x + BW, b: y + BH };
    b += box({ x, y, w: BW, h: BH, title, lines, c: c || lanes[ln][1], ts: 11.5, ls: 10.5 });
    b += `<circle cx="${x + 4}" cy="${y + 2}" r="11" fill="#0F172A"/>` + text(x + 4, y + 6, n, { size: 11, weight: 700, color: '#fff', anchor: 'middle' });
  };
  step('a', 0, 0, '1', 'Admin', ['chooses file', '+ data kind'], 'gray');
  step('b', 1, 1, '2', 'Upload', ['POST /v1/', 'ingestion/', 'preview'], 'fe');
  step('c', 2, 2, '3', 'Intake', ['sniff MIME,', 'sha256, save', 'to ./uploads'], 'be');
  step('c2', 2, 5, '3b', 'INSERT', ['files +', 'submissions', '(processing)'], 'db');
  step('d', 3, 3, '4', 'Extraction', ['enqueue_', 'extraction_', 'task()'], 'be');
  step('e', 4, 4, '5', 'Gemini', ['vision / text', '→ JSON', '(Groq fallback)'], 'ext');
  step('f', 5, 5, '6', 'UPDATE', ['submissions', 'extracted +', 'status'], 'db');
  step('g', 6, 1, '7', 'Review', ['polls jobs;', 'admin edits', 'records'], 'fe');
  step('h', 7, 2, '8', 'Confirm', ['POST …/', 'confirm →', 'approve'], 'be');
  step('i', 8, 4, '9', 'Embed', ['doc chunks', '(syllabus /', 'notice only)'], 'ext');
  step('j', 8, 5, '9b', 'Publish', ['rows v+1,', 'doc_chunks,', 'versions++'], 'db');
  step('k', 9, 0, '10', 'Student', ['asks a', 'question'], 'gray');
  step('l', 9, 1, '11', 'Chat', ['POST /v1/', 'chat/stream'], 'fe');
  step('m', 10, 2, '12', 'Answer', ['tier0/router', '→ tools read', 'new version'], 'be');
  step('n', 10, 5, '12b', 'Read', ['cache by', '(scope, rev)', 'read pool'], 'db');
  step('o', 10, 1, '13', 'Render', ['SSE text +', 'result cards'], 'fe');

  const el = (a, z, c = 'gray', o = {}) => {
    const A = P[a], Z = P[z];
    if (Math.abs(A.cx - Z.cx) < 2) { // same column vertical
      const down = Z.y > A.y;
      b += arrow([[A.cx + (o.dx || 0), down ? A.b : A.y], [Z.cx + (o.dx || 0), down ? Z.y : Z.b]], { c, dashed: o.dashed, both: o.both });
    } else {
      const mx = A.r + 5;
      b += arrow([[A.r, A.cy], [mx, A.cy], [mx, Z.cy], [Z.x, Z.cy]], { c, dashed: o.dashed });
    }
  };
  el('a', 'b'); el('b', 'c', 'fe'); el('c', 'c2', 'db'); el('c', 'd', 'be'); el('d', 'e', 'ext');
  el('e', 'f', 'db'); el('f', 'g', 'fe', { dashed: true }); el('g', 'h', 'fe'); el('h', 'i', 'ext');
  el('i', 'j', 'db'); el('j', 'k', 'gray', { dashed: true });
  el('k', 'l'); el('l', 'm', 'fe'); el('m', 'n', 'db', { both: true }); el('m', 'o', 'fe');
  // notes
  const ny = LY + 6 * LH + 16;
  b += `<rect x="36" y="${ny}" width="1528" height="62" rx="8" fill="#FEFCE8" stroke="#CA8A04"/>`;
  b += text(52, ny + 22, 'Verified details:  step 2 returns immediately (status "processing"); step 7 polls GET /v1/ingestion every few seconds while any job is processing; step 8 requires role institution_admin', { size: 12, color: '#713F12' });
  b += text(52, ny + 44, 'as resolved from the (unverified) bearer token; step 9 embeds only syllabus/notice documents; steps 10–13 read through the read-only pool and the (scope, rev) cache, so published data is visible immediately.', { size: 12, color: '#713F12' });
  return doc(1600, ny + 62 + 75, 'End-to-End Workflow', 'From an administrator uploading a document to a student receiving an answer built on that data', b, { legend: [['gray', 'User action'], ['fe', 'UI'], ['be', 'Backend'], ['ext', 'AI service'], ['db', 'Persistence']] });
}

// 6. SEQUENCE DIAGRAMS
const SEQ = {};
SEQ.login = () => sequence(1600, 'Sequence · Sign-in (active /v1 path)', 'frontend-next login form → POST /v1/auth/login → token in localStorage → bearer on every request',
  [{ id: 'u', label: 'User', sub: 'browser', c: 'gray' }, { id: 'ui', label: 'Next.js UI', sub: 'campus-app.tsx', c: 'fe' }, { id: 'api', label: 'FastAPI /v1', sub: 'v1_compat.py', c: 'be' }, { id: 'sb', label: 'Supabase Auth', sub: 'optional fallback', c: 'ext' }, { id: 'db', label: 'PostgreSQL', sub: 'not consulted', c: 'db' }],
  [
    { f: 'u', t: 'ui', l: 'enter email + password (zod-validated form)', n: '1' },
    { f: 'ui', t: 'api', l: 'POST /v1/auth/login {email, password}', n: '2' },
    { f: 'api', t: 'api', l: 'compare against hard-coded demo accounts / e-mail patterns' },
    { note: ['No database lookup and no password hashing: accounts are defined in code', '(student@… / admin@…, or any e-mail containing "student"/"admin" with a demo password)'], f: 'api', t: 'db', c: 'warn', nh: 44 },
    { f: 'api', t: 'api', l: 'sign HS256 JWT {sub, email, role, name} · exp 14 days' },
    { f: 'api', t: 'ui', l: '200 {session: {access_token, refresh_token(=same), user}}', ret: true, n: '3' },
    { f: 'ui', t: 'ui', l: 'localStorage["campusos_session"] = session' },
    { frame: 'alt  backend unreachable OR non-@campus.edu.in e-mail rejected', c: 'ext' },
    { f: 'ui', t: 'sb', l: 'supabase.auth.signInWithPassword() (only if env configured)', n: '4', c: 'ext' },
    { f: 'sb', t: 'ui', l: 'Supabase session', ret: true },
    { endframe: true },
    { f: 'ui', t: 'api', l: 'GET /v1/memberships, GET /v1/me  — Authorization: Bearer <token>, X-Tenant-ID', n: '5' },
    { f: 'api', t: 'api', l: '_resolve_v1_user(): jwt.decode(verify_signature=False)' },
    { f: 'api', t: 'ui', l: 'profile {role: student | institution_admin, tenant_id: constant}', ret: true },
  ], { legend: [['fe', 'UI'], ['be', 'Backend'], ['ext', 'External'], ['warn', 'Security note']] });

SEQ.chat = () => sequence(1600, 'Sequence · Ask a question (chat streaming)', 'POST /v1/chat/stream — three-tier query engine; answer fully computed, then streamed as SSE chunks',
  [{ id: 'ui', label: 'Next.js UI', sub: 'chat-view.tsx', c: 'fe' }, { id: 'api', label: 'FastAPI /v1', sub: '_process_v1_chat', c: 'be' }, { id: 'eng', label: 'Query services', sub: 'tier0 · router · tools', c: 'be' }, { id: 'llm', label: 'Groq / Gemini', sub: 'LLM + embeddings', c: 'ext' }, { id: 'db', label: 'PostgreSQL', sub: 'read pool', c: 'db' }],
  [
    { f: 'ui', t: 'api', l: 'POST /v1/chat/stream {question, conversation_id}', n: '1' },
    { f: 'api', t: 'api', l: 'create conversation in in-memory dict if new' },
    { f: 'api', t: 'eng', l: 'match_tier0_rule(question)', n: '2' },
    { frame: 'alt  Tier 0 regex hit (menu / timetable / holidays …)', c: 'ok' },
    { f: 'eng', t: 'db', l: 'execute_tool → cached rows by (scope, active_version, rev)', n: '3' },
    { f: 'db', t: 'eng', l: 'rows', ret: true },
    { endframe: true },
    { frame: 'else  Tier 1 — LLM router', c: 'be' },
    { f: 'eng', t: 'llm', l: 'route_student_query → Groq (Gemini fallback), 24 h cache', n: '4' },
    { f: 'llm', t: 'eng', l: 'ToolCalls [get_timetable, search_menu, get_faculty, search_docs …]', ret: true },
    { f: 'eng', t: 'db', l: 'asyncio.gather(execute_tool …) — structured reads', n: '5' },
    { f: 'eng', t: 'llm', l: 'search_docs: embed query (Gemini) ', n: '6' },
    { f: 'eng', t: 'db', l: 'hybrid search: pgvector cosine ≥ 0.45 ∪ FTS → RRF top 3' },
    { f: 'eng', t: 'llm', l: 'synthesise answer (faculty / docs only)', n: '7' },
    { f: 'llm', t: 'eng', l: 'answer text', ret: true },
    { endframe: true },
    { f: 'eng', t: 'api', l: '{answer, kind, records, sources, follow-ups}', ret: true },
    { f: 'api', t: 'api', l: 'append user + assistant messages to in-memory store' },
    { f: 'api', t: 'ui', l: 'SSE  event: delta  (48-char slices, 10 ms apart)', ret: true, n: '8' },
    { f: 'api', t: 'ui', l: 'SSE  event: result  (full JSON payload)', ret: true },
    { f: 'ui', t: 'ui', l: 'render text + result cards (result-cards.tsx)' },
  ], { stepH: 40, legend: [['fe', 'UI'], ['be', 'Backend'], ['ext', 'AI service'], ['db', 'Database']] });

SEQ.ingest = () => sequence(1600, 'Sequence · Document ingestion and publish', 'Admin upload → background AI extraction → review → confirm (approve_submission)',
  [{ id: 'ui', label: 'Admin UI', sub: 'admin-view.tsx', c: 'fe' }, { id: 'api', label: 'FastAPI /v1', sub: 'ingestion endpoints', c: 'be' }, { id: 'bg', label: 'BackgroundTask', sub: 'ingestion_service', c: 'be' }, { id: 'ai', label: 'Gemini / Groq', sub: 'extraction · embed', c: 'ext' }, { id: 'db', label: 'PostgreSQL + disk', sub: 'write pool · ./uploads', c: 'db' }],
  [
    { f: 'ui', t: 'api', l: 'POST /v1/ingestion/preview (multipart file, options.kind)', n: '1' },
    { f: 'api', t: 'api', l: '_require_admin · sniff_mime_type · sha256' },
    { f: 'api', t: 'db', l: 'write ./uploads/<uuid>.<ext> · INSERT files · INSERT submissions(processing)', n: '2' },
    { f: 'api', t: 'bg', l: 'background_tasks.add_task(enqueue_extraction_task)', n: '3' },
    { f: 'api', t: 'ui', l: 'job {status: processing}', ret: true },
    { f: 'bg', t: 'ai', l: 'extract structured JSON (vision or parsed text); Groq fallback', n: '4' },
    { f: 'ai', t: 'bg', l: 'records', ret: true },
    { f: 'bg', t: 'db', l: 'UPDATE submissions SET extracted, confidence, status', n: '5' },
    { frame: 'loop  while any job is processing', c: 'gray' },
    { f: 'ui', t: 'api', l: 'GET /v1/ingestion', n: '6' },
    { f: 'api', t: 'ui', l: 'last 25 submissions as jobs', ret: true },
    { endframe: true },
    { f: 'ui', t: 'api', l: 'PATCH /v1/ingestion/{id}/records (optional edits)', n: '7' },
    { f: 'ui', t: 'api', l: 'POST /v1/ingestion/{id}/confirm', n: '8' },
    { f: 'api', t: 'api', l: 'sanitise rows · approve_submission() (shared with /api)' },
    { f: 'api', t: 'db', l: 'INSERT versioned domain rows · data_versions++ · status approved', n: '9' },
    { frame: 'opt  syllabus / notice / faculty raw text', c: 'ext' },
    { f: 'api', t: 'ai', l: 'generate_l2_normalized_embeddings(chunks)', n: '10' },
    { f: 'api', t: 'db', l: 'INSERT doc_chunks (vector 768, tsvector generated)' },
    { endframe: true },
    { f: 'api', t: 'api', l: 'evict_scope_cache(scope)' },
    { f: 'api', t: 'ui', l: 'job {status: approved, imported_count}', ret: true },
  ], { stepH: 40, legend: [['fe', 'UI'], ['be', 'Backend'], ['ext', 'AI service'], ['db', 'Persistence']] });

SEQ.browse = () => sequence(1600, 'Sequence · Browse & admin inline edit (timetable)', 'GET /v1/timetable served from the (scope, rev) cache; admin edits bump rev and invalidate implicitly',
  [{ id: 'ui', label: 'Next.js UI', sub: 'browse-view.tsx', c: 'fe' }, { id: 'api', label: 'FastAPI /v1', sub: 'timetable endpoints', c: 'be' }, { id: 'cache', label: 'cache_service', sub: 'in-process dict', c: 'be' }, { id: 'rd', label: 'PostgreSQL', sub: 'read pool (app_read)', c: 'db' }, { id: 'wr', label: 'PostgreSQL', sub: 'write pool (app_write)', c: 'db' }],
  [
    { f: 'ui', t: 'api', l: 'GET /v1/timetable', n: '1' },
    { f: 'api', t: 'cache', l: 'get_cached_scope_rows("timetable", "timetable:CSE-3-A")', n: '2' },
    { f: 'cache', t: 'rd', l: 'SELECT active_version, rev FROM data_versions WHERE scope=…', n: '3' },
    { f: 'rd', t: 'cache', l: 'version, rev', ret: true },
    { frame: 'alt  cache miss for (scope, rev)', c: 'gray' },
    { f: 'cache', t: 'rd', l: 'SELECT rows WHERE scope=… AND version=active', n: '4' },
    { f: 'rd', t: 'cache', l: 'rows (stored under key (scope, rev))', ret: true },
    { endframe: true },
    { f: 'cache', t: 'api', l: 'rows', ret: true },
    { f: 'api', t: 'ui', l: 'formatted slots (legend fallback for subject / faculty names)', ret: true },
    { note: 'Admin only (role institution_admin from bearer claims)', f: 'ui', t: 'api', c: 'part', nh: 28 },
    { f: 'ui', t: 'api', l: 'PATCH /v1/timetable/{slot_id} {subject, room, …}', n: '5' },
    { f: 'api', t: 'wr', l: 'UPDATE timetable_slots · UPDATE data_versions SET rev = rev + 1', n: '6' },
    { f: 'wr', t: 'api', l: 'updated row', ret: true },
    { f: 'api', t: 'ui', l: 'formatted slot — next read sees new rev → cache miss → fresh rows', ret: true },
  ], { legend: [['fe', 'UI'], ['be', 'Backend'], ['db', 'Database'], ['part', 'Note']] });

SEQ.otp = () => sequence(1600, 'Sequence · Legacy OTP sign-in (/api — implemented, not used by active UI)', 'E-mail OTP → HttpOnly cookie + CSRF token → SessionSecurityMiddleware on every /api request',
  [{ id: 'ui', label: 'Legacy Vite SPA', sub: 'frontend/', c: 'gray' }, { id: 'mw', label: 'Middleware', sub: 'SessionSecurity', c: 'be' }, { id: 'api', label: 'FastAPI /api/auth', sub: 'auth_service', c: 'be' }, { id: 'rs', label: 'Resend API', sub: 'e-mail', c: 'ext' }, { id: 'db', label: 'PostgreSQL', sub: 'users · auth_otps', c: 'db' }],
  [
    { f: 'ui', t: 'api', l: 'POST /api/auth/otp/request {email}  (path exempt from middleware)', n: '1' },
    { f: 'api', t: 'db', l: 'INSERT auth_otps (HMAC-SHA256 code hash, expires +10 min)', n: '2' },
    { f: 'api', t: 'rs', l: 'send code (mock key → code only logged)', n: '3' },
    { f: 'ui', t: 'api', l: 'POST /api/auth/otp/verify {email, code}', n: '4' },
    { f: 'api', t: 'db', l: 'SELECT … FOR UPDATE · attempts++ (max 5) · consume · upsert user', n: '5' },
    { f: 'api', t: 'ui', l: 'Set-Cookie campus_session (HttpOnly, SameSite=Lax, path=/api, 7 d) + csrf_token', ret: true, n: '6' },
    { f: 'ui', t: 'mw', l: 'POST /api/uploads  (cookie + X-CSRF-Token)', n: '7' },
    { f: 'mw', t: 'mw', l: 'Origin allow-list · jwt.decode HS256 (signature verified)' },
    { f: 'mw', t: 'db', l: 'privileged / mutating route: re-read user, compare token_version', n: '8' },
    { f: 'mw', t: 'mw', l: 'verify CSRF HMAC(user_id:token_version) · set request.state.user' },
    { f: 'mw', t: 'api', l: 'forward to router → role checks (student / club / staff / admin)', n: '9' },
  ], { legend: [['gray', 'Legacy client'], ['be', 'Backend'], ['ext', 'External'], ['db', 'Database']] });

// 7. API ARCHITECTURE
function apiArch() {
  let b = '';
  const MC = { GET: 'ok', POST: 'be', PATCH: 'part', DELETE: 'warn', HEAD: 'gray', TOOL: 'infra' };
  const colBlock = (x, y, w, title, c, sub, rows) => {
    const h = 52 + rows.length * 22 + 8;
    b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C[c].f}" stroke="${C[c].s}" stroke-width="1.5"/>`;
    b += text(x + 14, y + 22, title, { size: 14, weight: 700, color: C[c].t });
    b += text(x + 14, y + 40, sub, { size: 11, color: '#64748B', italic: true });
    rows.forEach((r, i) => {
      const ry = y + 52 + i * 22;
      const [m, p, note, flag] = r;
      b += pill(x + 12, ry, m, MC[m] || 'gray', { size: 9 });
      b += text(x + 74, ry + 13, p, { size: 11.5, color: '#0F172A', font: MONO });
      if (note) b += text(x + w - 12, ry + 13, note, { size: 10.5, color: flag ? C[flag].s : '#64748B', anchor: 'end', weight: flag ? 700 : 400 });
    });
    return y + h + 14;
  };
  // Column 1: /v1 user-facing
  let y = 100;
  y = colBlock(36, y, 500, '/v1 · Session & profile', 'be', 'No server-side token verification on /v1', [
    ['POST', '/v1/auth/login', 'hard-coded demo accounts', 'warn'], ['GET', '/v1/memberships', 'constant tenant'], ['GET', '/v1/me', 'from token claims'], ['PATCH', '/v1/me', 'in-memory only', 'warn']]);
  y = colBlock(36, y, 500, '/v1 · Dashboard & browse (read)', 'be', 'cache_service → read pool', [
    ['GET', '/v1/overview', 'next class, notices, events'], ['GET', '/v1/timetable', 'default scope CSE-3-A'], ['GET', '/v1/menu', 'budget / veg filters'], ['GET', '/v1/meals', 'combos ≤ budget'],
    ['GET', '/v1/faculty', ''], ['GET', '/v1/events', 'events + holidays'], ['GET', '/v1/notices', 'derived from holidays', 'part'], ['GET', '/v1/calendar', 'free slots hard-coded', 'warn']]);
  y = colBlock(36, y, 500, '/v1 · Chat', 'be', 'three-tier query engine', [
    ['POST', '/v1/chat', 'JSON answer'], ['POST', '/v1/chat/stream', 'SSE (delta + result)'], ['GET', '/v1/conversations', 'in-memory', 'warn'], ['GET', '/v1/conversations/{id}', 'no owner check', 'warn'], ['DELETE', '/v1/conversations/{id}', 'no owner check', 'warn']]);

  // Column 2: /v1 admin + mock
  y = 100;
  y = colBlock(552, y, 500, '/v1 · Admin (guarded by _require_admin)', 'be', 'role == institution_admin, taken from unverified claims', [
    ['POST', '/v1/timetable', 'write pool'], ['PATCH', '/v1/timetable/{slot_id}', 'rev++'], ['DELETE', '/v1/timetable/{slot_id}', 'rev++'], ['POST', '/v1/menu', ''], ['DELETE', '/v1/menu/{item_id}', ''], ['PATCH', '/v1/faculty/{faculty_id}', ''],
    ['GET', '/v1/ingestion', 'last 25 jobs'], ['POST', '/v1/ingestion/preview', 'multipart → background'], ['POST', '/v1/ingestion/{id}/retry', 'reads ./uploads'], ['PATCH', '/v1/ingestion/{id}/records', ''], ['POST', '/v1/ingestion/{id}/confirm', 'approve + embed'],
    ['GET', '/v1/admin/system', 'test counts hard-coded', 'part'], ['GET', '/v1/admin/memberships', 'static list', 'warn']]);
  y = colBlock(552, y, 500, '/v1 · Unguarded / mock', 'warn', 'no role check', [
    ['GET', '/v1/integrations', 'mock state', 'warn'], ['POST', '/v1/integrations/{p}/connect', 'mock', 'warn'], ['POST', '/v1/integrations/{p}/sync', 'returns fixed "5"', 'warn'], ['DELETE', '/v1/integrations/{p}', 'mock', 'warn'], ['GET', '/v1/sources/{id}', 'raw file download']]);
  y = colBlock(552, y, 500, 'Called by UI but NOT implemented in backend', 'warn', 'found in admin-view.tsx; no matching route', [
    ['POST', '/v1/sources/{id}/reindex', '→ 404', 'warn'], ['POST', '/v1/admin/memberships', '→ 405', 'warn']]);

  // Column 3: legacy + mcp + public
  y = 100;
  y = colBlock(1068, y, 496, '/api · Legacy (cookie JWT + CSRF middleware)', 'gray', 'implemented; active UI does not call these', [
    ['POST', '/api/auth/otp/request', 'public'], ['POST', '/api/auth/otp/verify', 'sets cookie'], ['POST', '/api/auth/logout', ''], ['GET', '/api/auth/csrf', ''], ['GET', '/api/me', ''], ['PATCH', '/api/me', ''],
    ['POST', '/api/uploads', 'role-scoped'], ['GET', '/api/submissions', ''], ['GET', '/api/submissions/{id}', 'owner/admin'], ['PATCH', '/api/submissions/{id}', ''], ['POST', '/api/submissions/{id}/approve', 'admin'], ['POST', '/api/submissions/{id}/reject', 'admin'],
    ['POST', '/api/submissions/{id}/retry', ''], ['GET', '/api/files/{id}/raw', 'exempt'], ['GET', '/api/files/{id}/url', ''], ['POST', '/api/admin/scopes/{s}/rollback', 'admin'], ['POST', '/api/admin/events/{id}/unpublish', 'admin'],
    ['POST', '/api/chat', 'writes query_logs'], ['GET', '/api/dashboard/next-class', ''], ['GET', '/api/{timetable|menu|faculty|holidays|events}', ''], ['POST', '/api/feedback', 'thumbs'], ['GET', '/api/healthz', 'public']]);
  y = colBlock(1068, y, 496, '/mcp · FastMCP (stateless streamable HTTP)', 'infra', 'exempt from middleware — no authentication', [
    ['TOOL', 'get_my_timetable · get_next_class', ''], ['TOOL', 'get_faculty_profile · find_classroom', ''], ['TOOL', 'search_canteen_items · optimize_meal_budget', ''], ['TOOL', 'search_documents · get_latest_notices', ''],
    ['TOOL', 'get_examination_schedule · list_campus_events', ''], ['TOOL', 'find_free_time_slots · get_calendar_events', ''], ['TOOL', 'detect_schedule_conflicts', 'stub → []', 'warn'], ['TOOL', 'search_authorized_emails', 'stub → []', 'warn']]);
  y = colBlock(1068, y, 496, 'Public', 'ok', 'no auth', [['GET', '/  ·  /health  (GET + HEAD)', 'keep-alive target']]);
  return doc(1600, 1210, 'API Architecture', 'Every route registered in app/main.py, grouped by surface · communication: JSON over HTTPS, SSE for chat, MCP streamable HTTP', b, {
    legend: [['ok', 'GET'], ['be', 'POST'], ['part', 'PATCH / partial'], ['warn', 'DELETE / mock / risk'], ['gray', 'Legacy surface'], ['infra', 'MCP tool']] });
}

function register(reg) {
  reg('02_DATA_FLOW/data_flow_diagram', dfd);
  reg('02_DATA_FLOW/end_to_end_workflow', e2e);
  reg('02_DATA_FLOW/sequence_diagrams/01_sign_in_v1', SEQ.login);
  reg('02_DATA_FLOW/sequence_diagrams/02_chat_query_streaming', SEQ.chat);
  reg('02_DATA_FLOW/sequence_diagrams/03_document_ingestion_publish', SEQ.ingest);
  reg('02_DATA_FLOW/sequence_diagrams/04_browse_and_inline_edit', SEQ.browse);
  reg('02_DATA_FLOW/sequence_diagrams/05_legacy_otp_sign_in', SEQ.otp);
  reg('02_DATA_FLOW/api_architecture', apiArch);
}
module.exports = { register };
