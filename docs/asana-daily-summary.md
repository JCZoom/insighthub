
---

## Quick Stats

| Metric | Count |
|--------|-------|
| Total tasks | 67 |
| Completed tasks | 12 |
| Total subtasks | 307 |
| Completed subtasks | 49 |
| **Overall progress** | **61/374 (16%)** |

---

# InsightHub — Asana Project Summary

> Generated: 2026-04-17 20:39:54
> Project GID: 1214122597260827
> [View in Asana](https://app.asana.com/0/1214122597260827)


## Untitled section


## 🏗️ Foundation & Infrastructure

- [x] **Environment validation on app startup**
- [x] **Page-level ErrorBoundary component**
- [x] **Toast notification system**
- [x] **Error handling & logging framework**
  - [x] Client-side error reporting (toast notifications)
  - [x] Global error handler middleware for API routes
  - [x] Structured JSON logging for API routes
  - [x] Add React error boundaries for widget crashes
- [x] **Glossary YAML → DB sync system**
  - [x] Validate YAML schema before importing
  - [x] Run sync on deploy (npm run glossary:sync)
  - [x] Upsert logic — match by term name, update definition/formula
  - [x] Build scripts/sync-glossary.ts CLI tool
- [x] **Docker Compose for local development**
  - [x] README instructions for docker compose up
  - [x] Health check scripts
  - [ ] Redis container for query caching (Phase 3)
  - [x] PostgreSQL container with persistent volume
- [ ] **Environment configuration & secrets management**
  - [x] Set up environment validation on app startup
  - [x] Create .env.example with all required variables documented
  - [ ] Add Snowflake connection stubs for Phase 3
  - [ ] Add Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] **Database migrations & seeding**
  - [ ] Verify seed data loads correctly and relationships are intact
  - [ ] Generate 200 sales pipeline deals
  - [ ] Generate product usage data with weekday-heavy patterns
  - [ ] Generate monthly revenue events (~3-5% churn)
  - [ ] Generate 50,000 support tickets with seasonal patterns
  - [x] Build seed script (scripts/seed-sample-data.ts) with 5,000 customers
  - [x] Run prisma migrate dev to create all tables

## 🔐 Auth & Security

- [ ] **Session timeout & security headers**
  - [ ] CSRF token validation on mutations
  - [ ] Add security headers via Next.js middleware (CSP, HSTS, etc)
  - [ ] Configure 8-hour session expiry
- [ ] **Audit logging**
  - [ ] Admin audit log viewer page (/admin/audit)
  - [ ] Log: user.login, user.role_change
  - [ ] Log: glossary.create, glossary.update, glossary.delete
  - [ ] Log: version.save, version.revert
  - [ ] Log: dashboard.create, dashboard.share, dashboard.delete
  - [ ] AuditLog model already in Prisma — wire up creation
- [ ] **API rate limiting**
  - [ ] Return 429 with Retry-After header
  - [ ] Dashboard CRUD: 60 requests/min per user
  - [ ] Chat API: 30 requests/min per user
  - [ ] Implement sliding window rate limiter
