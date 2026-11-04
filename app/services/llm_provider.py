import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger("campus.llm")

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

async def call_groq(
    messages: List[Dict[str, str]],
    model: str = settings.GROQ_MODEL,
    temperature: float = 0.2,
    response_format_json: bool = False,
    max_tokens: int = 400,
    timeout_sec: float = 8.0
) -> Optional[str]:
    """Execute low-latency LPU inference via Groq Cloud API with rate-limit protection."""
    if not settings.GROQ_API_KEY:
        return None

    # Cap at 950 tokens to stay under Groq's 1000 OTPM on-demand free tier limit while allowing full JSON
    safe_max_tokens = min(max_tokens, 950)

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": safe_max_tokens
    }
    if response_format_json:
        payload["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=timeout_sec)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.warning("Groq API returned %s: %s", res.status_code, res.text)
                return None
    except Exception as e:
        logger.warning("Groq inference error: %s", e)
        return None

async def call_gemini(
    messages: List[Dict[str, str]],
    model_name: str = settings.GEMINI_MODEL_SYNTH,
    temperature: float = 0.2,
    response_format_json: bool = False,
    timeout_sec: float = 8.0
) -> Optional[str]:
    """Execute Gemini API generation using rotated keys."""
    keys = [k for k in settings.GEMINI_API_KEYS if k and not k.startswith("mock")]
    if not keys:
        return None

    # Combine messages into system instruction + user/assistant turns
    sys_inst = ""
    turns = []
    for m in messages:
        if m["role"] == "system":
            sys_inst += m["content"] + "\n"
        else:
            turns.append(f"{m['role'].capitalize()}: {m['content']}")
    prompt_text = "\n".join(turns)

    for key in keys:
        try:
            client = genai.Client(api_key=key)
            config_kwargs: Dict[str, Any] = {"temperature": temperature}
            if sys_inst.strip():
                config_kwargs["system_instruction"] = sys_inst.strip()
            if response_format_json:
                config_kwargs["response_mime_type"] = "application/json"

            config = types.GenerateContentConfig(**config_kwargs)
            res = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=model_name,
                    contents=[types.Part.from_text(text=prompt_text)],
                    config=config
                ),
                timeout=timeout_sec
            )
            return res.text
        except Exception as e:
            logger.warning("Gemini key error (%s): %s", model_name, e)
            continue

    return None

async def generate_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    response_format_json: bool = False,
    max_tokens: int = 400
) -> str:
    """
    Unified LLM entry point.
    Routes to Groq (Qwen 27B / Llama 3) or Gemini based on LLM_PROVIDER with automatic dual fallback.
    """
    prefer_groq = settings.LLM_PROVIDER.lower() == "groq"

    if prefer_groq:
        result = await call_groq(
            messages=messages,
            temperature=temperature,
            response_format_json=response_format_json,
            max_tokens=max_tokens
        )
        if result:
            return result
        # Fallback to Gemini
        gemini_res = await call_gemini(
            messages=messages,
            temperature=temperature,
            response_format_json=response_format_json
        )
        if gemini_res:
            return gemini_res
    else:
        # Prefer Gemini first
        gemini_res = await call_gemini(
            messages=messages,
            temperature=temperature,
            response_format_json=response_format_json
        )
        if gemini_res:
            return gemini_res
        # Fallback to Groq
        result = await call_groq(
            messages=messages,
            temperature=temperature,
            response_format_json=response_format_json,
            max_tokens=max_tokens
        )
        if result:
            return result

    # Offline emergency fallback if both clouds are unavailable
    return "I am currently running in offline recovery mode. Please check local database records."
