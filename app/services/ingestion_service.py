import asyncio
import io
import os
import json
import logging
from typing import Dict, Any, List, Optional
import pdfplumber
import openpyxl
from docx import Document as DocxDocument
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.database import get_read_db, get_write_db
from app.services.validators import run_deterministic_validators
from app.schemas.ingestion_schemas import GET_SCHEMA_FOR_TYPE

logger = logging.getLogger("campus.ingestion")

# Singleton Invariant: exactly one extraction job executed concurrently
EXTRACTION_SEMAPHORE = asyncio.Semaphore(1)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", settings.GEMINI_API_KEY)
GEMINI_MODEL_EXTRACT = os.environ.get("GEMINI_MODEL_EXTRACT", settings.GEMINI_MODEL_EXTRACT)

_ai_clients: List[genai.Client] = []

def get_ai_clients() -> List[genai.Client]:
    global _ai_clients
    if not _ai_clients:
        for k in settings.GEMINI_API_KEYS:
            if k and not k.startswith("mock"):
                try:
                    _ai_clients.append(genai.Client(api_key=k))
                except Exception as e:
                    logger.warning("Could not initialize Gemini Client: %s", e)
    return _ai_clients

def get_ai_client() -> Optional[genai.Client]:
    clients = get_ai_clients()
    return clients[0] if clients else None

def parse_pdf_text_sync(content: bytes) -> str:
    """Extract text layer with per-page cache flushes and pypdf fallback."""
    extracted_text = []
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for idx, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    extracted_text.append(f"--- PAGE {idx + 1} ---\n" + text)
                page.flush_cache()
    except Exception as e:
        logger.warning("pdfplumber parse warning: %s", e)

    if not extracted_text:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            for idx, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    extracted_text.append(f"--- PAGE {idx + 1} ---\n" + text)
        except Exception as e:
            logger.warning("pypdf fallback warning: %s", e)

    return "\n".join(extracted_text)

def parse_excel_sync(content: bytes) -> str:
    """Read Excel workbook in read-only streaming mode."""
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    lines = []
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        lines.append(f"=== SHEET: {sheet_name} ===")
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                lines.append("\t".join([str(c) if c is not None else "" for c in row]))
    wb.close()
    return "\n".join(lines)

def parse_docx_sync(content: bytes) -> str:
    """Extract text from Word document paragraphs."""
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)

CANDIDATE_MODELS = list(dict.fromkeys([
    GEMINI_MODEL_EXTRACT,
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite-preview",
]))

# Per-call ceiling. With low thinking effort a full timetable returns in ~10s; anything
# beyond 75s is a hung/overloaded model and we should move to the next one.
VISION_TIMEOUT_SEC = 75.0
# Hard wall-clock budget for the whole model/key cascade so an upload can never hang for minutes.
VISION_TOTAL_BUDGET_SEC = 150.0

def _thinking_config_for(model: str) -> Optional[Any]:
    """Gemini 3 flash models 'think' by default (28-34s for a timetable). Table transcription needs
    no deep reasoning: LOW effort measured ~9s with the same row count and faculty mapping."""
    if model.startswith("gemini-3") and "lite" not in model:
        try:
            return types.ThinkingConfig(thinking_level="LOW")
        except Exception:
            return None
    return None

_ROW_KEYS = {"timetable": "slots", "menu": "items", "holidays": "holidays", "faculty": "faculty"}

def _is_transient_error(e: Exception) -> bool:
    msg = str(e)
    return any(tok in msg for tok in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "DEADLINE"))

