# InsightHub — CISO Security Review

**Application:** InsightHub — AI-Powered Dashboard Builder  
**Production URL:** https://dashboards.jeffcoy.net  
**Review Date:** April 18, 2026  
**Classification:** Internal — Confidential

---

## Executive Summary

InsightHub is an internal self-service BI platform that lets employees build data dashboards using natural language powered by Claude AI. It is deployed on a single EC2 instance behind Nginx with TLS, uses SQLite for storage, and integrates with Anthropic (Claude) and OpenAI (Whisper) cloud APIs.

This report covers authentication and authorization, data protection and PII handling, secrets management, API security, external API surface, CSP and HTTP security headers, audit logging, and identified risks with recommended mitigations.

---

## 1. Authentication & Authorization

### 1.1 Authentication Mechanism

| Property | Value | File Reference |
|----------|-------|----------------|
| **Auth Library** | NextAuth v4 (JWT strategy) | `src/lib/auth/config.ts:30` |
| **Primary Provider** | Google OAuth (domain-restricted) | `src/lib/auth/config.ts:32–35` |
| **Dev Provider** | Credentials (dev mode only) | `src/lib/auth/config.ts:37–53` |
| **Session Strategy** | JWT (stateless, 8-hour TTL) | `src/lib/auth/config.ts:149–156` |
| **Domain Restriction** | `@uszoom.com` emails only | `src/lib/auth/config.ts:57–63` |

**Key code — domain restriction:**
```typescript
// src/lib/auth/config.ts:57–63
async signIn({ user, account }) {
  if (account?.provider === 'google') {
    const email = user.email;
    if (!email || !email.toLowerCase().endsWith(`@${process.env.ALLOWED_DOMAIN || 'uszoom.com'}`)) {
      return false; // Reject sign in
    }
  }
  return true;
}
```

### 1.2 Dev Mode Bypass — Critical Risk

**Risk Level: HIGH**

When `NEXT_PUBLIC_DEV_MODE=true`, all authentication is bypassed. The middleware allows unauthenticated requests, and the session system returns a hardcoded admin user.

| File | Line(s) | Behavior |
|------|---------|----------|
| `middleware.ts` | 58 | `if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') return true;` — skips auth entirely |
| `src/lib/auth/session.ts` | 16–26 | Returns hardcoded `dev-admin-user` with ADMIN role |
| `src/lib/auth/config.ts` | 43 | CredentialsProvider accepts any email in dev mode |

**Safeguards already in place:**
- `src/lib/env.ts:149–151` warns when `NEXT_PUBLIC_DEV_MODE` is true in production
- `assertEnv()` runs at server startup via `src/instrumentation.ts`
- Deploy script (`scripts/ec2-deploy.sh:69–71`) sets `NODE_ENV=production`

**✅ Resolved:** `assertEnv()` now throws a fatal error and prevents server startup when `NEXT_PUBLIC_DEV_MODE=true` in production (`src/lib/env.ts:172–182`). Previously this was a warning only.

### 1.3 Role-Based Access Control (RBAC)

Four roles exist: **VIEWER**, **CREATOR**, **POWER_USER**, **ADMIN**. Permissions are enforced via a group-based system stored in the database.

| Role | Dashboard Create | Glossary Edit | Sensitive Data | User Management | Audit Logs |
|------|:---:|:---:|:---:|:---:|:---:|
| VIEWER | ✗ | ✗ | ✗ | ✗ | ✗ |
| CREATOR | ✓ | ✗ | ✗ | ✗ | ✗ |
| POWER_USER | ✓ | ✗ | ✓ | ✗ | ✗ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |

**Key files:**
- Permission definitions: `src/lib/auth/permissions.ts:52–146`
- Permission resolution: `src/lib/auth/permissions.ts:164–283`
- Admin-only guard: `src/app/api/admin/audit/route.ts:9`
- Feature permission check: `src/app/api/admin/users/route.ts:25–28`

### 1.4 Data Access Controls (PII Protection)

The permission system includes **data category** access controls that restrict which data sets each role can query:

