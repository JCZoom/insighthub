# InsightHub — USZoom Policy Compliance Gaps

> **Generated:** 2026-04-24
> **Source:** Mapping of `policies_USZoom_2026-04-24/*.pdf` against the current InsightHub codebase.
> **Companion:** `docs/COMPLIANCE_MATRIX.md` has the full control-by-control evidence.
> **Last production deploy:** 2026-05-19 ~17:25 ET (commit `8e024ba`) via **CI-driven self-hosted runner** (Track B Phase 1) — first deploy on the new auditable pipeline. Earlier same-day deploy `46d000f` shipped the Tier-1 closures; today's later deploy added memory hardening + the CI gate that produced this code path. Operator no longer holds an SSH key on the deploy box; deploys require a GitHub-environment approval and produce a workflow log row pinned to the `github.sha`.

## How this document is organized

Each gap has:

- **ID** — stable identifier (`G-NN`) so we can reference it in Asana/commits.
- **Policy** — which USZoom policy (and control #) is violated.
- **Audit risk** — `HIGH` / `MED` / `LOW` — likelihood an auditor marks this a **Major Non-Conformity** vs. an `Opportunity for Improvement` (OFI).
- **Effort** — `S` (≤1 day) / `M` (1–5 days) / `L` (>1 week).
- **Remediation** — concrete steps.

Gaps are **sorted by priority** (audit risk × exposure to InsightHub stakeholders).

---

## Priority tier 1 — **DO BEFORE ANY DEMO OR EXTERNAL REVIEW**

These are the gaps most likely to surface as *blocking* findings in an ISO 27001 / SOC 2 audit and the easiest to lose stakeholder confidence over.

### G-01 — No Data Classification Framework
- **Policy:** 3698 Data Classification · controls DC-01, DC-02, DC-03
- **Audit risk:** HIGH
- **Effort:** M
- **Status (2026-04-25):** ✅ **Closed.**
- **Evidence:**
  1. Schema fields `classification` (default `USZOOM_RESTRICTED`) and `dataOwnerId` (FK to `User`) added to both `Dashboard` and `GlossaryTerm` in [`prisma/schema.prisma`](../prisma/schema.prisma); existing rows backfilled via `prisma db push`.
  2. Canonical helper [`src/lib/data/classification.ts`](../src/lib/data/classification.ts) defines the 4-tier set, sensitivity ranking, validation (`canSetClassification`), display metadata, and retention guidance.
  3. Dashboard CRUD (`src/app/api/dashboards/route.ts` + `[id]/route.ts`) and Glossary CRUD (`src/app/api/glossary/route.ts` + `[id]/route.ts`) accept and validate `classification` and `dataOwnerId`; downgrades to `PUBLIC` are blocked for non-admin callers.
  4. Two new audit actions emitted on transitions: `data.classification_change` and `data.owner_change` (see [`src/lib/audit.ts`](../src/lib/audit.ts)).
  5. UI badge component [`src/components/classification/ClassificationBadge.tsx`](../src/components/classification/ClassificationBadge.tsx) — compact form on dashboard cards (default tier suppressed), full form in editor and admin views.
  6. GDPR export (`src/app/api/user/export/route.ts`) discloses classification and data-owner per dashboard.
  7. Mapping documented in [`docs/DATA_CLASSIFICATION_APPLIED.md`](DATA_CLASSIFICATION_APPLIED.md).
- **Phase 3 follow-on:** when Snowflake source metadata is connected, propagate classification from the Snowflake catalog into widget data-source records. Tracked under **R-030** until then.

### G-02 — MFA Not Enforced at the Application Layer
- **Policy:** 3692 Authentication & Password · AUTH-02, AUTH-06; 3691 Access Control · AC-05
- **Audit risk:** HIGH
- **Effort:** M
- **Status (2026-05-19):** ✅ **Closed.** Full scope shipped: AMR check + admin gate + persisted timestamp + admin-UI surface. **Deployed to production EC2 2026-05-19 15:42 ET** (commit `46d000f`); `User.mfaVerifiedAt` column verified on prod SQLite post-deploy.
- **Why it matters:** Policy 3692 says *"For systems storing customer PII and other regulated data, MFA must be enforced: users should not be able to disable the second factor and retain access."*
- **Evidence:**
  1. New AMR parser `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/mfa.ts` (`parseIdTokenAMR`, `requiresMfa`, `MFA_AMR_VALUES`). Recognizes `mfa`, `otp`, `hwk`, `swk`, `sms`, `tel`, `fpt`, `face`, `iris` per RFC 8176. MFA-required roles: ADMIN, POWER_USER.
  2. **Enforcement gate in `signIn` callback** at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:57-121`: resolves effective role from `(ADMIN_EMAILS allowlist) ∪ (DB role)`, parses the Google `id_token.amr`, returns `/auth/mfa-required` redirect string if MFA-required and not asserted. Rejection emits a `USER_LOGIN` audit log with `{ outcome:'rejected', reason:'mfa_required', effectiveRole, amrValues, parseError }`.
  3. **Persistence:** new `User.mfaVerifiedAt: DateTime?` column added in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:20-24`. Schema pushed via `prisma db push` (SQLite). The `jwt` callback updates `mfaVerifiedAt` only when MFA is asserted on the current sign-in — **never null-out a previous verification**, so the field always reflects "most recent MFA-bearing sign-in".
  4. **Admin UI badge** added to `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/admin/users/users-client.tsx:59-95` with three states: ✅ verified (within 7d), ⚠️ stale (>7d), 🔓 missing-required (red for privileged roles without any MFA history). Tooltip shows the exact timestamp.
  5. **Rejection landing page** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/auth/mfa-required/page.tsx` — explains the policy, gives users a 4-step remediation procedure (sign out of Google, sign back in to trigger MFA).
  6. **Full chain documented** in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/AUTHENTICATION.md`: chain diagram, why-this-not-Google-alone defence, stakeholder talking points for the CISO review.
  7. **Backwards-compat:** `CredentialsProvider` (dev mode only, gated on `NEXT_PUBLIC_DEV_MODE === 'true'`) is unaffected. Production sets dev mode false in the env validator.
  8. **Typecheck + lint clean** (`npx tsc --noEmit` and `npm run lint` — 0 errors, 2026-05-19).
- **Pending follow-ups (Tier-2):**
  - **G-02b** Step-up MFA challenge for sensitive in-app actions (TOTP secondary factor). Today's gate fires at sign-in only; a stolen session cookie bypasses MFA until 8h JWT expiry.
  - **Production access** (SSH to EC2): document YubiKey-via-ssh-add-K enforcement.
- **Manual verification:**
  1. Sign in to InsightHub as an ADMIN with Google MFA verified within the last few minutes → succeeds, badge shows ✅.
  2. Sign out, then in Google account settings simulate "no MFA" (test mode) → InsightHub sign-in redirects to `/auth/mfa-required` and the rejection appears in audit log.
  3. Query: `SELECT * FROM AuditLog WHERE action='user.login' AND metadata LIKE '%rejected%' ORDER BY createdAt DESC LIMIT 5;` shows rejection rows.

### G-03 — TLS Configuration Not Explicitly Pinned or Tested
- **Policy:** 3701 Encryption · ENC-01, ENC-04
- **Audit risk:** MED
- **Effort:** S
- **Status (2026-05-19):** ✅ **Closed.** **Deployed to production EC2 2026-05-19 15:42 ET** (commit `46d000f`); `curl -sI https://dashboards.jeffcoy.net` returns `Strict-Transport-Security: max-age=63072000; includeSubDomains` from both nginx and the Next.js middleware layer.
- **Architecture (revised 2026-05-19 post-deploy):** TLS hardening is delivered by **two complementary nginx includes** stacked in the HTTPS server block:
  - `/etc/letsencrypt/options-ssl-nginx.conf` (Certbot-managed) — pins `ssl_protocols TLSv1.2 TLSv1.3;`, the Mozilla intermediate cipher list, `ssl_prefer_server_ciphers off`, session-cache + 1440m timeout, and `ssl_session_tickets off`. Satisfies ENC-01.
  - `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx-tls-options.conf` (InsightHub-managed, deployed to `/etc/nginx/snippets/insighthub-tls.conf`) — adds OCSP stapling + HSTS on top. Satisfies ENC-04.
- **Why the split:** initially our snippet duplicated the protocol/cipher/session directives; deploy failed with `nginx -t` reporting `ssl_session_timeout directive is duplicate` because Certbot already injects them. The snippet was trimmed to just the directives Certbot does NOT provide. Header block of the snippet documents this so a future operator doesn't re-add the duplicates and re-break the deploy.
- **Evidence:**
  1. Snippet at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx-tls-options.conf`:
     - `ssl_stapling on; ssl_stapling_verify on;` + resolver pinned to 1.1.1.1 + 8.8.8.8 (OCSP).
     - `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;` (2-year HSTS — ENC-04).
     - Note: Let's Encrypt has been phasing OCSP URLs out of issued certs since 2024, so `ssl_stapling` currently logs a benign "no OCSP responder URL" warning on this host. Directive stays for forward-compat with future cert providers and a no-op on the current cert.
  2. Certbot include (verified on production via `cat /etc/letsencrypt/options-ssl-nginx.conf` 2026-05-19): provides `TLSv1.2+TLSv1.3` + Mozilla intermediate ciphers — every accepted cipher provides AES-128-GCM or stronger with perfect forward secrecy.
  3. Deploy script `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/ec2-deploy.sh:163-183` idempotently uploads the snippet and injects the `include` directive into the HTTPS server block. Certbot preserves the include across cert renewals.
  4. Stakeholder-readable rationale + annual review checklist documented in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/TLS_CONFIGURATION.md`.
- **Pending operator action:**
  1. Run SSL Labs scan on `dashboards.jeffcoy.net`, save result PDF to `docs/evidence/ssllabs-2026-05-19.pdf`, link from `docs/TLS_CONFIGURATION.md`. Target grade: **A+** (HSTS bonus). **Due 2026-05-22** (Asana task `ssllabs-annual-review` to be created).
- **Recurring control:** Asana annual task "TLS / SSL Labs review" — to be created in `/asana-sync` workflow run.

### G-04 — No Asset Register
- **Policy:** 12737 Asset Management · AM-01–AM-03
- **Audit risk:** HIGH
- **Effort:** M
- **Why it matters:** *"Every asset in the register has a single, named owner."* A missing Asset Register is one of the most common **Major Non-Conformities** ISO 27001 auditors write.
- **Remediation:**
  1. Create `docs/ASSET_REGISTER.md` (markdown table) covering:
     - **Information assets:** prod DB, backup bucket, secrets, OAuth config, Snowflake schema.
     - **Software:** each SaaS (Anthropic, OpenAI, Google, Asana, Snowflake) + each production dependency.
     - **Hardware:** Jeff's MacBook, EC2 instance.
     - **Services:** GitHub, Bitbucket, Let's Encrypt, Tailscale.
     - Columns: `id | name | type | owner | classification | location | lifecycle_state | last_reviewed`.
  2. Add `scripts/generate-asset-register.sh` that regenerates the SaaS/dep portion from `package.json` + a static YAML for manual assets.
  3. Put a quarterly-review reminder in Asana (tag on parent task).

### G-05 — No Data Retention / Disposal Automation
- **Policy:** 3700 Retention · DR-01–DR-03 · 3699 Disposal · DD-04
- **Audit risk:** HIGH (GDPR-relevant)
- **Effort:** M
- **Status (2026-05-19):** ✅ **Closed.** **Deployed to production EC2 2026-05-19 15:42 ET** (commit `46d000f`); `/api/admin/retention` endpoint live on prod, daily cron pending operator install (see Pending operator action below).
- **Evidence:**
  1. Four bounded retention functions in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/data/retention.ts`:
     - `purgeChatMessages` (default 90d) — existing, now extended with `dryRun` + meta-audit
     - `purgeAuditLogs` (default 365d) — closed G-06 above; lives at lines 151-199
     - `purgeInactiveUsers` (default 1095d, anonymize-not-delete) — lines 255-326
     - `purgeFreshworksCache` (default 90d bulk / 60s per-key TTL) — lines 343-427
  2. **Anonymization-over-deletion for users:** `purgeInactiveUsers` rewrites email → `anon-<id>@redacted.local`, name → `Anonymized User`, avatar → null, department → null. Audit-log FK integrity preserved. Re-running is a no-op (idempotent by `email LIKE 'anon-%'` filter).
  3. **Multi-target admin endpoint:** `POST /api/admin/retention` now accepts `target: 'chat'|'audit'|'inactive_users'|'freshworks_cache'|'all'` with per-target retention-day overrides. `dryRun:true` returns match counts without deleting — preview lever for operators. See `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/admin/retention/route.ts`.
  4. **Daily cron** delivered at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/cron/retention-purge.sh`. Install procedure documented in `docs/RETENTION_AUTOMATION.md`. Logs to `/var/log/insighthub/retention-purge.log`, exits non-zero on HTTP failure so cron MAILTO fires.
  5. **Five new audit actions** registered in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:45-49`: `retention.purge_chat`, `retention.purge_audit`, `retention.purge_inactive_users`, `retention.purge_freshworks_cache`, `retention.anonymize_customer`.
  6. **Demo lever ready:** `purgeFreshworksCache` accepts a no-op dry-run *and* a real wipe via SCAN+DEL on `fw:*` keys. Tomorrow's demo will execute this live to prove the retention story end-to-end (per Game Plan §3.6 / §4.3 amendment).
  7. Full operator runbook + cron install procedure + cookie-provisioning steps + annual review checklist documented in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/RETENTION_AUTOMATION.md`.
  8. Typecheck clean (`npx tsc --noEmit` 2026-05-19).
- **Pending operator action (post-deploy):**
  1. Provision the cron cookie per `docs/RETENTION_AUTOMATION.md` §Provisioning.
  2. Install the cron file: `sudo cp scripts/cron/retention-purge.sh /etc/cron.daily/insighthub-retention`.
  3. Verify with `RETENTION_DRY_RUN=1` first; then enable real run.
  4. Asana: create quarterly cookie-rotation reminder.

### G-06 — Audit Log Retention / Upper Bound Not Enforced
- **Policy:** 3700 Data Retention · DR-01 (every data class needs a bounded retention period)
- **Audit risk:** LOW (missing a **maximum** bound), MED if logs contain PII
- **Effort:** S
- **Status (2026-05-19):** ✅ **Closed.** **Deployed to production EC2 2026-05-19 15:42 ET** (commit `46d000f`); `purgeAuditLogs(365)` reachable via `POST /api/admin/retention` with `target: 'audit'`.
- **Evidence:**
  1. New `purgeAuditLogs(retentionDays = 365, opts)` exported from `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/data/retention.ts:151-199`. Default 365d; override via `AUDIT_LOG_RETENTION_DAYS` env var.
  2. Function supports `dryRun: true` for preview-without-delete (admin UI + cron verification pattern).
  3. **Meta-logging:** every non-dry-run invocation emits a `RETENTION_PURGE_AUDIT` audit entry against `ResourceType.SYSTEM` recording `{deleted, retentionDays, cutoff, source}`. The retention table records its own grooming.
  4. New audit actions enumerated in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:43-49` (RETENTION_PURGE_CHAT, RETENTION_PURGE_AUDIT, plus three reserved for G-05).
  5. `POST /api/admin/retention` now accepts `target: 'chat' | 'audit' | 'all'` and `dryRun: boolean` — see `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/admin/retention/route.ts:36-76`. Default `target='chat'` preserves backwards-compat with existing cron callers.
  6. Typecheck clean (`npx tsc --noEmit` 2026-05-19).
- **Manual verification procedure** (since unit-test framework not installed; full procedure also in `docs/RETENTION_AUTOMATION.md`):
  ```bash
  # Dry-run audit purge as admin:
  curl -X POST https://dashboards.jeffcoy.net/api/admin/retention \
    -H "Content-Type: application/json" -H "Cookie: $ADMIN_COOKIE" \
    -d '{"target":"audit","dryRun":true}'
  # Expected: { audit: { matched: <N>, deleted: 0, dryRun: true, ... } }
  ```
- **Future test work** (tracked, not blocking): introduce vitest + add `src/lib/data/__tests__/retention.test.ts` exercising both targets with seeded Prisma fixtures. Logged in repo TODOs.

### G-07 — Backup Retention Below Policy Minimum
- **Policy:** 4133 Backup · BK-07 (min 30 days)
- **Audit risk:** MED
- **Effort:** S
- **Status (2026-04-24):** ✅ Closed. `KEEP_DAYS` bumped from 14 to 30 in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh:29` during the G-13 delivery. Change lands on EC2 on next `rsync` via `./deploy.sh`. S3-side retention is managed by the bucket lifecycle policy (STANDARD_IA @ 90d, non-current versions expire @ 2y).

### G-08 — Deletion Events Not Consistently Audit-Logged
- **Policy:** 3699 Disposal · DD-05
- **Audit risk:** MED
- **Effort:** S
- **Status (2026-05-19):** ✅ **Closed.** **Deployed to production EC2 2026-05-19 15:42 ET** (commit `46d000f`); `auditedDelete<T>()` wrapper + dashboard-share DELETE fix are live.
- **Audit-of-the-audit (full delete-site inventory done 2026-05-19):**
  | Delete site | Audit before 2026-05-19 | Status |
  |---|---|---|
  | `app/api/folders/[id]/route.ts:231` | `FOLDER_DELETE` after delete | ✅ Acceptable |
  | `app/api/glossary/[id]/route.ts:194` | `logGlossaryAction(GLOSSARY_DELETE)` after delete | ✅ Acceptable |
  | `app/api/user/delete/route.ts:35-41` | `USER_ACCOUNT_DELETION` **before** transaction | ✅ Ideal pattern (was already correct) |
  | `app/api/dashboards/[id]/aliases/route.ts:125` | `DASHBOARD_ALIAS_REMOVE` after delete | ✅ Acceptable |
  | `app/api/admin/permission-groups/route.ts:281` | `logPermissionChange('permission_group.delete')` after delete | ✅ Acceptable |
  | `lib/auth/permissions.ts:567` | `logPermissionChange('user_permission.remove')` after delete | ✅ Acceptable |
  | **`app/api/dashboards/[id]/share/route.ts:101`** | **NO AUDIT** | ❌ **Real gap — fixed today** |
  | `app/api/dashboards/[id]/move/route.ts:48,52` | Subordinate folderAlias cleanup inside DASHBOARD_MOVE | ✅ Covered by parent action |
- **Evidence:**
  1. New `auditedDelete<T>()` wrapper added to `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:163-172` — enforces audit-before-delete with hard-fail-on-audit-error semantics. **All new destructive code paths MUST use this wrapper** (documented in the JSDoc).
  2. Supporting `createAuditLogStrict()` helper added at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:119-135` — same as `createAuditLog` but propagates errors (used internally by `auditedDelete`).
  3. New `DASHBOARD_UNSHARE` audit action added (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:21`) and threaded through `logDashboardAction`'s type signature.
  4. Real gap fix: `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/dashboards/[id]/share/route.ts:101-123` (DELETE handler) now uses `auditedDelete` — share removal is logged BEFORE the row is deleted, with the dashboard title, target user, and a `selfRemoval` flag distinguishing owner-revocation from self-removal.
  5. `AuditLogData` interface exported so external modules can construct typed audit payloads for `auditedDelete`.
  6. Typecheck clean (`npx tsc --noEmit` 2026-05-19).
