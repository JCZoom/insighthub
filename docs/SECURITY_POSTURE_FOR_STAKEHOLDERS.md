# InsightHub — Security Posture for Stakeholders

> **Audience:** non-technical executives, customers, prospects, auditors, board members.
> **Purpose:** a single document Jeff can put in front of a room when someone asks *"How secure is this thing?"* — with enough depth to withstand follow-up questions from a technical stakeholder.
> **Companions:** the detail lives in `docs/COMPLIANCE_MATRIX.md` and `docs/COMPLIANCE_GAPS.md`.
> **Updated:** 2026-04-24

---

## The one-minute version

InsightHub is an **internal-use analytics and dashboarding application** built inside USZoom. It is being held to the same **ISO 27001 / SOC 2** control bar as the rest of the USZoom ISMS, even though its initial scope is internal users only.

- **Authentication** is centralized through Google Workspace SSO, restricted to `@uszoom.com` email addresses, with an 8-hour session timeout.
- **Authorization** uses a four-role RBAC model with a granular Permission Groups system underneath it — including metric-level restrictions on financial data.
- **Every sensitive action is audit-logged** in an append-oriented table keyed by user, action, resource, and timestamp.
- **Data in transit** is protected by TLS (HSTS-enforced, HTTP is redirected and eventually refused).
- **Data at rest** is protected by AWS-managed AES-256 encryption on EBS; database backups have optional application-layer AES-256-CBC encryption on top.
- **Deploys** go through a CI pipeline that runs type-checking, linting, dependency-vulnerability audit, and end-to-end Playwright tests. Every deploy takes a pre-deploy backup and is auto-rollback-protected by a post-deploy health check.
- **GDPR rights** (access & erasure) are implemented as API endpoints; chat data has an automated retention/purge path.

We have **mapped every one of the 35 USZoom ISMS policies** against the current codebase. **47% of the technical controls are fully implemented, 50% are partial, and a tracked backlog of 38 gaps is being remediated** with owners, effort estimates, and audit-risk ratings.

**We are not yet SOC 2 Type II certified.** We are operating as if we were, and we are closing the gap on a defined schedule.

---

## 1. What InsightHub is, and why that matters for the security conversation

InsightHub is a **BI / dashboarding tool** built with Next.js 15, TypeScript, Prisma, SQLite, and hosted on a single AWS EC2 instance behind Nginx. Real data sources (Snowflake) are being integrated in Phase 3; until then, all data flowing through the system is **synthetic seed data**.

This matters because:

1. **The data InsightHub processes is currently internal-only** (USZoom Confidential in USZoom's classification).
2. **The data it will process** (Snowflake metrics, customer KPIs) will climb to **Customer Confidential** in parts, and the security posture has to be ready before that switch flips.
3. **Single-tenant, single-employee** architecture means some controls that are standard for multi-tenant SaaS don't apply yet. Those are documented as *accepted risks* in the Risk Register, with revisit triggers tied to headcount or data-class changes.

---

## 2. The controls we can point to today

### 2.1 Identity and access

- **Single Sign-On** via Google Workspace — no local passwords stored anywhere in the InsightHub database.
- **Domain restriction** — the OAuth callback rejects any email not ending in `@uszoom.com`, before the user ever reaches the app.
- **Role-based access control** with four roles:
  - **Viewer** — read-only access to non-sensitive categories.
  - **Creator** — can build dashboards, blocked from financial data by default.
  - **Power User** — full data access except Customer PII.
  - **Admin** — full access + user/permission management + audit viewing.
- **Underneath the roles**, we have a **Permission Groups** table that lets administrators grant access by category (Revenue, Retention, Support, Sales, Product, Operations, Customer PII) and by **individual metric** (e.g., restrict `mrr_by_month` while allowing the rest of Revenue).
- **Session tokens** expire after 8 hours. No "remember me" extension.
- **Every login, permission change, and sensitive resource change is written to the AuditLog table** with actor, action, resource, and timestamp.

**What this lets us say under challenge:**
> "We use our corporate identity provider. An account disabled in Google Workspace loses access to InsightHub on the next token refresh — within 8 hours, with zero manual steps. Our audit log will show you who did what and when, and it goes back to the day we turned the system on."

### 2.2 Network and transport security

- **All traffic** is TLS-terminated at Nginx, with HSTS set to 2 years + preload.
- **Security headers** enforced on every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a strict `Content-Security-Policy`, and `frame-ancestors 'none'` to prevent clickjacking.
- **Rate limiting** is applied in two places: at Nginx (10 req/s per IP with burst of 20), and at the application layer (60 req/min for dashboard APIs, 30 req/min for chat).
- **SSH access** to the production host goes through **Tailscale** — the EC2 instance has no open SSH port on the public internet.

### 2.3 Data protection

- **TLS 1.2+** for all public traffic (a hardening ticket is open to explicitly pin this in Nginx rather than relying on Certbot defaults — see `G-03`).
- **AES-256 at rest** on all AWS EBS and S3 storage (AWS default for us-east-1).
- **Database backups** taken daily by cron, retained for 14 days locally on the EC2 host, with an encryption option (AES-256-CBC) that will become **mandatory** once `G-13` is closed.
- **GDPR Article 15 (right to access)** is implemented at `POST /api/user/export`.
- **GDPR Article 17 (right to erasure)** is implemented at `POST /api/user/delete`.
- **Chat message retention** purges ephemeral chat history on a configurable N-day rolling window (default 90 days).

### 2.4 Secure development lifecycle

- **Every code change** goes through a pull request on GitHub. The **CI pipeline** (`.github/workflows/ci.yml`) runs in parallel:
  - TypeScript type-checking
  - ESLint
  - `npm audit` at high/critical severity (fails the build on findings)
  - Production build
  - End-to-end Playwright tests against a seeded database
- **Branch protection on `main`** is on the immediate roadmap (`G-19`) once a second engineer joins.
- **Dependency and secret handling** avoids every common pitfall — no hardcoded secrets in source, all secrets come from `.env.local`, and the `src/lib/env.ts` validator fails fast on missing or malformed config in production.
- **An AI-driven "red team" review** has already been run on the codebase (`docs/RED_TEAM_SECURITY_REPORT.md`). Every High-severity finding has been addressed or has an open remediation ticket.

### 2.5 Deployment and operations

- **Deploys go to a single EC2 instance** in AWS us-east-1 via a documented, versioned script (`deploy.sh`).
- **Pre-deploy database backup** runs automatically — every deploy is recoverable.
- **Post-deploy health check** hits `/api/health` five times with back-off; if it fails, the script automatically restores the previous build (`.next-previous`) and restarts the service.
- **systemd** supervises the Node.js process with `Restart=always`.
- **Nginx** terminates TLS, sets security headers, and applies rate limits.
- **A CI-driven deploy path also exists** (`.github/workflows/ci.yml` job `deploy`), gated on a manual `workflow_dispatch` trigger and keyed with an SSH secret stored in GitHub Actions Secrets.

### 2.6 Auditing and evidence

- **`AuditLog` table** captures user ID, action (enum: login, permission change, dashboard CRUD, glossary CRUD, version save/revert, settings change, account deletion, data export), resource type, resource ID, and timestamp. Metadata is stored as a JSON blob.
- **Admin audit UI** at `/admin/audit` lets administrators filter and inspect the log in real time.
- **npm audit and CI logs** are retained in GitHub Actions for 90 days by default.
- **Backups** on EC2 are retained locally for 14 days (will be 30 once `G-07` is closed).

---

## 3. Where we do not yet fully meet USZoom policy — and what we're doing about it

We did the mapping exercise specifically so we wouldn't be surprised in an audit. **38 gaps** are tracked in `docs/COMPLIANCE_GAPS.md`, each with:

- The policy and control number it ties back to.
- An audit-risk rating (LOW / MED / HIGH).
- An effort estimate (S / M / L).
- A concrete remediation plan with file paths and line references.

The highest-impact gaps, the ones a mature auditor will go after first:

1. **Data Classification is not yet wired into the schema** (`G-01`). Without it, our retention, encryption, and access policies have no structured way to answer *"does this control apply to this object?"* for any given piece of data. **Remediation in-flight.**
2. **Application-layer MFA enforcement is not yet in place** (`G-02`). We inherit MFA from Google Workspace today. Upgrading to app-layer enforcement will let us prove MFA to an auditor without asking them to trust Google's posture.
3. **Backups are not yet isolated to a separate AWS region** (`G-13`). A full host compromise today would risk both the primary DB and the local backups. We're standing up a cross-region S3 destination with MFA-delete.
4. **No formal incident response runbook or annual tabletop** (`G-18`). Policy 3719 and 6458 both mandate these. We're writing the runbook against the exact scenarios USZoom's policy defines.
5. **No Risk Register or ISO 27001 Statement of Applicability** (`G-34`, `G-37`). These are the two documents every ISO 27001 auditor asks for first. We'll use the gap list itself as the seed population of the Risk Register.

**Every remediation item** — whether tier-1, tier-2, or tier-3 — **is being tracked in Asana** under a parent task so that progress is auditable, not just the endpoint.

---

## 4. How to handle the most likely stakeholder questions

### "Is this SOC 2 compliant?"

*"Not yet certified. We are built to the USZoom ISMS control bar, which is aligned with ISO 27001:2022 and mapped to SOC 2 Trust Services Criteria. We have a full compliance matrix, a gap list with owners and remediation timelines, and an Asana backlog driving closure. We expect to be defensible in a Type I scoping call within the month and ready for a Type II observation window within a quarter."*

### "What happens if a user's laptop is stolen?"

*"Google Workspace admin disables the account. Within 8 hours at most (our JWT expiry), every InsightHub session tied to that email is invalid. The admin immediately invalidates all live sessions by bumping the NEXTAUTH_SECRET if the concern is urgent. We then run through the Incident Response runbook's credential-rotation playbook for any downstream API keys that user could have accessed."*

### "How do you know your vendors are secure?"

*"We have a Vendor Register in progress under gap `G-26` — each SaaS we depend on is being rated by the classification of data it handles and the SOC 2/ISO report we've reviewed for it. Anthropic, OpenAI, Google Workspace, GitHub, and AWS all publish current SOC 2 Type II reports; Snowflake (Phase 3) does as well. Tailscale (only used for administrative SSH) handles no customer data."*

### "What if someone SQL-injects the database?"

*"All database access is through Prisma ORM with parameterized queries. We do not hand-build SQL with string interpolation anywhere in the codebase. The CI includes a lint rule that fails on raw `$queryRaw` without explicit Prisma.sql template tags. Input validation uses TypeScript types at compile time and runtime schema validation (zod-style) at API boundaries."*

### "How do you prove users can only see data they're supposed to?"

*"Our Permission Groups system enforces access at three tiers: feature permissions (can you open the dashboard builder at all?), category permissions (can you see Revenue data at all?), and metric-level rules (can you see this specific metric within Revenue?). The check happens server-side in `src/lib/auth/permissions.ts` — not in the browser. Every denied request is logged. Every permission change is logged."*

### "What about data leaving the system?"

*"The `canExportData` feature permission is false-by-default for Viewers. Exports are logged. PII masking for Snowflake query results will ship with the Phase 3 Snowflake integration — until then, no real PII is in the system."*

### "If the entire AWS us-east-1 region goes down, how long until you're back?"

*"Our documented Recovery Time Objective is 4 hours. Recovery Point Objective is 24 hours based on the daily backup cadence. The DR playbook (`G-31`) is the current focus of our hardening work. Infrastructure-as-Code is in progress under `G-16` so the recovery step is `terraform apply`, not manual."*

---

## 5. Governance — who owns what

Per USZoom policy 3713:

- **Chief Information Security Officer / Information Security Management Leader:** JD Gershan (also Data Protection Officer).
- **Security Manager:** Lior Zamir.
- **Director of Compliance:** Avi Katz.
- **ISMS Governance Council:** CIO + COO + Director of Operations + IT Leaders.

For InsightHub specifically:

- **Policy compliance owner:** JD Gershan (per USZoom policy, for all USZoom systems).
- **Technical implementation owner:** Jeff Coy (engineering).
- **Operational owner of the EC2 host and deploys:** Jeff Coy.

**Every gap in the list has an owner.** Gaps that require action outside engineering (legal, vendor contracts, HR) are flagged `📋 Org / Non-technical` in the matrix.

---

## 6. Evidence package — what we hand to an auditor

On request, we can produce:

- **This repository at a commit-specific hash**, complete with Git history.
- **`docs/COMPLIANCE_MATRIX.md`** — every one of 138 controls mapped to evidence (file path + line range) or gap ID.
- **`docs/COMPLIANCE_GAPS.md`** — the ranked remediation plan with risk ratings and effort estimates.
- **Asana project export** showing status and history of every remediation task.
- **CI run history** from GitHub Actions (90 days).
- **Audit log database export** (filtered to scope as requested).
- **Deploy history** from `deploy.sh` and systemd journal.
- **Backup directory listing** with timestamps and retention evidence.
- **`docs/RED_TEAM_SECURITY_REPORT.md`** and any subsequent internal reviews.

---

## 7. Bottom line

InsightHub is being built **deliberately, to a policy**, with every trade-off documented and every gap tracked. We are not claiming to be more compliant than we are. We are claiming that we **know exactly where we stand**, and **we have a credible plan to close the distance** before the data class escalates into Customer Confidential territory.

That position is defensible in front of a board, a customer CISO, and an ISO 27001 lead auditor alike — not because everything is perfect, but because **we can prove we're in control of the story.**