| Data Category | VIEWER | CREATOR | POWER_USER | ADMIN |
|--------------|:---:|:---:|:---:|:---:|
| Revenue | NONE | NONE | FULL | FULL |
| Retention | NONE | FULL | FULL | FULL |
| Support | FULL | FULL | FULL | FULL |
| Sales | NONE | NONE | FULL | FULL |
| Product | NONE | FULL | FULL | FULL |
| Operations | NONE | NONE | FULL | FULL |
| **CustomerPII** | **NONE** | **NONE** | **NONE** | **FULL** |

**Key implementation — data source permission check:**
```typescript
// src/app/api/data/query/route.ts:18–31
const hasAccess = await canAccessDataSource(user, source);
if (!hasAccess) {
  return NextResponse.json(
    { error: 'Access denied', message: `You don't have permission...` },
    { status: 403 }
  );
}
```

**AI prompt enforcement — restricted data categories are injected into the system prompt:**
```typescript
// src/lib/ai/prompts.ts:119–131
## RESTRICTED DATA - YOU CANNOT ACCESS
**IMPORTANT**: You do NOT have access to the following data categories
and must NOT generate queries or widgets using them
```

**CustomerPII** category covers: `sample_customers`, `customers`, `customer_growth`, `customers_by_plan`, `customers_by_region` — see `src/lib/auth/permissions.ts:12`.

**✅ Resolved:** Server-side PII field stripping is now enforced in `src/app/api/data/query/route.ts:16–33`. All responses from the data query API have PII fields (`name`, `email`, `company`, `account_manager`, `contact`, `owner`) replaced with `[REDACTED]` for any user without `FULL` access to the `CustomerPII` category. This is a hard control that operates regardless of what the AI generates, complementing the existing prompt-based soft control.

---

## 2. Secrets Management

### 2.1 Secrets Inventory

| Secret | Storage | Exposure Risk |
|--------|---------|---------------|
| `NEXTAUTH_SECRET` | `.env.local` (gitignored) | JWT signing — compromise allows session forgery |
| `ANTHROPIC_API_KEY` | `.env.local` (gitignored) | API billing — compromise allows unauthorized API usage |
| `OPENAI_API_KEY` | `.env.local` (gitignored) | API billing — same as above |
| `GOOGLE_CLIENT_SECRET` | `.env.local` (gitignored) | OAuth — compromise allows auth bypass |
| `ASANA_PERSONAL_ACCESS_TOKEN` | `.env.local` (gitignored) | Project management access |
| `SNOWFLAKE_PASSWORD` | `.env.local` (gitignored) | Database access (Phase 3, currently unused) |
| `EC2_SSH_KEY` | GitHub/Bitbucket secrets | Server access |

### 2.2 Secrets Protection

**Positive findings:**
- `.gitignore` correctly excludes `.env`, `.env.local`, `.env.*.local`, `*.pem` — see `.gitignore:37–40`
- `.env.example` contains only placeholder values, no real secrets — see `.env.example`
- API keys are server-side only; never sent to the client
- Anthropic key passed only in server-side route handler: `src/app/api/chat/route.ts:265`
- OpenAI key stays server-side in transcription proxy: `src/app/api/voice/transcribe/route.ts:13`
- `NEXTAUTH_SECRET` is validated for minimum 32 chars in production: `src/lib/env.ts:32–33`
- Deploy script auto-generates a secure 64-char secret if too short: `scripts/ec2-deploy.sh:76–83`

**Risk — `.env.local` synced to EC2:**

The deploy script copies the local `.env.local` to EC2:
```bash
# scripts/ec2-deploy.sh:63–64
TMPENV=$(mktemp)
cat "$PROJECT_DIR/.env.local" > "$TMPENV"
```

**Recommendation:** Use a proper secrets manager (AWS SSM Parameter Store, AWS Secrets Manager, or HashiCorp Vault) rather than file-based env syncing. At minimum, ensure EC2 `.env.local` has restrictive file permissions (`chmod 600`). *(Infrastructure change — not code-implementable.)*

### 2.3 Error Message Leakage

Production errors are sanitized — internal error details are only shown in development:
```typescript
// src/app/api/chat/route.ts:477–479
const errorMessage = process.env.NODE_ENV === 'production'
  ? 'Internal server error'
  : (error instanceof Error ? error.message : 'Internal server error');