- **Manual verification:**
  ```bash
  # Remove a share, then confirm audit row exists:
  curl -X DELETE 'https://dashboards.jeffcoy.net/api/dashboards/<id>/share' \
    -H 'Content-Type: application/json' -H "Cookie: $COOKIE" \
    -d '{"userId":"<target>"}'
  # Then query audit logs:
  curl 'https://dashboards.jeffcoy.net/api/admin/audit?action=dashboard.unshare&resourceId=<id>'
  ```
- **Migration target (tracked, not blocking):** existing audit-after-delete sites are acceptable — every one of them has a working audit call. Migrate to `auditedDelete` opportunistically when touching the file for other reasons. New code MUST use the wrapper.

---

## Priority tier 2 — **FIX WITHIN 30 DAYS OF INITIAL AUDIT**

Real findings that are fixable but not existential.

### G-09 — No Quarterly Access Review
- **Policy:** 3691 Access Control · AC-08
- **Audit risk:** MED-HIGH
- **Effort:** S (tooling) + ongoing
- **Remediation:**
  1. Build `/api/admin/access-review/export` that dumps every user + role + last login + permission groups as CSV.
  2. Add a quarterly Asana task template (repeating).
  3. Capture evidence: reviewer, date, deltas applied.

### G-10 — No Automated Offboarding
- **Policy:** 3691 Access Control · AC-09
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. When an `@uszoom.com` address is disabled in Google Workspace, the OAuth callback will already fail. **But** the `User` row remains with any API tokens / session records.
  2. Add a nightly job that calls Google Admin SDK to list active users and flags/disables matching `User` rows missing from the directory.
  3. Add a `User.status` column (`ACTIVE` / `SUSPENDED` / `DEPROVISIONED`).

