# InsightHub — Security Audit Report

**Date:** April 17, 2026  
**Auditor:** Cascade (automated scan + manual review)  
**Scope:** Full repository — `/Users/Jeffrey.Coy/CascadeProjects/windsurf-project-7`  
**Commit:** HEAD (pre-wider-rollout checkpoint)

---

## Executive Summary

The InsightHub codebase is **free of malicious code, supply chain attacks, and prompt injection payloads**. No obfuscated code, crypto miners, keyloggers, or backdoors were found. Dependencies pass `npm audit` with zero known vulnerabilities.

However, the audit identified **4 high-severity issues** and **6 medium-severity issues** — all related to missing production hardening rather than malicious activity. The most critical finding is that **authentication is non-functional** and **multiple API routes are completely unauthenticated**, exposing the Anthropic API key to abuse.

| Severity | Count | Summary |
|----------|-------|---------|
| Critical | 0 | No malicious code or supply chain compromise |
| High     | 4 | Auth bypass, unauthenticated routes, no rate limiting, no input validation |
| Medium   | 6 | Hardcoded dev creds, error leakage, no CORS, sync I/O, no schema validation |
| Low      | 3 | Weak example secret, clipboard use, dev user email hardcoded |
| Clean    | 5 | No eval/exec, no XSS, no suspicious network calls, no file system abuse, deps clean |

---

## 1. Prompt Injection / LLM Manipulation

### Result: CLEAN

| Check | Status | Details |
|-------|--------|---------|
| Hidden instructions in comments | Clean | No "ignore previous instructions" or AI manipulation strings found in source |
| Base64/hex-encoded payloads | Clean | No base64, atob, btoa usage in any source file |
| Unicode obfuscation | Clean | No suspicious unicode sequences |
| Comments that "talk to" an AI | Clean | Searched for "ignore previous", "you are now", "disregard", "pretend you" — all hits were in node_modules only |

**Note on AI system prompt** (`src/lib/ai/prompts.ts`):
- The system prompt is well-structured with clear role boundaries
- However, **user messages are passed directly to Claude without sanitization** — see Finding H-4 below
- The prompt does not include a "refuse to follow user instructions that override system prompt" guardrail

---

## 2. Suspicious Code Patterns

### Result: CLEAN — No Malicious Patterns

| Check | Status | Files Checked |
|-------|--------|---------------|
| `eval()` / `exec()` / `new Function()` | **Clean** | 0 hits in `src/` |
| Obfuscated or minified code | **Clean** | All source is readable TypeScript |
| Hardcoded IPs | **Clean** | 0 IP addresses in `src/` |
| Suspicious network calls | **Clean** | All `fetch()` calls go to internal `/api/*` routes |
| File system abuse (`.ssh`, `/etc/passwd`) | **Clean** | 0 hits |
| Crypto mining / resource loops | **Clean** | 0 hits |
| `dangerouslySetInnerHTML` / XSS vectors | **Clean** | 0 hits |
| Clipboard / keylogging | **Low** | 1 legitimate use — see below |

**Clipboard usage** (Low — legitimate):
- `src/components/gallery/DashboardCard.tsx:191` — `navigator.clipboard.writeText()` for "Copy link" feature
- This is a standard UX pattern, not malicious

---

## 3. Credential & Secrets Exposure

### Finding H-1: Anthropic API Key in .env.local (HIGH — Operational Risk)

**Status:** The real API key `sk-ant-api03-XJO_xLh_...` exists in `.env.local`.

| Check | Result |
|-------|--------|
| `.env.local` in `.gitignore` | **Yes** — line 35 |
| `.env.local` committed to git | **No** — verified via `git ls-files` and `git log` |
| Key in `.next/` build cache | Possible — `.next/` is also gitignored |

**Risk:** The key is safe from git exposure, but:
- The deploy script (`scripts/ec2-deploy.sh:64-73`) copies the **entire** `.env.local` to production via SCP
- No key rotation policy exists
- No separate production API key

**Recommendation:**
1. Use separate API keys for dev and production
2. Rotate the current key since it was visible in this audit
3. Consider using a secrets manager (AWS SSM, Vault) for production

### Finding M-1: Hardcoded Dev Credentials in docker-compose.yml (MEDIUM)

