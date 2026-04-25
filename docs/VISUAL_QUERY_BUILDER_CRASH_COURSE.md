# Visual Query Builder Crash Course — Zero to Hero

**For:** Jeff Coy
**Purpose:** Go from "I have no idea what this is" to "I can confidently demo this to the Data Analytics Head"
**Date:** April 23, 2026

---

## How to Use This Document

Work through this front-to-back on a free afternoon. Each section builds on the previous one, and by the end you'll be able to answer any business question the schema can support without writing a line of SQL.

You will need:

- InsightHub running locally (`npm run dev`, then open `http://localhost:3000`)
- 30–45 minutes
- This document open alongside the browser

**Every example below is a real query you can run right now on the sample data.** No setup, no seeding, no pretending.

---

## Part 1 — The Big Picture (5 min)

### What Is the Visual Query Builder?

The Visual Query Builder (VQB) is a **point-and-click interface for exploring your data**. Think Excel pivot tables, but:

- Connected to your real warehouse (Snowflake in production, sample data in dev)
- Generates SQL you can review
- Enforces permissions and row-level security before it runs
- Gives you a transparent audit trail of exactly what was executed and what was masked

**You don't write SQL.** You pick a table, click columns, maybe drag in a filter, and the VQB writes the SQL for you. The results appear below.

### Why Does It Exist?

Because the company has data in Snowflake, and the only people who can currently answer questions about it are the 3-5 folks who know SQL. That creates a bottleneck:

- Marketing wants to know "churn rate in the Midwest last quarter?"
- Ops wants to know "how many support tickets came in by category?"
- Finance wants to know "which deal sources converted best?"

Every question today is an email to the analytics team, a 2-day wait, and a one-off spreadsheet that gets stale immediately. The VQB makes every employee self-serve without giving them SQL footguns or exposing data they shouldn't see.

### The Three Pillars

The VQB is built on three promises to your data analytics owner:

1. **No raw SQL trust.** The VQB sends the server a structured config (not SQL); the server regenerates the SQL authoritatively. A malicious client cannot smuggle `DROP TABLE` past us.
2. **Permissions always enforced.** Your role, department, and region decide which tables you see, which columns come back, and what rows are filtered.
3. **Total transparency.** An audit panel shows you the SQL that ran, the RLS filters that were injected, and the columns that were masked. If the analytics owner wants to double-check, they see everything.

Keep these three pillars in mind — you'll see them reflected in every UI decision.

---

## Part 2 — The Layout (3 min)

Open `http://localhost:3000/data/visual-query` (or click **⚡ Query Builder** in the top navbar).

You'll see four regions:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Query Builder   │   [Audit]  [Run]  [Save]              │  ← Top bar
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  Column  │   Selected Columns   Aggregations                │
│  Picker  │   Filters            Formulas                    │  ← Query canvas
│          │                                                  │
│  (tree)  │                                                  │
│          │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│          │                                                  │
│          │   Results Preview (top 10 rows)                  │  ← Results
│          │                                                  │
│          ├──────────────────────────────────────────────────┤
│          │   Audit panel (4 tabs, when toggled on)          │  ← Transparency
└──────────┴──────────────────────────────────────────────────┘
```

**Left sidebar** — the schema. Tables grouped by category (Operations, Financial, Retention, Support, etc.). Click a table to expand it, click a column to add it to your query.

**Main canvas** — five panels: Selected Columns, Aggregations, Filters, Formulas, (and a stats bar showing `X tables · Y columns · Z filters · Complexity N/10`).

**Top-right buttons**:

- **Audit** (shield icon) — toggles the transparency panel. An amber dot appears here when the server modified your query with RLS or masked columns.
- **Run** (play icon) — executes now. You usually don't need this — the VQB auto-runs 500ms after your last click.
- **Save** (green) — saves the query to your browser's localStorage so you can come back to it.

---

## Part 3 — Your First Query (5 min)

We'll answer: **"What's the MRR for each month?"**

### Step-by-step

1. In the left sidebar, find the **Financial** category.
2. Click to expand `mrr_by_month`. You'll see 3 columns: `month`, `mrr`, `growth`.
3. Click `month` — it jumps to "Selected Columns" on the right.
4. Click `mrr` — same thing. Two columns now.
5. Wait half a second. The results table populates below with 16 rows: one per month, showing both columns.

**That's it.** You just ran your first query.

### What actually happened

Click the **Audit** button (top-right). A panel slides up at the bottom with 4 tabs. Go to the "Your Query" tab:

```sql
SELECT
       mrr_by_month.month,
       mrr_by_month.mrr
  FROM mrr_by_month
 LIMIT 1000;
