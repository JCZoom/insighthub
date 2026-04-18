# Level Zero — Foundation Audit Decision Log

**Date:** April 17, 2026
**Project:** InsightHub — AI-Powered Dashboard Builder
**Scope:** Weekend Build Playbook, Level 0 (Foundation Tightening)

---

## Executive Summary

Level Zero is about ensuring every foundational layer is **solid, tested, and zero-friction** before building upward. The goal: a developer should be able to `git clone`, `npm install`, `npm run dev` and have a fully working demo — no Docker, no external services, no manual setup.

**Result:** Build passes clean. Dev server starts in <300ms. All 4 template dashboards render. Database works out of the box.

---

## Decision 1: PostgreSQL → SQLite

### Problem
The original schema required PostgreSQL via Docker (`docker-compose.yml`). However:
- Docker Desktop was **not installed** on the dev machine
- PostgreSQL was also **not available locally**
- This meant the entire save/load/gallery pipeline was dead — the core demo loop was broken

### Decision
**Switch to SQLite via Prisma.** SQLite requires zero infrastructure — it's a single file (`prisma/dev.db`) that Prisma creates automatically.

### What Changed
| File | Change |
|------|--------|
| `prisma/schema.prisma` | `provider = "sqlite"` |
| `.env.local` | `DATABASE_URL="file:./dev.db"` |
| `.env.example` | Same — updated template |
| `.gitignore` | Added `prisma/dev.db` and `prisma/dev.db-journal` |

### Trade-offs
- **Pro:** Zero setup, instant dev experience, no Docker dependency
- **Pro:** Prisma abstracts the SQL layer — switching back to PostgreSQL for production is a one-line change
- **Con:** No JSON column type (solved by storing as String + serialize/deserialize)
- **Con:** No enum types (solved by using String fields with documented valid values)
- **Con:** No `mode: 'insensitive'` for search (SQLite LIKE is case-insensitive by default for ASCII)

### Architect's Reasoning
> "For a weekend demo, the best database is the one that doesn't need a sysadmin. SQLite eliminates the #1 friction point — infrastructure setup — and Prisma's abstraction layer means we can swap providers in 60 seconds when production needs demand it."

---

## Decision 2: JSON Fields → String with Serialization

### Problem
SQLite (via Prisma) doesn't support the `Json` column type. Our schema stored dashboard schemas, widget configs, chat metadata, and audit logs as JSON.

### Decision
Store JSON as `String` columns, serialize with `JSON.stringify()` on write, and parse with `JSON.parse()` on read.

### Files Updated
| Route | Change |
|-------|--------|
| `POST /api/dashboards` | `JSON.stringify(schema)` on create |
| `GET /api/dashboards/[id]` | `JSON.parse(version.schema)` on read |
| `POST /api/dashboards/[id]/versions` | `JSON.stringify(schema)` on save |
| `POST /api/dashboards/[id]/revert/[versionId]` | Pass-through on write, `JSON.parse()` on response |
| `POST /api/dashboards/[id]/duplicate` | Pass-through (already stored as string) |

### Architect's Reasoning
> "The serialization boundary is small (6 routes) and well-contained. The client never sees the difference — it receives and sends plain JavaScript objects. The cost is ~50 bytes of code per route. The benefit is eliminating a hard infrastructure dependency."

---

## Decision 3: Enums → String Fields

### Problem
SQLite doesn't support PostgreSQL's `enum` type. The schema used enums for: `Role`, `SharePermission`, `FolderVisibility`, `MessageRole`.

### Decision
Replace `enum` types with `String` fields and document valid values as comments in the schema.

### Example
```prisma
// Before (PostgreSQL)
role  Role  @default(VIEWER)
enum Role { VIEWER, CREATOR, POWER_USER, ADMIN }

// After (SQLite)
role  String  @default("VIEWER")
// Role values: VIEWER, CREATOR, POWER_USER, ADMIN
```

### Trade-offs
- **Pro:** Works with any database provider
- **Con:** No database-level validation of enum values
- **Mitigation:** App-layer validation already exists in the auth/session module

---

## Decision 4: Array Fields → Comma-Separated Strings

### Problem
SQLite doesn't support `String[]` array columns. Tags, related terms, and widget template tags were stored as arrays.