- [ ] **Role-based access control (RBAC)**
  - [ ] Creator+ check for dashboard creation
  - [ ] Admin-only routes protection (/admin/*)
  - [ ] UI conditional rendering based on user role
  - [ ] API middleware to check role before processing requests
  - [ ] Permission helper functions (src/lib/utils/permissions.ts)
- [ ] **Google OAuth integration (NextAuth.js)**
  - [ ] Redirect flow — login → onboarding (first visit) or gallery
  - [ ] Login page with Google sign-in button
  - [ ] Session persistence with JWT strategy
  - [ ] Map roles from DB (default VIEWER, admin list for ADMIN)
  - [ ] Auto-create User record on first login
  - [ ] Domain restriction — only @uszoom.com emails allowed
  - [ ] Configure NextAuth.js with Google provider

## 🤖 AI & Chat System

- [ ] **Context-aware system prompt builder**
  - [ ] Include widget library listings for use_widget patches
  - [ ] Filter available data sources by user role/permissions
  - [ ] Inject current dashboard schema
  - [ ] Inject full glossary into system prompt
- [ ] **AI change summaries for version history**
  - [ ] Show in version timeline sidebar
  - [ ] Store changeNote in DashboardVersion record
  - [ ] Generate change note on each patch application
- [ ] **Smart AI suggestions & quick actions**
  - [ ] "Explain this metric" button on widgets → AI explains the calculation
  - [ ] "Add a filter by region" type suggestions based on current schema
  - [ ] Quick action buttons below AI responses
  - [ ] Post-generation suggestions ("you might also want NRR and LTV")
- [ ] **Chat session persistence**
  - [ ] API: GET /api/chat/sessions/[id] — get session + messages
  - [ ] API: GET /api/chat/sessions — list user sessions
  - [ ] Load session history when opening dashboard editor
  - [ ] Save each ChatMessage to DB (user + assistant)
  - [ ] Create/update ChatSession on conversation start
- [ ] **SSE streaming for AI responses**
  - [ ] Error recovery if stream disconnects
  - [ ] Progress indicator while AI is generating
  - [ ] Client-side EventSource handling in ChatPanel
  - [ ] Stream partial JSON patches as they're generated
  - [ ] Convert /api/chat to SSE endpoint (ReadableStream)

## 📊 Widget System

- [ ] **"Explain this metric" tooltip**
  - [ ] Power user toggle to show underlying query
  - [ ] Popover showing definition, formula, data source
  - [ ] Info icon on widget header
  - [ ] Link widgets to glossaryTermIds
- [ ] **Widget resize handles**
  - [ ] Update store with new dimensions on resize end
  - [ ] Minimum size constraints per widget type
  - [ ] Snap to grid columns during resize
  - [ ] Resize handles on widget edges (visible on hover)
- [ ] **Widget interactions & drill-down**
  - [ ] Full-screen mode for any widget
  - [ ] Export widget data as CSV
  - [ ] Export widget as PNG (html2canvas)
  - [ ] Click a bar/slice to filter entire dashboard
  - [ ] Hover tooltips showing exact values on all chart types
- [ ] **Widget click-to-edit config panel**
  - [ ] Live preview as settings change
  - [ ] Threshold editor (value + color + label)
  - [ ] Visual tab: color scheme, legend, grid, labels, stacked
  - [ ] Data tab: source, filters, aggregation, groupBy
  - [ ] General tab: title, subtitle, type selector
  - [ ] WidgetEditor component with tabbed interface
- [ ] **Complete all widget renderers**
  - [ ] Divider widget (visual separator)
  - [ ] ImageWidget (embedded image/logo)
  - [x] MetricRow widget (horizontal row of KPIs)
  - [x] Funnel widget
  - [ ] PivotTable widget
  - [ ] Heatmap widget
  - [x] ScatterPlot widget
  - [x] StackedBar widget
  - [x] DonutChart widget (variation of PieChart with inner radius)

## 🎨 Dashboard Canvas & UX

- [x] **Dashboard auto-save**
  - [x] Save version to DB via API
  - [ ] Unsaved changes warning on navigate away
  - [x] isDirty indicator in toolbar
  - [x] Debounced auto-save (30s after last change)
- [x] **Dark/light theme toggle**
  - [x] System preference detection as default
  - [x] Persist theme preference in localStorage
  - [x] CSS variables for dark and light palettes
  - [x] ThemeToggle component in navbar
- [x] **Keyboard shortcuts**
  - [ ] Keyboard shortcuts help modal (?)
  - [x] / → focus chat input
  - [x] Cmd+K → search dashboards
  - [x] Ctrl+S / Cmd+S → save version
  - [x] Ctrl+Shift+Z / Cmd+Shift+Z → redo
  - [x] Ctrl+Z / Cmd+Z → undo
  - [ ] Global keyboard shortcut handler
- [ ] **Onboarding flow (first-login walkthrough)**
  - [ ] Auto-redirect first-time users to onboarding
  - [ ] Store onboarding_completed flag in User record
  - [ ] Template gallery prompt with 4-6 pre-built examples
  - [ ] Guided first dashboard prompt in chat
  - [ ] Welcome modal with animated walkthrough slides
  - [ ] Create /onboarding page
- [ ] **Version timeline sidebar**
  - [ ] Visual diff overlay showing added/removed/modified widgets
  - [ ] Named checkpoints ("Before Q4 changes")
  - [x] One-click revert to any previous version
  - [x] Show timestamp, change note, author for each version
  - [x] Fetch version history from API
  - [x] VersionTimeline component (already scaffolded)
- [ ] **Responsive preview mode**
  - [ ] Widget stacking on smaller viewports
  - [ ] Responsive grid layout adaptation
  - [ ] Preview toggle buttons in toolbar (desktop/tablet/mobile)

## 📁 Gallery & Sharing

- [ ] **Dashboard thumbnails (auto-generated previews)**
  - [ ] Fallback placeholder for dashboards without thumbnails
  - [ ] Store in public/ or S3
  - [ ] Generate thumbnail on save
  - [ ] Server-side screenshot generation (Puppeteer or html2canvas)
- [ ] **Template system — promote to templates**
  - [ ] Template categories/tags
  - [ ] "Use this template" creates a clone for the user
  - [ ] /templates page showing all template dashboards
  - [ ] Admin action to mark dashboard as template
- [ ] **Dashboard cloning**
  - [ ] "Duplicate" option in context menu and gallery card
  - [x] Clone current version schema with new IDs
  - [x] API: POST /api/dashboards/[id]/duplicate
- [ ] **Folder system**
  - [ ] Breadcrumb navigation
  - [ ] Folder visibility (private/team/public)
  - [ ] Drag dashboards between folders
  - [ ] Create/rename/delete folders
  - [ ] FolderTree component with nested navigation
- [ ] **Dashboard sharing system**
  - [ ] Email notification on share (optional)
  - [ ] Publish to gallery (make public to all authenticated users)
  - [ ] "Shared with Me" gallery section
  - [x] API: POST /api/dashboards/[id]/share
  - [x] Permission dropdown (View / Comment / Edit)
  - [ ] Share modal — search and select users
- [ ] **Dashboard gallery improvements**
  - [ ] Favorites system (star dashboards)
  - [ ] Recently viewed section
  - [ ] Toggle between card view (thumbnails) and list view
  - [ ] Sort by: recently updated, most viewed, alphabetical
  - [ ] Filter by owner, department, tag, date range
  - [ ] Full-text search across titles, descriptions, tags

## 📖 Glossary System

- [ ] **Glossary reference panel in dashboard editor**
  - [ ] Widget hover shows linked term tooltips
  - [ ] Link terms to widgets (glossaryTermIds)
  - [ ] Search/browse terms inline
  - [ ] Glossary panel toggle in editor toolbar
- [x] **Glossary CRUD API**
  - [x] GET /api/glossary/search?q= — full-text search
  - [x] DELETE /api/glossary/[id] — remove term (Admin)
  - [x] PUT /api/glossary/[id] — update term (Admin)
  - [x] POST /api/glossary — add term (Admin)
  - [ ] GET /api/glossary — list all terms
- [ ] **Glossary browse & search UI**
  - [ ] Approved by / last reviewed metadata
  - [ ] Related terms links
  - [ ] TermCard component showing definition, formula, data source
  - [ ] Category filter pills
  - [ ] /glossary page with searchable term listing

## 💾 Data Layer

- [ ] **Snowflake connector (Phase 3)**
  - [ ] Row-level security for PII/financial data
  - [ ] Data-level permission enforcement (sensitive data tags)
  - [ ] Data source browser — table/view/column explorer
  - [ ] Query caching layer (Redis) to avoid hammering Snowflake
  - [ ] Query execution with parameterized queries (no SQL injection)
  - [ ] Connection pool management
  - [ ] Snowflake Node.js SDK integration
- [ ] **Sample data query engine**
  - [ ] API: GET /api/data/sources/[name]/schema (columns + types)
  - [ ] API: GET /api/data/sources (list available tables)
  - [ ] API: POST /api/data/query
  - [ ] Support aggregation, groupBy, orderBy, limit, filters
  - [ ] Sample data adapter using in-memory generated data
  - [ ] Query engine abstraction (src/lib/data/query-engine.ts)
- [x] **Dashboard CRUD API**
  - [x] POST /api/dashboards/[id]/revert/[versionId] — revert
  - [x] POST /api/dashboards/[id]/versions — save new version
  - [x] GET /api/dashboards/[id]/versions — list versions
  - [x] DELETE /api/dashboards/[id] — soft-delete (archive)
  - [x] PUT /api/dashboards/[id] — update metadata
  - [ ] GET /api/dashboards/[id] — get dashboard + current schema
  - [ ] POST /api/dashboards — create new dashboard
  - [ ] GET /api/dashboards — list (filtered by user access)

## ⚙️ Admin Panel

- [ ] **System settings & configuration**
  - [ ] Feature flags for Phase 2/3 features
  - [ ] Data source connection management
  - [ ] AI model selection (Claude model version)
  - [ ] Default user role for new signups
- [ ] **Audit log viewer**
  - [ ] Export audit log as CSV
  - [ ] API: GET /api/admin/audit with query params
  - [ ] Filterable table: user, action, resource type, date range
  - [ ] /admin/audit page
- [ ] **User management page**
  - [ ] API: PUT /api/admin/users/[id]/role
  - [ ] API: GET /api/admin/users
  - [ ] User activity summary (dashboards created, last login)
  - [ ] Role dropdown to change user roles
  - [ ] /admin page with user list table

## 🧪 Testing & QA

- [ ] **Performance testing & optimization**
  - [ ] Virtual scrolling for data tables
  - [ ] Lazy-load widgets below the fold
  - [ ] Search results: < 200ms
  - [ ] Widget data refresh: < 3s per widget
  - [ ] AI response (first token): < 1s via SSE
  - [ ] Dashboard canvas render: < 2s (all widgets)
  - [ ] Gallery load: < 1s
- [ ] **E2E tests — critical user flows**
  - [ ] Test: Glossary → Add term → Verify appears in AI prompt
  - [ ] Test: Admin → Change user role → Verify permissions
  - [ ] Test: Share dashboard → Verify recipient can view
  - [ ] Test: Open existing dashboard → Edit via chat → Undo → Redo
  - [ ] Test: Login → Gallery → New Dashboard → Chat → Save
  - [ ] Set up Playwright
- [ ] **Integration tests — API routes**
  - [ ] Test /api/data/query with sample data
  - [ ] Test /api/admin routes (role enforcement)
  - [ ] Test /api/glossary CRUD
  - [ ] Test /api/dashboards CRUD
  - [ ] Test /api/chat route (mock Claude responses)
- [ ] **Unit tests — core logic**
  - [ ] Test dashboard store actions (undo/redo, widget CRUD)
  - [ ] Test sample data generation
  - [ ] Test glossary sync logic
  - [ ] Test permissions.ts (role-based checks)
  - [ ] Test schema-patcher.ts (all patch types)
  - [ ] Set up Jest/Vitest for the project

## 🚀 Deployment & DevOps

- [x] **Health check endpoint (/api/health)**
- [ ] **Domain & DNS setup**
  - [ ] Update NEXTAUTH_URL for production domain
  - [ ] SSL certificate provisioning
  - [ ] DNS A/CNAME records pointing to EC2
  - [ ] Register subdomain (e.g., insighthub.uszoom.com or insighthub.jeffcoy.net)
- [ ] **Backup & disaster recovery**
  - [ ] Backup verification/restoration test procedure
  - [ ] Point-in-time recovery documentation
  - [ ] Automated daily PostgreSQL backups to S3
- [ ] **Production monitoring & alerting**
  - [ ] Disk space / memory alerts
  - [ ] Database connection pool monitoring
  - [ ] Performance monitoring (Web Vitals)
  - [ ] Error tracking (Sentry or similar)
  - [ ] Uptime monitoring (e.g., UptimeRobot)
  - [ ] Health check endpoint (/api/health)
- [ ] **CI/CD pipeline**
  - [ ] Database migration on deploy
  - [ ] Manual promotion to production
  - [ ] Auto-deploy to staging on merge to develop
  - [ ] Run unit + integration tests on PR
  - [ ] Run linting + type checking on PR
  - [ ] GitHub Actions or BitBucket Pipelines config
- [ ] **EC2 deployment setup**
  - [ ] PostgreSQL production database setup
  - [ ] Environment variables in production (.env.production)
  - [ ] PM2 or systemd process manager for Next.js
  - [ ] SSL certificate (Let's Encrypt or ACM)
  - [ ] Configure Nginx reverse proxy to Next.js (port 3000)
  - [ ] Install Node.js, PostgreSQL, Nginx
  - [ ] Provision EC2 instance (t3.medium or similar)

## 🔮 Advanced Features (Phase 4)

- [ ] **"Ask about this data" — contextual AI queries**
  - [ ] AI cross-references with other data sources
  - [ ] Send data context + question to AI
  - [ ] Right-click context menu on chart data points
- [ ] **API access (programmatic dashboard creation)**
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] Rate limiting for API consumers
  - [ ] API key management for service accounts
- [ ] **Scheduled dashboard snapshots & email digests**
  - [ ] Subscription management (weekly/monthly)
  - [ ] Email template with dashboard preview
  - [ ] Screenshot generation via Puppeteer
  - [ ] Cron job for scheduled snapshots
- [ ] **Dashboard embedding (iframe mode)**
  - [ ] Copy embed code button in share modal
  - [ ] Configurable toolbar visibility in embed mode
  - [ ] Token-based authentication for embedded views
  - [ ] Embed-specific view route (/dashboard/[id]/embed)
- [ ] **SQL editor mode for power users**
  - [ ] Save query as widget data source
  - [ ] Query execution with results preview
  - [ ] SQL syntax highlighting and autocomplete
  - [ ] Code editor component (Monaco or CodeMirror)
- [ ] **Custom calculated fields**
  - [ ] Save custom fields to schema
  - [ ] Expression parser and evaluator
  - [ ] Formula editor UI
- [ ] **Dashboard alerts & notifications**
  - [ ] Alert history and acknowledgement
  - [ ] Email/Slack notifications
  - [ ] Threshold evaluation on data refresh
  - [ ] Alert rule configuration per widget
- [ ] **Natural language filtering**
  - [ ] Filter chips showing active NL filters
  - [ ] Apply parsed filters to global/widget filters
  - [ ] NL filter parser using Claude
- [ ] **Collaborative editing (real-time)**
  - [ ] "X is editing" indicator
  - [ ] Conflict resolution for simultaneous edits
  - [ ] Cursor presence indicators
  - [ ] WebSocket server for real-time updates
- [ ] **Dashboard comments & annotations**
  - [ ] Notification when someone comments on your dashboard
  - [ ] Comment thread UI on widgets
  - [ ] Comment data model (linked to widget + position)

## 📝 Documentation

- [ ] **README and project setup**
  - [ ] Deployment instructions
  - [ ] Running locally instructions
  - [ ] Environment variables reference
  - [ ] Installation and setup steps
  - [ ] Prerequisites (Node.js, Docker, etc)
  - [ ] Project overview and feature list
- [ ] **Developer documentation**
  - [ ] Deployment runbook
  - [ ] API endpoint reference
  - [ ] Database schema reference
  - [ ] AI system prompt customization guide
  - [ ] Adding new widget types guide
  - [ ] Local development setup guide
  - [ ] Architecture overview diagram
- [ ] **User documentation / help center**
  - [ ] FAQ / troubleshooting
  - [ ] Glossary guide for admins
  - [ ] Widget types reference with examples
  - [ ] How to share and organize dashboards
  - [ ] How to create a dashboard via chat
  - [ ] Getting started guide

## TO SORT

_No items in inbox._
