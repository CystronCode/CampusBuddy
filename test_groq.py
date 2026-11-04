import os
import sys
import httpx
import time
from pathlib import Path

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Ensure UTF-8 output in Windows PowerShell so emojis print smoothly
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")

if not GROQ_API_KEY:
    print("[ERROR] GROQ_API_KEY is not set in environment or .env file.")
    sys.exit(1)

headers = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": "You are CampusBuddy, an AI campus assistant for engineering college students."},
        {"role": "user", "content": "What is my next class and what should I do if I am running 5 minutes late?"}
    ],
    "temperature": 0.3
}

print(f"Connecting to Groq LPU Cloud using model: {MODEL}...")
t0 = time.time()

response = httpx.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers=headers,
    json=payload,
    timeout=15.0
)

latency = round(time.time() - t0, 2)

if response.status_code == 200:
    data = response.json()
    reply = data["choices"][0]["message"]["content"]
    print(f"\n[SUCCESS] Response received in {latency}s!")
    print("-" * 50)
    print(reply)
    print("-" * 50)
else:
    print(f"[ERROR] {response.status_code}: {response.text}")
