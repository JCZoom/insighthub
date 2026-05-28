# Demo 2026-05-27 — Security & Conformance Brief

> **Audience:** Wednesday demo session — security & ISMS conformance focus.
> **Owner:** Jeff Coy.
> **Companion docs:** `docs/CISO_REPORT_2026-05-25.md` (full), `docs/COMPLIANCE_GAPS.md` (gap-by-gap), `docs/STATEMENT_OF_APPLICABILITY.md` (ISO 27001 SoA), `docs/RISK_REGISTER.md`.

---

## 30-second elevator version

InsightHub is a USZoom-domain-restricted internal analytics platform built to ISO 27001:2022 / SOC 2 control rigor from day one, even though it isn't currently inside USZoom's SOC 2 attestation scope (iPostal1 is). All 6 Tier-1 audit-blocking gaps are closed in code; one (G-13 offsite backup) is blocked on AWS admin credentials. We have a fully-mapped Statement of Applicability for all 93 ISO 27001:2022 Annex A controls, a real production incident with a complete retro and shipped corrective control as evidence the ISMS works in practice, and a CI-driven deploy pipeline with environment-gated approval that produces an immutable audit trail per release.

---

## The single strongest thing to lead with

**`docs/incidents/INC-20260519-001.md`** — first lived production incident, full retrospective, corrective control shipped same day, regression-tested in CI so it can never silently come back.

Auditors and security stakeholders care less about whether you have an incident response runbook and more about whether you've ever **used** it. We have. The proof is that incident document.

Walk-through script:
1. **What happened:** A misuse of `NEXT_PUBLIC_DEV_MODE` (a Next.js build-baked flag) for a security check meant a `.env.local` change on prod failed to disable the auth bypass — the value was already inlined into the build artifact at CI build time.
2. **How we caught it:** Pre-demo smoke test on 2026-05-19 morning. Operator-detected, within minutes of the deploy.
3. **How we contained it:** Split `DEV_MODE` (server-only, runtime-evaluated, security flag) from `NEXT_PUBLIC_DEV_MODE` (client, build-baked, UI-affordance hint). Rebuilt prod artifact. Two commits: `48c4790`, `3c6126c`.
4. **Corrective control:** `assertEnv()` now hard-throws on `NODE_ENV=production` + `DEV_MODE=true`. Service refuses to start. Deploy fails fast rather than silently bypassing auth. (`@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/env.ts:396-407`)
5. **Preventive control:** Unit-tested in `src/lib/__tests__/env.test.ts` so the check can never be silently regressed.
6. **Documentation update:** New operator pattern documented in `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/env.ts:54-77` for the next person who confuses runtime vs build-baked flags.

This is your ISO 27001 Clause 10 (Improvement) story in one artifact. Memorize the headline: *"Detected, contained, corrected, regression-tested, documented — all in one day."*

---

## State of conformance — one slide

### USZoom ISMS policy mapping (35 policies, 138 controls)

| Status | Count | Δ vs. 2026-04-24 baseline |
|---|---|---|
| ✅ Implemented | ~52 | +18 |
| ⚠️ Partial | ~30 | -6 |
| ❌ Gap | ~26 | -12 |
| 📋 Org / non-technical (USZoom-wide) | 27 | — |
| N/A | 3 | — |

Conformance rose from ~25% to ~38% Implemented in five weeks.

### ISO 27001:2022 Annex A (93 controls) coverage

- **A.5 Organizational** (37): mostly Implemented or Partial; 4 documented as Not Applicable with justification.
- **A.6 People** (8): Partial — relies on USZoom-wide HR controls.
- **A.7 Physical** (14): Mostly Not Applicable (cloud-only) with AWS controls inherited.
- **A.8 Technological** (34): strong coverage with code/config evidence per control.

Authoritative document: `docs/STATEMENT_OF_APPLICABILITY.md`.

---

## Wins worth showing live (each takes <2 min)

### 1. Domain-restricted Google OAuth + MFA enforcement

- **What it does:** Only `@uszoom.com` Google accounts can sign in. ADMIN/POWER_USER roles must have MFA asserted at sign-in (Google `id_token.amr` parsed) or they hit `/auth/mfa-required`.
- **Live URL:** sign in → admin badge in `/admin/users` shows ✅ verified / ⚠️ stale (>7d) / 🔓 missing-required
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:57-121`
- **Audit query:** `SELECT * FROM AuditLog WHERE action='user.login' AND metadata LIKE '%rejected%' ORDER BY createdAt DESC LIMIT 5;`
- **Closes:** G-02, Policy 3692 AUTH-02 / AUTH-06.

### 2. Data classification framework

- **What it does:** Every dashboard and glossary term carries a 4-tier classification (`PUBLIC` / `USZOOM_RESTRICTED` / `USZOOM_CONFIDENTIAL` / `CUSTOMER_CONFIDENTIAL`) plus a data owner. Classification displayed as a colored badge.
- **Live URL:** open any dashboard editor — classification dropdown + badge
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/data/classification.ts`
- **Closes:** G-01, Policy 3698 DC-01..03.