```

The VQB built that SQL from your two clicks. The `LIMIT 1000` is a safety cap (we'll cover it later).

Click "What Ran" — same SQL (no RLS modifications because this source doesn't trigger any security policies for your role).

Click "Execution" — you'll see `Data source: Sample data`, cache miss, how many ms it took, and how many rows came back.

**Congratulations — you've run a query and verified it.** Everything else in this document is variations on this pattern.

---

## Part 4 — The Core Concepts (15 min)

These are the five levers every query uses. Learn them once and you can build anything.

### 4.1 — Tables

A **table** is a dataset. Pick one (or more, if you need JOINs — Snowflake mode only).

In sample mode you'll see tables like:

- `kpi_summary` — a snapshot of all key metrics (one row)
- `mrr_by_month` — revenue by month
- `churn_by_region` — customer churn grouped by region
- `tickets_by_category`, `tickets_by_month`, `tickets_by_team`
- `revenue_by_type`, `revenue_by_month`
- `deals_pipeline`, `deals_by_source`
- `customers_by_plan`, `customers_by_region`
- `usage_by_feature`, `usage_by_month`

**Rule of thumb:** the table name tells you the grain. `mrr_by_month` has one row per month. `churn_by_region` has one row per region. Pick the table whose grain matches your question.

When you first land on the page, the VQB auto-selects the first table for you so the schema tree isn't a dead end.

### 4.2 — Columns

Columns are what you want to **see** in the results. Click a column in the left sidebar and it shows up in "Selected Columns" on the right.

Each column card has:

- **Eye icon** — toggles visibility. Useful when you want a column for filtering but don't want to display it.
- **Trash icon** — removes it entirely.
- **Table.column** subtitle — so you remember where it came from.

When you select **zero** columns, the generated SQL falls back to `SELECT *` (all columns from the table). Usually you'll pick 2-5.

### 4.3 — Aggregations (SUM, AVG, COUNT, etc.)

An **aggregation** collapses many rows into one using a function. The canonical business question is: *"How many?"* or *"What's the total?"* or *"What's the average?"*

The VQB supports 7 aggregations:

| Function | Use when you want |
|---|---|
| `SUM` | Total of all values (revenue, count of customers, hours worked) |
| `AVG` | Typical value (average deal size, average response time) |
| `COUNT` | Number of rows (how many tickets, how many customers) |
| `COUNT_DISTINCT` | Number of unique values (how many different customers) |
| `MIN` / `MAX` | Smallest / largest value |
| `MEDIAN` | Middle value — more robust than AVG when you have outliers |

To add one: click **+ Add** next to the "Aggregations" header. Pick a function and a column. Optionally give it an alias (a friendlier name for the result column).

**Aggregations almost always come with a GROUP BY.** If you do `SUM(mrr)` and nothing else, you get one row (the grand total). If you want *total MRR per month*, you need to group by month. Which brings us to…

### 4.4 — GROUP BY

GROUP BY says: *"Collapse rows that share the same value in this column, and run the aggregations within each group."*

The VQB doesn't have a dedicated GROUP BY UI panel yet — instead, when you pick an aggregation, any regular **visible column** you've added will automatically act as the GROUP BY key in the generated SQL.

**Translation:**

```
Selected Columns: month
Aggregations:     SUM(mrr) as total_mrr

