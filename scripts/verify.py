"""Execute core checks and summarize real JUnit/Playwright artifacts without fabricated scores."""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]


def main():
    npm = "npm.cmd" if os.name == "nt" else "npm"
    checks = []
    commands = [
        ("ruff", [sys.executable, "-m", "ruff", "check", "backend"], ROOT),
        (
            "backend",
            [sys.executable, "-m", "pytest", "--junitxml=artifacts/backend-tests.xml", "--tb=short"],
            ROOT,
        ),
        ("typescript", [npm, "run", "typecheck"], ROOT / "frontend"),
        ("frontend_build", [npm, "run", "build"], ROOT / "frontend"),
    ]
    for name, args, cwd in commands:
        completed = subprocess.run(
            args,
            cwd=cwd,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        print(name + ": " + ("passed" if completed.returncode == 0 else "failed"), flush=True)
        if completed.returncode:
            print(completed.stdout[-6000:], flush=True)
        checks.append({"name": name, "passed": completed.returncode == 0, "exit_code": completed.returncode})
    xml = ROOT / "artifacts/backend-tests.xml"
    backend = {}
    if xml.exists():
        suite = ElementTree.parse(xml).getroot().find("testsuite")
        if suite is not None:
            values = {key: int(suite.get(key, "0")) for key in ["tests", "failures", "errors", "skipped"]}
            backend = {
                **values,
                "passed": values["tests"] - values["failures"] - values["errors"] - values["skipped"],
            }
    browser_file = ROOT / "artifacts/browser-tests.json"
    browser = {}
    if browser_file.exists():
        raw = json.loads(browser_file.read_text(encoding="utf-8"))
        stats = raw.get("stats", {})
        browser = {
            "passed": stats.get("expected", 0),
            "failed": stats.get("unexpected", 0),
            "flaky": stats.get("flaky", 0),
            "skipped": stats.get("skipped", 0),
            "viewports": ["1440x1000", "390x844", "768x1024"],
            "fixture": "Isolated RSA identity issuer; real API/database/worker",
        }
    report = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "backend": backend,
        "browser": browser,
        "not_live_verified": [
            "Supabase cloud Auth/Storage",
            "Google OAuth provider",
            "Gemini provider",
            "Optional semantic model",
            "Hosted deployment",
            "Docker Compose",
        ],
        "notes": [
            "PostgreSQL tests skip without TEST_POSTGRES_URL. See CI for disposable pgvector execution.",
            "No accuracy percentage or coverage percentage is inferred from these pass counts.",
        ],
    }
    (ROOT / "artifacts/verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"backend": backend, "browser": browser}, indent=2))
    return 0 if all(c["passed"] for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
