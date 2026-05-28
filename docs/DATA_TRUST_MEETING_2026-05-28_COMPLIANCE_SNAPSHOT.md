# InsightHub — Open Compliance Items

> **Audience:** Head of Analytics & Data Warehouse — data-trust review for low-sensitivity test-data release.
> **Date:** 2026-05-28
> **Status as of:** 2026-05-25 internal audit (companion docs: `STATEMENT_OF_APPLICABILITY.md` v2.0, `COMPLIANCE_MATRIX.md`, `COMPLIANCE_GAPS.md`).
> **Owner:** Jeff Coy (technical) · JD Gershan (CISO/DPO).

---

> *Every USZoom ISMS policy and every ISO 27001:2022 Annex A control not listed below is implemented and evidenced in the InsightHub repo. Items below are the current open, partial, or accepted-with-compensating-controls.*

---

## Progress at a glance

### ISO 27001:2022 Annex A — 93 controls

| Status | Count | % of applicable |
|---|---|---|
| ✅ **Implemented** (in-code or inherited from AWS SOC 2) | **53** | **58%** |
| ⚠️ Partial — gap tracked, remediation in flight | 24 | 26% |
| 📋 Organizational — covered by USZoom umbrella policy | 8 | 9% |
| ❌ Planned — applicable, not yet started | 7 | 8% |
| — Excluded *(A.8.30 Outsourced development — all engineering in-house)* | 1 | n/a |

**93% of applicable controls are either fully implemented or actively in flight** (✅ + ⚠️ + 📋 = 85 of 92 applicable). Only 7 controls are still in the "planned, not started" column.

### USZoom ISMS — gap remediation backlog

- **38 total gaps** identified in the 2026-04-24 internal audit (`G-01` through `G-38`).
- **13 closed in the last 35 days** (April 24 → May 25): G-01, G-02, G-03, G-04, G-05, G-06, G-07, G-08, G-12, G-18, G-20, G-34, G-37 — including all 6 must-do Tier-1 gaps in code.
- **2 partial / closed-in-code** awaiting deploy or final infra step: G-13 (cross-region backups — AWS bootstrap pending), G-15 (patching — Dependabot live, SLA doc pending).
- **3 accepted-as-risk** with documented compensating controls (G-11, G-19, G-30) — standard practice for solo-developer / small-org scope.
- **1 out of code scope** (G-35 awareness training — HR-tracked).
- **~19 remaining** in the open / planned column, all with assigned owners and target windows below.

### Tier-1 (audit-blocking) closures since April

All 6 of the "must-do-before-any-external-review" gaps are closed in code:

| Gap | What it was | Closed |
|---|---|---|
| G-01 | Data Classification framework on every dashboard + glossary term | 2026-04-25 |
| G-02 | App-layer MFA enforcement (not just relying on Google MFA) | 2026-05-19 |
| G-04 | Asset Register | 2026-04-24 |
| G-13 | Cross-region isolated backups | code + runbook done; AWS bootstrap pending |
| G-18 | Incident Response Runbook (with one lived incident retro) | 2026-04-24 |
| G-34 | Risk Register + Statement of Applicability | 2026-04-24 |

---

## Open against the USZoom ISMS

Grouped by policy area.

**Status legend:** 🟡 partial · 🔴 open · 🔵 accepted risk · ⚙️ closed-in-code, deploy-pending.

### Backup & business continuity (Policy 4133, 4428)

- 🟡 **G-13 — Cross-region isolated backups.** Code + runbook shipped (encrypted S3, separate writer/reader IAM, MFA-delete). AWS bootstrap pending operator execution. *Owner: Jeff. Target: pre-elevation.*
- 🔴 **G-27 — Annual restore test.** Procedure designed, not yet automated. *Target: Q3 2026.*
- 🔴 **G-31 — Documented DR plan (RTO/RPO).** Daily backups in place; formal RTO 4h / RPO 24h plan not yet written. *Target: Q3 2026.*

### Access management (Policy 3691)

- 🔴 **G-09 — Quarterly access reviews.** Tooling (CSV export endpoint) not yet built. *Target: Q3 2026.*
- 🔴 **G-10 — Automated offboarding.** Google Workspace disablement breaks login today, but stale `User` rows persist. *Target: Q3 2026.*
- 🔵 **G-11 — Separate privileged accounts.** Accepted while solo-developer; compensating controls = MFA + 8h JWT TTL + audit log.

### Secure engineering & change management (Policy 3718)