→ Generated SQL: SELECT month, SUM(mrr) FROM mrr_by_month GROUP BY month
```

So: to group by month, just add `month` as a regular column and add `SUM(mrr)` as an aggregation. Done.

### 4.5 — Filters (WHERE clauses)

A **filter** limits which rows the aggregation or output considers. Classic business questions:

- "*Just* the Midwest region" — `region equals 'Midwest'`
- "Only deals worth over $10K" — `value greater_than 10000`
- "Tickets in the last 30 days" — date_range filter on `created_at`

To add one, scroll to the Filters panel (built into the main canvas) and click **+ Add Filter**. Pick a column, pick an operation, enter a value.

Supported operations:

- Comparison: `equals`, `not_equals`, `greater_than`, `less_than`, and their `_or_equal` versions
- Text: `contains`, `not_contains`, `starts_with`, `ends_with`
- Null checks: `is_null`, `is_not_null`
- Set membership: `in`, `not_in` (comma-separated values)
- Ranges: `between`, `date_range`

Multiple filters combine with AND by default; each filter has a toggle to switch it to OR.

### 4.6 — ORDER BY & LIMIT

**ORDER BY** sorts the output. Ascending (`ASC`, low to high) or descending (`DESC`, high to low).

**LIMIT** caps the number of rows. The VQB enforces a maximum of **10,000 rows** (clamp set server-side so a malicious client can't override it). The default is 1,000.

These live in the filters / canvas area — they're part of the structured config even though they don't have giant UI panels.

### 4.7 — Formulas (Snowflake only)

Formulas are calculated fields. Example: you want `revenue_per_customer = total_revenue / total_customers`. You'd add a formula with that expression, give it a name, and it appears alongside your other columns.

**In sample mode the evaluator doesn't execute formulas** — the audit panel's Execution tab will flag them as skipped. Formulas work only against Snowflake. (This is a scope decision: evaluating arbitrary expressions safely in JS requires a whole sandboxed expression parser.)

---

## Part 5 — The Audit Panel (10 min) — *The Trust Tool*

This is the single most important section of this document. The Audit Panel is how you demonstrate to the Data Analytics Head that InsightHub is safe to deploy.

Open any query's audit panel (click the shield icon top-right). Four tabs.

### Tab 1 — Your Query

The SQL your visual clicks produced. Exactly what you'd get if you took your pivot config and typed it out by hand.

**Why it matters:** it proves the UI is faithful. If a user clicks `SUM(mrr) GROUP BY month`, the Your Query tab shows exactly that — no hidden aliases, no rewrites. This tab is the baseline.

### Tab 2 — What Ran

The SQL the server actually executed. If RLS rewrote your query, this is where you see the rewrite.

**Example flow:**

- A non-admin user queries `customer_details`
- An RLS policy named `pii_department_isolation` says "you can only see customers in your department"
- **Your Query** shows: `SELECT * FROM customer_details`
- **What Ran** shows: `SELECT * FROM customer_details WHERE department = 'Sales'`
- Amber "modified" badge next to the tab name
- Amber dot next to the Audit button in the toolbar so you notice without opening the panel

**Why it matters:** the analytics owner doesn't have to trust that RLS fired — they see it. If someone claims "the query isn't filtering properly," you have evidence.

### Tab 3 — Security

Three sections:

1. **Access level** — `FULL`, `FILTERED`, or `NONE`. FILTERED means some rows/columns were restricted.
2. **Applied RLS policies** — a card for each policy that fired, with its resolved SQL condition, description, and priority number. If the engine applied the "Time-based Data Access" policy that says *only show data from the last 2 years for non-admins*, you see the exact condition.
3. **Masked columns** — a list of columns whose values were redacted or hashed. Each shows its sensitivity tag (PII, FINANCIAL, etc.) and masking type (FULL_MASK, PARTIAL_MASK, HASH, REDACT, NULL).

Plus identity context cards: your role, department, region, and boolean flags for whether you have financial/PII access. This is what the RLS engine saw when it made decisions.

**Why it matters:** if a user complains "I'm seeing wrong data," this tab tells them exactly which policy is at play. If an auditor asks "prove masking works," you screenshot this tab.

### Tab 4 — Execution

Operational metadata:

- **Data source** — Snowflake or Sample
- **Cache hit / miss** — served from Redis or fresh
- **Execution time** — milliseconds
- **Rows returned / Row limit** — post-cap
- **Source** — which table you hit
- **Executed at** — server timestamp

Plus a small amber box that lists **unsupported features in sample mode** — e.g., "1 JOIN(s) — not evaluated in sample mode." That's the VQB's promise to never silently drop an instruction.

**Why it matters:** performance concerns, cost concerns, SLA concerns. "Did this cache-hit?" is a 30-second answer.

---

## Part 6 — Sample Mode vs Snowflake Mode (5 min)

You will encounter both. Know the difference.

### Sample Mode (what you have today)

- **When:** Snowflake isn't configured (`SNOWFLAKE_ACCOUNT` etc. missing from `.env.local`)
- **Data:** Generated in-memory from `src/lib/data/sample-data.ts`. Fixed row counts, deterministic values.
- **Query engine:** A JS evaluator (`src/lib/data/visual-query-evaluator.ts`) that executes WHERE / GROUP BY / aggregations / ORDER BY / LIMIT directly on the in-memory rows.
- **What works:** All single-table operations, including filters, group-by, every aggregation, ordering, limiting.
- **What doesn't:** JOINs (single-table only), custom formulas, real RLS rewrites. These are flagged in the audit panel as `skippedFeatures`.
- **Great for:** demos, development, showing the UX. Sample data is modeled on the real schema shapes, so the patterns are identical.

### Snowflake Mode (production)

- **When:** Snowflake is configured with service-account creds
- **Data:** Real warehouse
- **Query engine:** Snowflake itself, via the `executeSecureQuery` wrapper with the full security pipeline
- **What works:** Everything. Real SQL, real RLS, real column masking, real cache via Redis
- **What doesn't:** Your laptop. Seriously — production mode needs the warehouse.
- **Great for:** actual analytics, production rollout

### How to tell which mode you're in

- Bottom-right of the audit panel's Execution tab: **Data source: Snowflake** (green) or **Sample data** (amber)
- A skippedFeatures block appears in sample mode when your query includes something unsupported

**The key point:** every query you build in sample mode will work identically in Snowflake mode, plus JOINs and formulas will start working. You're not throwing away knowledge when you move to prod.

---

## Part 7 — Recipes (15 min) — *Real Examples You Can Run Now*

Work through each of these to cement the concepts. Every one of them runs against the sample data you have right now.

### Recipe 1 — Monthly Recurring Revenue Trend

**Question:** How has MRR trended month over month?

1. Expand `mrr_by_month` (Financial category)
2. Click `month`
3. Click `mrr`
4. Auto-runs. 16 rows, month + MRR value.

**Optional upgrade:** add `growth` as a third column to see month-over-month percent change.

### Recipe 2 — Total Revenue by Month (Aggregation)

**Question:** If we had multiple revenue records per month, what would the grand total per month be?

1. Expand `revenue_by_month`
2. Click `month` (goes to Selected Columns)
3. Click **+ Add** next to Aggregations
4. In the aggregation row: function=`Sum`, column=`total`, alias=`total_revenue`

Results: one row per month with the summed total. The generated SQL has `GROUP BY month`.

### Recipe 3 — Highest Churn Regions

**Question:** Which regions have the worst customer retention?

1. Expand `churn_by_region`
2. Click `region` and `churn_rate`
3. Add an ORDER BY: (no UI panel yet — skip this step for now)
4. Results show all regions sorted by whatever order the generator emits.

**To force a sort:** send the equivalent query via the API or use a filter to narrow it:

- Add filter: `churn_rate` greater_than `5`
- Now you only see high-churn regions.

### Recipe 4 — Deal Pipeline Health

**Question:** How many deals are in each pipeline stage, and what's their total value?

1. Expand `deals_pipeline`
2. Click `stage` (Selected Columns)
3. Add aggregation: `Sum` of `value`, alias=`total_value`
4. Add aggregation: `Sum` of `count`, alias=`deal_count`

Results: one row per stage showing how many deals and how much money is at each step of the funnel.

### Recipe 5 — Support Team Health Check

**Question:** Which support teams have the highest resolution time and the lowest CSAT?

1. Expand `tickets_by_team`
2. Click `team`, `avg_resolution_hours`, `csat`
3. Done — one row per team with resolution time and satisfaction score side by side.

**Upgrade:** filter to `csat < 85` to see just the teams with satisfaction problems.

### Recipe 6 — Feature Adoption Leaderboard

**Question:** Which product features have the best adoption rates?

1. Expand `usage_by_feature`
2. Click `feature`, `adoption_rate`, `daily_users`
3. Results show every feature with its adoption metrics.

### Recipe 7 — High-Value Customer Plans

**Question:** What's the total MRR contribution per customer plan?

1. Expand `customers_by_plan`
2. Click `plan` (Selected Columns)
3. Add aggregation: `Sum` of `revenue`, alias=`plan_revenue`
4. Add aggregation: `Sum` of `count`, alias=`customer_count`

Results: plan by plan, revenue and customer count. If `count` aggregates to 1250 for enterprise and their revenue is $500K, you know enterprise is your golden plan.

### Recipe 8 — Multi-Filter Investigation

**Question:** Show me the high-churn regions that specifically have more than 500 customers (i.e., high-impact churn).

1. Expand `churn_by_region`
2. Click `region`, `churn_rate`, `total_customers`
3. Filter 1: `churn_rate` greater_than `3`
4. Filter 2: `total_customers` greater_than `500` (logical operator defaults to AND)

Results: only regions that meet *both* conditions. These are the ones you'd escalate to leadership first.

---

## Part 8 — How to Demo This to the Analytics Head (5 min)

Here's your script when they sit down next to you:

1. **Open the page.** "This is the Visual Query Builder. Anyone in the company can explore our warehouse through this without SQL."

2. **Build Recipe 1 live** (MRR by month). Takes 4 clicks and 2 seconds. Say: "Every business question has this shape — pick a table, pick the columns that answer the question."

3. **Click Audit → Your Query tab.** "Here's the SQL it generated. No black box."

4. **Click the What Ran tab.** "Here's the SQL the server actually executed. On this query no RLS fired because MRR is public data. Watch what happens when I query customer PII."

5. **Switch to a PII-heavy source** (e.g., a customer detail table). "Now look at What Ran — the amber badge means the server injected a WHERE clause. Click Security to see which policy fired and what SQL condition it added."

6. **Click Security tab.** "This shows the identity the server saw for me (role, department, PII-access flag) and the RLS policies that applied. If I were in a different role, different policies would fire — and this panel would show them."

7. **Click Execution tab.** "Data source, cache hit, timing, row count — everything operational."

8. **The clincher:** "The SQL you're seeing in Your Query is generated client-side for display. The SQL in What Ran is regenerated server-side from the same structured config — never trusting client SQL. If someone tried to inject a `DROP TABLE`, it would never leave the browser."

Expect these questions:

- **"What if I want to see raw SQL?"** — "You just did. Your Query tab."
- **"What if someone is in a role that shouldn't see this table at all?"** — "They'd get a 403 before any SQL ran. The audit log captures the attempt." (Show them `auditLog` in the Prisma schema.)
- **"What about cost controls on Snowflake?"** — "Row limit clamped to 10,000. Cached via Redis. Rate-limited to 30 queries/minute per user."
- **"Can I export?"** — "Results preview only right now. Export is on the roadmap for dashboard promotion."

---

## Part 9 — Troubleshooting (Common Issues)

### "No accessible data sources"

Your logged-in user's role has zero data permissions. Check `src/lib/auth/permissions.ts` and make sure you're running as a role with at least some `data.*` set to `FULL`. Dev mode defaults to an ADMIN user.

### "Schema request failed with 401"

You're not signed in. The `/api/data/schema` endpoint requires auth. In dev mode, set `NEXT_PUBLIC_DEV_MODE=true` in `.env.local` to get the baked-in dev user.

### "HTTP 400: Invalid query configuration"

The VQB sent a config that doesn't pass validation. The error details in the response tell you which rule failed. Most common: no columns/aggregations/formulas selected, or a filter with a missing value.

### Results don't match the SQL

In sample mode, this **used to be** a real bug — the old code returned raw generator output regardless of your WHERE clauses. That's fixed. If you see it now, the evaluator has a bug — file a regression.

In Snowflake mode, if results and SQL disagree, check the What Ran tab — RLS modified your query. This is working as intended.

### Amber dot next to the Audit button

Your query was modified by RLS or had columns masked. Open the Audit panel to see which policies fired. This is a feature, not a bug — the server is doing its job.

### Query auto-runs before I'm ready

The VQB debounces execution 500ms after your last change. If you're mid-edit, the timer resets. If that's still too eager, modify `VisualQueryBuilder.tsx` — the constant is literally the `500` in the auto-execute effect.

### "Skipped features" warning in sample mode

Sample mode's JS evaluator doesn't do JOINs or formulas. The audit tab flags anything unsupported. Move to Snowflake mode (or reshape your query to single-table) to execute everything.

---

## Part 10 — Pro Tips

**1. Use the Complexity score.** The stats bar shows `Complexity: N/10`. 1-3 is simple, 4-6 is moderate, 7-10 is warehouse-burning. On real Snowflake, high-complexity queries cost more credits. Use this as a cost signal.

**2. Aliases make results readable.** When you add an aggregation, give it an alias like `total_mrr` instead of letting it default to `sum_mrr`. Result columns become much easier to read.

**3. Use filters before aggregations.** Filters run before aggregations (it's a WHERE, not a HAVING). Filtering down your row set first makes aggregations more interpretable.

**4. Save queries you'll reuse.** The Save button stores queries in localStorage. Give them descriptive names like `Monthly MRR Trend` so you can return to them.

**5. Deep-link from other pages.** The URL pattern `/data/visual-query?table=mrr_by_month&column=mrr` pre-populates a query. The Data Explorer page uses this to send users from browsing into building.

**6. The audit log is your friend.** Every VQB execution writes a row to the `auditLog` Prisma table: user, source, row count, applied policies, masked columns. When the compliance team asks "who accessed customer data last Tuesday," you run one query.

**7. Don't paste SQL into production via the VQB.** The VQB is for the 95% of questions that fit into `SELECT/WHERE/GROUP BY/ORDER BY/LIMIT`. The other 5% (CTEs, window functions, UDFs) still need the Query Playground (deferred feature) or a real Snowflake client.

**8. The Save feature is local-only for now.** Saved queries live in your browser's localStorage. Clearing site data wipes them. Persistent server-side storage is on the roadmap as a follow-up.

**9. The server never trusts client SQL.** When you look at `page.tsx`'s `executeQuery`, it sends the full `config` object (not the SQL string). The server regenerates SQL from scratch using its own `visualToSQL()` function. This is the single most important security property of the feature.

**10. Prefer aggregations over large result sets.** Fetching 10,000 raw rows is slower, more bandwidth, harder for humans to parse, and more likely to expose something sensitive. If your question has a summary answer, let the database compute it.

---

## Part 11 — Cheat Sheet

Stick this on your wall.

```
QUESTION                              →   VQB BUILD
─────────────────────────────────────────────────────
"How much total X is there?"          →   SUM(x)
"What's the average X?"               →   AVG(x)
"How many records?"                   →   COUNT(*)
"How many unique Y?"                  →   COUNT_DISTINCT(y)
"X broken down by Y"                  →   select y, SUM(x) — Y auto-becomes GROUP BY
"Only records where X > 100"          →   filter: x greater_than 100
"Only records in ['a','b','c']"       →   filter: x in a,b,c
"Sorted by X descending"              →   ORDER BY x DESC (via orderBy config)
"Top 10"                              →   LIMIT 10
"Anything but NULL"                   →   filter: x is_not_null
```

Keyboard tips:

- `⌘/` — global command palette (future)
- Click column in sidebar — adds to Selected Columns
- Click column in "Selected Columns" card (eye icon) — toggles visibility without removing
- Trash icon on column card — removes from query

Buttons:

- **Run** — force an immediate execution (normally auto-runs)
- **Audit** — open transparency panel
- **Save** — persist query to localStorage

---

## Part 12 — Where to Go From Here

When you're comfortable with everything above:

1. **Connect Snowflake.** Follow the Snowflake Integration Gameplan to wire real warehouse creds. Your existing queries will start running against production data and JOINs/formulas will light up.

2. **Build a dashboard.** The VQB's results can be promoted into the dashboard editor (on the roadmap). Save common queries, then pin them as widgets.

3. **Share with a teammate.** Have someone less technical try Recipe 5. If they can answer "which team is underperforming" in 30 seconds, the feature is working.

4. **Push the limits.** Build a query with 5 filters, 3 aggregations, and a custom alias. Watch the audit panel. Make sure the complexity score stays reasonable.

5. **Report bugs.** If a recipe doesn't produce the expected output, screenshot the Audit panel (all 4 tabs) and send it. The tabs have everything needed to diagnose.

---

## Appendix — Behind the Scenes (Optional)

If you're curious how this works under the hood:

**The request lifecycle**

1. You click a column → `VisualQueryBuilder` updates its React state
2. 500ms debounce fires → calls `onExecute(sql, config)` (the page's callback)
3. Page sends `POST /api/data/visual-query/execute` with the config (NOT the SQL)
4. Server: `getCurrentUser()` → `canAccessDataSourceWithMetrics()` (RBAC) → `validateVisualQuery()` → `visualToSQL()` (regenerate SQL) → `applyRowLevelSecurity()` (inject WHERE clauses) → `executeSecureQuery()` (Snowflake) or `evaluateVisualQueryOnSample()` (JS evaluator) → `applyDataSecurity()` (column masking) → `createAuditLog()` (non-blocking)
5. Response: data + columns + full audit report
6. VQB stores result in state; audit panel renders from `state.results.audit`

**Key files**

- `src/app/data/visual-query/page.tsx` — the page, loads schema, wires VQB to server
- `src/components/data/VisualQueryBuilder.tsx` — the main UI component
- `src/components/data/QueryAuditPanel.tsx` — the 4-tab transparency panel
- `src/components/data/ColumnPicker.tsx` — the left sidebar
- `src/components/data/FilterBuilder.tsx` — the filter UI
- `src/app/api/data/visual-query/execute/route.ts` — the server endpoint
- `src/lib/data/visual-to-sql.ts` — config → SQL generator
- `src/lib/data/visual-query-evaluator.ts` — sample-mode JS evaluator
- `src/lib/snowflake/row-level-security.ts` — RLS engine
- `src/lib/snowflake/data-security.ts` — column masking

**The key security invariants**

- Client SQL is never executed. Ever. Server regenerates from the structured config.
- Row limit is clamped server-side to 10,000 max regardless of client request.
- Rate limiter: 30 executions/minute per user.
- Audit log entry on every execution (including denials).
- RLS policies live in code (`DEFAULT_RLS_POLICIES`) and can be extended by the security team. They're not editable by end users.

---

## Final Note

You just went from zero to competent in about 45 minutes. That's the promise of this tool: **data exploration without a SQL license**. Every concept above is the same whether you're answering a throwaway question for a meeting or a compliance query for an auditor. The same interface, the same audit trail, the same security guarantees.

If you hit something confusing, re-read the "Three Pillars" in Part 1. Everything else is in service of those three.

Good luck.