```

This pattern is consistently applied across chat (line 408), and stack traces are suppressed in production logs: `src/lib/logger.ts:104`.

---

## 3. HTTP Security Headers

All security headers are applied via middleware (`middleware.ts:9–39`):

| Header | Value | Status |
|--------|-------|--------|
| `X-Frame-Options` | `DENY` | ✅ Clickjacking protected |
| `X-Content-Type-Options` | `nosniff` | ✅ MIME sniffing prevented |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Referrer leakage controlled |
| `X-XSS-Protection` | `1; mode=block` | ✅ Legacy XSS filter |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ HSTS (2 years, HTTPS only) |
| `Content-Security-Policy` | See below | ⚠️ See concerns |

### 3.1 Content Security Policy Analysis

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.anthropic.com https://vercel.live;
frame-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

**✅ Resolved (partial):**
- `'unsafe-eval'` removed from `script-src` in production — now only present in dev mode for Next.js hot reload: `middleware.ts:27–30`
- `https://vercel.live` removed from `script-src` and `connect-src` (vestigial, not using Vercel)
- `img-src` tightened from `https:` (any HTTPS) to `blob:` only (self + data + blob)

**Remaining:**
- `'unsafe-inline'` in `script-src` and `style-src` — still required for Next.js inline scripts and Tailwind. Full nonce-based CSP requires Next.js rendering pipeline changes (future enhancement).

### 3.2 Production Health Check — Security Headers Verified

The E2E test suite verifies security headers in production:
```typescript
// e2e/production-health.spec.ts:46–53
test('Security headers are present', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['content-security-policy']).toBeTruthy();
});
```

---

## 4. API Security

### 4.1 Rate Limiting

Two-layer rate limiting is in place:

| Layer | Configuration | File |
|-------|--------------|------|
| **Nginx** | 10 req/sec per IP, burst 20 | `infra/nginx.conf:13` |
| **Application** | 60 req/min (dashboards), 30 req/min (chat) per user | `src/lib/rate-limiter.ts:151–152` |

Rate limiting is applied via a `withRateLimit` wrapper on all API routes. Standard `X-RateLimit-*` headers are returned. The health endpoint is exempt from Nginx rate limiting: `infra/nginx.conf:74–79`.

**Concern:** Application-level rate limiting is in-memory (`Map`-based). This works for a single-instance deployment but will not share state across multiple instances if the app scales horizontally.

### 4.2 Input Validation

Zod schema validation is applied on critical endpoints:

| Endpoint | Validation | File |
|----------|-----------|------|
| `POST /api/chat` | Message length (1–10,000 chars), history limit (20 entries), UUID format | `src/app/api/chat/route.ts:21–44` |
| `POST /api/admin/users` | CUID format for user/group IDs | `src/app/api/admin/users/route.ts:8–17` |
| `POST /api/admin/permission-groups` | Name length, permission structure | `src/app/api/admin/permission-groups/route.ts:52–57` |

**✅ Resolved:** The `POST /api/dashboards` route now validates the entire request body with Zod, including the `schema` field (`DashboardSchemaValidator`). Validates layout constraints, widget structure (position bounds, data config, etc.), title/description length, tag limits, and max 100 widgets per dashboard: `src/app/api/dashboards/route.ts:9–51`.

### 4.3 CSRF Protection

CSRF is handled by NextAuth's built-in cookie-based CSRF mechanism. A comment in `middleware.ts:41–42` explicitly documents that custom header-based CSRF was considered but not wired to the client.

### 4.4 GET Method Removal

The `GET` method was removed from the chat endpoint for security — query parameters could leak sensitive data (dashboard schemas, conversation history) in logs and browser history:
```typescript
// src/app/api/chat/route.ts:214–217
// GET method removed for security reasons - use POST instead
// Previously this endpoint accepted sensitive data as URL query parameters
```

### 4.5 External API Calls

| External Service | Direction | Purpose | Auth Method |
|-----------------|-----------|---------|-------------|
| Anthropic API | Outbound | AI chat (Claude Sonnet 4) | API key in Authorization header |
| OpenAI API | Outbound | Voice transcription (Whisper) | Bearer token |

Both API keys are server-side only. The OpenAI call is proxied through `src/app/api/voice/transcribe/route.ts` — the client never sees the key. Anthropic is called from `src/app/api/chat/route.ts:265`.

---

## 5. Audit Logging

### 5.1 Logged Actions

All significant actions are logged to the `AuditLog` database table:

