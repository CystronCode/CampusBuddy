# Verification evidence

The build records executed results in `artifacts/verification.json` and `artifacts/mcp-verification.json`. Re-run the commands in the README after any code or environment change.

## Coverage

- Domain tests: timetable dates/effective ranges, next class, faculty mapping, price/vegetarian filtering, meal arithmetic, calendar overlap and free intervals.
- Ingestion tests: mappings, validation, idempotent uploads, atomic failed jobs, PDF extraction/page citations and permission boundaries.
- Retrieval tests: relevance, missing information, source citations, recorded conflicts, expiry, suspicious source content and tenant filtering.
- API tests: RSA signatures, expiry/issuer/audience rejection, tenant forgery, role/owner checks, conversation ownership/context invalidation, stream events and explicit integration errors.
- MCP: official SDK stdio initialization/discovery, fourteen tools, three real calls and invalid-input rejection.
- AI evaluation: 35 representative routing questions with expected route/result type plus factual/context/multi-source assertions in `backend/tests/test_router_evaluation.py`.
- Browser tests: normal sign-in flow against a test identity issuer, student navigation, source-bearing chat/follow-up, food filters/combinations, administrator upload/worker completion, invalid-file recovery, API error recovery, horizontal layout checks and axe scans at 1440, 768 and 390 pixels.
- PostgreSQL tests: pgvector/FTS retrieval and direct RLS/privilege boundaries under the restricted role, explicitly skipped without a disposable configured service.

The browser identity provider is a test fixture, not a Supabase integration success claim. Application data, API calls, worker processing and JWT signatures in that suite are real. Frontend error recovery deliberately injects a 503 response as a failure test.

## Staging acceptance still required

1. Actual Supabase login/recovery, JWT rotation/expiry and institution provisioning.
2. Supabase restricted-login RLS and storage privacy under deployment credentials.
3. Live Google consent, refresh, sync, revoke and permission failure scenarios.
4. Live Gemini availability, cost/quota limits, source fidelity and fallback.
5. Optional local semantic model retrieval quality on target laptop hardware.
6. Hosted frontend/API/worker networking, proxy body limits, TLS and restart recovery.
7. Backup restore, retention/deletion, load testing and independent security review.

Pass counts describe only executed tests. They are not a production accuracy percentage, coverage percentage or enterprise security assurance.
