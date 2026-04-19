# InsightHub — CTO Technical Review

**Application:** InsightHub — AI-Powered Dashboard Builder  
**Production URL:** https://dashboards.jeffcoy.net  
**Review Date:** April 18, 2026  
**Version:** 0.1.0 (Phase 1)

---

## Executive Summary

InsightHub is an internal self-service BI platform where employees create data dashboards using natural language, powered by Claude AI (Sonnet 4). It is a full-stack Next.js 16 application using TypeScript strict mode, Prisma ORM with SQLite, Zustand for state management, and Recharts for visualization. The project follows a phased roadmap: Phase 1 (current) uses sample data; Phase 3 will introduce Snowflake as a live data connector.

This report covers architecture, technology decisions, code quality, AI integration, scalability path, testing coverage, CI/CD pipeline, and technical debt.

---

## 1. Architecture Overview

### 1.1 System Architecture

```
User (Browser)
     │
     ├── Next.js App Router (SSR + Client Components)
     │       │
     │       ├── API Routes (/api/*)
     │       │     ├── /api/chat → Anthropic Claude API (streaming SSE)
     │       │     ├── /api/voice/transcribe → OpenAI Whisper API
     │       │     ├── /api/dashboards → CRUD + versioning + sharing
     │       │     ├── /api/data/query → Sample data engine
     │       │     ├── /api/glossary → Business terminology CRUD
     │       │     ├── /api/widgets → Widget library (publish/fork/search)
     │       │     ├── /api/admin/* → User mgmt, permissions, audit logs
     │       │     └── /api/health → Health check (DB, memory, uptime)
     │       │
     │       └── Prisma ORM → SQLite (file:./dev.db)
     │
     ├── Zustand Store (client state, undo/redo history)
     │
     └── Nginx (reverse proxy, TLS, rate limiting) → EC2
```

### 1.2 Key Architectural Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **SQLite** over PostgreSQL | Zero-infrastructure for Phase 1; single file, no daemon | Single-writer lock; must migrate for concurrent users |
| **Next.js App Router** | SSR, API routes, and UI in one codebase | Complex RSC mental model; heavier than pure SPA |
| **Standalone output** | Docker-free deployment; self-contained binary | Manual static asset + Prisma engine copying |
| **Zustand** over Redux | Simpler API, built-in undo/redo middleware | Less ecosystem tooling than Redux |
| **AI patches** (not full schemas) | Bandwidth-efficient; incremental updates | Patch conflict resolution complexity |
| **JWT sessions** (not database) | Stateless; no session store needed | Cannot revoke individual sessions |
| **In-memory rate limiter** | No external dependency (Redis) | State lost on restart; single-instance only |

---

## 2. Technology Stack

### 2.1 Core Dependencies

| Layer | Package | Version | Purpose |
|-------|---------|---------|---------|
| **Framework** | `next` | 16.2.4 | App Router, SSR, API routes |
| **Language** | TypeScript | ^5 | Strict mode enabled |
| **UI** | `react` / `react-dom` | 19.2.4 | React 19 with concurrent features |
| **Styling** | `tailwindcss` | ^4 | Utility-first CSS |
| **Charts** | `recharts` | ^3.8.1 | Declarative chart components |
| **AI** | `@anthropic-ai/sdk` | ^0.90.0 | Claude API (streaming support) |
| **ORM** | `@prisma/client` | ^5.22.0 | Type-safe database access |
| **Auth** | `next-auth` | ^4.24.14 | Google OAuth + JWT sessions |
| **State** | `zustand` | ^5.0.12 | Client state with undo/redo |
| **Validation** | `zod` | ^4.3.6 | Runtime input validation |
| **Components** | `@radix-ui/*` | Various | Accessible primitives (dialog, dropdown, tabs, etc.) |
| **Icons** | `lucide-react` | ^1.8.0 | Tree-shakeable icon set |

### 2.2 Dev Dependencies

| Package | Purpose |
|---------|---------|
| `@playwright/test` ^1.59.1 | E2E testing (Chromium) |
| `@axe-core/playwright` ^4.11.2 | WCAG 2.1 AA accessibility testing |
| `@faker-js/faker` ^10.4.0 | Seed data generation |
| `tsx` ^4.21.0 | TypeScript script execution (seed, glossary sync) |
| `eslint` + `eslint-config-next` | Linting |

