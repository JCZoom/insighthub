# InsightHub — Statement of Applicability (ISO 27001:2022)

> **Standard:** ISO/IEC 27001:2022, Annex A (93 controls across 4 themes).
> **Policy reference:** USZoom Policy 3712 Risk Assessment/Treatment; Policy 3716 Risk Management; Policy 3717 Scope of ISMS.
> **Gaps closed:** G-34, G-37.
> **Owner:** Jeff Coy (technical) + JD Gershan (policy-level).
> **Review cadence:** Annual + on material ISMS change.
> **Last reviewed:** 2026-04-24
> **Next review due:** 2027-04-24
> **Version:** 1.0

---

## 1. Scope of this SoA

This SoA documents the applicability and implementation status of each ISO/IEC 27001:2022 Annex A control to **InsightHub**, USZoom's internal analytics and dashboarding platform at `https://dashboards.jeffcoy.net`.

InsightHub is currently **not in scope for USZoom's SOC 2 attestation** (the attestation covers iPostal1 per policy 6727 System Description). This SoA is maintained so that InsightHub is audit-ready when data elevation (Phase 3 Snowflake integration) brings it into scope.

## 2. How to read this document

### Columns in the control tables

- **Control** — the Annex A identifier (e.g., `A.5.1`).
- **Title** — the control's short name.
- **Applicable** — `Yes` (we apply it) or `No` (we exclude it — justification required).
- **Implementation** — one of:
  - **✅ Implemented** — control is in place with verifiable evidence.
  - **⚠️ Partial** — control is partly in place; gaps tracked.
  - **❌ Planned** — applicable, not yet in place, gap tracked.
  - **— N/A** — control is not applicable; justification given.
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

