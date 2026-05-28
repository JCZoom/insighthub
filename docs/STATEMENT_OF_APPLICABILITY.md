# InsightHub — Statement of Applicability (ISO 27001:2022)

> **Standard:** ISO/IEC 27001:2022, Annex A (93 controls across 4 themes), plus management-system clauses 4–10.
> **Source of truth for control titles:** `policies_USZoom_2026-04-24/ISO_IEC_27001_2022(en).pdf` (USZoom single-user license, ISO Order OP-1052072). Control titles in this document are diff-verified against that PDF as of v2.0.
> **Policy reference:** USZoom Policy 3712 Risk Assessment/Treatment; Policy 3716 Risk Management; Policy 3717 Scope of ISMS.
> **Gaps closed:** G-34, G-37.
> **Owner:** Jeff Coy (technical) + JD Gershan (policy-level).
> **Review cadence:** Annual + on material ISMS change.
> **Last reviewed:** 2026-05-25 (v2.0 — PDF-verified title diff, risk-treatment column added, clauses 4–10 section added, 2022-new-control annotations added)
> **Previously reviewed:** 2026-04-24 (v1.0 — initial)
> **Next review due:** 2027-04-24 (annual) or on material ISMS change
> **Version:** 2.0

---

## 1. Scope of this SoA

This SoA documents the applicability and implementation status of each ISO/IEC 27001:2022 Annex A control to **InsightHub**, USZoom's internal analytics and dashboarding platform at `https://dashboards.jeffcoy.net`.

InsightHub is currently **not in scope for USZoom's SOC 2 attestation** (the attestation covers iPostal1 per policy 6727 System Description). This SoA is maintained so that InsightHub is audit-ready when data elevation (Phase 3 Snowflake integration) brings it into scope.

## 2. How to read this document

### Columns in the control tables

- **Control** — the Annex A identifier (e.g., `A.5.1`). A trailing `✨ *(new 2022)*` marks one of the 11 controls newly introduced in ISO/IEC 27001:2022 vs. the 2013 edition.
- **Title** — the control's short name **as published in ISO/IEC 27001:2022 Annex A Table A.1**, verified against the licensed PDF.
- **Applicable** — `Yes` (we apply it) or `No` (we exclude it — justification required).
- **Implementation** — one of:
  - **✅ Implemented** — control is in place with verifiable evidence.
  - **✅ Implemented (inherited)** — control is satisfied by an upstream provider's attested control (e.g., AWS SOC 2). Inheritance source named in the evidence cell.
  - **⚠️ Partial** — control is partly in place; gaps tracked in `COMPLIANCE_GAPS.md`.
  - **❌ Planned** — applicable, not yet in place, gap tracked.
  - **📋 Organizational** — satisfied by an existing USZoom-wide policy or process rather than InsightHub-specific implementation. The umbrella policy is named in the evidence cell.
  - **— N/A** — control is not applicable; justification given.
- **Risk treatment** — the ISO 27005 risk-treatment option chosen for this control (per ISO 27001 clause 6.1.3.d, the SoA must record the treatment decision):
  - **Modify** — we apply controls to reduce the risk. Default for in-app implementations and partials.
  - **Retain** — we accept the residual risk. Used for `📋 Organizational` rows where USZoom umbrella controls are accepted as the treatment without InsightHub-specific further action, and for `— N/A` rows.
  - **Share** — we transfer the risk to a third party (typically a cloud provider with attested controls). Used for `✅ Implemented (inherited)` rows.
  - **Avoid** — we eliminate the activity that creates the risk. Rare; flagged explicitly when used.
- **Evidence / Rationale** — specific pointer (file, doc, policy, or gap ID).

### Justification pattern

Every row justifies either **inclusion** ("why it applies and how") or **exclusion** ("why it does not apply"). No bare "N/A" without reasoning.

### Cross-references

- `COMPLIANCE_MATRIX.md` — control-by-control mapping to USZoom policies.
- `COMPLIANCE_GAPS.md` — ranked remediation list.
- `RISK_REGISTER.md` — risk items linked by R-ID.
- `ASSET_REGISTER.md` — asset inventory.
- `INCIDENT_RESPONSE_RUNBOOK.md` — IR procedures.
- `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/...` — codebase citations.

---

## 3. A.5 Organizational controls (37)

