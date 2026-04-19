# 🔍 Sprint Review Report

**Date:** 2026-04-18 21:46
**Model:** claude-opus-4-20250514
**Base:** main
**Commits reviewed:** 11
**Files changed:** 66
**Review cost:** $2.9102

---

Confirmed: zero auth in the thumbnails API. Here is the full report.

---

# Sprint Code Review — Overnight Build (2026-04-18)

## Executive Summary

This sprint delivers significant feature depth — RBAC, folders, templates, sharing, dark-mode, onboarding — with generally clean API-layer code. However, the thumbnail API ships with **zero authentication**, allowing unauthenticated file uploads to the public filesystem, and a conditional `useRef` call violates React's rules of hooks, which will cause unpredictable crashes in production. Both are straightforward fixes. The remaining issues are lower-severity but should be addressed before or shortly after merge.

## Scorecard

| Category | Score | Notes |
|---|:---:|---|
| **Security** | **4/10** | Unauthenticated file upload endpoint; encryption key in process list |
| **Architecture** | **6/10** | Clean permission system; FolderManager anti-pattern; dead route config |
| **Error Handling** | **7/10** | Good try/catch coverage with role-based fallbacks; some silent swallows |
| **TypeScript** | **7/10** | Strict mode honored; a few `any` leaks and missing return types |
| **Testing** | **3/10** | No new test files for ~10K lines of new code |
| **UX** | **8/10** | Dark mode, keyboard nav, responsive preview, onboarding all solid |
| **Performance** | **6/10** | html2canvas on every save; no debounce on user search; CSS var won't resolve |

**Weighted average: 5.9/10**

---

## Critical Issues

```
ISSUE       C1 — Unauthenticated Thumbnail API
SEVERITY    CRITICAL
FILE        src/app/api/thumbnails/route.ts
LINES       5, 59, 108
DESCRIPTION POST, DELETE, and GET handlers have zero authentication.
            Any anonymous request can upload arbitrary base64 content
            to public/thumbnails/, delete any thumbnail by dashboardId,
            or enumerate existing thumbnails. The regex validation
            prevents path traversal but does not prevent abuse.
            Combined with the 5 MB limit, this is a disk-filling DoS
            vector and a potential hosting vector for malicious content.
FIX         Import getCurrentUser from @/lib/auth/session and call it
            at the top of each handler, returning 401 on failure.
            For DELETE, also verify the caller owns the dashboard.
SECTION     Security
```

```
ISSUE       C2 — Conditional useRef Violates Rules of Hooks
SEVERITY    CRITICAL
FILE        src/components/dashboard/DashboardCanvas.tsx
LINES       71
DESCRIPTION `const gridRef = dashboardRef || useRef<HTMLDivElement>(null);`
            When dashboardRef is truthy, JavaScript short-circuits and
            useRef is never called. React requires hooks to be called
            unconditionally and in the same order every render. This
            will cause "Rendered more/fewer hooks than expected" crashes
            whenever the dashboardRef prop changes between truthy/falsy
            across renders.
FIX         Always call useRef, then select:
              const internalRef = useRef<HTMLDivElement>(null);
              const gridRef = dashboardRef || internalRef;
SECTION     Architecture
```

```
ISSUE       C3 — Backup Encryption Key Visible in Process List
SEVERITY    CRITICAL
FILE        scripts/backup-db.sh
LINES       82
DESCRIPTION The openssl command passes the encryption key via
            -pass 'pass:$BACKUP_ENCRYPTION_KEY'. Any user on the
            system can read the key from `ps aux` or /proc/PID/cmdline
            while the command runs.
FIX         Use -pass file:<(echo "$BACKUP_ENCRYPTION_KEY") (process
            substitution) or -pass stdin and pipe the key via echo.
            Apply the same fix to scripts/restore-db.sh line 87.
SECTION     Security
```

