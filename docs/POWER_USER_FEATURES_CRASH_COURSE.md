# Power User Features — Zero to Hero Crash Course

**For:** Jeff Coy  
**Purpose:** Understand every power user feature, how it works internally, and how it will be built into InsightHub  
**Date:** April 23, 2026

---

## What Are the Power User Features?

InsightHub's core experience is AI-driven: you describe a dashboard in plain English, and Claude builds it. That's powerful for most users — but data engineers, senior analysts, and power users sometimes need to go deeper. They want to write their own queries, build their own logic, access data programmatically, or create custom metrics.

The four Power User features give them that control:

| # | Feature | One-Liner | Who It's For |
|---|---------|-----------|--------------|
| 1 | **SQL Query Playground** | Write raw SQL in a Monaco editor, see results instantly | Data engineers, analysts who think in SQL |
| 2 | **Visual Query Builder** | Sigma-style drag-and-drop query building with spreadsheet formulas | Analysts who don't know SQL but need more than AI chat |
| 3 | **Programmatic API Access** | RESTful endpoints for dashboards, data, and widgets | Developers building automations, embedding dashboards |
| 4 | **Custom Calculated Fields** | Create derived metrics with formulas or SQL expressions | Anyone who needs metrics that don't exist in the raw data |

These are currently marked **"Coming Soon"** on the About page. The types, page scaffolds, and partial implementations already exist in the codebase. This document explains each feature from the ground up.

---

## 1. SQL Query Playground

### What It Is

A built-in SQL editor where you can write and run queries directly against InsightHub's data sources (Snowflake in production, sample data in development). Think of it like having a mini database client right inside InsightHub — no need to open a separate tool like DataGrip or DBeaver.

### Why It Matters

The AI chat builder is great, but sometimes you know exactly what query you need:

- "I need a LEFT JOIN between orders and customers where the signup date was before 2025"
- "Show me the 95th percentile response time by support team"
- "I want to test a hypothesis with a specific WHERE clause"

These are hard to express in natural language but trivial in SQL. The Playground gives you direct control.

### Key Concepts

**Monaco Editor** — This is the same code editor that powers VS Code. Microsoft open-sourced it as a library. It gives you:
- **Syntax highlighting** — SQL keywords appear in different colors (SELECT in blue, FROM in purple, etc.)
- **Autocomplete** — Start typing a table name and it suggests completions based on the schema
- **Error squiggles** — Malformed SQL gets red underlines before you even run it
- **Multi-cursor editing** — Hold Alt and click to edit multiple lines at once
- **Minimap** — A thumbnail of your entire query for navigating long SQL

**Notebook-Style Interface** — Inspired by Jupyter notebooks. Instead of one giant SQL editor, you have **cells**:

| Cell Type | What It Does |
|-----------|-------------|
| **Query cell** | Contains SQL. You run it and see results below. |
| **Markdown cell** | Contains notes, documentation, or analysis narrative. |
| **Chart cell** | Visualizes the results of a query cell as a quick chart. |

This means you can tell a story: write a markdown cell explaining your hypothesis, a query cell to test it, and a chart cell to visualize the results. It's like a data analysis notebook.

**Sessions and Tabs** — You can have multiple Playground sessions (like browser tabs) and multiple tabs within a session. This lets you work on different analyses simultaneously.

**Query Chaining** — The output of one query cell becomes available as a temporary table in the next cell. So you can do:

```
Cell 1: SELECT customer_id, SUM(revenue) as total_rev FROM orders GROUP BY customer_id
         → creates temp table "cell_1_results"

Cell 2: SELECT * FROM cell_1_results WHERE total_rev > 10000
         → filters the previous result
```

This is much cleaner than writing one massive nested query.

**Split View & Diff** — Run the same query two different ways (e.g., this quarter vs. last quarter) and see the results side by side with differences highlighted. The diff can compare rows, values, or even schema changes.

### How It's Built Into InsightHub

**What already exists:**
- The full TypeScript type system: `PlaygroundSession`, `PlaygroundTab`, `PlaygroundCell`, `QueryResults`, `QueryChainContext`, `ResultComparison` (defined in `src/types/playground.ts`)
- The page scaffold at `/data/playground` with session management, tab creation, cell creation, localStorage persistence
- The `PlaygroundTabComponent` UI component
- Query execution via `queryDataSync()` against sample data
- Widget import: you can send a widget's underlying query from a dashboard into the Playground for exploration