### 3. Retention automation with dry-run preview

- **What it does:** 4 bounded purge functions (chat 90d, audit 365d, inactive users 1095d anonymize-not-delete, Freshworks cache 90d). Anonymization preserves audit FK integrity.
- **Live demo:**
    ```bash
    curl -X POST https://dashboards.jeffcoy.net/api/admin/retention \
      -H 'Content-Type: application/json' -H "Cookie: $ADMIN_COOKIE" \
      -d '{"target":"audit","dryRun":true}'
    ```
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/data/retention.ts`
- **Closes:** G-05, G-06, G-07, G-08, Policies 3700 DR-01, 3699 DD-04 / DD-05, 4133 BK-07.

### 4. CI-driven deploy pipeline with environment approval

- **What it does:** Every production deploy goes through GitHub Actions on a self-hosted runner. Operator no longer holds an SSH key. Production environment requires explicit approval. Workflow log row pinned to `github.sha` is immutable for 90 days.
- **Demo:** `./deploy-ci.sh` from your terminal — show the approval prompt → workflow URL → success/rollback.
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/deploy-ci.sh`, `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/.github/workflows/ci.yml`
- **Closes:** Policy 4427 CM-02 / CM-10, Policy 3718 SE-01 / SE-02.

### 5. SSL Labs A+ + HSTS preload

- **What it does:** TLS 1.2 + 1.3 only, Mozilla intermediate ciphers, OCSP stapling, HSTS 2 years.
- **Live demo:** open https://ssllabs.com/ssltest/analyze.html?d=dashboards.jeffcoy.net
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/infra/nginx-tls-options.conf`
- **Closes:** G-03, Policy 3701 ENC-01 / ENC-04.

### 6. Audit-of-the-audit (data integrity verification)

- **What it does:** AI-built dashboards run through 3-layer verification (deterministic + Claude Haiku semantic + Claude Sonnet escalation). Verdicts surface as a green/yellow/red shield in the chat UI. Materially relevant to data-pipeline integrity controls (Policy 3717 §7.5, Policy 3704 ISMS-04).
- **Live demo:** in the AI dashboard builder, ask for any dashboard and watch the badge appear.
- **Code:** `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/ai/verify-integrity.ts`, spec at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/DATA_INTEGRITY_VERIFICATION_SPEC.md`

---

## The G-13 honest-answer script

If asked: *"Where are your offsite backups?"*

**Don't:** wave it off or claim "we have backups" without context.

**Do say:** *"On-host backups run nightly, AES-256-CBC encrypted, 30-day retention. The cross-region offsite copy to a KMS-encrypted us-west-2 bucket is fully scripted and code-reviewed — `scripts/setup-backup-isolation.sh` plus a written runbook at `docs/BACKUP_ISOLATION_SETUP.md`. We're blocked on AWS admin IAM permissions to execute the bootstrap, which is why the deploy script currently runs with `SKIP_PREFLIGHT=true` as a documented exception. Two-week target on the TODO. Until then, raw risk for a regional outage is real; residual is partly mitigated by daily encrypted local backups and the auto-rollback in `deploy-ci.sh`."*

If asked: *"Why did this drag?"*

**Do say:** *"The local AWS identity is a Lambda-CLI scoped role from a separate workstream — it can't `iam:CreateUser`, `kms:CreateKey`, or `s3:CreateBucket`. We need an admin AWS session on account 734910107398 to run the bootstrap once. Owner-driven; documented; not a missing-discipline failure."*

---

## Q&A you might face — answers ready

