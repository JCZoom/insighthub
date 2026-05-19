# Demo 2026-05-20 — Talking Points

> **Audience:** JD Gershan (CISO/DPO), Lior Zamir (Security Manager), Avi Katz (Director of Compliance).
> **Purpose:** Walk through InsightHub's current security posture and the Freshworks suite integration as the proof-point for the Snowflake-gating conversation.
> **Length target:** 30 minutes (20 min walkthrough + 10 min Q&A).
> **Presenter:** Jeff Coy.
> **Pre-read:** This document + `docs/COMPLIANCE_GAPS.md` (skim the closures table).

---

## 0. Opening framing (2 min)

> "You asked me to bring Freshworks data into InsightHub. Today's demo is two stories at once: (1) we did that — all 4 Freshworks products — and (2) we used the integration as the forcing-function to close the Tier-1 compliance gaps that were blocking the Snowflake conversation. I'm here to show you the controls, not the data. The data is a side effect."

Lead with the gap-closure summary. Don't open the dashboard first.

---

## 1. Tier-1 gap closures (5 min)

> "Five Tier-1 compliance gaps were open at start of day. As of this morning, all five are closed."

Walk through one slide-equivalent per gap (no slides — just read from `docs/COMPLIANCE_GAPS.md` evidence blocks):

| Gap | Closure |
|---|---|
| **G-02 — MFA enforced at app layer** | NextAuth callback now reads the Google OIDC `amr` claim; admin-role sessions without `mfa` get rejected to `/auth/mfa-required`. `mfaVerifiedAt` column persisted; admin users page shows verified/stale/missing badges. |
| **G-03 — TLS pinning** | `infra/nginx-tls-options.conf` pins Mozilla intermediate ciphers + HSTS 2y + OCSP stapling. SSL Labs grade target: A+. (Live scan pending post-deploy.) |
| **G-05 — Retention/disposal automation** | 4 bounded purge functions in `src/lib/data/retention.ts` (chat, audit, inactive users, Freshworks cache) + daily cron + dryRun preview + meta-audit. |
| **G-06 — Audit log retention upper bound** | `purgeAuditLogs(365d)` + meta-fingerprint audit on the purge itself. |
| **G-08 — Deletion audit consistency** | `auditedDelete<T>()` wrapper enforces audit-before-delete. Dashboard share DELETE gap closed (was missing the audit emit). |

> Reference: `docs/RISK_REGISTER.md` rows R-002, R-008, R-021, R-028, R-029 moved to the closed/superseded table this morning.

---

## 2. Freshworks suite walk-through (15 min)

### 2a. The "what" (2 min)

> "InsightHub now talks to all 4 Freshworks products: Freshsales (CRM), Freshdesk (support), Freshcaller (voice), Freshchat (messaging). One unified connector layer, 4 product clients, every product gets its own auth scheme, rate limit, cache namespace, and PII redactor."

Open `src/lib/integrations/freshworks/` in a file tree to show the structure.

### 2b. Open the diagnostics page (2 min)

```
https://dashboards.jeffcoy.net/api/admin/freshworks/diagnostics
```

> "This is the admin-only health check. Note three things: (1) every API key is shown only as `first-4…last-2` — the raw key never leaves the connector. (2) Each product is configured independently. (3) The cache layer is shared but namespaced per product."

### 2c. Open the suite dashboard (3 min)

```
https://dashboards.jeffcoy.net/demo/freshworks-suite
```

Point at:
1. **The classification badge** — every widget is auto-tagged `CUSTOMER_CONFIDENTIAL`. Hard-coded; admins cannot downgrade per G-01.
2. **The masked/unmasked banner** — "I'm signed in as ADMIN so I see unmasked. Let me sign in as a VIEWER and show you what they see."
3. **Sign in as a VIEWER**, reload. Show: names become initials, emails become `j***@uszoom.com`, phone numbers become `***-***-1234`, ticket subjects become `<masked: 87 chars>`, chat message bodies become `***`.

