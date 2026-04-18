# Developer Guide

> Everything you need to know to contribute to InsightHub.

## Prerequisites

- **Node.js 20+** (LTS)
- **npm** (comes with Node.js)
- An **Anthropic API key** for AI chat features (optional for non-AI work)

No Docker, no PostgreSQL, no external services. SQLite runs in-process.

---

## First-Time Setup

```bash
# Clone the repo
git clone git@github.com:JCZoom/insighthub.git
cd insighthub

# Install dependencies (also generates Prisma client via postinstall)
npm install

# Create your local environment file
cp .env.example .env.local
# Edit .env.local → set ANTHROPIC_API_KEY if you need AI features

# Push the schema to create the SQLite database
npm run db:push

# Seed sample data (customers, tickets, revenue, etc.)
npm run db:seed

# Sync glossary terms from YAML → database
npm run glossary:sync

# Start the dev server
npm run dev
```

Open http://localhost:3000. Dev mode bypasses OAuth and auto-logs you in as admin.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────┐  │
│  │ Chat Panel   │  │ Dashboard Canvas  │  │ Widget       │  │
│  │ (React)      │  │ (Zustand store)   │  │ Renderers    │  │
│  └──────┬───────┘  └────────┬──────────┘  └──────────────┘  │
└─────────┼──────────────────┼─────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js API Routes                                          │
│  ┌──────────────┐  ┌───────────┐  ┌───────────────────────┐ │
│  │ /api/chat    │  │ /api/     │  │ /api/glossary         │ │
│  │ (Claude AI)  │  │ dashboards│  │ /api/widgets          │ │
│  └──────┬───────┘  └─────┬─────┘  └───────────────────────┘ │
└─────────┼────────────────┼───────────────────────────────────┘
          │                │
          ▼                ▼
┌──────────────┐  ┌───────────────┐
│ Anthropic    │  │ SQLite        │
│ Claude API   │  │ (Prisma ORM)  │
└──────────────┘  └───────────────┘
```

### Key Concepts

- **DashboardSchema** — A JSON blob stored in `DashboardVersion.schema`. Contains all widget configs, layout positions, filters, and metadata.
- **Schema Patches** — The AI returns patches (`add_widget`, `update_widget`, `remove_widget`, `use_widget`) instead of regenerating the full schema. Keeps token costs low and makes undo/redo trivial.
- **Zustand Store** — `src/stores/dashboard-store.ts` holds the active dashboard state with a manual history stack for undo/redo.
- **Widget Library** — `src/lib/data/widget-library.ts` auto-extracts reusable widgets from template dashboards.
- **Glossary** — `glossary/terms.yaml` is the canonical source. Synced to DB. Injected into the AI system prompt so Claude uses correct business terminology.

### Data Flow: User Message → Widget on Canvas

1. User types message in **ChatPanel**
2. ChatPanel calls `POST /api/chat` with message + conversation history
3. API builds a system prompt (includes glossary, widget library, current schema)
4. Calls **Claude Sonnet 4** with the prompt
5. Claude returns JSON schema patches
6. `schema-patcher.ts` applies patches to the current DashboardSchema
7. Zustand store updates, pushing old state to history stack
8. **DashboardCanvas** re-renders with new/updated widgets

---

## Database

### Provider: SQLite (Prisma 5)

- **Zero infrastructure** — database is a single file at `prisma/dev.db`
- Schema: `prisma/schema.prisma`
- No JSON columns, no enums, no `@db.*` annotations (SQLite limitations)
- Strings store JSON via `JSON.stringify/parse` in API routes
- Tags and arrays stored as comma-separated strings

### Common Commands

```bash
npm run db:push       # Push schema changes (dev — no migration files)
npm run db:seed       # Seed sample data
npm run db:studio     # Open Prisma Studio (visual DB browser)
npm run db:generate   # Regenerate Prisma client after schema changes
```

### Adding a New Model

1. Add the model to `prisma/schema.prisma`
2. Run `npm run db:push` to update the database
3. Prisma client regenerates automatically
4. **Remember:** No `Json` type, no `enum`, no `String[]` — use `String` for everything

---

## API Routes

All API routes live in `src/app/api/`. Pattern:

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    // ... your logic
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Auth

- **Dev mode** (`NEXT_PUBLIC_DEV_MODE=true`): Bypasses OAuth, returns a mock admin user
- **Production**: Google OAuth via NextAuth.js (domain-locked to `@uszoom.com`)
- `getCurrentUser()` from `src/lib/auth/session.ts` — use in every protected route
- Roles: `VIEWER`, `CREATOR`, `POWER_USER`, `ADMIN` (stored as plain strings)

### Rate Limiting

Wrap handlers with `withRateLimit()` from `src/lib/rate-limiter.ts`:

```typescript
export async function GET(request: NextRequest) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:list', async () => {
    // ... your handler
  });
}
```

### Audit Logging

Log important actions for GDPR/SOC2 compliance:

```typescript
import { logDashboardAction, AuditAction } from '@/lib/audit';

