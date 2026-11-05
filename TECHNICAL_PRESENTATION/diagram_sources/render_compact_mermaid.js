'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('../../frontend-next/node_modules/playwright');

const mermaidCode = `flowchart TD
    %% ========================================================
    %% 1. CLIENT TIER (NEXT.JS 16 REACT APPLICATION)
    %% ========================================================
    subgraph T1 ["1. CLIENT TIER · NEXT.JS 16 REACT SPA (PORT 3000)"]
        U_Student["Alex Student Persona\n(alex student · CSE-3-A / Non-Admin)"]
        U_Admin["Campus Admin Persona\n(campus admin · Full Ingestion Privileges)"]
        
        AppShell["Next.js App Shell & Tab Navigation (campus-app.tsx)"]
        
        V_Chat["Ask CampusOS Workspace\n(chat-view.tsx)"]
        V_Browse["Directory Browser\n(browse-view.tsx)"]
        V_Settings["User Settings\n(settings-view.tsx)"]
        V_Admin["Admin Ingestion Console\n(admin-view.tsx)"]
        
        LocalStore[("Browser localStorage\ncampusos_session (JWT) · campusos-tenant")]
        APIClient["Typed API Client (lib/api.ts)\nBearer Auth Token + X-Tenant-ID Header"]
    end

    %% ========================================================
    %% 2. BACKEND API GATEWAY & ROUTING
    %% ========================================================
    subgraph T2 ["2. BACKEND API GATEWAY & INGRESS LAYER · FASTAPI / ONRENDER (PORT 8000)"]
        CORS["CORSMiddleware (Origin Regex Validation)"]
        SecMid["SessionSecurityMiddleware (/api/* Checked · /v1/* Bypassed)"]
        
        HealthEP["GET /health & /metrics\n(Keep-Alive Ping)"]
        EP_Auth["POST /v1/auth/login · GET /v1/me\nDemo Token Issuance (14-Day JWT)"]
        EP_Overview["GET /v1/overview\nNext Class & Notices"]
        EP_Browse["GET /v1/{timetable, menu, faculty, events}\nDirectory Queries"]
        EP_Chat["POST /v1/chat & /v1/chat/stream\nSSE Token Feed"]
        EP_Ingest["POST /v1/ingestion/{preview, records, retry, confirm}\nUpload Pipeline"]
        EP_CRUD["PATCH /v1/timetable · POST /v1/menu\nDirect Inline CRUD"]
    end

    %% ========================================================
    %% 3. CORE PROCESSING ENGINES
    %% ========================================================
    subgraph T3 ["3. CORE PROCESSING & INTELLIGENCE ENGINES (app/services)"]
        TimeEngine["Time Engine (time_engine.py)\nAsia/Kolkata Next Class Countdown"]
        Tier0["Tier 0 Engine (tier0_engine.py)\nDeterministic Regex Fast-Path (< 5ms)"]
        Tier1["Tier 1 Intent Router (router_engine.py)\nSemantic Intent Categorizer & Entity Extractor"]
        ToolExec["Tool Executor (tool_executor.py)\nDispatches DB Queries or Hybrid Search"]
        Tier2["Tier 2 Hybrid RAG Engine (rag_engine.py)\nReciprocal Rank Fusion: pgvector + tsvector"]
        LLMCascade["Cascading LLM Synthesizer (llm_provider.py)\nPrimary: Groq LPU | Fallback: Gemini Flash"]

        VersionCache["Versioned Raw Row Cache (cache_service.py)\nKeyed strictly by (scope, active_version, rev)"]
        VolatileState["In-Memory State Dictionaries\n_conversations, _messages, _user_prefs"]

        MimeSniff["Upload Handler (uploads.py)\nMagic Bytes MIME Sniffer & 10MB Cap"]
        BGTasks["FastAPI BackgroundTasks Queue\nAsynchronous Processing Queue"]
        OCRVision["Document Extractor (ingestion_service.py)\nGemini 3 Flash Vision OCR + Groq Fallback"]
        DataValid["Data Validators (validators.py)\nTime Sequence, Day Enum & Range Checks"]
        ApproveEngine["Approval Service (approval.py)\napprove_submission() -> v+1 Commit"]
        ChunkEmbed["Embedding Service (embedding_service.py)\nHeading-Aware Chunker + 768-d Vector Embedder"]
    end

    %% ========================================================
    %% 4. EXTERNAL CLOUD AI
    %% ========================================================
    subgraph T4 ["4. EXTERNAL CLOUD AI & MODEL PROVIDERS"]
        GroqCloud["Groq Cloud LPU Service\nModel: qwen/qwen3.8-27b\nSub-200ms Intent Routing & Synthesis"]
        GeminiAPI["Google Gemini Cloud API\nModels: gemini-3-flash & gemini-embedding-001\nMultimodal Vision OCR & 768-d Embeddings"]
    end

    %% ========================================================
    %% 5. PERSISTENCE & STORAGE TIER
    %% ========================================================
    subgraph T5 ["5. PERSISTENCE & STORAGE TIER (SUPABASE POSTGRESQL 16)"]
        ReadPool["app_read Pool\npsycopg3 Async Pool (max_size=5, Read-Only)"]
        WritePool["app_write Pool\npsycopg3 Async Pool (max_size=5, DML / Transactions)"]
        LocalDisk["Render Ephemeral Container Disk\n./uploads/ Directory (Raw Upload File Staging)"]

        T_tt["timetable_slots (day, times, subject, room, version)"]
        T_menu["menu_items (meal, item, price, is_veg, version)"]
        T_fac["faculty (name, designation, cabin, subjects, email)"]
        T_hol["holidays (date, name, kind, version)"]
        T_evt["events (title, venue, starts_at, valid_until)"]

        T_chunks["doc_chunks (content, vector 768-d, tsv tsvector, scope)"]
        T_logs["query_logs (tier, intent, latency_ms, tokens, feedback)"]

        T_ver["data_versions (scope PK, active_version, rev)"]
        T_sub["submissions (status: processing/approved, payload)"]
        T_files["files (storage_path, sha256, mime, size)"]
        T_audit["audit_log (actor, action, target, timestamp)"]
        T_auth["users & auth_otps (roles, branch, tokens)"]
    end

    %% ========================================================
    %% CLEAN ORCHESTRATION EDGES
    %% ========================================================
    U_Student --> AppShell
    U_Admin --> AppShell
    AppShell --> V_Chat
    AppShell --> V_Browse
    AppShell --> V_Settings
    AppShell --> V_Admin
    
    V_Chat --> LocalStore
    V_Browse --> LocalStore
    V_Settings --> LocalStore
    V_Admin --> LocalStore
    LocalStore --> APIClient

    APIClient -- "HTTPS / JSON Payload (Bearer JWT)" --> CORS
    CORS --> SecMid
    SecMid --> HealthEP
    SecMid --> EP_Auth
    SecMid --> EP_Overview
    SecMid --> EP_Browse
    SecMid --> EP_Chat
    SecMid --> EP_Ingest
    SecMid --> EP_CRUD

    %% T2 -> T3 (Read Flow)
    EP_Overview --> TimeEngine
    EP_Overview --> VersionCache
    EP_Browse --> ToolExec
    EP_Chat --> Tier0
    Tier0 -- "Regex Match" --> ToolExec
    Tier0 -- "Regex Miss" --> Tier1
    Tier1 --> ToolExec
    ToolExec --> Tier2
    ToolExec --> VersionCache
    ToolExec --> LLMCascade
    EP_Chat --> VolatileState

    %% T2 -> T3 (Write Flow)
    EP_Ingest --> MimeSniff
    MimeSniff --> LocalDisk
    MimeSniff --> BGTasks
    BGTasks --> OCRVision
    OCRVision --> DataValid
    DataValid --> WritePool
    EP_Ingest -- "Admin Confirm" --> ApproveEngine
    ApproveEngine --> ChunkEmbed
    ApproveEngine --> WritePool
    ApproveEngine -- "Evict Cache" --> VersionCache
    EP_CRUD --> WritePool

    %% T3 -> T4 (External Cloud AI)
    Tier1 --> GroqCloud
    LLMCascade --> GroqCloud
    LLMCascade --> GeminiAPI
    OCRVision --> GeminiAPI
    ChunkEmbed --> GeminiAPI
    Tier2 --> GeminiAPI

    %% T3 & Pools -> T5 (Database)
    VersionCache --> ReadPool
    Tier2 --> ReadPool
    ToolExec --> ReadPool
    ReadPool --> T_tt
    ReadPool --> T_menu
    ReadPool --> T_fac
    ReadPool --> T_hol
    ReadPool --> T_evt
    ReadPool --> T_chunks
    ReadPool --> T_logs

    WritePool --> T_ver
    WritePool --> T_sub
    WritePool --> T_files
    WritePool --> T_audit
    WritePool --> T_auth
    WritePool --> T_tt
    WritePool --> T_menu
    WritePool --> T_chunks
`;

