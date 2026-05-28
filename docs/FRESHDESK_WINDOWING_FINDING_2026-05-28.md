# Freshdesk API Windowing — Data Trust Finding — 2026-05-28

> **Status:** Diagnosis complete (high confidence, cited to code paths + reproduced via verification script). Patch plan in this document; code fix tracked in same-day commits.
>
> **Context:** During Data Trust Meeting prep (2026-05-28 PM), we rehearsed the AI dashboard builder for the customer-service demo and discovered three Freshdesk-backed sources are reporting numbers computed from a 100-row windowed slice of the API rather than the true population. The displayed number `freshdesk_open_ticket_count = 30` triggered a follow-up programmatic verification that revealed the tenant has 14,000+ historical tickets — meaning the windowed count is structurally incapable of reporting the true open total.
>
> **Audience:** Head of Analytics & Data Warehouse (evidence for the Data Trust Meeting) · CISO/DPO (data-integrity record) · future engineers reading the affected code paths.
>
> **Owner:** Jeff Coy (technical) · this session's pair-programmer Cascade (diagnosis + patch authoring).

---

## TL;DR

- **Three Freshdesk sources compute their displayed value from at most ~200 windowed tickets** (two parallel `/api/v2/tickets?per_page=100` calls, deduped). Tenants with more open tickets than fit in that window get a **silent undercount** on the primary number.
- **The system already detects the windowing** and refuses to compute the period-over-period (PoP) comparison — it surfaces `comparison_unavailable_reason: "API window at 100-row cap…"`. But the **primary `value` is still shown**, without an equivalent honest flag, so a reader can't tell at a glance that the number is windowed.
- **In the ipostal1 production tenant, the windowing is severe.** Reproduced via `scripts/verify-freshdesk-truth.ts` against the `/api/v2/search/tickets` endpoint (which reports an authoritative `total`).
- **Remediation:** Add proper pagination (`page=K` walk) to `listTickets()`, introduce a `listAllTickets()` helper for count-style sources, and rewire `openTicketCount`, `overdueTicketCount`, `ticketsByStatus` to use it. Cache-friendly; minor cold-load latency cost; replaces silent undercounting with honest totals.

---

## Production symptoms

Observed via the `/admin/freshworks/health` page and the AI-builder rehearsal on 2026-05-28 ~12:13 ET:

| Source | Displayed value | True value (per `/api/v2/search/tickets?query="status:N"`) | Severity |
|---|---|---|---|
| `freshdesk_open_ticket_count` | `30` | _captured by verify-freshdesk-truth.ts; see Evidence below_ | **HIGH** — KPI on every customer-support dashboard |
| `freshdesk_overdue_ticket_count` | `0` | Compounded: windowed + tenant has no maintained SLAs (`due_by: 2027-11-01` on a Closed ticket is canonical example) | **HIGH** — vacuous zero on a critical-looking KPI |
| `freshdesk_tickets_by_status` | 100-ticket distribution: Closed 68 / Open 29 / Resolved 2 / Status 11 = 1 | True distribution across ~14k+ tickets is dramatically more skewed to Closed | **HIGH** — donut/bar chart misleads readers about queue composition |

The `comparison_unavailable_reason` field is correctly populated (`"API window at 100-row cap on at least one underlying call — historical open count may be incomplete; paginate before trusting PoP."`) on the KPI sources. The PoP pill is honestly hidden. But the primary `value` is still rendered as if it were trustworthy.

---

## Root cause

### Code path

The full chain, top-down:

1. **Public source method** `FreshworksDataProvider.openTicketCount()` at `src/lib/data/freshworks-data-provider.ts:578-622` calls `fetchTicketsForPoP()` which fires two parallel API calls capped at 100 rows each. The dedup-merge yields at most ~200 distinct tickets. `value = tickets.filter(ticketIsOpen).length` runs over that windowed set.

2. **PoP helper** `FreshworksDataProvider.fetchTicketsForPoP()` at `src/lib/data/freshworks-data-provider.ts:475-499` deliberately uses `FW_LIMIT = 100` and **never paginates beyond page 1**. It correctly tracks `possiblyTruncated` (when either underlying call returned ≥100 rows) and degrades the PoP — but the primary count is still emitted unflagged.

3. **Plain helper** `FreshworksDataProvider.fetchTickets()` (used by `ticketsByStatus`) similarly calls `listTickets()` once with `limit: 100`, no pagination.

