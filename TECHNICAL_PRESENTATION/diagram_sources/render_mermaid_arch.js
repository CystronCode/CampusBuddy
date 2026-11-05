'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('../../frontend-next/node_modules/playwright');

const mermaidCode = `
flowchart TD
    %% ========================================================
    %% 1. CLIENT TIER (USERS & BROWSER APPLICATION)
    %% ========================================================
    subgraph ClientTier["1. CLIENT TIER — BROWSER RUNTIME & USERS"]
        direction TB
        subgraph UsersGroup["User Personas"]
            direction LR
            UserStudent["Student Persona\n(alex student · CSE-3-A)"]
            UserAdmin["Administrator Persona\n(campus admin · full access)"]
        end

        subgraph NextApp["Next.js 16 Client App (frontend-next)"]
            direction TB
            AppShell["App Shell & Navigation (campus-app.tsx)\nManages persona session, active tab & theme"]
            
            subgraph ViewsGroup["Core User Views"]
                direction LR
                ChatUI["Ask CampusOS\n(chat-view.tsx)"]
                BrowseUI["Browse Directory\n(browse-view.tsx)"]
                AdminUI["Admin Console\n(admin-view.tsx)"]
                SettingsUI["User Settings\n(settings-view.tsx)"]
            end
            
            subgraph ClientState["Client State & Networking"]
                direction LR
                LocalStorage[("Browser localStorage\ncampusos_session (JWT)\ncampusos-tenant")]
                ApiClient["Fetch Client (lib/api.ts)\nBearer Token + X-Tenant-ID"]
                NextProxy["Next.js Edge Rewrites (next.config.ts)\n/v1/* & /api/* proxy to Backend"]
            end
        end
    end

    %% ========================================================
    %% 2. BACKEND API GATEWAY (FASTAPI)
    %% ========================================================
    subgraph BackendTier["2. BACKEND API GATEWAY (FASTAPI / UVICORN)"]
        direction TB
        
        subgraph GatewayMiddleware["Security & Ingress Middleware"]
            direction LR
            CorsMid["CORS Middleware\n(Allowed Origin Regex Allowlist)"]
            SecMid["SessionSecurityMiddleware\n(Bypassed for /v1/*, active for /api/*)"]
            SweeperTask["Lifespan Startup Sweeper\n(Recovers stuck jobs on startup)"]
        end

        subgraph V1Router["Active Production Router (/v1) — app/routers/v1_compat.py"]
            direction TB
            subgraph V1AuthGroup["Identity & Profile"]
                direction LR
                AuthEndpoint["POST /v1/auth/login\n(Demo auth, 14-day HS256 JWT)"]
                ProfileEndpoint["GET /v1/me & /v1/memberships\n(Profile claims & tenant)"]
            end

            subgraph V1StudentGroup["Student Query & Browsing Endpoints"]
                direction LR
                ChatEndpoint["POST /v1/chat & /v1/chat/stream\n(SSE delta streaming)"]
                OverviewEndpoint["GET /v1/overview\n(Next class, notices, events)"]
                BrowseEndpoints["GET /v1/{timetable, menu, meals, faculty, events, notices}"]
            end

            subgraph V1AdminGroup["Administrator Ingestion & CRUD Endpoints"]
                direction LR
                AdminIngestion["POST /v1/ingestion/{preview, records, retry, confirm}\n(Guarded by _require_admin)"]
                AdminCRUD["Inline Slot & Menu CRUD\n(PATCH /v1/timetable, POST /v1/menu)"]
            end
        end
    end

    %% ========================================================
    %% 3. CORE SERVICE LAYER
    %% ========================================================
    subgraph ServiceTier["3. CORE PROCESSING & INTELLIGENCE ENGINES (app/services)"]
        direction TB

        subgraph QueryPipeline["3-Tier Intelligent Query Engine (Read Path)"]
            direction TB
            Tier0["Tier 0: Deterministic Fast-Path (tier0_engine.py)\nSub-millisecond regex rules for timetable, menu, holidays"]
            Tier1["Tier 1: Intent Router (router_engine.py)\nGroq LPU LLM intent classification + 24h LRU cache"]
            ToolExec["Tool Executor (tool_executor.py)\nRuns get_timetable, search_menu, get_faculty, get_events, search_docs"]
            Tier2RAG["Tier 2: Hybrid RAG Engine (rag_engine.py)\nReciprocal Rank Fusion (k=60):\npgvector Cosine (>= 0.45) + tsvector FTS"]
            LLMProvider["Cascading LLM Provider (llm_provider.py)\nPrimary: Groq LPU | Fallback: Google Gemini Flash"]
            TimeEngine["Time Engine (time_engine.py)\nCalculates next class countdown (Asia/Kolkata)"]
        end

        subgraph IngestionPipeline["Multimodal Ingestion Pipeline (Write Path)"]
            direction TB
            MimeSniff["MIME Sniffer & Validation (uploads.py)\nMagic bytes verify: PDF, XLSX, DOCX, Images"]
            BackgroundTasks["FastAPI BackgroundTasks\nAsynchronous parsing queue"]
            VisionExtractor["AI Vision Extractor (ingestion_service.py)\nGemini 3 Flash Vision + Groq text fallback"]
            RowValidators["Deterministic Validators (validators.py)\nCell bounds, day range (1-7), time sequence"]
            AtomicPublish["Approval Service (approval.py)\napprove_submission(): commits rows v+1, rev++"]
            EmbeddingService["Embedding Service (embedding_service.py)\nHeading-based chunking + 768-d L2 vector embed"]
        end

        subgraph CacheAndMemory["In-Process Cache & Memory Store"]
            direction LR
            ScopeCache["Versioned Raw Row Cache (cache_service.py)\nKeyed strictly by (scope, active_version, rev)"]
            MemoryStore["In-Memory State Dictionaries\n_conversations, _messages, _user_prefs"]
        end
    end

    %% ========================================================
    %% 4. EXTERNAL CLOUD & AI APIS
    %% ==========================================
    subgraph ExternalTier["4. EXTERNAL CLOUD & AI APIS"]
        direction LR
        GroqCloud["Groq Cloud API (LPU)\nModel: qwen/qwen3.8-27b\nFast intent routing & response synthesis"]
        GeminiAPI["Google Gemini API (google-genai)\nModels: gemini-3-flash-preview, gemini-embedding-001\nMultimodal vision OCR & 768-dim embeddings"]
        KeepAlivePing["GitHub Actions Runner\n(uptime_ping.yml cron every 10 min)"]
    end

    %% ========================================================
    %% 5. PERSISTENCE & DATABASE TIER (POSTGRESQL 16)
    %% ========================================================
    subgraph DataTier["5. DATA & STORAGE TIER (SUPABASE POSTGRESQL 16)"]
        direction TB

        subgraph DBPools["psycopg3 Async Connection Pools (app/core/database.py)"]
            direction LR
            ReadPool["app_read Pool\n(SELECT-only, max_size=5, timeout=5s)"]
            WritePool["app_write Pool\n(Full DML with transactions, max_size=5)"]
        end

        subgraph PostgresTables["13 PostgreSQL Tables (pgvector + pg_trgm + tsvector)"]
            direction TB
            subgraph GovTables["Governance & Identity Tables"]
                direction LR
                T_files["files\n(storage_path, sha256, mime, size)"]
                T_submissions["submissions\n(status: processing/approved, extracted JSONB)"]
                T_data_versions["data_versions\n(scope PK, active_version, rev)"]
                T_audit["audit_log\n(actor, action, target, ts)"]
                T_users["users & auth_otps\n(roles, branch, tokens)"]
            end

            subgraph DomainTables["Structured Domain Tables"]
                direction LR
                T_timetable["timetable_slots\n(scope, day, times, subject, room, version)"]
                T_menu["menu_items\n(scope, meal, item, price, is_veg, version)"]
                T_faculty["faculty\n(name trgm, cabin, subjects, email)"]
                T_holidays["holidays\n(scope, date, name, kind, version)"]
                T_events["events\n(title, venue, starts_at, valid_until)"]
            end

            subgraph KnowledgeTables["Unstructured Knowledge & Telemetry"]
                direction LR
                T_chunks["doc_chunks\n(vector(768), tsv tsvector, scope, doc_key)"]
                T_logs["query_logs\n(tier, intent, latency_ms, tokens, thumbs)"]
            end
        end

        subgraph LocalDisk["Ephemeral Disk Storage"]
            UploadsDir["Local ./uploads/ Directory\n(Stores raw uploaded PDF/XLSX files)"]
        end
    end

    %% ========================================================
    %% CONNECTIONS & FLOWS
    %% ========================================================
    
    %% Client Flow
    UserStudent --> AppShell
    UserAdmin --> AppShell
    AppShell --> ViewsGroup
    AppShell <--> LocalStorage
    ViewsGroup --> ApiClient
    ApiClient --> NextProxy

    %% Gateway Ingress
    NextProxy -- "HTTP (Bearer JWT)" --> CorsMid
    CorsMid --> V1Router
    KeepAlivePing -- "GET /health" --> GatewayMiddleware

    %% Read Path Connections
    ChatEndpoint --> Tier0
    Tier0 -- "Regex Match (Sub-ms)" --> ToolExec
    Tier0 -- "Regex Miss" --> Tier1
    Tier1 <--> GroqCloud
    Tier1 --> ToolExec
    BrowseEndpoints --> ToolExec
    OverviewEndpoint --> TimeEngine

    ToolExec --> ScopeCache
    ToolExec -- "search_docs" --> Tier2RAG
    Tier2RAG <--> GeminiAPI
    Tier2RAG --> ReadPool
    ScopeCache <--> ReadPool

    ToolExec --> LLMProvider
    LLMProvider <--> GroqCloud
    LLMProvider <--> GeminiAPI
    ChatEndpoint <--> MemoryStore
    ChatEndpoint -- "SSE Delta Stream" --> ChatUI

    %% Write Path Connections
    AdminUI -- "Upload Document" --> AdminIngestion
    AdminIngestion --> MimeSniff
    MimeSniff --> UploadsDir
    MimeSniff --> WritePool
    AdminIngestion --> BackgroundTasks
    BackgroundTasks --> VisionExtractor
    VisionExtractor <--> GeminiAPI
    VisionExtractor <--> GroqCloud
    VisionExtractor --> RowValidators
    RowValidators --> WritePool

    AdminUI -- "Confirm & Publish" --> AdminIngestion
    AdminIngestion --> AtomicPublish
    AtomicPublish --> EmbeddingService
    EmbeddingService <--> GeminiAPI
    AtomicPublish --> WritePool
    AtomicPublish -- "Evict Scope Cache" --> ScopeCache
    AdminCRUD --> WritePool
    AdminCRUD -- "rev = rev + 1" --> ScopeCache

    %% Pool to Tables
    ReadPool --> PostgresTables
    WritePool --> PostgresTables
`;

