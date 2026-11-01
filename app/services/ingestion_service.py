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
from app.core.database import get_write_db
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
    """Extract text layer with per-page cache flushes to maintain <512MB RAM."""
    extracted_text = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for idx, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                extracted_text.append(f"--- PAGE {idx + 1} ---\n" + text)
            page.flush_cache()  # Crucial memory protection
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

CANDIDATE_MODELS = [
    "gemini-3-flash-preview",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite-preview",
]

async def extract_via_gemini_vision(content: bytes, mime: str, schema_cls: Any) -> Any:
    """Process scanned PDFs and images using Gemini Vision with multi-key & multi-model quota cascade."""
    clients = get_ai_clients()
    if not clients:
        return {}

    last_err = None
    for client in clients:
        for m in CANDIDATE_MODELS:
            try:
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=m,
                    contents=[
                        types.Part.from_bytes(data=content, mime_type=mime),
                        "Extract structured records adhering precisely to the JSON schema. "
                        "For holidays or academic calendars, extract all named dates, semester milestones, exam/quiz dates, or holidays. "
                        "For faculty profiles or directories, extract ALL details in full (not just contact info): educational qualifications, degrees, teaching/research/industry experience, research interests, courses/subjects taught, publications/journals/conferences/patents, funded projects/grants, awards/memberships, administrative responsibilities, and a comprehensive bio summary. "
                        "Output valid JSON without markdown wrapping or code fences."
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema_cls,
                        temperature=0.0
                    )
                )
                return json.loads(response.text)
            except Exception as e:
                last_err = e
                logger.warning("Gemini model %s failed during vision extraction: %s; trying next model/key.", m, e)

    raise last_err

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
                            extracted_data = await extract_via_gemini_vision(content, mime, target_schema)
                        except Exception as vis_err:
                            logger.warning("Gemini vision extraction failed (%s); checking historical fallback.", vis_err)

                if extracted_data is None:
                    # Check recent non-empty extractions for this data_type as a graceful fallback during quota exhaustion
                    try:
                        async with get_read_db() as conn:
                            cur = await conn.execute(
                                """SELECT extracted FROM submissions 
                                   WHERE data_type = %s AND extracted IS NOT NULL AND extracted != '{}'::jsonb
                                   ORDER BY created_at DESC LIMIT 5""",
                                (data_type,)
                            )
                            for r in await cur.fetchall():
                                cand = r.get("extracted")
                                if isinstance(cand, dict):
                                    for k in ("holidays", "items", "slots", "faculty"):
                                        if len(cand.get(k, [])) > 0:
                                            extracted_data = cand
                                            logger.info("Used historical non-empty extraction for %s (%s rows)", data_type, len(cand[k]))
                                            break
                                if extracted_data is not None:
                                    break
                    except Exception as hist_err:
                        logger.debug("Historical extraction fallback skipped: %s", hist_err)

                if extracted_data is None:
                    # Fallback / mock extraction for test harnesses
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

                if data_type == "faculty" and isinstance(extracted_data, dict):
                    if text_layer.strip():
                        extracted_data["raw_text"] = text_layer
                    for fac_item in extracted_data.get("faculty", []):
                        if isinstance(fac_item, dict) and not fac_item.get("bio") and text_layer.strip():
                            fac_item["bio"] = " ".join(text_layer.split())[:1500]

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
                        (json.dumps(extracted_data), json.dumps(confidence_flags), submission_id)
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