### G-11 — Admins Use Their Regular Account for Privileged Actions
- **Policy:** 3691 Access Control · AC-10 ("Administrators should maintain separate general and privileged accounts when possible")
- **Audit risk:** LOW (common exception for small orgs)
- **Effort:** L
- **Remediation:** Document in `docs/RISK_REGISTER.md` as an *accepted risk* with compensating controls (JWT session short TTL, audit log, MFA). Revisit when headcount > 5.

### G-12 — EBS / S3 Encryption Not Verified in Deploy Pipeline
- **Policy:** 3701 Encryption · ENC-04, ENC-05
- **Audit risk:** MED
- **Effort:** S
- **Remediation:**
  1. Wire `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/check-ebs-encryption.sh` into `deploy.sh` as step `[0/7]`. Fail deploy if unencrypted.
  2. Same for the backup S3 bucket if one is added.

### G-13 — Backups Not Isolated from Production + Not Enforced-Encrypted
- **Policy:** 4133 Backup · BK-03, BK-04 · 4428 BCP · BCP-06
- **Audit risk:** **HIGH** (this is a genuine DR risk, not a paperwork finding)
- **Effort:** M
- **Status (2026-04-24):** Code + runbook delivered. AWS setup pending operator execution.
  - ✅ `scripts/setup-backup-isolation.sh` (idempotent AWS bootstrap — KMS key, us-west-2 bucket, versioning, public-access block, lifecycle policy, separate writer/reader IAM users).
  - ✅ `scripts/backup-db.sh` extended with S3 upload + mandatory encryption when S3 is enabled.
  - ✅ `scripts/restore-from-s3.sh` for DR restore using reader credentials.
  - ✅ `deploy.sh` pre-flight refuses production deploys if BACKUP_* secrets are missing on EC2.
  - ✅ `docs/BACKUP_ISOLATION_SETUP.md` — operator runbook including MFA-delete step (requires root).
  - 🟡 **Operator action required:** Jeff to run `./scripts/setup-backup-isolation.sh` with admin AWS profile, enable MFA-delete as root, populate `.env.local` on EC2. See runbook steps 1-5.
  - 🟡 AWS Secrets Manager migration remains tracked under G-36 (keys currently in EC2 `.env.local` with 600 perms).