(async () => {
  console.log('Rendering production end-to-end architecture (White Background / Black Font)...');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CampusOS End-to-End System Architecture</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      background-color: #FFFFFF !important;
      color: #000000 !important;
      margin: 0;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: inline-block;
    }
    .header {
      width: 100%;
      margin-bottom: 24px;
      border-bottom: 3.5px solid #000000;
      padding-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title {
      font-size: 34px;
      font-weight: 800;
      color: #000000;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 15px;
      color: #222222;
      margin-top: 6px;
      font-weight: 600;
    }
    .badge {
      font-size: 14px;
      font-weight: 800;
      color: #000000;
      text-transform: uppercase;
      text-align: right;
    }
    #chart-wrapper {
      background-color: #FFFFFF !important;
      padding: 24px;
      border: 2.5px solid #000000;
      border-radius: 12px;
      display: inline-block;
    }
    .node rect, .node circle, .node polygon, .node path {
      fill: #FFFFFF !important;
      stroke: #000000 !important;
      stroke-width: 2px !important;
    }
    .node .label text, .node text, text {
      fill: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      font-weight: 700 !important;
      font-size: 14px !important;
    }
    .cluster rect {
      fill: #FAFAFA !important;
      stroke: #000000 !important;
      stroke-width: 2.2px !important;
      stroke-dasharray: 5 5 !important;
      rx: 8px !important;
    }
    .cluster text {
      fill: #000000 !important;
      font-weight: 900 !important;
      font-size: 16px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }
    .edgePath path {
      stroke: #000000 !important;
      stroke-width: 2px !important;
    }
    .edgeLabel {
      background-color: #FFFFFF !important;
      color: #000000 !important;
      fill: #000000 !important;
      font-size: 13px !important;
      font-weight: 800 !important;
    }
    .edgeLabel rect {
      fill: #FFFFFF !important;
      stroke: #000000 !important;
      stroke-width: 1px !important;
    }
    marker path {
      fill: #000000 !important;
      stroke: #000000 !important;
    }
    .footer {
      width: 100%;
      margin-top: 24px;
      border-top: 2px solid #000000;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 13.5px;
      color: #000000;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">CampusOS · End-to-End System Architecture</div>
      <div class="subtitle">Complete Technical Blueprint: Client Tier → FastAPI Gateway → 3-Tier Query Engine → Multimodal Ingestion → External AI → Supabase PostgreSQL 16</div>
    </div>
    <div class="badge">
      PRODUCTION AS-BUILT<br/>
      <span style="font-size: 12px; font-weight: 700; color: #222222;">White Background / Black Font Edition</span>
    </div>
  </div>

  <div id="chart-wrapper">
    <div class="mermaid">
      ${mermaidCode}
    </div>
  </div>

  <div class="footer">
    <div>Verified against repository source @ commit 4f2ced5 · Generated 2026-11-05 · Reverse-Engineered Architecture</div>
    <div>FastMCP Protocol Excluded · Clean High-Contrast Executive Standard</div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      },
      themeVariables: {
        darkMode: false,
        background: '#FFFFFF',
        primaryColor: '#FFFFFF',
        primaryTextColor: '#000000',
        primaryBorderColor: '#000000',
        lineColor: '#000000',
        secondaryColor: '#FAFAFA',
        tertiaryColor: '#F5F5F5',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif',
        fontSize: '14px'
      }
    });
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mermaid svg', { timeout: 45000 });
  await page.waitForTimeout(2000);

  const dim = await page.evaluate(() => {
    const el = document.querySelector('.mermaid svg');
    const b = el.getBoundingClientRect();
    const bb = document.body.getBoundingClientRect();
    return {
      svgW: Math.ceil(b.width),
      svgH: Math.ceil(b.height),
      bodyW: Math.ceil(bb.width),
      bodyH: Math.ceil(bb.height),
      svg: el.outerHTML
    };
  });

  console.log('Final Rendered size: SVG', dim.svgW, 'x', dim.svgH, 'Body:', dim.bodyW, 'x', dim.bodyH);

  await page.setViewportSize({
    width: Math.max(dim.bodyW + 80, 2000),
    height: Math.max(dim.bodyH + 80, 1400)
  });
  await page.waitForTimeout(1000);

  const dest1 = path.resolve('D:\\archicec-images');
  const dest2 = path.resolve('TECHNICAL_PRESENTATION', '01_SYSTEM_ARCHITECTURE');
  const destSources = path.resolve('TECHNICAL_PRESENTATION', 'diagram_sources');

  const png1 = path.join(dest1, 'end_to_end_system_architecture.png');
  const svg1 = path.join(dest1, 'end_to_end_system_architecture.svg');
  const png2 = path.join(dest2, 'end_to_end_system_architecture.png');
  const svg2 = path.join(dest2, 'end_to_end_system_architecture.svg');
  const pngFlat = path.join(dest1, '00_end_to_end_system_architecture_mermaid.png');

  const mmd1 = path.join(dest1, 'end_to_end_system_architecture.mmd');
  const mmd2 = path.join(destSources, 'end_to_end_system_architecture.mmd');

  // Save SVG
  if (dim.svg) {
    fs.writeFileSync(svg1, dim.svg, 'utf8');
    fs.writeFileSync(svg2, dim.svg, 'utf8');
  }

  // Save Mermaid Code
  fs.writeFileSync(mmd1, mermaidCode.trim(), 'utf8');
  fs.writeFileSync(mmd2, mermaidCode.trim(), 'utf8');

  // Capture Screenshot PNG
  await page.screenshot({ path: png1, fullPage: true });
  fs.copyFileSync(png1, png2);
  fs.copyFileSync(png1, pngFlat);

  console.log('Successfully saved crisp White/Black PNG, SVG, and MMD to:');
  console.log(' -', png1);
  console.log(' -', svg1);
  console.log(' -', png2);
  console.log(' -', svg2);
  console.log(' -', pngFlat);
  console.log(' -', mmd1);

  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
