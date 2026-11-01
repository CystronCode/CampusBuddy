# CampusOS — Institutional Campus Intelligence Platform

An enterprise campus operating system powered by **Supabase PostgreSQL** (`pgvector`), **Next.js 15 App Router**, **FastAPI**, **Google Gemini Multi-Model Cascade**, and **Official FastMCP**.

---

## Architecture Overview

* **Frontend (`frontend-next/`):** Next.js 15 App Router with React 19, Tailwind CSS, Lucide Icons, and Supabase Auth.
* **Backend (`app/`):** FastAPI async service with:
  * **3-Tier Query Engine:**
    * **Tier 0:** Sub-15ms deterministic regex/chip execution for timetables, menus, and dates.
    * **Tier 1:** Gemini Flash-Lite query router with 24-hour LRU caching and strict identity isolation.
    * **Tier 2:** Hybrid pgvector cosine similarity ($\ge 0.45$) + Full-Text Search via Reciprocal Rank Fusion ($k=60$).
  * **Multimodal Vision Ingestion:** Document parsing (PDF, Excel, Word, Image) with Gemini vision cascade and deterministic validation.
  * **Official Model Context Protocol (MCP):** 14 typed tools running over Stdio and SSE endpoints.
* **Database:** Supabase PostgreSQL with 13 domain tables (`timetable_slots`, `menu_items`, `holidays`, `events`, `faculty`, `doc_chunks`, `data_versions`, etc.).

---

## Quick Start

### 1. Prerequisites
* Python 3.11+
* Node.js 18+
* PostgreSQL with `pgvector` extension (e.g. Supabase)

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 3. Backend Setup
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend Setup
```bash
cd frontend-next
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Test Suite

Run the full verification suite (55 automated tests):
```bash
pytest tests/ -v
```

---

## MCP Server

Start the official Model Context Protocol server:
```bash
python -m app.mcp_server
```
Available tools:
1. `get_timetable`
2. `search_menu`
3. `get_faculty`
4. `get_holidays`
5. `get_events`
6. `search_docs`
7. `find_free_slots`
8. `list_canteen_items`
9. `get_academic_calendar`
10. `get_class_schedule`
11. `query_campus_knowledge`
12. `check_event_conflicts`
13. `get_system_overview`
14. `get_active_versions`
