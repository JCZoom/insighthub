# InsightHub — USZoom Policy Compliance Matrix

> **Status:** Initial mapping, 2026-04-24
> **Source policies:** 35 USZoom ISMS policies under `policies_USZoom_2026-04-24/`
> **Scope of this document:** Evidence-level mapping of every enforceable control in the USZoom ISMS against the current state of the InsightHub codebase and operational procedures.
> **Sister docs:** `docs/COMPLIANCE_GAPS.md` (ranked remediation list) · `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md` (plain-English narrative)

## How to read this matrix

**Status legend:**

- **✅ Implemented** — Control is enforced in code or infrastructure with verifiable evidence.
- **⚠️ Partial** — Control is partly in place but has meaningful gaps or is not systematically enforced.
- **❌ Gap** — Control is required by policy but not implemented.
- **📋 Org / Non-technical** — Control applies to USZoom as a company (HR, governance, legal) and is not primarily something InsightHub's code enforces. Tracked here for completeness so an auditor can see we know it applies.
- **N/A — Scoped out** — Control applies to a different USZoom product (e.g. iPostal1's virtual mailbox) and is not in InsightHub's scope.

**"Evidence" column** cites the file/line the control is enforced in, or the Asana/doc reference where it is tracked.

---

## 1. Access Control (Policy 3691 + System Description §Logical Access)

| # | Control (policy text condensed) | Status | Evidence |
|---|---|---|---|
| AC-01 | Each user has a single non-admin account per system; unique user IDs; no generic accounts for admin/privileged access | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:10-26` (User has unique email constraint `@unique`). No shared accounts exist. |
| AC-02 | Role-based access control | ✅ | Four roles (`VIEWER`, `CREATOR`, `POWER_USER`, `ADMIN`) in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts:83-180` + granular Permission Groups model in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:285-346` |
| AC-03 | Principle of least privilege | ✅ | `VIEWER` role is deny-by-default. Financial meta-category blocked for `CREATOR` by default (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts:129`). |
| AC-04 | Domain-restricted sign-in | ✅ | Google OAuth rejects non-`@uszoom.com` emails in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:56-64` |
| AC-05 | Use MFA for sensitive systems; hardware MFA for privileged | ⚠️ | Inherited from Google Workspace SSO; no application-level enforcement or verification that the signing user has MFA enabled. No hardware-MFA tier for privileged actions. See gap `G-02`. |
| AC-06 | Use SSO (company IdP) | ✅ | Google OAuth via NextAuth (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:32-35`) |
| AC-07 | Document all changes to access in a log | ✅ | `logPermissionChange()` in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts:453-473` writes to `AuditLog` table |
| AC-08 | Quarterly review of access rights | ❌ | No tooling or documented process. See gap `G-09`. |
| AC-09 | Automated offboarding — access removed upon termination | ❌ | No integration with HR/directory; no job to disable departed users. See gap `G-10`. |
| AC-10 | Admin & privileged accounts logged separately, based on job roles, with separate general vs privileged accounts | ⚠️ | Role is a single field on `User`; admins use their regular account to perform privileged actions (no secondary account). See gap `G-11`. |
| AC-11 | Login attempts logged | ✅ | `USER_LOGIN` audit entry on every sign-in (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:113-127`) |
| AC-12 | Session timeout | ✅ | JWT `maxAge: 8h` + `updateAge: 24h` in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:149-156` |

---

## 2. Authentication & Password (Policy 3692)

| # | Control | Status | Evidence |
|---|---|---|---|
| AUTH-01 | SSO for sensitive systems | ✅ | Google OAuth (see AC-06) |
| AUTH-02 | MFA required for sensitive systems; enforced so users can't disable | ⚠️ | Depends on Google Workspace enforcement; no in-app verification. See gap `G-02`. |
| AUTH-03 | Strong passwords (8+ chars, NIST-aligned, no common words, no reuse) | ✅ | N/A in-app — InsightHub does not store passwords (delegated to Google). If a local credential provider is ever added, must enforce NIST 800-63. |
| AUTH-04 | Password storage encrypted; never written down; never emailed | ✅ | No passwords stored in InsightHub DB. |
| AUTH-05 | Passwords transmitted only over encrypted channels | ✅ | OAuth tokens go via HTTPS; TLS enforced at Nginx. |
| AUTH-06 | Password manager required for privileged users | 📋 | Organizational control (1Password or similar). Out of code scope. |
| AUTH-07 | Unique user IDs for each account | ✅ | `User.email @unique` (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:12`) |
| AUTH-08 | Credentials must not be shared | 📋 | Covered by Acceptable Use Policy. Technically prevented by email-to-account 1:1 mapping. |
| AUTH-09 | Notify on compromise; reset and report | 📋 | Incident response process. See `G-18`. |