### G-14 — Host Hardening Not Aligned to CIS Benchmarks
- **Policy:** 3702 Host Hardening · HH-04, HH-06
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Run `aws-cis-benchmark` or CIS-CAT Lite against the EC2 AMI; capture report in `docs/CIS_BASELINE.md`.
  2. Apply at least the *Level 1* recommendations: disable unused services, set `/etc/ssh/sshd_config` (PermitRootLogin no, PasswordAuthentication no, ClientAliveInterval 600, ClientAliveCountMax 2 → produces the 2-hour idle timeout from HH-08), sysctl hardening.
  3. Convert the applied settings into an Ansible playbook or a user-data script so rebuild is repeatable.

### G-15 — No Documented Patching SLA / Dependabot Not Enabled
- **Policy:** 3715 Ops Sec · OS-20; 3702 HH-05; 3718 SE-08
- **Audit risk:** MED
- **Effort:** S
- **Remediation:**
  1. Enable GitHub Dependabot (`security_updates: true`) via `.github/dependabot.yml`.
  2. Enable Ubuntu `unattended-upgrades` with security pocket enabled on EC2.
  3. Document SLAs in `docs/VULNERABILITY_MANAGEMENT.md`:
     - Critical / High: 30 days
     - Medium: 60 days
     - Low: 90 days
     - Informational: as needed

