# 🔍 Sprint Review Report

**Date:** 2026-04-20 08:49
**Model:** claude-opus-4-20250514
**Base:** main
**Commits reviewed:** 2
**Files changed:** 12
**Review cost:** $1.1518

---

I now have all the information needed for a thorough review. Here's my report:

---

# Sprint Review: Overnight Security Hardening

## Executive Summary

This sprint delivers solid security improvements from the red team report — splitting the health endpoint (HIGH-03), adding auth to unauthenticated endpoints (CRIT-03), and hard-failing on dev mode in production (CRIT-01). The changes are directionally correct and address real vulnerabilities. However, the auth hardening is **incomplete** (glossary list endpoint missed), and the new admin health endpoint introduces a PrismaClient-per-request anti-pattern that diverges from the established singleton. No tests were added for any of the new code.

## Scorecard

| Category | Score | Summary |
|----------|-------|---------|
| Security | 7/10 | Good additions, but incomplete — glossary list endpoint still unauthenticated |
| Architecture & Patterns | 6/10 | Health split is clean; PrismaClient usage violates singleton pattern |
| Error Handling | 7/10 | Thorough catch blocks, but dead-code null checks are misleading |
| TypeScript & Code Quality | 7/10 | Clean, readable; minor type cast fragility |
| Testing | 2/10 | Zero tests for any new or modified code |
| UX & Accessibility | 8/10 | N/A for backend changes; error messages are clear |
| Performance | 5/10 | New PrismaClient per health check request is wasteful |

## Critical Issues

ISSUE: Glossary list endpoint still has no authentication
SEVERITY: critical
FILE: src/app/api/glossary/route.ts
LINES: 33-64
DESCRIPTION: The GET /api/glossary list endpoint has no auth check, while the sibling GET /api/glossary/[id] endpoint was just hardened with auth. This was the specific finding in CRIT-03 ("add auth checks to unauthenticated API endpoints"). An attacker can enumerate the entire glossary (including DB terms by passing ?source=db or ?ids=...) without authentication. The Asana task for CRIT-03 remains open with 0/23 subtasks complete, so this is an acknowledged gap — but since the [id] route was hardened in this same commit, the list route should have been too for consistency.
FIX: Add the same getCurrentUser() check at the top of the GET handler in route.ts, returning 401 if unauthenticated. Mirror the pattern used in the [id] route.
SECTION: Auth & Security

ISSUE: Admin health endpoint creates new PrismaClient per request
SEVERITY: critical
FILE: src/app/api/admin/health/route.ts
LINES: 28-31
DESCRIPTION: Every request to /api/admin/health creates a brand-new PrismaClient instance via dynamic import, runs a query, and disconnects. The codebase has an established singleton at @/lib/db/prisma that stores the client on globalThis. While $disconnect() prevents connection leaks, repeated connect/disconnect cycles are expensive and under concurrent admin requests could exhaust SQLite's file locks or connection limits. The public /api/health endpoint has the same issue (pre-existing), but new code should not copy this anti-pattern.
FIX: Import the singleton: `import prisma from '@/lib/db/prisma'` and use `await prisma.$queryRaw\`SELECT 1\`` directly. Wrap the query in try/catch to detect disconnection. For latency measurement, time the query against the singleton — this actually gives a more realistic latency figure since it's the connection the app actually uses.
SECTION: Foundation & Infrastructure

## Warnings

ISSUE: Dead-code null check after getCurrentUser() in all hardened routes
SEVERITY: warning
FILE: src/app/api/widgets/fork/route.ts
LINES: 14-17
DESCRIPTION: getCurrentUser() (session.ts:31) throws Error('Unauthorized: No valid session found') when there is no session — it never returns null. The pattern `const user = await getCurrentUser(); if (!user) { return 401; }` has a dead `if` branch. The actual 401 handling happens in the catch block via error.message.includes('Unauthorized'). This same dead pattern appears in voice/transcribe/route.ts (line 16-18), widgets/publish/route.ts (line 23-25), widgets/fork/route.ts (line 15-17), and glossary/[id]/route.ts (line 14-16). The code is harmless but misleading — future developers may mistakenly think getCurrentUser() can return null.
FIX: Either (a) remove the null checks and rely solely on the catch block, or (b) refactor getCurrentUser() to return null instead of throwing, then remove the catch-block string matching. Option (b) is the cleaner pattern long-term since string matching on error messages is fragile.
SECTION: Auth & Security

ISSUE: Auth error detection relies on fragile string matching
SEVERITY: warning
FILE: src/app/api/widgets/fork/route.ts
LINES: 48-50
DESCRIPTION: All new routes catch auth errors with `error.message.includes('Unauthorized')`. If the error message in getCurrentUser() is ever changed (e.g., from 'Unauthorized:...' to 'Authentication required:...'), these catches silently break and start returning 500 instead of 401. This pattern is repeated in 5 files in this diff.
FIX: Create a custom error class (e.g., `class AuthenticationError extends Error`) in session.ts, throw that instead, and catch with `instanceof AuthenticationError`. This is the established pattern in well-typed Node.js codebases.
SECTION: Auth & Security