| Control | Title | Applicable | Implementation | Risk treatment | Evidence / Rationale |
|---|---|---|---|---|---|
| A.5.1 | Policies for information security | Yes | ✅ Implemented | Modify | USZoom ISMS (35 policies); InsightHub-specific: `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md`, this SoA. |
| A.5.2 | Information security roles and responsibilities | Yes | ✅ Implemented | Modify | Policy 3713 Roles; this SoA §1 and `INCIDENT_RESPONSE_RUNBOOK.md §3`. |
| A.5.3 | Segregation of duties | Yes | ⚠️ Partial | Modify | Solo-developer era accepted risk (R-010, R-026). Compensating: CI gates + audit log. Gap G-11/G-19. |
| A.5.4 | Management responsibilities | Yes | ✅ Implemented | Modify | USZoom Policy 3704, 3711 Management Review. ISMS Governance Council named. |
| A.5.5 | Contact with authorities | Yes | ⚠️ Partial | Modify | DPO JD Gershan is the documented contact per Policy 3713. No written list of specific authority contacts (ICO, state AGs) beyond that. |
| A.5.6 | Contact with special interest groups | Yes | ⚠️ Partial | Modify | Informal: GitHub Advisory Database, CISA KEV feed. Formalization under G-29. |
| A.5.7 ✨ *(new 2022)* | Threat intelligence | Yes | ❌ Planned | Modify | G-29. |
| A.5.8 | Information security in project management | Yes | ✅ Implemented | Modify | This SoA + Asana task #1214267948143167 show security is tracked as a first-class project concern. |
| A.5.9 | Inventory of information and other associated assets | Yes | ✅ Implemented | Modify | `docs/ASSET_REGISTER.md`. |
| A.5.10 | Acceptable use of information and other associated assets | Yes | ✅ Implemented | Modify | USZoom Policy 3690 Acceptable Use; in-app deny-by-default permissions. |
| A.5.11 | Return of assets | Yes | 📋 Organizational | Retain | Covered by USZoom HR policy 3703; InsightHub has no hardware asset issued to non-privileged users. |
| A.5.12 | Classification of information | Yes | ✅ Implemented | Modify | `classification` field on `Dashboard` and `GlossaryTerm` (default `USZOOM_RESTRICTED`); validation + audit in `src/lib/data/classification.ts`; mapping in `docs/DATA_CLASSIFICATION_APPLIED.md`. Closed gap G-01 on 2026-04-25. |
| A.5.13 | Labelling of information | Yes | ✅ Implemented | Modify | `ClassificationBadge` component (`src/components/classification/ClassificationBadge.tsx`) renders the label on dashboard cards (compact, non-default tiers) and in admin/editor views (full). GDPR export discloses each object's label. Closed gap G-01 on 2026-04-25. |
| A.5.14 | Information transfer | Yes | ✅ Implemented | Modify | TLS in transit; SSH-over-Tailscale for admin access; encrypted S3 for backups (gap G-13 for cross-region isolation). |
| A.5.15 | Access control | Yes | ✅ Implemented | Modify | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts`; 4-role RBAC + Permission Groups + MetricAccessRule. |
| A.5.16 | Identity management | Yes | ✅ Implemented | Modify | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:56-64` (domain restriction); Google Workspace SSO is authoritative. |
| A.5.17 | Authentication information | Yes | ✅ Implemented | Modify | No passwords stored in InsightHub; OAuth tokens managed by Google + NextAuth; `NEXTAUTH_SECRET` in `.env.local` (migration to Secrets Manager under G-36). |
| A.5.18 | Access rights | Yes | ⚠️ Partial | Modify | Assignment ✅; quarterly review G-09; automated offboarding G-10. |
| A.5.19 | Information security in supplier relationships | Yes | ❌ Planned | Modify | G-26 (Vendor Register). |
| A.5.20 | Addressing information security within supplier agreements | Yes | ❌ Planned | Modify | G-26 covers DPA review. |
| A.5.21 | Managing information security in the information and communication technology (ICT) supply chain | Yes | ⚠️ Partial | Modify | `npm audit` in CI + Dependabot (G-15 partial, 2026-05-25) + planned SAST (G-24). |
| A.5.22 | Monitoring, review and change management of supplier services | Yes | ❌ Planned | Modify | G-26 includes annual SOC report review. |
| A.5.23 ✨ *(new 2022)* | Information security for use of cloud services | Yes | ✅ Implemented | Modify | AWS shared-responsibility model documented (`COMPLIANCE_CRASH_COURSE.md §4`); USZoom Policy 3720 governs. |
| A.5.24 | Information security incident management planning and preparation | Yes | ✅ Implemented | Modify | `docs/INCIDENT_RESPONSE_RUNBOOK.md` (this session). |
| A.5.25 | Assessment and decision on information security events | Yes | ✅ Implemented | Modify | Severity matrix in `INCIDENT_RESPONSE_RUNBOOK.md §4`. |
| A.5.26 | Response to information security incidents | Yes | ✅ Implemented | Modify | Runbook §5-6; **lived incident** `docs/incidents/INC-20260519-001.md`. |
| A.5.27 | Learning from information security incidents | Yes | ✅ Implemented | Modify | Retrospective process in runbook §5.6 + §8; `INC-20260519-001` retro shipped corrective + preventive controls same day. |
| A.5.28 | Collection of evidence | Yes | ✅ Implemented | Modify | Runbook §6.2 step 2 (EBS snapshot), §6.3 step 5 (AuditLog export). |
| A.5.29 | Information security during disruption | Yes | ⚠️ Partial | Modify | Deploy auto-rollback on health-check failure; DR plan pending G-31. |
| A.5.30 ✨ *(new 2022)* | ICT readiness for business continuity | Yes | ⚠️ Partial | Modify | Daily backups; restore test G-27; DR plan G-31. |
| A.5.31 | Legal, statutory, regulatory and contractual requirements | Yes | ✅ Implemented | Modify | USZoom Policy 3714; GDPR rights endpoints implemented (see A.8.32 below); privacy notice G-33. |
| A.5.32 | Intellectual property rights | Yes | 📋 Organizational | Retain | USZoom HR / legal; InsightHub uses only permissively-licensed dependencies (package.json). |
| A.5.33 | Protection of records | Yes | ✅ Implemented | Modify | AuditLog is append-intent; backups retained per Policy 3700; Git history is authoritative for code. |
| A.5.34 | Privacy and protection of personal identifiable information (PII) | Yes | ✅ Implemented | Modify | GDPR export (`/api/user/export`) + erasure (`/api/user/delete`); Policy 3713 names DPO; current PII scope is minimal. |
| A.5.35 | Independent review of information security | Yes | ⚠️ Partial | Modify | Internal AI-generated red-team report exists; external pentest planned under G-32. |
| A.5.36 | Compliance with policies, rules and standards for information security | Yes | ✅ Implemented | Modify | This SoA + `COMPLIANCE_MATRIX.md` + `COMPLIANCE_GAPS.md` operationalize the compliance function. |
| A.5.37 | Documented operating procedures | Yes | ⚠️ Partial | Modify | `OPS_RUNBOOK.md` exists; expansion pending (release checklist under G-25). |