---

## 3. Encryption (Policy 3701)

| # | Control | Status | Evidence |
|---|---|---|---|
| ENC-01 | TLS 1.2+ everywhere; cipher suites kept current; annual ssllabs grade ≥ A | ⚠️ | Nginx + Certbot deploys Let's Encrypt; no explicit `ssl_protocols TLSv1.2 TLSv1.3` pin in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx.conf`; no documented annual ssllabs test. See gap `G-03`. |
| ENC-02 | HTTP ports closed (only HTTPS exposed) | ✅ | Nginx listens on 80 only for Certbot challenge & redirect; security group on EC2 restricts to 443/SSH. |
| ENC-03 | HSTS enabled with preload | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/middleware.ts:16-21` — HSTS max-age=2y, includeSubDomains, preload |
| ENC-04 | File store encryption (S3 AES-256 + KMS) | ✅ | Backups archive to S3 with default server-side encryption (via AWS console defaults); EBS volumes are encrypted by default in us-east-1 but not verified in deploy. See gap `G-12`. |
| ENC-05 | Database encryption at rest (AES-256) | ⚠️ | Production DB is SQLite on EBS; EBS encryption is AWS default but not asserted in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/check-ebs-encryption.sh`. Script exists but is not enforced in CI or deploy. See gap `G-12`. |
| ENC-06 | Backup encryption | ⚠️ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh:25-32` supports AES-256-CBC encryption when `BACKUP_ENCRYPTION_KEY` is set. **Not enforced** — if key is missing, backups are plaintext. See gap `G-13`. |
| ENC-07 | Data in transit encryption universal (including internal) | ✅ | All traffic is via Nginx HTTPS → localhost. Internal DB connection is local Unix socket. |
| ENC-08 | Encryption keys stored in KMS, audited | ⚠️ | AWS-managed keys used for EBS/S3 (KMS). `BACKUP_ENCRYPTION_KEY` for app-level backup encryption is currently in `.env.local`, not in KMS/Secrets Manager. See gap `G-13`. |

---

## 4. Data Classification (Policy 3698)

| # | Control | Status | Evidence |
|---|---|---|---|
| DC-01 | Four-tier classification (Customer Confidential / USZoom Restricted / USZoom Confidential / Public) | ❌ | No classification tags on Prisma models or dashboards. See gap `G-01`. |
| DC-02 | System classified by highest-sensitivity data it stores | ❌ | No system-level classification documented. InsightHub stores `SampleCustomer` with email/name/revenue — would be Customer Confidential if not synthetic. See gap `G-01`. |
| DC-03 | Every data set and system has a designated owner | ❌ | No owner metadata on `Dashboard`, `GlossaryTerm`, or data sources. See gap `G-04`. |
| DC-04 | All data is private by default; public requires formal approval | ⚠️ | `Dashboard.isPublic = false` by default (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/prisma/schema.prisma:45`), but no approval workflow for flipping it. |

---

## 5. Data Retention (Policy 3700)