| Category | Actions Logged | File |
|----------|---------------|------|
| **User** | Login, role changes | `src/lib/audit.ts:6–7` |
| **Glossary** | Create, update, delete | `src/lib/audit.ts:10–12` |
| **Dashboard** | Create, update, delete, share, duplicate | `src/lib/audit.ts:15–19` |
| **Version** | Save, revert | `src/lib/audit.ts:22–23` |
| **Permissions** | Group assign/remove, group CRUD | `src/lib/auth/permissions.ts:330–349` |

### 5.2 Audit Log Structure

Each log entry contains: `userId`, `action`, `resourceType`, `resourceId`, `metadata` (JSON), `createdAt`. Indexed on `userId`, `resourceType+resourceId`, and `createdAt` for efficient querying: `prisma/schema.prisma:163–165`.

### 5.3 Audit Log Access

Admin-only access via `GET /api/admin/audit` with filtering by user, action, resource, date range, and pagination: `src/app/api/admin/audit/route.ts:6–76`.

### 5.4 Audit Failure Handling

Audit logging failures are caught and logged but never block the primary operation — this is intentional design:
```typescript
// src/lib/audit.ts:62–72
} catch (error) {
  console.error('Failed to create audit log:', { error, userId, action, ... });
}
```

**Recommendation:** Consider shipping audit logs to an external, immutable store (e.g., CloudWatch, S3 with object lock) for SOC 2 compliance. Currently, audit logs live in the same SQLite database as application data and could be tampered with by anyone with DB access. *(Infrastructure change — not code-implementable.)*

---

## 6. Data Protection & Privacy

### 6.1 Data at Rest

| Asset | Protection | Status |
|-------|-----------|--------|
| SQLite database | Filesystem permissions (`chmod 600`), owner-only | ✅ Hardened (was `664`) |
| Database backups (EC2) | AES-256-CBC encrypted (`.db.enc`), `BACKUP_ENCRYPTION_KEY` | ✅ Encrypted at rest |
| Database backups (local) | AES-256-CBC encrypted on download, gitignored | ✅ Encrypted at rest |
| `.env.local` on EC2 | `chmod 600`, owner-only | ✅ Hardened |
| EBS volume | Verification script available | ⚠️ Verify via `scripts/check-ebs-encryption.sh` |

**Remediations applied (April 2026):**
- `scripts/backup-db.sh` — Backups encrypted with AES-256-CBC via `openssl` when `BACKUP_ENCRYPTION_KEY` is set. Unencrypted temp files are securely shredded after encryption.
- `scripts/restore-db.sh` — Transparently decrypts `.db.enc` backups during restore. Decrypted temp files are shredded after use.
- `scripts/setup-cron.sh` — Daily cron backup job updated to encrypt.
- `scripts/ec2-deploy.sh` — DB permissions hardened from `chmod 664` → `chmod 600`. `.env.local` permissions set to `chmod 600`.
- `scripts/check-ebs-encryption.sh` — New script to verify EBS volume encryption status and provide remediation steps.

**Remaining recommendation:** Enable EBS volume encryption for the EC2 instance (AWS Console/CLI). For SQLite specifically, consider SQLCipher for at-rest encryption if PII enters the database in later phases.

### 6.2 Data in Transit

- HTTPS enforced via Certbot/Let's Encrypt TLS on Nginx
- HSTS header with 2-year max-age and preload: `middleware.ts:18–19`
- `upgrade-insecure-requests` CSP directive forces HTTPS
- All external API calls (Anthropic, OpenAI) use HTTPS

### 6.3 PII Inventory

Current sample data contains the following PII-adjacent fields:

| Table | Fields | Risk |
|-------|--------|------|
| `User` | email, name, avatarUrl | Real employee data |
| `SampleCustomer` | name, email, company, account_manager | Synthetic (faker-generated) |
| `SampleDeal` | company, contact, owner | Synthetic |
| `ChatMessage` | content (free-text from users) | May contain sensitive info |

The seed script uses `@faker-js/faker` to generate all sample customer data: `prisma/seed.ts:20`. Real PII exposure is limited to the `User` table and free-text `ChatMessage` content.

### 6.4 AI Conversation Storage

All AI conversations are persisted to the database (`ChatMessage` table). Messages include the user's natural language input and the AI's response including any schema patches.