await logDashboardAction(user.id, AuditAction.DASHBOARD_CREATE, dashboard.id, { title });
```

---

## Adding a New Widget Type

1. Create the renderer in `src/components/widgets/YourWidget.tsx`
2. Export it from `src/components/widgets/index.ts`
3. Add the type to the widget type map in `DashboardCanvas.tsx`
4. Add template instances to `src/lib/data/widget-library.ts` (or TEMPLATE_SCHEMAS)
5. Update the AI system prompt in `src/lib/ai/prompts.ts` to include the new type

---

## Testing

### E2E Tests (Playwright)

```bash
npm run test:e2e              # Run all E2E tests locally (starts dev server)
npm run test:e2e:ci           # Run with chromium only (CI mode)
npm run test:e2e:prod         # Run production health checks against live site
```

Tests live in `e2e/`:
- `smoke.spec.ts` — Health check, page rendering, basic navigation
- `api-integration.spec.ts` — API response contracts and edge cases
- `production-health.spec.ts` — SSL, security headers, response time

### Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test('descriptive test name', async ({ request }) => {
  const res = await request.get('/api/your-endpoint');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('expectedKey');
});
```

---

## Deployment

### Local Deploy (via Tailscale SSH)

```bash
./deploy.sh                        # Quick deploy
./scripts/ec2-deploy.sh            # Full setup (first time)
```

### Production Details

- **URL**: https://dashboards.jeffcoy.net
- **Host**: EC2 (`jeffreycoy@autoqa` via Tailscale)
- **Process**: systemd unit `insighthub.service`
- **Proxy**: Nginx with Let's Encrypt SSL
- **Port**: 3001 (Next.js standalone)

### Useful Commands

```bash
# View live logs
ssh jeffreycoy@autoqa 'sudo journalctl -u insighthub -f'

# Check service status
ssh jeffreycoy@autoqa 'sudo systemctl status insighthub'

# Restart
ssh jeffreycoy@autoqa 'sudo systemctl restart insighthub'

# Database backup
./scripts/backup-db.sh

# Health check
./scripts/monitor-health.sh
```

---

## Code Style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **Tailwind CSS v4** — utility-first, dark-first glassmorphism design
- **CSS Variables** — colors defined as `--text-primary`, `--bg-card`, etc. in `globals.css`
- **Lucide React** for all icons
- **No comments** unless explaining non-obvious business logic
- **Imports** — always use `@/` path alias (maps to `src/`)

---

## Common Gotchas

1. **SQLite, not PostgreSQL** — No `Json` columns, no `enum` types, no `@db.*` annotations. Use `String` + `JSON.stringify/parse`.
2. **Prisma client stale** — After schema changes, if types are wrong: `npm run db:generate`
3. **Dev mode bypass** — `NEXT_PUBLIC_DEV_MODE=true` skips auth entirely. Never set this in production.
4. **Widget config in JSON** — Widgets live inside `DashboardVersion.schema` JSON, not as separate DB rows.
5. **Tags are comma-separated strings** — `"tag1,tag2,tag3"` not `["tag1", "tag2"]`
6. **Glossary YAML is canonical** — Edit `glossary/terms.yaml`, then run `npm run glossary:sync`