(async () => {
  console.log('Launching browser to render high-contrast Mermaid architecture...');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 2400, height: 1600 }
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CampusOS End-to-End System Architecture</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      background-color: #FFFFFF !important;
      color: #000000 !important;
      margin: 0;
      padding: 30px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: inline-block;
      min-width: 100%;
    }
    .header {
      width: 100%;
      margin-bottom: 20px;
      border-bottom: 3px solid #000000;
      padding-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title {
      font-size: 28px;
      font-weight: 800;
      color: #000000;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 13.5px;
      color: #222222;
      margin-top: 5px;
      font-weight: 500;
    }
    .badge {
      font-size: 13px;
      font-weight: 800;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: right;
    }
    #chart-wrapper {
      background-color: #FFFFFF !important;
      padding: 24px;
      border: 1.5px solid #000000;
      border-radius: 10px;
      display: inline-block;
    }
    .mermaid {
      background-color: #FFFFFF !important;
    }
    /* Strictly Enforce White Background & Black Text Everywhere */
    .node rect, .node circle, .node polygon, .node path {
      fill: #FFFFFF !important;
      stroke: #000000 !important;
      stroke-width: 1.8px !important;
    }
    .node .label text, .node text, text {
      fill: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      font-weight: 600 !important;
      font-size: 13px !important;
    }
    .cluster rect {
      fill: #FAFAFA !important;
      stroke: #000000 !important;
      stroke-width: 1.8px !important;
      stroke-dasharray: 4 4 !important;
      rx: 8px !important;
    }
    .cluster text {
      fill: #000000 !important;
      font-weight: 800 !important;
      font-size: 14.5px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }
    .edgePath path {
      stroke: #000000 !important;
      stroke-width: 1.8px !important;
    }
    .edgeLabel {
      background-color: #FFFFFF !important;
      color: #000000 !important;
      fill: #000000 !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
    }
    .edgeLabel rect {
      fill: #FFFFFF !important;
      stroke: #000000 !important;
      stroke-width: 1px !important;
      opacity: 0.95 !important;
    }
    marker path {
      fill: #000000 !important;
      stroke: #000000 !important;
    }
    .footer {
      width: 100%;
      margin-top: 20px;
      border-top: 1px solid #000000;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: #111111;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">CampusOS · End-to-End System Architecture</div>
      <div class="subtitle">Complete technical topology from Client Web Browsers to FastAPI Gateway, 3-Tier Query Engine, Ingestion Pipeline, External AI, and PostgreSQL 16</div>
    </div>
    <div class="badge">
      PRODUCTION AS-BUILT<br/>
      <span style="font-size: 11px; font-weight: 500; color: #444444;">White Background / Black Font Edition</span>
    </div>
  </div>

  <div id="chart-wrapper">
    <div class="mermaid">
      ${mermaidCode}
    </div>
  </div>

  <div class="footer">
    <div>Verified against repository source @ commit 4f2ced5 · Generated 2026-11-05 · Reverse-Engineered Architecture</div>
    <div>FastMCP Protocol Excluded · Clean High-Contrast Presentation Standard</div>
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
        fontSize: '13px'
      }
    });
  </script>