| Question | Answer |
|---|---|
| **"Are you in scope for SOC 2?"** | Not currently — USZoom's SOC 2 attestation covers iPostal1 per Policy 6727. We hold InsightHub to the same control bar so it's audit-ready when it does enter scope, e.g. when the Snowflake integration brings Customer Confidential data into routine queries. |
| **"Do you have an Asset Register?"** | Yes — `docs/ASSET_REGISTER.md`. 52 assets across 5 classes. Quarterly review reminder in Asana. |
| **"Risk Register?"** | Yes — `docs/RISK_REGISTER.md`. 40+ risks scored, last reviewed 2026-05-19. |
| **"Statement of Applicability for ISO 27001?"** | Yes — `docs/STATEMENT_OF_APPLICABILITY.md`. All 93 Annex A controls, every row justified. |
| **"How do you handle a security incident?"** | Runbook at `docs/INCIDENT_RESPONSE_RUNBOOK.md` — and we've actually used it. See `docs/incidents/INC-20260519-001.md` for the full retro on the dev-mode-bypass-baked-into-build incident, including the regression test that prevents it ever silently coming back. |
| **"Is MFA enforced?"** | Yes, at the application layer. Google `id_token.amr` parsed at sign-in; ADMIN/POWER_USER blocked unless MFA-asserted; persisted timestamp on `User.mfaVerifiedAt`; admin badge surfaces stale-MFA users. (`src/lib/auth/config.ts:57-121`) |
| **"Are backups encrypted?"** | Yes — AES-256-CBC with `BACKUP_ENCRYPTION_KEY`. EBS volume encryption verified at deploy time as of 2026-05-25 (G-12 closure). Cross-region offsite copy: see G-13 honest-answer script above. |
| **"Where do secrets live?"** | EC2 `.env.local` with `chmod 600`. AWS Secrets Manager migration is a Tier-3 follow-on (G-36) — not blocking SOC 2 Type I, recommended before Type II observation window. |
| **"Are deletes audit-logged?"** | Yes, with audit-before-delete enforced via `auditedDelete<T>()` wrapper that hard-fails on audit-write errors before the destructive operation runs. (`src/lib/audit.ts:223-237`) |
| **"How long do you keep audit logs?"** | 365 days, configurable via `AUDIT_LOG_RETENTION_DAYS`. Purges are themselves audit-logged (`retention.purge_audit` action) so the retention table records its own grooming. |
| **"PII handling?"** | Server-side field stripping in `/api/data/query` for non-FULL CustomerPII access. Freshworks data masked at field level via per-product redactors. Synthetic test data via `@faker-js/faker`. GDPR self-service: `/api/user/export` + `/api/user/delete`. |
| **"Penetration testing?"** | Not yet. Tier-3 item (G-32). Plan: commission Cobalt.io / NCC / Bishop Fox before first SOC 2 attestation. |
| **"Single point of failure on the EC2 box?"** | Yes — single-instance, single-region. Acceptable for current scale and audience. DR plan with RTO/RPO + IaC + restore-drill all Tier-2/3. Documented as accepted risk in `docs/RISK_REGISTER.md`. |
| **"What about the dev-mode flag we heard about?"** | That's INC-20260519-001 — a real incident, fully retro'd. Two flags now exist by design: `DEV_MODE` (server-only, runtime, security) and `NEXT_PUBLIC_DEV_MODE` (client, build-baked, UI-only). The split is documented in code at `src/lib/env.ts:54-77` and unit-tested. The hard-throw on `NODE_ENV=production` + `DEV_MODE=true` is in `src/lib/env.ts:396-407`. CI escape hatch `ALLOW_DEV_MODE_IN_PRODUCTION=1` exists for the single legitimate case (Playwright E2E against a production-shaped artifact). |
| **"Snowflake SQLi paths in the April 19 report?"** | Pinned to Phase 3. Live data sources today are Prisma (sample) + Freshworks REST (4 products) + Platform Health (Prisma). Snowflake provider exists in code but is not invoked by any production query path. SQLi remediation lands alongside Phase-3 activation. |
| **"Why is the database file called `dev.db` in production?"** | Yeah, that's a real one — tracked as G-22 (no dev/staging/prod separation). Cosmetic but I'm not happy about it. Renaming touches `deploy.sh`, `backup-db.sh`, `ci.yml`, and seed scripts; coordinating that into a single change is on the Tier-2 list. |

---

## Pre-demo checklist (Tuesday evening, 2026-05-26)

Run these before the demo and confirm green:

- [ ] **Deploy this branch via `./deploy-ci.sh`** so today's closures (G-12, G-15, G-20) are LIVE on prod. Without this, the gap doc says they're "closed in code; deploy required to land."
- [ ] **Refresh / archive `docs/CISO_REPORT.md`** — replace with a top-of-file note pointing to `docs/CISO_REPORT_2026-05-25.md`. Done as part of today's session deliverables; if not, do it now.
- [ ] **Decide G-13 framing** — either get AWS admin creds and run `./scripts/setup-backup-isolation.sh` (closes the only Tier-1 with provisioning still open) or rehearse the honest-answer script above.
- [ ] **Open `docs/incidents/INC-20260519-001.md` in a tab** — this is your strongest artifact. Be ready to walk through it cold.
- [ ] **Test sign-in flow end-to-end** — go through Google OAuth, confirm MFA enforcement, check the admin badge.
- [ ] **Smoke-test the AI verification badge** — ask the chat for a dashboard and verify the colored shield renders.
- [ ] **Pull up the SSL Labs report URL** in a tab so you can show A+ on demand.
- [ ] **Check `/admin/freshworks/health`** renders cleanly — it's the data-trust diagnostic surface and proves operational maturity around data-quality controls.
- [ ] **Set `caffeinate -s` if you're closing the laptop lid** between sessions so demo prep doesn't sleep.

---

## After the demo — capture commitments

If anyone in the room raises a control or finding I haven't anticipated:

1. Note it verbatim — don't editorialize.
2. After the meeting, file a new `G-NN` row in `docs/COMPLIANCE_GAPS.md` and a corresponding risk in `docs/RISK_REGISTER.md`.
3. Tag the source person as the requester so we can close the loop with them.

If anyone offers to be a reviewer / second set of eyes on a control area, follow up within 24 hours with a specific ask (e.g., "review the audit-log column extension for completeness").

---

## Document version

- **Brief authored:** 2026-05-25 (pair-programming session with Cascade)
- **For demo on:** 2026-05-27
- **Owner:** Jeff Coy
- **Cross-references kept current:** if `docs/COMPLIANCE_GAPS.md` updates after this date, prefer that document for current gap status.