### G-16 — AWS Resources Not in Infrastructure-as-Code
- **Policy:** 4427 CM-10; 4428 BCP-05
- **Audit risk:** MED
- **Effort:** L
- **Remediation:**
  1. Capture current AWS state (Security Group, EBS volume, IAM roles, Elastic IP, Route53 records) in a `infra/terraform/` directory or AWS CDK.
  2. Wire `terraform plan` into CI as a read-only check.
  3. Acceptable interim: document every manually-configured resource in `docs/INFRA_INVENTORY.md`.

### G-17 — SSH Remote-Access Idle Timeout Not Configured
- **Policy:** 3702 Host Hardening · HH-08 ("Remote access sessions must be configured to automatically timeout after 2 hours of inactivity")
- **Audit risk:** LOW
- **Effort:** S
- **Remediation:** Addressed under G-14 (sshd_config ClientAliveInterval).

### G-18 — No Incident Response Runbook / Tabletop Exercise
- **Policy:** 3719 Incident Management · IM-01 to IM-06; 6458 Tabletop DR · BCP-08
- **Audit risk:** **HIGH**
- **Effort:** M
- **Remediation:**
  1. Write `docs/INCIDENT_RESPONSE_RUNBOOK.md` mirroring policy 3719 phases: Declaration → Containment → Retrospective.
  2. Define severity matrix (Low/Med/High/Critical) with concrete examples from InsightHub context (leaked API key, DB compromise, auth bypass, dependency RCE).
  3. Pre-write containment playbooks: rotate Anthropic/OpenAI keys, revoke OAuth, restore from backup, invalidate JWTs.
  4. Run one tabletop exercise per year using the scenarios in policy 6458 (DDoS / data sabotage / erroneous prod push). Document the after-action report.