- 🔵 **G-19 — Branch protection / second-reviewer.** Accepted while solo-developer; compensating = CI gates + GitHub-environment approval + immutable workflow log pinned to `github.sha`.
- 🔴 **G-24 — SAST in CI.** `npm audit` runs today; Semgrep/CodeQL not yet wired. *Target: Q3 2026.*
- 🔴 **G-25 — Formal release checklist.** Tribal knowledge today; doc pending. *Target: 30 days.*

### Operations security (Policy 3715, 3702)

- 🟡 **G-15 — Patching SLA.** Dependabot config shipped 2026-05-25; Ubuntu `unattended-upgrades` + SLA doc still pending. *Target: 30 days.*
- 🔴 **G-14 — CIS Level-1 host hardening.** Baseline scan not yet run on the EC2 AMI. *Target: Q3 2026.*
- 🔴 **G-21 — Cloud alerting / capacity monitoring.** No CloudWatch alarms yet. *Target: Q3 2026.*
- 🔴 **G-22 — Dev/staging/prod separation.** Currently single environment; production DB still named `dev.db`. *Target: Q3 2026 — relevant prerequisite for accepting more sensitive data classes.*
- 🔴 **G-23 — Quarterly vuln scans.** AWS Inspector / nmap scans not yet scheduled. *Target: Q3 2026.*
- 🔴 **G-28 — File integrity monitoring.** AIDE/Wazuh not yet deployed. *Target: Q4 2026.*
- 🔴 **G-29 — Threat intel feeds.** Informal (GH advisories, CISA KEV); not yet documented intake. *Target: 30 days.*

### Infrastructure-as-code (Policy 4427)

- 🔴 **G-16 — Terraform/CDK for AWS resources.** Manual today; documented inventory only. *Target: Q4 2026.*

### Third-party risk (Policy 3720)

- 🔴 **G-26 — Vendor register + DPA reviews.** Vendors known (Anthropic, OpenAI, Google, AWS, Asana, Snowflake, GitHub) but not yet in a register with annual SOC report review. *Target: 30 days.*
- 🔴 **G-32 — Third-party pentest.** Pre-SOC-2-Type-II requirement; not yet commissioned. *Target: before any external attestation.*

### Secrets & encryption (Policy 3701)

- 🔴 **G-36 — AWS Secrets Manager migration.** Production secrets currently in `.env.local` (mode 600) on EC2. Working but not best-practice. *Target: Q3 2026.*

### Privacy & regulatory (Policy 3714)

- 🔴 **G-33 — Privacy notice UI / CCPA opt-out link.** GDPR endpoints exist (`/api/user/export`, `/api/user/delete`); user-facing notice page pending. *Target: 30 days.*

### Awareness & people (Policy 3704, 12736)

- 🟡 **G-35 — Formal security-awareness training record.** Personal consumption today; HR-tracked record pending. *Out of code scope.*
- 🟡 **A.7.9 — MacBook MDM enrollment.** FileVault on; centralized MDM not enrolled. *Out of code scope.*

### Auth detail (Policy 3691)

- 🔴 **G-38 — DB-backed admin role assignments.** `ADMIN_EMAILS` is hardcoded in source today (auditable via Git, but not via the AuditLog table). *Target: 30 days.*

---

## Open against ISO 27001:2022 Annex A

Same items, viewed by Annex A theme. Counts shown below are out of 92 applicable controls (1 excluded: A.8.30 Outsourced development — not applicable, all engineering in-house).

**Snapshot:** ✅ 53 implemented · ⚠️ 24 partial · ❌ 7 planned · 📋 8 organizational (covered by USZoom umbrella policy).

### A.5 Organizational (9 partial, 4 planned)

- ⚠️ **A.5.3 Segregation of duties** — solo-dev compensating controls (→ G-11, G-19)
- ⚠️ **A.5.5 Contact with authorities** — DPO designated; no written authority-contact list
- ⚠️ **A.5.6 / ❌ A.5.7 Threat intelligence** *(2022-new)* — informal; formalization → G-29
- ❌ **A.5.19 / A.5.20 / A.5.22 Supplier relationships** — vendor register pending → G-26
- ⚠️ **A.5.21 ICT supply chain** — `npm audit` + Dependabot partial; SAST → G-24
- ⚠️ **A.5.18 Access rights** — assignment ✅, review/offboarding → G-09, G-10
- ⚠️ **A.5.29 Information security during disruption** + ⚠️ **A.5.30** *(2022-new)* **ICT readiness for BC** — daily backups ✅; DR plan → G-31; restore test → G-27
- ⚠️ **A.5.35 Independent review** — internal red-team exists; external pentest → G-32
- ⚠️ **A.5.37 Documented operating procedures** — partial; release checklist → G-25

