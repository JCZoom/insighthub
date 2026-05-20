# Freshworks Field-Shape Findings — 2026-05-19

> **Status:** Diagnosis complete for Freshcaller (high confidence, cited to vendor docs). Diagnosis partial for Freshchat (need one production log capture to close). **No code changes shipped yet** — this document is the patch plan.
>
> **Context:** During the 2026-05-19 PM data-integrity audit (kicked off by the user asking *"how do I know the data on these dashboards is accurate?"*), we discovered three Freshcaller widgets and three Freshchat widgets emit silently-wrong values on production. The Freshworks Health page (`/admin/freshworks/health`) was built in the same session to make these smells visible going forward — this document is what it would tell us if it were live, plus the root-cause analysis.

---

## Production symptoms (verified via `POST /api/data/query`)

| Source | Symptom | Severity |
|---|---|---|
| `freshcaller_recent_calls` | Every row has `status: "unknown"`, `duration_s: null`, `created_at: null` | **HIGH** — table renders but every value is wrong |
| `freshcaller_calls_by_status` | Single bucket `{unknown: 100}` — bar chart degenerates to one bar | **HIGH** — chart is meaningless |
| `freshcaller_calls_today` | `value: 0` — depends on `created_at` matching today, but `created_at` is always null | **HIGH** — KPI permanently shows 0 |
| `freshchat_active_conversations` | `value: 0` | **MED** — could be genuinely empty OR could be hidden by API failure |
| `freshchat_conversations_by_status` | 0 rows | **MED** — same |
| `freshchat_recent_conversations` | 0 rows | **MED** — same |
| `freshsales_open_deal_count` | Returns exactly `100` (the fetch cap) | **MED** — almost certainly truncated, real total unknown |
| `freshsales_pipeline_value` | Sum over the same capped 100 deals → likely undercounting | **MED** — depends on truth of preceding |

Freshsales `top_deals`, `deals_by_stage`, Freshdesk all look healthy.

---

## Root cause #1 — Freshcaller (HIGH CONFIDENCE)

