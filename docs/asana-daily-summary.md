# InsightHub — AI Dashboard Builder: Project Status

**Last synced:** 2026-04-20T00:46:38.829627
**Project GID:** 1214122597260827

## Overview
- **Tasks:** 189 (144 completed)
- **Milestones:** 0
- **Subtasks:** 511 (351 completed)
- **Sections:** 17

## Sections

### Untitled section
43/43 tasks done | 0 milestones

- ✅ **[Review Fix] Sprint 5 — Gallery folder filter, thumbnail auth, onboarding config**
- ✅ **[Review Fix] Auto-save captures stale schema — fix is incomplete**
- ✅ **[Review Fix] Unused import in About page**
- ✅ **[Review Fix] tabIndex={-1} on all interactive gallery elements hurts keyboard accessibility**
- ✅ **[Review Fix] Token streaming sends full accumulated text on every token**
- ✅ **[Review Fix] `currentSchema: z.any()` in Zod validation defeats input validation**
- ✅ **[Review Fix] SSE parsing in ChatPanel has double-parse bug that drops events**
- ✅ **[Review Fix] PrismaClient instantiated per-file with $disconnect() per-request**
- ✅ **[Review Fix] Error messages leak internal details to clients**
- ✅ **[Review Fix] Chat endpoint operates without authentication**
- ✅ **[Review Fix] CORS wildcard on SSE endpoint allows cross-origin data exfiltration**
- ✅ **[Review Fix] useDashboardStore.getState() inside setTimeout loses React context**
- ✅ **[Review Fix] `useEffect` dependency causes infinite loop potential**
- ✅ **[Review Fix] Duplicated response parsing logic (3 copies)**
- ✅ **[Review Fix] Inconsistent indentation in handleChatRequest**
- ✅ **[Review Fix] Debug console.log left in production code**
- ✅ **[Review Fix] Artificial delays in SSE stream are fake progress, not real streaming**
- ✅ **[Review Fix] Document event listeners leak on unmount during drag/resize**
- ✅ **[Review Fix] No input validation on message length or conversation history size**
- ✅ **[Review Fix] Full dashboard schema sent as GET query parameter**
- ✅ **[Review Fix] PrismaClient instantiated per-file with $disconnect() per-request**
- ✅ **[Review Fix] Chat and explain endpoints operate without authentication**
- ✅ **[Review Fix] CORS wildcard on SSE endpoint allows cross-origin data exfiltration**
- ✅ **[Review Fix] Error messages leak internal details to clients**
- ✅ **Fix audit filter dropdowns — canonical lists instead of page-derived values**
- ✅ **[Review Fix] Remove AI config status from health endpoint**
- ✅ **[Review Fix] Sanitize error messages in production**
- ✅ **[Review Fix] Add Zod validation to /api/chat route**
- ✅ **[Review Fix] Rate limiter accesses private property via bracket notation**
- ✅ **[Review Fix] Seed script revenue events can occur after customer cancellation**
- ✅ **[Review Fix] Audit filter dropdowns only show values from current page**
- ✅ **[Review Fix] Missing database index on AuditLog.createdAt**
- ✅ **[Review Fix] CSP allows 'unsafe-eval' and 'unsafe-inline' for scripts**
- ✅ **[Review Fix] getCurrentUser() called twice per rate-limited request**
- ✅ **[Review Fix] In-memory rate limiter doesn't persist across serverless instances**
- ✅ **[Review Fix] Audit log API has unprotected JSON.parse**
- ✅ **[Review Fix] All authenticated users get ADMIN role**
- ✅ **[Review Fix] CSRF middleware blocks ALL API mutations — no client code sends tokens**
- ✅ **[Review Fix] Database provider reverted to PostgreSQL — breaks existing deployment**
- ✅ **🔗 Dashboard Sharing UI — Link, Permissions & Embed** [5/6 subtasks]
- ✅ **Fix Chat 404 — Revert Invalid Model Name (claude-sonnet-4-latest)**
- ✅ **Upgrade Claude Model — claude-sonnet-4-latest**
- ✅ **Fix Gallery Page Crash — Tags String to Array Conversion**

### 🏗️ Foundation & Infrastructure
13/13 tasks done | 0 milestones