---

## 3. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # 26 API route handlers
│   │   ├── chat/route.ts         # AI chat (486 lines — largest route)
│   │   ├── dashboards/           # CRUD, share, version, duplicate, revert
│   │   ├── data/query/route.ts   # Permission-gated data queries
│   │   ├── admin/                # Audit logs, users, permission groups
│   │   ├── glossary/             # CRUD + search
│   │   ├── widgets/              # Library: search, publish, fork, explain
│   │   ├── voice/transcribe/     # Whisper proxy
│   │   └── health/route.ts       # Monitoring endpoint
│   ├── dashboard/[id]/           # Dashboard editor page
│   ├── gallery/                  # Dashboard gallery
│   └── admin/                    # Admin audit viewer
│
├── components/                   # React components (7 subdirectories)
│   ├── chat/                     # AI chat panel
│   ├── dashboard/                # Canvas, drag-and-drop, context menu
│   ├── gallery/                  # Dashboard card grid
│   ├── layout/                   # Navbar, theme toggle
│   ├── versioning/               # Version timeline
│   └── widgets/                  # 14 widget types
│
├── hooks/                        # 9 custom hooks
│   ├── useAutoSave.ts            # Debounced auto-save
│   ├── useKeyboardShortcuts.ts   # Ctrl+Z, Ctrl+S, etc.
│   ├── useSpeechToText.ts        # Browser speech recognition
│   ├── useTouchDrag.ts           # Mobile touch support
│   └── useViewport.ts            # Responsive breakpoints
│
├── lib/
│   ├── ai/                       # AI integration (4 files)
│   │   ├── prompts.ts            # System prompt builder (497 lines)
│   │   ├── schema-patcher.ts     # Apply AI patches to dashboard schema
│   │   ├── auto-layout.ts        # Widget auto-positioning algorithm
│   │   └── change-summarizer.ts  # Human-readable change descriptions
│   ├── auth/                     # Auth system (3 files)
│   │   ├── config.ts             # NextAuth config, OAuth, domain restriction
│   │   ├── permissions.ts        # RBAC engine (465 lines)
│   │   └── session.ts            # Session helpers
│   ├── data/                     # Sample data generators + templates
│   ├── audit.ts                  # Audit logging
│   ├── rate-limiter.ts           # Sliding window rate limiter (275 lines)
│   ├── logger.ts                 # Structured logger (JSON in prod)
│   ├── env.ts                    # Environment validation
│   └── export-utils.ts           # CSV, PNG, SVG export
│
├── stores/                       # Zustand stores
├── types/                        # TypeScript interfaces
└── instrumentation.ts            # Server startup hook (env validation)
```

### 3.1 Codebase Metrics

| Metric | Value |
|--------|-------|
| API route files | 26 |
| Custom React hooks | 9 |
| Prisma models | 14 |
| Widget types | 14 |
| E2E test files | 4 |
| Total TypeScript source files | ~80+ |

---

## 4. AI Integration

### 4.1 Architecture

The AI integration follows a **patch-based** architecture rather than full schema replacement:

```
User message → /api/chat (POST)
    │
    ├── 1. Validate input (Zod schema)
    ├── 2. Authenticate user
    ├── 3. Build system prompt (glossary + schema + permissions + widget library)
    ├── 4. Send to Claude Sonnet 4 (streaming or non-streaming)
    ├── 5. Parse response → patches (add/update/remove/use widget)
    ├── 6. Persist chat messages to database
    └── 7. Return patches + explanation + quick actions