> "Masking is on by default. Unmasking for VIEWER on a specific widget requires an explicit admin override that emits a `FRESHWORKS_UNMASK_OVERRIDE` audit event with a reason field."

### 2d. The retention demo (3 min — this is the strongest moment)

> "The 60-second cache TTL means Freshworks data is in our Redis for at most 60 seconds per key. But what if I get a request mid-session to purge everything — say, a customer invokes their right-to-erasure and you need proof we wiped our copy within hours, not days?"

Sign back in as ADMIN.

1. Show the bar chart and KPI numbers — note the values.
2. Click **"Purge ALL Freshworks caches now"** at the bottom of the suite page.
3. Show the success message: "Deleted N cache keys across all 4 products."
4. Click **"Reload page to re-fetch"**.
5. Show the page re-rendering — values may shift slightly because Redis was cold and we hit the live APIs again.
6. Open a second tab to `/api/admin/audit?action=retention.purge_freshworks_cache` and show the entry that was emitted at the moment of the click.

> "End-to-end: customer invokes erasure → admin clicks one button → cache wiped → audit log has the proof → 60 seconds later the next request re-hydrates from the vendor (where the customer's data is being deleted in parallel by the vendor's GDPR pipeline)."

### 2e. The audit trail (2 min)

> "Every read of Freshworks data emits an audit event tagged with the product, the row count returned, whether it was a cache hit, and a PII-free filter description. No row contents — never PII in the log itself."

Open `/api/admin/audit?action=integration.freshworks.read&limit=20` and read 2-3 entries.

### 2f. The token isolation (1 min)

> "One more thing. Every other secret in this app is in `.env.local` on the production host, which is copied via scp — that's flagged as risk R-004 / gap G-36. The 4 Freshworks API keys are in a separate file — `/opt/insighthub/.env.freshworks` — that the deploy script never touches. It's provisioned and rotated in place via SSH. That's a free partial mitigation of G-36 for the most sensitive credentials we have."

Reference: `docs/FRESHWORKS_OPERATOR_RUNBOOK.md`.

### 2g. Live build: Freshworks data inside the dashboard builder (3 min)

> "The static `/demo/freshworks-suite` page you just saw was the contract test — a controlled environment that proves the connector layer works end-to-end. The real proof for an operator is: can a non-engineer build a dashboard against Freshworks data themselves, with the same controls applied automatically? Yes. Let me show you."

Open `/dashboard/new` (or any existing dashboard in edit mode), click "Add Widget", switch to the **Data** tab, open the **Data Source** dropdown.

> "Here are all 17 Freshworks suite sources — Freshsales (CRM), Freshdesk (support), Freshcaller (voice), Freshchat (messaging) — sitting alongside the sample-data sources. They appear here only because the per-product API key is configured on this server; if `FRESHCALLER_API_KEY` were missing, those entries would be omitted entirely."

