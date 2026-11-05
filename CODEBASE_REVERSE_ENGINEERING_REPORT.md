# CampusOS / CampusBuddy — Complete Codebase Reverse Engineering, Technical Architecture & Data Flow Report

**Audit Date:** November 2, 2026  
**Repository Root:** `d:\CampusOS`  
**Git HEAD Commit:** `295707c3c102f519b1e53fbe103cac3523675d60` (`main`)  
**Git Remotes:**  
- `origin`: `https://github.com/CystronCode/CampusBuddy.git`  
- `upstream`: `https://github.com/KashifaTajreen/CampusBuddy.git`  
**Audit Methodology:** 100% static and structural source-code inspection across all backend modules, dual frontend codebases, SQL schemas, Alembic migrations, test suites, CI/CD workflows, and environment configurations. Strictly read-only investigation.

---

## Table of Contents

1. [Repository Directory Structure & Application Entry Points](#1-repository-directory-structure--application-entry-points)
2. [Project Overview](#2-project-overview)
3. [Complete Technology Stack](#3-complete-technology-stack)
4. [Actual System Architecture](#4-actual-system-architecture)
5. [Complete Frontend Investigation](#5-complete-frontend-investigation)
6. [Complete Backend Investigation & API Endpoint Inventory](#6-complete-backend-investigation--api-endpoint-inventory)
7. [Database Architecture & Data Model](#7-database-architecture--data-model)
8. [End-to-End Data Flows & Sequence Diagrams](#8-end-to-end-data-flows--sequence-diagrams)
9. [Authentication, Authorization & Security Audit](#9-authentication-authorization--security-audit)
10. [Mock Data, Hardcoded Values & Simulated Features](#10-mock-data-hardcoded-values--simulated-features)
11. [File & Module Dependency Map](#11-file--module-dependency-map)
12. [Error Handling, Logging & Reliability](#12-error-handling-logging--reliability)
13. [Configuration & Environment Management](#13-configuration--environment-management)
14. [Build, Execution & Deployment Architecture](#14-build-execution--deployment-architecture)
15. [Testing & Code Quality](#15-testing--code-quality)
16. [Known Technical Limitations, Risks & Architectural Gaps](#16-known-technical-limitations-risks--architectural-gaps)
17. [Real-World "Under the Hood" Workflow Examples](#17-real-world-under-the-hood-workflow-examples)
18. [Final Architecture Summary (A–J)](#18-final-architecture-summary-aj)

---

## 1. Repository Directory Structure & Application Entry Points

### 1.1 High-Level Repository Layout

The repository is a multi-application monorepo containing **one FastAPI backend** (`app/`), **two distinct frontend applications** (`frontend-next/` and `frontend/`), **database migrations and SQL scripts** (`migrations/`, `scripts/`), and **automated test suites** (`tests/`, `frontend-next/tests/`).

```text
d:\CampusOS\
├── .github/
│   └── workflows/
│       └── uptime_ping.yml               # GitHub Actions cron (every 14m) pinging Render /health & /ready
├── app/                                  # Python FastAPI Backend Application
│   ├── core/
│   │   ├── config.py                     # Pydantic BaseSettings & GeminiAPIKeyRotator
│   │   ├── database.py                   # AsyncPGPool (ThreadedConnectionPool wrapper) for RW and RO pools
│   │   └── middleware.py                 # SessionSecurityMiddleware (JWT cookie + CSRF validation for /api/*)
│   ├── routers/
│   │   ├── admin_actions.py              # /api/admin/rollback & /api/files/{file_id}/url|raw
│   │   ├── approval.py                   # /api/submissions/* review, cell PATCH, atomic approve & reject
│   │   ├── auth.py                       # /api/auth/request-otp, /verify-otp, /logout
│   │   ├── health.py                     # /health, /ready, /api/health, /api/ready
│   │   ├── me.py                         # /api/me GET & PATCH student profile preferences
│   │   ├── student_queries.py            # /api/dashboard/next-class, /timetable, /menu, /events, /faculty, /holidays, /query
│   │   ├── uploads.py                    # /api/uploads multipart ingestion & background AI extraction
│   │   └── v1_compat.py                  # /v1/* compatibility layer (1,669 lines) powering frontend-next
│   ├── schemas/
│   │   ├── auth_schemas.py               # Pydantic models for OTP auth
│   │   ├── ingestion_schemas.py          # Pydantic schemas for Gemini structured JSON extraction
│   │   └── me_schemas.py                 # Pydantic models for /api/me
│   ├── services/
│   │   ├── auth_service.py               # HMAC-SHA256 OTP generation, Resend email dispatch, JWT creation
│   │   ├── cache_service.py              # RAM-First 60-second TTL cache for active scopes + DB hydration
│   │   ├── embedding_service.py          # Gemini embedding-001 (768-dim) + deterministic SHA-256 fallback vector
│   │   ├── ingestion_service.py          # PyMuPDF, python-docx, openpyxl, & Gemini Vision/Text extraction
│   │   ├── rag_engine.py                 # Hybrid pgvector cosine + pg_trgm search + Gemini 2.5 Flash synthesis
│   │   ├── router_engine.py              # Tier 1/2 LLM function-calling router (6 tool declarations)
│   │   ├── sweeper_service.py            # Nightly 02:00 IST retention sweep & /api/admin/sweep-expired
│   │   ├── tier0_engine.py               # Deterministic <5ms regex/keyword intent matcher (zero LLM calls)
│   │   ├── time_engine.py                # IST (Asia/Kolkata) clock engine & Next Class slot resolver
│   │   ├── tool_executor.py              # Executes structured tool calls against cache_service / DB
│   │   └── validators.py                 # Deterministic cell-level validation rules for extracted tables
│   ├── main.py                           # FastAPI application entrypoint & lifespan manager
│   └── mcp_server.py                     # Standalone FastMCP server exposing 14 campus tools over stdio/MCP
├── frontend-next/                        # PRIMARY FRONTEND: Next.js 16 + React 19 + Tailwind CSS v4
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                # Root HTML layout & metadata ("CampusBuddy — AI Campus Assistant")
│   │   │   ├── page.tsx                  # Main route (`/`) rendering <CampusApp />
│   │   │   ├── reset-password/page.tsx   # Password reset route (`/reset-password`)
│   │   │   └── globals.css               # Tailwind v4 & Editorial Academic Light theme CSS variables
│   │   ├── components/
│   │   │   ├── campus-app.tsx            # Monolithic shell (1,963 lines): Auth, HomeView, MenuManagerView, Nav
│   │   │   ├── chat-view.tsx             # AI Assistant chat interface with SSE streaming & prompt pills
│   │   │   ├── browse-view.tsx           # 5-tab structured directory (Timetable, Canteen, Faculty, Calendar, Events)
│   │   │   ├── admin-view.tsx            # 6-tab Admin Console (Upload, Review, Sources, System, Members, Docs)
│   │   │   ├── settings-view.tsx         # Student profile preferences & External Integrations UI
│   │   │   ├── result-cards.tsx          # Rich structured cards rendered inside AI chat responses
│   │   │   ├── timetable-card-table.tsx  # Grid/table timetable renderer with legend & faculty resolution
│   │   │   └── ui/button.tsx             # CVA/Base-UI button primitive
│   │   └── lib/
│   │       ├── api.ts                    # Fetch wrapper (`apiFetch`) & SSE reader (`streamChat`) targeting /v1/*
│   │       ├── timetable-legend.ts       # Static fallback course/faculty legend for CSE sections
│   │       └── utils.ts                  # clsx + tailwind-merge helper
│   ├── tests/
│   │   └── campus.spec.ts                # Playwright E2E browser tests
│   ├── Dockerfile                        # Broken Dockerfile (references `frontend/` paths instead of `frontend-next/`)
│   ├── next.config.ts                    # Next.js configuration
│   ├── package.json                      # Next.js 16.0.0, React 19.2.0 dependencies
│   └── playwright.config.ts              # Playwright test runner configuration
├── frontend/                             # SECONDARY / LEGACY FRONTEND: Vite 6 + React 18 SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/                    # UploadCard.tsx, SubmissionReviewDetail.tsx
│   │   │   ├── auth/                     # LoginView.tsx, OnboardingModal.tsx
│   │   │   ├── browse/                   # BrowseView.tsx
│   │   │   ├── chat/                     # ChatView.tsx
│   │   │   ├── dashboard/                # NextClassCard.tsx, MessMenuCard.tsx, EventsCard.tsx, TimetableCard.tsx
│   │   │   └── settings/                 # SettingsView.tsx
│   │   ├── context/AuthContext.tsx       # Cookie-based session state via /api/me
│   │   ├── lib/api.ts                    # Axios client with withCredentials: true & X-CSRF-Token interceptor
│   │   ├── App.tsx                       # Legacy SPA shell (Dashboard, Browse, AI Chat, Admin, Settings)
│   │   └── main.tsx                      # React 18 DOM root
│   ├── package.json                      # Vite 6, React 18.3.1, Axios dependencies
│   └── vite.config.ts                    # Vite dev server (port 5173)
├── migrations/                           # Alembic Database Migrations
│   ├── versions/
│   │   ├── 001_initial_schema.py         # Creates pgvector/pg_trgm, app_read/app_write roles, and 13 tables
│   │   └── 002_observability_views.py    # Creates 4 SQL monitoring views (v_tier_distribution, etc.)
│   └── env.py                            # Alembic environment runner
├── scripts/
│   ├── init_db.sql                       # Raw SQL equivalent of 001_initial_schema.py
│   └── observability_views.sql           # Raw SQL equivalent of 002_observability_views.py
├── storage/
│   └── uploads/                          # Local disk storage for uploaded PDFs/images/documents
├── tests/                                # Backend Pytest Suite
│   ├── test_phase1_phase2.py             # Auth OTP, CSRF, time engine, ingestion validator unit tests
│   ├── test_phase3_phase4.py             # Tier-0, Router, RAG, Sweeper, and MCP tool unit tests
│   └── test_production_suite.py          # 55-test suite covering /api/* and /v1/* endpoints
├── .env.example                          # Template environment variables
├── .env                                  # Untracked local secrets (Supabase DB URLs, Gemini keys)
├── .env.production                       # Untracked production environment configuration
├── alembic.ini                           # Alembic configuration file
├── docker-compose.yml                    # Local pgvector/pgvector:pg16 PostgreSQL container definition
├── docx_to_md.py                         # Utility script to convert .docx files to Markdown
├── generate_audit_docx.py                # Untracked utility script that generated CampusOS_vs_CampusBuddy_Architecture_Audit.docx
├── requirements.txt                      # Python backend dependencies
├── run_backend.ps1                       # PowerShell script to launch FastAPI on port 8000
└── run_frontend.ps1                      # PowerShell script that launches legacy `frontend/` (Vite) on port 5173
```

### 1.2 Actual Application Entry Points

| Layer | Entry Point File | Execution Command / Trigger | Status |
| :--- | :--- | :--- | :--- |
| **Backend API Server** | `app/main.py` (`app = create_app()`) | `uvicorn app.main:app --host 0.0.0.0 --port 8000` (or `./run_backend.ps1`) | **Fully Implemented** |
| **MCP Server** | `app/mcp_server.py` (`mcp = FastMCP("CampusOS")`) | `python -m app.mcp_server` | **Partially Implemented** |
| **Primary Frontend (Next.js)** | `frontend-next/src/app/page.tsx` (`<CampusApp />`) | `npm --prefix frontend-next run dev` (Port 3000) / Deployed on Vercel | **Fully Implemented** (with mocked sub-views) |
| **Secondary Frontend (Vite SPA)** | `frontend/src/main.tsx` (`<App />`) | `./run_frontend.ps1` (`npm run dev` inside `frontend/`, Port 5173) | **Fully Implemented** (Legacy UI) |
| **Database Migrations** | `migrations/env.py` | `alembic upgrade head` | **Partially Broken** (Schema drift vs. live SQL queries; see Section 7.4) |

---

## 2. Project Overview

### 2.1 What the Application Does & Problem It Attempts to Solve
**CampusOS** (branded in the UI as **CampusBuddy**) is an AI-assisted campus information portal and document ingestion platform designed for Indian engineering colleges (specifically tailored around departments such as `CSE`, `ECE`, `ME`, `ISE`, `CIVIL`, `AIML`, and institutions like BMSIT&M).

It attempts to solve two core problems:
1. **Fragmented Campus Information for Students:** Students typically hunt through WhatsApp groups, notice boards, and scattered PDFs to find class timetables, faculty cabins, canteen prices, academic calendar dates, and club events. CampusOS consolidates these into a structured directory and a conversational AI assistant capable of answering natural-language queries (e.g., *"What is my next class?"*, *"Veg lunch under ₹100"*, *"Where is Dr. Ramesh's cabin?"*).
2. **Unstructured Document Ingestion for Administrators:** Administrators upload raw PDFs, Word documents, Excel sheets, or poster images (timetables, mess menus, circulars, holiday lists). The backend uses deterministic parsers (PyMuPDF, `python-docx`, `openpyxl`) combined with Google Gemini 2.5 Flash structured extraction to convert unstructured files into tabular rows, runs cell-level validation rules, and lets admins review and atomically publish versioned campus data.

### 2.2 Intended Users (Based on Implementation)
Based on `app/routers/v1_compat.py` and `app/routers/auth.py`, the system implements two primary user roles:
1. **Students (`role: "student"`):** Scoped by `branch` (e.g., `CSE`), `year`/`semester` (e.g., Year 2 / Sem 3), `section` (e.g., `A` or `B`), `dietary_preference`, and `budget_inr`.
2. **Administrators / Reviewers (`role: "admin"`, `"Approver"`, `"Verifier"`, or `"institution_admin"` in `/v1/*`):** Permitted to upload documents, edit extracted rows, approve/reject submissions, trigger rollbacks, and view system status.

### 2.3 Implemented vs. Intended Functionality Summary

| Capability | What Users Can Actually Do (Implemented Reality) | What the Application Cannot Currently Do (Unimplemented / Simulated) |
| :--- | :--- | :--- |
| **Authentication** | Log into the `/api/*` Vite app via real email OTP (`auth_otps` + HttpOnly JWT cookie), OR log into the `/v1/*` Next.js app using hardcoded demo credentials (`student@campus.edu.in` / `123456`) or unverified password reset / signup forms. | In the Next.js (`/v1/*`) app, user registration (`POST /v1/auth/signup`) and password reset do **not** persist accounts to PostgreSQL, and `/v1/*` does **not** verify JWT signatures (`verify_signature: False`). |
| **AI Chat Assistant** | Ask questions in natural language. Queries are routed through a 3-tier engine: Tier 0 regex (<5ms), Tier 1/2 Gemini tool-calling, or Hybrid pgvector + trigram RAG over `doc_chunks`. Rich cards render alongside answers. | `/v1/chat/stream` does **not** stream tokens live from Gemini; it waits for the full answer and slices it into 48-character chunks in Python. Conversation history is stored in a volatile Python dict (`_conversations`) that wipes on server restart. |
| **Structured Directory Browsing** | Browse real database records (cached in RAM for 60s) for Section Timetables, Canteen Menu Items (with budget/veg filters), Faculty Directory, Academic Calendar Holidays, and Campus Events. | Canteen nutrition figures (`protein_g`, `calories`) in `/v1/menu` are synthetically calculated from the item's price (`8.0 + (price % 15)`) because the `menu_items` table has no nutrition columns. Free slots in `/v1/calendar` are hardcoded. |
| **Student & Admin Home Dashboard (`HomeView`)** | View a polished Bento dashboard in `frontend-next` and click quick links to jump to Chat, Browse, or Admin tabs. | Every metric on `HomeView` (`4,310 Active students`, `91.2% Attendance`, `1,942 Canteen orders`, `24m` countdown, `Mark attendance` button, and the Admin `Needs review` queue on the Home tab) is **100% hardcoded static React state**. |
| **Canteen Menu Manager (`MenuManagerView`)** | Admin users can view an interactive "Canteen Menu Manager" tab in `frontend-next`, add dishes, adjust prices, and toggle availability. | **100% UI-only local React state** (`INITIAL_FOOD` in `campus-app.tsx`). Zero network requests are made; changes disappear on page reload. |
| **Document Upload, Review & Approval** | Upload PDF/DOCX/XLSX/Image files (`POST /api/uploads` or `POST /v1/ingestion/upload`), run Gemini AI extraction + cell validation, edit cells, and approve (`POST .../approve`) to publish to database tables and invalidate RAM cache. | In `frontend-next` (`AdminView`), the "Apply Mapping", "Retry Failed Job", "Re-index Source", and "Add/Update Member" buttons call backend routes (`/mapping`, `/retry`, `/reindex`, `POST /v1/admin/memberships`) that **do not exist** (`404`/`405`). |
| **External Integrations (Google Calendar & Gmail)** | View "Google Calendar" and "Gmail Connector" cards in `SettingsView`. | Clicking Connect, Sync, or Disconnect calls `POST/DELETE /v1/integrations/{provider}/*` routes that **do not exist (`404`)**, and the UI silently ignores the failure via `catch {}`. |

---

## 3. Complete Technology Stack

### 3.1 Frontend Technology Stack

The repository contains **two separate frontend applications**. Neither shares code with the other.

#### A. Primary Frontend (`frontend-next/`)
| Technology | Version (`package.json`) | Where Used | Why Used & Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript** | `^5.7.2` | All `frontend-next/src/**/*.ts(x)` files | Static typing for React components and API payloads. | **Fully Implemented** |
| **Next.js (App Router)** | `16.0.0` (Note: `README.md` claims Next.js 15) | `frontend-next/src/app/` | Framework providing routing (`/`, `/reset-password`), SSR/CSR bundling, and Vercel deployment. Virtually all components use `"use client"`. | **Fully Implemented** |
| **React & React DOM** | `19.2.0` | All UI views in `frontend-next/src/` | Component state (`useState`, `useEffect`, `useMemo`, `useRef`) and rendering. | **Fully Implemented** |
| **Tailwind CSS v4** | `^4.0.0` (`@tailwindcss/postcss`) | `src/app/globals.css` & utility classes | Utility-first styling alongside extensive inline `style={{ ... }}` objects in `campus-app.tsx`. | **Fully Implemented** |
| **Lucide React** | `^1.16.0` | `campus-app.tsx`, `admin-view.tsx`, `browse-view.tsx`, `chat-view.tsx`, `result-cards.tsx`, `settings-view.tsx` | Iconography across navigation, cards, and buttons. | **Fully Implemented** |
| **Native Fetch API + ReadableStream** | Browser built-in | `frontend-next/src/lib/api.ts` (`apiFetch`, `streamChat`) | Communicates with `/v1/*` endpoints using `Authorization: Bearer <token>` from `localStorage` and parses SSE `data:` chunks. | **Fully Implemented** |
| **Base UI (`@base-ui/react`) + `class-variance-authority`** | `^1.4.0` / `^0.7.1` | `frontend-next/src/components/ui/button.tsx` | Provides the `<Button>` primitive used in sub-views (`chat-view.tsx`, `browse-view.tsx`, `admin-view.tsx`, `settings-view.tsx`). | **Fully Implemented** |
| **Supabase JS (`@supabase/supabase-js`)** | `^2.101.1` | Listed in `frontend-next/package.json` | **Unused Dependency:** Zero imports of `@supabase/supabase-js` exist anywhere in `frontend-next/src/`. | **Disconnected / Unused** |
| **Playwright (`@playwright/test`)** | `^1.59.1` | `frontend-next/tests/campus.spec.ts` | End-to-end browser automation tests. | **Partially Implemented** |

#### B. Secondary / Legacy Frontend (`frontend/`)
| Technology | Version (`package.json`) | Where Used | Why Used & Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Vite + React 18** | Vite `^6.0.1` / React `^18.3.1` | `frontend/src/` | Original SPA frontend launched by `run_frontend.ps1`. | **Fully Implemented** (Legacy) |
| **Axios** | `^1.7.9` | `frontend/src/lib/api.ts` | HTTP client configured with `withCredentials: true` and an interceptor reading the `campus_csrf` cookie into `X-CSRF-Token` for `/api/*` routes. | **Fully Implemented** |

---

### 3.2 Backend Technology Stack

| Technology | Version (`requirements.txt`) | Where Used | Purpose & Dependent Modules | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Python** | `3.12+` | `app/`, `tests/`, `migrations/` | Core backend language. | **Fully Implemented** |
| **FastAPI** | `0.115.8` | `app/main.py`, `app/routers/*.py` | ASGI web framework serving both `/api/*` and `/v1/*` REST endpoints. | **Fully Implemented** |
| **Uvicorn** | `0.34.0` | `run_backend.ps1`, Render start command | ASGI server executing `app.main:app`. | **Fully Implemented** |
| **Pydantic & `pydantic-settings`** | `2.10.6` / `2.7.1` | `app/core/config.py`, `app/schemas/*.py` | Environment variable parsing (`Settings`) and request/response schema validation. | **Fully Implemented** |
| **psycopg2-binary** | `2.9.10` | `app/core/database.py`, `migrations/env.py` | Synchronous PostgreSQL driver wrapped in `ThreadedConnectionPool` and called asynchronously via `asyncio.to_thread()`. | **Fully Implemented** |
| **AsyncPG (`asyncpg`)** | `0.30.0` | Listed in `requirements.txt` | **Unused Dependency:** Despite the class in `app/core/database.py` being named `AsyncPGPool`, it actually imports `psycopg2.pool.ThreadedConnectionPool`, **not** `asyncpg`. | **Disconnected / Unused** |
| **SQLAlchemy & Alembic** | `2.0.38` / `1.14.1` | `migrations/env.py`, `migrations/versions/*.py` | Used exclusively for schema migrations; runtime queries use raw parameterized SQL strings (`%s`), not SQLAlchemy ORM. | **Partially Implemented** |
| **Google GenAI SDK (`google-genai`)** | `1.2.0` | `ingestion_service.py`, `embedding_service.py`, `router_engine.py`, `rag_engine.py` | Interfaces with `gemini-2.5-flash` (extraction, routing, RAG synthesis) and `gemini-embedding-001` (768-d vectors). | **Fully Implemented** |
| **PyJWT** | `2.10.1` | `auth_service.py`, `middleware.py`, `v1_compat.py` | Encodes and decodes HS256 session JWTs. | **Fully Implemented** (Bypassed in `v1_compat.py`) |
| **APScheduler** | `3.11.0` | `app/main.py` (`AsyncIOScheduler`) | Schedules `run_nightly_retention_sweep` daily at 02:00 IST. | **Fully Implemented** |
| **FastMCP (`mcp[cli]`)** | `1.3.0` | `app/mcp_server.py` | Exposes 14 campus query functions over the Model Context Protocol. | **Partially Implemented** |
| **PyMuPDF (`fitz`), `python-docx`, `openpyxl`, `Pillow`** | `1.25.3`, `1.1.2`, `3.1.5`, `11.1.0` | `app/services/ingestion_service.py`, `v1_compat.py` | Extracts text/tables from PDF, DOCX, and XLSX files and prepares images for Gemini Vision OCR. | **Fully Implemented** |
| **HTTPX** | `0.28.1` | `app/services/auth_service.py`, `tests/` | Sends transactional OTP emails via Resend REST API (`https://api.resend.com/emails`) and powers `TestClient`. | **Fully Implemented** |

---

### 3.3 Database, Caching & Storage Stack

| Component | Technology | Where Used | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Relational Database** | PostgreSQL 16 (Supabase Cloud in `.env`; Docker `pgvector/pgvector:pg16` in `docker-compose.yml`) | `app/core/database.py` | Stores all 13 application tables and 4 observability views. | **Fully Implemented** |
| **Vector Search Extension** | `pgvector` (`vector(768)`) | `doc_chunks.embedding`, `app/services/rag_engine.py` | HNSW cosine similarity search (`<=>`) over 768-dimensional document chunk embeddings. | **Fully Implemented** |
| **Fuzzy Text Extension** | `pg_trgm` | `faculty`, `menu_items`, `doc_chunks` | GIN trigram indexes (`similarity()`, `%`) for typo-tolerant faculty, menu, and document retrieval. | **Fully Implemented** |
| **Application Cache** | Custom In-Memory Python Dict (`RAMCache` in `app/services/cache_service.py`) | `cache_service.py` | Caches active dataset scopes (`timetable:CSE-3-A`, `menu`, `events`, `holidays`, `faculty`) in process RAM with a 60-second TTL (`CACHE_TTL_SECONDS = 60`). No Redis is used. | **Fully Implemented** |
| **File Storage** | Local Disk (`storage/uploads/`) | `uploads.py`, `v1_compat.py`, `admin_actions.py`, `sweeper_service.py` | Stores uploaded binary files as `{uuid}_{filename}` and serves them via HMAC-SHA256 signed URLs (`/api/files/{id}/raw`). Note: Ephemeral on Render free/starter instances. | **Fully Implemented** |

---

### 3.4 External Services & Infrastructure

| Service | Provider / Endpoint | Configuration Variable | Where Integrated | Status |
| :--- | :--- | :--- | :--- | :--- |
| **LLM & Embeddings** | Google Gemini API (`gemini-2.5-flash`, `gemini-embedding-001`) | `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` | `app/core/config.py` (`GeminiAPIKeyRotator`) -> `ingestion_service.py`, `embedding_service.py`, `router_engine.py`, `rag_engine.py` | **Fully Implemented** |
| **Transactional Email** | Resend API (`https://api.resend.com/emails`) | `RESEND_API_KEY`, `EMAIL_FROM` | `app/services/auth_service.py:130-156` (`send_otp_email`). Falls back to console/log output when `RESEND_API_KEY` is empty. | **Partially Implemented** (Unconfigured in `.env`) |
| **Managed PostgreSQL** | Supabase PostgreSQL (`db.qfrrcwsetmbggreiefcd.supabase.co:5432`) | `DATABASE_URL`, `DATABASE_URL_READONLY` | `app/core/database.py` | **Fully Implemented** |
| **Backend Hosting** | Render (`https://campusos-api-5662.onrender.com`) | `.env.production`, `.github/workflows/uptime_ping.yml` | Hosts the FastAPI backend container/service. | **Fully Implemented** |
| **Frontend Hosting** | Vercel (`https://campus-buddy-iota.vercel.app`) | `app/core/config.py` (`CORS_ORIGINS`), `frontend-next/.env.local` | Hosts the `frontend-next` Next.js application. | **Fully Implemented** |
| **Keep-Alive Cron** | GitHub Actions | `.github/workflows/uptime_ping.yml` | Pings Render `/health` and `/ready` every 14 minutes (`*/14 * * * *`) to prevent Render free-tier cold sleep. | **Fully Implemented** |

---

## 4. Actual System Architecture

### 4.1 Architectural Pattern: Split-Brain Monolith with Dual Frontends & Dual API Surfaces

Inspection of the source code reveals that the repository underwent an architectural transition (from "CampusOS" to "CampusBuddy") and currently operates as a **Dual-Frontend, Dual-API Monolith**:

1. **Generation 1 ("CampusOS" — `/api/*` + `frontend/`):**
   - Built around strict security and deterministic engineering: `SessionSecurityMiddleware` enforces passwordless email OTP authentication (`auth_otps`), `HttpOnly` JWT cookies (`campus_session`), database-backed `token_version` revocation, and double-submit CSRF tokens (`campus_csrf` / `X-CSRF-Token`).
   - Uses modular routers (`auth.py`, `me.py`, `uploads.py`, `approval.py`, `admin_actions.py`, `student_queries.py`, `sweeper_service.py`) and a dedicated read-only database pool (`db_pool_ro`) for student queries vs. a read-write pool (`db_pool_rw`) for mutations.
   - Paired with the Vite + React 18 SPA in `frontend/`.

2. **Generation 2 ("CampusBuddy" — `/v1/*` + `frontend-next/`):**
   - Instead of adapting the new Next.js 16 frontend (`frontend-next/`) to use the existing `/api/*` contract and cookie/CSRF middleware, a 1,669-line compatibility router (`app/routers/v1_compat.py`) was bolted onto the FastAPI app under `/v1/*`, and `SessionSecurityMiddleware` was modified (`app/core/middleware.py:39`) to **completely bypass `/v1/*`**.
   - `v1_compat.py` re-implements authentication (using hardcoded credentials and unverified Bearer JWTs), re-implements chat orchestration, re-implements upload/review/approval SQL queries, and stores conversation history and user profile edits in in-memory Python dictionaries (`_conversations`, `_messages`, `_user_prefs`).
   - Both `/api/*` and `/v1/*` share the underlying core services (`cache_service`, `tier0_engine`, `router_engine`, `rag_engine`, `ingestion_service`, `validators`, `time_engine`) and the same PostgreSQL connection pools (`db_pool_rw`, `db_pool_ro`).

### 4.2 System Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["Client Layer (Dual Frontends + MCP)"]
        NextUI["Primary Frontend: frontend-next/<br/>(Next.js 16, React 19, Tailwind v4)<br/>Vercel: campus-buddy-iota.vercel.app"]
        ViteUI["Legacy Frontend: frontend/<br/>(Vite 6, React 18, Axios)<br/>Local Port 5173"]
        MCPClient["External AI / Claude Desktop<br/>(MCP Client over stdio)"]
    end

    subgraph FastAPI["FastAPI Backend Server (app/main.py — Render: campusos-api-5662.onrender.com)"]
        CORS["CORSMiddleware<br/>(Allow Credentials, Origins)"]
        SecMW["SessionSecurityMiddleware (app/core/middleware.py)<br/>Enforces campus_session JWT + X-CSRF-Token ONLY on /api/*<br/>EXEMPTS: /v1/*, /mcp*, /health, /ready, /api/auth/*, /api/files/*/raw"]

        subgraph V1Layer["/v1/* Compatibility Layer (app/routers/v1_compat.py)"]
            V1Auth["/v1/auth/* (Hardcoded Login, Unverified JWT, Default Admin Fallback)"]
            V1Data["/v1/timetable, /v1/menu, /v1/faculty, /v1/calendar, /v1/events"]
            V1Chat["/v1/chat & /v1/chat/stream (In-memory _conversations + Simulated SSE)"]
            V1Admin["/v1/ingestion/*, /v1/sources, /v1/admin/system, /v1/admin/memberships"]
        end

        subgraph APILayer["/api/* Modular Router Layer (app/routers/*.py)"]
            APIAuth["auth.py (/api/auth/request-otp, /verify-otp, /logout)"]
            APIMe["me.py (/api/me)"]
            APIStudent["student_queries.py (/api/dashboard/next-class, /timetable, /menu, /events, /faculty, /holidays, /query)"]
            APIUpload["uploads.py (/api/uploads)"]
            APIApproval["approval.py (/api/submissions/*)"]
            APIAdmin["admin_actions.py & sweeper_service.py (/api/admin/rollback, /sweep-expired, /api/files/*)"]
        end

        subgraph CoreServices["Shared Core Services & 3-Tier AI Engine (app/services/)"]
            Tier0["tier0_engine.py<br/>(Deterministic Regex <5ms)"]
            RouterEng["router_engine.py<br/>(Tier 1/2 Gemini Function Calling)"]
            ToolExec["tool_executor.py<br/>(6 Structured Campus Tools)"]
            RAGEng["rag_engine.py<br/>(Hybrid pgvector + pg_trgm + Gemini Synthesis)"]
            IngestSvc["ingestion_service.py & validators.py<br/>(PyMuPDF/DOCX/XLSX + Gemini OCR + Cell Rules)"]
            TimeEng["time_engine.py<br/>(IST Clock & Next-Class Resolver)"]
            CacheSvc["cache_service.py<br/>(60s TTL RAM Cache + In-Memory Test Fallbacks)"]
            Sweeper["sweeper_service.py<br/>(APScheduler 02:00 IST Nightly Sweep)"]
        end
    end

    MCPServer["app/mcp_server.py<br/>(FastMCP Server — 14 Tools)"]

    subgraph StorageLayer["Persistence & External Services"]
        PG[("Supabase PostgreSQL 16<br/>(pgvector + pg_trgm)<br/>13 Tables + 4 Views")]
        LocalDisk[("Local Disk: storage/uploads/<br/>(Signed File Storage)")]
        GeminiAPI["Google Gemini API<br/>(gemini-2.5-flash & gemini-embedding-001)<br/>3-Key Rotator"]
        ResendAPI["Resend Email API<br/>(https://api.resend.com/emails)"]
    end

    NextUI -->|"Bearer Token (localStorage)<br/>REST + SSE (/v1/*)"| CORS
    ViteUI -->|"HttpOnly Cookie + X-CSRF-Token<br/>REST (/api/*)"| CORS
    CORS --> SecMW
    SecMW -->|"/v1/* (Bypassed)"| V1Layer
    SecMW -->|"/api/* (Verified)"| APILayer

    V1Data --> CacheSvc
    V1Chat --> Tier0
    V1Chat --> RouterEng
    V1Chat --> RAGEng
    V1Admin --> IngestSvc
    V1Admin --> CacheSvc

    APIAuth --> ResendAPI
    APIStudent --> TimeEng
    APIStudent --> CacheSvc
    APIStudent --> Tier0
    APIStudent --> RouterEng
    APIStudent --> RAGEng
    APIUpload --> IngestSvc
    APIApproval --> IngestSvc
    APIApproval --> CacheSvc

    MCPClient -->|"stdio"| MCPServer
    MCPServer --> CoreServices

    RouterEng --> ToolExec
    ToolExec --> CacheSvc
    CacheSvc -->|"AsyncPGPool (psycopg2 threads)"| PG
    RAGEng -->|"pgvector <=> + pg_trgm"| PG
    IngestSvc --> LocalDisk
    IngestSvc --> PG
    Sweeper --> PG
    Sweeper --> LocalDisk

    RouterEng --> GeminiAPI
    RAGEng --> GeminiAPI
    IngestSvc --> GeminiAPI
```

---

## 5. Complete Frontend Investigation

### 5.1 Primary Frontend: `frontend-next/` (Next.js 16 + React 19)

#### 5.1.1 Routing & Layout Structure
- **`frontend-next/src/app/layout.tsx`**: Root layout loading Google Fonts (`Instrument Serif`, `Plus Jakarta Sans`, `JetBrains Mono`) and applying the light editorial theme (`#FAF7F2` background).
- **`frontend-next/src/app/page.tsx`**: Renders `<CampusApp />` (`frontend-next/src/components/campus-app.tsx`).
- **`frontend-next/src/app/reset-password/page.tsx`**: Standalone password reset page (`/reset-password?token=...`) that posts `{ token, new_password }` to `POST /v1/auth/update-password`.

#### 5.1.2 State Management & API Client (`frontend-next/src/lib/api.ts`)
- No Redux, Zustand, or React Context is used in `frontend-next/`. All global state lives inside the root `<CampusApp />` component (`campus-app.tsx:468-540`) and is passed down via props.
- **API Base URL (`api.ts:3-4`)**: Reads `process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"` and appends `/v1` (`API_BASE = "${RAW_API_BASE}/v1"`).
- **Token Storage (`api.ts:6-13`)**: Stores the JWT in `window.localStorage.getItem("campus_token")`.
- **Request Wrapper (`apiFetch`, `api.ts:15-50`)**: Automatically attaches `Authorization: Bearer ${token}` and `Content-Type: application/json` (unless `FormData`).
- **Streaming Client (`streamChat`, `api.ts:52-88`)**: Sends `POST /v1/chat/stream` and reads `res.body.getReader()`, splitting lines starting with `data: ` and invoking `onDelta(parsed.delta)` and `onDone(parsed.payload)`.

#### 5.1.3 Detailed View & Component Inventory (`frontend-next/`)

| View / Component | File & Lines | User Actions & UI Elements | Backend API Calls Triggered | Implementation Status & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Auth / Login Screen** | `campus-app.tsx:660-1146` (`AuthScreen`) | Sign In, Sign Up (Student/Admin role toggle), Forgot Password, Demo autofill pills (`student@campus.edu.in` / `123456`, `admin@campus.edu.in` / `123456`). | `POST /v1/auth/login`, `POST /v1/auth/signup`, `POST /v1/auth/reset-password`, followed by `GET /v1/me` and `PATCH /v1/me`. | **Partially Implemented / Simulated:** Login only accepts hardcoded credentials in `v1_compat.py:124-190`. Signup (`v1_compat.py:193-241`) mints a token without inserting into `users`. |
| **Top & Side Navigation Shell** | `campus-app.tsx:468-658` (`CampusApp`) | Role switcher (`student` vs `admin`), Semester/Section selector (`S3 · CSE-A`, `S3 · CSE-B`, `S5 · CSE-A`), Command Palette (`⌘K`), Notification Bell popover, Profile Drawer. | `GET /v1/me`, `PATCH /v1/me` (on profile save). Notification Bell and Command Palette are purely local state. | **Partially Implemented:** Navigation & `PATCH /v1/me` work (saved to RAM dict `_user_prefs` in `v1_compat.py`), but notifications (`NOTIFS` array) are hardcoded. |
| **Home Dashboard (`HomeView` — Student Mode)** | `campus-app.tsx:1367-1579` | Displays "Next Class in 24m" card with "Mark attendance" button, "Attendance 89.4%" ring chart, "Today's Schedule" 4-slot preview, "Lunch Pick: Paneer Rice Bowl ₹90", "This Week" stats (`17/19 classes`, `₹410 spend`). | **None** (Zero API calls inside `HomeView`). | **Mock Data / Simulated:** `mins` countdown starts at `24` (`line 1164`), `checkedIn` toggles local toast (`line 1419`), schedule preview uses static `TIMETABLE` constant (`lines 92-99`). |
| **Home Dashboard (`HomeView` — Admin Mode)** | `campus-app.tsx:1185-1365` | Displays 4 KPI cards (`128 Documents`, `1,942 Canteen orders`, `4,310 Active students`, `91.2% Attendance`), "Needs review" queue (`menu-nov-w2.jpg`, `circular-117.pdf`, `cse-s3b-timetable.pdf`) with Approve/Dismiss buttons, and "Canteen orders by hour" bar chart. | **None** (Zero API calls). | **Mock Data / Simulated:** Clicking "Approve" or "Dismiss" (`lines 1308-1320`) only filters local React state `reviews` and triggers `onToast`. |
| **AI Chat Assistant (`ChatView`)** | `chat-view.tsx:1-292` & `campus-app.tsx:1581-1728` | Conversation sidebar (New Chat, thread list), prompt suggestion pills, message input, streaming typing indicator, source badges, and rich `<ResultCards />`. | `GET /v1/conversations`, `GET /v1/conversations/{id}/messages`, `POST /v1/chat/stream` (fallback to `POST /v1/chat`). | **Fully Implemented** (Note: backend SSE is chunked post-generation and conversations live in RAM dict `_conversations`). |
| **Structured Result Cards (`ResultCards`)** | `result-cards.tsx:1-974` | Renders domain-specific cards inside chat replies: `TimetableCard`, `FoodCard`, `FacultyCard`, `CalendarCard`, `EventsCard`, `GeneralDocsCard`, `ConflictsCard`, `EmailSearchCard`. | Rendered from `payload` returned by `/v1/chat` or `/v1/chat/stream`. | **Fully Implemented** |
| **Campus Directory (`BrowseView`)** | `browse-view.tsx:1-385` | 5 sub-tabs: **Timetable** (Section selector, Day/Week toggle, `<TimetableCardTable />`), **Canteen** (search, max budget slider, diet/meal filters), **Faculty** (department/search filter), **Calendar** (holidays & exam milestones), **Events** (category filter). | `GET /v1/timetable`, `GET /v1/faculty`, `GET /v1/menu`, `GET /v1/calendar`, `GET /v1/events`. | **Fully Implemented:** Connected to real backend endpoints backed by `cache_service` and PostgreSQL. |
| **Timetable Grid Renderer (`TimetableCardTable`)** | `timetable-card-table.tsx:1-894` & `timetable-legend.ts` | Renders interactive Monday–Saturday time-slot matrix, resolves course codes and faculty abbreviations, and shows course legend table. | Consumes slots from `GET /v1/timetable` or chat `TimetableCard`, enriched with fallback metadata from `timetable-legend.ts`. | **Fully Implemented** |
| **Canteen Menu Manager (`MenuManagerView`)** | `campus-app.tsx:1730-1906` | Admin-only tab to search dishes, filter by meal (`Breakfast`, `Lunch`, `Snacks`, `Beverages`), toggle item availability (`Live` / `Sold out`), increment/decrement prices (`-₹5` / `+₹5`), and add new dishes via modal. | **None** (Zero API calls). | **UI Only / Mock Data:** Operates exclusively on local React state initialized from `INITIAL_FOOD` (`lines 101-113`). |
| **Admin Console (`AdminView`)** | `admin-view.tsx:1-922` | 6 sub-tabs:<br/>1. **Upload** (`UploadZone`): Drag-and-drop file upload with category/section metadata.<br/>2. **Review Queue** (`ReviewQueue`): Inspect ingestion jobs, edit JSON/table records, Approve, Reject, Apply Mapping, Retry.<br/>3. **Data Sources** (`DataSources`): View sources & click Re-index.<br/>4. **System Health** (`SystemHealth`): View table counts, audit log, verification status.<br/>5. **Members** (`Members`): View & invite/update members.<br/>6. **Docs** (`AdminDocs`): Static documentation cards. | **Working calls:** `GET /v1/ingestion`, `GET /v1/sources`, `POST /v1/ingestion/upload`, `GET /v1/ingestion/{id}`, `POST /v1/ingestion/{id}/approve`, `POST /v1/ingestion/{id}/reject`, `GET /v1/admin/system`, `GET /v1/admin/memberships`.<br/>**Broken calls (404/405):** `POST /v1/ingestion/{id}/mapping`, `POST /v1/ingestion/{id}/retry`, `POST /v1/sources/{id}/reindex`, `POST /v1/admin/memberships`. | **Partially Implemented:** Upload, Review Queue listing, Approve, and Reject work against `/v1/ingestion/*`. However, Apply Mapping, Retry Job, Re-index Source, and Add Member call nonexistent backend endpoints (`404`/`405`), and cell editing (`PATCH /v1/ingestion/{id}/records`) is never called by `admin-view.tsx`. |
| **Settings & Integrations (`SettingsView`)** | `settings-view.tsx:1-284` | Edit Student Profile (`branch`, `semester`, `section`, `dietary`, `budget_inr`, `courses`) and manage External Connectors (`Google Calendar`, `Gmail Connector`). | `PATCH /v1/me` (works); `GET /v1/integrations` (returns static list); `POST /v1/integrations/{p}/connect`, `POST .../sync`, `DELETE .../{p}` (**all 404**). | **Partially Implemented / Broken Integrations:** Profile save updates `_user_prefs` in RAM. External connector buttons fail with `404` (silently caught by `catch {}` in `settings-view.tsx:48,66,79`). |

---

### 5.2 Secondary / Legacy Frontend: `frontend/` (Vite 6 + React 18 SPA)

Launched by `run_frontend.ps1` on port `5173`, `frontend/` is a clean, functional SPA that communicates exclusively with the `/api/*` backend routes using `HttpOnly` cookies and `X-CSRF-Token`.

| Component | File Path | Connected `/api/*` Endpoints | Implementation Status |
| :--- | :--- | :--- | :--- |
| **AuthContext & API Client** | `frontend/src/context/AuthContext.tsx`, `frontend/src/lib/api.ts` | `GET /api/me`, `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/logout`, `PATCH /api/me` | **Fully Implemented** |
| **LoginView & OnboardingModal** | `frontend/src/components/auth/LoginView.tsx`, `OnboardingModal.tsx` | 2-step email OTP login (`dev_otp` auto-filled in dev mode) and first-login Branch/Year/Section onboarding modal (`PATCH /api/me`). | **Fully Implemented** |
| **Dashboard Cards** | `NextClassCard.tsx`, `MessMenuCard.tsx`, `EventsCard.tsx`, `TimetableCard.tsx` | `GET /api/dashboard/next-class` (polls every 60s), `GET /api/menu`, `GET /api/events`, `GET /api/timetable?scope=week` | **Fully Implemented** |
| **Legacy BrowseView** | `frontend/src/components/browse/BrowseView.tsx` | `GET /api/timetable`, `GET /api/menu`, `GET /api/faculty`, `GET /api/holidays`, `GET /api/events` | **Fully Implemented** |
| **Legacy ChatView** | `frontend/src/components/chat/ChatView.tsx` | `POST /api/query` (displays Tier badge `T0`/`T1`/`T2`, latency in ms, and structured cards). | **Fully Implemented** |
| **Admin Upload & Split-Pane Review** | `UploadCard.tsx`, `SubmissionReviewDetail.tsx` | `POST /api/uploads`, `GET /api/submissions`, `GET /api/submissions/{id}`, `GET /api/files/{id}/url` (iframe preview), `PATCH /api/submissions/{id}` (debounced 400ms live cell validation), `POST .../approve`, `POST .../reject`, `POST /api/admin/rollback` | **Fully Implemented** (Subject to DB schema drift; see Section 7.4) |
| **Legacy SettingsView** | `frontend/src/components/settings/SettingsView.tsx` | `PATCH /api/me` (`branch`, `year`, `section`, `budget_default`) | **Fully Implemented** |

---

## 6. Complete Backend Investigation & API Endpoint Inventory

### 6.1 FastAPI Application Lifecycle (`app/main.py`)
When `app/main.py` starts:
1. **`lifespan(app)` (`app/main.py:29-61`)**:
   - Initializes `db_pool_rw` (Read-Write pool, `minconn=1, maxconn=10`) and `db_pool_ro` (Read-Only pool, `minconn=1, maxconn=20`) via `app/core/database.py`. If PostgreSQL connection fails on startup, it logs a warning and continues running (`Database pool initialization warning`), allowing fallback to in-memory test dictionaries.
   - Starts an `AsyncIOScheduler` job (`run_nightly_retention_sweep` from `app/services/sweeper_service.py`) scheduled via `CronTrigger(hour=2, minute=0, timezone=IST)`.
2. **Middleware Stack (`app/main.py:72-84`)**:
   - `SessionSecurityMiddleware` (`app/core/middleware.py`): Added first (inner middleware).
   - `CORSMiddleware`: Added second (outer middleware) with `allow_origins=settings.CORS_ORIGINS` (`http://localhost:3000`, `http://localhost:5173`, `https://campus-buddy-iota.vercel.app`, `https://campusos-api.onrender.com`, `https://campusos-api-5662.onrender.com`) and `allow_credentials=True`.
3. **Router Registration (`app/main.py:87-95`)**:
   - Registers `health.router`, `auth.router`, `me.router`, `uploads.router`, `approval.router`, `admin_actions.router`, `student_queries.router`, `sweeper_Router`, and `v1_compat.router`.

### 6.2 Core Backend Services (`app/services/`)

| Service Module | Key Functions / Classes | Internal Responsibilities | Status |
| :--- | :--- | :--- | :--- |
| **`auth_service.py`** | `generate_otp()`, `compute_otp_hmac()`, `create_otp_for_email()`, `verify_otp_for_email()`, `create_session_jwt()`, `send_otp_email()` | Generates 6-digit numeric OTPs, hashes them with `HMAC-SHA256(JWT_SECRET, f"{email}:{otp}")`, enforces 10-minute expiry and 5-attempt lockout in `auth_otps` (or `_mock_otps`), auto-provisions `users` rows on verification, and signs HS256 JWTs (`sub`, `email`, `role`, `token_version`). | **Fully Implemented** |
| **`cache_service.py`** | `RAMCache`, `get_active_version()`, `invalidate_scope()`, `get_timetable()`, `get_menu()`, `get_events()`, `get_holidays()`, `get_faculty()` | Implements a 60s TTL in-memory cache (`_ram_cache`) keyed by scope (`timetable:CSE-3-A`, `menu`, `events`, `holidays`, `faculty`) and version (`v{N}` from `data_versions`). Falls back to `_mock_store` when DB queries fail or return empty. | **Fully Implemented** (Contains SQL column drift vs migrations) |
| **`time_engine.py`** | `get_now_ist()`, `resolve_next_class()` | Computes live Indian Standard Time (`UTC+05:30`) and evaluates `timetable_slots` + `holidays` across a 7-day lookahead window to find `ongoing` and `next_class` slots. | **Fully Implemented** |
| **`tier0_engine.py`** | `evaluate_tier0(query, user_profile)` | Zero-LLM deterministic regex classifier (<5ms) handling 4 high-frequency intents: Next Class (`next class`, `current class`, `where should i go`), Today's Schedule (`today's schedule`, `classes today`), Canteen Menu (`mess menu`, `what to eat`, `under ₹X`, `veg`), and Holidays (`next holiday`, `is tomorrow a holiday`). | **Fully Implemented** |
| **`router_engine.py`** | `route_and_execute_query(query, user_profile)` | Tier 1/2 LLM router using `gemini-2.5-flash` with `temperature=0.0` and 6 structured `FunctionDeclaration` tools (`get_next_class`, `get_timetable`, `get_mess_menu`, `get_campus_events`, `search_faculty`, `check_academic_holidays`). If Gemini selects a tool, `tool_executor.py` runs it and Gemini synthesizes a grounded answer (`tier=1`). If no tool matches or `is_complex_policy_query()` matches, escalates to `run_rag_pipeline()` (`tier=2`). Includes a deterministic keyword fallback when Gemini keys are missing or rate-limited. | **Fully Implemented** |
| **`rag_engine.py`** | `hybrid_retrieve_chunks()`, `run_rag_pipeline()` | Generates a 768-dim query embedding (`embedding_service.py`), queries `doc_chunks` joined with `data_versions` (`scope = 'docs'` AND `valid_until >= CURRENT_DATE`) using `0.7 * cosine_similarity + 0.3 * trigram_similarity`, filters by threshold `>= 0.30`, and prompts `gemini-2.5-flash` to synthesize an answer with `[Source: Title]` citations. | **Fully Implemented** |
| **`ingestion_service.py`** | `extract_text_from_pdf()`, `extract_from_docx()`, `extract_from_xlsx()`, `extract_structured_with_gemini()`, `chunk_document_text()`, `process_document_upload()` | Extracts raw text/tables locally via PyMuPDF (`fitz`), `python-docx`, or `openpyxl`. If a PDF has `< 30` characters per page (scanned PDF) or is an image, sends raw bytes to Gemini 2.5 Flash Vision with Pydantic `response_schema`. Chunks unstructured notices/syllabi into ~1,600-char overlapping segments with 768-dim embeddings. | **Fully Implemented** |
| **`validators.py`** | `validate_extracted_data()`, `validate_timetable_rows()`, `validate_menu_rows()`, `validate_holiday_rows()`, `validate_faculty_rows()` | Runs deterministic cell-level validation rules (e.g., `end_time <= start_time` -> red `error`; room overlap on same day -> `error`; split batch `/` -> amber `warning`; missing `is_veg` -> `warning`; price `<= 0` or `> 2000` -> `error`) and outputs `{ cells: {"row.col": {type, message}}, has_errors, has_warnings }`. | **Fully Implemented** |
| **`sweeper_service.py`** | `run_nightly_retention_sweep()` | Purges expired `events`, deletes unreferenced `files` rows and physical files in `storage/uploads/` older than `FILE_RETENTION_DAYS` (30 days) while preserving active version and `prev_version` rollback targets, and deletes `auth_otps` older than 24 hours. | **Fully Implemented** |

---

### 6.3 Complete API Endpoint Inventory (All 49 Registered Endpoints)

#### A. Health & Observability (`app/routers/health.py`)
| Method | Route Path | Handler Function | Auth Required | Database / Service Interaction | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` & `/api/health` | `liveness_check()` | Public | None (returns `{"status": "ok", "service": "CampusOS API"}`). | **Fully Implemented** |
| `GET` | `/ready` & `/api/ready` | `readiness_check()` | Public | Runs `SELECT 1` on both `db_pool_rw` and `db_pool_ro`. Returns `503` if DB is unreachable. | **Fully Implemented** |

#### B. Generation 1 `/api/*` Endpoints (`app/routers/*.py`)
| Method | Route Path | Handler Function | Auth / Role Required | Request / Response & Database Operations | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/request-otp` | `auth.py:request_otp()` | Public | Body: `{email}`. Inserts HMAC-SHA256 OTP into `auth_otps` and sends email via Resend (returns `dev_otp` if `APP_ENV=development`). | **Fully Implemented** |
| `POST` | `/api/auth/verify-otp` | `auth.py:verify_otp()` | Public | Body: `{email, otp}`. Verifies `auth_otps`, upserts `users`, sets `campus_session` (`HttpOnly`) and `campus_csrf` cookies. | **Fully Implemented** |
| `POST` | `/api/auth/logout` | `auth.py:logout()` | Session Cookie + CSRF | Increments `users.token_version` in `db_pool_rw` to invalidate all active JWTs and clears cookies. | **Fully Implemented** |
| `GET` | `/api/me` | `me.py:get_my_profile()` | Session Cookie | Queries `users` (fallback to in-memory `_mock_profiles`) and returns `{id, email, role, branch, year, section, budget_default}`. | **Fully Implemented** |
| `PATCH` | `/api/me` | `me.py:update_my_profile()` | Session Cookie + CSRF | Updates `branch`, `year`, `section`, `budget_default` in `users` (`db_pool_rw`) and `_mock_profiles`. | **Fully Implemented** |
| `GET` | `/api/dashboard/next-class` | `student_queries.py:get_dashboard_next_class()` | Session Cookie | Resolves user's `timetable:{branch}-{year}-{section}` via `time_engine.resolve_next_class()`. | **Fully Implemented** |
| `GET` | `/api/timetable` | `student_queries.py:get_student_timetable()` | Session Cookie | Returns cached timetable slots from `cache_service.get_timetable()` (`scope=today` or `week`). | **Fully Implemented** |
| `GET` | `/api/menu` | `student_queries.py:get_mess_menu()` | Session Cookie | Filters `cache_service.get_menu()` by `veg`, `max_price`, `meal`, `day`. | **Fully Implemented** |
| `GET` | `/api/events` | `student_queries.py:get_campus_events()` | Session Cookie | Filters `cache_service.get_events()` by `club`. | **Fully Implemented** |
| `GET` | `/api/faculty` | `student_queries.py:search_faculty_directory()` | Session Cookie | Searches `cache_service.get_faculty(query=q)` using trigram/substring match. | **Fully Implemented** |
| `GET` | `/api/holidays` | `student_queries.py:get_academic_holidays()` | Session Cookie | Returns active holidays from `cache_service.get_holidays()`. | **Fully Implemented** |
| `POST` | `/api/query` | `student_queries.py:post_student_query()` | Session Cookie + CSRF | Runs Tier 0 (`evaluate_tier0`) -> Tier 1/2 (`route_and_execute_query`), logs metrics to `query_logs`, returns `{tier, answer, card, citations, latency_ms}`. | **Fully Implemented** |
| `POST` | `/api/uploads` | `uploads.py:upload_document()` | Cookie + CSRF (`admin`, `Approver`, `Verifier`) | Validates extension & 15MB limit, saves to `storage/uploads/`, inserts into `files` & `submissions`, triggers background extraction `_run_extraction_job`. | **Partially Implemented** (SQL column drift vs `001_initial_schema.py`) |
| `GET` | `/api/submissions` | `approval.py:list_submissions()` | Cookie (`admin`, `Approver`, `Verifier`) | Lists submissions from `submissions` table (or `_mock_submissions`). | **Fully Implemented** |
| `GET` | `/api/submissions/{id}` | `approval.py:get_submission_detail()` | Cookie (`admin`, `Approver`, `Verifier`) | Returns submission detail, extracted rows, and validation confidence flags. | **Partially Implemented** (Selects `submitted_by`, `data_payload`, `reviewed_by`, `target_version`) |
| `PATCH` | `/api/submissions/{id}` | `approval.py:patch_submission_extracted_data()` | Cookie + CSRF (`admin`, `Approver`, `Verifier`) | Re-runs `validate_extracted_data()` on edited rows and updates `submissions`. | **Partially Implemented** (Updates `data_payload`) |
| `POST` | `/api/submissions/{id}/approve` | `approval.py:approve_submission()` | Cookie + CSRF (`admin`, `Approver`) | Blocks if `has_errors=True`. Atomically increments `version`, inserts into target table (`timetable_slots`, `menu_items`, `holidays`, `faculty`, `doc_chunks`, `events`), updates `data_versions` & `audit_log`, invalidates `cache_service`. | **Partially Implemented** (SQL column drift vs `001_initial_schema.py`) |
| `POST` | `/api/submissions/{id}/reject` | `approval.py:reject_submission()` | Cookie + CSRF (`admin`, `Approver`, `Verifier`) | Sets `status='rejected'` and logs to `audit_log`. | **Partially Implemented** |
| `POST` | `/api/admin/rollback` | `admin_actions.py:rollback_scope_version()` | Cookie + CSRF (`admin`, `Approver`) | Swaps `data_versions.active_version` with `prev_version` (`O(1)` pointer swap), writes `audit_log`, invalidates RAM cache. | **Partially Implemented** |
| `GET` | `/api/files/{file_id}/url` | `admin_actions.py:get_file_signed_url()` | Cookie (`admin`, `Approver`, `Verifier`) | Generates 15-minute HMAC-SHA256 signed URL `/api/files/{file_id}/raw?expires=...&sig=...`. | **Fully Implemented** |
| `GET` | `/api/files/{file_id}/raw` | `admin_actions.py:serve_raw_file()` | Public with HMAC signature | Verifies `sig` & `expires`, streams file from `storage/uploads/` via `FileResponse`. | **Fully Implemented** |
| `POST` | `/api/admin/sweep-expired` | `sweeper_service.py:trigger_manual_sweep()` | Cookie + CSRF (`admin`, `Approver`) | Manually invokes `run_nightly_retention_sweep()`. | **Fully Implemented** |

#### C. Generation 2 `/v1/*` Compatibility Endpoints (`app/routers/v1_compat.py`)
> **Security Note:** Every `/v1/*` route below is exempted from `SessionSecurityMiddleware` and uses `_resolve_v1_user(request)` (`v1_compat.py:48-105`), which does not verify JWT signatures and defaults unauthenticated callers to `institution_admin`.

| Method | Route Path | Handler Function | Actual Backend Behavior | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/login` | `v1_login()` (`line 124`) | Checks password against hardcoded strings (`123456`, `CampusAdmin123!`, `admin123`). Never queries `users`. Returns JWT + static user profile. | **Simulated / Hardcoded** |
| `POST` | `/v1/auth/signup` | `v1_signup()` (`line 193`) | Validates password length `>= 6`, generates random UUID, returns JWT. Never inserts into `users`. | **Simulated** |
| `POST` | `/v1/auth/reset-password` | `v1_reset_password()` (`line 244`) | Returns fake reset token & URL `/reset-password?token=...`. Never emails or stores token. | **Simulated** |
| `POST` | `/v1/auth/update-password` | `v1_update_password()` (`line 262`) | Checks `len(new_password) >= 6` and returns `{"status": "ok"}`. Never updates any password. | **Simulated** |
| `GET` | `/v1/me` | `v1_get_me()` (`line 272`) | Merges JWT claims with in-memory `_user_prefs[user_id]` dict. | **Partially Implemented** (Volatile RAM state) |
| `PATCH` | `/v1/me` | `v1_patch_me()` (`line 301`) | Saves profile updates into in-memory `_user_prefs[user_id]`. Lost on restart. | **Partially Implemented** (Volatile RAM state) |
| `GET` | `/v1/menu` | `v1_get_menu()` (`line 322`) | Reads `cache_service.get_menu()`, fabricates `protein_g` and `calories` from price (`lines 349-350`), filters by meal/diet/budget/query. | **Partially Implemented** (Synthetic nutrition data) |
| `GET` | `/v1/faculty` | `v1_get_faculty()` (`line 389`) | Reads `cache_service.get_faculty()`, maps fields for Next.js UI. | **Fully Implemented** |
| `GET` | `/v1/timetable` | `v1_get_timetable()` (`line 428`) | Reads `cache_service.get_timetable()` for section (`CSE-A`/`CSE-B`), maps slots and course legend. | **Fully Implemented** |
| `GET` | `/v1/calendar` | `v1_get_calendar()` (`line 863`) | Reads holidays from `cache_service.get_holidays()`, appends 2 hardcoded `free_slots` (`12:30–14:00`, `16:00–17:30`). | **Partially Implemented** |
| `GET` | `/v1/events` | `v1_get_events()` (`line 900`) | Reads events from `cache_service.get_events()` and filters by category/query. | **Fully Implemented** |
| `GET` | `/v1/conversations` | `v1_list_conversations()` (`line 937`) | Returns conversations from in-memory dict `_conversations` for `user_id`. | **Partially Implemented** (Volatile RAM state) |
| `POST` | `/v1/conversations` | `v1_create_conversation()` (`line 944`) | Creates conversation in in-memory dict `_conversations`. | **Partially Implemented** (Volatile RAM state) |
| `GET` | `/v1/conversations/{cid}/messages` | `v1_get_messages()` (`line 959`) | Returns message list from in-memory dict `_messages[cid]`. | **Partially Implemented** (Volatile RAM state) |
| `POST` | `/v1/chat` | `v1_chat()` (`line 1130`) | Runs `_process_v1_chat()`: special-cases conflict/faculty/calendar/timetable/food/policy queries, calls Tier 0 / Router / RAG engines, builds structured `cards`, appends to `_messages`. | **Fully Implemented** |
| `POST` | `/v1/chat/stream` | `v1_chat_stream()` (`line 1136`) | Awaits full `_process_v1_chat()` completion, then yields 48-char chunks with `asyncio.sleep(0.01)` as `text/event-stream`. | **Simulated Streaming** |
| `GET` | `/v1/sources` | `v1_list_sources()` (`line 1158`) | Queries `data_versions` (fallback to 6 static source descriptors). | **Fully Implemented** |
| `GET` | `/v1/ingestion` | `v1_list_ingestion()` (`line 1207`) | Queries `submissions LEFT JOIN files` (up to 50 rows) and maps to `IngestionJob` schema. | **Fully Implemented** |
| `GET` | `/v1/ingestion/{job_id}` | `v1_get_ingestion_job()` (`line 1254`) | Queries single submission from `submissions LEFT JOIN files`. | **Fully Implemented** |
| `POST` | `/v1/ingestion/upload` | `v1_upload_ingestion()` (`line 1293`) | Saves uploaded file to `storage/uploads/`, runs `process_document_upload()` synchronously, inserts into `files` and `submissions`. | **Fully Implemented** (Uses live DB column names) |
| `PATCH` | `/v1/ingestion/{job_id}/records` | `v1_patch_ingestion_records()` (`line 1384`) | Re-validates edited rows and updates `submissions.data_payload`. **Never called by `frontend-next`!** | **Disconnected** |
| `POST` | `/v1/ingestion/{job_id}/approve` | `v1_approve_ingestion()` (`line 1419`) | Publishes `submissions.data_payload` into `timetable_slots`, `menu_items`, `holidays`, `faculty`, `events`, or `doc_chunks`, updates `data_versions`, invalidates `cache_service`. | **Fully Implemented** (Uses live DB column names) |
| `POST` | `/v1/ingestion/{job_id}/reject` | `v1_reject_ingestion()` (`line 1545`) | Updates `submissions.status = 'rejected'`. | **Fully Implemented** |
| `GET` | `/v1/admin/system` | `v1_admin_system()` (`line 1562`) | Counts rows in 8 tables (bug: counts `holidays` for `"events"`), returns hardcoded `"audit": []` and fake `"verification"` test pass stats. | **Partially Mocked** |
| `GET` | `/v1/admin/memberships` | `v1_admin_memberships()` (`line 1633`) | Returns 2 hardcoded users (`admin@campus.edu.in`, `student@campus.edu.in`). | **Mock Data** |
| `GET` | `/v1/integrations` | `v1_list_integrations()` (`line 1658`) | Returns 2 hardcoded dicts (`google_calendar`, `gmail`). | **Mock Data** |

#### D. Missing Backend Endpoints Called by `frontend-next/` (Result in HTTP 404 / 405)
| Method | Route Called by Frontend | Calling File & Line | Actual HTTP Result |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/ingestion/{job_id}/mapping` | `frontend-next/src/components/admin-view.tsx:154` (`act("mapping")`) | **404 Not Found** |
| `POST` | `/v1/ingestion/{job_id}/retry` | `frontend-next/src/components/admin-view.tsx:154` (`act("retry")`) | **404 Not Found** |
| `POST` | `/v1/sources/{source_id}/reindex` | `frontend-next/src/components/admin-view.tsx:656` (`reindex(s.id)`) | **404 Not Found** |
| `POST` | `/v1/admin/memberships` | `frontend-next/src/components/admin-view.tsx:849` (`save()`) | **405 Method Not Allowed** (Only `GET` exists) |
| `POST` | `/v1/integrations/{provider}/connect` | `frontend-next/src/components/settings-view.tsx:42` (`connect()`) | **404 Not Found** |
| `POST` | `/v1/integrations/{provider}/sync` | `frontend-next/src/components/settings-view.tsx:60` (`sync()`) | **404 Not Found** |
| `DELETE` | `/v1/integrations/{provider}` | `frontend-next/src/components/settings-view.tsx:74` (`disconnect()`) | **404 Not Found** |

---

## 7. Database Architecture & Data Model

### 7.1 Database Engine, Extensions & Connection Pooling
- **Engine:** PostgreSQL 16 (hosted on Supabase at `db.qfrrcwsetmbggreiefcd.supabase.co:5432`).
- **Extensions (`migrations/versions/001_initial_schema.py:21-22`)**:
  - `vector` (`pgvector`): Used for `doc_chunks.embedding vector(768)` and HNSW index `idx_doc_chunks_embedding_hnsw`.
  - `pg_trgm`: Used for GIN trigram indexes on `faculty`, `menu_items`, and `doc_chunks`.
- **Connection Pooling (`app/core/database.py`)**:
  - `AsyncPGPool` wraps `psycopg2.pool.ThreadedConnectionPool` and executes blocking `psycopg2` cursor operations inside `asyncio.to_thread()`.
  - Maintains two pool instances: `db_pool_rw` (`settings.DATABASE_URL`, max 10 connections) and `db_pool_ro` (`settings.DATABASE_URL_READONLY`, max 20 connections).
  - **Configuration Reality:** In `.env`, both `DATABASE_URL` and `DATABASE_URL_READONLY` are configured with the exact same `postgres` superuser connection string, meaning the read-only privilege separation (`app_read` vs `app_write` roles defined in `001_initial_schema.py:25-35`) is bypassed in the configured environment.

### 7.2 Complete Table & View Inventory (13 Tables + 4 Views)

| # | Table / View Name | Primary Key | Purpose | Where Written | Where Read | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `users` | `id UUID` | Stores user accounts, roles, academic scope (`branch`, `year`, `section`), `budget_default`, and `token_version`. | `auth_service.py`, `me.py` | `middleware.py`, `me.py`, `student_queries.py` | **Fully Implemented** (Ignored by `/v1/auth/*` and `/v1/me`) |
| 2 | `auth_otps` | `id BIGSERIAL` | Stores HMAC-SHA256 email OTPs (`otp_hmac`), `expires_at`, `attempts`, `used`. | `auth_service.py`, `sweeper_service.py` | `auth_service.py` | **Fully Implemented** (Used by `/api/auth/*` only) |
| 3 | `files` | `id UUID` | Metadata for uploaded documents (`filename`, `mime_type`, `size_bytes`, `storage_url`, `sha256_hash`). | `uploads.py`, `v1_compat.py`, `sweeper_service.py` | `approval.py`, `admin_actions.py`, `v1_compat.py`, `sweeper_service.py` | **Fully Implemented** |
| 4 | `submissions` | `id UUID` | Staging table for document uploads pending admin verification (`data_type`, `scope`, `status`, extracted JSON, `confidence`, `version`). | `uploads.py`, `approval.py`, `v1_compat.py` | `approval.py`, `v1_compat.py` | **Partially Broken** (Severe column drift; see Section 7.4) |
| 5 | `data_versions` | `scope TEXT` | Version pointer table mapping each scope (`timetable:CSE-3-A`, `menu`, `holidays`, `faculty`, `events`, `docs`) to `active_version` and `prev_version`. | `approval.py`, `admin_actions.py`, `v1_compat.py` | `cache_service.py`, `rag_engine.py`, `v1_compat.py`, `sweeper_service.py` | **Fully Implemented** |
| 6 | `audit_log` | `id BIGSERIAL` | Immutable audit trail of approvals, rejections, and rollbacks (`actor_id`, `action`, `scope`, `from_version`, `to_version`, `details`). | `approval.py`, `admin_actions.py` | `002_observability_views.sql` (Not read by `/v1/admin/system`, which returns `"audit": []`) | **Partially Disconnected** |
| 7 | `faculty` | `id SERIAL` | Versioned faculty directory (`name`/`full_name`, `department`/`branch`, `designation`, `email`, `cabin`, `short_code`, `subjects`, `version`). | `approval.py`, `v1_compat.py` | `cache_service.py`, `v1_compat.py` | **Partially Broken** (Column drift: `name` vs `full_name`, `department` vs `branch`) |
| 8 | `timetable_slots` | `id SERIAL` | Versioned class schedules (`scope`, `day`/`day_of_week`, `start_time`, `end_time`, `subject`/`subject_name`, `room`/`room_no`, `faculty_id`/`faculty_code`, `version`). | `approval.py`, `v1_compat.py` | `cache_service.py`, `v1_compat.py` | **Partially Broken** (Column drift between migrations and runtime SQL) |
| 9 | `menu_items` | `id SERIAL` | Versioned canteen menu (`meal`, `item`/`item_name`, `price`, `is_veg`, `day`/`day_of_week`, `facility`, `version`). | `approval.py`, `v1_compat.py` | `cache_service.py`, `v1_compat.py` | **Partially Broken** (Column drift: `item` vs `item_name`, `day` vs `day_of_week`) |
| 10 | `holidays` | `id SERIAL` | Versioned academic calendar milestones & holidays (`date`, `name`, `kind`, `version`). | `approval.py`, `v1_compat.py` | `cache_service.py`, `v1_compat.py` | **Fully Implemented** |
| 11 | `events` | `id SERIAL` | Campus club events (`title`, `club`/`organizer`, `description`, `venue`, `starts_at`/`start_time`, `ends_at`/`end_time`, `valid_until`, `file_id`, `version`). | `approval.py`, `v1_compat.py`, `sweeper_service.py` | `cache_service.py` | **Partially Broken** (Column mismatch between `cache_service.py` and `approval.py`) |
| 12 | `doc_chunks` | `id BIGSERIAL` | RAG vector store (`doc_key`, `title`/`doc_title`, `branch`, `chunk_index`, `content`, `embedding vector(768)`, `valid_until`, `file_id`, `version`). | `approval.py`, `v1_compat.py` | `rag_engine.py`, `v1_compat.py` | **Partially Broken** (Column drift: `title` vs `doc_title`) |
| 13 | `query_logs` | `id BIGSERIAL` | Telemetry table recording student query `tier`, `intent`, `latency_ms`, `cache_hit`, `llm_called`, `tokens_used`, `success`. | `student_queries.py` (Not written by `/v1/chat`) | `002_observability_views.sql` | **Partially Implemented** |
| V1 | `v_tier_distribution` | SQL View | Aggregates 24h query counts, percentages, and latency by tier (`0`, `1`, `2`) from `query_logs`. | `002_observability_views.py` | External SQL inspection only | **Disconnected from UI** |
| V2 | `v_active_scope_versions` | SQL View | Joins `data_versions` with `users` and `submissions` to inspect live scope versions. | `002_observability_views.py` | External SQL inspection only | **Disconnected from UI** |
| V3 | `v_recent_audit_trail` | SQL View | Joins `audit_log` with `users` (`LIMIT 100`). | `002_observability_views.py` | External SQL inspection only | **Disconnected from UI** |
| V4 | `v_active_doc_chunks_health` | SQL View | Summarizes active vs. expired `doc_chunks` by `doc_key` and `branch`. | `002_observability_views.py` | External SQL inspection only | **Disconnected from UI** |

### 7.3 Database Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ files : "uploaded_by"
    users ||--o{ submissions : "uploaded_by / submitted_by"
    users ||--o{ submissions : "reviewer / reviewed_by"
    users ||--o{ data_versions : "updated_by"
    users ||--o{ audit_log : "actor_id"
    users ||--o{ query_logs : "user_id"
    files ||--o{ submissions : "file_id"
    files ||--o{ events : "file_id"
    files ||--o{ doc_chunks : "file_id"
    faculty ||--o{ timetable_slots : "faculty_id"

    users {
        UUID id PK
        TEXT email UK
        TEXT role
        TEXT branch
        SMALLINT year
        TEXT section
        INTEGER budget_default
        INTEGER token_version
        TIMESTAMPTZ created_at
    }
    auth_otps {
        BIGSERIAL id PK
        TEXT email
        TEXT otp_hmac
        TIMESTAMPTZ expires_at
        SMALLINT attempts
        BOOLEAN used
    }
    files {
        UUID id PK
        TEXT filename
        TEXT mime_type
        INTEGER size_bytes
        TEXT storage_url
        TEXT sha256_hash
        UUID uploaded_by FK
    }
    submissions {
        UUID id PK
        TEXT data_type
        TEXT scope
        TEXT status
        UUID file_id FK
        JSONB extracted_OR_data_payload
        JSONB confidence
        UUID uploaded_by_OR_submitted_by FK
        UUID reviewer_OR_reviewed_by FK
        TEXT reject_reason
        INTEGER version_OR_target_version
    }
    data_versions {
        TEXT scope PK
        INTEGER active_version
        INTEGER prev_version
        UUID updated_by FK
        TIMESTAMPTZ updated_at
    }
    audit_log {
        BIGSERIAL id PK
        UUID actor_id FK
        TEXT action
        TEXT scope
        INTEGER from_version
        INTEGER to_version
        JSONB details
    }
    faculty {
        SERIAL id PK
        TEXT name_OR_full_name
        TEXT department_OR_branch
        TEXT designation
        TEXT email
        TEXT cabin
        TEXT short_code
        TEXT_ARRAY_OR_JSONB subjects
        INTEGER version
    }
    timetable_slots {
        SERIAL id PK
        TEXT scope
        SMALLINT day_OR_day_of_week
        TIME start_time
        TIME end_time
        TEXT subject_OR_subject_name
        TEXT subject_code
        TEXT kind
        TEXT room_OR_room_no
        INTEGER_OR_TEXT faculty_id_OR_faculty_code
        INTEGER version
    }
    menu_items {
        SERIAL id PK
        SMALLINT day_OR_day_of_week
        TEXT meal
        TEXT item_OR_item_name
        INTEGER price
        BOOLEAN is_veg
        TEXT facility
        INTEGER version
    }
    holidays {
        SERIAL id PK
        DATE date
        TEXT name
        TEXT kind
        INTEGER version
    }
    events {
        SERIAL id PK
        TEXT title
        TEXT club_OR_organizer
        TEXT description
        TEXT venue
        TIMESTAMPTZ starts_at_OR_start_time
        TIMESTAMPTZ ends_at_OR_end_time
        DATE valid_until
        UUID file_id FK
        INTEGER version
    }
    doc_chunks {
        BIGSERIAL id PK
        TEXT doc_key
        TEXT title_OR_doc_title
        TEXT branch
        INTEGER chunk_index
        TEXT content
        VECTOR_768 embedding
        DATE valid_until
        UUID file_id FK
        INTEGER version
    }
    query_logs {
        BIGSERIAL id PK
        UUID user_id FK
        SMALLINT tier
        TEXT intent
        INTEGER latency_ms
        BOOLEAN cache_hit
        BOOLEAN llm_called
        INTEGER tokens_used
        BOOLEAN success
    }
```

### 7.4 Critical Architectural Finding: Database Schema Drift (Migrations vs. Runtime SQL)

A major discrepancy exists between the repository's schema definitions (`migrations/versions/001_initial_schema.py` and `scripts/init_db.sql`) and the raw SQL queries executed by the application services (`cache_service.py`, `uploads.py`, `approval.py`, `rag_engine.py`, `v1_compat.py`).

| Table | Columns Defined in `001_initial_schema.py` & `scripts/init_db.sql` | Columns Queried/Inserted by Runtime Code (`cache_service.py`, `approval.py`, `v1_compat.py`) | Impact on Fresh Deployment |
| :--- | :--- | :--- | :--- |
| **`submissions`** | `uploaded_by`, `extracted`, `reviewer`, `version` | `submitted_by`, `data_payload`, `reviewed_by`, `target_version` (`uploads.py:130`, `approval.py:42,107,232`, `v1_compat.py:1215,1346`). Note: `approval.py:67` (`GET /api/submissions`) selects `uploaded_by, reviewer, version`, while `approval.py:107` (`GET /api/submissions/{id}`) selects `submitted_by, data_payload, reviewed_by, target_version`! | Running `alembic upgrade head` on a clean database causes `psycopg2.errors.UndefinedColumn` in `uploads.py`, `approval.py`, and `v1_compat.py`. |
| **`timetable_slots`** | `day`, `subject`, `room`, `faculty_id` (`INTEGER REFERENCES faculty(id)`) | `day_of_week`, `subject_name`, `subject_code`, `room_no`, `faculty_code` (`cache_service.py:86-93`, `approval.py:265`, `v1_compat.py:1451`). | `UndefinedColumn` when reading or publishing timetables against a freshly migrated database. |
| **`menu_items`** | `day`, `meal`, `item`, `price`, `is_veg` | `day_of_week`, `meal`, `item_name`, `price`, `is_veg`, `facility` (`cache_service.py:124`, `approval.py:293`, `v1_compat.py:1475`). | `UndefinedColumn` when reading or publishing mess menus on a freshly migrated database. |
| **`faculty`** | `name`, `department`, `subjects TEXT[]` | `full_name`, `branch`, `subjects` cast as `%s::jsonb` (`cache_service.py:194`, `approval.py:322`, `v1_compat.py:1503`). | `UndefinedColumn` and type mismatch (`TEXT[]` vs `JSONB`). |
| **`events`** | `club`, `starts_at`, `ends_at`, `valid_until`, `file_id` | `cache_service.py:154` selects `organizer, start_time, end_time, poster_url`, whereas `approval.py:351` and `v1_compat.py:1532` insert into `club, starts_at, ends_at, valid_until, file_id`! | **Internal Contradiction:** Even within the runtime code, `approval.py` inserts into `(club, starts_at, ends_at, file_id)` while `cache_service.py` selects `(organizer, start_time, end_time, poster_url)`. |
| **`doc_chunks`** | `title` | `doc_title` (`approval.py:372`, `rag_engine.py:42`, `v1_compat.py:1518`). Note: `002_observability_views.py:67` references `c.title`. | `UndefinedColumn` on fresh schema migration. |

**Why this happened (`INFERRED`):** The live Supabase PostgreSQL instance (`db.qfrrcwsetmbggreiefcd.supabase.co`) was modified manually in the Supabase SQL Editor with hybrid/renamed columns, and `001_initial_schema.py` / `scripts/init_db.sql` were never updated to match the altered column names.

---

## 8. End-to-End Data Flows & Sequence Diagrams

### 8.1 Flow 1: Authentication & Session Lifecycle (Dual Regimes)

#### Regime A: `/api/auth/*` (Passwordless Email OTP + HttpOnly Cookie + CSRF — Used by `frontend/`)
1. User enters email in `frontend/src/components/auth/LoginView.tsx` -> `POST /api/auth/request-otp`.
2. `auth_service.create_otp_for_email()` generates a 6-digit OTP, computes `HMAC-SHA256(JWT_SECRET, f"{email}:{otp}")`, stores it in `auth_otps` with a 10-minute TTL, and calls `send_otp_email()` (Resend API or dev console fallback).
3. User submits the 6-digit OTP -> `POST /api/auth/verify-otp`.
4. `auth_service.verify_otp_for_email()` verifies the HMAC in constant time (`hmac.compare_digest`), marks `used = TRUE`, upserts the user in `users` (assigning `admin` if email is in `ADMIN_SEED_EMAILS`, else `student`), and mints an HS256 JWT (`campus_session`, `HttpOnly`, `SameSite=Lax`) plus a readable CSRF cookie (`campus_csrf`).
5. On every subsequent `/api/*` request, `SessionSecurityMiddleware` (`app/core/middleware.py:34-126`) verifies the JWT signature with `JWT_SECRET`, queries `SELECT token_version, role FROM users WHERE id = %s` to ensure the session has not been revoked, and for `POST`/`PATCH`/`PUT`/`DELETE` verifies `request.cookies.get("campus_csrf") == request.headers.get("X-CSRF-Token")`.

#### Regime B: `/v1/auth/*` (Hardcoded Demo Login + Unverified Bearer Token — Used by `frontend-next/`)
1. User enters email/password in `frontend-next/src/components/campus-app.tsx` (`AuthScreen`) -> `POST /v1/auth/login`.
2. `v1_compat.py:v1_login()` (`lines 124-190`) checks if the email/password matches hardcoded strings (`student@campus.edu.in` / `123456` or `admin@campus.edu.in` / `123456` / `CampusAdmin123!` / `admin123`). It does **not** query PostgreSQL.
3. `v1_login()` signs a JWT via `create_session_jwt()` and returns `{"access_token": token, "user": user_obj}`.
4. `campus-app.tsx` stores `access_token` in `localStorage.setItem("campus_token", token)`.
5. On subsequent `/v1/*` requests, `SessionSecurityMiddleware` **skips** validation (`path.startswith("/v1/")`), and `_resolve_v1_user()` (`v1_compat.py:48-105`) decodes the Bearer token with `options={"verify_signature": False}` (or defaults to `institution_admin` if no token is present).

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant NextUI as frontend-next (campus-app.tsx)
    participant MW as SessionSecurityMiddleware
    participant V1 as v1_compat.py (/v1/*)
    participant ViteUI as frontend (LoginView.tsx)
    participant AuthR as auth.py (/api/auth/*)
    participant DB as PostgreSQL (users / auth_otps)

    rect rgb(254, 242, 242)
        Note over User,V1: Regime B: Primary Next.js Frontend (/v1/auth/*)
        User->>NextUI: Submit email & password (e.g. student@campus.edu.in / 123456)
        NextUI->>MW: POST /v1/auth/login
        MW->>V1: Exempts /v1/* from cookie/CSRF checks
        V1->>V1: Match against hardcoded password list (No DB query)
        V1-->>NextUI: { access_token, user }
        NextUI->>NextUI: localStorage.setItem("campus_token", access_token)
        NextUI->>MW: GET /v1/me (Authorization: Bearer <token>)
        MW->>V1: Pass through
        V1->>V1: jwt.decode(token, options={"verify_signature": False})
        V1-->>NextUI: Profile merged from JWT + _user_prefs RAM dict
    end

    rect rgb(240, 253, 244)
        Note over User,DB: Regime A: Legacy Vite Frontend (/api/auth/*)
        User->>ViteUI: Enter email -> Click "Send OTP"
        ViteUI->>AuthR: POST /api/auth/request-otp { email }
        AuthR->>DB: INSERT INTO auth_otps (email, otp_hmac, expires_at)
        AuthR-->>ViteUI: { message: "OTP sent", dev_otp }
        User->>ViteUI: Enter 6-digit OTP
        ViteUI->>AuthR: POST /api/auth/verify-otp { email, otp }
        AuthR->>DB: Verify otp_hmac & UPSERT INTO users
        AuthR-->>ViteUI: Set-Cookie: campus_session (HttpOnly), campus_csrf
        ViteUI->>MW: PATCH /api/me (Cookie + X-CSRF-Token)
        MW->>DB: Verify JWT signature + SELECT token_version FROM users
        MW->>AuthR: Attach request.state.user_id & role
    end
```

---

### 8.2 Flow 2: 3-Tier Hybrid AI Chat Pipeline (`ChatView` -> `/v1/chat/stream`)

When a student asks a question in `frontend-next/src/components/chat-view.tsx`:
1. `chat-view.tsx:send()` (`line 95`) calls `streamChat()` in `frontend-next/src/lib/api.ts:52`.
2. `streamChat()` sends `POST /v1/chat/stream` with `{ message, conversation_id, section_override }`.
3. `v1_compat.py:v1_chat_stream()` (`line 1136`) invokes `await _process_v1_chat(payload, request)` (`lines 967-1127`):
   - **Pre-Check Shortcuts in `_process_v1_chat`:**
     - If the query mentions `"conflict"` or `"clash"`, returns a deterministic `conflicts` card.
     - If the query asks about a faculty member (`"faculty"`, `"prof"`, `"cabin"`, `"hod"`), queries `cache_service.get_faculty()` and returns a `faculty` card.
     - If the query asks about `"holiday"`, `"calendar"`, `"exam"`, or `"free slot"`, queries `cache_service.get_holidays()` and returns a `calendar` card.
     - If the query asks for a full timetable (`"timetable"`, `"schedule"`, `"classes"`, `"monday"`..`"saturday"`), queries `cache_service.get_timetable()` and returns a `timetable` card.
     - If the query asks about food/canteen (`"eat"`, `"food"`, `"lunch"`, `"menu"`, `"protein"`, `"veg"`), queries `cache_service.get_menu()` and returns a `food` card.
     - If `is_complex_policy_query(query)` is true (e.g., `"attendance"`, `"policy"`, `"syllabus"`, `"circular"`), calls `run_rag_pipeline()` directly (`rag_engine.py`), executing hybrid `pgvector` cosine + `pg_trgm` retrieval on `doc_chunks` and synthesizing with `gemini-2.5-flash`.
   - **Fallback to 3-Tier Engine (`route_and_execute_query` in `router_engine.py`):**
     - **Tier 0 (`tier0_engine.py`):** Regex pattern evaluation (<5ms, 0 LLM calls).
     - **Tier 1 (`router_engine.py` + `tool_executor.py`):** Calls `gemini-2.5-flash` with 6 tool declarations -> executes the selected tool against `cache_service` -> calls `gemini-2.5-flash` to summarize the tool output.
     - **Tier 2 (`rag_engine.py`):** Hybrid vector + trigram retrieval over `doc_chunks` + `gemini-2.5-flash` grounded generation.
4. Once `_process_v1_chat()` returns the complete `result` dictionary, `v1_chat_stream()` (`lines 1140-1151`) slices `result["answer"]` into 48-character substrings, sleeps `10ms` (`await asyncio.sleep(0.01)`) between each chunk, and emits `data: {"delta": chunk}\n\n`, followed by `data: {"done": true, "payload": result}\n\n`.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant ChatUI as chat-view.tsx
    participant V1Chat as v1_compat.py (/v1/chat/stream)
    participant T0 as tier0_engine.py
    participant Router as router_engine.py + tool_executor.py
    participant RAG as rag_engine.py
    participant Cache as cache_service.py (60s RAM TTL)
    participant PG as PostgreSQL (pgvector + pg_trgm)
    participant Gemini as Google Gemini 2.5 Flash

    Student->>ChatUI: Type query & press Send
    ChatUI->>V1Chat: POST /v1/chat/stream { message, conversation_id, section_override }
    V1Chat->>V1Chat: _process_v1_chat() checks domain shortcuts
    alt Domain Shortcut or Tier 0 Match (<5ms)
        V1Chat->>T0: evaluate_tier0(query, profile)
        T0->>Cache: get_timetable() / get_menu() / get_holidays()
        Cache->>PG: Hydrate on cache miss (SELECT ... WHERE version = active_version)
        T0-->>V1Chat: Deterministic answer + structured card
    else Policy / Syllabus / Notice Query (Tier 2 RAG)
        V1Chat->>RAG: run_rag_pipeline(query, branch)
        RAG->>Gemini: gemini-embedding-001 (768-dim vector)
        RAG->>PG: Hybrid Search (0.7 * vector cosine + 0.3 * pg_trgm >= 0.30)
        PG-->>RAG: Top-5 doc_chunks
        RAG->>Gemini: gemini-2.5-flash synthesis with [Source: Title]
        RAG-->>V1Chat: Grounded answer + general_docs card + citations
    else General Campus Query (Tier 1 Tool Calling)
        V1Chat->>Router: route_and_execute_query(query, profile)
        Router->>Gemini: gemini-2.5-flash with 6 FunctionDeclarations
        Gemini-->>Router: function_call (e.g. get_mess_menu)
        Router->>Cache: Execute tool via tool_executor.py
        Router->>Gemini: Synthesize natural language response from tool JSON
        Router-->>V1Chat: Answer + card payload
    end
    loop Simulated Streaming (48-char slices)
        V1Chat-->>ChatUI: SSE data: {"delta": "..."} (sleep 10ms)
    end
    V1Chat-->>ChatUI: SSE data: {"done": true, "payload": { answer, cards, sources }}
    ChatUI->>ChatUI: Render text + <ResultCards />
```

---

### 8.3 Flow 3: Admin Document Ingestion, Validation & Atomic Approval

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminUI as admin-view.tsx (or UploadCard.tsx)
    participant V1Ingest as v1_compat.py (/v1/ingestion/*)
    participant IngestSvc as ingestion_service.py
    participant Validator as validators.py
    participant Gemini as Gemini 2.5 Flash / Embedding-001
    participant PG as PostgreSQL (db_pool_rw)
    participant Cache as cache_service.py

    Admin->>AdminUI: Select file (PDF/DOCX/XLSX/Image) & category -> Click Upload
    AdminUI->>V1Ingest: POST /v1/ingestion/upload (multipart/form-data)
    V1Ingest->>V1Ingest: Save binary to storage/uploads/{file_id}_{filename}
    V1Ingest->>IngestSvc: process_document_upload(file_bytes, filename, mime_type, data_type)
    alt Structured Type (timetable, menu, holidays, faculty, poster)
        IngestSvc->>IngestSvc: Extract text via PyMuPDF / python-docx / openpyxl
        IngestSvc->>Gemini: extract_structured_with_gemini() (Pydantic response_schema)
        Gemini-->>IngestSvc: Structured JSON rows
        IngestSvc->>Validator: validate_extracted_data(data_type, rows)
        Validator-->>IngestSvc: confidence { cells, has_errors, has_warnings }
    else Unstructured Document (notice, syllabus, policy)
        IngestSvc->>IngestSvc: chunk_document_text() (~1600 chars, 200 overlap)
        IngestSvc->>Gemini: generate_embeddings_batch() (768-dim vectors)
    end
    V1Ingest->>PG: INSERT INTO files & INSERT INTO submissions (status='pending_review' or 'flagged')
    V1Ingest-->>AdminUI: { id: sub_id, status, extracted_rows }

    Admin->>AdminUI: Review extracted job in Review Queue -> Click "Approve & Publish"
    AdminUI->>V1Ingest: POST /v1/ingestion/{job_id}/approve
    V1Ingest->>PG: SELECT data_type, scope, data_payload, confidence FROM submissions
    V1Ingest->>PG: SELECT COALESCE(MAX(active_version), 0) + 1 FROM data_versions WHERE scope = %s
    V1Ingest->>PG: INSERT INTO target table (timetable_slots / menu_items / faculty / holidays / events / doc_chunks) with new_version
    V1Ingest->>PG: UPSERT INTO data_versions (active_version = new_version, prev_version = active_version)
    V1Ingest->>PG: UPDATE submissions SET status = 'approved'
    V1Ingest->>Cache: invalidate_scope(scope)
    V1Ingest-->>AdminUI: { status: "approved", published_version: new_version }
```

---

## 9. Authentication, Authorization & Security Audit

### 9.1 Side-by-Side Comparison of the Two Authentication Regimes

| Security Dimension | Generation 1: `/api/*` (`app/core/middleware.py`, `app/routers/auth.py`) | Generation 2: `/v1/*` (`app/routers/v1_compat.py`) |
| :--- | :--- | :--- |
| **Middleware Coverage** | Protected by `SessionSecurityMiddleware` (`app/core/middleware.py:34-126`). | **Completely Exempted:** `middleware.py:39` explicitly returns `await call_next(request)` for `path.startswith("/v1/")`. |
| **Credential Verification** | Passwordless 6-digit OTP hashed via `HMAC-SHA256(JWT_SECRET, f"{email}:{otp}")`, verified with `hmac.compare_digest` (`auth_service.py:114`). | Hardcoded password check in `v1_compat.py:130-169` (`"123456"`, `"CampusAdmin123!"`, `"admin123"`). Does **not** query `users`. |
| **Token Transport** | `HttpOnly`, `SameSite=Lax` cookie (`campus_session`). Immune to `localStorage` XSS theft. | Stored in `window.localStorage.getItem("campus_token")` (`frontend-next/src/lib/api.ts:6-13`) and sent via `Authorization: Bearer <token>`. |
| **JWT Signature Verification** | Verified via `jwt.decode(session_token, settings.JWT_SECRET, algorithms=["HS256"])` (`middleware.py:73-77`). | **CRITICAL VULNERABILITY (`v1_compat.py:55`):** Decoded with `jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], options={"verify_signature": False})`. Any attacker can forge arbitrary JWT payloads without knowing `JWT_SECRET`. |
| **Unauthenticated Request Handling** | Returns `401 Unauthorized` (`middleware.py:67`). | **CRITICAL VULNERABILITY (`v1_compat.py:49-51, 80-86`):** When no `Authorization` header is sent (or decoding fails), `_resolve_v1_user()` defaults to `user_id = "8c5f6b46-c167-43c3-93bf-84304a37239f"`, `email = "admin@campus.edu.in"`, `role = "institution_admin"`. Every unauthenticated `/v1/*` request runs with full admin identity! |
| **CSRF Protection** | Double-submit cookie pattern (`campus_csrf` cookie must match `X-CSRF-Token` header on `POST`/`PATCH`/`PUT`/`DELETE`, `middleware.py:113-124`). | None (Bearer token header). |
| **Session Revocation** | Checks `users.token_version` in PostgreSQL on every request (`middleware.py:92-104`). `POST /api/auth/logout` increments `token_version`. | None (`token_version` is never checked in `v1_compat.py`). |
| **Role-Based Access Control (RBAC)** | Enforced via `require_admin_or_verifier()` and `require_approver()` in `uploads.py`, `approval.py`, `admin_actions.py`, `sweeper_service.py`. | **Zero RBAC Enforcement in `/v1/*`:** Endpoints like `POST /v1/ingestion/upload`, `POST /v1/ingestion/{id}/approve`, `POST /v1/ingestion/{id}/reject`, and `GET /v1/admin/system` do **not** check the caller's role at all! Even a caller with `role: "student"` (or no token at all) can approve/reject ingestion jobs via `/v1/ingestion/*`. |

### 9.2 Secret & Credential Audit (Rule 5 Compliant — All Values Redacted)

1. **Git Tracking Verification:**
   - Checked via `git ls-files` and `git log --all --full-history --stat -- "**/.env*" "*.env*"`: `.env`, `.env.production`, and `frontend-next/.env.local` are **properly listed in `.gitignore`** and have **never been committed** to the Git commit history. Only `.env.example` and `frontend-next/.env.example` are tracked in Git.
2. **Untracked Local Secret Files Present on Disk:**
   - `d:\CampusOS\.env`: Contains live Supabase PostgreSQL superuser credentials (`DATABASE_URL` and `DATABASE_URL_READONLY` both using the `postgres` role password), 3 live Google Gemini API keys (`GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`), and a development `JWT_SECRET`.
   - `d:\CampusOS\.env.production`: Contains production environment templates (`JWT_SECRET` placeholder, `CORS_ORIGINS`).
   - `d:\CampusOS\frontend-next\.env.local`: Contains `NEXT_PUBLIC_SUPABASE_URL` (`https://asqibroozdtioxhqhnvw.supabase.co` — note this is a different Supabase project ID than the backend's `qfrrcwsetmbggreiefcd`) and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`), neither of which is actually referenced in `frontend-next/src/`.
3. **Hardcoded Passwords in Source Code (`app/routers/v1_compat.py:130-169`):**
   - Plaintext demo/admin passwords (`"123456"`, `"CampusAdmin123!"`, `"admin123"`) are hardcoded directly in `v1_login()` and accepted in production on `/v1/auth/login`.

---

## 10. Mock Data, Hardcoded Values & Simulated Features

The table below catalogs every single mocked, hardcoded, or simulated feature identified across the codebase, along with exact file paths, line numbers, what the UI/API appears to do, and what actually happens in the code.

| # | Feature / Component | Exact File & Line Numbers | What Appears to Happen | What Actually Happens in Code | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Next.js Login (`/v1/auth/login`)** | `app/routers/v1_compat.py:124-190` | Authenticates user credentials against the campus user database. | Compares email/password against hardcoded literals (`student@campus.edu.in` / `123456`, `admin@campus.edu.in` / `123456`, `CampusAdmin123!`, `admin123`). Never queries `users`. | **Simulated / Hardcoded** |
| 2 | **Next.js Signup (`/v1/auth/signup`)** | `app/routers/v1_compat.py:193-241` | Registers a new Student or Admin account. | Generates a random UUID in memory and returns a signed JWT. Does **not** insert any row into `users`. | **Simulated** |
| 3 | **Password Reset (`/v1/auth/reset-password` & `/update-password`)** | `app/routers/v1_compat.py:244-269` | Sends a password reset link and updates the user's password. | Returns a fake reset URL (`/reset-password?token=...`) and `{"status": "ok"}` without touching any database or email service. | **Simulated** |
| 4 | **Student Home Dashboard (`HomeView` — Student)** | `frontend-next/src/components/campus-app.tsx:1164-1165, 1367-1579` | Shows live countdown (`In 24 Minutes`), `Mark attendance` button, `89.4%` attendance ring, `Lunch pick: Paneer Rice Bowl ₹90`, and weekly stats (`17/19 classes`, `₹410 spend`). | 100% hardcoded JSX constants and local `useState(24)`. Clicking `Mark attendance` only sets `checkedIn = true` and fires a local toast. | **Mock Data / UI Only** |
| 5 | **Admin Home Dashboard (`HomeView` — Admin)** | `frontend-next/src/components/campus-app.tsx:1167-1171, 1185-1365` | Shows KPI cards (`128 Documents`, `1,942 Canteen orders`, `4,310 Active students`, `91.2% Attendance`), hourly order bar chart, and a 3-item `Needs review` queue with `Approve`/`Dismiss` buttons. | 100% hardcoded arrays. Clicking `Approve` or `Dismiss` only mutates local React state `reviews` (`setReviews(r => r.filter(...))`) and shows a toast. | **Mock Data / UI Only** |
| 6 | **Admin Canteen Menu Manager (`MenuManagerView`)** | `frontend-next/src/components/campus-app.tsx:101-113, 1730-1906` | Allows admins to add new dishes, adjust prices (`-₹5`/`+₹5`), and toggle dish availability (`Live`/`Sold out`). | Initialized from static constant `INITIAL_FOOD` (11 items). All edits mutate local component state `items` with zero API calls. | **UI Only / Mock Data** |
| 7 | **Notification Bell Popover (`NOTIFS`)** | `frontend-next/src/components/campus-app.tsx:115-119, 608-633` | Displays recent campus notifications (e.g., `"Room change: DBMS Lab moved to Lab-304"`). | Hardcoded 3-element constant `NOTIFS` in `campus-app.tsx`. | **Mock Data** |
| 8 | **SSE Chat Token Streaming (`/v1/chat/stream`)** | `app/routers/v1_compat.py:1136-1153` | Streams tokens in real time from Gemini as the LLM generates its response. | Awaits the entire `_process_v1_chat()` response first, then slices `result["answer"]` into 48-char chunks in a loop with `await asyncio.sleep(0.01)`. | **Simulated** |
| 9 | **Chat Conversations & Message History (`/v1/conversations`)** | `app/routers/v1_compat.py:42-45, 937-964` | Persists user chat threads and message history across sessions. | Stored in process-local Python dictionaries `_conversations` and `_messages`. Wiped on every server restart or redeploy. | **Partially Implemented (Volatile RAM)** |
| 10 | **Next.js Profile Preferences (`PATCH /v1/me`)** | `app/routers/v1_compat.py:45, 272-319` | Saves student branch, semester, section, dietary preference, and budget. | Stored only in the in-memory Python dictionary `_user_prefs[user_id]`. Never writes to the `users` table in PostgreSQL. | **Partially Implemented (Volatile RAM)** |
| 11 | **Canteen Nutrition Macros (`protein_g`, `calories` in `/v1/menu`)** | `app/routers/v1_compat.py:349-350` | Displays accurate protein (grams) and calorie counts for every mess dish. | Computed via a synthetic formula from the item's INR price: `prot = round(8.0 + (price % 15), 1)` and `cals = int(180 + price * 2.5)`. | **Simulated / Mock Formula** |
| 12 | **Calendar Free Slots & Conflicts (`GET /v1/calendar`)** | `app/routers/v1_compat.py:882-897` | Computes student's free time slots and timetable conflicts. | Always returns 2 hardcoded free slots (`12:30–14:00 Lunch Break`, `16:00–17:30 Evening Free Window`) and `"conflicts": []`. | **Mock Data** |
| 13 | **Admin System Audit & Verification Status (`GET /v1/admin/system`)** | `app/routers/v1_compat.py:1600-1629` | Displays recent audit log entries and live E2E verification test results. | Always returns `"audit": []` (never queries `audit_log`) and returns a hardcoded `"verification"` dictionary claiming `55` backend tests and `14` browser tests passed at `datetime.now(IST)`. Also queries `holidays` instead of `events` for the `"events"` table count (`line 1581`). | **Mock Data / Bug** |
| 14 | **Admin Memberships (`GET` & `POST /v1/admin/memberships`)** | `app/routers/v1_compat.py:1633-1655` & `admin-view.tsx:849` | Lists institution members and allows adding/updating member roles. | `GET` returns a hardcoded 2-item list (`admin@campus.edu.in`, `student@campus.edu.in`). `POST` is not implemented at all (`405 Method Not Allowed`). | **Mock Data / Broken** |
| 15 | **External Integrations (`/v1/integrations` & `SettingsView`)** | `app/routers/v1_compat.py:1658-1663` & `settings-view.tsx:42-81, 207-208` | Connects and syncs Google Calendar and Gmail accounts. | `GET /v1/integrations` returns 2 static dicts (`google_calendar`, `gmail`). Note `settings-view.tsx:208` looks for `provider === "google_gmail"`, so Gmail never even matches! Connect/Sync/Disconnect routes do not exist (`404`). | **UI Only / Broken** |
| 16 | **Email Search Card in Chat (`_process_v1_chat` & `mcp_server.py`)** | `app/routers/v1_compat.py:967-1127`, `app/mcp_server.py:216-220` | Searches authorized campus emails when asked about emails. | `mcp_server.py:search_authorized_emails()` simply executes `return []`. No Gmail OAuth or IMAP integration exists anywhere in the repo. | **Simulated / Missing** |
| 17 | **MCP Server Schedule Conflict Detection (`mcp_server.py`)** | `app/mcp_server.py:173-177` | `detect_schedule_conflicts` tool checks for timetable clashes. | Function body is literally `return []`. | **Simulated / Missing** |
| 18 | **Deterministic Fallback Embeddings (`embedding_service.py`)** | `app/services/embedding_service.py:18-32` | Generates 768-dim semantic embeddings when Gemini API keys are unavailable. | Expands a `SHA-256` hash of the text into 768 normalized floats. Preserves exact-text identity in tests, but has zero semantic similarity for synonyms. | **Simulated Fallback** |
| 19 | **In-Memory Database Fallback Stores (`_mock_store`, `_mock_submissions`, `_mock_chunks`, `_mock_otps`)** | `cache_service.py:30-60`, `approval.py:22`, `rag_engine.py:19`, `auth_service.py:22` | Allows unit/integration tests to pass when PostgreSQL is offline or throws SQL errors. | Swallows PostgreSQL exceptions inside `try...except Exception:` blocks and serves seeded CSE-3-A timetable, menu, faculty, and holiday records from RAM. | **Simulated Fallback** |

---

## 11. File & Module Dependency Map

### 11.1 Module Dependency Diagram

```mermaid
flowchart LR
    subgraph NextFrontend["frontend-next/src/"]
        PageTSX["app/page.tsx"] --> CampusApp["components/campus-app.tsx"]
        ResetTSX["app/reset-password/page.tsx"] --> NextAPI["lib/api.ts"]
        CampusApp --> NextAPI
        CampusApp --> ChatView["components/chat-view.tsx"]
        CampusApp --> BrowseView["components/browse-view.tsx"]
        CampusApp --> AdminView["components/admin-view.tsx"]
        CampusApp --> SettingsView["components/settings-view.tsx"]
        ChatView --> NextAPI
        ChatView --> ResultCards["components/result-cards.tsx"]
        BrowseView --> NextAPI
        BrowseView --> TTCardTable["components/timetable-card-table.tsx"]
        ResultCards --> TTCardTable
        TTCardTable --> TTLegend["lib/timetable-legend.ts"]
        AdminView --> NextAPI
        SettingsView --> NextAPI
    end

    subgraph ViteFrontend["frontend/src/"]
        MainTSX["main.tsx"] --> AppTSX["App.tsx"]
        AppTSX --> AuthCtx["context/AuthContext.tsx"]
        AppTSX --> ViteComponents["components/{auth,dashboard,browse,chat,admin,settings}/*"]
        AuthCtx --> ViteAPI["lib/api.ts"]
        ViteComponents --> ViteAPI
    end

    subgraph BackendApp["app/"]
        MainPy["main.py"] --> MiddlewarePy["core/middleware.py"]
        MainPy --> Routers["routers/{health,auth,me,uploads,approval,admin_actions,student_queries,v1_compat}.py"]
        MainPy --> SweeperPy["services/sweeper_service.py"]
        MCPPy["mcp_server.py"] --> Services

        Routers --> Services["services/*"]
        MiddlewarePy --> DBPy["core/database.py"]
        MiddlewarePy --> ConfigPy["core/config.py"]

        subgraph Services["app/services/"]
            RouterEngPy["router_engine.py"] --> ToolExecPy["tool_executor.py"]
            RouterEngPy --> RAGEngPy["rag_engine.py"]
            ToolExecPy --> CachePy["cache_service.py"]
            ToolExecPy --> TimePy["time_engine.py"]
            Tier0Py["tier0_engine.py"] --> CachePy
            Tier0Py --> TimePy
            RAGEngPy --> EmbedPy["embedding_service.py"]
            IngestPy["ingestion_service.py"] --> EmbedPy
            IngestPy --> ValidPy["validators.py"]
        end

        Services --> DBPy
        Services --> ConfigPy
    end
```

### 11.2 Architectural Coupling & Duplication Analysis
- **Tight Monolithic Coupling in `v1_compat.py`:** At 1,669 lines, `app/routers/v1_compat.py` duplicates logic that already exists across `auth.py`, `me.py`, `student_queries.py`, `uploads.py`, `approval.py`, and `admin_actions.py`.
- **Tight UI Coupling in `campus-app.tsx`:** At 1,963 lines, `frontend-next/src/components/campus-app.tsx` bundles the authentication screens, navigation shell, command palette, notification tray, student/admin `HomeView`, chat wrapper, and `MenuManagerView` into a single file.
- **Dead / Orphaned Code:**
  - `PATCH /v1/ingestion/{job_id}/records` (`v1_compat.py:1384`) is implemented in the backend but never called by `frontend-next/src/components/admin-view.tsx`.
  - `@supabase/supabase-js` in `frontend-next/package.json` and `NEXT_PUBLIC_SUPABASE_*` in `frontend-next/.env.local` are completely unused.
  - `asyncpg` in `requirements.txt` is completely unused (`app/core/database.py` uses `psycopg2`).
  - `migrations/versions/002_observability_views.py` defines 4 SQL views (`v_tier_distribution`, `v_active_scope_versions`, `v_recent_audit_trail`, `v_active_doc_chunks_health`) that are never queried by any backend API router.

---

## 12. Error Handling, Logging & Reliability

### 12.1 Backend Exception Handling & Silent Fallback Masking
- **Broad `try...except Exception` Blocks:** Almost every database call across `cache_service.py`, `auth_service.py`, `me.py`, `uploads.py`, `approval.py`, `rag_engine.py`, and `v1_compat.py` wraps SQL execution in `try: ... except Exception as e: logger.warning(...)` and falls back to in-memory dictionaries (`_mock_store`, `_mock_submissions`, `_mock_chunks`, `_mock_otps`).
  - **Consequence:** While this prevents unhandled `500 Internal Server Error` crashes when the database is unreachable or has schema mismatches, it **silently masks critical SQL bugs** (such as the `events` table column mismatch in `cache_service.py:154` vs `approval.py:351`) by serving stale or mock data without alerting the user or failing tests.
- **Gemini API Key Rotation (`app/core/config.py:55-82`):**
  - `GeminiAPIKeyRotator` cycles through up to 3 configured API keys (`GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`) in round-robin order.
  - In `ingestion_service.py`, `embedding_service.py`, `router_engine.py`, and `rag_engine.py`, LLM calls iterate over `range(max(1, gemini_rotator.key_count))` so that if key 1 hits a `429 ResourceExhausted` quota error, key 2 is tried automatically.

### 12.2 Frontend Error Handling
- **`apiFetch` (`frontend-next/src/lib/api.ts:34-45`):** Parses non-2xx responses by reading `data.error.message` or `data.detail` and throwing a JavaScript `Error`.
- **Silent `.catch(() => {})` Swallowing in `frontend-next/`:**
  - In `settings-view.tsx:48, 66, 79`, failed API calls to `/v1/integrations/*` (`404 Not Found`) are caught with empty `catch {}` blocks, leaving the user with no error feedback when clicking "Connect", "Sync", or "Disconnect".
  - In `admin-view.tsx:157-159`, failed calls to `/v1/ingestion/{id}/mapping` or `/retry` (`404 Not Found`) catch the error and display an alert/error message in the review pane.

---

## 13. Configuration & Environment Management

### 13.1 Complete Environment Variable Inventory

All backend settings are loaded by `app/core/config.py` (`Settings(BaseSettings)`). All secret values below are redacted in compliance with Rule 5.

| Variable Name | Defined In | Default in `config.py` | Configured State in `.env` (Redacted) | Purpose & Consumers |
| :--- | :--- | :--- | :--- | :--- |
| `APP_ENV` | `.env`, `config.py` | `"development"` | `"development"` (`.env`) / `"production"` (`.env.production`) | Controls cookie `secure` flag (`is_production`), OTP debug return (`dev_otp`), and logging. |
| `PORT` | `.env`, `config.py` | `8000` | `8000` | Port for Uvicorn server (`app/main.py:100`). |
| `API_BASE_URL` | `.env`, `config.py` | `"http://localhost:8000"` | `"http://localhost:8000"` | Base URL for backend self-references. |
| `FRONTEND_URL` | `.env`, `config.py` | `"http://localhost:3000"` | `"http://localhost:5173"` (`.env`) / `"https://campus-buddy-iota.vercel.app"` (`.env.production`) | Used for CORS / redirects. |
| `CORS_ORIGINS` | `config.py`, `.env.production` | `["http://localhost:3000", "http://localhost:5173", "https://campus-buddy-iota.vercel.app", "https://campusos-api.onrender.com", "https://campusos-api-5662.onrender.com"]` | Default list used in `.env` | Allowed origins in `CORSMiddleware` (`app/main.py:76`). |
| `DATABASE_URL` | `.env`, `config.py` | `postgresql://postgres:postgres@localhost:5432/campusos` | `[REDACTED — Supabase db.qfrrcwsetmbggreiefcd.supabase.co postgres superuser URI]` | Read-Write connection pool (`db_pool_rw` in `app/core/database.py`). |
| `DATABASE_URL_READONLY` | `.env`, `config.py` | `postgresql://app_read:...@localhost:5432/campusos` | `[REDACTED — Identical to DATABASE_URL in .env]` | Read-Only connection pool (`db_pool_ro`). Because `.env` sets this equal to `DATABASE_URL`, read-only DB role enforcement is bypassed. |
| `JWT_SECRET` | `.env`, `config.py` | `"super-secret-256-bit-key..."` | `[REDACTED]` | Signs/verifies HS256 session JWTs, OTP HMACs, and file signed URLs. |
| `CSRF_SECRET` | `.env`, `config.py` | `"csrf-secret-key-change-in-production..."` | `[REDACTED]` | Loaded in `config.py` (Note: `auth_service.py` uses `secrets.token_urlsafe(32)` for CSRF tokens). |
| `SESSION_EXPIRE_DAYS` | `.env`, `config.py` | `7` | `7` | JWT expiration lifetime (`auth_service.py:166`). |
| `GEMINI_API_KEY_1` | `.env`, `config.py` | `""` | `[REDACTED — Live AIzaSy... key]` | Primary Gemini API key in `GeminiAPIKeyRotator`. |
| `GEMINI_API_KEY_2` | `.env`, `config.py` | `""` | `[REDACTED — Live AIzaSy... key]` | Secondary Gemini API key in `GeminiAPIKeyRotator`. |
| `GEMINI_API_KEY_3` | `.env`, `config.py` | `""` | `[REDACTED — Live AIzaSy... key]` | Tertiary Gemini API key in `GeminiAPIKeyRotator`. |
| `RESEND_API_KEY` | `.env`, `config.py` | `""` | `""` (Empty in `.env`) | Resend API token for sending OTP emails (`auth_service.py:130`). When empty, OTPs are logged and returned as `dev_otp`. |
| `EMAIL_FROM` | `.env`, `config.py` | `"CampusOS <noreply@campus.edu.in>"` | `"CampusOS <onboarding@resend.dev>"` | Sender address for Resend OTP emails. |
| `ADMIN_SEED_EMAILS` | `.env`, `config.py` | `"admin@campus.edu.in"` | `"admin@campus.edu.in"` | Comma-separated emails automatically granted `role='admin'` on OTP login (`auth_service.py:191`). |
| `STORAGE_DIR` | `.env`, `config.py` | `"./storage/uploads"` | `"./storage/uploads"` | Local filesystem path for uploaded documents. |
| `FILE_RETENTION_DAYS` | `.env`, `config.py` | `30` | `30` | Retention window before `sweeper_service.py` deletes unreferenced files. |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend-next/.env.local` | `"http://localhost:8000"` | `"http://localhost:8000"` | Backend base URL used by `frontend-next/src/lib/api.ts:3`. |
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend-next/.env.local` | N/A | `"https://asqibroozdtioxhqhnvw.supabase.co"` | **Unused** in `frontend-next/src/`. Also points to a different Supabase project than backend's `qfrrcwsetmbggreiefcd`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `frontend-next/.env.local` | N/A | `[REDACTED]` | **Unused** in `frontend-next/src/`. |
| `VITE_API_BASE_URL` | `frontend/src/lib/api.ts` | `"http://localhost:8000"` | Unset (uses default) | Backend base URL for legacy Vite frontend (`frontend/`). |

---

## 14. Build, Execution & Deployment Architecture

### 14.1 Local Development Execution
- **Database (`docker-compose.yml`):** Runs `pgvector/pgvector:pg16` on `localhost:5432` (container `campusos-postgres`, DB `campusos`). Or connects directly to cloud Supabase via `.env`.
- **Backend (`run_backend.ps1`):** Activates `.venv` and runs `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
- **Frontend (`run_frontend.ps1` vs `frontend-next/`):**
  - **Mismatch:** `run_frontend.ps1` executes `Set-Location -Path "$PSScriptRoot\frontend"; npm run dev`, which launches the **legacy Vite frontend (`frontend/`) on port 5173**, NOT the primary Next.js frontend (`frontend-next/`)!
  - To run the primary Next.js frontend locally, a developer must run `npm --prefix frontend-next run dev` (which starts `next dev` on port `3000`).

### 14.2 Broken Artifacts in Build / Test Configuration
1. **Broken `frontend-next/Dockerfile` (`frontend-next/Dockerfile:1-19`):**
   - Contains `COPY frontend/package*.json ./` and `COPY frontend/ ./` and `EXPOSE 5173`. It was copied from the legacy Vite `frontend/` directory and will fail if built inside `frontend-next/` or against the Next.js app.
2. **Broken `frontend-next/playwright.config.ts` (`playwright.config.ts:13-22`):**
   - Configures `webServer[0]` with `command: "python -m uvicorn backend.tests.e2e_server:app --host 127.0.0.1 --port 8000"`. No `backend/` directory or `e2e_server.py` module exists in the repository (the backend lives in `app/main.py`).

### 14.3 Production Deployment Topology

```mermaid
flowchart LR
    subgraph GitHub["GitHub Repository & Actions"]
        Repo["CystronCode/CampusBuddy<br/>(main branch)"]
        Cron[".github/workflows/uptime_ping.yml<br/>(Every 14 mins: */14 * * * *)"]
    end

    subgraph VercelCloud["Vercel Edge / Serverless"]
        VercelApp["https://campus-buddy-iota.vercel.app<br/>(Builds frontend-next/ — Next.js 16)"]
    end

    subgraph RenderCloud["Render Web Service"]
        RenderAPI["https://campusos-api-5662.onrender.com<br/>(uvicorn app.main:app)<br/>Ephemeral Disk: ./storage/uploads"]
    end

    subgraph SupabaseCloud["Supabase Managed PostgreSQL"]
        SupaDB[("db.qfrrcwsetmbggreiefcd.supabase.co:5432<br/>PostgreSQL 16 + pgvector + pg_trgm")]
    end

    subgraph ExternalAPIs["External Third-Party APIs"]
        Gemini["Google Gemini API<br/>(gemini-2.5-flash & gemini-embedding-001)"]
        Resend["Resend Email API<br/>(api.resend.com)"]
    end

    Repo -->|"Auto-Deploy frontend-next/"| VercelApp
    Repo -->|"Auto-Deploy app/"| RenderAPI
    Cron -->|"GET /health & GET /ready"| RenderAPI
    VercelApp -->|"HTTPS REST + SSE (/v1/*)<br/>CORS Allowed"| RenderAPI
    RenderAPI -->|"TCP 5432 (psycopg2 pool)"| SupaDB
    RenderAPI -->|"HTTPS"| Gemini
    RenderAPI -->|"HTTPS"| Resend
```

---

## 15. Testing & Code Quality

### 15.1 Backend Test Suite (`tests/`)
The repository includes 3 backend test files using `pytest` and `fastapi.testclient.TestClient`:
1. **`tests/test_phase1_phase2.py` (13 tests):** Tests `/health`, OTP generation/HMAC verification, CSRF rejection on `/api/me`, IST `time_engine` resolution (weekday, Sunday, holiday lookahead), and `validators.py` (end-before-start error, room overlap error, split-batch warning, menu price/veg validation).
2. **`tests/test_phase3_phase4.py` (13 tests):** Tests `tier0_engine.py` (<50ms latency), `router_engine.py` tool execution, `embedding_service.py` 768-d normalization, `rag_engine.py` hybrid retrieval, `sweeper_service.py`, `/api/admin/rollback`, HMAC signed file URLs, and `mcp_server.py` tools.
3. **`tests/test_production_suite.py` (29 tests; 55 total across all 3 files):** Tests `/v1/auth/login` (student/admin/invalid), `/v1/me`, `/v1/menu`, `/v1/faculty`, `/v1/timetable`, `/v1/calendar`, `/v1/events`, `/v1/chat`, `/v1/chat/stream`, `/v1/ingestion`, `/v1/sources`, `/v1/admin/system`, `/v1/admin/memberships`, and `/v1/integrations`.

### 15.2 Crucial Caveat About the Test Suite
- **Why All 55 Tests Pass Regardless of Database State:** Every service (`auth_service.py`, `cache_service.py`, `approval.py`, `rag_engine.py`, `v1_compat.py`) catches database exceptions and falls back to hardcoded in-memory dictionaries (`_mock_otps`, `_mock_store`, `_mock_submissions`, `_mock_chunks`). Therefore, `pytest` does **not** verify that SQL queries match the schema in `migrations/versions/001_initial_schema.py`.
- **Playwright E2E Suite (`frontend-next/tests/campus.spec.ts`):** Tests login, Chat prompt pills, Browse sub-tabs, Settings, and Admin console tabs. However, as noted in Section 14.2, `playwright.config.ts` points to a nonexistent backend module (`backend.tests.e2e_server:app`), so it only runs if a server is already listening on port `8000` (`reuseExistingServer: true`).

---

## 16. Known Technical Limitations, Risks & Architectural Gaps

| Severity | Category | Issue Summary | Evidence (File & Lines) | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | Security / Auth | **Unverified JWT Signatures on `/v1/*`** | `app/routers/v1_compat.py:55` (`options={"verify_signature": False}`) | Any client can forge a Bearer JWT with arbitrary `sub`, `email`, and `role` without knowing `JWT_SECRET`. |
| **CRITICAL** | Security / Auth | **Unauthenticated Requests Default to `institution_admin` on `/v1/*`** | `app/core/middleware.py:39`, `app/routers/v1_compat.py:49-51, 80-86` | Calling any `/v1/*` endpoint without an `Authorization` header executes as `admin@campus.edu.in` (`role = "institution_admin"`). |
| **CRITICAL** | Security / Auth | **Zero RBAC Enforcement on `/v1/ingestion/*` & `/v1/admin/*`** | `app/routers/v1_compat.py:1207-1655` | Any student or anonymous caller can upload documents, approve/publish data to live campus scopes, or reject submissions. |
| **CRITICAL** | Security / Auth | **Hardcoded Plaintext Passwords in `/v1/auth/login`** | `app/routers/v1_compat.py:130-169` | Production login accepts hardcoded passwords (`123456`, `CampusAdmin123!`, `admin123`) and ignores the `users` table. |
| **HIGH** | Database Schema | **Severe Schema Drift Between Migrations and Runtime SQL** | `migrations/versions/001_initial_schema.py` vs `cache_service.py`, `uploads.py`, `approval.py`, `v1_compat.py` | Running `alembic upgrade head` or `scripts/init_db.sql` on a fresh PostgreSQL instance produces tables missing columns (`data_payload`, `submitted_by`, `day_of_week`, `subject_name`, `item_name`, `full_name`, `doc_title`) queried by the app. |
| **HIGH** | Database / Bug | **Contradictory `events` Column Names Between Write and Read Paths** | `approval.py:351` & `v1_compat.py:1532` (write `club, starts_at, ends_at`) vs `cache_service.py:154` (reads `organizer, start_time, end_time, poster_url`) | `cache_service.get_events()` fails unless the DB table has both sets of columns, falling back silently to `_mock_store["events"]`. |
| **HIGH** | Persistence | **Volatile In-Memory State for `/v1/*` Conversations & User Preferences** | `app/routers/v1_compat.py:42-45` (`_conversations`, `_messages`, `_user_prefs`) | All chat history and profile preference updates made in `frontend-next` are lost whenever the Render backend restarts or redeploys. |
| **HIGH** | API Contract | **7 Frontend Actions Call Nonexistent Backend Routes (`404`/`405`)** | `admin-view.tsx:154, 656, 849` (`/mapping`, `/retry`, `/reindex`, `POST /v1/admin/memberships`); `settings-view.tsx:42, 60, 74` (`/v1/integrations/*`) | Admin mapping, job retry, source re-indexing, member creation, and Google Calendar/Gmail connection buttons always fail with HTTP 404 or 405. |
| **MEDIUM** | UI / Product | **`HomeView` and `MenuManagerView` Are 100% Mocked in `frontend-next`** | `frontend-next/src/components/campus-app.tsx:1149-1579, 1730-1906` | Dashboard KPIs, student attendance check-in, admin home review queue, and the entire Canteen Menu Manager operate only on static local React state. |
| **MEDIUM** | Infrastructure | **Ephemeral Local Disk Storage for Uploaded Files** | `app/core/config.py:48` (`STORAGE_DIR = "./storage/uploads"`) | On Render web services without a persistent disk mount, uploaded PDFs/posters in `storage/uploads/` are wiped on every container redeploy, breaking `/api/files/{id}/raw` previews. |
| **MEDIUM** | Database Security | **`DATABASE_URL_READONLY` Uses Superuser Connection in `.env`** | `.env` (`DATABASE_URL_READONLY` == `DATABASE_URL`) | Bypasses the least-privilege `app_read` PostgreSQL role designed in `001_initial_schema.py`. |
| **LOW** | DevOps / Tooling | **Broken `frontend-next/Dockerfile`, `playwright.config.ts`, and `run_frontend.ps1`** | `frontend-next/Dockerfile`, `frontend-next/playwright.config.ts:15`, `run_frontend.ps1:9` | `Dockerfile` copies `frontend/` instead of `frontend-next/`; `playwright.config.ts` references nonexistent `backend.tests.e2e_server`; `run_frontend.ps1` launches the legacy Vite app instead of `frontend-next`. |

---

## 17. Real-World "Under the Hood" Workflow Examples

### Workflow 1: User Clicks "Sign In" on the Primary Next.js App (`frontend-next`)
1. **UI Event:** User clicks the **"Student Demo"** pill in `AuthScreen` (`frontend-next/src/components/campus-app.tsx:969`), which autofills `email = "student@campus.edu.in"` and `password = "123456"`, then clicks **"Sign in"** (`handleSubmit` at `line 739`).
2. **Network Call:** `apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })` sends `POST /v1/auth/login`.
3. **Middleware:** `SessionSecurityMiddleware` (`app/core/middleware.py:39`) sees `path.startswith("/v1/")` and passes the request straight through without cookie or CSRF checks.
4. **Backend Handler:** `v1_login()` (`app/routers/v1_compat.py:124`) checks `if email == "student@campus.edu.in" and password == "123456":` (`line 135`). No database query is executed. It constructs a hardcoded student dictionary (`id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"`, `branch: "CSE"`, `semester: 3`, `section: "A"`) and calls `create_session_jwt()`.
5. **Client Hydration:** `campus-app.tsx:761` saves `res.access_token` to `localStorage` (`campus_token`), calls `GET /v1/me`, and renders `HomeView`.

### Workflow 2: Student Asks "What can I eat for veg lunch under 100 rupees?" in `ChatView`
1. **UI Event:** Student types `"What can I eat for veg lunch under 100 rupees?"` in `frontend-next/src/components/chat-view.tsx` and clicks Send (`send()` at `line 95`).
2. **SSE Request:** `streamChat()` (`frontend-next/src/lib/api.ts:52`) sends `POST /v1/chat/stream` with `{ message, conversation_id }`.
3. **Backend Execution:** `v1_chat_stream()` (`v1_compat.py:1136`) calls `await _process_v1_chat(payload, request)`:
   - At `v1_compat.py:1060`, the food keyword branch matches (`"eat"`, `"lunch"`, `"veg"`).
   - It calls `await get_menu()` in `app/services/cache_service.py:115`, which checks the 60s RAM cache (`_ram_cache.get("menu", "v1")`) or queries `SELECT id, day_of_week, meal, item_name, price, is_veg, facility FROM menu_items WHERE version = %s`.
   - `v1_compat.py:1066-1091` filters items by `is_veg == True`, `meal == "lunch"`, and `price <= 100`, fabricates `protein_g` and `calories` from each item's price, and builds a `{"type": "food", "items": ...}` card.
4. **Simulated Streaming:** `v1_chat_stream()` slices `result["answer"]` into 48-character chunks, yielding SSE `data: {"delta": ...}` events every `10ms`, followed by `data: {"done": true, "payload": result}`.
5. **UI Rendering:** `chat-view.tsx` appends each delta to the assistant bubble and renders `<FoodCard />` (`frontend-next/src/components/result-cards.tsx:222`).

### Workflow 3: Student Clicks "Mark attendance" on the Student `HomeView`
1. **UI Event:** On the Home tab (`frontend-next/src/components/campus-app.tsx:1417`), the student sees `"Next Class — In 24 Minutes: Data Structures & Algorithms"` and clicks the **"Mark attendance"** button.
2. **Under the Hood:** The button's `onClick` handler (`lines 1418-1422`) executes:
   ```tsx
   onClick={() => {
     setCheckedIn(true);
     onToast("Attendance marked for CS301 · 10:00 AM");
   }}
   ```
3. **Actual Result:** **Zero network requests are made.** The button changes label to `"✓ Checked in"` in local React state (`checkedIn`) and displays a temporary toast notification. Refreshing the page resets `checkedIn` to `false`.

### Workflow 4: Admin Uploads a Timetable PDF and Clicks "Approve & Publish" in `AdminView`
1. **UI Event:** In `frontend-next/src/components/admin-view.tsx` (`UploadZone`, `line 301`), the user selects `timetable.pdf`, chooses category `"academic"`, and clicks **"Start Ingestion"**.
2. **Upload & Extraction:** `POST /v1/ingestion/upload` (`v1_compat.py:1293`) writes the file to `storage/uploads/{uuid}_timetable.pdf` and calls `await process_document_upload()` (`ingestion_service.py:298`). PyMuPDF (`fitz`) extracts text (or passes PDF bytes to Gemini 2.5 Flash Vision if `<30` chars/page), Gemini returns structured JSON matching `TimetableExtractionSchema`, and `validate_timetable_rows()` (`validators.py:16`) checks for time reversals and room clashes.
3. **Database Staging:** `v1_compat.py:1346` inserts a row into `files` and `submissions` (`status = 'pending_review'` or `'flagged'`, `data_payload = JSON`).
4. **Approval:** When the user clicks **"Approve & Publish"** in `ReviewQueue` (`admin-view.tsx:154`), `POST /v1/ingestion/{job_id}/approve` (`v1_compat.py:1419`) increments `active_version` in `data_versions` for `timetable:CSE-3-A`, inserts the rows into `timetable_slots`, sets `submissions.status = 'approved'`, and calls `invalidate_scope("timetable:CSE-3-A")` on `cache_service`.

### Workflow 5: User Clicks "Connect" on Google Calendar in `SettingsView`
1. **UI Event:** User navigates to Settings (`frontend-next/src/components/settings-view.tsx:218`) and clicks **"Connect"** on the Google Calendar card.
2. **Under the Hood:** `connect("google_calendar")` (`lines 39-51`) sends `POST /v1/integrations/google_calendar/connect`.
3. **Actual Result:** The backend has **no route matching `POST /v1/integrations/{provider}/connect`**, so FastAPI returns `404 Not Found`. `settings-view.tsx:48` catches the exception inside an empty `catch {}` block and finally sets `busy = null`. Nothing happens on screen or in the backend.

### Workflow 6: Admin Edits Extracted Cells in the Legacy Vite App (`SubmissionReviewDetail.tsx`)
1. **UI Event:** In the legacy Vite app (`frontend/src/components/admin/SubmissionReviewDetail.tsx:114`), an admin edits a cell in the right-hand verification table.
2. **Debounced Live Validation:** `triggerPatchValidation()` (`line 97`) waits `400ms` and sends `PATCH /api/submissions/{submissionId}` with `{ extracted: updated }` plus cookie and `X-CSRF-Token`.
3. **Backend Re-Validation:** `approval.py:patch_submission_extracted_data()` (`line 158`) runs `validate_extracted_data(data_type, rows)` (`validators.py`), updates `submissions` in PostgreSQL, and returns `{ status, confidence: { cells, has_errors, has_warnings } }`.
4. **UI Update:** Red (`error`) or amber (`warning`) cell borders update live, and the **"Approve & Publish"** button automatically unlocks once `confidence.has_errors === false`.

---

## 18. Final Architecture Summary (A–J)

### A. What the Project Actually Is
CampusOS (branded in the UI as **CampusBuddy**) is a hybrid campus directory, AI assistant, and document ingestion web application for engineering colleges. Architecturally, the repository contains **two co-existing generations**: a secure, cookie/OTP-authenticated FastAPI `/api/*` backend paired with a Vite + React 18 SPA (`frontend/`), and a newer Next.js 16 + React 19 frontend (`frontend-next/`) powered by a 1,669-line compatibility router (`app/routers/v1_compat.py`) mounted at `/v1/*`.

### B. What Genuinely Works End-to-End
1. **3-Tier Hybrid Query Engine (`tier0_engine.py`, `router_engine.py`, `tool_executor.py`, `rag_engine.py`):** Natural-language student queries genuinely route through `<5ms` deterministic regex (Tier 0), Gemini 2.5 Flash tool-calling over 6 campus tools (Tier 1), and hybrid `pgvector` cosine + `pg_trgm` trigram search over `doc_chunks` (Tier 2), returning rich structured cards (`TimetableCard`, `FoodCard`, `FacultyCard`, `CalendarCard`, `EventsCard`, `GeneralDocsCard`).
2. **Structured Directory Browsing (`BrowseView` in both frontends):** Timetable, Canteen Menu, Faculty Directory, Academic Calendar, and Events views genuinely query the backend, which hydrates from PostgreSQL via a 60-second TTL RAM cache (`cache_service.py`).
3. **Multimodal Document Extraction & Deterministic Validation (`ingestion_service.py`, `validators.py`):** Uploading PDFs, DOCX, XLSX, or images extracts structured rows via PyMuPDF/`python-docx`/`openpyxl` + Gemini 2.5 Flash structured output and runs deterministic cell-level validation rules.
4. **Generation 1 Authentication & Security (`/api/auth/*` + `SessionSecurityMiddleware`):** Email OTP generation (`HMAC-SHA256`), `HttpOnly` JWT cookies, `token_version` revocation, and double-submit CSRF protection work end-to-end for `/api/*` routes.
5. **Nightly Retention Sweeper (`sweeper_service.py`):** APScheduler cron job cleaning expired events, unreferenced files, and old OTPs while preserving rollback versions.

### C. What Is Partially Implemented
1. **Next.js Chat Persistence & Profile Settings (`/v1/conversations`, `PATCH /v1/me`):** Functional during a single process lifetime, but stored in volatile Python RAM dicts (`_conversations`, `_messages`, `_user_prefs`) rather than PostgreSQL.
2. **Next.js Admin Console (`frontend-next/src/components/admin-view.tsx`):** File upload, job listing, approve, and reject work via `/v1/ingestion/*`, but cell editing (`PATCH /v1/ingestion/{id}/records`) is disconnected from the UI, and Mapping/Retry/Re-index/Add Member buttons call missing endpoints.
3. **FastMCP Server (`app/mcp_server.py`):** Exposes 14 MCP tools, of which 12 call real backend services (though hardcoded to section `CSE-3-A`) and 2 (`detect_schedule_conflicts`, `search_authorized_emails`) are empty stubs returning `[]`.

### D. What Is Simulated or Mocked
1. **Next.js Authentication (`/v1/auth/login`, `/signup`, `/reset-password`, `/update-password`):** Uses hardcoded demo credentials (`123456`, `CampusAdmin123!`, `admin123`) and never reads or writes the `users` table.
2. **Next.js Home Dashboard (`HomeView` in `campus-app.tsx`):** Both the Student Bento view (24-minute countdown, Mark Attendance button, 89.4% attendance ring, weekly stats) and the Admin Bento view (KPI counters, hourly order chart, 3-item "Needs review" approval queue) are 100% static mock state.
3. **Next.js Canteen Menu Manager (`MenuManagerView` in `campus-app.tsx`):** 100% local React state initialized from `INITIAL_FOOD` with zero backend API calls.
4. **SSE Chat Streaming (`/v1/chat/stream`):** Simulated post-hoc chunking (48-character slices with `10ms` sleep) after the full response is already generated.
5. **Canteen Nutrition Macros (`protein_g`, `calories` in `/v1/menu`), Calendar Free Slots (`/v1/calendar`), Admin System Verification Stats (`/v1/admin/system`), and Admin Memberships (`GET /v1/admin/memberships`).**

### E. What Is Disconnected or Broken
1. **Critical `/v1/*` Security Bypass (`middleware.py:39`, `v1_compat.py:48-105`):** `/v1/*` bypasses `SessionSecurityMiddleware`, disables JWT signature verification (`verify_signature: False`), defaults unauthenticated requests to `institution_admin`, and enforces zero RBAC on admin endpoints.
2. **Database Schema Drift (`001_initial_schema.py` vs Runtime SQL):** Migration scripts define different column names (`uploaded_by`, `extracted`, `day`, `subject`, `item`, `name`, `title`) than the runtime SQL queries (`submitted_by`, `data_payload`, `day_of_week`, `subject_name`, `item_name`, `full_name`, `doc_title`), and `events` has contradictory column names between `approval.py` (`club, starts_at, ends_at`) and `cache_service.py` (`organizer, start_time, end_time, poster_url`).
3. **7 Missing Endpoints Called by `frontend-next` (`404`/`405`):** `/v1/ingestion/{id}/mapping`, `/v1/ingestion/{id}/retry`, `/v1/sources/{id}/reindex`, `POST /v1/admin/memberships`, `POST /v1/integrations/{p}/connect`, `POST /v1/integrations/{p}/sync`, `DELETE /v1/integrations/{p}`.
4. **Broken DevOps Artifacts:** `frontend-next/Dockerfile`, `frontend-next/playwright.config.ts`, and `run_frontend.ps1`.

### F. How the Frontend Actually Works
The primary frontend (`frontend-next/`) is a client-side rendered Next.js 16 application centered around a 1,963-line root component (`campus-app.tsx`) that manages authentication token state in `localStorage` (`campus_token`) and switches between `HomeView`, `ChatView`, `BrowseView`, `MenuManagerView`, `AdminView`, and `SettingsView`, communicating with the backend over `/v1/*` via `apiFetch()` and `streamChat()`. A secondary legacy Vite + React 18 SPA (`frontend/`) communicates with `/api/*` using `HttpOnly` cookies and `X-CSRF-Token`.

### G. How the Backend Actually Works
The FastAPI backend (`app/main.py`) runs a single ASGI application exposing both `/api/*` and `/v1/*` routers over shared core services (`cache_service`, `tier0_engine`, `router_engine`, `tool_executor`, `rag_engine`, `ingestion_service`, `validators`, `time_engine`, `sweeper_service`) and a dual `psycopg2` `ThreadedConnectionPool` (`db_pool_rw` and `db_pool_ro`) wrapped in `asyncio.to_thread()`.

### H. How Data Flows Through the System
- **Read Path:** Frontend -> `/v1/*` or `/api/*` -> `cache_service` (60s TTL RAM cache keyed by scope and active version from `data_versions`) -> PostgreSQL (`timetable_slots`, `menu_items`, `faculty`, `holidays`, `events`) or `rag_engine` (`doc_chunks` via `pgvector` HNSW cosine `<=>` + `pg_trgm`).
- **Write Path:** Admin Upload -> `storage/uploads/` + `ingestion_service` (PyMuPDF/DOCX/XLSX + Gemini 2.5 Flash) + `validators` -> `files` & `submissions` -> Admin Approval -> Target relational/vector table + `data_versions` pointer increment + `cache_service.invalidate_scope()`.

### I. How External Services Are Used
- **Google Gemini API (`google-genai`):** Powers structured document extraction (`gemini-2.5-flash`), Tier 1 tool routing & synthesis (`gemini-2.5-flash`), Tier 2 RAG answer synthesis (`gemini-2.5-flash`), and 768-dim vector embeddings (`gemini-embedding-001`) via a 3-key round-robin rotator (`GeminiAPIKeyRotator`).
- **Supabase PostgreSQL:** Hosts the cloud PostgreSQL 16 database with `pgvector` and `pg_trgm`.
- **Resend API:** Integrated in `auth_service.py` for `/api/auth/request-otp` emails (currently unconfigured in `.env`, falling back to `dev_otp`).
- **Vercel, Render & GitHub Actions:** Host the Next.js frontend, FastAPI backend, and 14-minute keep-alive cron respectively.

### J. Readiness Assessment for the Next Phase of Development
The project has a strong core AI/RAG and document-extraction engine, but **is not production-safe in its current state** until four foundational blockers are resolved:
1. **Lock down `/v1/*` security:** Enable `verify_signature: True` on JWT decoding, remove the default `institution_admin` fallback for unauthenticated requests, wire `/v1/auth/*` and `/v1/me` to the real `users` table, and enforce RBAC on `/v1/ingestion/*` and `/v1/admin/*`.
2. **Reconcile the PostgreSQL schema:** Create an Alembic migration that aligns `001_initial_schema.py` with the actual column names queried by `cache_service.py`, `uploads.py`, `approval.py`, and `v1_compat.py` (especially fixing the `events` table read/write column mismatch).
3. **Replace volatile RAM state & mocked UI views:** Persist `/v1/conversations` and `/v1/me` preferences in PostgreSQL, and either connect `HomeView`, `MenuManagerView`, and the 7 missing `AdminView`/`SettingsView` routes to real backend endpoints or remove the non-functional UI controls.
4. **Move file uploads off ephemeral container storage:** Replace local `./storage/uploads` with cloud object storage (e.g., Supabase Storage or S3) so uploaded PDFs survive Render container restarts.
