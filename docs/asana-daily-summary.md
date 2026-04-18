
---

## Quick Stats

| Metric | Count |
|--------|-------|
| Total tasks | 118 |
| Completed tasks | 47 |
| Total subtasks | 453 |
| Completed subtasks | 77 |
| **Overall progress** | **124/571 (22%)** |

---

# InsightHub — Asana Project Summary

> Generated: 2026-04-18 01:47:36
> Project GID: 1214122597260827
> [View in Asana](https://app.asana.com/0/1214122597260827)


## Untitled section

- [x] **🔗 Dashboard Sharing UI — Link, Permissions & Embed**
  - [ ] API: PATCH /api/dashboards/[id]/share — add/remove shares
  - [ ] Embed snippet generator (iframe code block)
  - [ ] Display current shares with user avatars
  - [ ] Permission selector (View / Edit / Remove)
  - [ ] Share modal — copy link with toast
  - [ ] Share button in toolbar (opens modal)
- [x] **Fix Chat 404 — Revert Invalid Model Name (claude-sonnet-4-latest)**
- [x] **Upgrade Claude Model — claude-sonnet-4-latest**
- [x] **Fix Gallery Page Crash — Tags String to Array Conversion**

## 🏗️ Foundation & Infrastructure

- [x] **Add prisma generate to postinstall Hook**
- [x] **Prisma Client Regeneration — Fix 12 Stale Type Errors**
- [x] **L0 Foundation Audit — PostgreSQL → SQLite migration**
  - [x] Write L0 decision log (docs/L0_DECISION_LOG.md)
  - [x] Verify next build passes clean
  - [x] Run prisma db push + seed
  - [x] Update seed.ts and sync-glossary.ts
  - [x] Fix all API routes for SQLite compatibility
  - [x] Update .env.local and .env.example
  - [x] Convert String[] arrays to comma-separated strings
  - [x] Replace enum types with String fields
  - [x] Convert Json fields to String with serialization layer
  - [x] Switch Prisma schema from postgresql to sqlite
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
  - [x] Verify seed data loads correctly and relationships are intact
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
- [ ] **🔐 Role-Based Access Control & Granular Data Permissions**
  - [ ] 📝 Audit: Log all permission changes
  - [ ] 🧪 Testing: Permission enforcement test suite
  - [ ] 📊 Seed: Default permission groups with sensible data category mappings
  - [ ] 🔔 UX: "Access Denied" messaging in dashboard builder
  - [ ] 👤 Admin UI: User permission assignment in User Management page
  - [ ] 🎨 Admin UI: Permission Groups management page
  - [ ] 🛡️ Server-side: Gate queryData() and API routes with permission checks
  - [ ] 🤖 AI Integration: Inject user permissions into Claude system prompt
  - [ ] 🔧 Engine: Build permission resolution engine (src/lib/auth/permissions.ts)
  - [ ] 🗄️ Database: Add PermissionGroup, UserPermissionAssignment, DataAccessRule models
  - [ ] 📋 Design: Permission Group schema & data category taxonomy
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
- [ ] **🔴 SECURITY PRIORITY: Granular Data-Level Permissions Before Wider Rollout**

## 🤖 AI & Chat System

- [ ] **🤖 AI-Assisted SQL & Query Explanation**
  - [ ] SQL assistant system prompt section with Snowflake dialect reference
  - [ ] Formula help: respond with both Sigma-style formula AND SQL equivalent
  - [ ] "Verify My Dashboard" mode — generate Snowflake SQL to cross-check widget values
  - [ ] SQL optimization suggestions (Snowflake-specific best practices)
  - [ ] Natural Language → SQL generation (not just widgets, actual queries)
  - [ ] Explain This Query: paste SQL → Claude breaks it down in plain English
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

- [x] **Widget Render Resilience — SSR/Hydration Fix + Data Source Aliases**
- [ ] **📊 Responsive Widget Rendering — Charts & Tables on All Screen Sizes**
  - [ ] Widget min-height constraints to prevent unreadable rendering
  - [ ] KPI cards: compact layout for phone (mini grid or horizontal scroll)
  - [ ] Table horizontal scroll with sticky first column
  - [ ] Chart touch tooltips: show on tap instead of hover
  - [ ] Chart responsive: reduce axis labels/ticks on small containers
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
- [ ] **Widget Detail Overlay: Click-to-Expand Drill-Down for All Widget Types**

## 🎨 Dashboard Canvas & UX

- [x] **Home Page Hero Redesign + Modal Scroll Fix**
- [x] **Widget Selection — Click-to-Select with Visual Highlight**
- [x] **Dark Theme Chart Polish — Softer Color Palette + Cursor Fix**
- [x] **Dashboard Editor UX Polish — Hover Delete, Inline Title, Resize Handle**
- [x] **🔎 Widget Data Transparency — Data Lineage Tab**
- [x] **⌨️ Keyboard Shortcuts & Power User UX**
  - [ ] Widget selection state in store (selectedWidgetId)
  - [ ] Tab — cycle through widget selection
  - [ ] ? key — shortcut help overlay modal
  - [ ] Cmd+D — duplicate selected widget
  - [ ] Arrow keys — nudge selected widget by 1 grid unit
  - [ ] Escape — deselect widget / close context menu
  - [ ] Cmd+S — trigger save
  - [ ] Delete/Backspace — remove selected widget
  - [ ] Cmd+Z / Cmd+Shift+Z — undo/redo (wire useKeyboardShortcuts to canvas)
- [ ] **⌨️ Keyboard Shortcut System — ? Overlay, Vim-Style Navigation & Command Palette**
  - [ ] Expand useKeyboardShortcuts hook to support the full registry + context scoping
  - [ ] Escape key hierarchy: overlays → modals → panels → selection → input blur
  - [ ] Tooltip shortcut hints — show keyboard shortcut in every toolbar/button tooltip
  - [ ] Command palette (⌘K) — spotlight search across dashboards, glossary, commands
  - [ ] Gallery shortcuts: j/k navigation, 1-5 tab switching, Enter to open, n to create
  - [ ] Editor shortcuts: widget select (Tab), delete (Del), duplicate (⌘D), nudge (arrows)
  - [ ] g-prefix "Go To" navigation (g+h Home, g+d Dashboards, g+g Glossary, g+n New)
  - [ ] ? Keyboard shortcuts overlay (glassmorphism modal, categorized sections)
  - [ ] Shortcut registry — declarative shortcut definitions with scope/context
  - [ ] <Kbd> component — styled keyboard key with platform-aware rendering
  - [ ] Platform detection hook (usePlatform.ts) + is-mac/is-win CSS classes
- [ ] **🏠 Landing Page & Gallery — Mobile Polish**
  - [ ] Touch target audit: all interactive elements ≥ 44px on touch devices
  - [ ] Navbar mobile: hamburger menu or bottom nav for hidden items
  - [ ] Gallery search: full-width on mobile
  - [ ] Gallery tabs: horizontal scroll with snap on mobile (or dropdown)
  - [ ] Landing page mobile layout: top-aligned hero, full-width input, larger touch targets
- [ ] **👆 Touch Interaction Support — Drag, Resize, Context Menu**
  - [ ] Scroll vs drag disambiguation on canvas
  - [ ] Touch-visible handles: show grip/resize handles permanently on touch devices
  - [ ] Virtual keyboard handling for chat input (iOS/Android)
  - [ ] Touch drag optimization: 300ms hold-to-start, larger grip handles (44px)
  - [ ] Long-press context menu (500ms hold → show menu, cancel on move)
- [ ] **📱 Responsive Editor Layout — Adaptive Canvas + Chat**
  - [ ] Editor layout: view-only mode on phone (no drag, no resize)
  - [ ] Widget Library → modal sheet on tablet/mobile
  - [ ] Toolbar responsive simplification (icon-only mode below 768px)
  - [ ] Mobile bottom nav bar (MobileTabBar.tsx) replacing top navbar
  - [ ] Widget grid responsive columns: 12 → 6 → 2 → 1 based on viewport
  - [ ] Two-mode toggle for phone: Canvas vs Chat (full-screen each)
  - [ ] Chat panel → slide-over drawer mode for tablet (< 1024px)
  - [ ] useViewport() hook: breakpoint detection via ResizeObserver
- [ ] **🖥️ Desktop Polish — Mac & Windows Browser Consistency**
  - [ ] Cross-browser testing pass: Chrome, Safari, Firefox, Edge
  - [ ] Context menu edge-awareness (right edge, bottom edge, Windows scrollbar)
  - [ ] Font rendering audit: verify text legibility on Windows ClearType
  - [ ] Window resize: auto-collapse chat panel below 1024px width
  - [ ] Windows focus-visible ring styling (custom to match theme)
  - [ ] Glassmorphism backdrop-filter fallback for older browsers
  - [ ] Platform-aware keyboard shortcut display (⌘ on Mac, Ctrl on Windows)
  - [ ] Firefox scrollbar styling (scrollbar-width: thin, scrollbar-color)
- [ ] **🖥️📱 Cross-Platform Optimization — Desktop Excellence + Mobile/Tablet Support**
- [x] **Auto-Layout End-to-End Testing — All Cases Pass**
- [ ] **🔎 Widget Data Transparency — "Show Me the Query" on Every Widget**
  - [ ] Lineage trail: dependency tree for calculated fields (Phase 4)
  - [ ] Glossary terms referenced panel (definitions + formulas)
  - [ ] Widget data export: CSV, JSON, clipboard TSV, chart PNG/SVG
  - [ ] Data freshness indicator (timestamp + color coding)
  - [ ] "Copy Query" and "Open in SQL Editor" buttons
  - [ ] Widget header code icon → slide-out panel with SQL + raw data
- [x] **Drag Ghost Outline — Visual Feedback During Widget Drag**
- [x] **Widget Auto-Layout — Bin-Packing for AI-Generated Dashboards**
- [x] **Custom Favicon — SVG Sparkle Icon**
- [x] **OG Image — Dynamic Branded Preview Card**
- [x] **AI Prompt Cleanup — Remove Internal Phase References**
- [x] **Mobile "Best on Desktop" Notice**
- [x] **Landing Page Entrance Animations**
- [x] **OG Meta Tags + Social Preview Cards**
- [x] **UX Polish — Error Boundaries, Loading States & Empty States**
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
- [x] **⌨️ Keyboard shortcuts — Phase 1 (basic: undo/redo/save/search/chat) ✅**
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

- [x] **Gallery Bug Fixes — Layout Shift, List View, Template Loading**
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
  - [x] Delete dashboard + right-click context menu in gallery
  - [x] "Create New Dashboard" card in gallery grid
  - [ ] Favorites system (star dashboards)
  - [ ] Recently viewed section
  - [x] Toggle between card view (thumbnails) and list view
  - [x] Sort by: recently updated, most viewed, alphabetical
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
- [ ] **Glossary → Widget Links: Browse & Add Relevant Widgets from Glossary Terms**

## 💾 Data Layer

- [ ] **📐 Visual Query Builder — Sigma-Style No-Code Data Exploration**
  - [ ] Join builder: drag second table, auto-suggest join conditions
  - [ ] Save visual query as widget with restorable drag-and-drop state
  - [ ] Visual-to-SQL transpiler (src/lib/data/visual-to-sql.ts)
  - [ ] "View SQL" toggle showing generated query
  - [ ] Live results preview with debounced updates
  - [ ] Formula function reference panel (searchable, categorized)
  - [ ] Formula bar with Sigma-style expressions (Sum([col]), CountIf, etc.)
  - [ ] Visual Group By, Aggregate, Filter, Sort, Limit operations
  - [ ] Column picker: drag columns from schema sidebar into query canvas
- [ ] **🧪 Query Playground — Interactive Scratch Pad**
  - [ ] Share playground sessions via link + fork capability
  - [ ] "Promote to Widget" — push playground query + chart to a dashboard
  - [ ] Quick chart from result set (one-click bar/line/scatter)
  - [ ] Markdown cells between queries (notebook-style documentation)
  - [ ] Query chaining: CTE/temp table output → next query input
  - [ ] Side-by-side result comparison with diff highlighting
  - [ ] Multi-tab query workspace with persistent tabs
- [ ] **🔍 Data Explorer & Schema Browser**
  - [ ] RBAC integration: hide or lock inaccessible tables/columns
  - [ ] "Open in SQL Editor" shortcut from any table/column
  - [ ] Glossary integration: link columns to glossary term definitions
  - [ ] Table relationship diagram (FK visualization)
  - [ ] Column profiling: distribution stats, histograms, top values
  - [ ] Table preview: first 100 rows in sortable/filterable data grid
  - [ ] Schema tree sidebar (sources → tables → columns with types)
- [ ] **🟣 Power User Data Experience — SQL, Visual Query Builder & Data Verification**
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
  - [x] GET /api/dashboards/[id] — get dashboard + current schema
  - [x] POST /api/dashboards — create new dashboard
  - [x] GET /api/dashboards — list (filtered by user access)

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

- [ ] **🧪 Cross-Platform Testing Matrix & Device Lab**
  - [ ] iPhone real-device test pass (Safari)
  - [ ] iPad real-device test pass (Safari, portrait + landscape)
  - [ ] Manual test script template (docs/TESTING_MATRIX.md)
  - [ ] Lighthouse mobile audit: target score > 90
  - [ ] Visual regression screenshots across breakpoints
  - [ ] Playwright responsive tests: landing, gallery, editor at 3 breakpoints
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

- [x] **Production Redeploy — L5 Model Fix + postinstall**
- [x] **BitBucket Pipelines CI/CD Configuration**
- [x] **Production Redeploy — L4 Bug Fixes + Canvas UX**
- [x] **Fix Readonly Database — Absolute DB Path + Symlink**
- [x] **Production Redeploy — L3 Brand Identity + Type Safety**
- [x] **Production Redeploy — L2 Polish Changes**
- [x] **EC2 Production Deployment — dashboards.jeffcoy.net**
  - [x] SQLite DB seed on production
  - [x] Prisma CLI env fix (prisma/.env for DATABASE_URL)
  - [x] Let's Encrypt SSL via Certbot
  - [x] Cloudflare DNS CNAME setup
  - [x] Nginx reverse proxy config
  - [x] Systemd service (insighthub.service)
  - [x] EC2 deploy script (scripts/ec2-deploy.sh)
  - [x] Next.js standalone output mode configuration
- [x] **Health check endpoint (/api/health)**
- [x] **Domain & DNS setup**
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
  - [x] Run linting + type checking on PR
  - [x] GitHub Actions or BitBucket Pipelines config
- [x] **EC2 deployment setup**
  - [ ] PostgreSQL production database setup
  - [ ] Environment variables in production (.env.production)
  - [ ] PM2 or systemd process manager for Next.js
  - [ ] SSL certificate (Let's Encrypt or ACM)
  - [ ] Configure Nginx reverse proxy to Next.js (port 3000)
  - [ ] Install Node.js, PostgreSQL, Nginx
  - [ ] Provision EC2 instance (t3.medium or similar)

## 🔮 Advanced Features (Phase 4)

- [ ] **🔄 Snowflake Cross-Validation Mode**
  - [ ] Scheduled validation with drift alerting (Phase 4)
  - [ ] Export validation report as PDF for audit/compliance
  - [ ] Dashboard-wide validation report (traffic light per widget)
  - [ ] Side-by-side diff with discrepancy highlighting and explanation
  - [ ] Auto-generate Snowflake-equivalent SQL for any InsightHub widget
  - [ ] Widget-level validation panel: InsightHub value vs Snowflake result
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
- [ ] **🔮 SQL Editor Mode — Full Query Environment for Power Users**
  - [ ] Keyboard shortcuts (⌘+Enter run, ⌘+S save, ⌘+Shift+F format)
  - [ ] Phase 1: lightweight SQL parser for sample data (alasql or sql.js)
  - [ ] Query management: save, history, fork, share, pin
  - [ ] Query → Widget pipeline ("Add to Dashboard" with auto widget type detection)
  - [ ] Schema-aware autocomplete (tables, columns, Snowflake functions, glossary snippets)
  - [ ] Save query as widget data source
  - [ ] Query execution with results preview
  - [ ] SQL syntax highlighting and autocomplete
  - [ ] Code editor component (Monaco or CodeMirror)
- [ ] **📐 Custom Calculated Fields — Sigma-Style Formulas & SQL Expressions**
  - [ ] Promote calculated field → shared field → glossary term pipeline
  - [ ] Type inference + edit-time validation with friendly errors
  - [ ] Formula-to-SQL transpiler for execution
  - [ ] Function library reference panel (categorized, searchable)
  - [ ] SQL expression mode for advanced users
  - [ ] Sigma-style formula language parser (Sum([col]), CountIf, If, DateDiff, etc.)
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
- [x] **Voice Input: Speech-to-Text for Dashboard Prompts**

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
