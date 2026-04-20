# InsightHub — VP of Analytics Technical Review

**Application:** InsightHub — AI-Powered Dashboard Builder  
**Production URL:** https://dashboards.jeffcoy.net  
**Review Date:** April 19, 2026  
**Classification:** Internal — Data Governance & Analytics Architecture

---

## Executive Summary

InsightHub is an internal self-service BI tool where employees build data dashboards using natural language, powered by Claude AI. It currently operates on **sample data** (Phase 1) with a **Snowflake connector now implemented** (Phase 3 preview, behind admin feature toggle). The tool includes a centralized glossary system for metric definitions, **metric-level data access controls** (8 categories including Financial meta-category, 4 roles), an AI-powered SQL copilot with Snowflake-dialect awareness, a widget library for reusable analytics components, and new **data power-user tools** (Visual Query Builder, Data Explorer, Query Playground).

**Key April 19 updates:**
- Snowflake connector implemented with connection pooling, PII auto-detection, row-level security, and Redis caching
- **Metric-level RBAC** added — granular restrictions within allowed data categories (e.g., allow Revenue but deny LTV metric)
- **Financial meta-category** grouping Revenue + Sales for unified governance
- **Visual Query Builder** (Sigma-style drag-and-drop), **Data Explorer** (schema browser + column profiler), **Query Playground** (multi-tab SQL notebook)
- **Glossary → widget linking** — metrics are directly linked to their visualizations
- **Data Integrity Verification Pipeline** spec written (3-layer verification for AI-generated dashboards)
- Sample data updated to realistic company metrics (400K customers, $60M ARR, 20% churn)

This report evaluates InsightHub from the perspective of a VP of Analytics who owns Snowflake access, governs metric definitions, manages Sigma workspaces, and oversees the company's data stack. It covers data governance, Snowflake integration, metric consistency enforcement, access control alignment, AI-generated query safety, and implications for the existing analytics workflow.

---

## 1. Data Governance & Metric Definitions

### 1.1 Glossary System

InsightHub enforces metric consistency via a centralized YAML glossary (`glossary/terms.yaml`) that is injected into every AI prompt. This is the single source of truth for business metric definitions.

| Property | Value |
|----------|-------|
| **Format** | YAML (human-editable, version-controlled) |
| **Location** | `glossary/terms.yaml` |
| **Metrics defined** | 14+ terms across 5 categories |
| **Approval tracking** | `approved_by` + `last_reviewed` fields per term |
| **Formula captured** | SQL-style formula for each metric |
| **Data source linked** | Each term maps to its authoritative source table |
| **Related terms** | Cross-referencing between metrics |
| **Exclusion rules** | Documented per metric (e.g., "Excludes trial accounts < 14 days") |

**Categories covered:**
- **Revenue** (6 terms): MRR, ARR, NRR, LTV, ARPU, CAC
- **Retention** (2 terms): Churn Rate, Retention Rate
- **Support** (3 terms): FRT, Resolution Time, CSAT
- **Sales** (3 terms): Win Rate, Pipeline Value, Average Deal Size
- **Product** (2 terms): Daily Active Usage, Feature Adoption Rate

### 1.2 Glossary Enforcement in AI

The AI is **hard-bound** to glossary definitions. The system prompt (`src/lib/ai/prompts.ts:162–164`) contains:

```
CRITICAL: You must use the company's official terminology definitions when interpreting user requests.
The glossary below contains agreed-upon definitions for all business metrics.
NEVER invent your own definitions.
```

