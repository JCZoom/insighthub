# InsightHub — CISO Security Review

**Application:** InsightHub — AI-Powered Internal Analytics & Dashboarding
**Production URL:** https://dashboards.jeffcoy.net
**Review Date:** 2026-05-25
**Supersedes:** `docs/CISO_REPORT.md` (April 19, 2026 — now archival)
**Classification:** USZOOM_CONFIDENTIAL
**Owner:** Jeff Coy (technical) · JD Gershan (CISO/DPO) · Lior Zamir (Security Manager) · Avi Katz (Compliance)

---

## 0. What changed since April 19

The April 19 report flagged 3 "Critical" items and 5 "High" items. As of 2026-05-25:

| Severity | Item (April 19 framing) | Status today |
|---|---|---|
| Critical #1 | Dev mode bypass can run in production (warning-only) | ✅ **Closed.** `assertEnv()` hard-throws on `NODE_ENV=production` + `DEV_MODE=true` (`src/lib/env.ts:396-407`). CI-only escape hatch `ALLOW_DEV_MODE_IN_PRODUCTION=1` documented and unit-tested. Closed via lived incident retro `INC-20260519-001`. |
| Critical #2 | `.env.local` synced via SCP without encryption | 🟡 **Mitigated.** Deploy operator no longer holds an SSH key (CI-driven self-hosted runner pipeline since 2026-05-19). Secrets still file-based on EC2 (chmod 600), AWS Secrets Manager migration tracked under G-36. |
| Critical #3+ | Snowflake SQL-injection paths (#14–17) | ⚠️ **Unchanged but unactivated.** Snowflake provider remains Phase 3 / not in production query path. Live data is sourced from Prisma + Freshworks REST APIs. SQLi remediation pinned to Phase-3 readiness work. |
| High #3 | Audit logs in same DB as app data (tamperable) | ⚠️ Unchanged. External immutable store still pending (CloudWatch / S3 Object Lock). Tracked in `docs/COMPLIANCE_GAPS.md` G-20 augmentation. |
| High #4 | SQLite database not encrypted at rest | 🟡 **Mitigated.** DB file `chmod 600`, AES-256-CBC encrypted backups, EBS encryption verified at deploy (G-12 closed today). SQLCipher remains a Phase-3 consideration. |
| High #5 | CSP allows `unsafe-eval` and `unsafe-inline` | ✅ **Closed (eval).** `unsafe-eval` removed in production. `unsafe-inline` remains (Next.js requirement); compensating controls in place. |
| High #6 | No `npm audit` in CI | ✅ Closed (since April 19) — parallel CI quality gate. |
| High #18 | GDPR audit actions use `USER_LOGIN` instead of dedicated actions | ✅ **Closed.** `USER_DATA_EXPORT` + `USER_ACCOUNT_DELETION` enum members exist in `src/lib/audit.ts:8-9`. |
| High #19 | `isRedisConfigured()` always returns true due to default URL | ✅ Closed (Apr 25 cleanup). |

**Net:** 4 of the 5 April-19 "Critical" or "High" items related to **codebase** are now closed or mitigated. The Snowflake group is the longest-pole because Snowflake itself is Phase 3 (not yet executing user queries in prod).

**Three additional Tier-2 compliance gaps were closed in this 2026-05-25 session** (in code; deploy required to land):

- **G-12** EBS encryption verified at deploy (`deploy-ci.sh:128-175`)
- **G-15 partial** Dependabot configured (`.github/dependabot.yml`)
- **G-20** Audit-log structured IP / userAgent + recursive metadata sanitization (`prisma/schema.prisma:213-226`, `src/lib/audit.ts:71-221`)

---

## 1. Authentication & Authorization

### 1.1 Authentication Mechanism (current)