- ✅ **Overnight Sprint Merge — Config Panel, Session History, Auth Config**
- ✅ **Add prisma generate to postinstall Hook**
- ✅ **Prisma Client Regeneration — Fix 12 Stale Type Errors**
- ✅ **L0 Foundation Audit — PostgreSQL → SQLite migration** [10/10 subtasks]
- ✅ **Environment validation on app startup**
- ✅ **Page-level ErrorBoundary component**
- ✅ **Toast notification system**
- ✅ **Error handling & logging framework** [4/4 subtasks]
- ✅ **Glossary YAML → DB sync system** [4/4 subtasks]
- ✅ **Docker Compose for local development** [3/4 subtasks]
- ✅ **Environment configuration & secrets management** [4/4 subtasks]
- ✅ **Database migrations & seeding** [7/7 subtasks]
- ✅ **Sprint review — overnight build cleanup (2026-04-18)**

### 🔐 Auth & Security
10/11 tasks done | 0 milestones

- ✅ **🔴 Red Team Security Assessment — Static Code Analysis Report**
- ⬜ **🔴 Red Team Security Hardening — Audit Findings Remediation** [0/23 subtasks]
- ✅ **🔐 Metric-Level RBAC — Granular Financial Data Restrictions & Builder UX** [5/5 subtasks]
- ✅ **🔐 Data-at-Rest Encryption — Backup Encryption + Permission Hardening (CISO §6.1)**
- ✅ **Zod validation on all API routes (M-3)**
- ✅ **Session timeout & security headers** [2/3 subtasks]
- ✅ **Audit logging** [6/6 subtasks]
- ✅ **API rate limiting** [4/4 subtasks]
- ✅ **🔐 Role-Based Access Control & Granular Data Permissions** [16/16 subtasks]
- ✅ **Google OAuth integration (NextAuth.js)** [7/7 subtasks]
- ✅ **🔴 SECURITY PRIORITY: Granular Data-Level Permissions Before Wider Rollout**

### 🤖 AI & Chat System
6/7 tasks done | 0 milestones

- ⬜ **🛡️ Data Integrity Verification Pipeline — AI-Generated Dashboard Accuracy Checks** [0/5 subtasks]
- ✅ **🤖 AI-Assisted SQL & Query Explanation** [6/6 subtasks]
- ✅ **Context-aware system prompt builder** [4/4 subtasks]
- ✅ **AI change summaries for version history** [3/3 subtasks]
- ✅ **Smart AI suggestions & quick actions** [4/4 subtasks]
- ✅ **Chat session persistence** [5/5 subtasks]
- ✅ **SSE streaming for AI responses** [5/5 subtasks]

### 📊 Widget System
9/9 tasks done | 0 milestones

- ✅ **Rich Text Block Widget — Variants, Styling & Widget Library Entries**
- ✅ **Widget Render Resilience — SSR/Hydration Fix + Data Source Aliases** [1/1 subtasks]
- ✅ **📊 Responsive Widget Rendering — Charts & Tables on All Screen Sizes** [5/5 subtasks]
- ✅ **"Explain this metric" tooltip** [7/7 subtasks]
- ✅ **Widget resize handles** [4/4 subtasks]
- ✅ **Widget interactions & drill-down** [10/10 subtasks]
- ✅ **Widget click-to-edit config panel** [6/6 subtasks]
- ✅ **Complete all widget renderers** [9/9 subtasks]
- ✅ **Widget Detail Overlay: Click-to-Expand Drill-Down for All Widget Types**

### 🎨 Dashboard Canvas & UX
30/32 tasks done | 0 milestones

