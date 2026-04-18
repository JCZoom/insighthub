# InsightHub — AI-Powered Dashboard Builder
## Product Specification & Implementation Guide

> **Purpose:** This document is a self-contained spec to bootstrap a new repository. Hand it to Cascade in a fresh workspace to build the application from scratch.

---

## 1. Vision

**InsightHub** is an internal self-service BI platform where any employee can build, customize, and share rich data dashboards using natural language. Instead of filing tickets with the analytics team and waiting days/weeks for SQL queries, employees describe what they want in a chat interface, and an AI assistant (Claude) generates the dashboard in real time.

### Core Value Propositions
- **Zero SQL required** — employees describe dashboards in plain English
- **Instant iteration** — refine via chat; undo/redo any change
- **Single source of truth** — company-wide terminology bible ensures consistent metrics
- **Governed access** — role-based permissions control who sees what data
- **Shareable & discoverable** — centralized gallery of dashboards organized by team/purpose

---

## 2. Architecture Overview

### 2.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 14+ (App Router) | SSR, API routes, middleware for auth, great DX |
| **Language** | TypeScript (strict) | Type safety for schema-driven widget system |
| **Styling** | Tailwind CSS + shadcn/ui | Consistent design system, accessible components |
| **Charts** | Recharts (primary) + Chart.js (fallback) | Composable React charts, good with dynamic configs |
| **Drag & Drop** | @dnd-kit/core | Accessible, performant grid layout management |
| **AI** | Anthropic Claude API (claude-sonnet-4-20250514) | Natural language → dashboard schema generation |
| **Database** | PostgreSQL (via Prisma ORM) | Users, dashboards, versions, permissions, audit log |
| **Auth** | NextAuth.js (Google OAuth) | uszoom.com domain restriction, role mapping |
| **Data Layer** | Snowflake connector (Phase 2) | Production data source — stubbed with sample data in Phase 1 |
| **Real-time** | Server-Sent Events (SSE) | Stream AI-generated widget updates to the client |
| **Icons** | Lucide React | Consistent, tree-shakeable icon set |
| **State** | Zustand | Lightweight store for dashboard editor state + undo/redo |

### 2.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER                           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Chat     │  │ Dashboard    │  │ Gallery /     │  │
│  │ Panel    │  │ Canvas       │  │ Explorer      │  │
│  │ (AI)     │  │ (Widgets)    │  │ (Browse/Share)│  │
│  └────┬─────┘  └──────┬───────┘  └───────────────┘  │
│       │               │                              │
│       └───────┬───────┘                              │
│               ▼                                      │
│     ┌─────────────────┐                              │
│     │  Zustand Store  │  ← undo/redo stack           │
│     │  (DashboardState│                              │
│     │   + versions)   │                              │
│     └────────┬────────┘                              │
└──────────────┼──────────────────────────────────────┘
               │ API calls
               ▼
┌─────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                      │
│  /api/chat     — AI conversation + schema generation │
│  /api/dashboard— CRUD dashboards + versions          │
│  /api/data     — Query execution (Snowflake/sample)  │
│  /api/admin    — User management, permissions        │
│  /api/glossary — Terminology bible CRUD              │
└──────────────┬──────────────────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
┌──────────┐     ┌─────────────┐
│PostgreSQL│     │  Snowflake  │
│(metadata)│     │  (Phase 2)  │
└──────────┘     └─────────────┘
```

---

## 3. Data Model

### 3.1 Core Entities

```prisma
model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String
  avatarUrl     String?
  role          Role        @default(VIEWER)
  department    String?
  createdAt     DateTime    @default(now())
  lastLoginAt   DateTime?
  dashboards    Dashboard[] @relation("owner")
  sharedWith    DashboardShare[]
  chatSessions  ChatSession[]
  auditLogs     AuditLog[]
}

enum Role {
  VIEWER          // Can view dashboards shared with them
  CREATOR         // Can create + share dashboards
  POWER_USER      // Creator + access to sensitive data categories
  ADMIN           // Full access: user management, glossary, all data
}

model Dashboard {
  id            String      @id @default(cuid())
  title         String
  description   String?
  thumbnailUrl  String?     // Auto-generated preview screenshot
  ownerId       String
  owner         User        @relation("owner", fields: [ownerId], references: [id])
  folderId      String?
  folder        Folder?     @relation(fields: [folderId], references: [id])
  currentVersion Int        @default(1)
  versions      DashboardVersion[]
  shares        DashboardShare[]
  tags          String[]    // Freeform tags for search
  isTemplate    Boolean     @default(false) // Promoted to template gallery
  isPublic      Boolean     @default(false) // Visible to all authenticated users
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  archivedAt    DateTime?
}