**✅ Resolved:** A 90-day retention policy is now implemented via `src/lib/data/retention.ts`. The `purgeChatMessages()` function deletes messages older than the retention period and cleans up orphaned sessions. An admin-only API endpoint `POST /api/admin/retention` (`src/app/api/admin/retention/route.ts`) can be invoked by a cron job or manually. Accepts an optional `retentionDays` parameter (default 90).

---

## 7. Infrastructure Security

### 7.1 Systemd Hardening

The service unit file includes security hardening: `infra/insighthub.service:24–29`

```ini
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/insighthub/prisma /opt/insighthub/backups /opt/insighthub/logs
PrivateTmp=yes
```

### 7.2 Resource Limits

```ini
# infra/insighthub.service:32–33
MemoryMax=512M
CPUQuota=80%
```

### 7.3 Network Access

- EC2 accessed via **Tailscale VPN SSH** only — no public SSH port
- Deploy scripts require Tailscale: `deploy.sh:70`, `scripts/ec2-deploy.sh:23`
- Nginx listens on port 80 (HTTPS via Certbot modification)
- App binds to `127.0.0.1:3001` (not publicly accessible except through Nginx)

---

## 8. Dependency Security

### 8.1 Key Dependencies

| Package | Version | Risk Notes |
|---------|---------|-----------|
| `next` | 16.2.4 | Latest — keep updated for security patches |
| `next-auth` | ^4.24.14 | Mature, well-audited auth library |
| `@prisma/client` | ^5.22.0 | ORM — parameterized queries prevent SQL injection |
| `zod` | ^4.3.6 | Input validation — actively maintained |
| `@anthropic-ai/sdk` | ^0.90.0 | Official SDK — handles auth securely |

### 8.2 No Known Critical Vulnerabilities

The codebase uses Prisma (parameterized queries) for all database access, preventing SQL injection. No raw SQL is executed except in the health check (`SELECT 1`): `src/app/api/health/route.ts:22`.

**✅ Resolved:** `npm audit --audit-level=high` is now a required CI quality gate (`.github/workflows/ci.yml:48–59`). The `audit` job runs in parallel with typecheck and lint; the build will not proceed if high or critical vulnerabilities are found.

---

## 9. Compliance Readiness

### 9.1 SOC 2 Alignment

| Control | Status | Notes |
|---------|--------|-------|
| Access Control | ✅ | RBAC with 4 roles, permission groups, domain-restricted auth |
| Audit Logging | ✅ | All CRUD actions logged with user, timestamp, metadata |
| Change Management | ✅ | Dashboard versioning with revert capability |
| Encryption in Transit | ✅ | TLS 1.2+ via Certbot, HSTS enforced |
| Encryption at Rest | ⚠️ | EBS encryption not confirmed |
| Incident Response | ⚠️ | Health monitoring exists but no alerting pipeline |
| Vendor Management | ⚠️ | Anthropic and OpenAI used; no BAA documented |

### 9.2 GDPR Considerations

| Requirement | Status |
|-------------|--------|
| Data minimization | ✅ Only email/name stored for users |
| Right to access | ✅ `GET /api/user/export` — full JSON data export |
| Right to deletion | ✅ `POST /api/user/delete` — anonymizes user, deletes personal data |
| Consent | ✅ Google OAuth implies consent; domain-restricted |
| Data retention | ✅ 90-day chat retention via `POST /api/admin/retention` |

---

## 10. Risk Summary & Recommendations

### Critical

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | ~~Dev mode bypass could run in production (warning-only check)~~ | ✅ `assertEnv()` now throws a fatal error preventing startup: `src/lib/env.ts:172–182` |
| 2 | `.env.local` synced via SCP without encryption | Migrate to AWS Secrets Manager or SSM Parameter Store *(infrastructure — not code-implementable)* |

### High

| # | Risk | Mitigation |
|---|------|-----------|
| 3 | Audit logs stored in same DB as app data (tamperable) | Ship audit logs to immutable external store (CloudWatch, S3 Object Lock) *(infrastructure — not code-implementable)* |
| 4 | SQLite database not encrypted at rest | ✅ Backups now AES-256-CBC encrypted; DB file hardened to `chmod 600`; EBS encryption verification script added. Evaluate SQLCipher for Phase 3 |
| 5 | ~~CSP allows `'unsafe-eval'` and `'unsafe-inline'`~~ | ✅ `'unsafe-eval'` removed in production, `https://vercel.live` removed, `img-src` tightened. `'unsafe-inline'` remains (Next.js requirement). `middleware.ts:23–44` |
| 6 | ~~No `npm audit` in CI pipeline~~ | ✅ Added as parallel CI quality gate: `.github/workflows/ci.yml:48–59` |