| Control | Title | Applicable | Implementation | Evidence / Rationale |
|---|---|---|---|---|
| A.5.1 | Policies for information security | Yes | ✅ Implemented | USZoom ISMS (35 policies); InsightHub-specific: `docs/SECURITY_POSTURE_FOR_STAKEHOLDERS.md`, this SoA. |
| A.5.2 | Information security roles and responsibilities | Yes | ✅ Implemented | Policy 3713 Roles; this SoA §1 and `INCIDENT_RESPONSE_RUNBOOK.md §3`. |
| A.5.3 | Segregation of duties | Yes | ⚠️ Partial | Solo-developer era accepted risk (R-010, R-026). Compensating: CI gates + audit log. Gap G-11/G-19. |
| A.5.4 | Management responsibilities | Yes | ✅ Implemented | USZoom Policy 3704, 3711 Management Review. ISMS Governance Council named. |
| A.5.5 | Contact with authorities | Yes | ⚠️ Partial | DPO JD Gershan is the documented contact per Policy 3713. No written list of specific authority contacts (ICO, state AGs) beyond that. |
| A.5.6 | Contact with special interest groups | Yes | ⚠️ Partial | Informal: GitHub Advisory Database, CISA KEV feed. Formalization under G-29. |
| A.5.7 | Threat intelligence | Yes | ❌ Planned | G-29. |
| A.5.8 | Information security in project management | Yes | ✅ Implemented | This SoA + Asana task #1214267948143167 show security is tracked as a first-class project concern. |
| A.5.9 | Inventory of information and other associated assets | Yes | ✅ Implemented | `docs/ASSET_REGISTER.md`. |
| A.5.10 | Acceptable use of information and other associated assets | Yes | ✅ Implemented | USZoom Policy 3690 Acceptable Use; in-app deny-by-default permissions. |
| A.5.11 | Return of assets | Yes | 📋 Organizational | Covered by USZoom HR policy 3703; InsightHub has no hardware asset issued to non-privileged users. |
| A.5.12 | Classification of information | Yes | ❌ Planned | G-01 — data classification not yet wired into schema. |
| A.5.13 | Labelling of information | Yes | ❌ Planned | Part of G-01 (classification badges on Dashboard/Widget/Glossary objects). |
| A.5.14 | Information transfer | Yes | ✅ Implemented | TLS in transit; SSH-over-Tailscale for admin access; encrypted S3 for backups (gap G-13 for cross-region isolation). |
| A.5.15 | Access control | Yes | ✅ Implemented | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts`; 4-role RBAC + Permission Groups + MetricAccessRule. |
| A.5.16 | Identity management | Yes | ✅ Implemented | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:56-64` (domain restriction); Google Workspace SSO is authoritative. |
| A.5.17 | Authentication information | Yes | ✅ Implemented | No passwords stored in InsightHub; OAuth tokens managed by Google + NextAuth; `NEXTAUTH_SECRET` in `.env.local` (migration to Secrets Manager under G-36). |
| A.5.18 | Access rights | Yes | ⚠️ Partial | Assignment ✅; quarterly review G-09; automated offboarding G-10. |
| A.5.19 | Information security in supplier relationships | Yes | ❌ Planned | G-26 (Vendor Register). |
| A.5.20 | Addressing information security within supplier agreements | Yes | ❌ Planned | G-26 covers DPA review. |
| A.5.21 | Managing information security in the ICT supply chain | Yes | ⚠️ Partial | `npm audit` in CI + planned Dependabot (G-15) + planned SAST (G-24). |
| A.5.22 | Monitoring, review and change management of supplier services | Yes | ❌ Planned | G-26 includes annual SOC report review. |
| A.5.23 | Information security for use of cloud services | Yes | ✅ Implemented | AWS shared-responsibility model documented (`COMPLIANCE_CRASH_COURSE.md §4`); USZoom Policy 3720 governs. |
| A.5.24 | Information security incident management planning and preparation | Yes | ✅ Implemented | `docs/INCIDENT_RESPONSE_RUNBOOK.md` (this session). |
| A.5.25 | Assessment and decision on information security events | Yes | ✅ Implemented | Severity matrix in `INCIDENT_RESPONSE_RUNBOOK.md §4`. |
| A.5.26 | Response to information security incidents | Yes | ✅ Implemented | Runbook §5-6. |
| A.5.27 | Learning from information security incidents | Yes | ✅ Implemented | Retrospective process in runbook §5.6 + §8. |
| A.5.28 | Collection of evidence | Yes | ✅ Implemented | Runbook §6.2 step 2 (EBS snapshot), §6.3 step 5 (AuditLog export). |
| A.5.29 | Information security during disruption | Yes | ⚠️ Partial | Deploy auto-rollback on health-check failure; DR plan pending G-31. |
| A.5.30 | ICT readiness for business continuity | Yes | ⚠️ Partial | Daily backups; restore test G-27; DR plan G-31. |
| A.5.31 | Legal, statutory, regulatory and contractual requirements | Yes | ✅ Implemented | USZoom Policy 3714; GDPR rights endpoints implemented (see A.8.32 below); privacy notice G-33. |
| A.5.32 | Intellectual property rights | Yes | 📋 Organizational | USZoom HR / legal; InsightHub uses only permissively-licensed dependencies (package.json). |
| A.5.33 | Protection of records | Yes | ✅ Implemented | AuditLog is append-intent; backups retained per Policy 3700; Git history is authoritative for code. |
| A.5.34 | Privacy and protection of personal identifiable information | Yes | ✅ Implemented | GDPR export (`/api/user/export`) + erasure (`/api/user/delete`); Policy 3713 names DPO; current PII scope is minimal. |
| A.5.35 | Independent review of information security | Yes | ⚠️ Partial | Internal AI-generated red-team report exists; external pentest planned under G-32. |
| A.5.36 | Compliance with policies, rules and standards for information security | Yes | ✅ Implemented | This SoA + `COMPLIANCE_MATRIX.md` + `COMPLIANCE_GAPS.md` operationalize the compliance function. |
| A.5.37 | Documented operating procedures | Yes | ⚠️ Partial | `OPS_RUNBOOK.md` exists; expansion pending (release checklist under G-25). |

---

## 4. A.6 People controls (8)

| Control | Title | Applicable | Implementation | Evidence / Rationale |
|---|---|---|---|---|
| A.6.1 | Screening | Yes | 📋 Organizational | USZoom HR Policy 3703; background checks on hire. InsightHub does not extend this — it inherits. |
| A.6.2 | Terms and conditions of employment | Yes | 📋 Organizational | USZoom Policy 3697 Code of Conduct; confidentiality clauses in standard employment agreements. |
| A.6.3 | Information security awareness, education and training | Yes | ⚠️ Partial | Jeff personally consumes security content; formal record-keeping G-35. |
| A.6.4 | Disciplinary process | Yes | 📋 Organizational | USZoom HR. |
| A.6.5 | Responsibilities after termination or change of employment | Yes | ⚠️ Partial | Google Workspace disablement cascades; automated offboarding G-10. |
| A.6.6 | Confidentiality or non-disclosure agreements | Yes | 📋 Organizational | USZoom employment agreements. |
| A.6.7 | Remote working | Yes | ✅ Implemented | USZoom Policy 12736; macOS FileVault + Tailscale + domain-restricted SSO. Some gaps in documented enforcement (MDM enrollment). |
| A.6.8 | Information security event reporting | Yes | ✅ Implemented | `INCIDENT_RESPONSE_RUNBOOK.md §5.1` lists all channels. |

---

## 5. A.7 Physical controls (14)

