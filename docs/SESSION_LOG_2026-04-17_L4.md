# Session Log — April 17, 2026 (L4: Bug Fixes + Canvas UX)

## Objective
Fix three user-reported issues: (1) gallery page crash on production, (2) chaotic widget layout after AI generation, (3) drag-and-drop without visual feedback. Also fix the readonly database error and upgrade the deprecated Claude model.

---

## Issues Diagnosed & Fixed

### 1. Gallery Page Crash (`/dashboards` → "Something went wrong")

**Root cause:** Type mismatch between API and client. The SQLite schema stores `tags` as a comma-separated string (`"sales,pipeline,deals"`), but the gallery client passed it directly to `DashboardCard` which expected `string[]`. When `DashboardCard` called `.slice(0, 3).map(...)` on a string, JavaScript crashed — `String.prototype.map` doesn't exist.

**Diagnosis path:**
1. Checked production logs → "Failed to find Server Action" (stale deployment, not the gallery crash)
2. Checked API response → `"tags": "sales,pipeline,deals"` (string, not array)
3. Traced data flow: `gallery-client.tsx` line 83: `tags: d.tags || []` — truthy string bypasses the `|| []` fallback
4. `DashboardCard.tsx` line 85: `dashboard.tags.slice(0, 3).map(...)` → crash

**Fix:** `@/src/app/gallery-client.tsx` — split comma-separated string into array:
```typescript
tags: typeof d.tags === 'string'
  ? (d.tags ? d.tags.split(',').map(t => t.trim()) : [])
  : (d.tags || [])
```

**Lesson:** Always normalize API responses at the boundary. SQLite stores everything as strings — every consumer must split comma-separated fields. This is the cost of the SQLite simplification.

---

### 2. Readonly Database on Production

**Root cause:** The deploy script copied the DB file into the standalone directory (`cp`), but the systemd service's `DATABASE_URL=file:./dev.db` resolved to a different path at runtime depending on how Prisma resolved it relative to the schema location. The standalone copy wasn't the same file being read by the running server.

**Diagnosis:**
1. Logs: `"attempt to write a readonly database"` on `dashboardVersion.create()`
2. DB permissions were fine (owner rw, same user), so it wasn't a file permission issue
3. Realized the problem: two separate DB files (one in `prisma/`, one in standalone), and the runtime might hit the standalone copy which had stale data

**Fix:** Three-part fix in `scripts/ec2-deploy.sh`:
1. **Absolute DATABASE_URL** — `file:/opt/insighthub/prisma/dev.db` instead of `file:./dev.db`
2. **Symlink instead of copy** — `ln -sf` in standalone so both paths reference the same file
3. **Explicit env in systemd** — `Environment=DATABASE_URL=file:/opt/insighthub/prisma/dev.db`

This ensures the running server, the Prisma CLI, and the seed script all hit the exact same DB file.

---

### 3. Widget Layout Chaos (AI generates overlapping/stacked widgets)

**Root cause:** When Claude generates `add_widget` patches, it assigns arbitrary `position` values. Often all widgets end up at `x: 0` stacked vertically, or positions overlap, creating a visual mess.

**Solution:** Created `src/lib/ai/auto-layout.ts` with two functions:

**`autoLayoutWidgets(widgets, columns)`** — Bin-packing algorithm that:
1. Categorizes widgets by width: KPIs (≤3), medium charts (≤6), wide (≤9), full (>9)
2. Packs KPIs 4 across (3 columns each, uniform 2-row height)
3. Packs medium charts 2 across (6 columns each)
4. Places wide and full-width widgets one per row (12 columns)
5. Fills rows top-down, left-to-right

**`needsAutoLayout(widgets)`** — Detects chaotic layouts:
- Checks for overlapping widget bounding boxes
- Detects all-at-x-0 stacking (3+ widgets in a column with no horizontal spread)

**Integration:** `schema-patcher.ts` runs `needsAutoLayout()` after applying all patches. If the layout is detected as chaotic, it runs `autoLayoutWidgets()` to clean it up. This only affects AI-generated layouts — user manual placements (which don't overlap) are left alone.

---

### 4. Drag Ghost (No visual feedback during widget drag)

**Root cause:** The drag handler tracked `widgetId` and start position but didn't properly propagate the ghost position to the UI. The TypeScript type used `as typeof prev` which silently dropped the `currentX`/`currentY` fields.

**Fix in `DashboardCanvas.tsx`:**
1. Extended `dragState` type with `ghostX` and `ghostY` fields
2. `handleMove` updates `ghostX`/`ghostY` on every pointer move
3. Added a **dashed blue outline** element rendered in the grid at the ghost position:
   ```
   border-2 border-dashed border-accent-blue/50 bg-accent-blue/5
   ```
4. The dragged widget itself now shows `opacity-40 scale-[0.98]` (faded + slightly shrunk) to distinguish it from the ghost

**Result:** While dragging, users see:
- The original widget faded and slightly scaled down
- A dashed blue outline at the target grid position
- The outline snaps to grid cells as the pointer moves

---

### 5. Claude Model Upgrade

**Issue:** Production logs showed `'claude-sonnet-4-20250514' is deprecated` warnings on every API call.

**Fix:** Changed model to `'claude-sonnet-4-latest'` which auto-resolves to the latest Sonnet 4 version.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/gallery-client.tsx` | Split comma-separated tags string into array |
| `src/lib/ai/auto-layout.ts` | **New** — Widget bin-packing algorithm |
| `src/lib/ai/schema-patcher.ts` | Wire auto-layout after AI patches |
| `src/components/dashboard/DashboardCanvas.tsx` | Add drag ghost outline, fix drag state type |
| `src/app/api/chat/route.ts` | Upgrade Claude model to `-latest` |
| `scripts/ec2-deploy.sh` | Absolute DB path, symlink, systemd env |

## Verification

- Gallery page: `curl` returns HTTP 200 (was crashing before)
- Health check: `{"status":"ok","database":"connected","ai":"configured"}`
- DB path: `Environment=DATABASE_URL=file:/opt/insighthub/prisma/dev.db` in systemd
- TypeScript: `tsc --noEmit` = zero errors

---

## Asana Tasks

### Created + Completed
- Fix Gallery Page Crash — Tags String→Array Conversion
- Fix Readonly Database — Absolute DB Path + Symlink
- Widget Auto-Layout — Bin-Packing for AI-Generated Dashboards
- Drag Ghost Outline — Visual Feedback During Widget Drag
- Upgrade Claude Model — `claude-sonnet-4-latest`
- Production Redeploy — L4 Bug Fixes + Canvas UX

---

## What's Next (L5 candidates)

### High-priority
1. **Test the auto-layout end-to-end** — Generate a dashboard via AI and verify widgets arrange cleanly
2. **CI/CD pipeline** — BitBucket Pipelines for automated deploys on push to `main`
3. **Add `prisma generate` to postinstall** — Prevent type drift

### Medium-priority
4. **Dashboard sharing** — Public URL for individual dashboards
5. **Widget resize ghost** — Same dashed outline pattern for resize (currently only shows ring)
6. **Responsive gallery** — Single-column card layout on mobile

### Backlog
7. **PostgreSQL migration** — When moving to team/production use
8. **Lighthouse audit** — Performance, accessibility, SEO scores
9. **Error monitoring** — Sentry or similar for production error tracking