---

## 4. A.6 People controls (8)

| Control | Title | Applicable | Implementation | Risk treatment | Evidence / Rationale |
|---|---|---|---|---|---|
| A.6.1 | Screening | Yes | 📋 Organizational | Retain | USZoom HR Policy 3703; background checks on hire. InsightHub does not extend this — it inherits. |
| A.6.2 | Terms and conditions of employment | Yes | 📋 Organizational | Retain | USZoom Policy 3697 Code of Conduct; confidentiality clauses in standard employment agreements. |
| A.6.3 | Information security awareness, education and training | Yes | ⚠️ Partial | Modify | Jeff personally consumes security content; formal record-keeping G-35. |
| A.6.4 | Disciplinary process | Yes | 📋 Organizational | Retain | USZoom HR. |
| A.6.5 | Responsibilities after termination or change of employment | Yes | ⚠️ Partial | Modify | Google Workspace disablement cascades; automated offboarding G-10. |
| A.6.6 | Confidentiality or non-disclosure agreements | Yes | 📋 Organizational | Retain | USZoom employment agreements. |
| A.6.7 | Remote working | Yes | ✅ Implemented | Modify | USZoom Policy 12736; macOS FileVault + Tailscale + domain-restricted SSO. Some gaps in documented enforcement (MDM enrollment). |
| A.6.8 | Information security event reporting | Yes | ✅ Implemented | Modify | `INCIDENT_RESPONSE_RUNBOOK.md §5.1` lists all channels. |

---

## 5. A.7 Physical controls (14)

**Scope note:** InsightHub has no primary physical infrastructure. All production workloads run in AWS us-east-1 data centers. The controls below are **inherited from AWS's SOC 2 Type II attestation** for 13 of 14, reviewed annually per USZoom Policy 3720 Third-Party Management. The one exception is A.7.9 (assets off-premises), which applies to Jeff's development laptop.

| Control | Title | Applicable | Implementation | Risk treatment | Evidence / Rationale |
|---|---|---|---|---|---|
| A.7.1 | Physical security perimeters | Yes | ✅ Implemented (inherited) | Share | AWS data center physical perimeters; AWS SOC 2. |
| A.7.2 | Physical entry | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.3 | Securing offices, rooms and facilities | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.4 ✨ *(new 2022)* | Physical security monitoring | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.5 | Protecting against physical and environmental threats | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2 + us-east-1 multi-AZ capability (currently used single-AZ; multi-AZ migration tracked under G-31). |
| A.7.6 | Working in secure areas | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.7 | Clear desk and clear screen | Yes | 📋 Organizational | Retain | USZoom Remote Working Policy 12736 (15-min idle lock). |
| A.7.8 | Equipment siting and protection | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.9 | Security of assets off-premises | Yes | ⚠️ Partial | Modify | Jeff's MacBook: FileVault assumed on, MDM enrollment gap. |
| A.7.10 | Storage media | Yes | ✅ Implemented (inherited) | Share | AWS manages storage media lifecycle + secure destruction per SOC 2. |
| A.7.11 | Supporting utilities | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2 (power, cooling, HVAC). |
| A.7.12 | Cabling security | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.13 | Equipment maintenance | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2. |
| A.7.14 | Secure disposal or re-use of equipment | Yes | ✅ Implemented (inherited) | Share | AWS SOC 2; applicable to EBS snapshot deletion (AWS handles via crypto-shred on KMS key revocation). |

---

## 6. A.8 Technological controls (34)