def normalize_extracted_payload(cand: Any, data_type: str) -> Dict[str, Any]:
    """Ensure returned JSON matches canonical keys for faculty, menu, timetable, holidays."""
    if isinstance(cand, list):
        if data_type == "menu":
            return {"items": cand}
        elif data_type == "faculty":
            return {"faculty": cand}
        elif data_type == "timetable":
            return {"slots": cand}
        elif data_type == "holidays":
            return {"holidays": cand}
        return {"records": cand}
    if isinstance(cand, dict):
        key_map = {
            "menu": ("items", "menu", "dishes", "food_items", "canteen"),
            "faculty": ("faculty", "faculty_members", "profiles", "teachers"),
            "timetable": ("slots", "timetable", "classes", "schedule"),
            "holidays": ("holidays", "events", "calendar", "dates"),
        }
        canonical_key = {"menu": "items", "faculty": "faculty", "timetable": "slots", "holidays": "holidays"}.get(data_type)
        if canonical_key and canonical_key not in cand:
            candidates = key_map.get(data_type, ())
            found = False
            for k in candidates:
                if isinstance(cand.get(k), list) and len(cand[k]) > 0:
                    cand[canonical_key] = cand[k]
                    found = True
                    break
            if not found:
                for k, v in cand.items():
                    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                        cand[canonical_key] = v
                        break
        return cand
    return {}

async def extract_via_gemini_vision(content: bytes, mime: str, schema_cls: Any, data_type: str = "document") -> Any:
    """Process scanned PDFs and images using Gemini Vision with multi-key & multi-model quota cascade."""
    clients = get_ai_clients()
    if not clients:
        return {}

    # Full prompt from the known-good Nov 1 baseline (timetable legend mapping, faculty depth, holidays).
    vision_prompt = (
        "Extract structured records adhering precisely to the JSON schema. "
        "For timetables: carefully inspect both the main schedule grid AND any course/faculty legend or mapping table below/beside the grid. "
        "For every timetable slot, map the subject code to its full course name (subject_name) AND map the faculty initials (short_code) and course-handling faculty full name (faculty_name) from the timetable legend/footer table! "
        "Do not confuse faculty initials (like AI, RP, SN, KVR) with room numbers unless explicitly labeled as a room. "
        "Take start_time/end_time for each slot from the column header of the grid (24-hour HH:MM) and the day from the row label. "
        "Do NOT output BREAK, LUNCH, RECESS or empty cells as slots. Leave room null if no room is printed - never guess one. "
        "For menus: extract every food item with price, meal (breakfast|lunch|snacks|dinner) and is_veg. "
        "For holidays or academic calendars, extract all named dates, semester milestones, exam/quiz dates, or holidays. "
        "For faculty profiles or directories, extract ALL details in full (not just contact info): educational qualifications, degrees, teaching/research/industry experience, research interests, courses/subjects taught, publications/journals/conferences/patents, funded projects/grants, awards/memberships, administrative responsibilities, and a comprehensive bio summary. "
        f"The document type is '{data_type}'. "
        "Output valid JSON without markdown wrapping or code fences."
    )

    def _call(client, model, use_schema):
        cfg = dict(response_mime_type="application/json", temperature=0.0)
        if use_schema:
            cfg["response_schema"] = schema_cls
        thinking = _thinking_config_for(model)
        if thinking is not None:
            cfg["thinking_config"] = thinking
        return client.models.generate_content(
            model=model,
            contents=[types.Part.from_bytes(data=content, mime_type=mime), vision_prompt],
            config=types.GenerateContentConfig(**cfg),
        )

    last_err = None
    deadline = asyncio.get_event_loop().time() + VISION_TOTAL_BUDGET_SEC
    for client in clients:
        for m in CANDIDATE_MODELS:
            for use_schema in (True, False):
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 5:
                    if last_err:
                        raise last_err
                    return {}
                try:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(_call, client, m, use_schema), timeout=min(VISION_TIMEOUT_SEC, remaining)
                    )
                    parsed = normalize_extracted_payload(json.loads(response.text), data_type)
                    if any(isinstance(v, list) and len(v) > 0 for v in parsed.values()) or not use_schema:
                        return parsed
                    # schema-constrained call returned nothing: retry unconstrained on same model
                    continue
                except Exception as e:
                    last_err = e
                    logger.warning("Gemini model %s (schema=%s) vision extraction failed: %s", m, use_schema, e)
                    if _is_transient_error(e):
                        # Overloaded/quota: retrying same model without schema won't help; move to next model.
                        await asyncio.sleep(1.0)
                        break

    if last_err:
        raise last_err
    return {}