### A.6 People (3 partial)

- ⚠️ **A.6.3 Awareness/training record** → G-35
- ⚠️ **A.6.5 Responsibilities after termination** → G-10

### A.7 Physical (1 partial)

- ⚠️ **A.7.9 Assets off-premises** — MacBook MDM gap *(13 of 14 inherited from AWS SOC 2)*

### A.8 Technological (11 partial, 3 planned)

- ⚠️ **A.8.2 Privileged access rights** — hardcoded admin list → G-38
- ❌ **A.8.6 Capacity management** → G-21
- ⚠️ **A.8.8 Vulnerability management** — Dependabot ✅, SLA + infra scans → G-15, G-23
- ⚠️ **A.8.9** *(2022-new)* **Configuration management** — IaC → G-16
- ⚠️ **A.8.11** *(2022-new)* **Data masking** — partial; full Snowflake-tier masking pending Phase 3
- ⚠️ **A.8.12** *(2022-new)* **DLP** — accepted risk → G-30
- ⚠️ **A.8.14 Redundancy** — single-AZ today → G-31
- ❌ **A.8.16** *(2022-new)* **Monitoring activities** → G-21
- ⚠️ **A.8.19 Software installation on operational systems** — `unattended-upgrades` → G-15
- ⚠️ **A.8.22** *(2022-new)* **Segregation of networks** — single VPC/subnet → G-16
- ⚠️ **A.8.25 / A.8.29 SDLC + security testing** — SAST → G-24, pentest → G-32
- ❌ **A.8.31 Separation of dev/test/prod** → G-22

---

## Scope of today's ask

Because the test-run data is non-PII / low-sensitivity, the gaps that matter most for **this** release are:

- ✅ **Encryption at rest + in transit** — closed (G-03 TLS 1.2+ pinned with HSTS · G-12 EBS encryption verified at every deploy · AWS KMS for all volumes and backups)
- ✅ **Access control + audit trail** — closed (4-role RBAC + Permission Groups + MetricAccessRule · `AuditLog` with structured IP, user-agent, recursive metadata sanitization)
- ✅ **Classification + retention** — closed (G-01 4-tier classification on every dashboard + glossary term · G-05 automated bounded retention with dry-run preview)
- ✅ **MFA enforcement** — closed (G-02 app-layer AMR check enforced for ADMIN/POWER_USER, persisted timestamp, admin-UI surface)

The open items above are real, but **none of them gate the test-run data class**. The gaps that would gate higher-sensitivity data later (PII, financials) are G-22 (env separation), G-26 (vendor register), G-32 (third-party pentest), G-36 (Secrets Manager) — and those have target dates already.

---

## Recently closed (since 2026-04-24)

For context — the gap list is shrinking, not stable:

| Gap | Title | Closed |
|---|---|---|
| G-01 | Data Classification framework | 2026-04-25 |
| G-02 | App-layer MFA enforcement | 2026-05-19 |
| G-03 | TLS hardening + HSTS | 2026-05-19 |
| G-04 | Asset Register | 2026-04-24 |
| G-05 | Automated retention / disposal | 2026-05-19 |
| G-06 | Audit log retention upper bound | 2026-05-19 |
| G-07 | Backup retention ≥ 30 days | 2026-04-24 |
| G-08 | Deletion-event audit logging | 2026-05-19 |
| G-12 | EBS encryption verified in deploy pipeline | 2026-05-25 |
| G-18 | Incident Response Runbook | 2026-04-24 |
| G-20 | Audit log structured IP + sanitization | 2026-05-25 |
| G-34 | Risk Register | 2026-04-24 |
| G-37 | Statement of Applicability (ISO 27001:2022) | 2026-04-24 |

---

## Companion documents

If deeper detail is needed during or after the meeting:

- `docs/COMPLIANCE_MATRIX.md` — 138 controls across 20 ISMS policy sections, mapped to file:line evidence.
- `docs/STATEMENT_OF_APPLICABILITY.md` — all 93 ISO 27001:2022 Annex A controls + Clauses 4–10, with risk-treatment column.
- `docs/COMPLIANCE_GAPS.md` — full per-gap remediation detail (this doc is the executive distillation).
- `docs/RISK_REGISTER.md` — 40+ scored risk items.
- `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md` — plain-English narrative for stakeholder conversations.
- `docs/INCIDENT_RESPONSE_RUNBOOK.md` — IR phases + lived incident retro (`INC-20260519-001`).
- `docs/COMPLIANCE_CRASH_COURSE.md` — primer on ISO 27001 / SOC 2 mental model.