| Property | Value | File Reference |
|----------|-------|----------------|
| Auth Library | NextAuth v4 (JWT strategy) | `src/lib/auth/config.ts` |
| Primary Provider | Google OAuth (domain-restricted to `@uszoom.com`) | `src/lib/auth/config.ts:32-63` |
| Session Strategy | JWT (stateless, 8-hour TTL) | — |
| **MFA enforcement (NEW since April 19)** | Google `id_token.amr` parsed at sign-in; `ADMIN`/`POWER_USER` blocked unless MFA-asserted | `src/lib/auth/config.ts:57-121`, `src/lib/auth/mfa.ts` |
| Persisted MFA timestamp | `User.mfaVerifiedAt` (`prisma/schema.prisma:24`) | Admin badge in users list shows ✅ verified / ⚠️ stale / 🔓 missing |
| Rejection landing page | `/auth/mfa-required` with 4-step remediation | `src/app/auth/mfa-required/page.tsx` |
| Audit on rejection | `USER_LOGIN` audit row with `{outcome:'rejected', reason:'mfa_required', effectiveRole, amrValues}` | — |

Closes compliance gap **G-02** (Policy 3692 AUTH-02, AUTH-06; Policy 3691 AC-05).

### 1.2 Dev Mode Bypass — Risk RESOLVED

The April 19 report's #1 Critical finding (dev-mode bypass can run in production with warning-only enforcement) was **closed via lived incident retrospective**.

- **Incident:** `INC-20260519-001` — pre-2026-05-19, `NEXT_PUBLIC_DEV_MODE` (a Next.js inline-into-build flag) was being misused for a security check. A `.env.local` change on prod failed to disable the bypass because the value was already baked into the build artifact at CI build time.
- **Resolution shipped same day** (commits `48c4790`, `3c6126c`):
    1. Split `DEV_MODE` (server-only, runtime-evaluated, the security flag) from `NEXT_PUBLIC_DEV_MODE` (client, build-baked, UI-affordance hint).
    2. `assertEnv()` now hard-throws if `NODE_ENV === 'production'` and `DEV_MODE === 'true'` (`src/lib/env.ts:396-407`). The service refuses to start; deploy fails fast rather than silently bypassing auth.
    3. CI escape hatch `ALLOW_DEV_MODE_IN_PRODUCTION=1` exists for the single legitimate case (Playwright runs `next start` against a prod-shaped artifact with bypass on for tests). Verbose by design — should never be set on a real prod host.
    4. Unit-tested in `src/lib/__tests__/env.test.ts` so the throw can never be silently regressed.

This is the strongest piece of evidence in the codebase for **Policy 3719 Incident Management** working as designed (declaration → containment → corrective control → regression test).

### 1.3 Role-Based Access Control (RBAC) — unchanged scope

Four roles: VIEWER / CREATOR / POWER_USER / ADMIN. Permission groups + per-data-category access levels (FULL / NONE / FILTERED). Metric-level RBAC on top of category-level. Documented in detail in the April 19 report § 1.3; no breaking changes since.

### 1.4 Data Classification (NEW since April 19, closes G-01)

`prisma/schema.prisma` now has `Dashboard.classification` and `GlossaryTerm.classification` (default `USZOOM_RESTRICTED`) plus `dataOwnerId` foreign keys. Canonical helper: `src/lib/data/classification.ts` defines the 4-tier enum (`PUBLIC` / `USZOOM_RESTRICTED` / `USZOOM_CONFIDENTIAL` / `CUSTOMER_CONFIDENTIAL`), validation rules (downgrade-to-PUBLIC blocked for non-admins), and retention-guidance metadata. New audit actions `data.classification_change` and `data.owner_change` emitted on transitions. UI badge component `src/components/classification/ClassificationBadge.tsx`. GDPR export discloses classification per object. Mapping documented in `docs/DATA_CLASSIFICATION_APPLIED.md`.

Closes Policy 3698 DC-01..03.

---

## 2. Secrets Management

### 2.1 Inventory (unchanged from April 19)

`NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`, `ASANA_PERSONAL_ACCESS_TOKEN`, Freshworks API keys, `BACKUP_*` (when G-13 lands), `EC2_SSH_KEY` (CI runner only).

### 2.2 Protection — what changed

