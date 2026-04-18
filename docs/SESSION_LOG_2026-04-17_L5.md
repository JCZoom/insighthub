# Session Log — April 17, 2026 (L5: CI/CD, Auto-Layout Tests, Model Fix)

## Objective
Fix the broken chat API (bad model name), test auto-layout end-to-end, set up CI/CD with BitBucket Pipelines, and add `prisma generate` to postinstall.

---

## Issues Fixed

### 1. Chat API 404 — Invalid Model Name

**Root cause:** In the previous session I changed the Claude model from `claude-sonnet-4-20250514` to `claude-sonnet-4-latest`. The Anthropic API does **not** support a `-latest` alias for Sonnet 4 — it returned a 404 `not_found_error`.

**Symptom:** Every chat request showed:
```
**Something went wrong:** 404
{"type":"error","error":{"type":"not_found_error","message":"model: claude-sonnet-4-latest"}}
```

**Fix:** Reverted to the original working model name `claude-sonnet-4-20250514` in `src/app/api/chat/route.ts`.

**Lesson:** Don't assume API alias patterns. The `-latest` convention works for Claude 3.5 (`claude-3-5-sonnet-latest`) but **not** for Claude Sonnet 4. Always test model name changes before deploying.

**Verification:** POST to `/api/chat` confirmed working response with `explanation`, `patches`, and `quickActions`.

---

## Tasks Completed

### 2. Auto-Layout End-to-End Testing

Ran the `autoLayoutWidgets` and `needsAutoLayout` functions against three scenarios:

| Scenario | Input | Expected | Result |
|----------|-------|----------|--------|
| Chaotic AI layout (7 widgets, all at x:0) | 4 KPIs + 2 charts + 1 table stacked vertically | `needsAutoLayout` → true; KPIs 4-across, charts 2-across, table full-width | ✅ Pass |
| Well-arranged grid | 3 widgets in proper non-overlapping positions | `needsAutoLayout` → false (no rearrangement) | ✅ Pass |
| Overlapping widgets | 2 widgets with x-overlap | `needsAutoLayout` → true | ✅ Pass |
| Single widget | 1 widget | `needsAutoLayout` → false | ✅ Pass |

**Layout output for chaotic case:**
```
MRR             x:0 y:0 w:3 h:2
Churn           x:3 y:0 w:3 h:2
CSAT            x:6 y:0 w:3 h:2
Tickets         x:9 y:0 w:3 h:2
Revenue Trend   x:0 y:1 w:6 h:4
Tickets by Team x:6 y:1 w:6 h:4
Recent Tickets  x:0 y:2 w:12 h:4
```

This matches the expected grid: KPIs in row 0, charts side-by-side in row 1, full-width table in row 2.

---

### 3. `prisma generate` in postinstall

Added `"postinstall": "prisma generate"` to `package.json` scripts.

**Why:** Without this, pulling fresh or deploying on CI would skip Prisma client generation, causing type mismatches between the schema and the generated client. The `postinstall` hook runs automatically after `npm ci` / `npm install`, ensuring the Prisma client is always in sync with `schema.prisma`.

---

### 4. BitBucket Pipelines Configuration

Created `bitbucket-pipelines.yml` with three pipeline stages:

**Stage 1: Type Check & Lint** (every push)
- `npm ci` → `tsc --noEmit` → `npm run lint`
- Fast feedback on any branch push (~1-2 min)

**Stage 2: Build** (main branch only)
- Full `next build` with `.next/cache` caching
- Artifacts passed to deploy step

**Stage 3: Deploy to EC2** (main branch only, after build)
- SSH key from BB repo variables (base64-encoded `SSH_PRIVATE_KEY`)
- `rsync` files to EC2 (excludes `.git`, `node_modules`, `.next`, `.env.local`, DB files)
- Remote: `npm ci` → `prisma db push` → `next build` → package standalone → `systemctl restart`
- Health check with 5 retries

**Manual triggers:**
- `deploy-only` — skip typecheck/build, just deploy (for config changes)
- `full-pipeline` — typecheck + build + deploy from any branch

**Required BB repository variables:**
| Variable | Value |
|----------|-------|
| `SSH_PRIVATE_KEY` | Base64-encoded ED25519 key for EC2 |
| `EC2_HOST` | `autoqa` (or Tailscale IP) |
| `EC2_USER` | `jeffreycoy` |
| `APP_DIR` | `/opt/insighthub` |
| `SITE_DOMAIN` | `dashboards.jeffcoy.net` |

**Next step:** Create the `insighthub` repo in the `uszoomllc` BitBucket workspace, add the remote, push, and configure the repository variables.

---

## User Changes (not by AI)

The user also made several UI improvements between sessions:
- **Profile dropdown** — JC avatar now opens a menu with Profile, Settings, Sign Out
- **Mic button** — Voice input placeholder in the chat input bar
- **Widget detail overlay** — `WidgetDetailOverlay` component for expanding widgets
- **Focus outline suppression** — CSS fix for Recharts SVG focus rings
- **Copy/text tweaks** — Separated "common request" text from "search dashboards" link
- **pill-cyan** — New CSS utility class

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/chat/route.ts` | Reverted model to `claude-sonnet-4-20250514` |
| `package.json` | Added `postinstall: prisma generate` |
| `bitbucket-pipelines.yml` | **New** — CI/CD pipeline config |

## Verification

- Chat API: `curl -X POST .../api/chat` → valid JSON response ✅
- Auto-layout: 4 test scenarios pass ✅
- TypeScript: `tsc --noEmit` → zero errors ✅
- Production: deployed and running ✅

---

## What's Next

1. **Create BB repo** — `uszoomllc/insighthub`, add remote, push, configure variables
2. **First pipeline run** — verify typecheck + build + deploy passes in CI
3. **Widget resize ghost** — same dashed outline UX for resize (currently only drag has it)
4. **Error monitoring** — Sentry or similar for catching production errors like the model 404