```
ISSUE       C4 — FolderManager Called as Function, Not Component
SEVERITY    CRITICAL
FILE        src/app/gallery-client.tsx
LINES       167
DESCRIPTION `const folderManager = FolderManager({ onFoldersUpdate: fetchFolders });`
            FolderManager contains useState and useToast hooks but is
            invoked as a plain function, not rendered as <FolderManager>.
            React cannot track hook state for plain function calls.
            This will produce stale state, lost updates, and potential
            "Invalid hook call" errors depending on render timing.
FIX         Refactor FolderManager into a proper React component that
            renders its own modals and exposes imperative methods via
            useImperativeHandle + forwardRef, or extract the stateless
            logic into a non-hook utility and keep hooks in the parent.
SECTION     Architecture
```

---

## Warnings

```
ISSUE       W1 — html2canvas Cannot Resolve CSS Custom Properties
SEVERITY    MEDIUM
FILE        src/lib/thumbnail-generator.ts
LINES       20
DESCRIPTION `backgroundColor: 'var(--bg-primary)'` is passed to
            html2canvas options. html2canvas does not resolve CSS
            custom properties in its options object — it expects
            literal color values. Thumbnails will render with a
            transparent or white background regardless of theme.
FIX         Read the computed value at capture time:
              getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-primary')
SECTION     Performance
```

```
ISSUE       W2 — 'use client' + export const dynamic = 'force-dynamic'
SEVERITY    MEDIUM
FILE        src/app/onboarding/page.tsx
LINES       1, 6
DESCRIPTION Client components ignore Next.js route segment config
            exports like `dynamic`. The export is dead code that
            misleads future maintainers into thinking the route is
            force-dynamic on the server.
FIX         Remove `export const dynamic = 'force-dynamic'` or move
            server-side logic to a layout.tsx / separate server
            component.
SECTION     Architecture
```

```
ISSUE       W3 — viewport Inside metadata Export (Deprecated)
SEVERITY    MEDIUM
FILE        src/app/layout.tsx
LINES       18-25
DESCRIPTION Next.js 14+ (and 16) requires viewport config to be
            exported separately via `export const viewport: Viewport`.
            Nesting it inside `metadata` is deprecated and may be
            silently ignored, meaning mobile scaling won't work as
            configured.
FIX         Extract to a separate export:
              export const viewport: Viewport = {
                width: 'device-width',
                initialScale: 1,
                ...
              };
SECTION     Architecture
```

```
ISSUE       W4 — No Ownership Check on Thumbnail DELETE
SEVERITY    MEDIUM
FILE        src/app/api/thumbnails/route.ts
LINES       59-106
DESCRIPTION Even after adding authentication (C1), the DELETE handler
            accepts any dashboardId. A logged-in user could delete
            another user's thumbnail.
FIX         After auth, verify the caller owns or has write access to
            the dashboard before allowing deletion.
SECTION     Security
```

```
ISSUE       W5 — No Debounce on ShareModal User Search
SEVERITY    MEDIUM
FILE        src/components/gallery/ShareModal.tsx
LINES       65
DESCRIPTION The user search fires a fetch to /api/users?q= on every
            keystroke. With fast typing this creates unnecessary
            request volume and potential UI flicker.
FIX         Add a 300ms debounce (useEffect + setTimeout cleanup
            pattern or a useDebouncedValue hook).
SECTION     Performance
```

```
ISSUE       W6 — Thumbnail Generated on Every Dashboard Save
SEVERITY    MEDIUM
FILE        src/lib/thumbnail-generator.ts
LINES       1-148
DESCRIPTION html2canvas is invoked every time a dashboard is saved.
            For large dashboards with many widgets, this blocks the
            main thread for 500ms-2s. Users will perceive save lag.
FIX         Debounce or decouple: generate thumbnails on a trailing
            timer after save completes, or move to a Web Worker /
            requestIdleCallback pattern. At minimum, do not await the
            thumbnail before confirming the save to the user.
SECTION     Performance
```

```
ISSUE       W7 — No Test Coverage for New Features
SEVERITY    MEDIUM
FILE        (project-wide)
LINES       —
DESCRIPTION ~10K lines of new code across RBAC, folders, templates,
            sharing, and thumbnails with zero new test files. The
            permission resolution logic in particular (grant-union
            semantics, group inheritance, fallback behavior) is
            complex enough to warrant unit tests.
FIX         At minimum, add unit tests for:
            - src/lib/auth/permissions.ts (resolveUserPermissions,
              checkPermission, grant-union logic)
            - src/app/api/thumbnails/route.ts (after auth is added)
            - FolderManager cycle detection logic
SECTION     Testing
```