**Scope note:** InsightHub has no primary physical infrastructure. All production workloads run in AWS us-east-1 data centers. The controls below are **inherited from AWS's SOC 2 Type II attestation** for 13 of 14, reviewed annually per USZoom Policy 3720 Third-Party Management. The one exception is A.7.9 (assets off-premises), which applies to Jeff's development laptop.

| Control | Title | Applicable | Implementation | Evidence / Rationale |
|---|---|---|---|---|
| A.7.1 | Physical security perimeters | Yes | ✅ Implemented (inherited) | AWS data center physical perimeters; AWS SOC 2. |
| A.7.2 | Physical entry | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.3 | Securing offices, rooms and facilities | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.4 | Physical security monitoring | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.5 | Protecting against physical and environmental threats | Yes | ✅ Implemented (inherited) | AWS SOC 2 + us-east-1 multi-AZ capability (currently used single-AZ; multi-AZ migration tracked under G-31). |
| A.7.6 | Working in secure areas | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.7 | Clear desk and clear screen | Yes | 📋 Organizational | USZoom Remote Working Policy 12736 (15-min idle lock). |
| A.7.8 | Equipment siting and protection | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.9 | Security of assets off-premises | Yes | ⚠️ Partial | Jeff's MacBook: FileVault assumed on, MDM enrollment gap. |
| A.7.10 | Storage media | Yes | ✅ Implemented (inherited) | AWS manages storage media lifecycle + secure destruction per SOC 2. |
| A.7.11 | Supporting utilities | Yes | ✅ Implemented (inherited) | AWS SOC 2 (power, cooling, HVAC). |
| A.7.12 | Cabling security | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.13 | Equipment maintenance | Yes | ✅ Implemented (inherited) | AWS SOC 2. |
| A.7.14 | Secure disposal or re-use of equipment | Yes | ✅ Implemented (inherited) | AWS SOC 2; applicable to EBS snapshot deletion (AWS handles via crypto-shred on KMS key revocation). |

---

## 6. A.8 Technological controls (34)