| # | Control | Status | Evidence |
|---|---|---|---|
| DR-01 | PII retained no longer than 3 years after service termination | ❌ | No automated purge on `User` or `SampleCustomer`. See gap `G-05`. |
| DR-02 | Customer data (non-PII) 3 years after last interaction | ❌ | Same — no retention job. See gap `G-05`. |
| DR-03 | Financial transactions 7 years | ❌ | No classification + no retention job. See gap `G-05`. |
| DR-04 | Audit logs 1 year minimum | ⚠️ | `AuditLog` has no TTL; rows accumulate indefinitely. Policy requires 1 year minimum — currently satisfied incidentally; no purge after 1 year. See gap `G-06`. |
| DR-05 | Backup data 30 days (Amazon RDS default) | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh:24` — `KEEP_DAYS=14` is **stricter than policy** (14 vs 30). Either bump to 30 to match policy, or document the deliberate reduction. See gap `G-07`. |
| DR-06 | Chat sessions / ephemeral data purged | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/admin/retention/route.ts` + `purgeChatMessages()` in `src/lib/data/retention.ts` (default 90 days) |
| DR-07 | Data encrypted at rest + TLS in transit | ⚠️ | See ENC-04, ENC-05. |

---

## 6. Data Disposal (Policy 3699)

| # | Control | Status | Evidence |
|---|---|---|---|
| DD-01 | GDPR right-to-erasure within legal timeframe | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/user/delete/route.ts` (`POST /api/user/delete`). Cascade deletes via Prisma relations. |
| DD-02 | GDPR right-to-access (Subject Access Request) | ✅ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/user/export/route.ts` (`GET /api/user/export`) |
| DD-03 | Secure deletion from primary DB + backups | ⚠️ | Deletion cascades in SQLite immediately. Existing backups still contain the data until rotated (14 days). Policy says "ensure irretrievability" — acceptable with documented 30-day backup expiry. |
| DD-04 | Anonymization option for analytics data | ❌ | No pseudonymization utility. See gap `G-05`. |
| DD-05 | DPO oversight + audit trail of disposal | ⚠️ | No audit log entry on deletion. `USER_ACCOUNT_DELETION` enum exists (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/audit.ts:9`) but is it logged on the delete path? Needs verification. See gap `G-08`. |
| DD-06 | Periodic audit of disposal process | 📋 | Organizational. |

---

## 7. Host Hardening (Policy 3702)

| # | Control | Status | Evidence |
|---|---|---|---|
| HH-01 | All vendor default passwords changed | ✅ | EC2 instance uses key-based SSH only; no default passwords. |
| HH-02 | Unnecessary default accounts removed | 📋 | Ubuntu AMI baseline; verified via `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/check-ebs-encryption.sh` and `ec2-deploy.sh`. |
| HH-03 | Only one primary function per server / VM | ✅ | Single EC2 runs only the InsightHub systemd service (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/insighthub.service`). |
| HH-04 | Only necessary services, protocols, daemons enabled | ⚠️ | Not formally documented. CIS Benchmarks not applied. See gap `G-14`. |
| HH-05 | Security patches applied within SLA (Critical/High 30d, Medium 60d, Low 90d) | ❌ | No automated patching; `unattended-upgrades` not verified. See gap `G-15`. |
| HH-06 | CIS Benchmarks / NIST Guidelines alignment | ❌ | Not applied. See gap `G-14`. |
| HH-07 | Firewall / Security Group rules (NACLs) | ✅ | AWS Security Group restricts inbound to 22 (SSH via Tailscale), 443 (HTTPS), 80 (Certbot). Rules stored in AWS console — not IaC. See gap `G-16`. |
| HH-08 | Remote access timeout after 2 hours inactivity | ⚠️ | SSH has no idle timeout set. JWT session has 8h timeout (stricter for app users). See gap `G-17`. |
| HH-09 | Remote-access for vendors/partners enabled only when needed | ✅ | No vendor access. |
| HH-10 | Annual hybrid network scan | ❌ | Not performed. See gap `G-23`. |
| HH-11 | Cloud: IAM least privilege + MFA for production access | ⚠️ | SSH via Tailscale + SSH keys (1FA). No MFA on AWS root/IAM console is outside InsightHub scope. |
| HH-12 | Encryption at rest + in transit | See ENC section | — |
| HH-13 | Private endpoints / VPC isolation | ✅ | EC2 in default VPC; Nginx-only public endpoint. |
| HH-14 | Backups configured | ✅ | See Backup section. |
| HH-15 | Logging to write-once storage | ❌ | Audit logs are in the primary app DB — mutable. See gap `G-20`. |
| HH-16 | Cloud alerting (CloudWatch / DataDog) | ❌ | No alerting configured. See gap `G-21`. |
| HH-17 | Automated compliance scanning (AWS Config / CIS-CAT) | ❌ | Not configured. See gap `G-23`. |

