# 🔍 Sprint Review Report

**Date:** 2026-04-18 09:39
**Model:** claude-opus-4-20250514
**Base:** main
**Commits reviewed:** 6
**Files changed:** 28
**Review cost:** $3.9520

---

This confirms the project was deliberately migrated **from PostgreSQL to SQLite** earlier, and the production deployment at dashboards.jeffcoy.net uses SQLite. The overnight agent reversed this decision.

Now I have all the information needed for the comprehensive review.

---

# Sprint Review: Overnight Autonomous Build (2026-04-18)

## Executive Summary

This overnight sprint delivered four features (env consolidation, PostgreSQL migration + sample data, session timeout/security headers, audit logging, and rate limiting) but introduced **several critical breaking bugs** that will prevent the application from functioning. The most severe: (1) the database provider was changed from SQLite back to PostgreSQL without a running PostgreSQL instance, breaking the deployed app; (2) the CSRF middleware blocks ALL API mutations because no client code sends CSRF tokens; and (3) the auth config hardcodes every user as ADMIN. These must all be fixed before merge.

## Scorecard

| Category | Score | Summary |
|----------|-------|---------|
| **Security** | 4/10 | Good intentions (CSP, HSTS, CSRF, session timeout) but flawed execution — CSRF breaks app, all users are ADMIN, CSP too permissive |
| **Architecture & Patterns** | 6/10 | Follows existing patterns well, clean separation of audit/rate-limit libs, but in-memory rate limiter won't work at scale |
| **Error Handling** | 7/10 | Consistent try/catch, audit failures are non-blocking, JSON.parse without safety net in one spot |
| **TypeScript & Code Quality** | 7/10 | Good enum usage in audit.ts, typed helpers, one `any` type in audit query builder |
| **Testing & Reliability** | 3/10 | No tests added for any new feature, CSRF not tested against frontend, DB provider change not tested |
| **UX & Accessibility** | 5/10 | Audit UI is functional but missing accessibility (no aria-labels on pagination, filter dropdowns limited to current page data) |
| **Performance** | 6/10 | Batch inserts in seed script, paginated audit queries, but double `getCurrentUser()` calls per rate-limited request |

## Critical Issues

```
ISSUE: Database provider reverted to PostgreSQL — breaks existing deployment
SEVERITY: critical
FILE: prisma/schema.prisma
LINES: 6
DESCRIPTION: The provider was changed from "sqlite" to "postgresql", but the production 
deployment at dashboards.jeffcoy.net and local dev both use SQLite (file:./dev.db). This 
was deliberately decided in docs/L0_DECISION_LOG.md. The .env files were also changed to 
a PostgreSQL connection string. The app will crash on startup because no PostgreSQL server 
exists. Additionally, the new sample data models use @db.VarChar, @db.Decimal, @db.Date — 
all PostgreSQL-specific annotations that fail on SQLite.
FIX: Revert provider to "sqlite" and remove all @db.* annotations from the new sample 
data models. Use plain String, Float, DateTime types instead. Or, if PostgreSQL migration 
is intentional, document the infrastructure requirement and update deployment scripts.
SECTION: 🏗️ Foundation & Infrastructure
```

```
ISSUE: CSRF middleware blocks ALL API mutations — no client code sends tokens
SEVERITY: critical
FILE: middleware.ts
LINES: 42-55
DESCRIPTION: The middleware requires x-csrf-token or x-nextauth-csrf-token headers on all 
POST/PUT/PATCH/DELETE requests to /api/*. However, NO client-side fetch call anywhere in 
the codebase sends these headers. Every API mutation (create dashboard, save version, chat, 
share, glossary CRUD) will return 403 "CSRF token missing". The authorized callback's dev 
mode bypass only controls authentication, not the CSRF check — they run sequentially.
FIX: Either (a) remove the CSRF enforcement until a proper CSRF token mechanism is 
implemented (generate token server-side, embed in pages, send with requests), or 
(b) implement NextAuth's built-in CSRF protection by reading the csrf token from the 
NextAuth cookie and sending it. The current implementation is security theater that breaks 
the app.
SECTION: 🔐 Auth & Security
```

```
ISSUE: All authenticated users get ADMIN role
SEVERITY: critical
FILE: src/lib/auth/config.ts
LINES: 36-38
DESCRIPTION: In the JWT callback, token.role is hardcoded to 'ADMIN' and token.department 
to 'Engineering' for ALL users who sign in (the `if (user)` block runs on initial sign-in 
for every user). When Google OAuth is added, every @uszoom.com user will be an admin with 
full access to audit logs, glossary editing, and all protected routes.
FIX: Look up the user's actual role from the database. The User model already has a `role` 
field. The callback should query the DB: 
`const dbUser = await prisma.user.findUnique({where: {id: user.id}});
token.role = dbUser?.role || 'VIEWER';`
SECTION: 🔐 Auth & Security
```

