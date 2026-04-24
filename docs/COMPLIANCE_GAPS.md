# InsightHub — USZoom Policy Compliance Gaps

> **Generated:** 2026-04-24
> **Source:** Mapping of `policies_USZoom_2026-04-24/*.pdf` against the current InsightHub codebase.
> **Companion:** `docs/COMPLIANCE_MATRIX.md` has the full control-by-control evidence.

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
- **Why it matters:** Policy 3698 is the foundation that almost every other policy depends on (encryption, retention, access control are all sensitivity-scaled). Without it, you cannot answer *"is this data Customer Confidential?"* in an audit.
- **Remediation:**
  1. Add a `classification` field (enum `CUSTOMER_CONFIDENTIAL` / `USZOOM_RESTRICTED` / `USZOOM_CONFIDENTIAL` / `PUBLIC`) to `Dashboard`, `GlossaryTerm`, and (when real data is connected) Snowflake source metadata.
  2. Add a `dataOwner` FK to `User` on the same models.
  3. Surface classification as a visible badge in the UI (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/components/` — dashboard cards and widget editor).
  4. Default classification to `USZOOM_RESTRICTED` for new objects; require an Admin to downgrade to `PUBLIC`.
  5. Write `docs/DATA_CLASSIFICATION_APPLIED.md` documenting how InsightHub's data maps to the 4-tier framework.

### G-02 — MFA Not Enforced at the Application Layer
- **Policy:** 3692 Authentication & Password · AUTH-02, AUTH-06; 3691 Access Control · AC-05
- **Audit risk:** HIGH
- **Effort:** M
- **Why it matters:** Policy 3692 says *"For systems storing customer PII and other regulated data, MFA must be enforced: users should not be able to disable the second factor and retain access."* We delegate to Google Workspace and assume MFA is on — an auditor wants proof.
- **Remediation:**
  1. In the Google OAuth callback (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:56`) read the `amr` (authentication methods references) claim and reject sign-ins missing MFA for privileged roles (`POWER_USER`, `ADMIN`).
  2. Add an `mfaVerifiedAt` column on `User` and surface it on the admin users page (`src/app/admin/users/`).
  3. For production access (SSH to EC2), require a hardware-backed MFA factor (YubiKey on macOS SSH agent + AWS Console enforced MFA).
  4. Document the chain in `docs/AUTHENTICATION.md`.

### G-03 — TLS Configuration Not Explicitly Pinned or Tested
- **Policy:** 3701 Encryption · ENC-01
- **Audit risk:** MED
- **Effort:** S
- **Remediation:**
  1. Pin `ssl_protocols TLSv1.2 TLSv1.3;` and a strong cipher list in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx.conf` (policy requires TLS ≥ 1.2 and AES-128+).
  2. Add an SSL Labs test to the ops runbook with an annual reminder in Asana.
  3. Capture the first test result in `docs/TLS_CONFIGURATION.md` as baseline evidence.

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
- **Remediation:**
  1. Extend `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/data/retention.ts` with `purgeInactiveUsers(days=1095)` (3y PII rule), `purgeOldAuditLogs(days=365)`, and `anonymizeCustomer(id)` (replaces email/name/address with `anon-<hash>`).
  2. Add a nightly cron (systemd timer) on EC2 that invokes a new `/api/admin/retention/scheduled` endpoint with a shared secret.
  3. Log each run to `AuditLog` with `action = 'retention.purge'`.
  4. Document retention schedules in `docs/DATA_RETENTION_APPLIED.md`.

### G-06 — Audit Log Retention / Upper Bound Not Enforced
- **Policy:** 3700 Retention · DR-04 (1 year) · 3715 OS-14 (≥ 90 days)
- **Audit risk:** LOW (missing a **maximum** bound), MED if logs contain PII
- **Effort:** S
- **Remediation:** Part of G-05. Keep ≥ 1 year, purge beyond 2 years unless flagged as evidence for an open incident.

### G-07 — Backup Retention Below Policy Minimum
- **Policy:** 4133 Backup · BK-07 (min 30 days)
- **Audit risk:** MED
- **Effort:** S
- **Status (2026-04-24):** ✅ Closed. `KEEP_DAYS` bumped from 14 to 30 in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh:29` during the G-13 delivery. Change lands on EC2 on next `rsync` via `./deploy.sh`. S3-side retention is managed by the bucket lifecycle policy (STANDARD_IA @ 90d, non-current versions expire @ 2y).

### G-08 — Deletion Events Not Consistently Audit-Logged
- **Policy:** 3699 Disposal · DD-05
- **Audit risk:** MED
- **Effort:** S
- **Remediation:** Verify `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/user/delete/route.ts` emits a `USER_ACCOUNT_DELETION` audit log *before* the cascade delete (so the log survives). If missing, add.

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
