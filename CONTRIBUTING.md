# Contributing to InsightHub

## Quick Start

```bash
git clone <repo-url> && cd insighthub
npm install
npm run db:push && npm run db:seed
npm run dev
```

Open http://localhost:3000. Dev mode bypasses auth automatically.

## Branch Strategy

```
main                    ← production (auto-deploys on merge)
├── feat/feature-name   ← new features
├── fix/bug-description ← bug fixes
├── chore/task-name     ← maintenance, CI, docs
└── prod-readiness/*    ← infrastructure & hardening
```

- **Always branch from `main`**
- Use descriptive branch names: `feat/widget-drag-drop`, `fix/gallery-sort-crash`
- Keep branches short-lived (< 1 week)

## Pull Request Conventions

### Title format
```
feat: add drag-and-drop to dashboard canvas
fix: gallery sort crash when no dashboards exist
chore: update CI to cache Prisma client
docs: add API reference for glossary endpoints
```

Prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

### PR checklist
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] E2E tests pass (`npm run test:e2e:ci`)
- [ ] No `console.log` left in production code (use `logger` from `@/lib/logger`)
- [ ] New API endpoints have integration tests
- [ ] Accessibility checked (no new axe violations)

### Review expectations
- Self-review your diff before requesting review
- Keep PRs under 400 lines when possible
- Add screenshots/recordings for UI changes

## Code Style

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use `as const` for literal types
- No `any` — use `unknown` and narrow with type guards

### React / Next.js
- Server Components by default, `'use client'` only when needed
- App Router conventions (page.tsx, layout.tsx, loading.tsx, error.tsx)
- CSS variables from `globals.css` for theming — never hardcode colors
- Lucide React for icons

### API Routes
- Use `withApiHandler` from `@/lib/api/error-handler` for consistent error handling
- Always validate inputs at the top of the handler
- Include audit logging for mutations (`logUserAction` from `@/lib/audit`)
- Return consistent response shapes: `{ data }` or `{ error }`

### Database
- SQLite (Prisma ORM) — no JSON columns, no enums, no array fields
- Schema stored as `String`, serialized with `JSON.stringify`/`JSON.parse`
- Tags and related terms stored as comma-separated strings
- See `docs/DATABASE_MIGRATION_GUIDE.md` for PostgreSQL transition

## Testing

```bash
npm run test:e2e             # All tests
npm run test:e2e:ci          # Chromium only (CI)
npx playwright test e2e/accessibility.spec.ts  # A11y tests
```

### Test file locations
- `e2e/smoke.spec.ts` — critical path smoke tests
- `e2e/api-integration.spec.ts` — API endpoint tests
- `e2e/accessibility.spec.ts` — WCAG 2.1 AA compliance
- `e2e/production-health.spec.ts` — production monitoring (skipped in CI)

### Writing tests
- Use Playwright's `request` API for API tests (no browser needed)
- Use `page.goto()` + assertions for UI tests
- Prefer `data-testid` attributes for test selectors
- Tests should be idempotent — don't depend on previous test state

## Deployment

```bash
./deploy.sh              # Standard deploy with backup + health check
./deploy.sh --rollback   # Instant rollback to previous build
```

See `docs/OPS_RUNBOOK.md` for full operations reference.

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── api/          # API routes
│   ├── dashboard/    # Editor pages
│   ├── dashboards/   # Gallery
│   └── admin/        # Admin panel
├── components/       # React components
│   ├── chat/         # AI chat panel
│   ├── dashboard/    # Canvas, toolbar, context menu
│   ├── gallery/      # Dashboard cards, filters
│   └── widgets/      # Widget renderers + library
├── hooks/            # Custom React hooks
├── lib/              # Shared utilities
│   ├── ai/           # Claude integration, prompt building
│   ├── api/          # Error handling, response helpers
│   ├── auth/         # NextAuth config, session, permissions
│   └── data/         # Sample data, widget library
└── stores/           # Zustand state management
```

## Common Gotchas

- **SQLite, not PostgreSQL** — No `Json` columns, no `enum`, no `String[]`
- **Dev mode** bypasses auth — never deploy with `NEXT_PUBLIC_DEV_MODE=true`
- **Dashboard schema** is a stringified JSON blob, not relational tables
- **Glossary terms** canonical source is `glossary/terms.yaml`, synced to DB
- **Widget library** is static (extracted from template schemas), not yet DB-backed
- **Rate limiter** is in-memory — resets on server restart

## Getting Help

- Architecture: `docs/DEVELOPER_GUIDE.md`
- API: `docs/API_REFERENCE.md`
- Ops: `docs/OPS_RUNBOOK.md`
- DB migration: `docs/DATABASE_MIGRATION_GUIDE.md`