**What needs to be built:**
- Server-side query execution via `POST /api/data/playground/execute` (currently runs client-side against sample data)
- Monaco editor integration (currently using a basic textarea)
- Schema-aware autocomplete (the schema API at `GET /api/data/schema` already exists)
- Query history and saved sessions in the database (currently localStorage only)
- "Promote to Widget" — take a Playground query result and push it into a dashboard as a widget (the `WidgetPromotionRequest` type already exists)
- Fork/share sessions (types exist: `PlaygroundShare`, `PlaygroundFork`)

### Security — How It Stays Safe

This is critical. Giving users a raw SQL editor sounds dangerous, but we have multiple safety layers:

1. **Query validation** — Every SQL query passes through `validateQuery()` which rejects anything that's not a `SELECT`, `WITH`, `SHOW`, or `DESCRIBE`. No `DROP`, `DELETE`, `INSERT`, `UPDATE`, or `ALTER` ever reaches Snowflake.

2. **Dangerous pattern detection** — The query executor scans for known injection patterns and rejects them.

3. **Parameterized queries** — User inputs in WHERE clauses use bind parameters, not string concatenation.

4. **Read-only service account** — The Snowflake service account (`INSIGHTHUB_SVC`) physically cannot modify data. Even if all software checks fail, Snowflake itself blocks writes.

5. **Row-Level Security (RLS)** — Every Playground query goes through the same RLS engine as AI-generated queries. If you're a Northeast regional manager, your Playground query only returns Northeast data.

6. **Column masking** — PII fields are masked based on your role, even in raw query results.

7. **Rate limiting** — 30 queries per minute per user. Prevents someone from running thousands of queries to scrape data.

8. **Query timeout** — 30 seconds max. Prevents runaway queries from consuming warehouse credits.

9. **Row limits** — Default 10,000 rows, max 100,000. Prevents someone from downloading the entire database.

**Bottom line:** You get the power of raw SQL, but the same security policies that protect AI-generated queries protect Playground queries too.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                   Browser (Client)                    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           SQL Query Playground UI                │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│ │
│  │  │ Monaco   │ │ Results  │ │ Quick Chart      ││ │
│  │  │ Editor   │ │ Grid     │ │ Visualization    ││ │
│  │  └──────────┘ └──────────┘ └──────────────────┘│ │
│  └────────────────────┬────────────────────────────┘ │
└───────────────────────┼──────────────────────────────┘
                        │ POST /api/data/playground/execute
                        ▼
┌──────────────────────────────────────────────────────┐
│                   Server (Next.js)                    │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Auth     │→ │ Query    │→ │ Query Executor     │ │
│  │ Check    │  │ Validator│  │ (with RLS + Cache)  │ │
│  └──────────┘  └──────────┘  └─────────┬──────────┘ │
└──────────────────────────────────────────┼───────────┘
                                           │
                    ┌──────────────────────┼────────────┐
                    │                      ▼            │
                    │  ┌──────────────────────────────┐│
                    │  │    Snowflake Data Warehouse   ││
                    │  │    (read-only via views)      ││
                    │  └──────────────────────────────┘│
                    │  OR                               │
                    │  ┌──────────────────────────────┐│
                    │  │    Sample Data (fallback)     ││
                    │  └──────────────────────────────┘│
                    └──────────────────────────────────┘