### G-19 — No Enforced Peer Review / Branch Protection
- **Policy:** 3718 Secure Engineering · SE-01, SE-02; 4427 CM-02
- **Audit risk:** MED-HIGH (Major NC likely during audit)
- **Effort:** S (if more than one dev), L (if Jeff is solo forever)
- **Remediation:**
  1. Enable GitHub Branch Protection on `main`: require PR + approval + CI passing.
  2. For the solo phase, **accept the risk** in `docs/RISK_REGISTER.md` with compensating controls: every change goes via PR (self-review), CI must pass, auto-deploy only on `workflow_dispatch`.
  3. When a second engineer joins, enforce "reviewer ≠ author."

### G-20 — Audit Logs Missing Structured IP / Sanitization
- **Policy:** 3715 Ops Sec · OS-12, OS-13
- **Audit risk:** MED
- **Effort:** S
- **Remediation:**
  1. Add `ipAddress String?` and `userAgent String?` columns to `AuditLog` in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma`.
  2. Populate from `request.headers.get('x-forwarded-for')` in all helpers (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts`).
  3. Add a `sanitizeAuditMetadata()` utility that strips any key whose name matches `/password|token|secret|ssn|credit|cvv/i` before persisting.

### G-21 — No Cloud Alerting / Capacity Monitoring
- **Policy:** 3702 HH-16; 3715 OS-03
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Stand up CloudWatch alarms for EC2 CPU, disk, memory, and 5xx rate from Nginx access logs.
  2. Wire alarms to an email/SNS/Slack. Document in `docs/OBSERVABILITY.md`.
  3. Minimum viable: cron-based health check that pages Jeff on failure.

### G-22 — No Separation of Dev / Staging / Production
- **Policy:** 3715 OS-06; 3718 SE-04
- **Audit risk:** MED-HIGH
- **Effort:** L
- **Remediation:**
  1. Stand up a `staging.dashboards.jeffcoy.net` on the same EC2 under a different systemd unit + port, backed by a separate SQLite file.
  2. Rename production DB file from `prisma/dev.db` to `prisma/prod.db` and mirror the change in `deploy.sh`, `backup-db.sh`, `.github/workflows/ci.yml`, and any seed scripts.
  3. Add an environment badge in the UI (`Env: PROD` in red in the header) to prevent accidental admin actions on the wrong env.