- ⬜ **🔀 Widget Duplication Enhancements — Option+Drag, Copy to Dashboard, View-Only Add** [0/3 subtasks]
- ✅ **PNG Export Overhaul — html-to-image + clean widget exports**
- ⬜ **📱 Deferred: Mobile & Tablet Support — Fix responsive views, favorites, gallery errors**
- ✅ **Home Page Hero Redesign + Modal Scroll Fix**
- ✅ **Widget Selection — Click-to-Select with Visual Highlight**
- ✅ **Dark Theme Chart Polish — Softer Color Palette + Cursor Fix**
- ✅ **Dashboard Editor UX Polish — Hover Delete, Inline Title, Resize Handle** [1/1 subtasks]
- ✅ **🔎 Widget Data Transparency — Data Lineage Tab**
- ✅ **⌨️ Keyboard Shortcuts & Power User UX** [9/9 subtasks]
- ✅ **⌨️ Keyboard Shortcut System — ? Overlay, Vim-Style Navigation & Command Palette** [12/12 subtasks]
- ✅ **🏠 Landing Page & Gallery — Mobile Polish** [5/5 subtasks]
- ✅ **👆 Touch Interaction Support — Drag, Resize, Context Menu** [5/5 subtasks]
- ✅ **📱 Responsive Editor Layout — Adaptive Canvas + Chat** [8/8 subtasks]
- ✅ **🖥️ Desktop Polish — Mac & Windows Browser Consistency** [8/8 subtasks]
- ✅ **🖥️📱 Cross-Platform Optimization — Desktop Excellence + Mobile/Tablet Support**
- ✅ **Auto-Layout End-to-End Testing — All Cases Pass**
- ✅ **🔎 Widget Data Transparency — "Show Me the Query" on Every Widget** [6/6 subtasks]
- ✅ **Drag Ghost Outline — Visual Feedback During Widget Drag**
- ✅ **Widget Auto-Layout — Bin-Packing for AI-Generated Dashboards** [1/1 subtasks]
- ✅ **Custom Favicon — SVG Sparkle Icon**
- ✅ **OG Image — Dynamic Branded Preview Card**
- ✅ **AI Prompt Cleanup — Remove Internal Phase References**
- ✅ **Mobile "Best on Desktop" Notice**
- ✅ **Landing Page Entrance Animations**
- ✅ **OG Meta Tags + Social Preview Cards**
- ✅ **UX Polish — Error Boundaries, Loading States & Empty States**
- ✅ **Dashboard auto-save** [4/4 subtasks]
- ✅ **Dark/light theme toggle** [4/4 subtasks]
- ✅ **⌨️ Keyboard shortcuts — Phase 1 (basic: undo/redo/save/search/chat) ✅** [7/7 subtasks]
- ✅ **Onboarding flow (first-login walkthrough)** [6/6 subtasks]
- ✅ **Version timeline sidebar** [6/6 subtasks]
- ✅ **Responsive preview mode** [3/3 subtasks]

### 📁 Gallery & Sharing
7/7 tasks done | 0 milestones

- ✅ **Gallery Bug Fixes — Layout Shift, List View, Template Loading**
- ✅ **Dashboard thumbnails (auto-generated previews)** [4/4 subtasks]
- ✅ **Template system — promote to templates** [4/4 subtasks]
- ✅ **Dashboard cloning** [3/3 subtasks]
- ✅ **Folder system** [6/6 subtasks]
- ✅ **Dashboard sharing system** [7/7 subtasks]
- ✅ **Dashboard gallery improvements** [8/8 subtasks]

### 📖 Glossary System
4/5 tasks done | 0 milestones

- ⬜ **Make template Key Insights data-driven (replace static boilerplate)**
- ✅ **Glossary reference panel in dashboard editor** [4/4 subtasks]
- ✅ **Glossary CRUD API** [4/5 subtasks]
- ✅ **Glossary browse & search UI** [5/5 subtasks]
- ✅ **Glossary → Widget Links: Browse & Add Relevant Widgets from Glossary Terms**

### 💾 Data Layer
6/9 tasks done | 0 milestones

- ⬜ **🔧 Deferred: Data Explorer — needs full QA pass before shipping**
- ⬜ **🔧 Deferred: Query Playground — needs full QA pass before shipping**
- ✅ **📐 Visual Query Builder — Sigma-Style No-Code Data Exploration** [9/9 subtasks]
- ✅ **🧪 Query Playground — Interactive Scratch Pad** [7/7 subtasks]
- ✅ **🔍 Data Explorer & Schema Browser** [7/7 subtasks]
- ✅ **🟣 Power User Data Experience — SQL, Visual Query Builder & Data Verification**
- ✅ **Snowflake connector (Phase 3)** [7/7 subtasks]
- ⬜ **Sample data query engine** [0/6 subtasks]
- ✅ **Dashboard CRUD API** [8/8 subtasks]

### ⚙️ Admin Panel
2/3 tasks done | 0 milestones

- ⬜ **System settings & configuration** [3/4 subtasks]
- ✅ **Audit log viewer** [4/4 subtasks]
- ✅ **User management page** [5/5 subtasks]

### 🧪 Testing & QA
0/5 tasks done | 0 milestones

- ⬜ **🧪 Cross-Platform Testing Matrix & Device Lab** [0/6 subtasks]
- ⬜ **Performance testing & optimization** [0/7 subtasks]
- ⬜ **E2E tests — critical user flows** [4/6 subtasks]
- ⬜ **Integration tests — API routes** [0/5 subtasks]
- ⬜ **Unit tests — core logic** [0/6 subtasks]