```

---

## 2. Visual Query Builder

### What It Is

A drag-and-drop interface for building queries without writing SQL. Inspired by **Sigma Computing** — a product that makes data exploration feel like using a spreadsheet rather than writing code.

### Why It Matters

Most business users can't write SQL. But many of them can use Excel. The Visual Query Builder bridges that gap:

- Instead of `SELECT region, SUM(revenue) FROM orders GROUP BY region`, you **drag** `region` into the "Group By" area and **drag** `revenue` into the "Measures" area, then pick "Sum" from a dropdown.
- Instead of `WHERE order_date >= '2025-01-01'`, you drag `order_date` into "Filters" and pick "After January 1, 2025" from a date picker.
- Instead of writing a CASE statement, you use `If(revenue > 100000, "High", "Low")` — a spreadsheet-style formula.

### Key Concepts

**Spreadsheet Formulas (Sigma-Style)** — These are functions that look like Excel formulas but map to SQL under the hood:

| Formula | What It Does | SQL Equivalent |
|---------|-------------|----------------|
| `Sum([Revenue])` | Total of the Revenue column | `SUM(revenue)` |
| `CountIf([Status] = "Active")` | Count rows where Status is Active | `COUNT(CASE WHEN status = 'Active' THEN 1 END)` |
| `Avg([Response Time])` | Average response time | `AVG(response_time)` |
| `DateDiff("day", [Created], [Closed])` | Days between two dates | `DATEDIFF(day, created, closed)` |
| `If([Revenue] > 100000, "High", "Low")` | Conditional label | `CASE WHEN revenue > 100000 THEN 'High' ELSE 'Low' END` |
| `RunningSum([Revenue])` | Cumulative total | `SUM(revenue) OVER (ORDER BY ...)` |
| `Rank([Revenue], "desc")` | Rank by revenue | `RANK() OVER (ORDER BY revenue DESC)` |

The idea is: if you know spreadsheets, you can use these formulas without learning SQL. The system translates them into SQL behind the scenes.

**"View SQL" Toggle** — At any time, you can flip a switch and see the SQL that your visual query would generate. This is a learning tool: analysts who want to eventually learn SQL can see exactly how their drag-and-drop actions translate. It also builds trust — you can verify the system is doing what you expect.

**Drag-and-Drop Zones** — The Visual Query Builder has distinct zones where you drag columns:

```
┌─────────────────────────────────────────────────────────────┐
│                    VISUAL QUERY BUILDER                       │
│                                                               │
│  ┌──────────────┐  ┌───────────────────────────────────────┐│
│  │ DATA SOURCES │  │ QUERY CANVAS                          ││
│  │              │  │                                       ││
│  │ ● customers  │  │  ┌─────────────┐  ┌───────────────┐  ││
│  │   ├ name     │  │  │  COLUMNS    │  │  MEASURES     │  ││
│  │   ├ email    │  │  │  (drag here)│  │  (drag here)  │  ││
│  │   ├ region   │  │  │  region     │  │  Sum(revenue) │  ││
│  │   └ plan     │  │  └─────────────┘  └───────────────┘  ││
│  │              │  │                                       ││
│  │ ● orders     │  │  ┌─────────────┐  ┌───────────────┐  ││
│  │   ├ date     │  │  │  FILTERS    │  │  SORT         │  ││
│  │   ├ amount   │  │  │  date > Jan │  │  revenue DESC │  ││
│  │   └ status   │  │  └─────────────┘  └───────────────┘  ││
│  │              │  │                                       ││
│  └──────────────┘  │  ┌─────────────────────────────────┐  ││
│                    │  │  RESULTS PREVIEW                 │  ││
│                    │  │  region   │ Sum(revenue)          │  ││
│                    │  │  West     │ $1,234,567            │  ││
│                    │  │  East     │ $987,654              │  ││
│                    │  └─────────────────────────────────┘  ││
│                    └───────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GENERATED SQL (toggle to view)                          ││
│  │ SELECT region, SUM(revenue) FROM orders                 ││
│  │ WHERE date > '2025-01-01' GROUP BY region               ││
│  │ ORDER BY SUM(revenue) DESC                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Table Joins** — When you drag columns from multiple tables (e.g., `customers.region` and `orders.amount`), the system automatically detects the foreign key relationship (`orders.customer_id → customers.id`) and adds the JOIN. If the relationship is ambiguous, it prompts you to specify which column to join on.

### How It's Built Into InsightHub

**What already exists:**
- The full TypeScript type system: `VisualQueryConfig`, `QueryExecutionResult`, `TableConfig`, `ColumnMetadata` (defined in `src/types/visual-query.ts`)
- The `VisualQueryBuilder` React component
- The page scaffold at `/data/visual-query` with a sample schema, saved queries in localStorage, SQL generation
- SQL generation from visual config → SQL string
- Execution against sample data via `queryDataSync()`