### G-23 — No Quarterly Vulnerability Scans or Annual Compliance Scans
- **Policy:** 3715 OS-18; 3702 HH-10, HH-17
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Enable **AWS Inspector** on the EC2 instance (free tier covers <100 instances).
  2. Enable **AWS Config** with the CIS + PCI conformance packs (read-only, $2/mo per rule).
  3. Schedule quarterly `nmap --script vuln` scan from a remote location against the public IP; archive results in `docs/vuln-scans/`.

### G-24 — No Static Application Security Testing (SAST)
- **Policy:** 3718 SE-07
- **Audit risk:** MED
- **Effort:** S
- **Remediation:**
  1. Add a `sast` job to `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml` running either Semgrep (free rulesets for owasp-top-10 + nextjs) or GitHub CodeQL.
  2. Fail the build on High+ findings.

### G-25 — No Formal Release Checklist
- **Policy:** 3718 SE-09
- **Audit risk:** LOW
- **Effort:** S
- **Remediation:** Add `docs/RELEASE_CHECKLIST.md`: CI green, backup taken, smoke tests, rollback plan, changelog updated, Jeff acknowledges deploy. Link from `deploy.sh` banner.

### G-26 — No Third-Party / Vendor Register
- **Policy:** 3720 Third-Party Management · TP-01 to TP-05
- **Audit risk:** MED-HIGH
- **Effort:** S
- **Remediation:**
  1. Create `docs/VENDOR_REGISTER.md` with: vendor, data classification handled, DPA link, SOC 2 / ISO report reviewed date, exit strategy, contract reference.
  2. Current vendors: Anthropic (Customer Conf — chat content), OpenAI (Customer Conf — voice transcripts), Google (Customer Conf — auth identity), Bitbucket/GitHub (Customer Conf — source code), Asana (USZoom Confidential — project metadata), Snowflake (Customer Conf — planned Phase 3), AWS (all data), Let's Encrypt (public metadata), Tailscale (no USZoom data).
  3. Annual review reminder in Asana.

### G-27 — No Annual Backup Restore Test
- **Policy:** 3715 OS-11; 4133 BK-06; 4428 BCP-07
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Add `scripts/test-restore.sh` that: pulls latest backup → spins up a temporary SQLite → runs the E2E Playwright suite against it → tears down.
  2. Schedule annually. Capture evidence in `docs/BACKUP_RESTORE_TEST_<YYYY>.md`.

### G-28 — No File Integrity Monitoring on Production Host
- **Policy:** 3715 OS-16
- **Audit risk:** LOW-MED
- **Effort:** M
- **Remediation:** Install AIDE or Wazuh agent on EC2; baseline; alert on drift of `/etc/`, `/usr/bin/`, `/opt/insighthub/`. Document in `docs/INFRA_HARDENING.md`.

### G-29 — No Threat Intelligence Feed
- **Policy:** 3715 OS-17
- **Audit risk:** LOW
- **Effort:** S
- **Remediation:** Subscribe to `github.com/advisories`, `cisa.gov/known-exploited-vulnerabilities` RSS, and Node-Security-WG. Document intake process in the vulnerability management doc (G-15).

### G-30 — No Data Leakage Prevention (DLP)
- **Policy:** 3715 OS-04
- **Audit risk:** LOW (small org, small data)
- **Effort:** L
- **Remediation:** Out of scope for code. Accept as risk in register with compensating controls (RBAC, audit logging, classification labels from G-01). Revisit at next headcount milestone.

---

## Priority tier 3 — **DOCUMENT & TRACK (auditor will note as OFI)**

### G-31 — No Documented DR Plan with RTO/RPO
- **Policy:** 4428 BCP · BCP-01, BCP-04, BCP-07
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Write `docs/DISASTER_RECOVERY_PLAN.md`:
     - **RTO** (Recovery Time Objective): 4 hours for a regional AWS outage.
     - **RPO** (Recovery Point Objective): 24 hours (daily backup cadence).
     - Recovery procedure: spin up a new EC2 in us-west-2 from the IaC template (G-16), restore latest isolated backup (G-13), update DNS.
  2. Annual DR test.

### G-32 — No Third-Party Penetration Test
- **Policy:** 3715 OS-19 ("External penetration tests must be conducted annually or after any significant infrastructure or application change")
- **Audit risk:** MED
- **Effort:** L (cost = $5–15k)
- **Remediation:** Commission an external pentest (e.g. Cobalt.io, NCC Group, Bishop Fox) before first SOC 2 Type II attestation. Document scope, findings, remediation in `docs/pentest-<YYYY-MM>.md`.

