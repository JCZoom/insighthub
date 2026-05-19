# InsightHub — Vendor Register

> **Policy reference:** USZoom Policy **3720** Third-Party Management; ISO 27001:2022 Annex A.15 (Supplier Relationships).
> **Gap partial-closure:** G-26 (Vendor Register). Full closure also requires quarterly DPA-review cadence and SOC-report-on-file storage — established below.
> **Review cadence:** Quarterly (synchronized with Asset Register and Risk Register).
> **Owner:** Jeff Coy (technical) + JD Gershan (policy-level supplier governance).
> **Last reviewed:** 2026-05-19 (created + same-day Freshworks suite expansion: Freshsales V-01, Freshdesk V-11, Freshcaller V-12, Freshchat V-13)
> **Next review due:** 2026-08-19

---

## How this register works

Per USZoom Policy 3720, every third-party service that stores, processes, or transmits InsightHub data must be tracked with:

1. **Identity** — vendor legal name, product, primary contact.
2. **Data class processed** — the highest sensitivity tier the vendor sees (per Policy 3698).
3. **Contract** — DPA / MSA in place; renewal date; exit clause.
4. **Attestation** — SOC 2 / ISO 27001 / equivalent report on file with date.
5. **Residual risk** — what could go wrong AT the vendor and how we'd recover.
6. **Exit strategy** — concrete steps to replace the vendor without permanent data loss.

The register complements the **Service Assets** section of `docs/ASSET_REGISTER.md` (SVC-NN entries) — the asset register tracks what we depend on, this register tracks the contractual and governance posture around each dependency.

---

## Active vendors

### V-01 — Freshworks Inc. (Freshsales CRM)