### Medium

| # | Risk | Mitigation |
|---|------|-----------|
| 7 | ~~Chat messages persist indefinitely (may contain sensitive data)~~ | ✅ 90-day retention with `POST /api/admin/retention`: `src/lib/data/retention.ts`, `src/app/api/admin/retention/route.ts` |
| 8 | ~~Dashboard schema body not validated with Zod~~ | ✅ Full Zod validation added: `src/app/api/dashboards/route.ts:9–51` |
| 9 | ~~AI PII enforcement is prompt-based only (soft control)~~ | ✅ Server-side PII field stripping added: `src/app/api/data/query/route.ts:7–33` |
| 10 | ~~No GDPR self-service (data export / account deletion)~~ | ✅ `GET /api/user/export` and `POST /api/user/delete` implemented: `src/app/api/user/export/route.ts`, `src/app/api/user/delete/route.ts` |
| 11 | In-memory rate limiting won't survive restarts or scale horizontally | Acceptable for single-instance; plan Redis if scaling |
| 12 | ~~Vestigial `https://vercel.live` in CSP~~ | ✅ Removed from both `script-src` and `connect-src`: `middleware.ts:31–37` |

---

## Appendix: Key File Index for Security Review

| Area | File | Lines of Interest |
|------|------|-------------------|
| Auth middleware | `middleware.ts` | 5–64 (auth bypass, security headers, CSP) |
| Auth config | `src/lib/auth/config.ts` | 30–157 (OAuth, domain restriction, JWT) |
| Session handling | `src/lib/auth/session.ts` | 14–46 (user resolution, dev bypass) |
| RBAC permissions | `src/lib/auth/permissions.ts` | 52–146 (role templates), 164–283 (resolution) |
| Data access control | `src/app/api/data/query/route.ts` | 18–31 (permission check) |
| AI prompt security | `src/lib/ai/prompts.ts` | 85–139 (data source filtering), 119–131 (restricted data injection) |
| Rate limiting | `src/lib/rate-limiter.ts` | 20–148 (sliding window), 151–152 (limits) |
| Audit logging | `src/lib/audit.ts` | 45–73 (log creation), 150–201 (retrieval) |
| Admin audit API | `src/app/api/admin/audit/route.ts` | 6–76 (admin-only access) |
| Admin users API | `src/app/api/admin/users/route.ts` | 20–203 (permission management) |
| Env validation | `src/lib/env.ts` | 22–104 (var definitions), 115–190 (validation) |
| Chat API | `src/app/api/chat/route.ts` | 219–244 (input validation), 265–276 (auth, API key) |
| Voice transcription | `src/app/api/voice/transcribe/route.ts` | 12–68 (API key proxy) |
| DB schema (PII) | `prisma/schema.prisma` | 10–26 (User), 169–186 (SampleCustomer) |
| Systemd hardening | `infra/insighthub.service` | 24–33 (security + resource limits) |
| Nginx config | `infra/nginx.conf` | 13 (rate limit), 30–33 (security headers) |
| Health check | `src/app/api/health/route.ts` | 6–53 (no auth required — public) |
| Security header tests | `e2e/production-health.spec.ts` | 46–54 (header assertions) |
| Secrets handling | `scripts/ec2-deploy.sh` | 60–87 (env sync, secret generation) |
| PII field stripping | `src/app/api/data/query/route.ts` | 7–33 (server-side PII redaction) |
| Chat retention | `src/lib/data/retention.ts` | 1–36 (90-day purge utility) |
| Retention API | `src/app/api/admin/retention/route.ts` | 1–37 (admin-only purge endpoint) |
| GDPR data export | `src/app/api/user/export/route.ts` | 1–112 (right-to-access) |
| GDPR account delete | `src/app/api/user/delete/route.ts` | 1–100 (right-to-deletion) |
| Dashboard validation | `src/app/api/dashboards/route.ts` | 9–51 (Zod schema validation) |
| Gitignore (secrets) | `.gitignore` | 37–43 (env files, DB, keys) |