Pick `Freshsales Pipeline Value`. Set widget type to KPI Card. **Leave the aggregation field empty** — the source returns a single `{ value, label }` row and the KPI card auto-resolves to the `value` field. (If you want to be explicit, type `value` — *not* `pipeline_value`; that field name doesn't exist in the row shape returned by `FreshworksDataProvider.pipelineValue()`.) Save.

The widget should render approximately **$30,540** (the live Freshsales open-pipeline total at the time of the demo). If you see something in the millions like "$2.9M" you are looking at sample-data leakage from before commits `6503391` + `9fcf273` landed — that bug is fixed; if it reappears, halt the demo and check the deploy.

> "That widget is now hitting the Freshsales API live, with the same 60-second cache, the same `integration.freshworks.read` audit log entry, the same `CUSTOMER_CONFIDENTIAL` classification badge, and the same role-based masking we just demonstrated. The dashboard layer is unaware that this widget points at Freshworks instead of sample data — the connector layer handles every compliance-relevant detail."

Open `/admin/audit?action=integration.freshworks.read&limit=5` in a second tab. Show the audit row from the widget render that just happened — *this* is the proof that the widget is hitting the live API, not a cached generator.

> "RBAC enforcement is identical to any other source. A VIEWER without Sales-category access doesn't see Freshsales sources in this dropdown at all, and a direct API call from their session returns 403 with an audit entry."

Reference: commit `4f46a0e` (`feat(builder): wire Freshworks suite into the dashboard builder`).

### 2h. The forward path to Snowflake (2 min)

> "What you just saw is the proof you asked me for. Freshworks data is more sensitive than what Snowflake will hold today (Freshchat alone has full message bodies). We're handling it correctly — classification, masking, audit, retention, token isolation, rate limiting, per-product blast-radius bounds."

> "I'd like to schedule the Snowflake-gating conversation for next week. The remaining Tier-1 gap (G-13 backup isolation) has the code shipped; only the AWS setup is pending operator action — I'll have that done before the Snowflake meeting."

---

## 3. Q&A primer — anticipated questions (5 min)

### Q: "What if the Freshworks API key leaks?"
A: Rotation procedure documented in `docs/FRESHWORKS_OPERATOR_RUNBOOK.md` §4. Vendor revokes within minutes. Risk R-041/043/044/045 capture this.

### Q: "Why 60-second cache TTL? Doesn't that hammer Freshworks's API?"
A: Each product has a per-minute rate limiter we cap below the vendor's free-tier ceiling. 60 s gives enough rate relief for typical dashboard refresh patterns; PII shouldn't sit longer than that.

### Q: "What's the DPA status?"
A: USZoom has a master Freshworks agreement. The InsightHub-scoped DPA addendum hasn't been countersigned yet — that's risk R-046, tracked under G-26, on Jeff's calendar to email Freshworks's account team by 2026-05-22. Technical access is provisional pending the addendum.

### Q: "Where's the formal access-review process for who can see Freshworks data?"
A: Today: 4-role RBAC (VIEWER/CREATOR/POWER_USER/ADMIN) + masking-by-default for non-privileged roles. Quarterly access review is gap G-09, Tier-2, not closed yet. Targeted for next quarter.

### Q: "What's the runtime cost?"
A: ~$0 today. Freshworks free tier handles current volume. Redis is the only added infra; it's already on the EC2 instance.

### Q: "Snowflake — when?"
A: Conditional on a discussion with the data-analytics head. Phase 3 in the roadmap. Risk R-030 is the highest-rated open risk at 20 (impact 5 × likelihood 4) — closing it requires this Freshworks proof-point.

### Q: "Will this scale to all of USZoom, not just InsightHub?"
A: The shared connector layer (`src/lib/integrations/freshworks/shared/`) is product-agnostic and could be lifted to a USZoom-wide library if needed. But that's a discussion for after the audit, not before.

---

## 4. Backup talking points (if time runs out)

- **Asset register** has 33 information assets tracked across the suite (INFO-24..33 are the new ones).
- **Vendor register** has 13 vendors with DPA/SOC status per row.
- **Risk register** has 46 entries; today moved 5 closures into archive.
- **All compliance docs** live in `docs/` and are committed to the repo — there's nothing in a private spreadsheet that audit can't access via git.

---

## 5. Post-demo follow-ups (action items captured during the meeting)

| Owner | Action | Due |
|---|---|---|
| Jeff | Email Freshworks account team for DPA addendum | 2026-05-22 |
| Jeff | Complete G-13 AWS bootstrap (`scripts/setup-backup-isolation.sh`) | Before Snowflake meeting |
| Jeff | SSL Labs scan on `dashboards.jeffcoy.net`; attach result to `docs/TLS_CONFIGURATION.md` | 2026-05-22 |
| JD | Schedule Snowflake-gating conversation with data analytics head | After this demo |

---

*Last updated: 2026-05-19. Do not edit during the meeting — capture changes here in a follow-up commit afterward.*