| Control | Title | Applicable | Implementation | Risk treatment | Evidence / Rationale |
|---|---|---|---|---|---|
| A.8.1 | User end point devices | Yes | ⚠️ Partial | Modify | Jeff's MacBook; MDM enrollment gap (see A.7.9). |
| A.8.2 | Privileged access rights | Yes | ⚠️ Partial | Modify | `ADMIN` role + hardcoded `ADMIN_EMAILS` (gap G-38 to make DB-backed); separate privileged accounts accepted as risk R-026 (G-11). |
| A.8.3 | Information access restriction | Yes | ✅ Implemented | Modify | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts` server-side enforcement at feature / category / metric levels. |
| A.8.4 | Access to source code | Yes | ✅ Implemented | Modify | GitHub private repo + Bitbucket private mirror; `@uszoom.com` membership required for GitHub org. |
| A.8.5 | Secure authentication | Yes | ✅ Implemented | Modify | Google OAuth + JWT (8h TTL); app-layer MFA enforcement closed under G-02 (`src/lib/auth/config.ts:57-121`, `src/lib/auth/mfa.ts`). |
| A.8.6 | Capacity management | Yes | ❌ Planned | Modify | G-21 (CloudWatch alerting). Memory ceilings on systemd unit limit blast radius (`infra/insighthub.service`, `MemoryMax=512M`). |
| A.8.7 | Protection against malware | Yes | 📋 Organizational | Retain | Endpoint-level (Jeff's MacBook) — macOS XProtect + Gatekeeper. Server-level (EC2 Ubuntu): minimal attack surface, no third-party code execution path exposed. |
| A.8.8 | Management of technical vulnerabilities | Yes | ⚠️ Partial | Modify | `npm audit --audit-level=high` in CI (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml:48-59`); Dependabot config shipped 2026-05-25 (`.github/dependabot.yml`) — repo-level toggle still required to activate. SLAs document G-15; infrastructure scans G-23. |
| A.8.9 ✨ *(new 2022)* | Configuration management | Yes | ⚠️ Partial | Modify | Application code configuration in Git; AWS infra configuration manual (G-16 IaC). |
| A.8.10 ✨ *(new 2022)* | Information deletion | Yes | ✅ Implemented | Modify | GDPR erasure (`/api/user/delete`); chat retention purge; retention automation in `src/lib/data/retention.ts` (G-05 closed). |
| A.8.11 ✨ *(new 2022)* | Data masking | Yes | ⚠️ Partial | Modify | Server-side PII field stripping in `/api/data/query` for non-FULL CustomerPII access; Freshworks per-product field redactors. Snowflake-tier masking pending Phase 3 activation. |
| A.8.12 ✨ *(new 2022)* | Data leakage prevention | Yes | ⚠️ Partial | Modify | Export permissions default-deny for Viewers; no automated DLP. Accepted risk R-032 (G-30). |
| A.8.13 | Information backup | Yes | ✅ Implemented | Modify | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh` daily cron, AES-256-CBC encrypted, 30-day retention. Cross-region isolation G-13. |
| A.8.14 | Redundancy of information processing facilities | Yes | ⚠️ Partial | Modify | Single-AZ single-EC2 currently; multi-AZ/multi-region via DR plan G-31. |
| A.8.15 | Logging | Yes | ✅ Implemented | Modify | `AuditLog` table with 29-action enum; IP/userAgent + recursive metadata sanitization shipped 2026-05-25 (`src/lib/audit.ts:71-237`, G-20). |
| A.8.16 ✨ *(new 2022)* | Monitoring activities | Yes | ❌ Planned | Modify | G-21 CloudWatch + Nginx log monitoring. AI Data Integrity Verification (`src/lib/ai/verify-integrity.ts`) monitors AI-generated dashboard output as a partial domain-specific implementation. |
| A.8.17 | Clock synchronization | Yes | ✅ Implemented | Modify | Ubuntu `systemd-timesyncd` default enabled on EC2. |
| A.8.18 | Use of privileged utility programs | Yes | ✅ Implemented | Modify | Tailscale-gated SSH to EC2; `sudo` restricted to deploy script operations; no privileged Node processes. |
| A.8.19 | Installation of software on operational systems | Yes | ⚠️ Partial | Modify | Deploys via CI-driven `deploy-ci.sh` with environment approval (since 2026-05-19); `unattended-upgrades` enablement G-15. |
| A.8.20 | Networks security | Yes | ✅ Implemented | Modify | AWS Security Group + Nginx rate limit + Tailscale exit-point-only SSH. |
| A.8.21 | Security of network services | Yes | ✅ Implemented | Modify | Only HTTPS (Nginx → localhost:3001) + SSH-via-Tailscale exposed. TLS hardened (G-03 closed); SSL Labs A+. |
| A.8.22 ✨ *(new 2022)* | Segregation of networks | Yes | ⚠️ Partial | Modify | Default VPC, single subnet. Acceptable for current scope; revisit with G-16 IaC migration. |
| A.8.23 ✨ *(new 2022)* | Web filtering | Yes | 📋 Organizational | Retain | Endpoint-level; out of InsightHub code scope. |
| A.8.24 | Use of cryptography | Yes | ✅ Implemented | Modify | USZoom Policy 3701; TLS 1.2+, AES-256 at rest (AWS KMS), AES-256-CBC on backups; EBS encryption verified at deploy (G-12 closed 2026-05-25). |
| A.8.25 | Secure development life cycle | Yes | ⚠️ Partial | Modify | CI pipeline (typecheck, lint, audit, E2E); SAST G-24; branch protection G-19. |
| A.8.26 | Application security requirements | Yes | ✅ Implemented | Modify | USZoom Policy 3718 Secure System Engineering; secure-by-design RBAC, CSP, rate limits, input validation at API boundary. |
| A.8.27 | Secure system architecture and engineering principles | Yes | ✅ Implemented | Modify | Deny-by-default permissions; defense-in-depth (Nginx → Next → Prisma); server-side enforcement for all authorization. |
| A.8.28 ✨ *(new 2022)* | Secure coding | Yes | ✅ Implemented | Modify | TypeScript strict mode; ESLint with security rules; Prisma ORM prevents SQL injection by construction; no `eval`/`new Function` in source (red-team §2 confirmed). |
| A.8.29 | Security testing in development and acceptance | Yes | ⚠️ Partial | Modify | E2E Playwright suite in CI; manual security review per release; SAST G-24; pentest G-32. |
| A.8.30 | Outsourced development | No | — N/A | Retain | InsightHub development is fully in-house (Jeff Coy). This control will re-apply if outsourced development occurs in the future. |
| A.8.31 | Separation of development, test and production environments | Yes | ❌ Planned | Modify | G-22 (currently single environment; production DB named `dev.db`). |
| A.8.32 | Change management | Yes | ✅ Implemented | Modify | Git + Asana + CI gates; production-environment approval gate on GitHub Actions; immutable workflow log pinned to `github.sha`. Single-engineer peer-review still tracked under G-19. |
| A.8.33 | Test information | Yes | ✅ Implemented | Modify | Only synthetic seed data used for testing; production customer data never used in non-prod. |
| A.8.34 | Protection of information systems during audit testing | Yes | ✅ Implemented | Modify | Audit activities (npm audit, CI, future SAST) run on CI runners with no production data access. |

---

## 7. Summary statistics

The `✅ Implemented` column counts both directly-implemented and inherited (AWS SOC 2) controls. The `📋 Org` column counts controls satisfied by USZoom umbrella policy without InsightHub-specific implementation.

| Theme | Total | Yes (applicable) | No (excluded) | ✅ Implemented | ⚠️ Partial | ❌ Planned | 📋 Org |
|---|---|---|---|---|---|---|---|
| A.5 Organizational (37) | 37 | 37 | 0 | 22 | 9 | 4 | 2 |
| A.6 People (8) | 8 | 8 | 0 | 2 | 3 | 0 | 3 |
| A.7 Physical (14) | 14 | 14 | 0 | 12 (all inherited from AWS SOC 2) | 1 | 0 | 1 |
| A.8 Technological (34) | 34 | 33 | 1 | 17 | 11 | 3 | 2 |
| **Totals** | **93** | **92** | **1** | **53** | **24** | **7** | **8** |

**Excluded:** 1 control (A.8.30 Outsourced development) — not applicable because all development is in-house. This exclusion will be reviewed annually.

**Implementation status as of 2026-05-25 (v2.0):**
- **58% fully implemented** (53 / 92 applicable)
- **26% partially implemented** (24 / 92 applicable) — gaps tracked in `COMPLIANCE_GAPS.md`
- **8% planned** (7 / 92 applicable)
- **9% organizational / inherited** (8 / 92 — covered by USZoom umbrella policies)

**Risk-treatment breakdown** (per clause 6.1.3.d):
- **Modify:** 71 controls (apply InsightHub-specific or inherited-but-actively-monitored controls)
- **Retain:** 10 controls (accept residual risk; 9 are USZoom umbrella `📋 Organizational` rows, 1 is the A.8.30 N/A row)
- **Share:** 12 controls (transferred to AWS via inherited SOC 2 controls — all in A.7 Physical)
- **Avoid:** 0 controls
- **Verification:** 71 + 10 + 12 = 93 ✓ (matches Annex A total)

**Delta vs. v1.0 (2026-04-24):**
- **A.7 implementation count corrected from 13 to 12.** v1.0 over-counted by including A.7.7 (Clear desk and clear screen) in both "Implemented" and "Org" columns. A.7.7 is correctly classified as `📋 Organizational` (USZoom Policy 12736), so the inherited-from-AWS count is 12, not 13.
- **A.8.5 (Secure authentication)** moved ⚠️ Partial → ✅ Implemented — G-02 closed via MFA enforcement at sign-in.
- **A.8.11 (Data masking)** moved ❌ Planned → ⚠️ Partial — server-side PII field stripping in `/api/data/query` + Freshworks per-product redactors recognized as partial implementation.
- **A.8.32 (Change management)** moved ⚠️ Partial → ✅ Implemented — CI-driven deploy with GitHub-environment approval (since 2026-05-19) and immutable `github.sha`-pinned workflow log satisfies the control. Peer-review-by-second-engineer remains tracked separately under G-19 as a Segregation-of-Duties matter.

**Trend target (next review, 2027-04-24):** move all tier-1 and tier-2 gaps from "❌ Planned" and "⚠️ Partial" to "✅ Implemented".

---

## 8. Mapping from SoA to gap list

For auditors tracing from a control back to the remediation plan, here is the reverse index.

| Gap ID | Title | Linked A.x controls |
|---|---|---|
| G-01 | Data Classification in schema | A.5.12, A.5.13 |
| G-02 | App-layer MFA enforcement | A.5.17, A.8.5 |
| G-03 | TLS pinning + SSL Labs | A.8.24 |
| G-04 | Asset Register | A.5.9 ✅ closed 2026-04-24 |
| G-05 | Automated PII retention | A.5.34, A.8.10, A.8.11 |
| G-06 | Audit log retention upper bound | A.8.15 |
| G-07 | Backup retention 30d | A.8.13 |
| G-08 | Log deletion events | A.5.28, A.8.15 |
| G-09 | Quarterly access reviews | A.5.18 |
| G-10 | Automated offboarding | A.6.5 |
| G-11 | Separate privileged accounts | A.5.3, A.8.2 |
| G-12 | Verify EBS encryption in deploy | A.8.24 |
| G-13 | Cross-region isolated backups | A.5.29, A.8.13, A.8.14 |
| G-14 | CIS Level-1 hardening | A.8.9 |
| G-15 | Dependabot + patching SLAs | A.8.8, A.8.19 |
| G-16 | AWS IaC | A.8.9, A.5.23 |
| G-17 | SSH idle timeout | A.8.18, A.8.20 |
| G-18 | Incident Response Runbook | A.5.24–28 ✅ closed 2026-04-24 |
| G-19 | Branch protection / peer review | A.5.3, A.8.25, A.8.32 |
| G-20 | AuditLog IP + metadata sanitizer | A.8.15 |
| G-21 | CloudWatch alerting | A.8.6, A.8.16 |
| G-22 | Env separation | A.8.31 |
| G-23 | Infra vuln scans | A.5.21, A.8.8 |
| G-24 | SAST in CI | A.8.8, A.8.25, A.8.28, A.8.29 |
| G-25 | Release checklist | A.5.37, A.8.32 |
| G-26 | Vendor register | A.5.19, A.5.20, A.5.22 |
| G-27 | Annual restore test | A.5.30, A.8.13 |
| G-28 | FIM | A.8.15 |
| G-29 | Threat intel feeds | A.5.6, A.5.7 |
| G-30 | DLP | A.8.12 |
| G-31 | DR plan + RTO/RPO | A.5.29, A.5.30, A.8.14 |
| G-32 | Third-party pentest | A.5.35, A.8.29 |
| G-33 | Privacy notice UI | A.5.31, A.5.34 |
| G-34 | Risk Register + SoA | (this document + `RISK_REGISTER.md`) ✅ closed 2026-04-24 |
| G-35 | Security awareness training record | A.6.3 |
| G-36 | Secrets Manager migration | A.5.17, A.8.24 |
| G-37 | Statement of Applicability (ISO 27001:2022) | (this document) ✅ closed 2026-04-24 |
| G-38 | DB-backed admin role assignments | A.5.15, A.8.2 |

---

## 9. Exclusions (controls marked "No, not applicable")

**A.8.30 — Outsourced development.** InsightHub's engineering is entirely in-house (Jeff Coy). No external contractors are granted commit access. Supply-chain risks from open-source dependencies are covered under A.5.21 and A.8.8. This exclusion will be re-evaluated annually and immediately revoked if any outsourced development occurs.

---

## 10. Approval

| Role | Name | Approval date | Signature / commit |
|---|---|---|---|
| Technical implementation owner | Jeff Coy | 2026-04-24 | (initial commit of this file) |
| Decision Authority | JD Gershan (CIO/CISO/DPO) | pending | — |
| Director of Compliance | Avi Katz | pending | — |

**This SoA is provisionally approved by its author pending final review by the Decision Authority and Director of Compliance.** Flagging the pending approvals keeps the document honest for an auditor; it is standard practice to commit an SoA at "v1.0 draft" state and then update on final sign-off. Sign-offs will be recorded as commits with the reviewer as co-author (`Co-authored-by: Name <email>`).

---

## 11. Conformance with ISO/IEC 27001:2022 Clauses 4–10

> **Why this section exists.** Annex A is the famous part of ISO 27001 — the 93 controls everyone counts. But an auditor's first read is **Clauses 4–10**, which define the ISMS itself. Annex A is the *menu*; Clauses 4–10 are the *kitchen*. A defensible SoA must show both. InsightHub inherits most of this from USZoom's umbrella ISMS (Policies 3704, 3711, 3712, 3716, 3717); the InsightHub-specific evidence is noted below.

### Clause 4 — Context of the organization

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 4.1 | Understanding the organization and its context | USZoom Policy 3717 ISMS Scope sets the org-level context. InsightHub-specific context: internal-only analytics platform, USZoom-domain users, hosted single-tenant on AWS us-east-1, currently not in SOC 2 attestation scope. Documented in this SoA §1. |
| 4.2 | Understanding the needs and expectations of interested parties | Interested parties identified: USZoom employees (users), JD Gershan (CISO/DPO), Lior Zamir (Security Manager), Avi Katz (Director of Compliance), Anthony Mirakaj (executive sponsor), Anthropic + Google + OpenAI (data processors). Per-party expectations summarized in `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md`. |
| 4.3 | Determining the scope of the information security management system | **In scope:** the InsightHub application at `https://dashboards.jeffcoy.net`, its SQLite database, its EC2 host, its source code at the GitHub repo + Bitbucket mirror, its operational documentation under `docs/`. **Out of scope:** iPostal1 (separate SOC 2 attestation), USZoom corporate IT (governed by separate USZoom ISMS instance), end-user devices (covered by USZoom Remote Working Policy 12736). |
| 4.4 | Information security management system | The InsightHub ISMS is the union of: (a) the USZoom umbrella ISMS (35 policies in `policies_USZoom_2026-04-24/`), (b) this SoA, (c) `COMPLIANCE_MATRIX.md`, (d) `COMPLIANCE_GAPS.md`, (e) `RISK_REGISTER.md`, (f) `ASSET_REGISTER.md`, (g) `INCIDENT_RESPONSE_RUNBOOK.md`, (h) `STAKEHOLDER_REGISTER.md` *(planned)*, (i) the code itself as authoritative implementation of policy. |