**What needs to be built:**
- Formula parser and evaluator (translating `Sum([Revenue])` into SQL `SUM(revenue)`)
- Automatic JOIN detection based on foreign key metadata from the schema API
- Server-side execution via the secure query executor (same path as Playground)
- Saved queries in the database (currently localStorage)
- "Send to Dashboard" — push a visual query result into a dashboard as a widget
- Schema-aware drag sources (using the `GET /api/data/schema` endpoint to populate the column list dynamically)

### How Visual Query Builder Relates to the AI Chat

They're complementary:

| AI Chat | Visual Query Builder |
|---------|---------------------|
| "Show me revenue by region" → AI figures out the query | You manually drag `region` + `Sum(revenue)` → you control the query |
| Best for: quick exploration, non-technical users | Best for: precise control, learning SQL, validating AI results |
| AI might interpret your request differently than you intended | You get exactly what you specify |
| Instant — one sentence | Slower — multiple drag-and-drop steps |

In practice, users often start with AI chat ("give me a revenue dashboard"), then use the Visual Query Builder to tweak or extend specific widgets.

---

## 3. Programmatic API Access

### What It Is

RESTful API endpoints that let external applications interact with InsightHub — query data, manage dashboards, embed widgets, and automate workflows. Instead of clicking buttons in the browser, you make HTTP requests.

### Why It Matters

InsightHub shouldn't be a silo. Organizations need to:

- **Embed dashboards** in their own internal tools (Slack bots, internal portals, client-facing apps)
- **Automate reporting** — a cron job that generates a weekly executive summary every Monday morning
- **Integrate with CI/CD** — a pipeline that updates a "Deployment Metrics" dashboard after every release
- **Build custom workflows** — "when a support ticket is created in Zendesk, refresh the Support dashboard"
- **Extract data** — pull query results into a Jupyter notebook or a data science pipeline

### Key Concepts

**REST (Representational State Transfer)** — REST is the most common way web APIs work. It uses standard HTTP methods:

| Method | Purpose | Example |
|--------|---------|---------|
| `GET` | Read data | `GET /api/dashboards` — list all dashboards |
| `POST` | Create new data | `POST /api/dashboards` — create a new dashboard |
| `PUT` / `PATCH` | Update existing data | `PATCH /api/dashboards/abc123` — update a dashboard |
| `DELETE` | Remove data | `DELETE /api/dashboards/abc123` — delete a dashboard |

Every InsightHub resource (dashboard, widget, data source, glossary term, folder) will have a full set of CRUD endpoints.

**API Keys vs. OAuth Tokens** — Currently, InsightHub uses session-based authentication (you log in via Google OAuth and get a session cookie). For programmatic access, we'll add **API keys**:

- Users generate API keys from their profile settings
- Keys are long random strings (like `ihub_key_a1b2c3d4e5f6...`)
- You include the key in the `Authorization` header: `Authorization: Bearer ihub_key_a1b2c3d4e5f6...`
- Keys inherit the user's permissions — if you're a VIEWER, your API key can only read
- Keys can be scoped (read-only, read-write, admin) and set to expire
- Keys can be revoked instantly from the admin panel

**Rate Limiting** — API access will be rate-limited to prevent abuse:
- Standard tier: 100 requests/minute
- Enterprise tier: 1,000 requests/minute
- Burst: 2× the limit for short periods

Each response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers so clients can pace themselves.

**Pagination** — List endpoints return paginated results. Instead of dumping 10,000 dashboards in one response:
```
GET /api/dashboards?page=1&pageSize=20
→ { data: [...20 items...], total: 847, page: 1, pageSize: 20, hasMore: true }
```

**Webhooks** — The reverse of API calls. Instead of you polling InsightHub ("has anything changed?"), InsightHub pushes notifications to your URL when events happen:
- Dashboard created/updated/deleted
- Share permissions changed
- Data source refreshed
- Alert threshold crossed

### What Already Exists

InsightHub already has a comprehensive API surface — 39 route files covering:

| Domain | Endpoints | Description |
|--------|-----------|-------------|
| **Dashboards** | `/api/dashboards`, `/api/dashboards/[id]`, `/api/dashboards/[id]/share`, `/api/dashboards/[id]/versions`, `/api/dashboards/[id]/duplicate`, `/api/dashboards/[id]/move`, `/api/dashboards/[id]/revert/[versionId]`, `/api/dashboards/[id]/add-widget` | Full CRUD + sharing, versioning, duplication, widget management |
| **Data** | `/api/data/query`, `/api/data/schema`, `/api/data/profile` | Query execution, schema discovery, column profiling |
| **Widgets** | `/api/widgets`, `/api/widgets/explain`, `/api/widgets/fork`, `/api/widgets/publish` | Widget library, AI explanations, forking, publishing |
| **Glossary** | `/api/glossary`, `/api/glossary/[id]`, `/api/glossary/search` | Business glossary CRUD + search |
| **Folders** | `/api/folders`, `/api/folders/[id]` | Folder organization |
| **Chat** | `/api/chat`, `/api/chat/sessions`, `/api/chat/sessions/[id]` | AI chat + session management |
| **Admin** | `/api/admin/users`, `/api/admin/audit`, `/api/admin/health`, `/api/admin/settings`, `/api/admin/permission-groups`, `/api/admin/prompts`, `/api/admin/retention` | Full admin operations |
| **Auth** | `/api/auth/[...nextauth]` | Google OAuth |
| **User** | `/api/user/export`, `/api/user/delete`, `/api/user/complete-onboarding` | GDPR export, account deletion, onboarding |
| **Voice** | `/api/voice/transcribe` | Speech-to-text |
| **Health** | `/api/health` | Server health check |
| **Thumbnails** | `/api/thumbnails` | Dashboard thumbnail generation |

**What needs to be built for public API access:**
- API key generation, storage, and validation middleware
- API-specific rate limiting (separate from browser rate limits)
- OpenAPI/Swagger documentation auto-generated from route definitions
- SDK packages (TypeScript/Python) for common operations
- Webhook registration and delivery system
- API versioning (`/api/v1/...`) to allow breaking changes without disrupting existing integrations
- CORS configuration for cross-origin embedding

### Example: Embedding a Dashboard

Once API access is live, embedding a dashboard would look like:

```html
<!-- In your internal tool -->
<iframe
  src="https://insighthub.yourcompany.com/embed/dashboard/abc123?token=ihub_embed_xyz"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

Or programmatically:

```typescript
// Node.js — fetch dashboard data and render in your own UI
const response = await fetch('https://insighthub.yourcompany.com/api/dashboards/abc123', {
  headers: {
    'Authorization': 'Bearer ihub_key_a1b2c3d4e5f6...',
    'Content-Type': 'application/json'
  }
});

const { dashboard } = await response.json();
// dashboard.currentSchema contains all widgets, their data configs, etc.
// Render them however you want
```

Or querying data directly:

```typescript
// Fetch raw data for your own analysis
const response = await fetch('https://insighthub.yourcompany.com/api/data/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ihub_key_a1b2c3d4e5f6...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source: 'mrr_by_month',
    groupBy: ['region']
  })
});

const { data, columns, totalRows } = await response.json();
// Process data in your own pipeline
```

---

## 4. Custom Calculated Fields

### What It Is

The ability to create new metrics that don't exist in the raw data, by defining formulas or SQL expressions that derive them from existing columns. These calculated fields then appear alongside regular fields everywhere in InsightHub — in the Visual Query Builder, in AI chat results, and in the schema explorer.

### Why It Matters

Raw data rarely has every metric a business needs. Examples:

| You Have | You Want | Formula |
|----------|----------|---------|
| `revenue`, `customers` | **Revenue per Customer** | `revenue / customers` |
| `new_mrr`, `churned_mrr` | **Net New MRR** | `new_mrr - churned_mrr` |
| `resolved_tickets`, `total_tickets` | **Resolution Rate** | `resolved_tickets / total_tickets * 100` |
| `revenue`, `cost` | **Gross Margin %** | `(revenue - cost) / revenue * 100` |
| `signup_date`, `first_purchase_date` | **Days to First Purchase** | `DateDiff("day", signup_date, first_purchase_date)` |
| `plan`, `revenue` | **Enterprise Revenue Share** | `SumIf(revenue, plan = "Enterprise") / Sum(revenue) * 100` |

Today, getting these metrics requires either asking the data team to create a new Snowflake view, or asking AI to calculate them in every dashboard. Calculated fields let you define them once and reuse them everywhere.

### Key Concepts

**Formula Mode vs. SQL Mode** — Two ways to define a calculated field:

**Formula Mode** (for non-SQL users):
```
Revenue per Customer = [Revenue] / [Total Customers]
```
Uses the same Sigma-style formula language as the Visual Query Builder. Square brackets reference column names.

**SQL Mode** (for power users):
```sql
CASE
  WHEN plan = 'Enterprise' THEN revenue * 0.85  -- 15% discount
  WHEN plan = 'Professional' THEN revenue * 0.90
  ELSE revenue
