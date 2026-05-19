# Real-Data Migration Plan — 2026-05-19

**Author:** Jeff Coy + Cascade
**Goal:** Swap demo data for real data across three pre-populated operator dashboards while preserving the truth-by-default integrity ethos established in commits `36adcc4` → `a2e386a`.
**Demo isolation:** 2026-05-20 09:00 ET demo §2g uses `freshsales_pipeline_value` queried directly via `POST /api/data/query`. None of the work in this doc touches that path; quarantine + Platform Health + dashboard seeding are post-demo work.

---

## 1. Goals & non-goals

### Goals
- Bring Freshworks (live) + Postgres (app + integrations) data online as first-class, discoverable sources in the dashboard builder.
- Build a new **Platform Health** data provider (Postgres-backed) following the same provider pattern as `FreshworksDataProvider`.
- Quarantine the 38 sample-data sources behind an env flag so they're hidden from discovery but still queryable by saved dashboards.
- Seed three pre-populated dashboards owned by Jeff's real production account (`jeffreycoy@jeffcoy.net`, role `ADMIN`):
  1. Support Operations (Freshdesk + Freshcaller + Freshchat)
  2. Sales Pipeline (Freshsales)
  3. Platform Health (Prisma-backed app + integration metrics)

### Non-goals
- No Snowflake work this session (the data-provider fallback stays).
- No snapshot-history table (G-FW-PoP-1) — separate session.
- No deletion of sample sources or sample-data Prisma tables.
- No changes to existing Freshworks PoP behavior (it's working in prod).
- No widening of dashboard audience beyond Jeff (templates + tenancy come later).
- No new auth surface for the demo gate — env flag only.

---

## 2. Audit findings

### 2.1 Sample-data source inventory

**Generator catalog:** `src/lib/data/sample-data.ts:281-363` (38 distinct keys including aliases).

**Backing Prisma tables:** `SampleCustomer`, `SampleSubscription`, `SampleTicket`, `SampleDeal`, `SampleUsage`, `SampleRevenue` (`prisma/schema.prisma:222-312`). Seeded deterministically (`prisma/seed.ts:216-531`) — 5k customers, ~50k tickets, 200 deals.

**Important:** the sample-data generators in `sample-data.ts` are **synthetic** (seeded RNG, in-process); they do NOT read from the `sample_*` Prisma tables. The Prisma tables are reachable only through the Visual Query Builder, not through the AI dashboard builder.

**Discovery surfaces that currently expose sample sources:**

| Surface | Location | Effect |
|---|---|---|
| LLM source catalog (NL→config) | `src/lib/ai/prompts.ts` §`DATA_SOURCES` lines 25-82 + `getAvailableDataSources()` line 252 | LLM is told these names exist |
| LLM "Pre-Aggregated Data Sources" block | `src/lib/ai/prompts.ts` lines 345-408 | LLM is given exact field names |
| Source picker (builder) | `GET /api/data/query` → `getAvailableSources()` from `sample-data.ts:451` | UI dropdown shows them |
| Schema explorer | `GET /api/data/schema` → `buildSchemaWithPermissions()` | Data Explorer surface |
| Verification registry | `src/lib/ai/source-field-registry.ts:13-78` | D-08 reference (keep these — saved widgets still verify) |
| Seeded TEMPLATE_DASHBOARDS | `prisma/seed.ts:50-107` | 7 demo dashboards owned by `dev-admin-user` |

### 2.2 Freshworks (live) inventory

Already wired correctly (commits `36adcc4`, `6e427be`, `ce1535e`, `a2e386a`). 17 sources registered in `src/lib/data/freshworks-sources.ts:27-49`, routed through `queryDataWithProvider()` (`src/lib/data/snowflake-data-provider.ts:311-335`). Honest PoP on `freshcaller_calls_today`, `freshdesk_open_ticket_count`, `freshdesk_overdue_ticket_count`. Honest `null` + reason on `freshsales_*` and `freshchat_active_conversations`. No change.

### 2.3 Postgres-backed candidates for Platform Health

All append-only or near-append-only models in `prisma/schema.prisma` that support honest period-over-period from immutable `createdAt` fields:

| Model | Use | PoP source |
|---|---|---|
| `User` | total user count, role distribution | `User.createdAt` (immutable) |
| `Dashboard` | total dashboards, recently-created, classification distribution | `Dashboard.createdAt`, `Dashboard.classification` |
| `GlossaryTerm` | total terms, coverage-by-category | `GlossaryTerm.createdAt` |
| `AuditLog` | events-by-type, recent activity, active users | `AuditLog.createdAt`, `AuditLog.userId` |

**Honesty edge case:** "users by role 7 days ago" is **not** honestly computable from this schema because `User.role` is mutable and not change-tracked. Same for `Dashboard.classification`. These will be exposed as **current-state breakdown charts** only — never as KPIs with a comparison pill.

### 2.4 Existing demo dashboards (in seed)

7 entries in `prisma/seed.ts:50-107`, all owned by `dev-admin-user`, all `isTemplate: true, isPublic: true`. They reference sample sources (`kpi_summary`, `tickets_by_month`, etc.) in their schemas (currently empty; widgets are added by chat sessions).

---

## 3. Quarantine plan

**Principle:** discovery hidden, query path preserved. Saved dashboards that reference sample sources continue to render. The LLM, source picker, and schema explorer stop offering them unless `FEATURE_DEMO_SOURCES=true`.

### 3.1 Sample-source registry (new file)

`src/lib/data/sample-sources.ts` — client-safe (zero server imports, mirrors `freshworks-sources.ts` pattern):

```ts
export const SAMPLE_SOURCES: readonly string[] = [
  'kpi_summary', 'mrr_by_month', 'churn_by_month', 'churn_by_region',
  'churn_by_plan', 'revenue_by_month', 'revenue_by_type',
  'tickets_by_month', 'tickets_by_category', 'tickets_by_team',
  'deals_pipeline', 'deals_by_source',
  'customers_by_plan', 'customers_by_region',
  'usage_by_feature', 'usage_by_month',
  'cs_automation_summary', 'cs_deflection_by_month',
  'cs_deflection_by_channel', 'cs_bot_topic_performance',
  'cs_cost_savings',
  'sample_customers', 'sample_subscriptions', 'sample_tickets',
  'sample_revenue', 'sample_usage', 'sample_deals',
] as const;

export function isSampleSource(name: string): boolean { /* ... */ }
```

Aliases like `monthly_churn`, `pipeline`, `kpis`, etc. (the AI-builder alias list in `sample-data.ts:312-362`) are intentionally **not** in this registry — they're synonym fallbacks, not canonical names. Hiding the 27 canonical names from discovery is sufficient; if the LLM emits an alias, the query path still resolves it. That's correct quarantine semantics.

### 3.2 Env flag

`FEATURE_DEMO_SOURCES` — boolean, defaults to `false`. Added to `src/lib/env.ts` definitions + `.env.example`. When `false`, sample sources are stripped from:

- `prompts.ts` §`DATA_SOURCES` (gating the LLM source catalog)
- `prompts.ts` §"Pre-Aggregated Data Sources" block (gating the field-name reference)
- `GET /api/data/query` `sources` + `sourcesWithAccess` arrays
- `GET /api/data/schema` `buildSchemaWithPermissions()` output

When `true`, behavior is unchanged from today.

### 3.3 Untouched surfaces

- `POST /api/data/query` — explicit source request → still resolves sample sources (saved dashboards keep rendering).
- `source-field-registry.ts` — keeps all sample source entries (D-08 verification continues to work for saved widgets).
- Sample-data Prisma tables — untouched (no migration).
- `queryDataSync()` in `useWidgetData.ts` — untouched (synchronous client fallback for sample sources keeps working when explicitly bound).

### 3.4 Visual marker on existing demo dashboards

In `prisma/seed.ts:50-107`, update each TEMPLATE_DASHBOARDS entry:

- `title`: append ` (Demo)` → e.g. `'Executive Summary (Demo)'`
- `tags`: ensure `demo` is present → e.g. `'executive,overview,kpi,demo'`

Upserts in the seed function become explicit (use `upsert` with the title + tag in the `update` clause). Re-running the seed is idempotent.

---

## 4. Platform Health provider plan

### 4.1 Architecture

Two new modules following the Freshworks pattern (client-safe registry + server-only provider):

- `src/lib/data/platform-health-sources.ts` — pure constants + type guards, safe to import from React Client Components and hooks. No Prisma, no Node imports.
- `src/lib/data/platform-health-data-provider.ts` — server-only, Prisma-backed, exposes `PlatformHealthDataProvider.queryData(source, user)` returning `FreshworksProviderResult`-shape rows (the data-provider result shape is generic enough — see `DataProviderResult` in `snowflake-data-provider.ts:19-29`).

Routing in `queryDataWithProvider()`:

```ts
if (isPlatformHealthSource(source)) {
  return PlatformHealthDataProvider.queryData(source, user); // BEFORE Freshworks check
}
if (isFreshworksSource(source)) { /* existing */ }
return SnowflakeDataProvider.queryData(...); // existing
```

The `platform_*` and `fresh*_*` prefixes are mutually exclusive, so order is for clarity, not correctness.

### 4.2 Source catalog with honest-PoP plan

12 sources, all KPIs honor the same 5-field row contract as Freshworks KPIs:
`{ value, label, previous_value, comparison_label, comparison_unavailable_reason }`.

| Source | Widget | Current value (Prisma) | Previous value | Honest? |
|---|---|---|---|---|
| `platform_user_count` | kpi | `User.count()` | `User.count({ where: { createdAt: { lt: T-7d } } })` | ✅ 7d PoP |
| `platform_users_by_role` | bar | `groupBy(role) → count` | n/a (chart, not KPI) | ✅ |
| `platform_active_users_7d` | kpi | distinct `userId` in `AuditLog` where `createdAt ≥ T-7d` | distinct `userId` in (`T-14d`, `T-7d`] | ✅ 7d PoP |
| `platform_dashboards_total` | kpi | `Dashboard.count({ archivedAt: null })` | `Dashboard.count({ createdAt: { lt: T-7d }, archivedAt: null })` | ✅ 7d PoP |
| `platform_dashboards_created_30d` | kpi | `Dashboard.count({ createdAt: ≥ T-30d })` | `Dashboard.count({ createdAt: (T-60d, T-30d] })` | ✅ 30d PoP |
| `platform_dashboards_created_by_month` | line | groupBy `month(createdAt)`, last 12 months | n/a | ✅ |
| `platform_glossary_term_count` | kpi | `GlossaryTerm.count()` | `GlossaryTerm.count({ createdAt: { lt: T-7d } })` | ✅ 7d PoP |
| `platform_glossary_by_category` | bar | groupBy `category` → count | n/a | ✅ |
| `platform_classification_distribution` | pie | groupBy `Dashboard.classification` → count | n/a — classification is mutable, no honest historical comparison | ✅ (chart only, no KPI variant) |
| `platform_audit_events_by_type_30d` | bar | groupBy `action`, where `createdAt ≥ T-30d` | n/a | ✅ |
| `platform_audit_events_today` | kpi | `AuditLog.count({ createdAt: ≥ start-of-today-UTC })` | yesterday-UTC count | ✅ yesterday PoP |
| `platform_recent_audit_events` | table | top 25 `AuditLog` by `createdAt DESC`, joined to `User.name` | n/a | ✅ |

All implementations will mirror the `wasTicketOpenAt()` pattern in `freshworks-data-provider.ts:509-521` — never fabricate, return `null` + reason when honesty isn't achievable.

### 4.3 Source-field registry additions

All 12 sources registered in `src/lib/ai/source-field-registry.ts` so D-08 verification recognizes them. KPI sources get the 5-field contract; chart/table sources get their specific columns.

### 4.4 LLM prompt visibility

Platform Health sources are appended to the `DATA_SOURCES` array in `prompts.ts` with `permissionLevel: 'standard'`. They are NOT gated behind `FEATURE_DEMO_SOURCES` — they're real data and we want them discoverable.

### 4.5 useWidgetData client routing

`src/hooks/useWidgetData.ts:76` adds `isPlatformHealthSource(source)` to the predicate that routes through `POST /api/data/query`. Platform Health requires Prisma, so it must go server-side like Freshworks does. The 30-second client cache + cached server response stays the same.

---

## 5. Three seeded dashboards

### 5.1 Owner

`jeffreycoy@jeffcoy.net`, role `ADMIN`. Upserted by the seed script with a stable ID (`jeff-prod-user`). Idempotent — re-running the seed updates the user row in place.

### 5.2 Dashboard schemas (widget lists)

#### `jeff-support-ops` "Support Operations"
- **Row 1 KPI bank (4 cards, w=3 each):** `freshdesk_open_ticket_count` · `freshdesk_overdue_ticket_count` · `freshcaller_calls_today` · `freshchat_active_conversations`
- **Row 2 status charts (3 bar charts, w=4 each):** `freshdesk_tickets_by_status` · `freshcaller_calls_by_status` · `freshchat_conversations_by_status`
- **Row 3 recent tickets (1 table, w=12):** `freshdesk_recent_tickets`
- **Row 4 recent activity (2 tables, w=6 each):** `freshcaller_recent_calls` · `freshchat_recent_conversations`
- **Row 5 agents (1 table, w=12):** `freshdesk_agents`

Integrity story: Freshdesk + Freshcaller cards show honest PoP pills; Freshchat card shows transparent "no comparison available" pill with reason. Same dashboard demonstrates both states of the truth-by-default contract.

#### `jeff-sales-pipeline` "Sales Pipeline"
- **Row 1 KPI bank (2 cards, w=6 each):** `freshsales_pipeline_value` · `freshsales_open_deal_count`
- **Row 2 stage breakdown (1 bar chart, w=12):** `freshsales_deals_by_stage`
- **Row 3 top deals (1 table, w=12):** `freshsales_top_deals`
- **Row 4 entity tables (2 tables, w=6 each):** `freshsales_contacts_recent` · `freshsales_accounts_recent`

Integrity story: both KPIs intentionally show "no comparison available" — the demo of honest absence.

#### `jeff-platform-health` "Platform Health"
- **Row 1 KPI bank (4 cards, w=3 each):** `platform_user_count` · `platform_dashboards_total` · `platform_dashboards_created_30d` · `platform_active_users_7d`
- **Row 2 distributions (3 charts, w=4 each):** `platform_users_by_role` (bar) · `platform_classification_distribution` (pie) · `platform_audit_events_by_type_30d` (bar)
- **Row 3 trend (1 line chart, w=12):** `platform_dashboards_created_by_month`
- **Row 4 (KPI + table, w=4 + w=8):** `platform_glossary_term_count` · `platform_recent_audit_events`

Integrity story: every KPI gets a real, honestly-computed comparison pill.

### 5.3 Seeding script

`scripts/seed-jeff-dashboards.ts` — TypeScript, executed via `npx tsx`. Idempotent by stable dashboard ID. Each dashboard is its own Prisma transaction (one commit per dashboard so review is granular). Sets:
- `ownerId: 'jeff-prod-user'`
- `isTemplate: false`
- `isPublic: false`
- `classification: 'USZOOM_RESTRICTED'` (default)
- `tags: 'operator,real-data'`
- Initial `DashboardVersion` (version 1) with the schema JSON populated (not empty like the demo templates).

### 5.4 Commit boundaries

Each dashboard lands as its own commit so the schema JSON is reviewable in isolation. Per the recent commit-message style (very long, structured, includes the "why" and any limitations).

---

## 6. Verification probe

`scripts/probe-jeff-dashboards.sh` — bash, follows the pattern of `scripts/probe-ai-builder.sh:1-42`. For each dashboard, POSTs to `/api/data/query` for every source and asserts:

1. HTTP 200
2. `fetched_at` is present and parses as ISO 8601
3. For KPI sources: row 0 contains either (`previous_value` is a finite number) XOR (`comparison_unavailable_reason` is a non-empty string)
4. No row contains the literal strings `"today"`, `"yesterday"`, or other suspected fabrication tells from the AI-builder findings doc
5. Prints a green/red summary per source

Run against `https://dashboards.jeffcoy.net` post-deploy. Promoted to `e2e/` as a Playwright spec once the dashboards are stable.

---

## 7. Out of scope / future work

| Item | Tracked as |
|---|---|
| Snapshot-history table for unblocked Freshworks PoP | G-FW-PoP-1 |
| GaugeWidget hard-coded max=100 + `%` suffix | Flagged in handoff |
| Widening audience / multi-tenancy | Future session |
| Per-user demo permission (vs env flag) | Deliberately deferred |
| Snowflake activation | Phase 3 |
| Migrating sample-data generators to read from `sample_*` Prisma tables | Not needed; quarantine is sufficient |

---

## 8. Implementation order

1. This findings doc → commit (paper trail first).
2. Quarantine — sample-sources registry + env flag + LLM + GET API filters + tag/title update on TEMPLATE_DASHBOARDS in seed.ts. Single commit.
3. Platform Health provider — sources + provider + routing + source-field-registry + useWidgetData routing + prompts.ts catalog entries. Single commit.
4. `scripts/seed-jeff-dashboards.ts` + initial run instructions. One commit per dashboard (3 commits).
5. `scripts/probe-jeff-dashboards.sh` + first probe run + evidence committed under `docs/evidence/`. Single commit.

Each step is independently revertable. After step 3 the system is production-deployable; the dashboards can be seeded against prod DB without re-deploy.