### Clause 5 — Leadership

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 5.1 | Leadership and commitment | JD Gershan (CISO/DPO) provides top-management commitment per USZoom Policy 3704 ISMS Foundations + Policy 3711 Management Review. Resourcing decision documented: dedicated technical owner (Jeff Coy) maintains the InsightHub ISMS as a first-class part of the engineering role, not a side activity. |
| 5.2 | Policy | The InsightHub Information Security Policy is the union of (a) the 35 USZoom policies in `policies_USZoom_2026-04-24/`, (b) this SoA, and (c) `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md`. Available to all interested parties via the source repository. |
| 5.3 | Organizational roles, responsibilities and authorities | Roles assigned per USZoom Policy 3713 + `INCIDENT_RESPONSE_RUNBOOK.md §3`: JD Gershan = ISMS owner & decision authority; Lior Zamir = security operations & policy enforcement; Avi Katz = compliance program owner; Jeff Coy = InsightHub technical implementation. Segregation-of-duties limitations at solo-developer scale documented as accepted risks R-010 + R-026 with compensating controls (CI gates, audit log, env-approval). |

### Clause 6 — Planning

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 6.1.1 | Actions to address risks and opportunities — general | Risk identification: `docs/RISK_REGISTER.md` (40+ scored risks, last reviewed 2026-05-19). Opportunity identification: `COMPLIANCE_GAPS.md` itself doubles as the opportunity backlog (every gap is an opportunity to lift conformance). |
| 6.1.2 | Information security risk assessment | Methodology in USZoom Policy 3712 Risk Assessment/Treatment. Likelihood × Impact scoring (1–5 each). Risks reviewed quarterly + on material change (the 2026-05-19 review was triggered by the `INC-20260519-001` incident — a material-change trigger working as designed). |
| 6.1.3 | Information security risk treatment | Treatment options per ISO 27005: Modify (71), Retain (10), Share (12), Avoid (0). See §7 "Risk-treatment breakdown" above. Per-control treatment decisions in the Annex A tables §§3–6. |
| 6.2 | Information security objectives and planning to achieve them | Objectives (FY 2026-Q2): close all Tier-1 gaps in code (✅ 6/6 done as of 2026-05-25 — G-13 has provisioning still open), close G-12 / G-15 / G-20 as Tier-2 demo-prep wins (✅ done 2026-05-25), deploy this branch to land closures in production (pending 2026-05-26). Quarterly objective review owned by Jeff + JD. |
| 6.3 | Planning of changes | Changes to the ISMS itself are committed via Git PRs to `docs/` with versioning. Changes to the InsightHub application go through CI gates + GitHub-environment approval + workflow log pinned to `github.sha`. `INC-20260519-001` produced a change to the env-validation contract that itself followed this planning discipline (commits `48c4790`, `3c6126c`, unit-tested regression). |

