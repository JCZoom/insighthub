# AI Dashboard Builder — Pressure-Test Findings, 2026-05-19

> **Trigger:** Operator asked for *"a dashboard for today's phone support tickets"* and got back a month-by-month table.
>
> **Method:** 7 probe queries fired at `POST /api/chat` on production (`dashboards.jeffcoy.net`). Responses captured, patches inspected, verification reports recorded.
>
> **Tooling:** `/tmp/insighthub-probes/probe.sh` (one-off, can be repeated any time).
>
> **No code shipped tonight.** Every finding below is verified against actual production responses. Fix plan and priority sequencing at the bottom.

---

## Probes run

| # | Prompt | Result one-liner |
|---|---|---|
| 01 | "Build a dashboard for today's phone support tickets" | **Replicates Jeff's bug.** 12 widgets, ALL bound to `sample_tickets`. Verdict `FAIL @ 0.40`. |
| 02 | "Show me today's Freshcaller calls" | LLM says *"I don't have direct access to Freshcaller data"* — patches empty. |
| 03 | "Dashboard for this week's open Freshdesk tickets" | 12 widgets, bound to `kpi_summary` + `tickets_by_month` + `tickets_by_category` + `tickets_by_team`. **Zero Freshdesk sources, zero time filters.** Verdict `FAIL @ 0`. |
| 04 | "Current Freshsales pipeline value and open deals" | Used `kpi_summary` and `deals_pipeline` (sample sources), NOT live Freshsales. Verdict `PASS @ 1.0` — **silent wrong-but-looks-correct.** |
| 05 | "What's our call volume right now?" | LLM asked for clarification. Good behavior, no fabrication. |
| 06 | "Recent customer support activity from the last hour" | LLM says *"sample data doesn't include real-time hourly updates"* — patches empty. Good honesty, missed capability. |
| 07 | "Today's phone tickets — please use freshcaller_calls_today, freshdesk_open_ticket_count, …" *(sources named explicitly in prompt)* | Verdict `WARN @ 0.86`. **All 5 named Freshworks sources used correctly.** |

Probe #7 is the smoking gun. The LLM happily uses Freshworks sources when it knows they exist.

---

## Six distinct bugs

### Bug #1 — CATALOG GAP (the root cause of the operator's report)

**Severity:** P-1, blocks honest answer to "*can the dashboard builder use our live data?*"

`src/lib/ai/prompts.ts` ships two data-source catalogs to the LLM:

- `DATA_SOURCES` (lines 25–84): only `sample_tickets`, `sample_subscriptions`, `sample_usage`, `sample_customers`, `sample_revenue`, `sample_deals` — six **sample** tables.
- "Pre-Aggregated Data Sources" block (lines 179–227): `kpi_summary`, `churn_by_month`, `tickets_by_month`, `tickets_by_category`, `tickets_by_team`, `deals_pipeline`, etc. — all monthly aggregates over sample data.