async def enqueue_extraction_task(
    submission_id: str,
    content: bytes,
    mime: str,
    data_type: str,
    metadata: Dict[str, Any]
):
    """
    Background worker task protected by global Semaphore(1).
    Extracts structured content or markdown, executes validators, and updates submission status.
    """
    async with EXTRACTION_SEMAPHORE:
        logger.info("Acquired extraction semaphore for submission %s", submission_id)
        try:
            # 1. Detect Text Layer vs Vision Requirement
            text_layer = ""
            if mime == "application/pdf":
                text_layer = await asyncio.to_thread(parse_pdf_text_sync, content)
            elif "spreadsheetml" in mime:
                text_layer = await asyncio.to_thread(parse_excel_sync, content)
            elif "wordprocessingml" in mime:
                text_layer = await asyncio.to_thread(parse_docx_sync, content)

            has_text_layer = len(text_layer.strip()) > 50

            extracted_data = None
            vision_error: Optional[Exception] = None
            client = get_ai_client()

            # Fast cache lookup by sha256 to reuse verified extractions and preserve quota
            import hashlib
            file_sha256 = hashlib.sha256(content).hexdigest()
            try:
                async with get_read_db() as conn:
                    cur = await conn.execute(
                        """SELECT s.extracted FROM files f
                           JOIN submissions s ON s.file_id = f.id
                           WHERE f.sha256 = %s AND s.extracted IS NOT NULL AND s.extracted != '{}'::jsonb
                           ORDER BY s.created_at ASC LIMIT 5""",
                        (file_sha256,)
                    )
                    rows = await cur.fetchall()
                    for r in rows:
                        cand = r["extracted"]
                        if isinstance(cand, dict):
                            for k in ("holidays", "items", "slots", "faculty"):
                                if len(cand.get(k, [])) > 0:
                                    if k == "faculty":
                                        first_fac = cand["faculty"][0] if isinstance(cand["faculty"][0], dict) else {}
                                        if not any(first_fac.get(f) for f in ("qualifications", "experience", "publications", "bio", "research_interests")):
                                            continue
                                    elif k == "slots":
                                        # Only reuse cached timetable extraction if it includes faculty/course mapping
                                        if not any(isinstance(sl, dict) and (sl.get("faculty_name") or sl.get("subject_name")) for sl in cand["slots"]):
                                            continue
                                    extracted_data = cand
                                    logger.info("Reusing existing extraction for sha256 %s (%s rows)", file_sha256[:10], len(cand[k]))
                                    break
                        elif isinstance(cand, list) and len(cand) > 0:
                            extracted_data = cand
                            logger.info("Reusing existing extraction list for sha256 %s", file_sha256[:10])
                            break
                        if extracted_data is not None:
                            break
            except Exception as cache_err:
                logger.debug("SHA256 cache lookup skipped: %s", cache_err)

            if data_type in ("syllabus", "notice"):
                # Markdown lane
                if has_text_layer:
                    extracted_data = text_layer
                elif client is not None:
                    # OCR markdown conversion via Vision
                    res = await asyncio.to_thread(
                        client.models.generate_content,
                        model=GEMINI_MODEL_EXTRACT,
                        contents=[
                            types.Part.from_bytes(data=content, mime_type=mime),
                            "Transcribe this document into clean, heading-structured Markdown."
                        ]
                    )
                    extracted_data = res.text
                else:
                    extracted_data = text_layer if text_layer else "# Notice\nDocument content."
            else:
                # Structured row lane
                target_schema = GET_SCHEMA_FOR_TYPE.get(data_type)

                if extracted_data is None:
                    # Try text-mode extraction first if text layer exists
                    if has_text_layer and client is not None and target_schema is not None:
                        prompt = (
                            f"Convert the following campus raw text into structured JSON adhering to the schema. "
                            f"For timetables: carefully inspect both the main schedule grid AND any course/faculty legend or mapping table below/beside the grid. "
                            f"For every timetable slot, map the subject code to its full course name (subject_name) AND map the faculty initials (short_code) and course-handling faculty full name (faculty_name) from the timetable legend/footer table! "
                            f"For holidays or academic calendars, extract all named dates, semester milestones, exam/quiz dates, or holidays. "
                            f"For faculty profiles or directories, extract ALL details in full (not just contact info): educational qualifications, degrees, teaching/research/industry experience, research interests, courses/subjects taught, publications/journals/conferences/patents, funded projects/grants, awards/memberships, administrative responsibilities, and a comprehensive bio summary:\n{text_layer}"
                        )
                        for m in CANDIDATE_MODELS:
                            try:
                                res = await asyncio.to_thread(
                                    client.models.generate_content,
                                    model=m,
                                    contents=prompt,
                                    config=types.GenerateContentConfig(
                                        response_mime_type="application/json",
                                        response_schema=target_schema,
                                        temperature=0.0
                                    )
                                )
                                parsed = json.loads(res.text)
                                # Verify at least one row was parsed
                                if any(isinstance(v, list) and len(v) > 0 for v in parsed.values()):
                                    extracted_data = parsed
                                    break
                            except Exception as api_err:
                                logger.warning("Model %s failed text extraction: %s", m, api_err)

                    # Fallback to vision extraction if text extraction didn't produce rows or if no text layer
                    if (extracted_data is None or all(len(v) == 0 for v in extracted_data.values() if isinstance(v, list))) and client is not None and target_schema is not None:
                        try:
                            extracted_data = await extract_via_gemini_vision(content, mime, target_schema, data_type=data_type)
                        except Exception as vis_err:
                            vision_error = vis_err
                            logger.warning("Gemini vision extraction failed: %s", vis_err)

                # High-Speed Groq LPU Document Extraction Fallback
                if (extracted_data is None or all(len(v) == 0 for v in extracted_data.values() if isinstance(v, list))) and has_text_layer:
                    try:
                        from app.services.llm_provider import call_groq
                        schema_templates = {
                            "faculty": '{"faculty": [{"name": "Faculty Full Name", "department": "AIML", "designation": "Assistant Professor / Associate Professor", "email": "email@rvce.edu.in", "cabin": "CSE-AIML R-102", "phone": "080-...", "qualifications": "Full educational qualifications, degrees, universities, years, ranks", "experience": "Full professional employment history, roles, institutions, dates", "research_interests": ["Topic 1", "Topic 2"], "subjects": ["Subject 1", "Subject 2"], "publications": "Journal papers, conferences, patents with titles", "projects": "Consultancy and sponsored research projects", "awards": "Awards, recognitions, memberships", "responsibilities": "Administrative responsibilities and roles", "bio": "Comprehensive biography and academic overview"}]}',
                            "timetable": '{"slots": [{"day": 1, "start_time": "09:00", "end_time": "10:00", "subject": "CS201", "subject_name": "Course Title", "faculty_name": "Faculty Name", "room": "Lab 1"}]}',
                            "menu": '{"items": [{"day": null, "meal": "breakfast", "item": "Dish Name", "price": 40, "is_veg": true}]}',
                            "holidays": '{"holidays": [{"date": "2026-11-15", "name": "Holiday/Exam Name", "kind": "Academic"}]}'
                        }
                        sample_json = schema_templates.get(data_type, '{"records": [{"name": "Item", "description": "Details"}]}')
                        prompt_groq = (
                            f"Extract all structured {data_type} records from this raw campus document text.\n"
                            f"Strict Output Requirement: Return ONLY valid JSON adhering to this schema:\n{sample_json}\n\n"
                            f"Document Raw Text:\n{text_layer[:6000]}"
                        )
                        groq_res = await call_groq(
                            messages=[
                                {"role": "system", "content": "You are an expert document parser. Output strictly valid JSON without markdown formatting."},
                                {"role": "user", "content": prompt_groq}
                            ],
                            temperature=0.0,
                            response_format_json=True,
                            max_tokens=900,
                            timeout_sec=14.0
                        )
                        if groq_res:
                            cand = json.loads(groq_res)
                            cand = normalize_extracted_payload(cand, data_type)
                            for k in ("faculty", "slots", "items", "holidays"):
                                if len(cand.get(k, [])) > 0:
                                    extracted_data = cand
                                    logger.info("Groq LPU successfully extracted %s %s records from document", len(cand[k]), k)
                                    break
                    except Exception as groq_err:
                        logger.warning("Groq document extraction fallback error: %s", groq_err)

                if extracted_data is None:
                    if data_type == "timetable":
                        extracted_data = {"slots": []}
                    elif data_type == "menu":
                        extracted_data = {"items": []}
                    elif data_type == "holidays":
                        extracted_data = {"holidays": []}
                    elif data_type == "faculty":
                        extracted_data = {"faculty": []}
                    elif data_type == "poster":
                        extracted_data = {"title": "Event", "description": ""}
                    else:
                        extracted_data = {}

                extracted_data = normalize_extracted_payload(extracted_data, data_type)

                if data_type == "faculty" and isinstance(extracted_data, dict):
                    raw_content = text_layer.strip()
                    if raw_content:
                        extracted_data["raw_text"] = raw_content

                    fac_list = extracted_data.get("faculty", [])
                    if not fac_list and raw_content:
                        import re
                        lines = [l.strip() for l in raw_content.split("\n") if l.strip()]
                        detected_name = lines[0][:80] if lines else "Faculty Member"
                        for l in lines[:15]:
                            clean_l = l.replace("--- PAGE 1 ---", "").strip()
                            if any(clean_l.lower().startswith(p) for p in ("dr.", "dr ", "prof.", "prof ", "mr.", "ms.", "shri")):
                                detected_name = clean_l[:80]
                                break
                        emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', raw_content)
                        email_found = emails[0] if emails else ""
                        phones = re.findall(r'(?:\+?91[\s-]?)?[0-9]{3,5}[\s-]?[0-9]{5,8}', raw_content)
                        phone_found = phones[0] if phones else ""
                        desig_found = "Assistant Professor"
                        for d in ("associate professor", "assistant professor", "professor", "dean", "hod", "lecturer"):
                            if d in raw_content.lower():
                                desig_found = d.title()
                                break
                        cab_match = re.search(r'(?:cabin|room|lab)[\s:]*([A-Za-z0-9\s-]+)', raw_content, re.IGNORECASE)
                        cab_found = cab_match.group(1).strip()[:30] if cab_match else "Department Faculty Room"

                        extracted_data["faculty"] = [{
                            "name": detected_name,
                            "department": metadata.get("branch", "AIML"),
                            "designation": desig_found,
                            "email": email_found,
                            "phone": phone_found,
                            "cabin": cab_found,
                            "bio": raw_content[:4000]
                        }]

            # 1b. Never present an empty result as a successful draft: tell the admin why.
            if data_type in _ROW_KEYS and isinstance(extracted_data, dict):
                rows_found = extracted_data.get(_ROW_KEYS[data_type]) or []
                if not rows_found:
                    if client is None:
                        reason = "No usable GEMINI_API_KEYS configured, so scanned files/images cannot be read."
                    elif vision_error is not None:
                        reason = f"All Gemini models failed: {str(vision_error)[:300]}"
                    else:
                        reason = "The model returned no rows. Check that the file is a clear, upright, full-page scan."
                    raise RuntimeError(f"Could not extract any {data_type} records. {reason}")

            # 2. Execute Deterministic Validators
            confidence_flags = await run_deterministic_validators(data_type, extracted_data, metadata)

            # 3. Transition Submission to 'draft'
            try:
                async with get_write_db() as conn:
                    await conn.execute(
                        """UPDATE submissions 
                           SET status = 'draft',
                               extracted = %s,
                               confidence = %s,
                               updated_at = now()
                           WHERE id = %s""",
                        (json.dumps(extracted_data, default=str), json.dumps(confidence_flags, default=str), submission_id)
                    )
            except Exception as db_err:
                logger.warning("DB update to draft failed: %s", db_err)

            logger.info("Successfully extracted submission %s (status=draft)", submission_id)

        except Exception as exc:
            logger.exception("Extraction failed for submission %s: %s", submission_id, str(exc))
            try:
                async with get_write_db() as conn:
                    await conn.execute(
                        """UPDATE submissions 
                           SET status = 'failed',
                               error = %s,
                               updated_at = now()
                           WHERE id = %s""",
                        (str(exc), submission_id)
                    )
            except Exception as db_err:
                logger.warning("DB update to failed status failed: %s", db_err)