### 🚀 Deployment & DevOps
12/17 tasks done | 0 milestones

- ⬜ **🔒 Add automated security scanning to CI pipeline (SAST, deps, secrets)**
- ⬜ **ACTION NEEDED: Grant IAM Permissions for EBS Volume Encryption (CISO 6.1)**
- ✅ **🔒 Verify & Enable EBS Volume Encryption on EC2 (CISO §6.1)** [due 2026-04-19]
- ✅ **CI/CD: Split GitHub Actions CI and Local Tailscale SSH Deploy**
- ✅ **Production Redeploy — L5 Model Fix + postinstall**
- ✅ **BitBucket Pipelines CI/CD Configuration**
- ✅ **Production Redeploy — L4 Bug Fixes + Canvas UX**
- ✅ **Fix Readonly Database — Absolute DB Path + Symlink**
- ✅ **Production Redeploy — L3 Brand Identity + Type Safety**
- ✅ **Production Redeploy — L2 Polish Changes**
- ✅ **EC2 Production Deployment — dashboards.jeffcoy.net** [8/8 subtasks]
- ✅ **Health check endpoint (/api/health)**
- ✅ **Domain & DNS setup** [0/4 subtasks]
- ⬜ **Backup & disaster recovery** [0/3 subtasks]
- ⬜ **Production monitoring & alerting** [0/6 subtasks]
- ⬜ **CI/CD pipeline** [2/6 subtasks]
- ✅ **EC2 deployment setup** [0/7 subtasks]

### 🔮 Advanced Features (Phase 4)
0/13 tasks done | 0 milestones

- ⬜ **🔧 Deferred: Visual Query Builder — needs full QA pass before shipping**
- ⬜ **🔄 Snowflake Cross-Validation Mode** [0/6 subtasks]
- ⬜ **"Ask about this data" — contextual AI queries** [0/3 subtasks]
- ⬜ **API access (programmatic dashboard creation)** [0/3 subtasks]
- ⬜ **Scheduled dashboard snapshots & email digests** [0/4 subtasks]
- ⬜ **Dashboard embedding (iframe mode)** [0/4 subtasks]
- ⬜ **🔮 SQL Editor Mode — Full Query Environment for Power Users** [0/9 subtasks]
- ⬜ **📐 Custom Calculated Fields — Sigma-Style Formulas & SQL Expressions** [0/9 subtasks]
- ⬜ **Dashboard alerts & notifications** [0/4 subtasks]
- ⬜ **Natural language filtering** [0/3 subtasks]
- ⬜ **Collaborative editing (real-time)** [0/4 subtasks]
- ⬜ **Dashboard comments & annotations** [0/3 subtasks]
- ⬜ **🎙️ Voice Input: Whisper API Speech-to-Text** [5/8 subtasks]

### 📝 Documentation
1/3 tasks done | 0 milestones

- ✅ **README and project setup** [6/6 subtasks]
- ⬜ **Developer documentation** [0/7 subtasks]
- ⬜ **User documentation / help center** [0/6 subtasks]

### TO SORT
0/3 tasks done | 0 milestones

- ⬜ **Work together with Cascade so that it asks me to guess at some more (at least generally) accurate numbers about the business. See what things would be most important to guess at to get closer to accurate company data. Definitely not accurate, just trending in the right direction so people aren't totally thrown off by numbers that are just pulled out of a hat.**
- ⬜ **Add "Presentation" Mode so that people can easily share their screens in a meeting and still get the interactive benefits**
- ⬜ ****

### 🎯 Jeff — Action Needed
1/9 tasks done | 0 milestones

- ⬜ **📱 ACTION: Real Device Testing (iPhone & iPad)**
- ⬜ **🗄️ DECIDE: Backup & Disaster Recovery Strategy**
- ⬜ **📈 INPUT: Provide Ballpark Business Numbers for Seed Data**
- ⬜ **🏷️ DECIDE: Which Metrics Are Financially Sensitive?**
- ⬜ **🌐 DECIDE: Final Production Domain**
- ⬜ **📊 ACTION: Provide Datadog API Key & DD_SITE**
- ⬜ **📧 DECIDE: Email Provider for Notifications**
- ⬜ **🔑 ACTION: Deploy OPENAI_API_KEY to EC2 Production**
- ✅ **🔒 URGENT: Verify & Enable EBS Volume Encryption** [due 2026-04-19]

### Untitled section
0/0 tasks done | 0 milestones