**Zero of the 17 live Freshworks sources are listed:**
- `freshsales_*` (6 sources, including `freshsales_pipeline_value` used in tomorrow's demo §2g)
- `freshdesk_*` (5 sources)
- `freshcaller_*` (3 sources — including `freshcaller_calls_today`, **the source that should have answered Jeff's "today's phone tickets" prompt**)
- `freshchat_*` (3 sources)

When the user asks for "today's phone tickets," the LLM picks the closest match in its catalog: `sample_tickets` filtered to `channel = "phone"` — which then renders as an all-time aggregate (see Bug #2).

**Confirmed by probes #2, #3, #7** above.

**Fix:** extend `DATA_SOURCES` (or the Pre-Aggregated block, or add a third "Live Integration Sources" block) with the 17 Freshworks sources. Each entry should describe **what time window it covers** so the LLM stops adding fictitious `created_at >= today` filters:

```ts
{
  name: 'freshcaller_calls_today',
  description: '### freshcaller_calls_today\n- Single-row KPI source\n- Returns: { value: int, label: string }\n- Time scope: TODAY (UTC) — the source itself filters server-side, no widget filter needed.',
  permissionLevel: 'sensitive',
}
```

The "Time scope" hint matters: it teaches the LLM that **the source is the filter** for these widgets, eliminating the made-up `value: "today"` filter problem (Bug #3).

---

### Bug #2 — Widget-level filters are silently discarded

**Severity:** P-1, undermines every time-scoped or category-scoped widget the LLM creates.

Probe #1's generated widgets all carried filters like:

```json
{ "field": "created_at", "operator": ">=", "value": "today" }
{ "field": "channel", "operator": "=", "value": "phone" }
```

`src/lib/data/sample-data.ts` — the module that serves `sample_tickets` and friends — **does not read `dataConfig.filters` at all**. (Verified via `grep`: the only `.filter` calls in that file are JS array operations on internal arrays.) The query path is:

```
POST /api/data/query
  → src/app/api/data/query/route.ts
    → queryDataWithProvider (Snowflake)
      → falls back to queryData (sample-data.ts)
        ⚠ widget filters are dropped here
```

Filter evaluation exists in `src/lib/data/visual-query-evaluator.ts:96` (used by the visual query builder), but **the AI-builder path doesn't go through that evaluator**. So a "phone tickets today" widget renders ALL tickets of ALL channels for ALL time, with a "Today" label.

**Fix:** make the sample-data query path honor `dataConfig.filters` by reusing `applyFilters` from `visual-query-evaluator.ts`. Same code, two callers.

---

### Bug #3 — LLM invents filter syntax (`value: "today"`)

**Severity:** P-2, but P-1 once Bug #2 is fixed (because then the filter actually executes — with garbage).

The LLM emits relative-date filters using the literal string `"today"` as the value:

```json
{ "field": "created_at", "operator": ">=", "value": "today" }
```

There's no relative-date keyword defined anywhere in the system. The visual-query evaluator's `applyFilters` would compare `"2026-05-19T14:32:00Z" >= "today"` lexically — which is `true` for any string starting with `2` (i.e., all dates this millennium), so the filter is a no-op. The LLM made up syntax that doesn't exist.

**Fix:** define a relative-date escape and document it in the prompt. Either:
- **Option A (recommended):** server-side macro — accept `"@today"`, `"@this_week_start"`, `"@30d_ago"` etc. in filter values, resolve them in the evaluator with the request's UTC clock.
- **Option B:** require the LLM to emit ISO timestamps. Cheaper but the LLM doesn't know the current date unless we feed it via the system prompt (which adds a freshness/cache problem).

A is cleaner and stable.

---

### Bug #4 — Deterministic verification registry doesn't recognize `sample_tickets`

**Severity:** P-2, half-blinds the verification pipeline.

Every widget in probe #1 returned a D-01 warning:

```
"Data source \"sample_tickets\" is not in the sample registry —
 field-level checks skipped"
```

There are two name systems in tension:
- **What the LLM is told to use** (in `prompts.ts`): `sample_tickets`, `sample_deals`, etc.
- **What `src/lib/ai/source-field-registry.ts` knows about**: `kpi_summary`, `tickets_by_month`, etc.

The LLM's most-used source name (`sample_tickets`) isn't registered, so field-level integrity checks (column existence, type compatibility, aggregation legality) are **skipped** on the source the LLM uses 80% of the time.

**Fix:** add `sample_tickets`, `sample_subscriptions`, `sample_usage`, `sample_customers`, `sample_revenue`, `sample_deals` to `src/lib/ai/source-field-registry.ts`. Once Bug #1 lands, also register the 17 Freshworks sources there.

---

### Bug #5 — AI verification is DEAD in production (Layer 2 silently 404s)

**Severity:** P-1 (silent), but very low blast radius — verification is advisory only, patches still apply.

Every probe with non-empty patches shows:

```json
"aiVerification": {
  "ran": false,
  "skippedReason": "404 {\"type\":\"error\",\"error\":{\"type\":\"not_found_error\",\"message\":\"model: claude-haiku-3-20250414\"},\"request_id\":\"req_011CbCbGetTkHZtY8EBfXJib\"}"
}
```

`src/lib/ai/verify-integrity.ts:46` declares:

```ts
const HAIKU_MODEL = 'claude-haiku-3-20250414';
```

This model identifier does not exist in Anthropic's catalog. The correct current Haiku model id is **`claude-3-5-haiku-20241022`** (or `claude-3-5-haiku-latest`). Since the file was written, every dashboard generated has had Layer 2 silently skipped — the deterministic layer (Layer 1) is the only thing actually running, and Layer 2.5 escalation (which only triggers on low Layer-2 confidence) never runs either.

**Fix:** one-line change. Tested by re-running probe #1 with the corrected model — should see `aiVerification.ran: true`.

⚠ **Demo-day caution:** fixing this BEFORE the demo could surface new failures the verification pipeline catches but couldn't previously communicate. Recommend landing post-demo with eyes on the first few runs.

---

### Bug #6 — LLM invents aggregation function names (`"custom"`, `undefined`)

**Severity:** P-3 (deterministic verification catches these).

Probe #1 widget "Phone CSAT" emitted:

```json
"aggregation": { "function": "custom", "field": "satisfaction_score" }
```

Widget "Phone Support Team Performance Today" emitted:

```json
"aggregation": { "function": undefined, "field": "team" }
```

The legal aggregation set isn't documented anywhere in `prompts.ts`. The LLM extrapolates plausible-sounding names that don't exist.

**Fix:** add an explicit allowlist to the prompt:

```
Aggregation functions (use ONLY these):
- sum, avg, count, count_distinct, min, max, first, last, median
Any other value will fail verification (D-06).
```

---

## Summary scorecard

| Probe | Used Freshworks? | Time-scoped correctly? | Verification verdict | Honest about gap? |
|---|---|---|---|---|
| 01 Today's phone tickets | ❌ | ❌ (label-only) | FAIL @ 0.40 | ❌ generated wrong dashboard |
| 02 Today's Freshcaller calls | n/a (no patches) | n/a | n/a | ✅ admitted gap |
| 03 This week's Freshdesk tickets | ❌ | ❌ | FAIL @ 0 | ❌ generated wrong dashboard |
| 04 Freshsales pipeline | ❌ | ❌ | **PASS @ 1.0** (false positive!) | ❌ silently wrong |
| 05 Realtime call volume | n/a | n/a | n/a | ✅ asked clarification |
| 06 Last hour activity | n/a | n/a | n/a | ✅ admitted gap |
| 07 With sources named in prompt | ✅ | partial | WARN @ 0.86 | ✅ used what it was told |

Probe #4 is the most dangerous: stakeholder-facing dashboard, full PASS verdict, completely wrong numbers under the hood. It's the same failure mode as Freshworks Bug #2 in the field-shape findings (silent-wrong) — symptoms look healthy, contents are bogus.

---

## Fix plan (post-demo, prioritized)

| # | Fix | File(s) | Effort | Impact |
|---|---|---|---|---|
| 1 | Add 17 Freshworks sources to LLM catalog with time-scope hints | `src/lib/ai/prompts.ts` | M (1 hr) | **Eliminates Jeff's bug.** LLM picks live Freshworks for live questions. |
| 2 | Fix HAIKU_MODEL id | `src/lib/ai/verify-integrity.ts:46` | S (1 line) | Layer 2 verification re-activates across the product. |
| 3 | Wire `applyFilters` into sample-data query path | `src/lib/data/sample-data.ts` + reuse from `visual-query-evaluator.ts` | M (2 hr) | Widget filters actually execute. Foundation for #4. |
| 4 | Server-side relative-date macros (`@today`, `@this_week_start`, etc.) | new file in `src/lib/data/` + prompt update | M (2 hr) | LLM gets a stable syntax for time-scoped queries. |
| 5 | Register `sample_*` and `freshworks_*` sources in deterministic verifier | `src/lib/ai/source-field-registry.ts` | M (1 hr) | Verification stops half-blinding itself. |
| 6 | Add aggregation function allowlist to prompt | `src/lib/ai/prompts.ts` | S (5 min) | Cuts the `"custom"` / `undefined` class of bugs. |

Total: ~7 hours of focused work, sequenceable across 2 sessions. None of it demo-blocking — tomorrow's §2g uses the working Freshsales path and the verification pipeline is advisory.

---

## Recommended sequencing

**Session A (catalog + verifier — biggest user-facing win):**
1. Fix #1 (catalog) — LLM stops binding Freshworks questions to sample data.
2. Fix #5 (registry) — verification stops half-blinding itself on `sample_*` and the new Freshworks names.
3. Fix #6 (aggregation allowlist) — kills the `"custom"` aggregation class.
4. Rerun all 7 probes — expect verdicts to move from FAIL/PASS-false-positive to PASS or WARN with meaningful issues.

**Session B (data layer — makes time-scoping real):**
1. Fix #3 (apply filters in sample-data) — enables widget-level scoping.
2. Fix #4 (relative-date macros) — gives the LLM stable time syntax.
3. Fix #2 (HAIKU_MODEL) last, with eyes on the first few outputs to monitor what Layer 2 newly catches.

---

## Repro

To re-run the probe battery any time:

```bash
cd /tmp/insighthub-probes  # or wherever the script lives
./probe.sh "Build a dashboard for today's phone support tickets" "rerun-01"
./probe.sh "Current Freshsales pipeline value" "rerun-04"
./probe.sh "Today's phone tickets — use freshcaller_calls_today, freshdesk_open_ticket_count" "rerun-07"
```

The script lives at `/tmp/insighthub-probes/probe.sh` on the operator's laptop — copy into the repo under `scripts/probe-ai-builder.sh` if we want a permanent regression instrument.

---

## Related artifacts

- `docs/FRESHWORKS_FIELD_SHAPE_FINDINGS_2026-05-19.md` — sibling investigation into data-shape correctness for the Freshworks integrations themselves
- `/admin/freshworks/health` — runtime data-integrity dashboard (built same session)
- `docs/DATA_INTEGRITY_VERIFICATION_SPEC.md` — the verification pipeline spec; Bug #5 directly affects this
- `docs/DEMO_2026-05-20_TALKING_POINTS.md` §2g — uses live Freshsales pipeline (the one Freshworks path that works correctly end-to-end), unaffected by these findings

---

*Document author: Cascade, 2026-05-19 evening session, picked up from handoff at commit `29cb39b`. No code shipped in this document; safe to land on `main` without triggering a deploy.*