END
```
Writes raw SQL expressions. More powerful but requires SQL knowledge.

**Field Chaining** — Calculated fields can reference other calculated fields:
```
Net Revenue = [Revenue] - [Refunds]                    ← references raw columns
Margin = ([Net Revenue] - [Cost]) / [Net Revenue]      ← references a calculated field
Margin Category = If([Margin] > 0.3, "Healthy", "At Risk")  ← chains further
```

The system resolves the dependency chain and computes them in the correct order. Circular references are detected and rejected.

**Scope** — Where a calculated field is available:

| Scope | Meaning |
|-------|---------|
| **Dashboard-scoped** | Only available in one specific dashboard. Good for one-off calculations. |
| **User-scoped** | Available in all dashboards you create. Personal shortcuts. |
| **Organization-scoped** | Available to everyone. Standardized company metrics. Requires ADMIN or POWER_USER role to create. |

**Glossary Integration** — Calculated fields can be linked to the business glossary. When you create a "Net Revenue Retention (NRR)" calculated field, you can link it to the existing glossary term that defines what NRR means, how it's calculated, and who owns it. This ensures everyone uses the same definition.

### How It's Built Into InsightHub

**What already exists:**
- The `WidgetConfig.dataConfig` already has an `aggregation` field and supports `groupBy`, `orderBy`, `filters`, and a freeform `query` field — this is where calculated fields would be injected
- The glossary system for documenting metrics
- The source-field registry (`src/lib/ai/source-field-registry.ts`) that tracks what fields exist in each data source — calculated fields would be registered here
- The schema API that returns column metadata — calculated fields would appear as additional columns

**What needs to be built:**
- Formula parser that converts `[Revenue] / [Customers]` → `revenue / customers` SQL
- Calculated field storage in the database (Prisma schema addition)
- Dependency resolution engine (topological sort of field references)
- Circular reference detection
- UI for creating/editing calculated fields (formula editor with autocomplete)
- Integration into the AI system prompt so Claude knows about available calculated fields
- Integration into the Visual Query Builder as drag-and-drop columns
- Validation engine that checks formulas against the actual schema (is `[Revenue]` a real column? Is it numeric?)

### Architecture: How Calculated Fields Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Calculated Field Definition                    │
│                                                                   │
│  Name: "Revenue per Customer"                                    │
│  Formula: [Revenue] / [Total Customers]                          │
│  Source: kpi_summary                                              │
│  Scope: Organization                                              │
│  Glossary Link: term_rpc_001                                      │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Formula Parser                                 │
│                                                                   │
│  Input:  [Revenue] / [Total Customers]                           │
│  Output: "revenue" / "total_customers"  (SQL expression)         │
│  Deps:   [revenue, total_customers]  (dependency list)           │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Query Injection                                 │
│                                                                   │
│  Original: SELECT * FROM kpi_summary LIMIT 1000                  │
│  Modified: SELECT *, (revenue / total_customers)                 │
│            AS revenue_per_customer                                 │
│            FROM kpi_summary LIMIT 1000                            │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│           Available Everywhere in InsightHub                      │
│                                                                   │
│  ✓ Visual Query Builder — appears as a draggable column          │
│  ✓ AI Chat — Claude knows about it and can use it in dashboards  │
│  ✓ Schema Explorer — shows in column list with a ƒ icon          │
│  ✓ SQL Playground — available as a reference                      │
│  ✓ Widgets — can be used in any widget's data config             │
└─────────────────────────────────────────────────────────────────┘
```