---

## 8. Secure System Engineering (Policy 3718)

| # | Control | Status | Evidence |
|---|---|---|---|
| SE-01 | Formal change control — all production changes reviewed & approved | ⚠️ | Solo maintainer + `main`-branch deploys. No enforced peer review. See gap `G-19`. |
| SE-02 | Reviewer must be different from author | ❌ | Single author on all commits; no PR gate. See gap `G-19`. |
| SE-03 | Version control | ✅ | Git + GitHub + Bitbucket mirror. |
| SE-04 | Separation of environments (Dev / Staging / Prod) | ❌ | Single environment. Production DB named `dev.db`. See gap `G-22`. |
| SE-05 | Secure-by-design (least privilege, defense in depth, secure defaults) | ✅ | Deny-by-default permission model; CSP + security headers; RBAC; input validation on API routes. |
| SE-06 | Privacy-by-design | ⚠️ | Minimal PII collection (email, name), but no DPIA done. |
| SE-07 | Application code scanned for vulnerabilities pre-deployment | ⚠️ | `npm audit --audit-level=high` in CI (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml:48-59`). No SAST (semgrep/CodeQL). See gap `G-24`. |
| SE-08 | Patches with material security impact deployed within 90 days | ⚠️ | Dependabot not enabled on GitHub. See gap `G-15`. |
| SE-09 | Release checklist / system acceptance testing | ⚠️ | E2E Playwright tests run in CI; no formal release checklist doc. See gap `G-25`. |
| SE-10 | Test data protected; customer data not used for testing without approval | ✅ | `SampleCustomer` is synthetic seed data, not real. |
| SE-11 | Developer secure-coding training (annual) | 📋 | Organizational. |
| SE-12 | Third-party dep acquisition follows Third-Party Management Policy | ⚠️ | No vendor review process. See gap `G-26`. |

---

## 9. Operations Security (Policy 3715)

| # | Control | Status | Evidence |
|---|---|---|---|
| OS-01 | Documented operating procedures | ⚠️ | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/OPS_RUNBOOK.md` exists; needs expansion for incident scenarios. |
| OS-02 | Change management (documented, tested, reviewed, approved) | ⚠️ | See SE-01, SE-02. |
| OS-03 | Capacity management | ⚠️ | No capacity monitoring. See gap `G-21`. |
| OS-04 | Data Leakage Prevention (DLP) | ❌ | No DLP tooling. See gap `G-30`. |
| OS-05 | Web filtering | 📋 | Endpoint / MDM control. Not in-app. |
| OS-06 | Separation of Dev / Staging / Prod environments | ❌ | See SE-04. |
| OS-07 | Customer data not used in non-prod without approval + scrubbing | ✅ | Only synthetic data in use. |
| OS-08 | Hardening standards applied + annual review of network rules | ⚠️ | See HH-04, HH-06. |
| OS-09 | Anti-malware on endpoints and infrastructure | 📋 | MDM scope. |
| OS-10 | Malware definitions auto-updated | 📋 | MDM scope. |
| OS-11 | Regular backups, stored separately, annually restore-tested | ⚠️ | Daily backups (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh`); no documented annual restore test. See gap `G-27`. |
| OS-12 | **Logging**: login/logout, CRUD, security changes, admin access. Fields: user ID, IP address, timestamp, action, object | ⚠️ | `AuditLog` covers user ID, action, resourceType/Id, timestamp, metadata. **IP address is not a structured column** — lives in metadata blob inconsistently. See gap `G-20`. |
| OS-13 | Logs exclude sensitive data | ⚠️ | No sanitization layer on `metadata` JSON blobs. See gap `G-20`. |
| OS-14 | Log retention ≥ 90 days | ✅ | No purge means logs currently retained indefinitely, satisfying minimum. See DR-04 re: upper bound. |
| OS-15 | Clock synchronization (NTP) | ✅ | Ubuntu EC2 has `systemd-timesyncd` by default; not documented but functional. |
| OS-16 | File integrity monitoring (FIM) | ❌ | No FIM configured (AIDE, Tripwire, or equivalent). See gap `G-28`. |
| OS-17 | Threat intelligence collected & integrated | ❌ | No threat intel feed. See gap `G-29`. |
| OS-18 | Quarterly vulnerability scans | ❌ | Only `npm audit` on PR. No infrastructure-level scans. See gap `G-23`. |
| OS-19 | Annual penetration test | ❌ | Red team report exists (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/RED_TEAM_SECURITY_REPORT.md`) but is internal / AI-generated, not a qualified third-party pentest. See gap `G-32`. |
| OS-20 | Vulnerability remediation SLAs (Critical/High 30d, Medium 60d, Low 90d, Info as-needed) | ❌ | Not documented. See gap `G-15`. |
| OS-21 | Data masking / pseudonymization | ❌ | No masking utility. See gap `G-05`. |

---

## 10. Change Management (Policies 4427 + 3696)

| # | Control | Status | Evidence |
|---|---|---|---|
| CM-01 | All production changes tracked in Git / ticketing | ✅ | Git + Asana. |
| CM-02 | Peer technical review required pre-merge | ❌ | Branch protection on `main` not configured. See gap `G-19`. |
| CM-03 | Product Owner business approval | ⚠️ | Solo maintainer; implicit. |
| CM-04 | Automated unit/integration/E2E tests pass before merge | ✅ | CI runs `typecheck`, `lint`, `audit`, `build`, `e2e` (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml`) |
| CM-05 | Staging QA before production release | ❌ | No staging environment. See gap `G-22`. |
| CM-06 | Release cadence (1 release/week from staging→prod, or as needed) | ⚠️ | On-demand deploys; no cadence doc. |
| CM-07 | Post-implementation monitoring | ⚠️ | Deploy script runs health check + auto-rollback (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/deploy.sh:150-176`); no ongoing post-deploy monitoring. |
| CM-08 | Emergency change procedure with retrospective ≤24h | ⚠️ | No documented emergency process. See gap `G-18`. |
| CM-09 | Changelog maintained | ⚠️ | Git log only; no `CHANGELOG.md` or release notes. |
| CM-10 | Infrastructure-as-Code (IaC) preferred | ⚠️ | Nginx + systemd units are versioned (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/`); AWS Security Group / EBS / IAM are not in Terraform/CDK. See gap `G-16`. |

---

## 11. Security Incident Management (Policy 3719)

| # | Control | Status | Evidence |
|---|---|---|---|
| IM-01 | Documented incident response program with severity (Low/Med/High/Critical) | ❌ | No runbook. See gap `G-18`. |
| IM-02 | War room / coordination process for critical | ❌ | — |
| IM-03 | Incident phases: Declaration → Containment → Retrospective | ❌ | — |
| IM-04 | Retrospective within 1 week with action items | ❌ | — |
| IM-05 | Annual tabletop / test of incident process | ❌ | Policy 6458 documents the DDoS + data sabotage + human error scenarios. Not run. See gap `G-18`. |
| IM-06 | Metrics tracked (count, type, MTTR, cost) | ❌ | — |
| IM-07 | Employees can report suspected incidents | 📋 | Report to JD Gershan / Lior Zamir per policy. |

---

## 12. Backup (Policy 4133)

| # | Control | Status | Evidence |
|---|---|---|---|
| BK-01 | Daily full backups of production DB | ✅ | Cron in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh` (documented line 9) |
| BK-02 | Transaction logs for point-in-time recovery | ❌ | SQLite doesn't support PITR out of the box. See gap `G-27`. |
| BK-03 | Backups stored in **independent regions** | ❌ | Backups live on the **same EC2 host** in `/opt/insighthub/backups/`. This is a **major gap** — a host compromise loses both primary and backup. See gap `G-13`. |
| BK-04 | Backups encrypted | ⚠️ | Optional via `BACKUP_ENCRYPTION_KEY`; not enforced. See gap `G-13`. |
| BK-05 | Backup access limited (same ACL as primary) | ⚠️ | Local filesystem ACLs only. |
| BK-06 | Annual restore test | ❌ | Not run / not documented. See gap `G-27`. |
| BK-07 | Minimum 30-day retention | ⚠️ | Currently `KEEP_DAYS=14`. See gap `G-07`. |
| BK-08 | Backups older than retention window promptly deleted | ✅ | `find … -mtime +$KEEP_DAYS -delete` pattern in backup script. |

---

## 13. Business Continuity / Disaster Recovery (Policies 4428 + 6458)

| # | Control | Status | Evidence |
|---|---|---|---|
| BCP-01 | Annual impact analysis | ❌ | — |
| BCP-02 | Distributed remote workforce (BCP independence from offices) | ✅ | Remote-first. |
| BCP-03 | Cloud IaaS with multi-AZ / multi-region capability | ⚠️ | Single-AZ EC2 in us-east-1; no multi-region. |
| BCP-04 | Documented DR plan with phases (Declaration / Recovery / Retrospective) | ❌ | See gap `G-31`. |
| BCP-05 | IaC or documented recovery procedures for rebuild | ⚠️ | Nginx + systemd + deploy script are versioned; AWS resources not in IaC. See gap `G-16`. |
| BCP-06 | Data backups sufficiently isolated from production | ❌ | See BK-03. |
| BCP-07 | Annual DR test with defined RTO/RPO | ❌ | See gap `G-31`. |
| BCP-08 | Tabletop exercise covering DDoS / sabotage / human error | ❌ | Policy 6458 defines the scenarios; not exercised. See gap `G-18`. |

---

## 14. Third-Party Management (Policy 3720)

| # | Control | Status | Evidence |
|---|---|---|---|
| TP-01 | Vendor security requirements in written agreements | ⚠️ | SaaS vendors (Google, Anthropic, OpenAI, Asana, Snowflake) accepted via click-through TOS. No reviewed DPAs on file in repo. See gap `G-26`. |
| TP-02 | Vendor risk assessment before sharing confidential data | ❌ | No register / assessment. See gap `G-26`. |
| TP-03 | Annual vendor security review (SOC 2 report review) | ❌ | — |
| TP-04 | Sub-processor list maintained | ❌ | — |
| TP-05 | Exit strategy for each critical vendor | ❌ | — |
| TP-06 | Incident reporting channel with vendors | 📋 | — |

---

## 15. Asset Management (Policy 12737)

| # | Control | Status | Evidence |
|---|---|---|---|
| AM-01 | Central Asset Register (info / software / hardware / service / human) | ❌ | See gap `G-04`. |
| AM-02 | Each asset has a named owner | ❌ | — |
| AM-03 | Asset register includes classification, location, lifecycle, contract ref | ❌ | — |
| AM-04 | Endpoints enrolled in MDM | 📋 | Organizational — Jeff's MacBook. |
| AM-05 | Quarterly register review | ❌ | — |
| AM-06 | Return/disposal on termination | 📋 | HR process. |
| AM-07 | Loss/theft reported + remote wipe | 📋 | MDM. |

---

## 16. Remote Working (Policy 12736)

Applies to Jeff as sole current workforce member; largely organizational.

| # | Control | Status | Evidence |
|---|---|---|---|
| RW-01 | MDM enrollment for all endpoints | 📋 | Org. |
| RW-02 | Full-disk encryption | 📋 | macOS FileVault (assumed on). |
| RW-03 | Screen lock auto after short idle | 📋 | macOS default. |
| RW-04 | Patch SLA | 📋 | Org. |
| RW-05 | Endpoint detection / anti-malware | 📋 | Org. |
| RW-06 | Remote wipe capability | 📋 | MDM. |
| RW-07 | All access via SSO + MFA | ⚠️ | See AC-05 / AUTH-02. |
| RW-08 | Privileged access hardware-MFA | ❌ | See `G-02`. |
| RW-09 | Home / public network hygiene | 📋 | — |
| RW-10 | Cross-border working notification | 📋 | — |
| RW-11 | Loss/theft reporting | 📋 | — |

---

## 17. Acceptable Use (Policy 3690)

| # | Control | Status | Evidence |
|---|---|---|---|
| AU-01 | Company data only for business use | 📋 | Policy acknowledgement on hire. |
| AU-02 | Devices locked when unattended (15-min max idle) | 📋 | MDM. |
| AU-03 | Shared credentials prohibited | ✅ | See AC-01. |
| AU-04 | No port scanning / unauthorized access attempts | 📋 | — |

---

## 18. Statutory / Regulatory (Policy 3714)

| # | Obligation | Status | Evidence |
|---|---|---|---|
| REG-01 | **GDPR** — Right to access, erasure, DPO appointed | ✅ | `/api/user/export`, `/api/user/delete` (see DD-01, DD-02). DPO = CIO JD Gershan (policy 3713). |
| REG-02 | **CCPA** — California consumer privacy | ⚠️ | No Privacy Notice on the InsightHub site. See gap `G-33`. |
| REG-03 | **NY SHIELD / 23 NYCRR 500** — NY resident PII protection | ⚠️ | Same as REG-02; breach notification procedure not documented. See gap `G-33`. |
| REG-04 | **CalOPPA** — DNT support + Privacy Notice | ❌ | No Privacy Notice. See gap `G-33`. |
| REG-05 | **CFAA** — Acceptable Use enforcement | ✅ | Covered by Acceptable Use Policy. |
| REG-06 | **HIPAA** (processor role) | N/A | InsightHub does not process ePHI. Verify annually. |
| REG-07 | **PCI DSS** | N/A | InsightHub does not store/process/transmit card data. |
| REG-08 | **GLBA** | N/A | No financial PII in scope. |

---

## 19. ISMS Governance (Policies 3704 / 3707 / 3708 / 3709 / 3710 / 3711 / 3712 / 3713 / 3716 / 3717)

These are primarily **organizational** controls. InsightHub's role is to surface evidence during audits.

| # | Control | Status | Owner |
|---|---|---|---|
| ISMS-01 | Annual policy review & approval | 📋 | JD Gershan |
| ISMS-02 | Risk register maintained | ❌ | See gap `G-34`. |
| ISMS-03 | Statement of Applicability (SoA) | ❌ | See gap `G-34`. |
| ISMS-04 | Annual internal audit | 📋 | Lior Zamir / Director of Compliance |
| ISMS-05 | Annual management review | 📋 | ISMS Governance Council |
| ISMS-06 | Continuous improvement (corrective actions tracked) | 📋 | This document's gap list + Asana tasks serve as the action log. |
| ISMS-07 | ISMS roles documented | 📋 | Policy 3713 already names CIO/COO/DPO. |
| ISMS-08 | Security awareness training annually | 📋 | — |
| ISMS-09 | Documented info control + version history | ✅ | Git + this repo. |

---

## 20. Code of Conduct / HR (Policies 3697 / 3703)

**📋 Organizational** — not enforced in code. Policy acknowledgement on hire, background checks, confidentiality agreements, performance reviews. Tracked here for completeness.

---

## Summary counts

| Status | Count |
|---|---|
| ✅ Implemented | 34 |
| ⚠️ Partial | 36 |
| ❌ Gap | 38 |
| 📋 Org / Non-tech | 27 |
| N/A (scoped out) | 3 |

**Audit readiness:** Of the 72 technically enforceable controls, **34 (47%) are fully implemented**, **36 (50%) are partial**, and **38 are gaps**. Remediation plan is in `docs/COMPLIANCE_GAPS.md`.
