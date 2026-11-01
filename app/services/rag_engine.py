import os
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.database import get_read_db
from app.services.embedding_service import generate_l2_normalized_embeddings

logger = logging.getLogger("campus.rag")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", settings.GEMINI_API_KEY)
GEMINI_MODEL_SYNTH = settings.GEMINI_MODEL_SYNTH
RAG_MIN_SIMILARITY = settings.RAG_MIN_SIMILARITY

_genai_clients: List[genai.Client] = []
CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
]

def get_genai_clients() -> List[genai.Client]:
    global _genai_clients
    if not _genai_clients:
        for k in settings.GEMINI_API_KEYS:
            if k and not k.startswith("mock"):
                try:
                    _genai_clients.append(genai.Client(api_key=k))
                except Exception as e:
                    logger.warning("Could not initialize genai.Client in RAG: %s", e)
    return _genai_clients

def get_genai_client() -> Optional[genai.Client]:
    clients = get_genai_clients()
    return clients[0] if clients else None

# In-memory mock chunks store for offline testing
_mock_chunks: List[Dict[str, Any]] = []

def set_mock_chunks(chunks: List[Dict[str, Any]]):
    global _mock_chunks
    _mock_chunks = chunks

async def search_docs_hybrid(
    query_text: str, 
    user_branch: Optional[str],
    doc_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Hybrid retrieval merging pgvector cosine distance (>= 0.45 floor) 
    with Full-Text Search via Reciprocal Rank Fusion (k=60).
    Enforces branch isolation and valid_until freshness.
    """
    # 1. Generate 768-dim query embedding
    query_vectors = await generate_l2_normalized_embeddings([query_text])
    query_vector = query_vectors[0]

    sql = """
    WITH vector_matches AS (
      SELECT 
        c.id, c.title, c.section, c.page, c.content, c.doc_key, c.doc_type,
        1 - (c.embedding <=> %s::vector) AS cosine_sim,
        ROW_NUMBER() OVER (ORDER BY c.embedding <=> %s::vector) AS rank_vec
      FROM doc_chunks c
      JOIN data_versions dv ON dv.scope = c.scope AND dv.active_version = c.version
      WHERE (c.branch IS NULL OR c.branch = %s)
        AND (c.valid_until IS NULL OR c.valid_until >= current_date)
        AND (1 - (c.embedding <=> %s::vector)) >= %s
        AND (%s::text IS NULL OR c.doc_type = %s)
      LIMIT 20
    ),
    fts_matches AS (
      SELECT 
        c.id, c.title, c.section, c.page, c.content, c.doc_key, c.doc_type,
        ts_rank_cd(c.tsv, websearch_to_tsquery('english', %s)) AS fts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('english', %s)) DESC) AS rank_fts
      FROM doc_chunks c
      JOIN data_versions dv ON dv.scope = c.scope AND dv.active_version = c.version
      WHERE (c.branch IS NULL OR c.branch = %s)
        AND (c.valid_until IS NULL OR c.valid_until >= current_date)
        AND c.tsv @@ websearch_to_tsquery('english', %s)
        AND (%s::text IS NULL OR c.doc_type = %s)
      LIMIT 20
    )
    SELECT 
      coalesce(v.id, f.id) AS id,
      coalesce(v.title, f.title) AS title,
      coalesce(v.section, f.section) AS section,
      coalesce(v.page, f.page) AS page,
      coalesce(v.content, f.content) AS content,
      coalesce(v.doc_key, f.doc_key) AS doc_key,
      coalesce(v.cosine_sim, 0.0) AS similarity,
      (coalesce(1.0 / (60 + v.rank_vec), 0.0) + coalesce(1.0 / (60 + f.rank_fts), 0.0)) AS rrf_score
    FROM vector_matches v
    FULL OUTER JOIN fts_matches f ON v.id = f.id
    ORDER BY rrf_score DESC
    LIMIT 3;
    """

    try:
        async with get_read_db() as conn:
            cursor = await conn.execute(
                sql,
                (query_vector, query_vector, user_branch, query_vector, RAG_MIN_SIMILARITY, doc_type, doc_type,
                 query_text, query_text, user_branch, query_text, doc_type, doc_type)
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]
    except Exception as exc:
        logger.warning("Database hybrid search query failed, checking mock chunks: %s", exc)
        # Mock retrieval matching branch isolation and floor
        matched = []
        for c in _mock_chunks:
            if c.get("branch") and c.get("branch") != user_branch:
                continue
            sim = float(c.get("similarity", 0.0))
            if sim >= RAG_MIN_SIMILARITY:
                matched.append(c)
        return matched[:3]

async def synthesize_rag_response(query_text: str, chunks: List[Dict[str, Any]]) -> str:
    """
    Synthesize final response with Gemini Flash using strict markdown citations.
    Invariant: If 0 chunks match, synthesis LLM call is SKIPPED.
    """
    if not chunks:
        return "I could not find any matching notices or syllabus sections for your query."

    context_blocks = []
    for c in chunks:
        citation = f"[{c.get('title', 'Document')} | Section: {c.get('section', 'General')} | Page {c.get('page') or 1}]"
        context_blocks.append(f"{citation}\n{c.get('content', '')}")

    context_str = "\n\n---\n\n".join(context_blocks)
    
    prompt = f"""You are Campus Intelligence. Answer the student's question strictly using the verified campus excerpts below.
Context:
{context_str}

Student Question: {query_text}

Guidelines:
1. Rely ONLY on clear facts directly mentioned in the context. Never fabricate policies or dates.
2. Cite the source document and section inline e.g. [OS Syllabus > Unit 2].
3. If the context does not contain the complete answer, clearly state what information is missing.
"""

    clients = get_genai_clients()
    if clients:
        for client in clients:
            for model_name in CANDIDATE_MODELS:
                try:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            client.models.generate_content,
                            model=model_name,
                            contents=[types.Part.from_text(text=prompt)],
                            config=types.GenerateContentConfig(temperature=0.2)
                        ),
                        timeout=8.0,
                    )
                    return response.text
                except Exception as e:
                    logger.warning("RAG synthesis model %s failed/timed out: %s", model_name, e)

    # Deterministic fallback response for testing/offline environments
    c0 = chunks[0]
    return f"According to [{c0.get('title', 'Doc')} > {c0.get('section', 'Section')}]: {c0.get('content', '')[:120]}..."