```
ISSUE: Audit log API has unprotected JSON.parse
SEVERITY: critical
FILE: src/app/api/admin/audit/route.ts
LINES: 55
DESCRIPTION: `JSON.parse(log.metadata)` is called without try-catch. If any audit log 
entry has malformed metadata in the database (truncated write, encoding issue), the entire 
API endpoint crashes with a 500 error, making the audit log inaccessible.
FIX: Wrap in try-catch:
`metadata: (() => { try { return log.metadata ? JSON.parse(log.metadata) : null; } 
catch { return { _parseError: true, raw: log.metadata }; } })()`
SECTION: ⚙️ Admin Panel
```

## Warnings

```
ISSUE: In-memory rate limiter doesn't persist across serverless instances
SEVERITY: warning
FILE: src/lib/rate-limiter.ts
LINES: 10
DESCRIPTION: The rate limit store is a plain Map() in process memory. In serverless 
deployments (Vercel, AWS Lambda), each request may hit a different instance with its own 
empty Map. Rate limiting will be ineffective. Even on EC2 with a single process, the Map 
is lost on restart.
FIX: Acceptable for now as a best-effort limiter on the EC2 deployment (single process). 
Add a comment documenting the limitation. For production, consider Redis-backed rate 
limiting.
SECTION: 🔐 Auth & Security
```

```
ISSUE: getCurrentUser() called twice per rate-limited request
SEVERITY: warning
FILE: src/lib/rate-limiter.ts
LINES: 159, 210
DESCRIPTION: The withRateLimit wrapper calls getCurrentUser() in the rate limit check, 
then the handler callback also calls getCurrentUser(). Each call invokes getServerSession() 
which requires JWT verification. This doubles the auth overhead on every request.
FIX: Pass the user from the rate limiter into the handler, or cache the session per 
request. Alternatively, restructure so the handler receives the already-resolved user.
SECTION: 🔐 Auth & Security
```

```
ISSUE: CSP allows 'unsafe-eval' and 'unsafe-inline' for scripts
SEVERITY: warning
FILE: middleware.ts
LINES: 26
DESCRIPTION: 'unsafe-eval' and 'unsafe-inline' in script-src largely negate CSP 
protection against XSS. While Next.js dev server needs unsafe-eval, production should use 
nonce-based CSP.
FIX: Use Next.js nonce-based CSP (next.config.ts headers) or at minimum only enable 
unsafe-eval when NODE_ENV=development.
SECTION: 🔐 Auth & Security
```

```
ISSUE: Missing database index on AuditLog.createdAt
SEVERITY: warning
FILE: prisma/schema.prisma
LINES: 160-163
DESCRIPTION: The audit log API supports date range queries (startDate/endDate filters), 
but there's no index on createdAt. As the table grows, date range scans will become 
progressively slower.
FIX: Add `@@index([createdAt])` to the AuditLog model.
SECTION: 🏗️ Foundation & Infrastructure
```

```
ISSUE: Audit filter dropdowns only show values from current page
SEVERITY: warning
FILE: src/app/admin/audit/audit-client.tsx
LINES: 130-132
DESCRIPTION: `uniqueActions`, `uniqueResourceTypes`, and `uniqueUsers` are derived from 
the current page's logs only. If you're on page 5, the dropdowns won't include actions 
that only appear on page 1. The filters become less useful as data grows.
FIX: Fetch distinct action/resourceType/user values from a separate API endpoint, or 
hardcode the known enum values from AuditAction.
SECTION: ⚙️ Admin Panel
```

```
ISSUE: Seed script revenue events can occur after customer cancellation
SEVERITY: warning
FILE: prisma/seed.ts
LINES: 380-434
DESCRIPTION: Expansion/contraction events use `randomDate(customer.signupDate, 
customer.cancelledDate || new Date())` but don't verify the event makes sense 
chronologically. A cancelled customer could get an "expansion" event on the same day 
they cancelled.
FIX: Add a check that changeDate is before cancelledDate (if exists), and skip 
expansion/contraction events for cancelled customers.
SECTION: 🏗️ Foundation & Infrastructure
```

```
ISSUE: Rate limiter accesses private property via bracket notation
SEVERITY: warning
FILE: src/lib/rate-limiter.ts
LINES: 178
DESCRIPTION: `rateLimiter['maxRequests']` uses bracket notation to bypass TypeScript 
private access. This is fragile and will break if the property is renamed.
FIX: Add a public getter: `get limit(): number { return this.maxRequests; }`
SECTION: 🔐 Auth & Security
```

## Nice-to-Haves