**Source of truth:** [Freshcaller official API docs](https://developer.freshcaller.com/api/) — "The call object" + "The call participant object" sections — plus the [Freshcaller community thread on call status](https://community.freshworks.dev/t/freshcaller-api-call-status/5550) which confirms status is on the *participant*, not the call.

### What our code expects

In `src/lib/integrations/freshworks/freshcaller/redact.ts:58-67` and the row mapping in `src/lib/data/freshworks-data-provider.ts:584-617`, we expect call-level fields named `status` / `call_status` / `disposition` / `call_state` / `call_attributes.status`, plus `created_at`, `call_duration`, `phone_number`.

### What the API actually returns

The real call object has these top-level fields (verbatim from the docs example):

```
id, direction, parent_call_id, root_call_id, phone_number_id, phone_number,
assigned_agent_id, assigned_agent_name, assigned_team_id, assigned_team_name,
assigned_call_queue_id, assigned_call_queue_name, assigned_ivr_id,
assigned_ivr_name, call_notes, bill_duration, bill_duration_unit,
created_time,         ← NOT created_at
updated_time,         ← NOT updated_at
recording, recording_to_redact, integrated_resources,
participants[],       ← STATUS LIVES HERE, one per call leg
parallel_call_groups
```

And each `participants[]` object has:

```
id, call_id, caller_id, caller_number, caller_name,
participant_id, participant_type ("Customer" | "Agent"),
connection_type, call_status (integer code), duration, duration_unit,
cost, cost_unit, enqueued_time, created_time, updated_time
```

So the three things we got wrong:

1. **Status is nested**, on the participant whose `participant_type === "Customer"`. The integer code maps to call-status strings — at least:
   - `1` → Answered / Completed
   - `3` → Missed
   - `10` → (observed in docs sample; need our own mapping)
   - Other codes documented in the [Freshcaller status reference](https://developer.freshcaller.com/api/) under "leg_type"
2. **Timestamp field is `created_time`** (and `updated_time`), not `created_at` / `updated_at`. We're reading absent fields and getting `null`.
3. **Duration is `bill_duration`** at top level (correct in our code) OR the customer participant's `duration` field. Our `??` chain *does* read `bill_duration` — but we observe `null` in prod anyway, meaning the field is absent on `GET /api/v1/calls` list responses (the docs sample shows it but the tenant's actual list payload may omit it; this needs confirmation via a one-shot introspection).

### Why the typed interface didn't catch this

`FreshcallerCall` in `freshcaller/redact.ts:22-52` was hand-rolled with optimistic field names because the API docs weren't consulted at write-time. The TypeScript compiler can't know which fields are *actually present* in a third-party JSON payload; it only enforces the shape **we** declared.

---

## Root cause #2 — Freshchat (PARTIAL — needs one log line)

The Freshchat client at `src/lib/integrations/freshworks/freshchat/client.ts:82-112` calls `POST /v2/conversations/search` and **swallows any error** into `return []` with a `console.warn` that includes the error object but is not structured-logged anywhere we can query.

We have three independently-confirmed pieces of evidence that the search endpoint is failing:

1. Production `POST /api/data/query` for all 3 Freshchat sources returns 0 rows.
2. The client's own header comment block (lines 6-22) documents the issue from the 2026-05-19 smoke test: *"GET /v2/conversations does NOT exist. Returns 403 on this tenant. The supported listing endpoints are GET /v2/users and POST /v2/conversations/search."*
3. Community reports ([Freshworks dev community](https://community.freshworks.dev/)) note that the `.api.freshchat` host introduced in 2024 behaves differently from the old subdomain host — and `/v2/conversations/search` is gated on different scopes than the v1 endpoints.

### What we don't know yet

The actual HTTP status code and response body of the failing call. We need this to distinguish:

- **403 (scope problem)** → reissue the API key with conversation scope, no code change
- **404 (wrong endpoint)** → try a different endpoint, code change
- **400 (malformed body)** → fix the body schema, code change
- **5xx (Freshchat server issue)** → not our problem

### How to capture it (1 minute on autoqa)

```bash
# As root on autoqa, with the service running:
sudo journalctl -u insighthub -n 2000 --no-pager | grep -A 3 "\[freshchat\]"
```

If that's empty (the cache is hot and we haven't re-fetched since restart), force a re-probe by clearing the Freshchat cache and hitting the source once:

```bash
# As root on autoqa:
redis-cli --scan --pattern 'fw:freshchat:*' | xargs -r redis-cli DEL
curl -sS -X POST https://dashboards.jeffcoy.net/api/data/query \
  -H 'Content-Type: application/json' \
  -d '{"source":"freshchat_active_conversations"}' > /dev/null
sleep 1
sudo journalctl -u insighthub -n 50 --no-pager | grep -A 3 "\[freshchat\]"
```

The error message and stack trace will pinpoint exactly which fix path applies.

---

## Patch plan

### Tier 1 — Freshcaller (HIGH-confidence fixes, no demo dependency)

**Goal:** Make the 4 Freshcaller sources emit truthful data.

#### Files touched

| File | Change | Lines |
|---|---|---|
| `src/lib/integrations/freshworks/freshcaller/redact.ts` | Add `FreshcallerParticipant` interface; extend `FreshcallerCall` with `participants[]` + `created_time` + `updated_time`; rewrite `freshcallerCallStatus()` to read from customer participant; add `freshcallerCallStatusCodeToString(code)` mapping; add `freshcallerCallTimestamp()` helper; extend redactor to mask `participants[].caller_number` / `caller_name` for VIEWER/CREATOR roles | ~+60 |
| `src/lib/data/freshworks-data-provider.ts` | Replace `c.created_at` with `freshcallerCallTimestamp(c)`; replace `c.call_duration ?? c.bill_duration` with a participant-aware duration helper; status path already routes through `freshcallerCallStatus()` so just the helper changes need to land | ~+15/-5 |
| `src/lib/integrations/freshworks/freshcaller/redact.test.ts` (NEW) | Unit tests for the new helpers with sample payloads pulled from the official docs | ~+120 |

#### Risk assessment

- **Low blast radius**: Only Freshcaller sources affected. Freshsales / Freshdesk / Freshchat untouched.
- **No schema migrations**, no DB changes.
- **Backward compatible**: helpers still check the old field names as fallbacks (so if any tenant ever did expose `c.status` at top level, we still pick it up).
- **PII surface**: `participants[].caller_number` and `caller_name` are PII — the redactor must mask them for VIEWER/CREATOR. Adds 2 lines to `redactCall()`.

#### Status-code mapping (best known)

```ts
const FRESHCALLER_STATUS: Record<number, string> = {
  1: 'Completed',
  3: 'Missed',
  10: 'Ended',          // tentative; observed in docs sample
};
// Unknown codes render as `Status ${code}` (matches Freshdesk pattern).
```

We should refine this mapping after one production log capture of actual call_status integer values seen in the wild — the existing diagnostic at `/admin/freshworks/health` (just shipped) will surface the raw `call_status` integer in the sample-row payload once we add `participants` to the sample.

#### Verification path

1. Deploy.
2. Open `/admin/freshworks/health`.
3. Expand `freshcaller_recent_calls` — status field should now show human strings (`Completed` / `Missed` / etc.), no `STATUS_ALL_UNKNOWN` flag.
4. `freshcaller_calls_by_status` should show **multiple** buckets, no `SINGLE_BUCKET` flag.
5. `freshcaller_calls_today` KPI should be non-zero if any calls today.

### Tier 2 — Freshchat (BLOCKED on one log capture)

**Step 1:** Capture the actual error per the journalctl instructions above. **Step 2:** Branch:

- **403 / scope issue** → no code change. The fix is rotating the Freshchat API key with the `conversations` scope enabled in the Freshchat admin panel. Add a check in `describeFreshchatConfigForLog()` to assert the scope claim is present in the API key (if the key is a JWT with claims).
- **404** → the `.api.freshchat` host vs subdomain host mismatch. Fix is in `freshchat/config.ts` — change `baseUrl` resolution from `${subdomain}.freshchat.com` to `${region}.api.freshchat.com`.
- **400 (body schema)** → fix `body` in `client.ts:73-81`. May need `sort_by: 'updated_time'` → `sort: ['updated_time:desc']` or similar, per the new `.api.freshchat` schema.
- **5xx** → not our fix; document and move on.

In all four branches, also: **stop graceful-degrading to `[]` silently**. Wrap the catch in a structured error capture that:
- Writes `console.error('[freshchat] search failed', { status, body, message })` (instead of `console.warn`)
- Throws a typed `FreshchatSearchUnavailableError` instead of returning `[]`
- Lets the provider surface a `degraded: true` flag in the `FreshworksProviderResult` so the dashboard widget can render a yellow "data temporarily unavailable" banner instead of "no data"

### Tier 3 — Freshsales truncation honesty (LOW priority)

The `freshsales_open_deal_count: 100` smell is structural, not a bug per se — we're capping at 100 deals because that's what the underlying `listDeals({ limit: 100 })` returns. To turn this into an accuracy guarantee:

- Add a `truncated: boolean` and `totalAvailable?: number` to `FreshworksProviderResult`.
- In `pipelineValue()` and `openDealCount()`, page through up to 5x 100-deal pages until the underlying API returns fewer than 100, summing accurately. Add a `5*100 = 500` hard cap with a flag if hit.
- Widget renderer (out of scope here, separate ticket) shows `… of N total` annotation when `truncated === true`.

---

## Recommended sequencing

1. **Tonight / tomorrow AM:** Land **this document** (no code) so the team has the diagnosis recorded.
2. **Post-demo (2026-05-20 afternoon onward):**
   1. Capture Freshchat journalctl error → close Tier 2 diagnosis
   2. Implement Tier 1 (Freshcaller fixes) — code + tests + deploy
   3. Verify via `/admin/freshworks/health`
   4. Implement Tier 2 fix based on what the log capture revealed
   5. Tier 3 (Freshsales pagination) — separate ticket, fits with broader "truncation honesty" theme

---

## Related artifacts

- `src/lib/data/freshworks-health.ts` — per-source probe (built tonight)
- `src/app/admin/freshworks/health/page.tsx` — admin UI for inspecting field shapes (built tonight)
- `src/lib/integrations/freshworks/shared/dev-introspect.ts` — existing dev-only field-name logger (no-op in prod by design)
- `docs/BUNDLING_BOUNDARIES_CRASH_COURSE.md` — sibling architectural write-up from the same sprint
- `docs/DEMO_2026-05-20_TALKING_POINTS.md` §2g — uses `freshsales_pipeline_value` (Freshsales, healthy) so this Freshcaller/Freshchat work does NOT block tomorrow's demo

---

## Open questions for the next session

1. What `call_status` integer codes does this tenant actually use? (Need to expand the `FRESHCALLER_STATUS` map.)
2. Is `bill_duration` genuinely absent on list responses, or just on the redacted view we look at? Need a raw introspection.
3. Freshchat search endpoint — what does it actually return? (Resolved by the journalctl capture step.)
4. Is the Freshsales 100-deal cap masking a real 500+ pipeline, or is the tenant actually 30-100 deals? Quick sanity check: visit Freshsales web UI and look at the all-deals counter.

---

*Document author: Cascade, 2026-05-19 evening session, picked up from handoff at commit `29cb39b`. No code shipped in this document; safe to land on `main` without triggering a deploy.*