### Clause 7 — Support

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 7.1 | Resources | Personnel: Jeff Coy (technical), JD Gershan (decision authority + DPO), Lior Zamir (security operations), Avi Katz (compliance), Anthony Mirakaj (executive sponsor). Infrastructure: AWS us-east-1, GitHub, Anthropic, OpenAI, Google Workspace. Budget for the FY tracked in USZoom finance per Policy 3711. |
| 7.2 | Competence | Jeff's competence demonstrated by: 5 weeks of in-the-room ISMS development with documented artifacts; lived incident response on `INC-20260519-001`. JD's competence: CISO + DPO role per USZoom Policy 3713. Formal training records: tracked under G-35. |
| 7.3 | Awareness | Awareness of the ISMS surface is reinforced through: this SoA + `docs/COMPLIANCE_CRASH_COURSE.md` (plain-English explainer), the demo brief format (e.g., `docs/DEMO_2026-05-27_SECURITY_BRIEF.md`), and the audit-of-the-audit verification UI badges that surface security signal in the user-visible product. Org-wide security awareness training: G-35 (tracked at USZoom HR level). |
| 7.4 | Communication | Internal (within USZoom): the demo cadence + Asana board + Slack #security channel (per Policy 3713 contacts). External: GDPR + privacy notices (G-33 planned for in-app surface). Incident-time communication channels enumerated in `INCIDENT_RESPONSE_RUNBOOK.md §3`. |
| 7.5 | Documented information | All ISMS-relevant documentation lives in `docs/` under the version-controlled InsightHub repository. Git history is authoritative for "who changed what, when, why." Older versions retrievable via `git log`. Versioning conventions: SoA uses semver (1.0, 2.0…); gap docs are date-anchored with session-update headers; CISO reports are date-anchored with explicit supersession notes. |