**Key enforcement rule** (Rule #1 in AI prompt): *"Always reference glossary definitions when calculating metrics. If a user asks for 'churn', use the EXACT definition and formula from the glossary."*

This ensures that when an employee asks for "churn rate," the AI uses:
```
Formula: (cancelled_in_period / active_at_period_start) * 100
Exclusions: Trial accounts (< 14 days), internal test accounts
Source: sample_subscriptions
```

### 1.3 Glossary Management

| Operation | Access Level | Endpoint |
|-----------|-------------|----------|
| View terms | All authenticated users | `GET /api/glossary` |
| Search terms | All authenticated users | `GET /api/glossary?search=` |
| Create term | ADMIN only | `POST /api/glossary` |
| Update term | ADMIN only | `PUT /api/glossary` |
| Delete term | ADMIN only | `DELETE /api/glossary` |

**Audit trail:** All glossary CRUD operations are logged to the `AuditLog` table with user, timestamp, and change metadata: `src/lib/audit.ts:10–12`.

### 1.4 Glossary → Widget Linking (New — April 19)

Glossary terms are now **directly linked to widgets** that visualize them:

| Component | File | Function |
|-----------|------|----------|
| Related widgets | `src/components/glossary/RelatedWidgets.tsx` | Shows widgets using a glossary term |
| Add to dashboard | `src/components/glossary/AddToDashboardModal.tsx` | Add a widget from a glossary term to any dashboard |
| Widget preview | `src/components/glossary/WidgetPreviewModal.tsx` | Preview a widget before adding |
| Matching engine | `src/lib/widget-matching.ts` | Matches terms to widgets by data source and category |

This creates a **metrics catalog** experience — browse official definitions, see how they're visualized, and add them directly to dashboards.

### 1.5 Governance Gaps & Recommendations

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No approval workflow | Terms can be added without peer review | Add `status: draft/approved/deprecated` lifecycle |
| ADMIN-only editing | Analytics team can't self-serve definitions | Add `canEditGlossary` permission to POWER_USER or create a GLOSSARY_EDITOR role |
| No versioning on terms | Can't see historical definition changes | Add `GlossaryTermVersion` model (similar to dashboard versioning) |
| No Sigma formula validation | Sigma and InsightHub formulas could drift | Add Sigma formula syntax as a parallel field; compare during sync |
| No staleness alerting | Definitions may go stale without review | Flag terms where `last_reviewed` > 90 days |

---

## 2. Snowflake Integration (Phase 3 Preview — Implemented)

### 2.1 Current State

InsightHub's Snowflake connector is **implemented and functional**, deployed behind a feature toggle (`enableSnowflakeConnector` in the admin settings panel at `/admin/settings`). When disabled, the app falls back to sample data seamlessly. All Snowflake environment variables are defined and validated at startup:

| Variable | Purpose | File Reference |
|----------|---------|----------------|
| `SNOWFLAKE_ACCOUNT` | Account identifier | `src/lib/env.ts:80–83` |
| `SNOWFLAKE_USERNAME` | Auth username | `src/lib/env.ts:84–87` |
| `SNOWFLAKE_PASSWORD` | Auth password | `src/lib/env.ts:88–91` |
| `SNOWFLAKE_WAREHOUSE` | Compute warehouse | `src/lib/env.ts:92–95` |
| `SNOWFLAKE_DATABASE` | Target database | `src/lib/env.ts:96–99` |
| `SNOWFLAKE_SCHEMA` | Target schema | `src/lib/env.ts:100–103` |

All marked `required: false` — the app runs without them, falling back to sample data.

### 2.1a Snowflake Security Architecture (New — April 19)

The connector includes a comprehensive security stack:

| Layer | File | Purpose |
|-------|------|---------|
| Connection pool | `src/lib/snowflake/connection.ts` | Managed pool with idle timeout |
| Query executor | `src/lib/snowflake/query-executor.ts` | Parameterized queries, caching |
| Data security | `src/lib/snowflake/data-security.ts` | PII auto-detection, column masking |
| Row-level security | `src/lib/snowflake/row-level-security.ts` | Role-based row filtering |
| Schema introspection | `src/lib/snowflake/schema.ts` | INFORMATION_SCHEMA validation |
| Data provider | `src/lib/data/snowflake-data-provider.ts` | Dual-provider (Snowflake + sample fallback) |
| Redis caching | `src/lib/redis/client.ts` | Query result caching with TTL |

**⚠️ Sprint review finding (April 19):** Three SQL injection vectors were identified in the Snowflake code. These must be fixed before the connector is enabled in production. See CISO Report §4.6 for details.

### 2.2 AI SQL Copilot (Already Snowflake-Aware)

The AI already generates **Snowflake-dialect SQL** in its SQL assistant modes, even though the connector isn't live. This means when Phase 3 launches, the AI is pre-trained on correct syntax.

**Supported modes:**

| Mode | Trigger | Output |
|------|---------|--------|
| Explain This Query | User pastes SQL | Plain-English breakdown, maps to glossary terms |
| Natural Language → SQL | User asks for data | Runnable Snowflake SQL with comments |
| SQL Optimization | User asks to optimize | Before/after with Snowflake-specific hints (QUALIFY, clustering keys, materialized views) |
| Verify Dashboard | User cross-checks values | Exact SQL to reproduce widget calculation in Snowflake worksheet |
| Formula Help | User asks about metrics | Sigma formula + equivalent SQL + glossary reference |

**Snowflake dialect reference in prompt** (`src/lib/ai/prompts.ts:228–235`):
- DATE_TRUNC, DATEADD, CURRENT_DATE()
- ROW_NUMBER(), LAG() window functions
- JSON handling (value:key::string, FLATTEN)
- ILIKE, SPLIT_PART
- LISTAGG, APPROXIMATE_COUNT_DISTINCT
- QUALIFY, MATCH_RECOGNIZE
- Performance patterns (LIMIT for sampling, avoid SELECT *)

### 2.3 Integration Considerations for Your Snowflake Environment

| Consideration | Discussion |
|---------------|-----------|
| **Warehouse sizing** | InsightHub will need a dedicated XS/S warehouse for dashboard queries to avoid competing with Sigma workloads |
| **Role mapping** | InsightHub's 4 RBAC roles (VIEWER→ADMIN) should map to Snowflake roles for row-level security passthrough |
| **Query cost control** | Need query timeout + resource monitor. AI can generate expensive queries (full table scans, MATCH_RECOGNIZE) |
| **Schema access** | The `SNOWFLAKE_SCHEMA` env var allows restricting to a specific schema — recommend a `INSIGHTHUB_ANALYTICS` schema with curated views |
| **Data freshness** | Sample data is static; Snowflake queries will be live. Need to communicate latency expectations to users |
| **Connection pooling** | Single EC2 → single Snowflake session currently. Must pool connections if scaling to many concurrent users |
| **Credential rotation** | Password-based auth (`SNOWFLAKE_PASSWORD`). Recommend key-pair auth or OAuth for production |

### 2.4 Recommended Snowflake Architecture

```
Snowflake Account
 └── Database: ANALYTICS_PROD
      └── Schema: INSIGHTHUB_ANALYTICS
           ├── Views (curated, pre-joined, permission-gated)
           │    ├── v_mrr_monthly
           │    ├── v_churn_cohort
           │    ├── v_support_metrics
           │    ├── v_pipeline_summary
           │    └── v_feature_adoption
           └── Warehouse: INSIGHTHUB_WH (XS, auto-suspend 60s)
```

**Benefits of curated views:**
- Apply row-level security before data reaches InsightHub
- Pre-join complex schemas so AI generates simpler queries
- Abstract away raw table structure changes
- Track InsightHub query patterns separately in Snowflake query history
- Apply column masking policies (dynamic data masking for PII)

---

## 3. Data Access Controls (RBAC)

### 3.1 Category-Level Access Matrix

InsightHub gates data access at the **category level** — 8 categories (including 1 meta-category) mapped to specific data sources:

| Category | Data Sources | VIEWER | CREATOR | POWER_USER | ADMIN |
|----------|-------------|:---:|:---:|:---:|:---:|
| **Revenue** | sample_revenue, mrr_by_month, revenue_by_month, revenue_by_type | NONE | NONE | FULL | FULL |
| **Retention** | churn_by_region, churn_by_month, churn_by_plan, churn_rate | NONE | FULL | FULL | FULL |
| **Support** | sample_tickets, tickets_by_category, tickets_by_month | FULL | FULL | FULL | FULL |
| **Sales** | sample_deals, deals_pipeline, deals_by_source | NONE | NONE | FULL | FULL |
| **Product** | sample_usage, usage_by_feature, usage_by_month | NONE | FULL | FULL | FULL |
| **Operations** | kpi_summary, overall_kpi, metrics, kpis | NONE | NONE | FULL | FULL |
| **CustomerPII** | sample_customers, customers, customer_growth | NONE | NONE | NONE | FULL |
| **Financial** (meta) | _Spans Revenue + Sales_ | NONE | NONE | FULL | FULL |

**Key file:** `src/lib/auth/permissions.ts:5–26` (category → source mapping + meta-categories)

### 3.1a Metric-Level RBAC (New — April 19)

In addition to category-level RBAC, a **metric-level restriction layer** now allows granular control within an allowed category:

| Concept | Description | File |
|---------|-------------|------|
| `Financial` meta-category | Groups Revenue + Sales for unified governance of all financial data | `permissions.ts:16–26` |
| `MetricAccessRule` | Restrict specific metrics (e.g., allow Revenue but deny LTV) | `permissions.ts:58–62` |
| `MetricPermissionCheck` | Detailed access verdicts with denial reasons | `permissions.ts:65–71` |
| Proactive UX | Lock icons + availability indicators in widget config panel | `WidgetConfigPanel.tsx` |
| Client-side hook | `useDataSourcePermissions` for real-time permission awareness | `useDataSourcePermissions.ts` |

**Why this matters for analytics governance:** Previously, if you granted a user Revenue access, they could see all Revenue metrics. Now admins can grant Revenue access but restrict specific sensitive metrics (e.g., LTV, CAC) to a smaller group — matching how your Snowflake column masking policies work.

### 3.2 Multi-Layer Enforcement

Data access is enforced at **three layers** (defense in depth):

| Layer | Mechanism | File |
|-------|-----------|------|
| **1. AI prompt** | Restricted categories injected; AI told "NEVER generate queries" for blocked data | `src/lib/ai/prompts.ts:119–131` |
| **2. API gate** | `canAccessDataSource()` check before any query executes | `src/app/api/data/query/route.ts:49–61` |
| **3. PII stripping** | Server-side field redaction (`[REDACTED]`) regardless of AI behavior | `src/app/api/data/query/route.ts:16–33` |

**PII fields stripped:** `name`, `email`, `company`, `account_manager`, `contact`, `owner`

### 3.3 Access Level Types

Three access levels exist per category:

| Level | Behavior |
|-------|----------|
| **FULL** | Complete access to all data in the category |
| **NONE** | Completely blocked — query rejected with 403 |
| **FILTERED** | *Defined, implementation in progress* — intended for aggregate-only access (totals/averages without row-level detail). Asana task exists for completion. |

### 3.4 How This Maps to Your Snowflake Governance

| InsightHub Control | Snowflake Equivalent | Alignment Status |
|-------------------|---------------------|-----------------|
| Category-level RBAC | Database roles + schema grants | ⚠️ Must be kept in sync manually |
| PII field stripping | Dynamic Data Masking policies | ✅ Complementary — both layers protect |
| FILTERED access level | Aggregation-only views or row access policies | ⬜ Not yet implemented |
| Permission groups | Snowflake roles (ACCOUNTADMIN → PUBLIC) | ⚠️ Need mapping layer |
| Audit logging | Snowflake ACCESS_HISTORY + QUERY_HISTORY | ⚠️ Separate systems today |

**Recommendation:** When the Snowflake connector goes live, implement a **permission passthrough** that translates InsightHub's RBAC into Snowflake role sessions (`USE ROLE insighthub_viewer`). This avoids maintaining two separate permission systems. Alternatively, use Snowflake views with `CURRENT_ROLE()` filters.

---

## 4. Data Sources & Schema

### 4.1 Sample Data Model (Phase 1)

The current sample dataset represents a realistic SaaS business with **updated metrics (April 19):**

| Table | Records | Key Fields | Analytics Use |
|-------|---------|-----------|---------------|
| `sample_customers` | ~400,000 | id, plan, region, signup_date, monthly_revenue | Cohort analysis, segmentation |
| `sample_subscriptions` | ~400,000 | plan, status, monthly_amount, start/end dates | MRR ($5M/mo → $60M ARR), churn analysis (20% rate) |
| `sample_tickets` | ~50,000 | category, priority, status, response time, CSAT | Support metrics |
| `sample_revenue` | ~10,000 | event_type (new/expansion/contraction/churn/reactivation), amount | Revenue movement analysis |
| `sample_deals` | 200 | stage, amount, probability, source, region | Pipeline and sales metrics |
| `sample_usage` | ~20,000 | feature, usage_count, usage_date | Product adoption analysis |

**Generated by:** `prisma/seed.ts` using `@faker-js/faker` — all data is synthetic but calibrated to represent a realistic mid-stage SaaS company (~400K customers, ~$60M ARR, ~20% annual churn).

### 4.2 Data Source Definitions in AI Prompt

Each data source has a full schema description injected into the AI prompt (`src/lib/ai/prompts.ts:24–83`), including:
- Column names and types
- Enum values (e.g., ticket categories, deal stages)
- Nullable fields
- Permission level (public/standard/sensitive)

This ensures the AI generates valid queries against the correct schema.

### 4.3 Pre-Aggregated Views

The data query engine supports pre-aggregated views (computed at query time):
- `mrr_by_month` — monthly MRR trend
- `churn_by_region` / `churn_by_month` / `churn_by_plan` — churn breakdowns
- `tickets_by_category` / `tickets_by_month` / `tickets_by_team` — support rollups
- `deals_pipeline` / `deals_by_source` — sales aggregations
- `usage_by_feature` / `usage_by_month` — product usage rollups
- `revenue_by_month` / `revenue_by_type` — revenue breakdowns
- `customers_by_plan` / `customers_by_region` — customer segmentation
- `customer_growth` — new vs. churned over time
- `kpi_summary` — cross-domain executive KPIs

---

## 5. AI-Generated Analytics & Query Safety

### 5.1 How the AI Generates Queries

When a user requests a dashboard widget, the AI:
1. Receives the full glossary + schema + user permissions in its system prompt
2. Interprets the request using official metric definitions
3. Generates a `dataConfig` specifying: source table, groupBy fields, aggregation, filters
4. The data query API (`/api/data/query`) executes the query with permission checks

The AI does **not** write raw SQL against the database in Phase 1. It selects from pre-defined data sources and aggregation patterns. In Phase 3 (Snowflake), the SQL copilot mode will generate executable Snowflake SQL.

### 5.2 Query Safety Controls

| Control | Purpose | Status |
|---------|---------|--------|
| Source allowlist | AI can only reference sources the user has access to | ✅ Active |
| Restricted data prompt | AI explicitly told which categories are off-limits | ✅ Active |
| API permission gate | Server rejects queries to unauthorized sources (403) | ✅ Active |
| PII field stripping | Even if AI sneaks a PII source in, fields are redacted | ✅ Active |
| Input validation | Query body validated (source required, groupBy optional) | ✅ Active |
| Rate limiting | 60 req/min per user on dashboard APIs | ✅ Active |

### 5.3 SQL Safety Concerns (Updated April 19)

The Snowflake connector is now implemented. The following controls are needed before enabling in production:

| Risk | Mitigation Needed | Status |
|------|-------------------|--------|
| **SQL injection in buildSnowflakeQuery** | Reject unmapped source names, validate groupBy | ⚠️ Sprint review critical finding |
| **SQL injection in QueryBuilder.select/count** | Validate table/column names against schema | ⚠️ Sprint review critical finding |
| **Visual-to-SQL formula injection** | Validate formula expressions against safe allowlist | ⚠️ Sprint review critical finding |
| AI generates expensive full-table scans | Query cost estimator + hard timeout (e.g., 30s) | ⬜ Not yet implemented |
| AI generates DDL (CREATE/DROP/ALTER) | Whitelist SELECT-only; regex-block DDL keywords before execution | ⬜ Not yet implemented |
| AI generates cross-schema queries | Restrict to `INSIGHTHUB_ANALYTICS` schema only | ⬜ Not yet implemented |
| AI hallucinates table/column names | Validate against Snowflake INFORMATION_SCHEMA before execution | ✅ Schema introspection available |
| Query result sets too large | LIMIT clause enforcement (e.g., max 10,000 rows) | ⬜ Not yet implemented |
| Credential exposure in error messages | Sanitize Snowflake connection errors before returning to client | ✅ Graceful degradation implemented |
| PII leakage via column aliasing | Unify PII stripping across all data sources | ⚠️ Sprint review critical finding |

### 5.4 Sigma Coexistence

InsightHub and Sigma serve different purposes but share the same data:

| Dimension | Sigma | InsightHub |
|-----------|-------|-----------|
| **Primary user** | Analysts, data team | Business stakeholders, all employees |
| **Skill level** | SQL fluent, data-modeling aware | No-code / natural language |
| **Data access** | Direct Snowflake connection | Curated views via connector |
| **Metric definitions** | Sigma metrics layer | YAML glossary |
| **Governance** | Sigma workspace permissions | InsightHub RBAC + permission groups |
| **Output** | Workbooks, explorations, embeds | Dashboards with AI-built widgets |

**Key risk:** Metric definition drift between Sigma metrics layer and InsightHub glossary.

**Recommendation:** Automate a sync job that compares InsightHub's `glossary/terms.yaml` formulas against Sigma's metrics layer definitions. Alert on divergence. The glossary's `data_source` and `formula` fields are already structured enough for this comparison.

---

## 6. Widget & Visualization Capabilities

### 6.1 Widget Types

14 chart/widget types available for dashboard building:

| Widget Type | Analytics Use Case |
|-------------|-------------------|
| `kpi_card` | Single metric with trend indicator |
| `metric_row` | Multiple metrics in a compact row |
| `line_chart` | Time-series trends (MRR, churn over time) |
| `bar_chart` | Category comparisons (revenue by region) |
| `area_chart` | Cumulative metrics, stacked trends |
| `stacked_bar` | Composition analysis (revenue mix) |
| `pie_chart` / `donut_chart` | Proportional breakdowns |
| `scatter_plot` | Correlation analysis |
| `funnel` | Conversion/pipeline stages |
| `gauge` | Progress toward targets |
| `table` | Detailed data exploration |
| `text_block` | Annotations, insights, section headers |
| `divider` | Visual separation |

### 6.2 Widget Library (Reuse System)

Pre-built widgets from existing dashboards can be published to a shared library and reused via the AI:

| Feature | Description |
|---------|-------------|
| **Publish** | Any user with `canPublishWidgets` can share a widget |
| **Fork** | Users can clone and customize library widgets |
| **AI preference** | AI is instructed to prefer reuse over creation for consistency |
| **Tags + search** | Library widgets are tagged and searchable |

This is analogous to Sigma's "saved elements" — reusable metric visualizations that ensure consistency across teams.

### 6.3 Export Capabilities

| Format | Method | Use Case |
|--------|--------|----------|
| **CSV** | Client-side | Data extraction for further analysis in Snowflake/Sigma |
| **PNG** | Client-side (canvas capture) | Reports, presentations |
| **SVG** | Client-side (vector) | High-quality print/embed |

**File:** `src/lib/export-utils.ts`

### 5.5 Data Integrity Verification Pipeline (Spec Written — April 19)

A **Data Integrity Verification Pipeline** has been specified (`docs/DATA_INTEGRITY_VERIFICATION_SPEC.md`) to ensure AI-generated dashboard data is accurate:

| Layer | Name | Model | Cost | Purpose |
|-------|------|-------|------|---------|
| 1 | Deterministic checks | None | Free | 13 structural checks (D-01–D-13): schema validation, math verification, unit consistency |
| 2 | AI verification | Claude Haiku | ~$0.002/call | Semantic check: do numbers make business sense? |
| 2.5 | Escalation review | Claude Sonnet | ~$0.015/call | Deep review when Haiku confidence < 0.70 |

**Output:** Each dashboard generation gets a verification badge (green/yellow/red shield) displayed in the chat panel. Verification is **advisory only** — patches always apply regardless of verdict. This addresses the analytics team's concern about AI-generated data accuracy without blocking the user experience.

---

## 6a. Data Power-User Tools (New — April 19)

Three new data tools have been implemented, all behind admin feature toggles:

### 6a.1 Data Explorer (`/data/explorer`)

Schema browser + column profiler for exploring available data:
- **Schema tree:** Browse tables, columns, and types
- **Data preview:** Sample rows from any table
- **Column profiler:** Statistics (min, max, mean, null%, cardinality) per column
- **Glossary integration:** See which glossary terms map to which columns

**Files:** `src/app/data/explorer/page.tsx`, `src/components/data/SchemaExplorer.tsx`, `DataPreview.tsx`, `DataProfiler.tsx`

### 6a.2 Visual Query Builder (`/data/visual-query`)

Sigma-style drag-and-drop interface for building queries without SQL:
- **Column picker:** Drag columns to select, group, filter
- **Filter builder:** Visual condition builder (AND/OR, operators, values)
- **Formula bar:** Calculated fields with expression editor
- **Live preview:** See results as you build
- **SQL transpiler:** Converts visual query to executable SQL (`src/lib/data/visual-to-sql.ts`)

**Files:** `src/components/data/VisualQueryBuilder.tsx`, `ColumnPicker.tsx`, `FilterBuilder.tsx`, `FormulaBar.tsx`

### 6a.3 Query Playground (`/data/playground`)

Multi-tab SQL notebook for ad-hoc analysis:
- **Multi-tab sessions:** Multiple queries open simultaneously
- **SQL editor:** Syntax highlighting, auto-complete
- **Result tables:** Paginated, sortable result display
- **Quick charts:** One-click visualization from query results
- **Result diff:** Compare results between runs
- **Session persistence:** Saved to localStorage

**Files:** `src/app/data/playground/page.tsx`, `src/components/data/PlaygroundTab.tsx`, `QuickChart.tsx`, `ResultDiff.tsx`, `SqlEditor.tsx`

### 6a.4 Implications for Analytics Team

These tools shift InsightHub from a pure "AI-builds-it-for-you" platform toward a **self-service analytics** platform. Power users (analysts, data-savvy managers) can now:
- Explore schemas before asking the AI to build dashboards
- Build queries visually without writing SQL (Sigma-like experience)
- Run ad-hoc SQL in a notebook environment
- Profile data quality before building visualizations

This overlaps more with Sigma's territory but targets a middle tier of users who are too technical for pure natural language but don't need Sigma's full capabilities.

---

## 7. Self-Service Implications for the Analytics Team

### 7.1 What Changes for Your Team

| Before InsightHub | After InsightHub |
|-------------------|-----------------|
| Business users submit ad-hoc data requests | Users self-serve simple dashboards via AI |
| Analysts build every dashboard in Sigma | Analysts handle complex/custom work; routine dashboards are AI-built |
| Metric definitions live in tribal knowledge or scattered docs | Definitions are centralized, version-controlled, and AI-enforced |
| Data access requests go through manual ticketing | RBAC is self-administered by admins with audit trail |

### 7.2 Expected Analytics Team Benefits

- **Reduced ad-hoc request volume** — routine "show me MRR by region" requests are self-served
- **Metric consistency** — glossary prevents definition drift across business units
- **Faster prototyping** — stakeholders can prototype dashboard ideas before requesting Sigma workbooks
- **Audit trail** — every dashboard creation, data query, and permission change is logged

### 7.3 Potential Concerns

| Concern | Mitigation |
|---------|-----------|
| Users bypass Sigma for complex analysis | InsightHub's sample data and limited chart types naturally limit complexity |
| Metric definitions set without analytics review | Glossary CRUD is ADMIN-only; add an approval workflow |
| AI generates misleading visualizations | Widget library + glossary enforcement promote correctness |
| Dashboard proliferation (hundreds of unused dashboards) | Monitor via audit logs; consider auto-archive policy |
| Data discrepancies between InsightHub and Sigma | Align InsightHub views with Sigma datasets; shared glossary sync |

---

## 8. Audit & Observability (Data Governance Lens)

### 8.1 What's Logged

Every data-touching action is captured:

| Action | Logged Fields | Query Capability |
|--------|--------------|-----------------|
| Dashboard create/update/delete | userId, dashboardId, schema (metadata) | Filter by user, date range |
| Data query execution | Source, category, access result | Track who queries what data |
| Permission changes | Group assignments, role changes | Full change history |
| Glossary modifications | Term, old/new values | Definition audit trail |
| AI chat interactions | User message, AI response, session | Review AI-generated queries |

### 8.2 Access Denial Tracking

When a user is denied access to a data category, the API returns:
```json
{
  "error": "Access denied",
  "message": "You don't have permission to access Revenue data.",
  "dataSource": "sample_revenue",
  "category": "Revenue"
}
```

**Recommendation:** Log access denials to the audit system (currently only returned as HTTP 403 but not persisted). This gives visibility into unmet data needs — if 30 users are getting denied Revenue access, maybe it's time to expand access or create a FILTERED view.

### 8.3 Query Cost Monitoring (Phase 3)

When Snowflake is connected, recommend logging:
- Query execution time
- Bytes scanned
- Warehouse credit consumption
- Per-user query cost allocation

This aligns with Snowflake's `QUERY_HISTORY` view but centralizes it in InsightHub's audit system for a unified governance picture.

---

## 9. Comparison with Existing Stack

### 9.1 Where InsightHub Fits

```
Data Flow:
  Snowflake (source of truth)
       │
       ├─── Sigma (analyst-facing: complex workbooks, explorations, embeds)
       │
       └─── InsightHub (employee-facing: AI-built dashboards, self-service)
                │
                └─── Glossary (shared metric definitions — governs both)
```

### 9.2 Feature Comparison

| Capability | Sigma | InsightHub | Notes |
|-----------|-------|-----------|-------|
| Live Snowflake queries | ✅ | ✅ (behind toggle) | Connector implemented with security layers; SQL injection fixes pending |
| Natural language query | ❌ | ✅ | InsightHub's core differentiator |
| SQL editing | ✅ | ✅ (AI copilot) | Sigma = manual; InsightHub = AI-generated |
| Drag-and-drop canvas | ✅ | ✅ | Both support grid-based layouts |
| Metric layer / glossary | ✅ (Sigma metrics) | ✅ (YAML glossary) | Must be kept in sync |
| Row-level security | ✅ (Snowflake-native) | ✅ (category + metric RBAC) | Metric-level granularity now available |
| Embedding | ✅ | ❌ | Sigma better for external/embedded analytics |
| Collaboration | ✅ (comments, sharing) | ✅ (VIEW/COMMENT/EDIT shares) | Similar |
| Version history | ✅ | ✅ | Both support versioned dashboards |
| Scheduling / alerts | ✅ | ❌ | Sigma handles scheduled delivery |
| Cost governance | ✅ (warehouse budgets) | ⬜ Phase 3 | Need query cost controls |
| Data explorer | ✅ (schema browser) | ✅ (schema + profiler) | InsightHub includes column profiling |
| Visual query builder | ✅ (drag-and-drop) | ✅ (Sigma-style VQB) | New Sigma-style interface |
| SQL playground | ✅ (SQL runner) | ✅ (multi-tab notebook) | New multi-tab SQL notebook |

### 9.3 Complementary, Not Competing

InsightHub is not replacing Sigma. It's serving a different audience:
- **Sigma** → Analysts who know SQL and data modeling
- **InsightHub** → Business users who think in natural language

The glossary bridges both: metric definitions that govern AI behavior in InsightHub should match Sigma's metrics layer definitions.

---

## 10. Recommendations & Action Items

### Immediate (Pre-Production Snowflake)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Extend glossary editing to a `DATA_STEWARD` permission (not just ADMIN) | InsightHub dev team | High |
| 2 | Add `status` lifecycle to glossary terms (draft → approved → deprecated) | InsightHub dev team | High |
| 3 | Create Sigma ↔ InsightHub glossary sync validation script | Analytics team | Medium |
| 4 | Log access denials to audit system for unmet-need visibility | InsightHub dev team | Medium |
| 5 | Implement the FILTERED access level (aggregate-only access) | InsightHub dev team | Medium |
| 5a | **Fix 3 SQL injection vectors before enabling Snowflake in production** | InsightHub dev team | **Critical** |
| 5b | **Unify PII stripping across all data sources (sample + Snowflake)** | InsightHub dev team | **Critical** |
| 5c | Review data tool access controls (who can access Visual Query Builder, Playground) | Both teams | High |

### Phase 3 (Snowflake Production Enablement) — Connector Implemented, Pending Fixes

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 6 | Create `INSIGHTHUB_ANALYTICS` schema with curated views | Analytics team (you) | Critical |
| 7 | Create `INSIGHTHUB_SVC` service role with SELECT-only grants | Analytics team (you) | Critical |
| 8 | Set up dedicated `INSIGHTHUB_WH` warehouse (XS, auto-suspend 60s) | Analytics team (you) | Critical |
| 9 | Implement query timeout (30s) and row limit (10K) in connector | InsightHub dev team | High |
| 10 | Add DDL blocking (reject any query containing CREATE/DROP/ALTER/INSERT/UPDATE/DELETE) | InsightHub dev team | High |
| 11 | Map InsightHub RBAC roles → Snowflake session roles | Both teams | High |
| 12 | Apply dynamic data masking policies on PII columns in Snowflake views | Analytics team (you) | High |
| 13 | Switch from password auth to key-pair authentication | Analytics team (you) | Medium |
| 14 | Implement per-user query cost tracking and budget alerts | Both teams | Medium |
| 15 | ~~Validate AI-generated SQL against INFORMATION_SCHEMA before execution~~ | InsightHub dev team | ✅ Schema introspection implemented |

### Long-Term Governance

| # | Action | Priority |
|---|--------|----------|
| 16 | Establish shared governance board for metric definitions (analytics + finance + ops) | Medium |
| 17 | Build automated regression testing: compare InsightHub dashboard values against Sigma benchmarks | Low |
| 18 | Create "InsightHub Data Catalog" page showing available metrics, their sources, and access levels | Medium |
| 19 | ~~Implement metric lineage tracking (which dashboards use which glossary terms)~~ | ✅ Glossary → widget linking implemented (`src/lib/widget-matching.ts`) |
| 20 | Evaluate data tools (VQB, Playground, Explorer) overlap with Sigma and define team usage guidelines | Medium |
| 21 | Implement Data Integrity Verification Pipeline (spec written: `docs/DATA_INTEGRITY_VERIFICATION_SPEC.md`) | High |

---

## Appendix A: Key File Index for Analytics Review

| Area | File | Lines of Interest |
|------|------|-------------------|
| Glossary (YAML) | `glossary/terms.yaml` | 1–372 (all metric definitions) |
| Glossary API | `src/app/api/glossary/route.ts` | CRUD endpoints |
| Glossary → widgets | `src/lib/widget-matching.ts` | Term-to-widget matching engine |
| Glossary components | `src/components/glossary/*.tsx` | RelatedWidgets, AddToDashboard, WidgetPreview |
| Data categories | `src/lib/auth/permissions.ts` | 5–26 (category + meta-category mapping) |
| Metric-level RBAC | `src/lib/auth/permissions.ts` | 57–71 (MetricAccessRule, MetricPermissionCheck) |
| Financial meta-cat | `src/lib/auth/permissions.ts` | 16–26 (Financial = Revenue + Sales) |
| Access templates | `src/lib/auth/permissions.ts` | 82–176 (role → data access levels) |
| Permission hook | `src/hooks/useDataSourcePermissions.ts` | Client-side permission awareness |
| Data query API | `src/app/api/data/query/route.ts` | 36–77 (permission check + query execution) |
| PII stripping | `src/app/api/data/query/route.ts` | 7–33 (field redaction) |
| AI system prompt | `src/lib/ai/prompts.ts` | 141–421 (full prompt with glossary, data sources, SQL modes) |
| SQL copilot modes | `src/lib/ai/prompts.ts` | 189–286 (Explain, NL→SQL, Optimize, Verify, Formula) |
| Snowflake dialect ref | `src/lib/ai/prompts.ts` | 228–235 (Snowflake-specific syntax) |
| Snowflake env vars | `src/lib/env.ts` | 80–103 (account, username, password, warehouse, database, schema) |
| Snowflake connector | `src/lib/snowflake/*.ts` | 5 files: config, connection, queries, security, schema |
| Snowflake provider | `src/lib/data/snowflake-data-provider.ts` | Dual-provider with sample fallback |
| Redis caching | `src/lib/redis/client.ts` | Query result caching |
| Data Explorer | `src/app/data/explorer/page.tsx` | Schema browser + column profiler |
| Visual Query Builder | `src/app/data/visual-query/page.tsx` | Sigma-style VQB |
| VQB components | `src/components/data/VisualQueryBuilder.tsx` | Core VQB + ColumnPicker, FilterBuilder, FormulaBar |
| Visual-to-SQL | `src/lib/data/visual-to-sql.ts` | VQB → SQL transpiler |
| Query Playground | `src/app/data/playground/page.tsx` | Multi-tab SQL notebook |
| Playground components | `src/components/data/PlaygroundTab.tsx` | Tab, QuickChart, ResultDiff, SqlEditor |
| Admin settings | `src/app/admin/settings/settings-client.tsx` | Feature toggles + AI prompt editor |
| Widget library | `src/lib/data/widget-library.ts` | Reusable widget definitions |
| Audit logging | `src/lib/audit.ts` | 45–73 (log creation) |
| Export utilities | `src/lib/export-utils.ts` | 14–143 (CSV, PNG, SVG) |
| Data sources (AI) | `src/lib/ai/prompts.ts` | 24–83 (full schema descriptions for AI) |
| Smart suggestions | `src/lib/ai/prompts.ts` | 430–496 (context-aware metric recommendations) |
| Data integrity spec | `docs/DATA_INTEGRITY_VERIFICATION_SPEC.md` | 3-layer verification pipeline design |
| Sprint review | `docs/sprint-review-2026-04-19.md` | Full code review with security findings |

## Appendix B: Snowflake Env Configuration Template

```env
# Phase 3 — Snowflake Connector
SNOWFLAKE_ACCOUNT=your_org-your_account
SNOWFLAKE_USERNAME=INSIGHTHUB_SVC
SNOWFLAKE_PASSWORD=<use key-pair auth instead>
SNOWFLAKE_WAREHOUSE=INSIGHTHUB_WH
SNOWFLAKE_DATABASE=ANALYTICS_PROD
SNOWFLAKE_SCHEMA=INSIGHTHUB_ANALYTICS
```

## Appendix C: Glossary Term Schema

Each glossary entry supports the following fields:

```yaml
- term: "Metric Name"
  category: "Revenue | Retention | Support | Sales | Product"
  definition: "Official business definition..."
  formula: "SQL-style calculation formula"
  data_source: "source_table_name"
  exclusions:
    - "What's excluded from the calculation"
  related_terms: ["Other", "Metrics"]
  approved_by: "Name"
  last_reviewed: "YYYY-MM-DD"
```