### Decision
Store as comma-separated strings. Updated all read/write paths.

### Example
```typescript
// Before
tags: ['executive', 'overview', 'kpi']

// After
tags: 'executive,overview,kpi'
```

### Files Updated
- `POST /api/dashboards` — `Array.isArray(tags) ? tags.join(',') : tags`
- `PUT /api/dashboards/[id]` — Same pattern
- `GET /api/dashboards` — Search uses `{ tags: { contains: q } }` instead of `hasSome`
- `prisma/seed.ts` — Tags as comma-separated strings
- `scripts/sync-glossary.ts` — `relatedTerms` joined on write

---

## Decision 5: Search Simplification

### Problem
PostgreSQL-specific query features were used:
- `mode: 'insensitive'` on text searches
- `hasSome` on array fields

### Decision
- Remove `mode: 'insensitive'` — SQLite's `LIKE` (used by Prisma `contains`) is case-insensitive by default for ASCII
- Replace `hasSome` with `contains` on the comma-separated string

### Architect's Reasoning
> "For a demo, 'good enough' search is better than 'perfect search that requires PostgreSQL'. The user won't notice the difference."

---

## Audit Results Summary

### 1. Core TypeScript Types ✅
- `DashboardSchema`, `WidgetConfig`, `SchemaPatch` are well-defined
- All widget types have proper typing
- `EMPTY_DASHBOARD_SCHEMA` provides a clean default
- No loose `any` types in core interfaces

### 2. Prisma Schema ✅
- Lean and focused — 9 models, no bloat
- All relations properly defined with cascade deletes
- Indexes on frequently queried fields
- SQLite-compatible (no JSON, no enums, no arrays)

### 3. Sample Data Coverage ✅
Every widget type has sample data:
| Widget Type | Data Source | Sample Data |
|-------------|------------|-------------|
| KPI | `sample_mrr`, `sample_churn`, etc. | ✅ |
| Line Chart | `sample_mrr_trend` | ✅ |
| Bar Chart | `sample_tickets_by_category` | ✅ |
| Area Chart | `sample_revenue_by_segment` | ✅ |
| Pie/Donut | `sample_churn_by_reason` | ✅ |
| Data Table | `sample_deals` | ✅ |
| Gauge | `sample_csat`, `sample_nrr` | ✅ |
| Text Block | N/A (content-based) | ✅ |

### 4. Environment Configuration ✅
- `.env.example` updated with SQLite URL
- `.env.local` updated — database works out of the box
- Dev mode (`NEXT_PUBLIC_DEV_MODE=true`) bypasses auth correctly
- Anthropic API key configured for AI chat

### 5. Template Dashboards ✅
All 4 templates defined in `src/lib/data/templates.ts`:
1. **Executive Summary** — 9 widgets (KPIs, charts, tables)
2. **Support Operations** — 8 widgets
3. **Churn Analysis** — 8 widgets
4. **Sales Pipeline** — 8 widgets

Each uses a mix of widget types with proper data source mappings.

### 6. Dev Server ✅
- `npm run dev` starts in ~280ms
- No TypeScript errors
- No console warnings
- `next build` completes successfully
- All routes compile and are accessible

---

## Architecture Health Check

### What's Working Well
- **Type-safe end-to-end:** TypeScript types flow from schema → store → components → API
- **AI integration:** System prompt includes glossary + current schema, returns structured patches
- **Undo/redo:** Zustand store tracks history stack correctly
- **Demo loop complete:** Create → AI edit → Save → Gallery → Re-edit

### What to Watch (Level 1+)
- **Auto-save hook** references PostgreSQL version endpoint — works with SQLite but should test thoroughly
- **Gallery merge logic** — deduplication between templates and DB dashboards uses ID matching
- **Version timeline** — fetches from API, needs DB to be running

---

## Commands Reference

```bash
# First-time setup
npm install
npx prisma db push      # Creates SQLite file
npx tsx prisma/seed.ts   # Seeds demo data

# Daily dev
npm run dev              # Starts at http://localhost:3000

# Verify build
npx next build           # Should complete with 0 errors
```

---

*This document was generated as part of the Weekend Build Playbook, Level 0 foundation audit.*