---

## How All Four Features Connect

These features don't exist in isolation — they form an interconnected power user ecosystem:

```
                    ┌─────────────────────┐
                    │    AI Chat Builder   │
                    │  "Show me revenue    │
                    │   by region"         │
                    └──────────┬──────────┘
                               │
                    Creates dashboard with widgets
                               │
                               ▼
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│   SQL Query  │◄──►│     Dashboard       │◄──►│  Visual Query    │
│  Playground  │    │                     │    │   Builder        │
│              │    │  ┌─────┐ ┌─────┐   │    │                  │
│  Write raw   │    │  │ KPI │ │Chart│   │    │  Drag-and-drop   │
│  SQL, test   │    │  └─────┘ └─────┘   │    │  query building  │
│  hypotheses  │    │  ┌─────┐ ┌─────┐   │    │                  │
│              │    │  │Table│ │Gauge│   │    │  "View SQL" shows │
│  "Promote to │    │  └─────┘ └─────┘   │    │  generated query  │
│   Widget" ───┼───►│                     │◄───┼── "Send to       │
│              │    │                     │    │    Dashboard"     │
└──────┬───────┘    └─────────┬───────────┘    └────────┬─────────┘
       │                      │                          │
       │            ┌─────────▼───────────┐              │
       │            │  Custom Calculated   │              │
       └───────────►│      Fields          │◄─────────────┘
                    │                     │
                    │  Available in all   │
                    │  three interfaces   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Programmatic API    │
                    │                     │
                    │  External apps can   │
                    │  access everything   │
                    │  above via REST      │
                    └─────────────────────┘
```

**Typical power user workflow:**

1. **Explore** — Use the Schema Explorer (`/data/explorer`) to browse available data sources and columns
2. **Query** — Write a quick SQL query in the Playground to test a hypothesis
3. **Build** — Use the Visual Query Builder to refine the query with drag-and-drop
4. **Calculate** — Create a custom calculated field for a derived metric you keep using
5. **Dashboard** — Promote the query to a dashboard widget, or ask AI to build a full dashboard using your calculated fields
6. **Automate** — Use the API to embed the dashboard in your team's internal portal
7. **Share** — Share the Playground session with a colleague so they can fork and extend your analysis

---

## Implementation Priority & Phasing

### Phase 1 — Foundation (Current State)
What's done: type systems, page scaffolds, sample data execution, basic UI components.

### Phase 2 — SQL Playground (First to Ship)
Why first: Highest demand from data engineers. Most of the infrastructure exists (query executor, security layers, schema API). Primarily needs Monaco editor integration and server-side execution.

**Estimated effort:** 2-3 weeks
**Key dependency:** Monaco Editor package (`@monaco-editor/react`)

### Phase 3 — Visual Query Builder (Second)
Why second: Builds on the same query execution infrastructure. The drag-and-drop UI is the biggest piece of work.

**Estimated effort:** 3-4 weeks
**Key dependency:** Formula parser, DnD library (`@dnd-kit/core`)

### Phase 4 — Custom Calculated Fields (Third)
Why third: Requires the formula parser from Phase 3. Also needs database schema changes.

**Estimated effort:** 2-3 weeks
**Key dependency:** Formula parser from Phase 3, Prisma schema migration

### Phase 5 — Programmatic API Access (Last)
Why last: The API endpoints already exist — they just need API key authentication and documentation. This is primarily an auth/infrastructure task, not a feature build.

**Estimated effort:** 2-3 weeks
**Key dependency:** API key management system, OpenAPI spec generation

### Total: ~10-13 weeks for all four features

---

## Technical Deep Dive: The Data Pipeline

All four features ultimately flow through the same data pipeline. Understanding this pipeline is key to understanding how everything fits together.