### Clause 8 — Operation

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 8.1 | Operational planning and control | InsightHub operational controls: CI gates (typecheck, lint, npm audit, build, E2E, EBS-encryption pre-flight), production-environment approval gate, scheduled retention purges, audit-of-the-audit verification, health-check + auto-rollback on deploy. All documented in the relevant runbook files. |
| 8.2 | Information security risk assessment | Risk assessment is **performed at planned intervals** (quarterly) **and when significant changes occur**. Last quarterly review: 2026-05-19 (also the date of the `INC-20260519-001` incident-triggered review — a single review served both cadences). Next planned: 2026-08-19 (or sooner on material change). |
| 8.3 | Information security risk treatment | Treatment plan = `docs/COMPLIANCE_GAPS.md` tier ordering (Tier-1 highest priority). Treatment decisions logged in the Annex A tables in this SoA. Residual risk after treatment is reviewed during the same quarterly cadence as 8.2. |

### Clause 9 — Performance evaluation

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 9.1 | Monitoring, measurement, analysis and evaluation | **What we measure:** gap-closure burndown (raw count by tier), SSL Labs grade (currently A+), CI pass rate, deploy-rollback frequency, audit-row volume, MFA enforcement coverage (admin badge surfaces this). **How often:** continuous (audit log) + per-deploy (CI) + per-review (quarterly). **Who interprets:** Jeff weekly, JD + Avi quarterly. |
| 9.2 | Internal audit | Internal audit cadence: annual + on material change. Last internal audit: 2026-05-25 (the audit that produced this v2.0 update). Methodology: this SoA + `COMPLIANCE_GAPS.md` are the audit working papers. Independence: Jeff is the sole engineer, so independence is delegated upward to JD/Avi at policy level (a known limitation, accepted as risk R-010). |
| 9.3 | Management review | Cadence: quarterly per USZoom Policy 3711 Management Review. Inputs: this SoA, gap burndown, risk register changes, incident retros. Outputs: prioritized treatment-plan adjustments, resource decisions, scope decisions. **Gap:** while inputs and outputs exist in artifact form, formal management-review meeting minutes are not yet recorded as a discrete artifact. Recommended: capture the next quarterly review as a dated `docs/management-review/YYYY-MM-DD.md` file. |