---

## Nice-to-Haves

- **N1**: `scripts/backup-db.sh` — `shred` is not available on macOS by default. Consider falling back to `gshred` (from coreutils) or `rm -P` on Darwin.
- **N2**: `src/hooks/usePlatform.ts` — `navigator.platform` is deprecated. Consider migrating to `navigator.userAgentData` with a fallback.
- **N3**: `src/lib/auth/permissions.ts` — The error fallback silently downgrades to role-based defaults. Consider logging the error to an observability sink so DB issues don't go unnoticed.
- **N4**: `src/components/gallery/ShareModal.tsx:65` — The endpoint `/api/users?q=` exists and has auth (confirmed), but there's no empty-query guard — sending `q=` will query all users.
- **N5**: `src/app/api/admin/permission-groups/route.ts` — Zod schemas are defined inline in each handler. Extract to a shared `schemas/` file for reuse and consistency.

---

## Highlights

- **Permission system** (`src/lib/auth/permissions.ts`): The grant-union resolution with clean Prisma queries and graceful fallback is well-architected. The system-group protection in the admin API is a nice touch.
- **Folder cycle detection**: The folder move API correctly checks for ancestor cycles before allowing reparenting — prevents infinite loops in the tree.
- **Keyboard navigation**: j/k cycling through gallery cards with proper focus management and aria attributes is a strong accessibility win.
- **Dark mode CSS custom properties**: Systematic use of `--bg-*`, `--text-*`, `--border-*` tokens across all new components keeps theming consistent and maintainable.
- **Audit logging**: All permission group mutations log to an audit trail — good compliance hygiene.

---

## Merge Recommendation

### ⚠️ MERGE WITH FIXES

**Block the merge on C1–C4.** These are all surgically fixable (estimated: 30–60 minutes of focused work for all four) and don't require architectural rework:

| Fix | Effort |
|---|---|
| C1: Add `getCurrentUser()` to thumbnail API handlers | ~5 min |
| C2: Unconditional `useRef` + select | ~2 min |
| C3: Switch to `-pass stdin` or process substitution in both scripts | ~5 min |
| C4: Refactor FolderManager to proper component or extract hooks | ~20 min |

After those four fixes land, the branch is safe to merge. Warnings W1–W7 should be tracked as fast-follow tickets — none are merge-blocking individually, but W7 (no tests) is a significant risk for regression in subsequent sprints.

---

## Files Reviewed