- **Operator no longer holds a deploy SSH key.** Since 2026-05-19 the canonical deploy path is `deploy-ci.sh` → GitHub Actions on a self-hosted runner inside EC2. Production deploys require GitHub-environment approval; an immutable workflow log row is pinned to the `github.sha`. This addresses Policy 4427 Change Management CM-02 and Policy 3718 Secure Engineering SE-01/SE-02 even with a single engineer.
- **`.env.local` still file-based on EC2** with `chmod 600`. AWS Secrets Manager migration is tracked under **G-36** (Tier-3, no audit-blocker but recommended before SOC 2 Type II observation).
- **Backup encryption** — backups are AES-256-CBC encrypted with `BACKUP_ENCRYPTION_KEY`. `BACKUP_*` secrets are required by `deploy.sh` pre-flight (will refuse to run without them in prod).

### 2.3 Error message leakage — unchanged, still hardened

Production errors return generic strings; full traces only in dev. Pattern consistent across chat, dashboards, audit, retention APIs.

---

## 3. HTTP Security Headers — TLS hardened since April 19

| Header | Value | Status |
|---|---|---|
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (2 years) | ✅ |
| `Content-Security-Policy` | `unsafe-eval` removed; `unsafe-inline` remains (Next.js req) | ✅ Tightened |
| **TLS protocols** | TLS 1.2 + TLS 1.3 only (Mozilla intermediate ciphers) | ✅ Pinned |
| **OCSP stapling** | enabled (snippet at `infra/nginx-tls-options.conf`) | ✅ |

**SSL Labs grade: A+** — verified post-deploy 2026-05-19, evidence link in `docs/TLS_CONFIGURATION.md`. Closes G-03 (Policy 3701 ENC-01, ENC-04).

---

## 4. API Security

### 4.1 Rate limiting — unchanged

Two layers: nginx (10 r/s, burst 20) + application sliding-window (60 r/min dashboards, 30 r/min chat) per user.

### 4.2 Input validation — unchanged

Zod schemas on chat, dashboards, admin/users, admin/permission-groups, thumbnails. Full body validation on `POST /api/dashboards` includes layout + widget schema.

### 4.3 AI Data Integrity Verification (NEW since April 19)

`docs/DATA_INTEGRITY_VERIFICATION_SPEC.md`. 3-layer verification pipeline that runs on every AI dashboard response:

- **Layer 1 (Deterministic):** 13 structural checks (D-01..D-13), <5ms, free.
- **Layer 2 (AI Verify):** Claude Haiku semantic check ("does this widget actually answer the user's question?"), ~$0.002, 2-4s.
- **Layer 2.5 (Escalation):** Claude Sonnet deep review when Layer 2 confidence < 0.70.

Verification verdicts (PASS / WARN / FAIL with confidence) are surfaced in the chat UI as a green/yellow/red shield badge. Advisory only — patches always apply regardless of verdict, but operators see the signal. Materially relevant to **Policy 3717 §7.5 documented-information integrity** and **Policy 3704 ISMS-04 management-of-records** in the AI-data-pipeline context.

### 4.4 Snowflake risks — still pinned to Phase 3

The 4 SQLi paths flagged April 19 remain in code under `src/lib/snowflake/*` and `src/lib/data/snowflake-data-provider.ts` but are not invoked by any production code path. Live data sources are Prisma (sample dashboards), Freshworks REST (Freshsales, Freshdesk, Freshcaller, Freshchat), and Platform Health (Prisma-backed). Remediation will land alongside the Phase-3 activation work; sequencing documented in `docs/SNOWFLAKE_INTEGRATION_GAMEPLAN.md`.

---

## 5. Audit Logging — strengthened since April 19

### 5.1 Schema (refreshed today)

```
AuditLog {
  id           cuid
  userId       FK -> User
  action       String         -- enum: see src/lib/audit.ts AuditAction
  resourceType String         -- enum: see ResourceType
  resourceId   String
  metadata     String?        -- JSON, sanitized via sanitizeAuditMetadata()
  ipAddress    String?  NEW   -- G-20 (Policy 3715 OS-12)
  userAgent    String?  NEW   -- G-20 (Policy 3715 OS-13)
  createdAt    DateTime
  @@index([ipAddress])  NEW
}
```

### 5.2 Action vocabulary