### G-33 — No Privacy Notice / CCPA / SHIELD Compliance UI
- **Policy:** 3714 · REG-02, REG-03, REG-04
- **Audit risk:** MED (regulatory)
- **Effort:** S
- **Remediation:**
  1. Add `/privacy` page with:
     - Data collected, purpose, lawful basis (GDPR Art. 6), retention periods.
     - "Do Not Track" respected statement.
     - CCPA "Do Not Sell My Info" opt-out link (vestigial — we don't sell, but regulation requires it).
     - GDPR rights summary with links to `/api/user/export` and `/api/user/delete`.
  2. Add footer link visible on every page.

### G-34 — No Risk Register or Statement of Applicability
- **Policy:** 3716 Risk Mgmt · RM; 3712 Risk Assessment
- **Audit risk:** **HIGH** (ISO 27001 Major NC without one)
- **Effort:** M
- **Remediation:**
  1. Create `docs/RISK_REGISTER.md` with rows: `id | risk | impact (1-5) | likelihood (1-5) | owner | treatment (mitigate/accept/transfer/avoid) | status | last_reviewed`.
  2. Create `docs/STATEMENT_OF_APPLICABILITY.md` mapping the 93 Annex A controls of ISO 27001:2022 to InsightHub's coverage (Applicable/Not Applicable + justification).
  3. Seed the register with the gaps in this document as open risk items.
  4. Quarterly review by JD Gershan.

### G-35 — No Formal Security Awareness Training Record
- **Policy:** 3704 · ISMS-08
- **Audit risk:** LOW (single-employee scope)
- **Effort:** S
- **Remediation:** Track Jeff's own annual security training (KnowBe4, SANS, etc.) in HR; ensure any future hires complete training at onboarding and annually. Out of InsightHub code scope.

### G-36 — Secrets in `.env.local` Copied to Production by Scp
- **Policy:** 3701 Encryption · ENC-08; 3702 HH; already flagged in existing Red Team Report H-1
- **Audit risk:** MED
- **Effort:** M
- **Remediation:**
  1. Move production secrets to **AWS Secrets Manager** (`insighthub/prod/anthropic_api_key`, etc.).
  2. Load at systemd start via `EnvironmentFile` sourced from a wrapper that pulls from Secrets Manager.
  3. Remove secret copying from `deploy.sh`; only code is rsynced.
  4. Rotate all keys once migrated.
  5. Document rotation policy (90 days) in `docs/SECRETS_MANAGEMENT.md`.

### G-37 — No ISO 27001 Statement of Applicability
- **Policy:** 3712 Risk Treatment · covered by G-34
- **Audit risk:** HIGH (if pursuing ISO 27001 cert)
- **Effort:** M
- **Remediation:** See G-34.

### G-38 — Hardcoded Admin Email List
- **Policy:** 3691 AC-01 (auditability) + secure-by-design
- **Audit risk:** LOW
- **Effort:** S
- **Remediation:** Move `ADMIN_EMAILS` out of `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:17-20` into an `AdminRoleAssignment` table with `assignedBy` + `assignedAt` + audit log entry. This also closes the AC-07 control fully.

---

## Remediation-effort roll-up

| Effort | Count | Candidate items |
|---|---|---|
| **S** (≤1 day) | 14 | G-03, G-06, G-07, G-08, G-09, G-15, G-17, G-20, G-24, G-25, G-26, G-29, G-33, G-38 |
| **M** (1–5 days) | 17 | G-01, G-02, G-04, G-05, G-10, G-12, G-13, G-14, G-18, G-21, G-23, G-27, G-28, G-31, G-34, G-36, G-37 |
| **L** (>1 week) | 5 | G-11 (accept risk), G-16, G-19 (accept risk), G-22, G-30 (accept risk), G-32 (external vendor) |

## Suggested execution order

**Week 1 (Tier-1 MUST-DOs):**
G-01 (classification), G-02 (MFA), G-04 (asset register), G-13 (backup isolation), G-18 (incident runbook), G-34 (risk register + SoA).

**Weeks 2–4 (Tier-2):**
G-05 / G-06 / G-07 / G-08 (retention), G-09 (access reviews), G-12 (encryption verification), G-15 (patching SLAs), G-20 (audit log IP), G-22 (env separation), G-24 (SAST), G-26 (vendor register), G-27 (restore test), G-36 (secrets manager).

**Quarter 1 (Tier-3 + external):**
G-14 (CIS), G-16 (IaC), G-21 (alerting), G-23 (vuln scans), G-28 (FIM), G-31 (DR plan), G-32 (pentest), G-33 (privacy UI).

**Accepted risks (with compensating controls in register):**
G-11, G-19 (while solo), G-30.

---

## Audit-readiness score

With Tier-1 complete, InsightHub is **"defensible in a SOC 2 Type I scoping call"** — you can answer every question truthfully and point to an active remediation backlog for the rest.

With Tier-1 and Tier-2 complete, InsightHub is **"ready for a SOC 2 Type II observation window"** (90-day evidence collection).

Full Tier-1 through Tier-3 completion is roughly **aligned with ISO 27001:2022 certification-audit entry criteria**, conditional on G-32 (real third-party pentest) and G-19 (second reviewer on change management).
