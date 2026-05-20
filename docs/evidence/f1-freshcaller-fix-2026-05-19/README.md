# F-1 Freshcaller field-shape fix — verification (2026-05-19)

Captured locally against the prod Freshcaller tenant immediately
after applying the F-1 fix in
`src/lib/integrations/freshworks/freshcaller/redact.ts` and
`src/lib/data/freshworks-data-provider.ts`.

## Pre-fix symptoms (per docs/FRESHWORKS_FIELD_SHAPE_FINDINGS_2026-05-19.md §F-1)

| Source | Pre-fix flags | Symptom |
|---|---|---|
| freshcaller_recent_calls | STATUS_ALL_UNKNOWN + ALL_NULL_TIMESTAMPS + ALL_NULL_DURATIONS | Every row: `status:"unknown"`, `created_at:null`, `duration_s:null` |
| freshcaller_calls_by_status | SINGLE_BUCKET | Bar chart degenerated to one bar `{unknown:100}` |
| freshcaller_calls_today | (no flag — but value:0 always) | KPI permanently 0 because `created_at` filter never matched |

Three production symptoms, one root cause: vendor renamed
top-level fields between v1 releases (status → participants[].call_status,
created_at → created_time) but our connector never updated.

## Post-fix evidence

### `recent_calls-after.json`
Every row now has real status (`missed`, `completed`, `code-17`),
real numeric `duration_s`, and ISO `created_at`. Phone numbers
unmasked because dev mode runs as ADMIN role.

### `calls_by_status-after.json`
Three real buckets: `completed:56`, `missed:23`, `code-17:21`.
The `code-17` is a vendor status code we haven't catalogued — the
F-1 helper deliberately surfaces it as `code-17` rather than
collapsing it to `unknown`, so the operator sees a real signal
they can investigate. Once the meaning is confirmed (vendor docs
or tenant introspection), it gets added to
`FRESHCALLER_STATUS_CODE_MAP` and the label flips to its
human-readable form.

### `calls_today-after.json`
`value:0` (May 20 UTC at the time of probe — 30 minutes into the
new UTC day, no calls yet). `previous_value:null` with the
honest reason "API returned 100-row cap — yesterday's count may
be incomplete". This is the secondary fix landed in the same
commit: the legacy `WINDOW_LIMIT=200` could never fire the
truncation check (the API per-page cap is 100), so the comparison
silently passed even when undercounting. Now the cap-hit
correctly degrades to no-comparison-available.

### `freshworks-health-after.json`
The 17-source health probe. Summary block:

```
{
  "ok": 13,
  "empty": 4,
  "suspicious": 0,
  "error": 0,
  "not_configured": 0
}
```

`suspicious: 0` is the headline. The three Freshcaller sources
that previously raised STATUS_ALL_UNKNOWN, ALL_NULL_TIMESTAMPS,
ALL_NULL_DURATIONS, and SINGLE_BUCKET now have empty `flags: []`.

The `empty: 4` reflects unrelated Freshchat sources (per F-2,
blocked on the journalctl capture) — not regressions caused by
this fix.

## Reproduction

```bash
NEXT_PUBLIC_DEV_MODE=true npm run dev &
# Wait for /api/health to return 200
curl -sS -X POST http://localhost:3000/api/data/query \
  -H 'Content-Type: application/json' \
  -d '{"source":"freshcaller_recent_calls"}' | jq .
curl -sS http://localhost:3000/api/admin/freshworks/health | jq .summary
```