model DashboardVersion {
  id            String      @id @default(cuid())
  dashboardId   String
  dashboard     Dashboard   @relation(fields: [dashboardId], references: [id])
  version       Int
  schema        Json        // The full dashboard schema (layout + widgets)
  changeNote    String?     // AI-generated or user-provided description of what changed
  createdAt     DateTime    @default(now())
  createdBy     String      // userId
}

model DashboardShare {
  id            String      @id @default(cuid())
  dashboardId   String
  dashboard     Dashboard   @relation(fields: [dashboardId], references: [id])
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  permission    SharePermission @default(VIEW)
  createdAt     DateTime    @default(now())

  @@unique([dashboardId, userId])
}

enum SharePermission {
  VIEW            // Read-only
  COMMENT         // View + add annotations
  EDIT            // Full edit access
}

model Folder {
  id            String      @id @default(cuid())
  name          String
  parentId      String?
  parent        Folder?     @relation("children", fields: [parentId], references: [id])
  children      Folder[]    @relation("children")
  dashboards    Dashboard[]
  ownerId       String
  visibility    FolderVisibility @default(PRIVATE)
  createdAt     DateTime    @default(now())
}

enum FolderVisibility {
  PRIVATE         // Only owner
  TEAM            // Owner's department
  PUBLIC          // All authenticated users
}