- Add `aria-label="Previous page"` / `aria-label="Next page"` to pagination buttons in `audit-client.tsx`
- Add `aria-live="polite"` to the loading spinner container
- The `uniqueUsers` dedup logic at line 130 uses spread+Set on objects, which won't actually deduplicate (objects aren't compared by value) — should use a Map keyed by user ID
- The seed script's ticket generation loop (while loop with random skips) makes the actual count non-deterministic; consider a for-loop approach
- Consider adding `ON DELETE SET NULL` to AuditLog's userId FK so audit records survive user deletion
- The `getCurrentUserSync()` function in session.ts is unused dead code — remove it
- The `.agent-handoff.md` file should probably be in `.gitignore` rather than committed

## Highlights

- **Audit logging architecture is well-designed**: Clean enum-based action types, typed helper functions per resource type, non-blocking error handling so audit failures never crash business logic. This is a solid foundation.
- **Rate limiter sliding window algorithm is correct**: The implementation properly tracks per-user per-endpoint windows, cleans up stale entries, and returns standard `Retry-After` / `X-RateLimit-*` headers.
- **Consistent async migration**: All API routes were correctly updated from `getCurrentUser()` (sync) to `await getCurrentUser()` (async) without missing any call sites. The backwards-compatible sync fallback was preserved.
- **Batch insert strategy in seed script**: Using 1000-2000 record batches with progress logging shows awareness of database performance constraints.
- **Security headers are comprehensive**: X-Frame-Options DENY, HSTS with preload, X-Content-Type-Options, Referrer-Policy — the right headers are all present.

## Merge Recommendation

**❌ DO NOT MERGE** — Three critical issues prevent the app from functioning:

1. **SQLite→PostgreSQL revert breaks the deployed app and local dev** (no PostgreSQL available)
2. **CSRF enforcement blocks all API mutations** (no client sends tokens)
3. **All users hardcoded as ADMIN** (privilege escalation when real auth ships)

**Recommended path forward:**
1. Revert `prisma/schema.prisma` provider back to `sqlite` and strip `@db.*` annotations from new models
2. Remove or disable the CSRF block in middleware.ts (lines 42-55) until proper token flow is implemented
3. Add a TODO comment on the hardcoded ADMIN role with a note to query the DB when Google OAuth is wired up
4. Add try-catch around `JSON.parse(log.metadata)` in the audit API
5. Add `@@index([createdAt])` to AuditLog
6. After these fixes, the branch is safe to merge

---

## Files Reviewed

```
.agent-handoff.md                                  |   60 +
 docs/asana-daily-summary.md                        |  237 +-
 docs/asana-project-state.json                      | 4730 ++++++++++++++++++++
 docs/asana-task-gids.json                          |   59 +-
 docs/task-triage-cache.json                        |  293 ++
 logs/overnight-20260418.log                        |   54 +
 logs/overnight-build.log                           |   66 +
 middleware.ts                                      |   87 +
 prisma/schema.prisma                               |   95 +-
 prisma/seed.ts                                     |  397 +-
 src/app/admin/audit/audit-client.tsx               |  422 ++
 src/app/admin/audit/page.tsx                       |   19 +
 src/app/api/admin/audit/route.ts                   |   72 +
 src/app/api/auth/[...nextauth]/route.ts            |    6 +
 src/app/api/chat/route.ts                          |  123 +-
 src/app/api/dashboards/[id]/duplicate/route.ts     |  116 +-
 .../dashboards/[id]/revert/[versionId]/route.ts    |  114 +-
 src/app/api/dashboards/[id]/route.ts               |  243 +-
 src/app/api/dashboards/[id]/share/route.ts         |  161 +-
 src/app/api/dashboards/[id]/versions/route.ts      |  169 +-
 src/app/api/dashboards/route.ts                    |  187 +-
 src/app/api/glossary/[id]/route.ts                 |   45 +-
 src/app/api/glossary/route.ts                      |   15 +-
 src/lib/audit.ts                                   |  201 +
 src/lib/auth/config.ts                             |   23 +
 src/lib/auth/session.ts                            |   53 +-
 src/lib/env.ts                                     |    6 +
 src/lib/rate-limiter.ts                            |  249 ++
 28 files changed, 7774 insertions(+), 528 deletions(-)
```

## Commits Reviewed

```
9434961 feat: implement API rate limiting with sliding window algorithm
a8c45ba feat: implement comprehensive audit logging for GDPR/SOC2 compliance
a86f323 feat: implement session timeout and security headers
014b89a feat: migrate to PostgreSQL and add comprehensive sample data seeding
ea580bb feat: consolidate environment variables and add Google OAuth + Snowflake stubs
a5d5ac1 chore: pre-overnight-builder snapshot
```