29 distinct actions in the enum, organized by domain:
- User: `user.login`, `user.role_change`, `user.data_export` (GDPR), `user.account_deletion` (GDPR)
- Glossary, Dashboard, Folder, Settings, Version: full CRUD coverage
- Data classification: `data.classification_change`, `data.owner_change`
- Retention: `retention.purge_chat`, `retention.purge_audit`, `retention.purge_inactive_users`, `retention.purge_freshworks_cache`, `retention.anonymize_customer`
- Freshworks integration: `integration.freshworks.read`, `.unmask_override`, `.cache_hit`, `.rate_limited`

### 5.3 Audit-before-delete (G-08 closed)

`auditedDelete<T>()` wrapper at `src/lib/audit.ts:223-237` enforces audit-before-delete with hard-fail-on-audit-error semantics. All new destructive code paths must use it. Existing audit-after-delete sites are tolerated (every one already has a working audit call) and migrated opportunistically.

### 5.4 Metadata sanitization (NEW today)

`sanitizeAuditMetadata()` at `src/lib/audit.ts:101-118` — recursive key-name redactor matching `/password|token|secret|ssn|credit|cvv|api[_-]?key|authorization|bearer/i`. Applied automatically to all metadata in the shared `buildAuditRow()` helper, so existing call sites get sanitization for free without per-site changes.

### 5.5 Failure handling — unchanged design

`createAuditLog()` is best-effort (logs error to stderr, never throws). `createAuditLogStrict()` propagates errors. Use the latter when audit-loss is itself a compliance violation; the wrapper `auditedDelete()` enforces this for destructive operations.

### 5.6 External immutable store — still pending

Audit logs still co-located in the same SQLite DB as application data. CloudWatch / S3 Object Lock shipping is tracked as a Tier-2 follow-on. Not blocking for current attestation posture.

---

## 6. Data Protection & Privacy

### 6.1 Data at rest

| Asset | Protection | Status |
|---|---|---|
| SQLite DB file | `chmod 600`, owner-only | ✅ |
| DB backups (local) | AES-256-CBC encrypted (`BACKUP_ENCRYPTION_KEY`), `.db.enc` | ✅ |
| DB backups (offsite) | KMS-encrypted us-west-2 S3 bucket | 🟡 G-13 — code shipped, AWS bootstrap blocked on IAM perms |
| `.env.local` on EC2 | `chmod 600` | ✅ |
| EBS volume | `aws ec2 enable-ebs-encryption-by-default` recommended | ✅ Now verified at deploy (G-12 closed today) |

### 6.2 Data in transit

- HTTPS enforced via Certbot/Let's Encrypt
- HSTS 2-year max-age + includeSubDomains
- `upgrade-insecure-requests` CSP directive
- All outbound API calls (Anthropic, OpenAI, Freshworks, Asana) use HTTPS

### 6.3 PII inventory & enforcement

- **`User`:** real employee email/name/avatarUrl. Anonymized on retention via `purgeInactiveUsers` (1095d default, anonymize-not-delete pattern preserves audit FK integrity).
- **`SampleCustomer`/`SampleDeal`:** synthetic via `@faker-js/faker`.
- **Freshworks data:** masked at field level for VIEWER/CREATOR roles (PII redactor at `src/lib/integrations/freshworks/*/redact.ts`).
- **Server-side PII field stripping** in `/api/data/query` (April 19 status preserved): `name`, `email`, `company`, `account_manager`, `contact`, `owner` replaced with `[REDACTED]` for non-FULL `CustomerPII` access.

### 6.4 GDPR self-service — implemented

- `GET /api/user/export` — full JSON data export
- `POST /api/user/delete` — anonymizes user, deletes personal data
- 90-day chat-message retention via `purgeChatMessages` (configurable; admin-triggerable + cron-scheduleable)

---

## 7. Infrastructure Security

### 7.1 Systemd hardening + memory limits (NEW since April 19)

`infra/insighthub.service` includes:
```
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/insighthub/prisma /opt/insighthub/backups /opt/insighthub/logs
PrivateTmp=yes
MemoryHigh=448M    # NEW — soft cap (throttle, not kill)
MemoryMax=512M     # hard cap
MemorySwapMax=0
CPUQuota=80%
```