### Clause 10 — Improvement

| Sub-clause | Title | Conformance evidence |
|---|---|---|
| 10.1 | Continual improvement | Continual improvement is **operationalized as the gap-closure burndown.** Tier-1 went from 6 open to 1 (G-13 awaiting provisioning) in five weeks. Three Tier-2 closures landed in the most recent session (G-12, G-15 partial, G-20). The SoA is re-versioned on material change rather than left static, which is itself a continual-improvement signal. |
| 10.2 | Nonconformity and corrective action | The canonical artifact is `docs/incidents/INC-20260519-001.md`. Full lifecycle: nonconformity detected (env-validation bypass alive in production) → cause analysis (Next.js `NEXT_PUBLIC_*` build-baking semantics not visible at runtime) → corrective action (`assertEnv()` hard-throw on `NODE_ENV=production` + `DEV_MODE=true` at `src/lib/env.ts:396-407`) → preventive action (unit test in `src/lib/__tests__/env.test.ts` so the regression cannot silently re-land) → documentation update (`src/lib/env.ts:54-77` documents the runtime-vs-build-baked-flag pattern for future engineers). This is ISO 27001 Clause 10.2 working as designed. |

---

## 12. Review history

| Date | Version | Reviewer | Summary |
|---|---|---|---|
| 2026-04-24 | 1.0 (draft) | Jeff Coy | Initial SoA produced as part of USZoom ISMS compliance pass. All 93 Annex A controls evaluated. Approval pending from Decision Authority. |
| 2026-05-25 | 2.0 | Jeff Coy (Cascade-assisted) | First update against the canonical ISO/IEC 27001:2022 PDF. Three control-title drifts corrected (A.5.21 +"(ICT)" parenthetical, A.5.34 +"(PII)" parenthetical, A.8.1 "endpoint"→"end point"). New `✨ *(new 2022)*` markers added to the 11 controls newly introduced in 2022 vs. the 2013 edition (A.5.7, A.5.23, A.5.30, A.7.4, A.8.9, A.8.10, A.8.11, A.8.12, A.8.16, A.8.22, A.8.23, A.8.28). New "Risk treatment" column added per ISO 27001 clause 6.1.3.d (Modify/Retain/Share/Avoid). New §11 "Clauses 4–10 Conformance" added so the SoA covers the entire standard, not just Annex A. A.7 over-count corrected (was 13, now 12 inherited). Three controls re-classified to reflect closures since v1.0: A.8.5 ⚠️→✅ (MFA enforcement), A.8.11 ❌→⚠️ (PII masking partial implementation), A.8.32 ⚠️→✅ (CI-driven deploy with env approval). Net Implemented count: 53 of 92 applicable. |