```

**System prompt construction** (`src/lib/ai/prompts.ts:141–421`) injects:
- Company glossary terms (from YAML file)
- Current dashboard schema (JSON)
- Available data sources (filtered by user permissions)
- Restricted data categories (explicitly told to the AI)
- Widget library (pre-built reusable widgets)
- Schema-aware smart suggestions
- Widget sizing guide + text block styling reference

### 4.2 Streaming

Real-time token streaming via Server-Sent Events (SSE):

```typescript
// src/app/api/chat/route.ts:347–424
// Events: progress → token → patch → explanation → complete
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemPrompt,
  messages,
});
```

### 4.3 SQL Copilot Mode

The chat API auto-detects SQL-related queries and switches to SQL assistant mode:
- Explain This Query
- Natural Language → SQL
- SQL Optimization
- Verify Dashboard
- Formula Help

Detection: `src/app/api/chat/route.ts:337–344`

### 4.4 Widget Library Integration

Pre-built widgets from existing dashboards can be reused via `use_widget` patches. The AI is given the full widget library in its system prompt and instructed to prefer reuse over creation: `src/lib/ai/prompts.ts:182–188`.

---

## 5. Data Layer

### 5.1 Database Schema

**14 Prisma models** across three domains:

**Application Domain:**
- `User` — email, name, role, department, login tracking
- `Dashboard` — title, owner, tags, version counter, public/template flags
- `DashboardVersion` — versioned schema snapshots (JSON blob)
- `DashboardShare` — per-user permission grants (VIEW/COMMENT/EDIT)
- `Folder` — hierarchical dashboard organization
- `ChatSession` / `ChatMessage` — AI conversation persistence

**Business Data Domain (Sample):**
- `SampleCustomer`, `SampleSubscription`, `SampleTicket`, `SampleRevenue`, `SampleUsage`, `SampleDeal`
- 5,000 customers, ~50,000 tickets, 200 deals, 18 months of data
- Generated by `prisma/seed.ts` using `@faker-js/faker`

**Permission Domain:**
- `PermissionGroup` — feature + data permissions (JSON)
- `UserPermissionAssignment` — group assignment with custom overrides
- `DataAccessRule` — per-category access levels (FULL/NONE/FILTERED)
- `AuditLog` — action logging with metadata

### 5.2 Database Indexes

Well-indexed for common queries:
- `Dashboard`: `@@index([ownerId])`, `@@index([folderId])`
- `DashboardVersion`: `@@index([dashboardId, version])`
- `GlossaryTerm`: `@@index([category])`
- `AuditLog`: `@@index([userId])`, `@@index([resourceType, resourceId])`, `@@index([createdAt])`
- `WidgetTemplate`: `@@index([type])`, `@@index([publishedById])`

### 5.3 Migration Path (Phase 3)

The codebase is prepared for PostgreSQL migration:
- `docker-compose.yml` has commented-out PostgreSQL service
- `DATABASE_URL` validation accepts both `file:` and `postgresql:` prefixes: `src/lib/env.ts:27`
- Snowflake env vars are defined but unused: `src/lib/env.ts:80–103`

---

## 6. Frontend Architecture

### 6.1 State Management

Zustand store with undo/redo history for dashboard editing. State includes:
- Dashboard schema (widgets, layout, filters)
- AI chat state (messages, streaming status)
- Drag-and-drop state
- Selection state

### 6.2 Widget System

14 widget types with a common interface:
`kpi_card`, `line_chart`, `bar_chart`, `area_chart`, `pie_chart`, `donut_chart`, `stacked_bar`, `scatter_plot`, `table`, `funnel`, `gauge`, `metric_row`, `text_block`, `divider`

### 6.3 Responsive Design

- 12-column grid layout with configurable row height and gap
- Touch support via `useTouchDrag` hook
- Viewport-aware rendering via `useViewport` hook
- Platform detection via `usePlatform` hook

### 6.4 Export Capabilities

Client-side export to CSV, PNG, and SVG: `src/lib/export-utils.ts`

### 6.5 Accessibility

WCAG 2.1 AA testing via `@axe-core/playwright` across 6 pages: `e2e/accessibility.spec.ts`

---

## 7. Quality & Testing

### 7.1 Test Suite

| Test Type | Framework | Files | Coverage |
|-----------|-----------|-------|----------|
| E2E smoke | Playwright | `e2e/smoke.spec.ts` | Health API, page rendering, navigation flows |
| Accessibility | axe-core | `e2e/accessibility.spec.ts` | 6 pages: home, gallery, editor, glossary, login, 404 |
| Production health | Playwright | `e2e/production-health.spec.ts` | Response time, SSL, security headers |
| API integration | Playwright | `e2e/api-integration.spec.ts` | API endpoint testing |

### 7.2 Type Safety

- TypeScript strict mode enabled
- `tsc --noEmit` runs as a CI gate: `.github/workflows/ci.yml:34`
- Zod validation on critical API inputs
- Prisma generates typed client from schema

### 7.3 Linting

ESLint with `eslint-config-next` — runs as parallel CI gate: `.github/workflows/ci.yml:46`

### 7.4 Testing Gaps

| Gap | Recommendation |
|-----|----------------|
| No unit tests | Add Jest/Vitest for pure functions (schema patcher, auto-layout, permissions) |
| No integration tests for AI | Mock Anthropic API; test prompt construction + response parsing |
| No load testing | Add k6 or Artillery for rate limiter + API performance |
| No visual regression | Consider Playwright visual comparisons or Chromatic |

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions

Pipeline defined in `.github/workflows/ci.yml` (216 lines):

```
Push to main/PR:
  ├── [parallel] TypeScript check
  ├── [parallel] ESLint
  ├── Build (depends on above)
  │   ├── Prisma generate + seed
  │   ├── Next.js build
  │   └── Bundle size report (2MB JS budget)
  └── E2E Tests (depends on build)
      ├── Playwright install
      └── Smoke + accessibility tests

