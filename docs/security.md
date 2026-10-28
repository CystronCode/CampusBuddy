# Threat model and deployment checklist

## Assets and trust boundaries

Protected assets include private email/calendar content, conversations, institutional sources, OAuth credentials and database/storage credentials. The browser, uploaded files, source passages, Google content and user-entered questions are untrusted. Supabase Auth signs identity; database memberships grant institution access. A compromised API/worker host or database owner is outside the protection provided by application RLS and must be addressed operationally.

| Threat | Implemented control | Remaining work/operational control |
|---|---|---|
| Forged/expired token | JWKS signature, fixed issuer/audience, expiry and subject validation; no unsigned/HS fallback | Enforce account revocation/session policies; short-lived JWTs can remain valid until expiry |
| Cross-institution request | Verified membership + tenant predicates + PostgreSQL RLS | Exercise RLS against production grants; restrict DB credentials |
| Cross-owner private records | Owner predicates, private sources and conversation checks | Protect disk/backups; implement institution-approved retention policy |
| Privilege escalation | Roles stored in memberships; no client role metadata; admin API and restricted DB grants | Admin invitation/revocation lifecycle and operator review |
| Malicious SQL/code request | Fixed tools and parameterized SQLAlchemy; no generated execution | Review future tools under the same boundary |
| Source prompt injection | Sources treated as data, instruction-like excerpts withheld, LLM has no execution tools | Heuristic detection is incomplete; generated summaries still require source review |
| Malicious upload | Size/type bounds, XLSX expansion bound, no macros, safe text parsing, atomic worker transaction | Isolate parser worker, set CPU/memory limits, patch parsers; no malware scanner or OCR |
| OAuth interception/replay | PKCE, encrypted single-use state, 10-minute state TTL, read-only scopes | HTTPS, exact redirects, provider consent configuration and live verification |
| Token theft | Fernet encryption at rest for Google tokens, server-only secrets | Key management/rotation; XSS prevention and endpoint/device security |
| XSS through sources | React text rendering; original files forced to attachment; no HTML execution | Configure CSP for actual auth/API origins and test it with deployment |
| Abuse/resource exhaustion | Shared DB rate buckets, bounded tools, bounded retrieval and network timeouts | Reverse-proxy IP throttling, body limits, parser isolation and load tests |
| Sensitive logs | No query strings, question bodies or source text in application logs | Disable proxy/Uvicorn access logs on OAuth paths; configure monitoring redaction |
| Stale conversation scope | Invalidate context/history on department/section/role change; recheck source access | More granular permission-change invalidation if per-document ACLs are added |

## Before a real-institution pilot

- [ ] Use HTTPS and a restricted non-owner, non-BYPASSRLS API database login.
- [ ] Apply migrations with a trusted owner and inspect all table/function grants.
- [ ] Verify RLS under the **actual API login**, including tenant, department and private-owner denial.
- [ ] Confirm the Supabase bucket is private and direct client downloads are denied.
- [ ] Keep service, database, Gemini and Google credentials out of frontend bundles and Git.
- [ ] Use real Supabase Auth invitations, strong password policies and MFA where appropriate.
- [ ] Confirm user membership activation, role assignment and removal procedures.
- [ ] Separate trusted migration/worker credentials from API credentials.
- [ ] Approve external processing before enabling Gemini or Google account imports.
- [ ] Test Google refresh/revocation and provider outages with an authorized test account.
- [ ] Apply request-size limits and resource limits; isolate PDF/XLSX parsing.
- [ ] Disable sensitive access logs and protect conversation/source backups.
- [ ] Define retention, deletion, incident response and backup-restore procedures.
- [ ] Run dependency/security scanning, load tests and an independent security review.
- [ ] Complete the cloud acceptance checks in `docs/verification.md`.

This repository is a tested vertical slice with security boundaries, not an audited or certified enterprise deployment. Default free tiers do not supply enterprise availability or compliance guarantees.