- **Asset reference:** SVC-14, INFO-24/25/26
- **Product:** Freshsales (CRM module of the Freshworks Customer Service Suite)
- **Data class processed:** **CUSTOMER_CONFIDENTIAL** — contacts, deals, chat content, full PII
- **Onboarded:** 2026-05-19
- **Primary contact:** Jeff Coy (technical owner) + JD Gershan (compliance approver)
- **API surface in use:** REST API (read-only initially: contacts, accounts, deals)
- **Attestation on file:** SOC 2 Type II (current, per public Freshworks Trust page — independent copy to be requested and stored in `docs/evidence/freshworks-soc2-2026.pdf` before 2026-06-19)
- **DPA status:** ⚠️ **Not formally executed** as of 2026-05-19. USZoom has a master service agreement with Freshworks; an InsightHub-scoped DPA addendum is to be requested. Action: Jeff to email Freshworks account team by 2026-05-22.
- **Data flow:** InsightHub server reads from Freshsales REST API (TLS 1.2+, API-token auth) → caches 60 s in Redis → renders to authorized roles → never persists to InsightHub primary DB beyond cached form.
- **Residual risk:** R-041 (token compromise = full tenant read/write) + R-042 (stale-cache PII exposure). See `docs/RISK_REGISTER.md`.
- **Exit strategy:**
  1. Customer-export Freshsales account/contact/deal CSVs via the Freshsales export API.
  2. Disable `FRESHSALES_API_KEY` on USZoom Freshworks tenant.
  3. Remove Freshworks integration from `src/lib/integrations/freshworks/freshsales/`.
  4. Replace with HubSpot or Salesforce per existing connector pattern (the suite refactor isolates each product, so swap-out doesn't touch the other 3).
  5. Estimated cutover time: ~4 hours of code + 1 hour of operator work.
- **Renewal:** USZoom-level Freshworks contract — confirm renewal date with USZoom procurement before 2026-08-19 review.

### V-11 — Freshworks Inc. (Freshdesk — support tickets)

- **Asset reference:** SVC-15, INFO-27/28
- **Product:** Freshdesk (support / ticketing module of the Freshworks suite)
- **Data class processed:** **CUSTOMER_CONFIDENTIAL** — tickets, conversation threads, requester PII (email/name/phone), agent identities
- **Onboarded:** 2026-05-19 (alongside V-01)
- **Primary contact:** Same as V-01 (Jeff Coy / JD Gershan)
- **API surface in use:** REST API v2 (read-only: tickets, agents); auth via HTTP Basic with `<api-key>:X` base64-encoded
- **Attestation on file:** Inherits Freshworks Inc. SOC 2 / ISO 27001 (same parent corp as V-01)
- **DPA status:** ⚠️ Same status as V-01 — covered by the same to-be-executed addendum
- **Data flow:** REST API (TLS 1.2+) → 60 s Redis cache under `fw-desk:*` → field-level PII masking → render
- **Residual risk:** R-043 (Freshdesk token compromise → unauthorized ticket read/write including full customer support history)
- **Exit strategy:**
  1. Export tickets via Freshdesk CSV export.
  2. Disable `FRESHDESK_API_KEY` on USZoom Freshworks tenant.
  3. Remove `src/lib/integrations/freshworks/freshdesk/` (touches no other product).
  4. Replace with Zendesk or HelpScout (similar REST conventions).
  5. Estimated cutover: ~4 hours code + 1 hour operator.

### V-12 — Freshworks Inc. (Freshcaller — voice / calls)

- **Asset reference:** SVC-16, INFO-29/30
- **Product:** Freshcaller (cloud phone / call center)
- **Data class processed:** **CUSTOMER_CONFIDENTIAL** — call records (phone numbers, durations, dispositions), voicemail transcripts, recording URLs
- **Onboarded:** 2026-05-19 (alongside V-01)
- **API surface in use:** REST API v1 (read-only: calls, users); auth via non-standard `X-Api-Auth` header
- **Attestation on file:** Inherits Freshworks Inc. SOC 2 / ISO 27001
- **DPA status:** ⚠️ Same status as V-01 — covered by the same to-be-executed addendum
- **Data flow:** REST API (TLS 1.2+) → 60 s Redis cache under `fw-call:*` → mask phone/recording URLs for non-privileged roles → render. Recordings themselves stay at the vendor; we only ever hold signed URLs.
- **Residual risk:** R-044 (Freshcaller token compromise → unauthorized access to call recordings + voicemail transcripts, both treated as the highest tier of voice PII)
- **Exit strategy:**
  1. Export call CDR via Freshcaller export (recordings remain at vendor — request explicit export).
  2. Disable `FRESHCALLER_API_KEY`.
  3. Remove `src/lib/integrations/freshworks/freshcaller/`.
  4. Replace with Aircall or Dialpad.
  5. Estimated cutover: ~3 hours code + 1 hour operator.

### V-13 — Freshworks Inc. (Freshchat — messaging)

- **Asset reference:** SVC-17, INFO-31/32
- **Product:** Freshchat (live chat + messaging across web/mobile/in-app)
- **Data class processed:** **CUSTOMER_CONFIDENTIAL — highest PII density in the suite.** Conversation message bodies may contain customer SSNs, account numbers, addresses, family relationships.
- **Onboarded:** 2026-05-19 (alongside V-01)
- **API surface in use:** REST API v2 (read-only: conversations, users); auth via `Authorization: Bearer <token>`; API host `api.freshchat.com` (global; tenant URL `ipostal1.freshchat.com` is UI-only)
- **Attestation on file:** Inherits Freshworks Inc. SOC 2 / ISO 27001
- **DPA status:** ⚠️ Same status as V-01 — Freshchat addendum may need explicit data-residency clause given message-body sensitivity. Action: include in Jeff's 2026-05-22 outreach.
- **Data flow:** REST API (TLS 1.2+) → 60 s Redis cache under `fw-chat:*` → message_parts[].text.content **always masked for VIEWER/CREATOR by default** → render. Unmask requires admin override that emits a `FRESHWORKS_UNMASK_OVERRIDE` audit event.
- **Residual risk:** R-045 (Freshchat token compromise → access to all customer-agent chat history including data the customer would never have agreed to expose to a third-party analytics tool)
- **Exit strategy:**
  1. Export conversation history via Freshchat customer-export API (may require admin escalation).
  2. Disable `FRESHCHAT_API_KEY`.
  3. Remove `src/lib/integrations/freshworks/freshchat/`.
  4. Replace with Intercom or Drift.
  5. Estimated cutover: ~3 hours code + 1 hour operator.
- **Special handling note:** Per the Game Plan §3 amendment, message bodies must NEVER be unmasked for VIEWER role even by admin override without a documented business justification recorded in the audit log's `reason` field.

### V-02 — Anthropic, PBC (Claude API)

- **Asset reference:** SVC-03, INFO-09
- **Product:** Claude API (chat completions, structured output)
- **Data class processed:** UR (chat content may contain business terms; no customer PII today)
- **Onboarded:** 2026-Q1 (pre-policy era)
- **Attestation on file:** SOC 2 Type II (current — last verified 2026-04-24)
- **DPA status:** ✅ Standard Anthropic DPA accepted via API ToS
- **Residual risk:** API key compromise → unauthorized inference billed to InsightHub. Mitigated by per-key spend caps (Anthropic console).
- **Exit strategy:** swap to SVC-04 (OpenAI) or self-host an OSS model (Mistral, Llama). Code path is provider-agnostic in `src/lib/ai/`.

### V-03 — OpenAI, OpCo, LLC (Whisper, embeddings)

- **Asset reference:** SVC-04, INFO-10
- **Product:** OpenAI API (transcription via Whisper, optional embeddings)
- **Data class processed:** UR (voice transcript content)
- **Attestation on file:** SOC 2 Type II (current)
- **DPA status:** ✅ Standard OpenAI DPA accepted via API ToS
- **Residual risk:** API key compromise + voice content leakage. Voice payloads ephemeral (never persisted).
- **Exit strategy:** self-hosted Whisper.cpp on EC2.

### V-04 — Google LLC (Workspace OAuth IdP)

- **Asset reference:** SVC-02, INFO-08
- **Product:** Google OAuth 2.0 / OpenID Connect (Workspace tenant)
- **Data class processed:** CC (authentication identity, MFA assertions, AMR claims)
- **Attestation on file:** SOC 2 Type II, ISO 27001 (current — public Trust page)
- **DPA status:** ✅ Inherited from USZoom-level Google Workspace agreement
- **Residual risk:** Compromise of USZoom Google tenant compromises every InsightHub session. Counter-control: G-02 MFA enforcement in InsightHub itself (closed 2026-05-19).
- **Exit strategy:** Replace with Okta, Auth0, or self-hosted Keycloak — same NextAuth provider pattern.

### V-05 — Amazon Web Services, Inc. (us-east-1)

- **Asset reference:** SVC-01, HW-01/02
- **Product:** EC2 + EBS + Route53 + (planned) S3, KMS, Secrets Manager
- **Data class processed:** CC (hosts INFO-01 production database + future backups)
- **Attestation on file:** SOC 2 Type II, ISO 27001, FedRAMP (current — public AWS Artifact)
- **DPA status:** ✅ AWS Customer Agreement + standard GDPR DPA
- **Residual risk:** Single-region dependency. Mitigated by G-13 cross-region backup (code shipped; operator setup pending).
- **Exit strategy:** Migrate workload to Azure or GCP. Gated on G-16 (IaC) — manual migration would take ~1 week today.

### V-06 — GitHub, Inc. (source control)

- **Asset reference:** SVC-05, INFO-04
- **Product:** GitHub repos + GitHub Actions CI
- **Data class processed:** UC (source code, deployment scripts, secrets in CI vars)
- **Attestation on file:** SOC 2 Type II, ISO 27001 (current)
- **DPA status:** ✅ GitHub Customer Terms
- **Residual risk:** Compromise → arbitrary code execution in production via CI. Counter-control: branch protection (G-19) pending; deploy via `workflow_dispatch` only (manual trigger).
- **Exit strategy:** Bitbucket mirror (SVC-06) is the immediate fallback. Git history is fully duplicated; CI would need to be re-implemented in Bitbucket Pipelines.

### V-07 — Atlassian Inc. (Bitbucket — source mirror)

- **Asset reference:** SVC-06
- **Product:** Bitbucket Cloud (read-only mirror of GitHub)
- **Data class processed:** UC
- **DPA status:** ✅ Atlassian Master Subscription Agreement
- **Residual risk:** Low — mirror is read-only fallback.

### V-08 — Asana, Inc. (project management)

- **Asset reference:** SVC-07, INFO-11
- **Product:** Asana (project + task tracking; used for compliance gap tracking + roadmap)
- **Data class processed:** UC (project metadata, gap descriptions, internal commentary — no customer PII)
- **DPA status:** ✅ Asana Customer Agreement
- **Residual risk:** PAT compromise → unauthorized read/write of USZoom Asana. PAT rotated 2026-04-24.

### V-09 — Tailscale Inc. (zero-trust SSH)

- **Asset reference:** SVC-10, INFO-13
- **Product:** Tailscale mesh VPN
- **Data class processed:** UR (SSH session metadata only — no traffic content)
- **DPA status:** ✅ Tailscale Terms of Service + DPA
- **Residual risk:** Compromise of USZoom Tailscale tenant → unauthorized EC2 SSH. Counter-control: AWS Security Group restricts SSH to Tailscale IPs only.

### V-10 — Let's Encrypt (ISRG)

- **Asset reference:** SVC-09, INFO-15
- **Product:** Free TLS certificates via ACME
- **Data class processed:** P (certs are public by design)
- **DPA status:** N/A (no personal data shared)
- **Residual risk:** Low — Let's Encrypt is publicly audited per CA/B Forum. Cert renewal automation via certbot.

---

## Planned vendors (not yet onboarded)

### V-P-01 — Snowflake Inc.

- **Status:** **PENDING APPROVAL** from USZoom data analytics head before any InsightHub-side integration begins.
- **Rationale for the gate:** moving InsightHub data sources into Snowflake materially escalates the data classification of every dashboard and widget to CC (per Phase 3 plan). The Freshsales onboarding (today, 2026-05-19) is the proof-point that InsightHub can handle CC data correctly with bounded retention, audit logs, classification badges, and live retention levers — once that evidence is in front of the data analytics head, the Snowflake conversation can begin.
- **Conditional residual risk:** R-030 (Phase 3 elevation) is the highest-rated open risk at 20.

---

## Quarterly review checklist (due 2026-08-19)

- [ ] For each vendor: confirm SOC 2 / ISO report has not expired. Refresh the on-file PDF.
- [ ] For each CC-tier vendor: confirm DPA is current and signed. Specifically Freshworks (action item from V-01).
- [ ] For each vendor's API key/token: confirm rotation has happened in the last 90 days. If not, rotate.
- [ ] Confirm exit-strategy steps are still accurate (vendor APIs evolve).
- [ ] Move any deprecated vendors into the archive table below.
- [ ] Update the "Last reviewed" date in the front matter.

## Archive (closed/replaced vendors)

| Vendor ID | Product | Closure date | Reason |
|---|---|---|---|
| (none yet) | | | |

---

## Compliance cross-reference

| Vendor | Asset entries | Risk entries | Gap |
|---|---|---|---|
| V-01 Freshsales (CRM) | SVC-14, INFO-24/25/26 | R-041, R-042 | G-26 (this register chips at it) |
| V-11 Freshdesk (support) | SVC-15, INFO-27/28 | R-043 | G-26 |
| V-12 Freshcaller (voice) | SVC-16, INFO-29/30 | R-044 | G-26 |
| V-13 Freshchat (messaging) | SVC-17, INFO-31/32 | R-045 | G-26 |
| V-02 Anthropic | SVC-03, INFO-09 | — | — |
| V-03 OpenAI | SVC-04, INFO-10 | — | — |
| V-04 Google | SVC-02, INFO-08 | — | G-02 (closed) |
| V-05 AWS | SVC-01, HW-01/02 | R-003 (backup isolation) | G-13 |
| V-06 GitHub | SVC-05, INFO-04/05/06 | R-010 (branch protection) | G-19 |
| V-07 Bitbucket | SVC-06 | — | — |
| V-08 Asana | SVC-07, INFO-11 | — | — |
| V-09 Tailscale | SVC-10, INFO-13 | — | — |
| V-10 Let's Encrypt | SVC-09, INFO-15 | — | G-03 (closed) |
