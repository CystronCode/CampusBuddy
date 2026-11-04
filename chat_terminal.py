import os
import sys
import time
import httpx
from pathlib import Path

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Ensure UTF-8 output on Windows PowerShell
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

system_message = {
    "role": "system",
    "content": (
        "You are CampusBuddy, a knowledgeable, friendly, and precise AI assistant "
        "for engineering college students and administrators. Keep answers clear, "
        "accurate, and easy to read."
    )
}

history = [system_message]

print("=" * 60)
print(f"🎓 CampusBuddy Terminal Chat (Groq + {MODEL})")
print("Type your question below. Type 'exit' or 'quit' to stop.")
print("=" * 60)

while True:
    try:
        user_input = input("\nYou: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nGoodbye!")
        break

    if not user_input:
        continue

    if user_input.lower() in ("exit", "quit", "q"):
        print("Goodbye!")
        break

    history.append({"role": "user", "content": user_input})

    print("🤖 CampusBuddy is thinking...", end="\r", flush=True)
    t0 = time.time()

    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json={
                "model": MODEL,
                "messages": history,
                "temperature": 0.3,
                "max_tokens": 1024
            },
            timeout=30.0
        )
        latency = round(time.time() - t0, 2)

        if response.status_code == 200:
            data = response.json()
            assistant_reply = data["choices"][0]["message"]["content"]
            history.append({"role": "assistant", "content": assistant_reply})
            print(f"🤖 CampusBuddy ({latency}s):\n")
            print(assistant_reply)
        else:
            print(f"\n❌ Error {response.status_code}: {response.text}")

    except Exception as e:
        print(f"\n❌ Connection error: {e}")