```
User Action (any of the 4 features)
        │
        ▼
┌─ Authentication ─────────────────────────────────────┐
│  JWT validation → User identity + role extracted      │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Authorization ──────────────────────────────────────┐
│  RBAC check: Does this role allow this data source?   │
│  Category check: Revenue? Support? CustomerPII?       │
│  Metric check: Any metric-level restrictions?         │
│  Access level: FULL / FILTERED / NONE                 │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Query Building ─────────────────────────────────────┐
│  SQL Playground: pass-through (user wrote the SQL)    │
│  Visual Builder: translate visual config → SQL        │
│  Calculated Fields: inject expressions into SELECT    │
│  API Access: build SQL from request parameters        │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Query Validation ───────────────────────────────────┐
│  validateQuery(): only SELECT/WITH/SHOW/DESCRIBE      │
│  Dangerous pattern detection                          │
│  Identifier validation (no SQL injection via names)   │
│  Row limit enforcement (max 100,000)                  │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Row-Level Security (RLS) ───────────────────────────┐
│  Inject WHERE clauses based on user context           │
│  Department filter, region filter, time filter        │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Cache Check ────────────────────────────────────────┐
│  User-scoped cache key = hash(SQL + params + userId)  │
│  Hit? → Return cached result (< 10ms)                 │
│  Miss? → Execute query against Snowflake              │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Snowflake Execution ────────────────────────────────┐
│  Connection pool (max 5 connections)                   │
│  Parameterized query execution                         │
│  30-second timeout                                     │
│  Falls back to sample data if Snowflake unavailable    │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Post-Processing ────────────────────────────────────┐
│  Column masking (PII → [REDACTED])                    │
│  FILTERED access aggregation                          │
│  Data integrity verification (optional)               │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
                    JSON Response → UI
```

**The key insight:** All four features are different front doors to the same secure, permission-aware data pipeline. Whether you type SQL, drag-and-drop, ask AI, or call the API, your query goes through the same validation, security, and execution path. This means:

- Security is enforced uniformly — no feature is a "backdoor"
- Caching benefits all features — a query run in the Playground caches for the Visual Builder too
- New security policies automatically apply to all features
- A calculated field created in the UI is available in the API, and vice versa

---

## Glossary of Terms

| Term | Definition |
|------|-----------|
| **Monaco Editor** | Open-source code editor from Microsoft (the engine behind VS Code). Used for the SQL Playground. |
| **Sigma Computing** | A cloud BI tool known for its spreadsheet-like query interface. Our Visual Query Builder is inspired by their approach. |
| **REST API** | An architectural style for web APIs using standard HTTP methods (GET, POST, PUT, DELETE). |
| **API Key** | A secret token used to authenticate programmatic API requests without a browser session. |
| **Calculated Field** | A virtual column derived from a formula or SQL expression, computed at query time. |
| **Formula Parser** | A module that converts human-readable formulas (`Sum([Revenue])`) into SQL expressions (`SUM(revenue)`). |
| **Query Chaining** | Using the output of one query as input to the next, via temporary tables. |
| **Bind Parameters** | A SQL security technique where user input is passed separately from the SQL string, preventing injection. |
| **OpenAPI / Swagger** | A standard for documenting REST APIs. Generates interactive documentation and client SDKs. |
| **Webhook** | A server-to-server HTTP callback. InsightHub pushes notifications to your URL when events occur. |
| **Topological Sort** | An algorithm for ordering dependencies. Used to resolve calculated field chains (A depends on B depends on C → compute C first, then B, then A). |
| **RLS (Row-Level Security)** | Automatically filtering query results based on who's asking. Different users see different rows from the same table. |
| **Column Masking** | Replacing sensitive column values with redacted or masked versions based on the user's access level. |
| **RBAC** | Role-Based Access Control. Permissions are assigned to roles, users are assigned to roles. |
| **Connection Pool** | A set of pre-opened database connections shared across requests to avoid the overhead of opening new connections. |

---

## Summary: What You Need to Know

1. **All four features share the same security pipeline.** No backdoors — SQL Playground, Visual Builder, Calculated Fields, and API Access all go through auth → RBAC → validation → RLS → masking.

2. **Significant scaffolding already exists.** Type systems, page shells, and partial implementations are in place. This isn't starting from scratch.

3. **The Playground ships first** because it has the most existing infrastructure and the highest demand.

4. **The API is mostly built** — 39 route files already exist. The main work is adding API key auth and documentation.

5. **Calculated Fields are the glue** that makes the other three features more powerful. A field defined once appears everywhere.

6. **~10-13 weeks total** for all four features, building sequentially because each phase creates infrastructure the next one needs.