model ChatSession {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  dashboardId   String?     // Linked dashboard (null for new dashboard conversations)
  messages      ChatMessage[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model ChatMessage {
  id            String      @id @default(cuid())
  sessionId     String
  session       ChatSession @relation(fields: [sessionId], references: [id])
  role          MessageRole
  content       String      // Text content
  schemaChange  Json?       // If this message resulted in a schema mutation
  createdAt     DateTime    @default(now())
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

model GlossaryTerm {
  id            String      @id @default(cuid())
  term          String      @unique  // e.g. "Churn Rate"
  definition    String      // Company-agreed definition
  formula       String?     // SQL/calculation formula
  category      String      // e.g. "Retention", "Revenue", "Support"
  examples      String?     // Usage examples
  relatedTerms  String[]    // Links to other terms
  dataSource    String?     // Which Snowflake table/view
  lastReviewedAt DateTime?
  approvedBy    String?     // Admin who approved this definition
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model AuditLog {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  action        String      // "dashboard.create", "dashboard.share", "version.revert", etc.
  resourceType  String      // "dashboard", "folder", "glossary"
  resourceId    String
  metadata      Json?       // Additional context
  createdAt     DateTime    @default(now())
}
```

### 3.2 Dashboard Schema (JSON stored in DashboardVersion.schema)

This is the core data structure the AI generates and mutates:

```typescript
interface DashboardSchema {
  layout: {
    columns: number;        // Grid columns (default 12)
    rowHeight: number;      // Row height in px (default 80)
    gap: number;            // Gap between widgets in px
  };
  globalFilters: FilterConfig[];  // Dashboard-level filters (date range, department, etc.)
  widgets: WidgetConfig[];
}

interface WidgetConfig {
  id: string;                     // Unique widget ID
  type: WidgetType;
  title: string;
  subtitle?: string;
  position: { x: number; y: number; w: number; h: number }; // Grid position
  dataConfig: {
    source: string;               // Table/view name or query alias
    query?: string;               // Raw SQL (for power users) or generated query
    filters?: FilterConfig[];     // Widget-level filters
    aggregation?: AggregationConfig;
    groupBy?: string[];
    orderBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
  };
  visualConfig: {
    chartType?: ChartType;        // For chart widgets
    colorScheme?: string;         // Named palette or custom colors
    showLegend?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
    stacked?: boolean;
    animate?: boolean;
    thresholds?: ThresholdConfig[];
    customStyles?: Record<string, string>;
  };
  glossaryTermIds?: string[];     // Linked glossary terms (shown as tooltips)
}

type WidgetType =
  | 'kpi_card'        // Single big number with trend
  | 'line_chart'
  | 'bar_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'stacked_bar'
  | 'scatter_plot'
  | 'heatmap'
  | 'table'           // Data table with sorting/filtering
  | 'pivot_table'
  | 'funnel'
  | 'gauge'           // Speedometer-style
  | 'metric_row'      // Horizontal row of KPIs
  | 'text_block'      // Markdown/rich text annotation
  | 'image'           // Embedded image or logo
  | 'divider'         // Visual separator
  | 'map'             // Geographic visualization (Phase 2)

type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'scatter'
  | 'heatmap' | 'funnel' | 'gauge' | 'radar' | 'treemap';

interface FilterConfig {
  field: string;
  label: string;
  type: 'date_range' | 'select' | 'multi_select' | 'number_range' | 'text';
  defaultValue?: any;
  options?: { label: string; value: string }[];  // For select types
}

interface AggregationConfig {
  function: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'median' | 'percentile';
  field: string;
  percentileValue?: number;  // For percentile function
}

interface ThresholdConfig {
  value: number;
  color: string;
  label?: string;
}
```

---

## 4. Feature Specifications

### 4.1 Onboarding Experience (First Login)

When a user logs in for the first time:

1. **Welcome modal** — Brief animated walkthrough (3-4 slides):
   - "Describe any dashboard in plain English"
   - "Refine with follow-up messages"
   - "Save, share, and organize"
   - "Your data, your definitions"
2. **Guided first dashboard** — The chat opens with a warm prompt:
   > "Hi! I'm your dashboard assistant. Tell me what metrics or data you'd like to visualize, and I'll build it for you. For example: *'Show me monthly churn rate by region for the past 12 months with a target line at 5%'*"
3. **Template gallery prompt** — "Or start from a template:" with 4-6 pre-built examples

After completing onboarding, the flag is stored and the user goes directly to their dashboard gallery on subsequent logins.

### 4.2 Chat Interface (AI Dashboard Builder)

The chat panel is a **persistent side panel** (resizable, collapsible) that rides alongside the dashboard canvas.

**AI Behavior:**
- Receives the current dashboard schema + glossary terms as system context
- On each user message, generates a **schema diff** (not a full replacement)
- Returns a natural language explanation of what it changed + the schema patch
- The client applies the patch optimistically and renders immediately
- Each schema mutation = new version in the undo stack

**System Prompt Template (for Claude):**
```
You are a dashboard builder assistant. You help employees create and customize
data dashboards by generating dashboard schema configurations.

CRITICAL: You must use the company's official terminology definitions when
interpreting user requests. The glossary below contains agreed-upon definitions
for all business metrics.

## Company Glossary
{glossary_terms_json}

## Current Dashboard Schema
{current_schema_json}

## Available Data Sources
{available_tables_and_columns}

## Rules
1. Always reference glossary definitions when calculating metrics.
   If a user asks for "churn", use the exact definition and formula from
   the glossary — do not invent your own.
2. Output a JSON schema patch in the specified format.
3. Explain what you changed in plain English.
4. If the user's request is ambiguous, ask a clarifying question.
5. Never expose raw SQL to the user unless they explicitly ask.
6. Respect data access permissions — only reference data sources the user
   has access to.
```

**Chat Message Types:**
- **User text** — Natural language request
- **Assistant text + schema patch** — Explanation + changes
- **System** — Notifications (version saved, dashboard shared, etc.)
- **Quick actions** — Suggested follow-up buttons ("Add a filter by region", "Change to bar chart", etc.)

### 4.3 Dashboard Canvas

The main rendering area. Key behaviors:

- **Grid-based layout** — 12-column responsive grid (similar to CSS Grid)
- **Drag-and-drop repositioning** — Users can manually move/resize widgets
- **Click-to-edit** — Clicking a widget opens an inline config panel (chart type, colors, filters)
- **Real-time updates** — Changes from chat appear instantly with smooth transitions
- **Responsive preview** — Toggle between desktop/tablet/mobile views
- **Full-screen widget** — Any widget can expand to full viewport

### 4.4 Widget System

Each widget type has:
1. **Renderer** — React component that takes `WidgetConfig` → visual output
2. **Editor** — Config panel for manual tweaking (chart type, colors, thresholds, etc.)
3. **Data adapter** — Translates `dataConfig` → query → formatted data for the renderer
4. **Thumbnail generator** — Creates a static preview for the gallery

**Widget Interactions:**
- Hover tooltips with exact values
- Click-through drill-down (e.g., click a bar to filter the whole dashboard)
- Export individual widget as PNG/CSV
- Annotate with text overlays

### 4.5 Version Control

Every schema change creates a new version. The system maintains:

- **Undo/Redo stack** (Zustand middleware) — In-memory, per editing session
- **Persistent versions** (PostgreSQL) — Saved to DB on explicit save or auto-save (every 30s of inactivity)
- **Version timeline** — Visual timeline in a sidebar showing all versions with:
  - Timestamp
  - Change note (AI-generated summary of what changed)
  - Who made the change
  - Diff preview (highlight what widgets were added/removed/modified)
- **Revert** — One-click revert to any previous version
- **Named checkpoints** — Users can name a version ("Before Q4 changes")
- **Branching** (stretch goal) — Fork a dashboard version for experimentation

**Implementation:**
```typescript
// Zustand store with temporal middleware for undo/redo
interface DashboardStore {
  schema: DashboardSchema;
  isDirty: boolean;
  currentVersion: number;
  
  // Mutations (all tracked by temporal middleware)
  applyPatch: (patch: SchemaPatch) => void;
  addWidget: (widget: WidgetConfig) => void;
  removeWidget: (widgetId: string) => void;
  moveWidget: (widgetId: string, position: Position) => void;
  updateWidget: (widgetId: string, changes: Partial<WidgetConfig>) => void;
  
  // Version management
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveVersion: (note?: string) => Promise<void>;
  revertToVersion: (versionId: string) => Promise<void>;
}
```

### 4.6 Permissions & Access Control

**Four tiers:**

| Role | Create | View Own | View Shared | View Public | Manage Users | Edit Glossary | Sensitive Data |
|------|--------|----------|-------------|-------------|-------------|---------------|----------------|
| Viewer | — | — | ✓ | ✓ | — | — | — |
| Creator | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Power User | ✓ | ✓ | ✓ | ✓ | — | Propose | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Data-level permissions** (Phase 2, when Snowflake is connected):
- Sensitive data categories (revenue, salary, PII) require Power User or Admin role
- The AI system prompt is dynamically constructed to only include data sources the user can access
- Query execution layer enforces permissions server-side (never trust client)

**Sharing model:**
- Share with specific users (VIEW / COMMENT / EDIT)
- Share with department (team-level visibility)
- Publish to gallery (all authenticated users)
- Promote to template (Admin only — appears in onboarding template gallery)

### 4.7 Dashboard Gallery & Explorer

The home page after login:

```
┌─────────────────────────────────────────────────────┐
│  [Search dashboards...]          [+ New Dashboard]  │
│                                                      │
│  ★ Favorites (3)                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐                      │
│  │thumb  │ │thumb  │ │thumb  │                      │
│  │Q4 Rev │ │Churn  │ │Tickets│                      │
│  └───────┘ └───────┘ └───────┘                      │
│                                                      │
│  📁 My Dashboards (7)                                │
│  📁 Shared with Me (12)                              │
│  📁 Templates (6)                                    │
│  📁 Sales Team / ...                                 │
│  📁 Support Team / ...                               │
│                                                      │
│  Recently Viewed                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐           │
│  │       │ │       │ │       │ │       │           │
│  └───────┘ └───────┘ └───────┘ └───────┘           │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Full-text search across titles, descriptions, tags, glossary terms
- Filter by: owner, department, tag, date range, template
- Sort by: recently updated, most viewed, alphabetical
- Card view (thumbnails) or list view
- Nested folders with breadcrumb navigation
- Drag dashboards between folders
- Bulk operations (archive, move, share)

### 4.8 Terminology Bible (Glossary)

A dedicated `/glossary` page and an always-available reference panel.

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│  Company Glossary          [Search...]  [+ Add Term] │
│                                                      │
│  Category: Retention ▼                               │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ CHURN RATE                                      │ │
│  │ Definition: The percentage of customers who     │ │
│  │ cancel their subscription within a given period │ │
│  │ divided by the total active customers at the    │ │
│  │ start of that period.                           │ │
│  │                                                 │ │
│  │ Formula: (Cancelled in Period / Active at       │ │
│  │ Start of Period) × 100                          │ │
│  │                                                 │ │
│  │ Data Source: dim_subscriptions                   │ │
│  │ Related: MRR, LTV, Retention Rate               │ │
│  │ Approved by: J. Smith — 2026-03-15              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ NET REVENUE RETENTION (NRR)                     │ │
│  │ ...                                             │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Dual representation:**
1. **In the database** — `GlossaryTerm` records (searchable, editable by admins)
2. **In the repo** — `glossary/terms.yaml` file that is the canonical source, imported to DB on deploy:

```yaml
# glossary/terms.yaml
- term: "Churn Rate"
  category: "Retention"
  definition: >
    The percentage of customers who cancel their subscription
    within a given period, divided by the total active customers
    at the start of that period. Excludes trial accounts.
  formula: "(cancelled_in_period / active_at_period_start) * 100"
  data_source: "dim_subscriptions"
  exclusions:
    - "Trial accounts (< 14 days)"
    - "Internal test accounts"
  related_terms: ["MRR", "LTV", "Retention Rate"]
  approved_by: "J. Smith"
  last_reviewed: "2026-03-15"

- term: "Monthly Recurring Revenue (MRR)"
  category: "Revenue"
  definition: >
    The sum of all active subscription fees normalized to a monthly
    amount. Includes base subscription + add-ons. Excludes one-time
    fees and usage overages.
  formula: "SUM(subscription_monthly_amount) WHERE status = 'active'"
  data_source: "fact_revenue"
  related_terms: ["ARR", "Churn Rate", "NRR"]
  approved_by: "M. Johnson"
  last_reviewed: "2026-03-15"
```

**AI integration:** The full glossary is injected into Claude's system prompt. When a user says "show me churn", the AI references the exact company definition, uses the correct formula, and links the widget to the glossary term so users see a tooltip with the definition on hover.

---

## 5. Sample Data (Phase 1 Demo)

For the demo, generate a realistic sample dataset seeded into PostgreSQL (or a local SQLite for fast prototyping). The sample data should make the platform feel powerful and real.

### 5.1 Sample Tables

```sql
-- Customers
CREATE TABLE sample_customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  company VARCHAR(100),
  plan VARCHAR(20),          -- 'starter', 'professional', 'enterprise'
  region VARCHAR(30),        -- 'Northeast', 'Southeast', 'Midwest', 'West', 'International'
  signup_date DATE,
  cancelled_date DATE,       -- NULL if active
  monthly_revenue DECIMAL(10,2),
  account_manager VARCHAR(80)
);

-- Subscriptions (for MRR/churn calculations)
CREATE TABLE sample_subscriptions (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES sample_customers(id),
  plan VARCHAR(20),
  status VARCHAR(15),        -- 'active', 'cancelled', 'paused', 'trial'
  start_date DATE,
  end_date DATE,
  monthly_amount DECIMAL(10,2),
  add_ons JSONB              -- [{"name": "Premium Support", "amount": 49.99}]
);

-- Support Tickets
CREATE TABLE sample_tickets (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES sample_customers(id),
  subject VARCHAR(200),
  category VARCHAR(50),      -- 'billing', 'technical', 'onboarding', 'feature_request', 'cancellation'
  priority VARCHAR(10),      -- 'low', 'medium', 'high', 'urgent'
  status VARCHAR(15),        -- 'open', 'pending', 'resolved', 'closed'
  channel VARCHAR(20),       -- 'email', 'chat', 'phone', 'portal'
  created_at TIMESTAMP,
  resolved_at TIMESTAMP,
  first_response_minutes INT,
  satisfaction_score INT,    -- 1-5 CSAT
  agent VARCHAR(80),
  team VARCHAR(50)           -- 'Recipient Support', 'Form 1583', 'Sales', 'Mail Centers', 'Partner AI'
);

-- Revenue Events
CREATE TABLE sample_revenue (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES sample_customers(id),
  event_type VARCHAR(20),    -- 'new', 'expansion', 'contraction', 'churn', 'reactivation'
  amount DECIMAL(10,2),
  event_date DATE,
  plan_from VARCHAR(20),
  plan_to VARCHAR(20)
);

-- Product Usage
CREATE TABLE sample_usage (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES sample_customers(id),
  feature VARCHAR(50),       -- 'mail_scan', 'package_forward', 'check_deposit', 'address_use'
  usage_count INT,
  usage_date DATE
);

-- Sales Pipeline
CREATE TABLE sample_deals (
  id SERIAL PRIMARY KEY,
  company VARCHAR(100),
  contact VARCHAR(80),
  stage VARCHAR(20),         -- 'prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  amount DECIMAL(12,2),
  probability INT,           -- 0-100
  source VARCHAR(30),        -- 'inbound', 'outbound', 'referral', 'partner'
  region VARCHAR(30),
  created_at DATE,
  closed_at DATE,
  owner VARCHAR(80)
);
```

### 5.2 Data Generation Guidelines

Generate ~18 months of historical data:
- **5,000 customers** across 5 regions and 3 plans
- **~50,000 support tickets** with realistic seasonal patterns
- **Monthly revenue events** reflecting ~3-5% monthly churn, occasional expansions
- **Product usage** with realistic daily patterns (weekday heavy)
- **200 sales deals** in various pipeline stages
- Use realistic distributions (not uniform random) — e.g., more starter plans than enterprise

Provide a seed script: `scripts/seed-sample-data.ts`

---

## 6. UI Design System

### 6.1 Design Principles

Based on the existing AutoQA dashboards, maintain:

- **Dark-first design** with light mode toggle
- **Glassmorphism cards** — `backdrop-filter: blur(12px)`, subtle borders, gradient backgrounds
- **Color-coded accent system** — Green (positive/success), Amber (warning), Red (error), Blue (info/primary), Purple (special), Cyan (secondary)
- **Inter font family** — weights 300-800
- **Subtle animations** — `fadeIn`, hover lifts (`translateY(-2px)`), smooth transitions
- **Information density** — Pack meaningful data into compact, scannable layouts
- **Hero stat cards** — Top-level KPIs with gradient accent bars at top
- **Pill badges** — Status indicators with colored backgrounds at 12% opacity

### 6.2 Color Palette

```css
/* Dark mode (default) */
--bg-primary: #0a0e14;
--bg-card: rgba(22, 27, 34, 0.85);
--bg-card-hover: rgba(28, 35, 51, 0.9);
--border: rgba(48, 54, 61, 0.6);
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--text-muted: #484f58;

/* Accent colors */
--green: #3fb950;
--amber: #d29922;
--red: #f85149;
--blue: #58a6ff;
--purple: #bc8cff;
--cyan: #39d2c0;

/* Light mode overrides */
--bg-primary-light: #f8fafc;
--bg-card-light: rgba(255, 255, 255, 0.9);
--border-light: #e2e8f0;
--text-primary-light: #1e293b;
```

### 6.3 Component Patterns

**Hero Stat Cards:**
```
┌──────────────────────┐
│▓▓▓▓▓▓ (accent bar)  │
│  📊 Label            │
│  42.3%               │  ← hero-number: 2.5rem, font-weight 800
│  ▲ +3.2% vs prev    │  ← trend pill
└──────────────────────┘
```

**Chat Panel:**
```
┌──────────────────────┐
│  InsightHub AI    [-] │  ← collapsible
│──────────────────────│
│  🤖 What would you   │
│  like to visualize?  │
│                      │
│  👤 Show monthly     │
│  churn rate by plan  │
│  for the last year   │
│                      │
│  🤖 Done! I added a  │
│  line chart showing  │
│  churn by plan...    │
│  [Undo] [Add filter] │  ← quick action buttons
│──────────────────────│
│  [Type a message...] │
└──────────────────────┘
```

---

## 7. Page Structure

| Route | Purpose |
|-------|---------|
| `/` | Dashboard gallery / home (post-login) |
| `/onboarding` | First-time user walkthrough |
| `/dashboard/[id]` | Dashboard canvas + chat panel (editor) |
| `/dashboard/[id]/view` | View-only mode (for shared dashboards) |
| `/dashboard/new` | New blank dashboard with chat focused |
| `/templates` | Template gallery |
| `/glossary` | Terminology bible browser/editor |
| `/admin` | User management, system settings (Admin only) |
| `/admin/audit` | Audit log viewer (Admin only) |
| `/login` | Google OAuth login |

---

## 8. API Endpoints

### Chat / AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message, receive schema patch (SSE stream) |
| GET | `/api/chat/sessions` | List user's chat sessions |
| GET | `/api/chat/sessions/[id]` | Get session with messages |

### Dashboards
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboards` | List dashboards (filtered by access) |
| POST | `/api/dashboards` | Create new dashboard |
| GET | `/api/dashboards/[id]` | Get dashboard + current version schema |
| PUT | `/api/dashboards/[id]` | Update metadata (title, tags, folder) |
| DELETE | `/api/dashboards/[id]` | Archive dashboard |
| GET | `/api/dashboards/[id]/versions` | List version history |
| POST | `/api/dashboards/[id]/versions` | Save new version |
| POST | `/api/dashboards/[id]/revert/[versionId]` | Revert to version |
| POST | `/api/dashboards/[id]/share` | Share with users |
| POST | `/api/dashboards/[id]/duplicate` | Clone dashboard |

### Data
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/data/query` | Execute query against data source |
| GET | `/api/data/sources` | List available tables/views |
| GET | `/api/data/sources/[name]/schema` | Get table columns + types |

### Glossary
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/glossary` | List all terms |
| POST | `/api/glossary` | Add term (Admin) |
| PUT | `/api/glossary/[id]` | Update term (Admin) |
| DELETE | `/api/glossary/[id]` | Remove term (Admin) |
| GET | `/api/glossary/search?q=...` | Search terms |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List users |
| PUT | `/api/admin/users/[id]/role` | Change user role |
| GET | `/api/admin/audit` | Query audit log |

---

## 9. Phased Implementation Plan

### Phase 1 — Foundation & Demo (Weeks 1-3)
**Goal:** Working demo with sample data that wows stakeholders.

- [ ] Project scaffolding (Next.js + TypeScript + Tailwind + shadcn/ui + Prisma)
- [ ] Auth (NextAuth.js with Google OAuth, uszoom.com domain restriction)
- [ ] Database schema + migrations (PostgreSQL)
- [ ] Sample data seed script (realistic 18-month dataset)
- [ ] Glossary system (YAML file → DB sync, CRUD API, browse UI)
- [ ] Widget renderer (all core widget types with sample data)
- [ ] Dashboard schema → Canvas renderer (grid layout, responsive)
- [ ] AI chat interface (Claude integration, schema patch generation, SSE streaming)
- [ ] Version control (undo/redo stack, save versions, revert)
- [ ] Basic gallery (list/card view, search, create, delete)
- [ ] Onboarding flow (first-login walkthrough)
- [ ] Dark/light theme toggle

### Phase 2 — Polish & Sharing (Weeks 4-5)
- [ ] Drag-and-drop widget repositioning
- [ ] Manual widget editor (click-to-edit config panel)
- [ ] Dashboard sharing (user-level permissions, share modal)
- [ ] Folder system (create, nest, move dashboards)
- [ ] Dashboard thumbnails (auto-generated previews)
- [ ] Template system (promote dashboards to templates)
- [ ] Export widgets (PNG, CSV)
- [ ] Responsive preview (desktop/tablet/mobile toggle)

### Phase 3 — Snowflake & Production (Weeks 6-8)
- [ ] Snowflake connector (connection management, query execution)
- [ ] Data source browser (table/view/column explorer)
- [ ] Query caching layer (avoid hammering Snowflake)
- [ ] Data-level permission enforcement
- [ ] Admin panel (user management, audit log)
- [ ] Scheduled dashboard snapshots (email digests)
- [ ] Dashboard embedding (iframe mode with auth token)
- [ ] Performance optimization (lazy-load widgets, virtual scrolling for tables)

### Phase 4 — Advanced Features (Weeks 9+)
- [ ] Dashboard comments/annotations
- [ ] Collaborative editing (real-time cursors via WebSocket)
- [ ] AI-suggested widgets ("Based on your data, you might want to add...")
- [ ] Natural language filtering ("Show me Q4 2025 only")
- [ ] Dashboard alerts (notify when a metric crosses a threshold)
- [ ] Custom calculated fields (user-defined formulas)
- [ ] SQL editor mode (for power users)
- [ ] API access (programmatic dashboard creation)

---

## 10. Additional Design Considerations

### 10.1 Clever Features Worth Building Early

1. **"Explain this metric" button** — Any widget has a ℹ️ icon that shows the glossary definition + how it was calculated + the underlying query (for power users). Builds trust.

2. **AI change summary** — Every version auto-generates a one-line diff summary: *"Added churn trend chart, changed date range to 12 months"*. Makes version history scannable.

3. **Smart suggestions** — After building a dashboard, the AI suggests: *"Based on the metrics you're tracking, you might also want to add NRR and LTV. Should I add them?"*

4. **Dashboard health check** — Indicator showing if all widgets have fresh data, or if any queries failed. Green/yellow/red dot on each widget.

5. **"What changed?" overlay** — When reverting versions, show a visual diff highlighting which widgets were added/removed/modified.

6. **Keyboard shortcuts** — `Ctrl+Z` (undo), `Ctrl+Shift+Z` (redo), `Ctrl+S` (save), `Cmd+K` (search), `/` (focus chat).

7. **Dashboard cloning** — One-click duplicate any dashboard (yours or shared) as a starting point.

8. **"Ask about this data"** — Right-click any data point in a chart to ask the AI a follow-up: *"Why did churn spike in March?"* The AI can cross-reference with other data sources.

### 10.2 Security & Compliance

- All queries are parameterized (no SQL injection)
- Audit log captures every action (GDPR/SOC2 compliance trail)
- Session timeout after 8 hours of inactivity
- API rate limiting (prevent AI abuse)
- Data classification tags on Snowflake tables (PII, financial, internal)
- Row-level security for sensitive data (Phase 3)

### 10.3 Performance Targets

- Dashboard gallery load: < 1s
- Dashboard canvas render: < 2s (all widgets)
- AI response (first token): < 1s via SSE streaming
- Widget data refresh: < 3s per widget
- Search results: < 200ms

---

## 11. Project Bootstrapping Prompt

Use this prompt when starting the new repo with Cascade:

> **Cascade Prompt:**
>
> I'm building "InsightHub" — an AI-powered internal dashboard builder. The full spec is in `docs/DASHBOARD_BUILDER_SPEC.md` (this file). Please read it thoroughly.
>
> Start with Phase 1: scaffold the Next.js 14 app with TypeScript, Tailwind CSS, shadcn/ui, Prisma (PostgreSQL), and NextAuth.js (Google OAuth). Set up the project structure, install dependencies, create the Prisma schema from Section 3, and build the glossary YAML sync system. Then build the widget renderer and dashboard canvas.
>
> Use the design system from Section 6 (dark-first, glassmorphism cards, Inter font, the exact color palette specified). Reference the existing AutoQA dashboards as quality inspiration — they use hero stat cards with gradient accent bars, pill badges, backdrop-blur cards, and smooth animations.
>
> For Phase 1, use the sample data tables from Section 5 instead of Snowflake. Create a seed script that generates realistic data.
>
> The most important feature is the AI chat panel that generates dashboard schemas via Claude. Implement SSE streaming so widgets appear in real time as the AI responds.

---

## 12. Repository Structure

```
insighthub/
├── .env.example
├── .env.local                    # Local dev (gitignored)
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── prisma/
│   ├── schema.prisma             # Full data model
│   ├── migrations/
│   └── seed.ts                   # Sample data generator
├── glossary/
│   └── terms.yaml                # Canonical glossary (synced to DB)
├── public/
│   ├── logo.svg
│   └── onboarding/               # Walkthrough images
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (theme, font, providers)
│   │   ├── page.tsx              # Gallery / home
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── dashboard/
│   │   │   ├── [id]/page.tsx     # Dashboard editor
│   │   │   ├── [id]/view/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── templates/page.tsx
│   │   ├── glossary/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   └── audit/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── chat/route.ts
│   │       ├── dashboards/
│   │       ├── data/
│   │       ├── glossary/
│   │       └── admin/
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardCanvas.tsx
│   │   │   ├── WidgetRenderer.tsx
│   │   │   ├── WidgetEditor.tsx
│   │   │   └── GridLayout.tsx
│   │   ├── widgets/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Gauge.tsx
│   │   │   ├── Funnel.tsx
│   │   │   ├── TextBlock.tsx
│   │   │   └── index.ts          # Widget registry
│   │   ├── gallery/
│   │   │   ├── DashboardCard.tsx
│   │   │   ├── FolderTree.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── glossary/
│   │   │   ├── TermCard.tsx
│   │   │   └── GlossaryBrowser.tsx
│   │   ├── versioning/
│   │   │   ├── VersionTimeline.tsx
│   │   │   └── DiffOverlay.tsx
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       ├── Sidebar.tsx
│   │       └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── claude.ts         # Anthropic API client
│   │   │   ├── prompts.ts        # System prompt builder
│   │   │   └── schema-patcher.ts # Apply AI-generated patches
│   │   ├── db/
│   │   │   └── prisma.ts         # Prisma client singleton
│   │   ├── data/
│   │   │   ├── query-engine.ts   # Unified query interface
│   │   │   ├── sample-adapter.ts # Sample data adapter (Phase 1)
│   │   │   └── snowflake.ts      # Snowflake adapter (Phase 3)
│   │   ├── glossary/
│   │   │   └── sync.ts           # YAML → DB sync
│   │   ├── auth/
│   │   │   └── config.ts         # NextAuth configuration
│   │   └── utils/
│   │       ├── schema.ts         # DashboardSchema types + validators
│   │       └── permissions.ts    # Access control helpers
│   ├── stores/
│   │   └── dashboard-store.ts    # Zustand store + undo/redo
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── scripts/
│   ├── seed-sample-data.ts       # Generate realistic demo data
│   └── sync-glossary.ts          # CLI: sync terms.yaml → DB
└── docs/
    └── DASHBOARD_BUILDER_SPEC.md # This file
```

---

## 13. Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/insighthub"

# Auth (Google OAuth)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
ALLOWED_DOMAIN="uszoom.com"

# AI
ANTHROPIC_API_KEY="..."

# Snowflake (Phase 3)
SNOWFLAKE_ACCOUNT=""
SNOWFLAKE_USERNAME=""
SNOWFLAKE_PASSWORD=""
SNOWFLAKE_WAREHOUSE=""
SNOWFLAKE_DATABASE=""
SNOWFLAKE_SCHEMA=""
```

---

*This spec was generated on 2026-04-17. Version 1.0.*