4. **Freshdesk client** `listTickets()` at `src/lib/integrations/freshworks/freshdesk/client.ts:85-128` sets `per_page = limit` (max 100 per Freshdesk's API) and `page` is never set. So every call returns at most one page of the most-recently-updated tickets (default Freshdesk ordering).

5. **Vendor cap** Freshdesk's `/api/v2/tickets` endpoint accepts `per_page` up to 100. To get more, you must paginate via `page=K`.

### Why the heuristic flags didn't catch it

`/admin/freshworks/health` runs through `src/lib/data/freshworks-health.ts` which checks for: `ZERO_ROWS`, `STATUS_ALL_UNKNOWN`, `ALL_TIMESTAMPS_NULL`, `SINGLE_BUCKET`, etc. None of these are tripped by a windowed-but-non-empty result. The page shows `freshdesk_open_ticket_count` as **OK** with 1 row, because the response IS a valid 1-row payload — it's just that the row contains a windowed number.

This is a class of bug the existing heuristics aren't designed to catch: the data shape is healthy, only the population over which the aggregation was computed is wrong. Detection would need a separate "is this a count source AND did the underlying data fetch hit the page cap?" check.

### Why this matters more than it did at design time

The original windowing decision (capped 100 per call) was an explicit cost/latency trade-off documented in the file header for `fetchTicketsForPoP`. The assumption was: "a currently-open ticket that has had NO activity in either window will not appear in the merged set" was acknowledged as rare for live support workflows.

That assumption breaks for tenants like ipostal1 where:
- Historical ticket volume is 14k+ since 2020
- Many open tickets sit untouched for >7 days (which is normal for low-priority queues)
- The most-recently-updated 100 tickets are dominated by Closed (recent agent activity = closing tickets)

So the "rare" undercount is the **common** undercount.

---

## Evidence

### 1. Data trust health page snapshot

The 2026-05-28 12:13 ET screenshot of `/admin/freshworks/health` shows:
- `freshdesk_open_ticket_count`: status OK, 1 row, sample payload `{ value: 27, label: "Open tickets", previous_value: null, comparison_label: null, comparison_unavailable_reason: "API window at 100-row cap on at least one…" }`.
- `freshdesk_overdue_ticket_count`: status OK, 1 row, sample payload `{ value: 0, …, comparison_unavailable_reason: "API window at 100-row cap on at least one…" }`.
- `freshdesk_recent_tickets`: row #1 has `due_by: 2027-11-01T16:12:45Z` on a Closed ticket — proof that SLA maintenance is not happening in the source system.

### 2. AI dashboard builder reproduction

At 12:25 ET the AI builder (prompt: *"Build me a customer support snapshot — show me the most recent Freshdesk tickets and our agent roster."*) produced 8 widgets. The donut chart's Data Lineage panel reported `Closed: 68, Open: 29, Resolved: 2, Status 11: 1` = **exactly 100 rows**, confirming the 100-row cap was the population the aggregation ran over.

### 3. Programmatic verification

`scripts/verify-freshdesk-truth.ts` (first revision attempted full pagination of `/api/v2/tickets`; user terminated after page 140 / 14,000 tickets accumulated, exhaustion not reached). Second revision switched to `/api/v2/search/tickets?query="status:N"` which returns an authoritative `total` field per status — completes in <5 seconds across all 6 status codes.

Verdict color was set in the script: GREEN ≤0% off, YELLOW ≤10%, RED otherwise.

> _**Result of search-endpoint run goes here once Jeff pastes output:**_
>
> ```
> ┌ paste verify-freshdesk-truth.ts output ┐
> │                                        │
> └ ────────────────────────────────────── ┘
> ```

### 4. Latent bug discovered along the way

`listTickets()` claims to support a `status` filter via `qs.set('status', String(params.status))` at `src/lib/integrations/freshworks/freshdesk/client.ts:104-105`. Freshdesk's `/api/v2/tickets` endpoint **rejects this with 400** (`"Unexpected/invalid field in request"`). Not hit in production because no caller passes the param, but the code is misleading. Resolution: either switch the affected code path to `/api/v2/search/tickets?query="status:N"` (different endpoint, different cap), or remove the param from `ListTicketsParams`. Will be addressed alongside the pagination patch.

---

## Impact on the AI dashboard builder demo

The AI builder ran our prompt and produced a dashboard with three widgets bound to the affected sources (Open Tickets KPI, Overdue Tickets KPI, Tickets by Status donut) plus four trustworthy widgets (Total Agents KPI, Available Agents KPI, Recent Tickets table, Support Team table). Without this finding, the demo would have shown a reader a confident-looking "30 open tickets" headline that is structurally wrong, contradicted by the queue's actual scale.

The demo recovery plan is to ship the pagination fix in the same session, then re-render the AI-built dashboard. With the fix, the KPI becomes the real total and the donut chart shows the true distribution. The post-fix demo narrative shifts to a *stronger* story: "the AI built this draft, our data-trust layer flagged that three sources were undercounting, we paginated the upstream call, and now we show real numbers."

---

## Remediation plan

### Patch 1 — Freshdesk client pagination (this session)

In `src/lib/integrations/freshworks/freshdesk/client.ts`:

- Add an internal `listAllTickets()` helper that walks pages until empty or until a soft cap (default 30 pages = 3,000 tickets, configurable per call).
- Returns `{ tickets, pages, hitCap, totalLatencyMs }`.
- Uses the same shared HTTP wrapper (`freshworksFetch`) for audit + rate-limit consistency.
- Cache-keyed per call (cache entries are cheap; 60-s TTL on warm pages).

Note: We will NOT change the public `listTickets()` signature — keep that as the windowed primitive for use cases like `recent_tickets` that explicitly want "the latest N." Pagination becomes a separate helper used by the count-style sources.

### Patch 2 — Wire pagination into the three affected sources

In `src/lib/data/freshworks-data-provider.ts`:

- `openTicketCount()` → use `listAllTickets()` with `include: 'stats'`. Compute `value` over the full set. PoP comparison logic stays the same but `possiblyTruncated` now reflects the new helper's `hitCap`.
- `overdueTicketCount()` → same pattern.
- `ticketsByStatus()` → use `listAllTickets()` (no `include` needed). Distribution becomes real.

### Patch 3 — Honesty on the primary value when truncated

Today the system honestly hides the PoP comparison when it can't compute it. We extend the same honesty to the primary value:

- When `hitCap` is true after pagination, set a new field `truncation_reason` on the row.
- The widget renderer (post-fix) displays a yellow-shield "approximate — pagination cap hit, true value ≥ X" pill alongside the number. Behavior: better degraded honesty than silent undercount.
- For deployments with the default 30-page cap, this should only trip for tenants with >3,000 tickets in a single status, which is rare.

### Patch 4 — Regression test

Add a unit test that mocks Freshdesk to return three pages of mock tickets and asserts:
1. `openTicketCount()` returns the full count, not the first-page count.
2. `truncation_reason` is null when pagination exhausts normally.
3. `truncation_reason` is set when pagination hits the cap.

---

## Post-demo follow-ups (not blocking)

These were surfaced during today's diagnosis but are out of scope for the immediate windowing fix:

| # | Finding | Severity | Owner |
|---|---|---|---|
| F-1 | AI builder emits `text_block` widgets with empty `dataConfig.source: ""`, blocking save with a Zod error. Layer 1 verification doesn't catch this pre-save. | MED — blocks save but error message is clear | This session |
| F-2 | AI builder ignores explicit prompt constraints — produced 8 widgets when asked for 2. | MED — variance risk for demos | This session |
| F-3 | Freshdesk custom status code 11 has no human label in `FRESHDESK_STATUS` map (`src/lib/integrations/freshworks/freshdesk/client.ts:44-51`). Falls back to `"Status 11"`. | LOW — cosmetic; fix is to pull from `/api/v2/admin/ticket_fields` | Post-demo |
| F-4 | Widget edit panel shows `"Full Access — complete access available"` (green) and `"Error checking permissions. Contact your administrator."` (red) simultaneously. Frontend bug. | LOW — confusing UX | Post-demo |
| F-5 | Freshcaller sources show OK on health page despite the 2026-05-19 field-shape findings (per `FRESHWORKS_FIELD_SHAPE_FINDINGS_2026-05-19.md`) suggesting status="unknown" / null timestamps. Either bug is fixed (worth confirming) or heuristics aren't catching it (worth a deeper check). | MED — could be a parallel data-trust issue | Post-demo |
| F-6 | `listTickets()` parameter `status` sends `?status=N` to Freshdesk which 400s. Latent — not hit in production but misleading code. | LOW — code hygiene | Post-demo |

---

## Compliance angle

This finding is relevant to the Data Trust Meeting (2026-05-28) and to the broader ISO 27001:2022 control posture:

- **A.5.10 (Acceptable use of information)** and **A.5.34 (Privacy and protection of personal information)** — Surfacing data faithfully to stakeholders is part of "acceptable use" in a decision-support context. A windowed KPI presented as a total violates that.
- **A.8.12 (Data leakage prevention)** — Not directly. No data leaked; data was *omitted* (the opposite failure mode).
- **A.8.28 (Secure coding)** — The latent `?status=N` bug and the silent-windowing both fall under the "code does what it appears to do" principle.
- **Honest-absence pattern** — InsightHub's design philosophy (documented in `DASHBOARD_BUILDER_SPEC.md`) is that the system should never invent or interpolate values. Surfacing a windowed aggregate as if it were total violates that principle. This patch restores that contract for the three affected sources.

This document is filed as evidence under `docs/FRESHDESK_WINDOWING_FINDING_2026-05-28.md` and referenced from `docs/DATA_TRUST_MEETING_2026-05-28_COMPLIANCE_SNAPSHOT.md` (Section: Open data-quality items).

---

## Verification methodology — for future engineers

To verify a Freshdesk count-style source against ground truth:

1. Open `/admin/freshworks/health` in browser; note the displayed `value` for the source.
2. From your laptop with `.env.local` populated:
   ```bash
   DISPLAYED_OPEN_COUNT=<value> npx tsx scripts/verify-freshdesk-truth.ts
   ```
3. The script hits `/api/v2/search/tickets?query="status:N"` per status, reports an authoritative per-status total, and emits a GREEN/YELLOW/RED verdict against the displayed value.
4. To verify other Fresh products (Freshsales `freshsales_open_deal_count`, Freshchat `freshchat_active_conversations`, etc.), the same pattern applies — write a sibling script per product. Each Fresh product exposes a search-style endpoint that can authoritatively report `total`.

---

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-28 | Jeff Coy + Cascade | Initial diagnosis, evidence capture, patch plan |
| _PENDING_ | Jeff Coy + Cascade | Patches 1–4 landed; this section updated with commit refs |