Memory hardening landed after a 2026-05-15 OOM event — see `docs/MEMORY_HARDENING_CRASH_COURSE.md`. Bounds blast radius for runaway requests; relevant to Policy 3702 HH-16 and Policy 3715 OS-03.

### 7.2 Network access — unchanged

EC2 reachable only via Tailscale VPN SSH (no public SSH port). Nginx 80/443 public; app binds `127.0.0.1:3001`.

### 7.3 Deploy pipeline (NEW since April 19)

Track B Phase 1 — CI-driven self-hosted runner:
1. Trigger via `deploy-ci.sh` (operator's terminal) — calls `gh workflow run`.
2. Pre-deploy gates: TypeScript, ESLint, npm audit (high+), build, E2E Playwright (functional + a11y advisory).
3. **EBS encryption pre-flight** (NEW today) — `deploy-ci.sh:128-175`.
4. Deploy job runs on self-hosted runner inside EC2; production environment requires explicit approval before the job is allowed to run.
5. Health-check + auto-rollback on failure (5 attempts, then revert to `.next-previous`).
6. Immutable workflow log row pinned to `github.sha`.

This addresses Policy 3718 SE-01/SE-02 (peer review through PR/CI), Policy 4427 CM-02/CM-10 (change management), and provides non-repudiation for the deploy actor (operator approval recorded in GitHub audit).

### 7.4 Backup & DR — partial

- **Encryption:** AES-256-CBC at rest, key in `BACKUP_ENCRYPTION_KEY`. ✅
- **Local cadence:** daily via `scripts/cron/setup-cron.sh`. ✅
- **Retention:** 30 days local (`KEEP_DAYS=30`) — meets Policy 4133 BK-07 minimum. ✅
- **Cross-region offsite:** KMS-encrypted us-west-2 S3 bucket — code shipped, AWS bootstrap blocked on IAM perms (`docs/TODO_BACKUP_ISOLATION.md`). 🟡
- **Restore drill:** annual restore test scripted (`scripts/restore-from-s3.sh`); first dated drill not yet executed.
- **DR plan with RTO/RPO numbers:** still pending (G-31, Tier-3).

---

## 8. Incident Response — proven in production

### 8.1 Runbook

`docs/INCIDENT_RESPONSE_RUNBOOK.md` covers Policy 3719 IM-01..06: declaration, severity matrix, containment playbooks (rotate API keys, revoke OAuth, restore from backup, invalidate JWTs), retrospective format.

### 8.2 First lived incident — `INC-20260519-001`

`docs/incidents/INC-20260519-001.md` — full retro for the dev-mode-bypass-baked-into-build-artifact incident:
- **Declared:** 2026-05-19 morning (operator-detected during pre-demo smoke test)
- **Contained:** flag split, prod artifact rebuilt
- **Corrective control:** `assertEnv()` hard-throw shipped same day
- **Preventive control:** unit-tested in `src/lib/__tests__/env.test.ts` so the regression cannot silently land
- **Documentation update:** new operator pattern documented in `src/lib/env.ts:54-77` for the next person who confuses runtime vs build-baked flags

This is the single most valuable artifact in the repo for an audit conversation. ISO 27001 auditors care less about whether you have an IR runbook and more about whether you've ever **used** it.

---

## 9. Compliance Posture

### 9.1 vs. SOC 2 Trust Services Criteria

| Criterion | Status | Notes |
|---|---|---|
| CC1 — Control Environment | ✅ | Roles defined, governance documented |
| CC2 — Communication & Information | 🟡 | ISMS communication plan exists (Policy 3706); training records minimal |
| CC3 — Risk Assessment | ✅ | `docs/RISK_REGISTER.md` (40+ risks, last reviewed 2026-05-19) |
| CC4 — Monitoring | 🟡 | App-level audit logging strong; CloudWatch alerting pending (G-21) |
| CC5 — Control Activities | ✅ | RBAC, audit, retention, classification all live |
| CC6 — Logical Access | ✅ | MFA enforced, domain-restricted OAuth, session TTL bounded |
| CC7 — System Operations | ✅ | Health checks, auto-rollback, memory limits, retention automation |
| CC8 — Change Management | ✅ | CI gates, env-approval, immutable deploy log |
| CC9 — Risk Mitigation | ✅ | Documented in risk register w/ owner + treatment |
| A1 — Availability | 🟡 | Single-region, single-instance; DR plan + restore drill pending (G-31, G-27) |
| C1 — Confidentiality | ✅ | Classification framework + RBAC + PII masking |
| P-series — Privacy | ✅ | GDPR export + delete; classification labels |

### 9.2 vs. ISO 27001:2022 Annex A (93 controls)

`docs/STATEMENT_OF_APPLICABILITY.md` is the authoritative document. Roll-up:

- **A.5 Organizational (37 controls):** majority Implemented/Partial; 4 documented as Not Applicable with justification (joint controllers, separate compliance scope).
- **A.6 People (8 controls):** Partial — relies on USZoom-wide HR controls (Policy 3703); InsightHub-specific training records minimal.
- **A.7 Physical (14 controls):** Mostly Not Applicable (cloud-only deployment) with AWS controls inherited; 2 in-scope (asset-handling, equipment-disposal) Implemented.
- **A.8 Technological (34 controls):** strong coverage — encryption, access management, secure development, monitoring all mapped to specific code/config evidence.

### 9.3 vs. USZoom ISMS policies (35 documents)

Mapping in `docs/COMPLIANCE_MATRIX.md` (138 controls). Current rollup:

| Status | Count |
|---|---|
| ✅ Implemented | ~52 |
| ⚠️ Partial | ~30 |
| ❌ Gap | ~26 |
| 📋 Org/Non-technical | 27 |
| N/A | 3 |

Conformance has risen from ~25% to ~38% Implemented since the original 2026-04-24 mapping.

---

## 10. Risk Summary — Top 10 today

| Rank | Risk | Severity | Status / Treatment |
|---|---|---|---|
| 1 | No offsite isolated backup (G-13) | HIGH | Code shipped; AWS bootstrap blocked on IAM perms. **Get admin AWS creds and run `setup-backup-isolation.sh`.** |
| 2 | Single-instance, single-region production | MED-HIGH | DR plan + IaC + restore-drill all Tier-2/3. Acceptable for current scale; revisit pre-SOC-2-Type-II. |
| 3 | Audit logs co-located with app data (tamperable) | MED | Tier-2 — ship to S3 Object Lock or CloudWatch. |
| 4 | No third-party penetration test | MED | Tier-3 (G-32) — commission before first SOC 2 attestation. |
| 5 | Snowflake SQLi paths exist in code | MED (LOW exposure) | Pinned to Phase-3 activation; not in production query path today. |
| 6 | Secrets in `.env.local` synced to EC2 | MED | G-36 — AWS Secrets Manager migration. |
| 7 | No CIS Level-1 baseline applied to EC2 | MED | G-14 — runbook + Ansible playbook pending. |
| 8 | No CloudWatch alerting / paging | MED | G-21 — health-check cron exists; observability layer pending. |
| 9 | No dev/staging/prod separation | MED | G-22 — production DB literally named `dev.db`. Cosmetic but real. |
| 10 | `ADMIN_EMAILS` hardcoded in source | LOW | G-38 — move to DB-driven `AdminRoleAssignment` table. |

Full risk register: `docs/RISK_REGISTER.md`.

---

## 11. Recommended next 90 days

**Week 1 (pre-Wednesday demo + this week):**
- ✅ G-12 (EBS verify) — closed today, deploy required
- ✅ G-15 partial (Dependabot) — closed today, repo-level enable required
- ✅ G-20 (audit IP/UA + sanitization) — closed today, deploy required
- 🟡 G-13 (backup isolation) — get AWS admin creds, run bootstrap
- 🟡 Refresh `CISO_REPORT.md` — done, this document supersedes

**Weeks 2–4:**
- G-09 (quarterly access-review export)
- G-10 (automated offboarding via Google Admin SDK)
- G-22 (dev/staging/prod separation, DB rename, env badge)
- G-24 (SAST in CI — Semgrep or CodeQL)
- G-26 (vendor register evidence — DPAs, SOC 2 review dates)
- G-27 (annual restore-drill — first execution)

**Quarter 1:**
- G-21 (CloudWatch alerting)
- G-31 (DR plan with RTO/RPO)
- G-32 (commission third-party pentest)
- G-33 (privacy notice UI / `/privacy` page)
- G-36 (AWS Secrets Manager migration)

---

## Appendix A — Key file index (refreshed 2026-05-25)

| Area | File | Lines of Interest |
|---|---|---|
| Auth config (MFA enforcement) | `src/lib/auth/config.ts` | 32-121 |
| MFA helpers | `src/lib/auth/mfa.ts` | full |
| MFA-rejection landing | `src/app/auth/mfa-required/page.tsx` | full |
| Env validator (assertEnv hard-throw) | `src/lib/env.ts` | 396-407 |
| Env validator (runtime-vs-build-baked split) | `src/lib/env.ts` | 54-77 |
| RBAC (roles + groups + metric-level) | `src/lib/auth/permissions.ts` | full |
| Data classification framework | `src/lib/data/classification.ts` | full |
| Classification badge UI | `src/components/classification/ClassificationBadge.tsx` | full |
| Audit log schema | `prisma/schema.prisma` | 206-227 |
| Audit log helpers (sanitize, extract, build) | `src/lib/audit.ts` | 71-237 |
| `auditedDelete<T>` wrapper | `src/lib/audit.ts` | 223-237 |
| AI Data Integrity Verification | `src/lib/ai/verify-integrity.ts` | full |
| Verification spec | `docs/DATA_INTEGRITY_VERIFICATION_SPEC.md` | full |
| Retention purge functions | `src/lib/data/retention.ts` | full |
| Retention admin endpoint | `src/app/api/admin/retention/route.ts` | full |
| Retention cron wrapper | `scripts/cron/retention-purge.sh` | full |
| Backup script (encrypted, S3) | `scripts/backup-db.sh` | full |
| Backup isolation bootstrap | `scripts/setup-backup-isolation.sh` | full |
| Backup isolation runbook | `docs/BACKUP_ISOLATION_SETUP.md` | full |
| EBS encryption check (called from deploy) | `scripts/check-ebs-encryption.sh` | full |
| Deploy CI wrapper (canonical path) | `deploy-ci.sh` | 112-175 (pre-flight) |
| CI workflow | `.github/workflows/ci.yml` | full |
| **Dependabot config (NEW today)** | `.github/dependabot.yml` | full |
| TLS hardening snippet | `infra/nginx-tls-options.conf` | full |
| TLS configuration doc | `docs/TLS_CONFIGURATION.md` | full |
| Systemd hardening + memory limits | `infra/insighthub.service` | full |
| Memory hardening crash course | `docs/MEMORY_HARDENING_CRASH_COURSE.md` | full |
| Incident response runbook | `docs/INCIDENT_RESPONSE_RUNBOOK.md` | full |
| **First lived incident retro** | `docs/incidents/INC-20260519-001.md` | full |
| Asset register | `docs/ASSET_REGISTER.md` | full |
| Risk register | `docs/RISK_REGISTER.md` | full |
| Statement of Applicability | `docs/STATEMENT_OF_APPLICABILITY.md` | full |
| Compliance matrix (control-by-control) | `docs/COMPLIANCE_MATRIX.md` | full |
| Compliance gaps (current state) | `docs/COMPLIANCE_GAPS.md` | full |
| Vendor register | `docs/VENDOR_REGISTER.md` | full |
| Compliance crash course (plain English) | `docs/COMPLIANCE_CRASH_COURSE.md` | full |

---

## Appendix B — Document supersession

This document supersedes `docs/CISO_REPORT.md` (April 19, 2026). The April 19 document is preserved unmodified for audit-trail purposes. Any direct citation of CISO findings in stakeholder-facing materials should reference this 2026-05-25 document or the still-authoritative `docs/COMPLIANCE_GAPS.md` for current gap state.

**Sign-off:** Document prepared by Cascade in pair-programming session with Jeff Coy, 2026-05-25. Pending CISO review by JD Gershan.
