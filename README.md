# iPostal1 InsightHub — AI-Powered Dashboard Builder

An internal self-service BI platform where any employee can build, customize, and share rich data dashboards using natural language. Powered by Claude AI.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (via Docker)
docker compose up -d db

# 3. Generate Prisma client
npm run db:generate

# 4. Push schema to database
npm run db:push

# 5. Copy env and add your Anthropic API key
cp .env.example .env.local
# Edit .env.local → set ANTHROPIC_API_KEY

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key Features (Phase 1)

- **AI Chat → Dashboard** — Describe what you want in plain English, Claude builds it
- **Widget System** — KPI cards, line/bar/area/pie charts, data tables, gauges
- **Undo/Redo** — Full version history with instant revert
- **Glossary** — Company-defined metric terminology that the AI enforces
- **Dark/Light Theme** — Beautiful glassmorphism design system
- **Template Gallery** — Pre-built Executive, Support, Churn, Sales dashboards
- **Sample Data** — 18 months of realistic demo data (Snowflake connector in Phase 3)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| AI | Anthropic Claude API |
| Database | PostgreSQL (Prisma ORM) |
| State | Zustand (with undo/redo) |
| Icons | Lucide React |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/chat/           # Claude AI chat endpoint
│   ├── api/data/           # Sample data query endpoint
│   ├── api/glossary/       # Glossary terms endpoint
│   ├── dashboard/[id]/     # Dashboard editor
│   ├── dashboard/new/      # New blank dashboard
│   └── glossary/           # Terminology bible browser
├── components/
│   ├── chat/               # AI chat panel
│   ├── dashboard/          # Canvas + widget renderer
│   ├── gallery/            # Dashboard card grid
│   ├── layout/             # Navbar, theme toggle
│   ├── versioning/         # Version timeline
│   └── widgets/            # KPI, charts, tables, gauge
├── lib/
│   ├── ai/                 # Claude prompts + schema patcher
│   ├── auth/               # Auth config + session helpers
│   ├── data/               # Sample data + templates
│   └── db/                 # Prisma client
├── stores/                 # Zustand stores
└── types/                  # TypeScript interfaces
glossary/
└── terms.yaml              # Canonical company glossary
docs/
└── DASHBOARD_BUILDER_SPEC.md  # Full product specification
```

## Environment Variables

See `.env.example` for all required variables. The critical one for Phase 1:

```
ANTHROPIC_API_KEY="your-key-here"
```

## Roadmap

See `docs/DASHBOARD_BUILDER_SPEC.md` Section 9 for the full phased plan.