ISSUE: Publish widget route accepts publisherId from request body while authenticated
SEVERITY: warning
FILE: src/app/api/widgets/publish/route.ts
LINES: 28-29
DESCRIPTION: The route now correctly requires authentication via getCurrentUser(), but still accepts publisherId from the client-supplied request body (line 28). Since this route is a stub that doesn't persist data, this is not an active vulnerability. However, when Phase 2 lands and the commented-out DB write on line 43 gets enabled, the publisherId from the body would be trusted over the authenticated user — allowing a user to impersonate another publisher.
FIX: Replace `publisherId` from the request body with `user.id` from the authenticated session. The `user` variable is already available from the auth check on line 22 but is currently unused.
SECTION: Auth & Security

ISSUE: Public health endpoint also uses PrismaClient-per-request (pre-existing)
SEVERITY: warning
FILE: src/app/api/health/route.ts
LINES: 7-10
DESCRIPTION: Same anti-pattern as the admin endpoint — creates new PrismaClient on every health check poll. If an uptime monitor hits this every 30 seconds, that is 2,880 connect/disconnect cycles per day. While this was pre-existing code, the refactoring in this sprint was an opportunity to fix it.
FIX: Import the singleton from @/lib/db/prisma. The health check's purpose is to verify the app's DB connection works — testing the singleton is more meaningful than testing whether a fresh connection can be established.
SECTION: Foundation & Infrastructure

## Nice-to-Haves

- **No newline at EOF** in `src/app/api/admin/health/route.ts` (line 80) — minor linting issue.
- **Docs/logs shouldn't be in source code**: `docs/asana-daily-summary.md`, `docs/asana-project-state.json`, `docs/task-triage-cache.json`, and `logs/` are build/sync artifacts committed to the repo. Consider adding them to `.gitignore` or moving to a separate tracking mechanism.
- The `validateEnv()` function still generates a warning about dev-mode-in-production (line 171-172) before `assertEnv()` throws for the same condition (line 194-203). The warning is now redundant since the throw happens immediately after — a user will never see the warning without the crash.
- The admin health endpoint exposes `devMode: true/false` (line 62) — while admin-gated, consider whether this metadata is useful or just increases attack surface if an admin session is compromised.

## Highlights

- **Health endpoint split (HIGH-03)** is well-executed. The public endpoint is minimal (status + timestamp only), and the admin endpoint behind `isAdmin()` is the right place for diagnostics. This directly addresses the red team finding.
- **Dev mode hard-fail (CRIT-01)** in `env.ts:194-203` is a strong safeguard. Changing from `console.warn` to `throw` is exactly the right severity for a production auth bypass. The error message is clear and actionable.
- **Auth additions to voice/transcribe, widgets/fork, widgets/publish, glossary/[id]** directly address CRIT-03. The agent correctly identified the unauthenticated endpoints from the red team report and added defense-in-depth checks.
- **Consistent error messaging** — all new auth errors return `{ error: 'Unauthorized' }` with status 401, maintaining a uniform API contract.
- **No scope creep** — the changes stay focused on security hardening without refactoring surrounding code or adding unrelated features.

## Merge Recommendation

**⚠️ MERGE WITH FIXES** — Address these before merging:

1. **Add auth to `GET /api/glossary`** — it's the most-trafficked unauthenticated data endpoint and was clearly in-scope for CRIT-03
2. **Fix PrismaClient-per-request in the new admin health endpoint** — use the existing singleton from `@/lib/db/prisma`

The remaining warnings (dead null checks, string-matching for errors, publisherId trust) are non-blocking but should be tracked for a follow-up cleanup.

---

## Files Reviewed

```
docs/asana-daily-summary.md           | 1038 +++++++++------------------------
 docs/asana-project-state.json         |  564 +++++++++++++++---
 docs/task-triage-cache.json           |  352 +++--------
 logs/overnight-20260420-0045.log      |   57 ++
 logs/overnight-build.log              |   19 +
 src/app/api/admin/health/route.ts     |   80 +++
 src/app/api/glossary/[id]/route.ts    |   12 +
 src/app/api/health/route.ts           |   59 +-
 src/app/api/voice/transcribe/route.ts |   16 +
 src/app/api/widgets/fork/route.ts     |   13 +
 src/app/api/widgets/publish/route.ts  |   13 +
 src/lib/env.ts                        |   11 +-
 12 files changed, 1080 insertions(+), 1154 deletions(-)
```

## Commits Reviewed

```
4868b8a fix: red team security hardening — critical auth and endpoint fixes
648de5f chore: pre-overnight-builder snapshot
```
