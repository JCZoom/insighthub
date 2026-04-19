# InsightHub — AI-Powered Dashboard Builder

An internal self-service BI platform where any employee can build, customize, and share rich data dashboards using natural language. Powered by Claude AI.

**Live:** [dashboards.jeffcoy.net](https://dashboards.jeffcoy.net)

---

## Quick Start

```bash
# 1. Install dependencies (also runs prisma generate via postinstall)
npm install

# 2. Copy env and add your Anthropic API key
cp .env.example .env.local
# Edit .env.local → set ANTHROPIC_API_KEY

# 3. Push schema + seed sample data
npm run db:push
npm run db:seed

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Dev mode auto-logs you in as admin — no OAuth setup needed.

> **No Docker, no PostgreSQL, no external services.** SQLite runs in-process. Just `npm install` and go.

## Key Features

- **AI Chat → Dashboard** — Describe what you want in plain English, Claude builds it
- **Widget System** — KPI cards, line/bar/area/pie charts, data tables, gauges, text blocks
- **Drag-and-Drop** — Move and resize widgets on a 12-column grid with arrow key nudging
- **Undo/Redo** — Full version history with instant revert
- **Auto-Save & Thumbnails** — Dashboards save automatically with generated preview thumbnails
- **Widget Library** — Searchable library of reusable widget templates
- **"Explain This Metric"** — AI-powered explanations for any widget (what it shows, how it's calculated, why it matters)
- **Export** — PNG, SVG, and CSV export for dashboards and individual widgets
- **Glossary** — Company-defined metric terminology that the AI enforces
- **Dark/Light Theme** — Glassmorphism design system
- **Template Gallery** — Pre-built Executive, Support, Churn, Sales dashboards
- **Folders** — Organize dashboards into folders with drag-and-drop
- **Dashboard Sharing** — Share via link with configurable permissions
- **Dashboard Cloning** — Save As to duplicate and fork dashboards
- **Command Palette** — ⌘K to quickly navigate anywhere or run actions
- **Keyboard Shortcuts** — Full shortcut system with contextual ? overlay
- **Voice Input** — Speech-to-text via OpenAI Whisper for hands-free prompting
- **Admin Panel** — User management, role assignment, AI model config, system settings, audit log viewer
- **Role-Based Access** — Category-level data permissions with permission groups
- **Sample Data** — 18 months of realistic demo data (Snowflake connector in Phase 3)
- **Audit Logging** — GDPR/SOC2-ready action logging

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| AI | Anthropic Claude Sonnet 4 |
| Database | SQLite via Prisma 5 |
| State | Zustand (with undo/redo history) |
| Icons | Lucide React |
| Testing | Playwright (E2E) |
| CI | GitHub Actions |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/chat/           # Claude AI chat endpoint
│   ├── api/dashboards/     # Dashboard CRUD + sharing + versioning
│   ├── api/data/           # Sample data query endpoint
│   ├── api/glossary/       # Glossary terms CRUD + search
│   ├── api/health/         # Health check (DB, memory, uptime)
│   ├── api/widgets/        # Widget library search + fork + publish
│   ├── admin/              # Admin panel (users, settings, audit, permissions)
│   ├── dashboard/[id]/     # Dashboard editor
│   ├── dashboard/new/      # New blank dashboard
│   └── gallery/            # Dashboard gallery (My, Shared, Company, Templates)
├── components/
│   ├── chat/               # AI chat panel + streaming
│   ├── dashboard/          # Canvas, toolbar, context menu, drag-and-drop, config panel
│   ├── data/               # SQL editor, visual query builder, schema explorer (deferred)
│   ├── gallery/            # Dashboard card grid, thumbnails, folders
│   ├── glossary/           # Glossary panel, widget linking
│   ├── layout/             # Navbar, theme toggle, command palette, mobile notice
│   ├── versioning/         # Version timeline
│   ├── ui/                 # Toast, Kbd, shared UI primitives
│   └── widgets/            # KPI, Bar, Line, Area, Pie, Table, Gauge, Text, Library
├── hooks/                  # useAutoSave, useKeyboardShortcuts, useSpeechToText, useViewport
├── lib/
│   ├── ai/                 # Claude prompts + schema patcher + change summarizer
│   ├── auth/               # Auth config + session helpers + permissions
│   ├── data/               # Sample data, templates, widget library, Snowflake provider
│   ├── snowflake/          # Snowflake connector, query executor, schema, security (Phase 3)
│   ├── redis/              # Redis caching layer (Phase 3)
│   ├── settings.ts         # System settings (AI models, feature flags)
│   ├── export-utils.ts     # PNG/SVG/CSV export
│   ├── logger.ts           # Structured logging (JSON in prod, human in dev)
│   ├── audit.ts            # Audit logging helpers
│   ├── rate-limiter.ts     # Sliding window rate limiter
│   └── env.ts              # Environment validation
├── stores/                 # Zustand dashboard store (undo/redo, drag, AI state)
└── types/                  # TypeScript interfaces
e2e/                        # Playwright E2E tests
glossary/
└── terms.yaml              # Canonical company glossary (synced to DB)
deploy.sh                     # Quick deploy via Tailscale SSH (backup + health check + auto-rollback)
scripts/
├── ec2-deploy.sh           # Full EC2 deployment script (first-time setup)
├── backup-db.sh            # SQLite backup (local + remote)
├── restore-db.sh           # Database restore with rollback
├── monitor-health.sh       # Production health monitor
├── sync-glossary.ts        # YAML → DB glossary sync
├── sync_asana_state.py     # Sync Asana project state
└── create_asana_project.py # Initialize Asana project structure
```

## Environment Variables

See `.env.example` for all variables. Required for Phase 1:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` for SQLite |
| `NEXTAUTH_SECRET` | Yes | Random string for session signing |
| `ANTHROPIC_API_KEY` | For AI | Claude API key |
| `NEXT_PUBLIC_DEV_MODE` | Dev only | `true` to bypass OAuth |

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Push Prisma schema to SQLite
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio
npm run glossary:sync    # Sync terms.yaml → database
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:prod    # Run health checks against production
./deploy.sh              # Deploy to production (with auto-rollback)
./deploy.sh --rollback   # Instant rollback to previous build
```

## Deployment

**Production:** EC2 at `dashboards.jeffcoy.net` via Tailscale SSH.

```bash
# Deploy latest code
./deploy.sh

# Or full EC2 setup (first time)
./scripts/ec2-deploy.sh
```

See `scripts/ec2-deploy.sh` for full infrastructure setup (systemd, Nginx, SSL).

### Database Backup

```bash
./scripts/backup-db.sh              # Backup + download
./scripts/backup-db.sh --list       # List backups
./scripts/restore-db.sh --latest    # Restore most recent
```

### Monitoring

```bash
./scripts/monitor-health.sh          # One-shot health check
./scripts/monitor-health.sh --watch  # Continuous monitoring
./scripts/monitor-health.sh --json   # JSON output for log aggregation
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
1. **TypeScript** + **ESLint** — parallel quality gates
2. **Build** — Prisma generate → DB seed → Next.js build
3. **E2E Tests** — Playwright smoke tests against built app

Deploy is manual via `./deploy.sh` (requires Tailscale VPN).

## Architecture

```
User types message → ChatPanel → /api/chat → Claude Sonnet 4
                                                    ↓
                                            Schema patches (JSON)
                                                    ↓
Canvas re-renders ← Zustand store ← Schema patcher applies patches
```

- **DashboardSchema** is a JSON blob stored in `DashboardVersion.schema`
- AI returns **patches** (`add_widget`, `update_widget`, `remove_widget`, `use_widget`), not full schemas
- Widget library is injected into the system prompt so Claude knows available templates
- Glossary terms are injected so Claude uses correct business terminology

## Roadmap

See `docs/DASHBOARD_BUILDER_SPEC.md` for the full product specification and phased plan.
Asana project: [InsightHub Board](https://app.asana.com/0/1214122597260827)