</body>
</html>
`;

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  console.log('Waiting for Mermaid rendering...');
  await page.waitForSelector('.mermaid svg', { timeout: 45000 });
  await page.waitForTimeout(2000);

  // Measure the exact bounding box of the rendered SVG
  const dimensions = await page.evaluate(() => {
    const svgEl = document.querySelector('.mermaid svg');
    const bbox = svgEl.getBoundingClientRect();
    const bodyBox = document.body.getBoundingClientRect();
    return {
      svgWidth: Math.ceil(bbox.width),
      svgHeight: Math.ceil(bbox.height),
      bodyWidth: Math.ceil(bodyBox.width),
      bodyHeight: Math.ceil(bodyBox.height),
      svgContent: svgEl.outerHTML
    };
  });

  console.log('Diagram dimensions:', dimensions.svgWidth, 'x', dimensions.svgHeight);
  console.log('Full Page dimensions:', dimensions.bodyWidth, 'x', dimensions.bodyHeight);

  // Resize viewport to fit the entire page with generous margin
  await page.setViewportSize({
    width: Math.max(dimensions.bodyWidth + 60, 2400),
    height: Math.max(dimensions.bodyHeight + 60, 1600)
  });
  await page.waitForTimeout(1000);

  // Destinations
  const dest1 = path.resolve('D:\\archicec-images');
  const dest2 = path.resolve('TECHNICAL_PRESENTATION', '01_SYSTEM_ARCHITECTURE');

  fs.mkdirSync(dest1, { recursive: true });
  fs.mkdirSync(dest2, { recursive: true });

  const pngFile1 = path.join(dest1, 'end_to_end_system_architecture.png');
  const svgFile1 = path.join(dest1, 'end_to_end_system_architecture.svg');
  const pngFile2 = path.join(dest2, 'end_to_end_system_architecture.png');
  const svgFile2 = path.join(dest2, 'end_to_end_system_architecture.svg');
  const pngFileFlat = path.join(dest1, '00_end_to_end_system_architecture_mermaid.png');

  // Save SVG files
  if (dimensions.svgContent) {
    fs.writeFileSync(svgFile1, dimensions.svgContent);
    fs.writeFileSync(svgFile2, dimensions.svgContent);
    console.log('Saved SVG files.');
  }

  // Capture full-page screenshot with white background and black font
  await page.screenshot({
    path: pngFile1,
    fullPage: true
  });

  fs.copyFileSync(pngFile1, pngFile2);
  fs.copyFileSync(pngFile1, pngFileFlat);

  console.log('Successfully saved high-res PNG to:');
  console.log(' ->', pngFile1);
  console.log(' ->', pngFile2);
  console.log(' ->', pngFileFlat);

  await browser.close();
  console.log('Completed Mermaid rendering successfully!');
})().catch(e => {
  console.error('Render error:', e);
  process.exit(1);
});