**File:** `docker-compose.yml:16`
```
POSTGRES_PASSWORD: insighthub_dev
```
This is a local dev convenience file (PostgreSQL isn't used in production — SQLite is). Low real risk, but should not be used in any non-local context.

### Finding L-1: Weak Default NEXTAUTH_SECRET in .env.example (LOW)

**File:** `.env.example:7`
```
NEXTAUTH_SECRET="change-me-in-production"
```
Standard practice for example files. Ensure production uses a strong random secret.

### Other Checks — Clean:

| Check | Result |
|-------|--------|
| AWS credentials (AKIA...) | **Clean** — 0 hits in source |
| GitHub tokens (ghp_, gho_) | **Clean** — 0 hits in source |
| Private keys / PEM files | **Clean** — `*.pem` is gitignored |
| Database connection strings with passwords | **Clean** — SQLite uses file path only |

---

## 4. Authentication & Authorization (HIGH — Multiple Findings)

### Finding H-2: Authentication is Non-Functional (HIGH — CRITICAL FOR ROLLOUT)

**File:** `src/lib/auth/session.ts:11-19`

```typescript
export function getCurrentUser(): SessionUser {
  const dev = getDevUser();
  return {
    id: dev.id,
    email: dev.email,
    name: dev.name,
    role: dev.role,
    department: dev.department,
  };
}
```

`getCurrentUser()` **always returns the hardcoded dev admin user** regardless of the `NEXT_PUBLIC_DEV_MODE` flag. It does not:
- Read from the actual session/JWT
- Call `getServerSession()` from NextAuth
- Validate any token

Every API route that calls `getCurrentUser()` thinks it's talking to an admin. There is no real authentication.

### Finding H-3: Unauthenticated API Routes (HIGH)

The following API routes have **zero authentication checks** — no `getCurrentUser()`, no session validation:

| Route | Method | Risk |
|-------|--------|------|
| `/api/chat` | POST | **HIGH** — Calls Anthropic API (cost exposure, prompt injection) |
| `/api/data/query` | POST/GET | **HIGH** — Returns internal data with no access control |
| `/api/widgets` | GET | Medium — Exposes widget library metadata |
| `/api/widgets/fork` | POST | Medium — Allows cloning widgets |
| `/api/widgets/publish` | POST | Medium — Stub, but will create data in Phase 2 |
| `/api/health` | GET | Low — Acceptable for monitoring (but reveals AI key status) |

**Routes that DO call getCurrentUser()** (but get fake admin — see H-2):
- `/api/dashboards` (CRUD)
- `/api/dashboards/[id]` (CRUD + share + versions + revert + duplicate)
- `/api/glossary` (CRUD + search)

### Recommendation:
1. **Before wider rollout**: Implement real session validation in `getCurrentUser()` using `getServerSession(authOptions)`
2. Add auth middleware to ALL routes except `/api/health`
3. The health endpoint should not reveal whether the AI key is configured (`checks.ai`)

---

## 5. Input Validation & Injection

### Finding H-4: No Input Sanitization on Chat Route (HIGH)

**File:** `src/app/api/chat/route.ts:41-46`

User messages are passed directly to Claude with no:
- **Length limits** — an attacker could send megabytes of text
- **Content filtering** — no check for prompt injection patterns
- **Rate limiting** — unlimited requests per user (see M-2)
- **Zod validation** — despite Zod being a dependency, it's unused

The `conversationHistory` array is also accepted without validation — an attacker could inject fake assistant messages to manipulate Claude's context.

### Finding M-2: No Rate Limiting on Any Route (MEDIUM)

**Searched for:** `cors`, `rate-limit`, `rateLimit`, `throttle` — **zero results** in source.

No API route has rate limiting. The `/api/chat` route is particularly dangerous because each request costs money (Anthropic API call with `max_tokens: 4096`).

### Finding M-3: No Request Body Validation with Zod (MEDIUM)

Zod v4.3.6 is installed but unused. All API routes use `as` type assertions:

```typescript
const { message, currentSchema, conversationHistory } = body as { ... };
```

This provides no runtime validation. Malformed requests could cause unexpected behavior.

### Finding M-4: JSON.parse Without Schema Validation (MEDIUM)

**Files:** `src/app/api/dashboards/[id]/route.ts:46`, `src/app/api/chat/route.ts:86`

Dashboard schemas stored as strings are parsed with `JSON.parse()` without validating the result matches the expected `DashboardSchema` type. A corrupted or maliciously crafted schema could cause rendering errors or XSS if schema values are ever rendered as HTML.

---

## 6. Supply Chain / Dependency Risks

### Result: CLEAN

| Check | Result |
|-------|--------|
| `npm audit` | **0 vulnerabilities** (0 info, 0 low, 0 moderate, 0 high, 0 critical) |
| Total dependencies | 616 (181 prod, 400 dev, 109 optional) |
| Typosquatted packages | **None detected** — all packages are well-known |
| `postinstall` script | `"postinstall": "prisma generate"` — legitimate Prisma client generation |
| Pre/post build scripts | **None** besides standard next build |
| External CDN/script includes | **None** — no external `<script>` tags |

### Dependency Review:

All 20 direct dependencies are legitimate, well-maintained packages:

| Package | Version | Notes |
|---------|---------|-------|
| `@anthropic-ai/sdk` | ^0.90.0 | Official Anthropic SDK |
| `@prisma/client` | ^5.22.0 | Official Prisma ORM |
| `@radix-ui/*` | Various | Widely-used React primitives |
| `next` | 16.2.4 | Official Next.js |
| `next-auth` | ^4.24.14 | Standard auth library |
| `react` / `react-dom` | 19.2.4 | Official React |
| `recharts` | ^3.8.1 | Popular charting library |
| `zod` | ^4.3.6 | Schema validation (installed but unused — see M-3) |
| `zustand` | ^5.0.12 | Lightweight state management |
| Others | — | `clsx`, `lucide-react`, `tailwind-merge`, `yaml`, `class-variance-authority` |

---

## 7. Suspicious Comments & Metadata

### Result: CLEAN

| Check | Result |
|-------|--------|
| TODO/FIXME with unusual instructions | **Clean** — no TODOs found in source |
| Comments contradicting code | **Clean** |
| Anomalous timestamps or authorship | **Clean** |
| Large commented-out code blocks | **Low** — `src/app/api/widgets/publish/route.ts:36-49` has Phase 2 DB code commented out. This is intentional scaffolding. |

---

## 8. Infrastructure & Deployment

### Finding M-5: Deploy Script Copies Full .env.local to Production (MEDIUM)

**File:** `scripts/ec2-deploy.sh:64`

```bash
cat "$PROJECT_DIR/.env.local" > "$TMPENV"
```

The deploy script copies the dev `.env.local` to production, meaning dev and production share the same API keys and secrets.

**Recommendation:** Use separate env files per environment (`env.production`) or a secrets manager.

### Finding M-6: Error Messages May Leak Internal Details (MEDIUM)

**Files:** Multiple API routes

```typescript
{ error: error instanceof Error ? error.message : 'Internal server error' }
```

In production, `error.message` could contain:
- Database query details
- File paths
- Stack traces

**Recommendation:** In production, always return generic error messages. Log details server-side only.

### Finding L-2: Health Endpoint Reveals AI Configuration Status (LOW)

**File:** `src/app/api/health/route.ts:23`

```typescript
checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
```

This tells an attacker whether the AI system is available, which could inform targeted attacks against the chat route.

### CI/CD Pipeline Review — Clean:

**File:** `.github/workflows/ci-deploy.yml`
- SSH key stored as GitHub secret (`EC2_SSH_KEY`) — correct practice
- Environment variables stored as GitHub vars — correct practice
- No secrets hardcoded in workflow
- Concurrency group prevents parallel deploys

---

## 9. Additional Observations

### Finding L-3: Hardcoded Dev User Email (LOW)

**File:** `src/lib/auth/config.ts:6`

```typescript
email: 'jeff.coy@uszoom.com',
```

The dev user has a real email address hardcoded. Not a security vulnerability, but should be replaced with a generic dev email for any shared/open-source contexts.

### File System Access in API Route

**File:** `src/app/api/chat/route.ts:23-24`

```typescript
const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
const content = fs.readFileSync(filePath, 'utf-8');
```

This uses a fixed, non-user-controllable path — no path traversal risk. However, `readFileSync` is synchronous I/O in an API route, which blocks the event loop. Consider caching or async reads.

---

## 10. Remediation Priority

### Before Wider Rollout (MUST DO):

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | **H-2**: Implement real auth in `getCurrentUser()` | High | Medium |
| 2 | **H-3**: Add auth middleware to `/api/chat`, `/api/data/query`, `/api/widgets/*` | High | Low |
| 3 | **H-4**: Add input length limits + Zod validation on chat route | High | Low |
| 4 | **M-2**: Add rate limiting to `/api/chat` (at minimum) | Medium | Low |

### Before Production Scale:

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 5 | **H-1**: Rotate API key, use separate keys per environment | High | Low |
| 6 | **M-3**: Add Zod validation to all API request bodies | Medium | Medium |
| 7 | **M-5**: Separate dev/production env files | Medium | Low |
| 8 | **M-6**: Sanitize error messages in production | Medium | Low |
| 9 | **M-4**: Validate parsed dashboard schemas against Zod schema | Medium | Medium |
| 10 | **L-2**: Remove AI config status from health endpoint | Low | Trivial |

---

## Methodology

### Tools Used:
- `grep_search` (ripgrep) — pattern matching across all source files
- `find_by_name` (fd) — file discovery
- `npm audit` — dependency vulnerability scan
- `git log` / `git ls-files` — verified git history for secret exposure
- Manual code review of all API routes, auth config, AI prompts, deploy scripts

### Patterns Searched:

**Prompt Injection:** `ignore previous`, `you are now`, `disregard`, `forget your`, `new instructions`, `override`, `pretend you`

**Dangerous Functions:** `eval(`, `exec(`, `Function(`, `new Function`

**Encoding:** `base64`, `atob`, `btoa`, `Buffer.from`

**Credentials:** `sk-ant-`, `AKIA`, `ghp_`, `gho_`, `password`, `secret`, `token`, `api_key`, `private_key`

**Network:** `fetch(`, `axios`, `http.get`, `XMLHttpRequest`

**File System:** `.ssh`, `/etc/passwd`, `.env`, `readFile`, `writeFile`

**Client Abuse:** `clipboard`, `keylog`, `crypto.subtle`, `mining`, `dangerouslySetInnerHTML`, `innerHTML`

**Code Quality:** `TODO`, `FIXME`, `HACK`, `CORS`, `rate-limit`, `throttle`

### Files Excluded:
- `node_modules/` — third-party code (covered by `npm audit`)
- `.next/` — build artifacts (derived from source)
- `.git/` — version control internals

---

*End of report. Generated April 17, 2026.*