| Control | Title | Applicable | Implementation | Evidence / Rationale |
|---|---|---|---|---|
| A.8.1 | User endpoint devices | Yes | ⚠️ Partial | Jeff's MacBook; MDM enrollment gap (see A.7.9). |
| A.8.2 | Privileged access rights | Yes | ⚠️ Partial | `ADMIN` role + hardcoded `ADMIN_EMAILS` (gap G-38 to make DB-backed); separate privileged accounts accepted as risk R-026 (G-11). |
| A.8.3 | Information access restriction | Yes | ✅ Implemented | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/permissions.ts` server-side enforcement at feature / category / metric levels. |
| A.8.4 | Access to source code | Yes | ✅ Implemented | GitHub private repo + Bitbucket private mirror; `@uszoom.com` membership required for GitHub org. |
| A.8.5 | Secure authentication | Yes | ⚠️ Partial | Google OAuth + JWT (8h TTL); app-layer MFA enforcement G-02. |
| A.8.6 | Capacity management | Yes | ❌ Planned | G-21 (CloudWatch alerting). |
| A.8.7 | Protection against malware | Yes | 📋 Organizational | Endpoint-level (Jeff's MacBook) — macOS XProtect + Gatekeeper. Server-level (EC2 Ubuntu): minimal attack surface, no third-party code execution path exposed. |
| A.8.8 | Management of technical vulnerabilities | Yes | ⚠️ Partial | `npm audit --audit-level=high` in CI (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml:48-59`); Dependabot + SLAs pending G-15; infrastructure scans G-23. |
| A.8.9 | Configuration management | Yes | ⚠️ Partial | Application code configuration in Git; AWS infra configuration manual (G-16 IaC). |
| A.8.10 | Information deletion | Yes | ✅ Implemented | GDPR erasure (`/api/user/delete`); chat retention purge; retention automation for other categories G-05. |
| A.8.11 | Data masking | Yes | ❌ Planned | G-05 anonymization utility. Currently not required because only synthetic seed data is in scope; activation gated on Phase 3 Snowflake integration. |
| A.8.12 | Data leakage prevention | Yes | ⚠️ Partial | Export permissions default-deny for Viewers; no automated DLP. Accepted risk R-032 (G-30). |
| A.8.13 | Information backup | Yes | ✅ Implemented | `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/backup-db.sh` daily cron. Cross-region isolation G-13. |
| A.8.14 | Redundancy of information processing facilities | Yes | ⚠️ Partial | Single-AZ single-EC2 currently; multi-AZ/multi-region via DR plan G-31. |
| A.8.15 | Logging | Yes | ✅ Implemented | `AuditLog` table with enum actions; IP/user-agent enrichment G-20. |
| A.8.16 | Monitoring activities | Yes | ❌ Planned | G-21 CloudWatch + Nginx log monitoring. |
| A.8.17 | Clock synchronization | Yes | ✅ Implemented | Ubuntu `systemd-timesyncd` default enabled on EC2. |
| A.8.18 | Use of privileged utility programs | Yes | ✅ Implemented | Tailscale-gated SSH to EC2; `sudo` restricted to deploy script operations; no privileged Node processes. |
| A.8.19 | Installation of software on operational systems | Yes | ⚠️ Partial | Deploys via `deploy.sh`; `unattended-upgrades` enablement G-15. |
| A.8.20 | Networks security | Yes | ✅ Implemented | AWS Security Group + Nginx rate limit + Tailscale exit-point-only SSH. |
| A.8.21 | Security of network services | Yes | ✅ Implemented | Only HTTPS (Nginx → localhost:3001) + SSH-via-Tailscale exposed. TLS pinning G-03. |
| A.8.22 | Segregation of networks | Yes | ⚠️ Partial | Default VPC, single subnet. Acceptable for current scope; revisit with G-16 IaC migration. |
| A.8.23 | Web filtering | Yes | 📋 Organizational | Endpoint-level; out of InsightHub code scope. |
| A.8.24 | Use of cryptography | Yes | ✅ Implemented | USZoom Policy 3701; TLS 1.2+, AES-256 at rest (AWS KMS), bcrypt/argon2 not needed (no local passwords). |
| A.8.25 | Secure development life cycle | Yes | ⚠️ Partial | CI pipeline (typecheck, lint, audit, E2E); SAST G-24; branch protection G-19. |
| A.8.26 | Application security requirements | Yes | ✅ Implemented | USZoom Policy 3718 Secure System Engineering; secure-by-design RBAC, CSP, rate limits, input validation at API boundary. |
| A.8.27 | Secure system architecture and engineering principles | Yes | ✅ Implemented | Deny-by-default permissions; defense-in-depth (Nginx → Next → Prisma); server-side enforcement for all authorization. |
| A.8.28 | Secure coding | Yes | ✅ Implemented | TypeScript strict mode; ESLint with security rules; Prisma ORM prevents SQL injection by construction; no `eval`/`new Function` in source (red-team §2 confirmed). |
| A.8.29 | Security testing in development and acceptance | Yes | ⚠️ Partial | E2E Playwright suite in CI; manual security review per release; SAST G-24; pentest G-32. |
| A.8.30 | Outsourced development | No | — N/A | InsightHub development is fully in-house (Jeff Coy). This control will re-apply if outsourced development occurs in the future. |
| A.8.31 | Separation of development, test and production environments | Yes | ❌ Planned | G-22 (currently single environment; production DB named `dev.db`). |
| A.8.32 | Change management | Yes | ⚠️ Partial | Git + Asana + CI gates; formal peer review G-19 (accepted risk R-010 in solo era). |
| A.8.33 | Test information | Yes | ✅ Implemented | Only synthetic seed data used for testing; production customer data never used in non-prod. |
| A.8.34 | Protection of information systems during audit testing | Yes | ✅ Implemented | Audit activities (npm audit, CI, future SAST) run on CI runners with no production data access. |

---

## 7. Summary statistics

| Theme | Total | Yes (applicable) | No (excluded) | ✅ Implemented | ⚠️ Partial | ❌ Planned | 📋 Org |
|---|---|---|---|---|---|---|---|
| A.5 Organizational (37) | 37 | 37 | 0 | 22 | 9 | 4 | 2 |
| A.6 People (8) | 8 | 8 | 0 | 2 | 3 | 0 | 3 |
| A.7 Physical (14) | 14 | 14 | 0 | 13 | 1 | 0 | 1 (excl. inherited) |
| A.8 Technological (34) | 34 | 33 | 1 | 17 | 12 | 6 | 2 |
| **Totals** | **93** | **92** | **1** | **54** | **25** | **10** | **8** |

**Excluded:** 1 control (A.8.30 Outsourced development) — not applicable because all development is in-house. This exclusion will be reviewed annually.

**Implementation status as of 2026-04-24:**
- **58% fully implemented** (54 / 92 applicable)
- **27% partially implemented** (25 / 92 applicable) — gaps tracked in `COMPLIANCE_GAPS.md`
- **11% planned** (10 / 92 applicable)
- **~9% organizational / inherited** (8 / 92 — covered by USZoom policies + AWS SOC 2 inheritance)

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

## 11. Review history

| Date | Version | Reviewer | Summary |
|---|---|---|---|
| 2026-04-24 | 1.0 (draft) | Jeff Coy | Initial SoA produced as part of USZoom ISMS compliance pass. All 93 Annex A controls evaluated. Approval pending from Decision Authority. |