```
.agent-handoff.md                                  | 562 +++++++++++-
 .env.example                                       |   3 +
 docs/CISO_REPORT.md                                | 491 +++++++++++
 docs/CTO_REPORT.md                                 | 496 +++++++++++
 docs/SYSADMIN_REPORT.md                            | 882 +++++++++++++++++++
 docs/asana-daily-summary.md                        | 941 ++++++++++++++++-----
 docs/asana-project-state.json                      | 152 ++--
 docs/asana-task-gids.json                          |   6 +
 logs/overnight-20260418-1958.log                   | 242 ++++++
 logs/overnight-build.log                           | 213 +++++
 public/thumbnails/.gitkeep                         |   2 +
 scripts/backup-db.sh                               |  29 +-
 scripts/check-ebs-encryption.sh                    | 115 +++
 scripts/ec2-deploy.sh                              |   4 +-
 scripts/restore-db.sh                              |  47 +-
 scripts/setup-cron.sh                              |   6 +-
 src/app/admin/audit/audit-client.tsx               | 120 +--
 src/app/admin/permissions/page.tsx                 |   4 +-
 src/app/admin/permissions/permissions-client.tsx   |  80 +-
 src/app/admin/templates/page.tsx                   |  40 +
 .../admin/templates/template-management-client.tsx | 418 +++++++++
 src/app/admin/users/page.tsx                       |   4 +-
 src/app/admin/users/users-client.tsx               |  76 +-
 src/app/api/admin/permission-groups/route.ts       | 292 ++++++-
 src/app/api/dashboards/[id]/move/route.ts          |  77 ++
 src/app/api/dashboards/[id]/route.ts               |  13 +
 src/app/api/dashboards/route.ts                    |   5 +
 src/app/api/data/query/route.ts                    |  52 +-
 src/app/api/folders/[id]/route.ts                  | 251 ++++++
 src/app/api/folders/route.ts                       | 126 +++
 src/app/api/thumbnails/route.ts                    | 153 ++++
 src/app/api/user/complete-onboarding/route.ts      |  71 ++
 src/app/dashboard/[id]/editor-client.tsx           |  49 +-
 src/app/gallery-client.tsx                         | 277 +++++-
 src/app/globals.css                                | 165 +++-
 src/app/layout.tsx                                 |  17 +-
 src/app/onboarding/page.tsx                        | 201 +++++
 src/app/page.tsx                                   |  25 +
 src/app/templates/page.tsx                         |  42 +
 src/app/templates/templates-client.tsx             | 448 ++++++++++
 src/components/chat/ChatPanel.tsx                  |  15 +
 src/components/dashboard/DashboardCanvas.tsx       | 127 ++-
 src/components/dashboard/DataFreshness.tsx         |  26 +
 src/components/dashboard/WidgetQueryPanel.tsx      | 463 ++++++++++
 src/components/folders/FolderBreadcrumbs.tsx       | 101 +++
 src/components/folders/FolderManager.tsx           | 398 +++++++++
 src/components/folders/FolderTree.tsx              | 269 ++++++
 src/components/gallery/DashboardCard.tsx           |  62 +-
 src/components/gallery/DashboardThumbnail.tsx      | 102 +++
 src/components/gallery/ShareModal.tsx              | 311 +++++++
 src/components/layout/CommandPalette.tsx           |  15 +-
 src/components/layout/GlobalShortcutOverlay.tsx    |  10 +-
 src/components/layout/MobileNotice.tsx             |   8 +-
 src/components/layout/Navbar.tsx                   |   8 +-
 src/components/layout/ThemeToggle.tsx              |  10 +-
 src/components/onboarding/FirstDashboardGuide.tsx  | 214 +++++
 src/components/onboarding/TemplateGallery.tsx      | 226 +++++
 src/components/onboarding/WelcomeModal.tsx         | 304 +++++++
 src/components/providers/SessionProvider.tsx       |  16 +
 src/components/ui/Kbd.tsx                          |  16 +-
 src/hooks/useAutoSaveWithThumbnails.ts             |  95 +++
 src/hooks/usePlatform.ts                           | 119 +++
 src/lib/audit.ts                                   |   7 +
 src/lib/auth/permissions.ts                        | 260 +++++-
 src/lib/data/template-categories.ts                | 136 +++
 src/lib/thumbnail-generator.ts                     | 148 ++++
 66 files changed, 10031 insertions(+), 632 deletions(-)
```

## Commits Reviewed

```
0f83817 feat: Fix dark mode issues and implement dashboard sharing system
a8aa1f6 feat: Complete Folder System — Create, organize, and navigate dashboards in nested folders
0947c9a feat: Complete Template System — Admin promotion, /templates page, categories, and Use Template functionality
5ddf4fe feat: Fix dark mode theme issues and implement dashboard thumbnails
7f8cd03 feat: Fix dark mode theme issues and keyboard navigation
7ef9c62 feat: Complete Onboarding Flow — First-Time User Walkthrough with Templates & Guided Setup
ca752f3 feat: Enhanced Widget Data Transparency — JSON Export, SQL Editor Integration, and Glossary Terms
fa0b1ef feat: Cross-Platform Optimization — Desktop Excellence + Mobile/Tablet Support
e583ad6 feat: Desktop Polish — Mac & Windows Browser Consistency
8ade27c feat: implement comprehensive role-based access control (RBAC) system
72d5ee3 chore: pre-overnight-builder snapshot
```