Manual trigger (workflow_dispatch):
  └── Deploy to EC2 (same build pipeline + rsync + systemctl restart)
```

### 8.2 Bitbucket Pipelines

Parallel configuration in `bitbucket-pipelines.yml` (162 lines):

```
default (every push): parallel typecheck + lint
main: typecheck + lint → build → e2e → deploy
custom: deploy-only, full-pipeline
```

### 8.3 Bundle Size Budget

CI checks that total JS bundle stays under 2MB:
```bash
# .github/workflows/ci.yml:76–81
TOTAL_JS=$(find .next/static -name '*.js' -exec cat {} + | wc -c)
TOTAL_MB=$((TOTAL_JS / 1024 / 1024))
if [ "$TOTAL_MB" -gt 2 ]; then
  echo "::warning::JS bundle exceeds 2MB budget"
fi
```

### 8.4 Deploy Flow

Manual deployment via `./deploy.sh` or CI workflow_dispatch:
1. Pre-deploy DB backup
2. Preserve previous build for rollback
3. Rsync files to EC2 (excluding node_modules, .next, .env.local, DB)
4. Install deps + push schema
5. Build + package standalone
6. Restart systemd service
7. Health check with 5 retries (auto-rollback on failure)

---

## 9. Observability

### 9.1 Structured Logging

`src/lib/logger.ts` — JSON output in production, human-readable in development:

```typescript
// Production: {"level":"info","message":"POST /api/chat 200","timestamp":"...","durationMs":1234}
// Development: ℹ️ [2026-04-18T21:00:00Z] POST /api/chat 200 {"durationMs":1234}
```

Includes: request logging with timing, exception logging with stack traces (dev only), configurable log level via `LOG_LEVEL` env var.

### 9.2 Health Endpoint

`GET /api/health` returns: status, database connectivity + latency, memory usage (heap/RSS), uptime, Node.js version, git commit hash. Returns HTTP 503 when degraded: `src/app/api/health/route.ts`.

### 9.3 Monitoring Script

`scripts/monitor-health.sh` — one-shot or continuous health monitoring with JSON output for log aggregation. Cron-ready: `*/5 * * * *`.

---

## 10. Scalability Considerations

### 10.1 Current Limitations

| Limitation | Impact | Phase 3 Path |
|-----------|--------|---------------|
| SQLite (single-writer) | Cannot handle concurrent writes from multiple users | Migrate to PostgreSQL |
| In-memory rate limiter | State lost on restart; no horizontal scaling | Move to Redis |
| Single EC2 instance | No redundancy; single point of failure | Add load balancer + auto-scaling group |
| File-based database | Backup requires service awareness | PostgreSQL with streaming replication |
| No CDN | Static assets served from EC2 | Add CloudFront |
| No caching layer | Every data query hits SQLite | Add Redis/Memcached |

### 10.2 Scaling-Ready Design

The codebase has several forward-looking patterns:
- **Standalone output** (`next.config.ts:4`) — containerization-ready
- **Database URL abstraction** — supports SQLite and PostgreSQL
- **Docker Compose stub** — ready for PostgreSQL service
- **Snowflake env vars** — prepared for live data connector
- **Prisma ORM** — schema migration tools built-in

---

## 11. Technical Debt

| Item | Severity | File | Description |
|------|----------|------|-------------|
| Chat route size | Medium | `src/app/api/chat/route.ts` | 486 lines — extract streaming, parsing, session handling into separate modules |
| Prompt size | Medium | `src/lib/ai/prompts.ts` | 497 lines — system prompt is very large; consider splitting by mode (dashboard vs SQL) |
| Dashboard create validation | Medium | `src/app/api/dashboards/route.ts:71–77` | `schema` body field accepts `unknown` — add Zod validation |
| Health check creates new PrismaClient | Low | `src/app/api/health/route.ts:21` | Creates + disconnects a fresh client per call; reuse the shared instance |
| `any` types | Low | Various | `src/lib/audit.ts:169`, `src/app/api/admin/permission-groups/route.ts:184` — tighten types |
| No unit tests | High | — | Pure functions (schema patcher, auto-layout, permissions) have no unit test coverage |
| Hardcoded admin list | Low | `src/lib/auth/config.ts:17–20` | Admin emails hardcoded; should be database-driven |

---

## 12. Roadmap Alignment

### Phase 1 (Current) — Sample Data
- ✅ AI-powered dashboard builder with Claude Sonnet 4
- ✅ Widget system with 14 types
- ✅ Drag-and-drop canvas with undo/redo
- ✅ Widget library (publish/fork)
- ✅ Glossary system
- ✅ RBAC with permission groups
- ✅ Audit logging
- ✅ CI/CD with auto-rollback
- ✅ Production deployment on EC2

### Phase 2 — Authentication & Sharing
- ✅ Google OAuth (implemented)
- ✅ Dashboard sharing (VIEW/COMMENT/EDIT)
- ✅ Domain-restricted login
- ⬜ Self-service onboarding flow

### Phase 3 — Live Data (Snowflake)
- ⬜ Snowflake connector
- ⬜ PostgreSQL migration
- ⬜ Real-time data queries
- ⬜ Scheduled dashboard refresh

---

## Appendix: Key File Index for Technical Review

| Area | File | Lines of Interest |
|------|------|-------------------|
| App config | `next.config.ts` | 3–7 (standalone output, Prisma external package) |
| Package manifest | `package.json` | 24–49 (dependencies), 5–22 (scripts) |
| DB schema | `prisma/schema.prisma` | 1–306 (all 14 models) |
| Seed script | `prisma/seed.ts` | 1–80 (data generation constants) |
| AI prompts | `src/lib/ai/prompts.ts` | 141–421 (system prompt), 85–139 (data source filtering) |
| AI schema patcher | `src/lib/ai/schema-patcher.ts` | Patch application logic |
| AI auto-layout | `src/lib/ai/auto-layout.ts` | Widget positioning algorithm |
| Chat API | `src/app/api/chat/route.ts` | 219–244 (validation), 347–424 (streaming) |
| Dashboard CRUD | `src/app/api/dashboards/route.ts` | 9–124 (list + create) |
| Data query | `src/app/api/data/query/route.ts` | 6–74 (permission-gated queries) |
| Rate limiter | `src/lib/rate-limiter.ts` | 20–148 (sliding window impl) |
| Auth config | `src/lib/auth/config.ts` | 30–157 (NextAuth options) |
| Permissions | `src/lib/auth/permissions.ts` | 52–146 (role templates), 164–283 (resolution) |
| Logger | `src/lib/logger.ts` | 1–114 (structured logging) |
| Env validation | `src/lib/env.ts` | 115–190 (startup validation) |
| Export utils | `src/lib/export-utils.ts` | 14–143 (CSV, PNG, SVG) |
| CI pipeline | `.github/workflows/ci.yml` | 1–216 (full pipeline) |
| BB pipeline | `bitbucket-pipelines.yml` | 1–162 (parallel config) |
| Deploy script | `deploy.sh` | 1–180 (auto-rollback deploy) |
| E2E smoke | `e2e/smoke.spec.ts` | 1–88 (health, rendering, navigation) |
| A11y tests | `e2e/accessibility.spec.ts` | 1–110 (WCAG 2.1 AA) |
| Prod health tests | `e2e/production-health.spec.ts` | 1–56 (latency, SSL, headers) |
| Health endpoint | `src/app/api/health/route.ts` | 6–53 (DB, memory, uptime) |
| Playwright config | `playwright.config.ts` | 1–63 (test configuration) |
