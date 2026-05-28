# Auth Lockdown — Crash Course

> Companion to `docs/incidents/INC-20260519-001.md` and `docs/BUNDLING_BOUNDARIES_CRASH_COURSE.md`.
> Audience: Jeff and any future operator who has to explain why a one-line config required nine files of edits.
> Last updated: 2026-05-20.

---

## TL;DR

On 2026-05-19 production was running with **authentication bypassed**. Anyone on the internet could reach `/dashboards`, `/admin`, `/api/data/query`, and live Freshworks data without signing in. The bypass was controlled by `NEXT_PUBLIC_DEV_MODE`, but **editing that env var on the production server didn't fix it** — the value had been frozen into the JavaScript bundle when the app was built. That's because `NEXT_PUBLIC_`-prefixed vars in Next.js are *inlined at build time*. They're meant for values you'd be fine exposing in the browser, not security flags.

Commit `48c4790` ships a structural fix: the security flag is now `DEV_MODE` (no prefix → server-only, runtime-evaluated). The legacy `NEXT_PUBLIC_DEV_MODE` survives but is now strictly a UI hint (controls cosmetic stuff like the dev login button). The CI workflow was also setting `NEXT_PUBLIC_DEV_MODE: "true"` at workflow scope — which the deploy job inherited and *re-baked* into every release bundle. That's fixed too.

You don't need to memorize Next.js internals. You need to understand:

1. **Two flags now, one job each.** `DEV_MODE` = security. `NEXT_PUBLIC_DEV_MODE` = UI hint. Match them in `.env.local`.
2. **The client/server boundary is a security boundary.** Never use a `NEXT_PUBLIC_` var to gate auth, audit, RBAC, or rate-limiting.
3. **CI workflow `env:` blocks are inherited by every job, including deploy.** Workflow-scope env must be production-safe by default.

---

## 1. What broke, in story form

### The original sin

InsightHub started as a demo. A demo doesn't need real auth — clicking "Continue with Google" while building UI is friction. So the original author added `NEXT_PUBLIC_DEV_MODE`. When `"true"`, middleware skips the auth check. `CONTRIBUTING.md` said "for production, set it to false and configure OAuth."

### The Next.js gotcha

Next.js has two flavors of env var:

- **Server-only** (e.g. `DATABASE_URL`): read from `process.env` at runtime. Edit `.env.local`, restart, done.
- **Client-bundled** (prefixed `NEXT_PUBLIC_`): **inlined at build time**. Next.js does a literal text substitution: every `process.env.NEXT_PUBLIC_FOO` is replaced with `FOO`'s value during the build. Frozen until the next rebuild.

The reason the second type exists: code that runs in the browser cannot read environment variables. If you want a value visible client-side, Next.js has to bake it in.

That's fine *for values that are OK being public*. The prefix is a literal opt-in saying: "I understand this will be visible in the browser and frozen at build time."

`NEXT_PUBLIC_DEV_MODE` had the prefix despite being used only in server code. Two consequences:

1. **Frozen at build time.** Editing `.env.local` on EC2 did nothing — the value was already inlined as `"true"` in `.next/standalone/server.js`.
2. **CI re-baked it on every deploy.** `.github/workflows/ci.yml:18` (pre-fix) set `NEXT_PUBLIC_DEV_MODE: "true"` at workflow scope. The deploy job inherited that env when running its own `npm run build`, so every CI deploy re-baked the bypass.

### Accumulating drift

Between "set up as demo" and "Freshworks live data hooked up" (2026-05-19), the demo posture quietly persisted: empty `GOOGLE_CLIENT_ID`, `NEXTAUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_DEV_MODE="true"` baked into every release, `assertEnv()` printing a warning nobody read. On 5/19 the bypass started exposing real customer-confidential data.

### Discovery + lockdown

Jeff noticed the dev-mode banner that night. `sudo systemctl stop insighthub` brought public surface to 502 in <1s. Forensic review of nginx access logs showed only Jeff's two IPs got 200-OKs; ~70 other IPs got 404s on generic vulnerability scanner probes. No unauthorized access to real data.

The fix took two passes. First pass (this morning) patched `.env.local` and restarted — bypass *was still on*, because the build artifact still had `"true"` inlined. Re-exposed for 1m47s before we re-stopped. The structural fix (this commit) is the second pass.

---

## 2. The two-flag pattern

| | `DEV_MODE` | `NEXT_PUBLIC_DEV_MODE` |
|---|---|---|
| Prefix | None | `NEXT_PUBLIC_` |
| Read by | Server only | Browser bundle (and server) |
| Evaluated | At runtime, every request | At build time, frozen into bundle |
| Role | **SECURITY** — gates auth bypass | **UI HINT** — show dev login button, etc |
| Toggle by editing `.env.local`? | YES (restart applies) | NO (must rebuild) |
| Visible in browser DevTools? | Never | Yes |

### Mental model

> `DEV_MODE` is the **lock on the front door**.
> `NEXT_PUBLIC_DEV_MODE` is the **"come on in" sign on the porch**.
>
> They should match. If they don't, the lock controls who actually gets in. The sign is decoration.

### Set them in `.env.local`

```bash
# Local dev (auth bypass on)
DEV_MODE="true"
NEXT_PUBLIC_DEV_MODE="true"

# Production (real auth)
DEV_MODE="false"
NEXT_PUBLIC_DEV_MODE="false"
```

The repo's `.env.example` has both with a comment block explaining the split.

---

## 3. The six files, one-line each

This is the "what's in the table" walkthrough.

| File | What changed |
|---|---|
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/middleware.ts:69` | The front-door gate now reads `DEV_MODE` (runtime), not `NEXT_PUBLIC_DEV_MODE` (frozen). Most important single change. |
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/config.ts:46,129` | NextAuth credentials provider's `authorize()` and `jwt()` callback both read `DEV_MODE`. |
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/session.ts:18,52` | `getCurrentUser()` and `getCurrentUserSync()` dev shortcuts read `DEV_MODE`. |
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/app/api/admin/health/route.ts:159-163` | Admin health endpoint reports **both** flags, so you can spot desync from a single curl. |
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/next.config.ts:9-25` | Build-time warning if either flag is true with `NODE_ENV=production`. |
| `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/env.ts:54-87,283-314,385-391` | The central validator. Added a `DEV_MODE` registry entry with the design rationale in a comment block; added desync detection; added a typed `env.DEV_MODE` accessor. |

### Why six files, not one?

Because security flags shouldn't be touched in only the most-visible place. Anywhere that *acted as if dev mode bypass was active* needed to be updated, or you'd have a half-fix where (say) middleware enforces auth but `getCurrentUser()` still returns the synthetic dev user — that creates a logic split where some pages 401 and others render with phantom admin data. We swept the whole chain so the security boundary is consistent in every layer.

---

## 4. The CI architecture mistake

GitHub Actions workflows have a top-level `env:` block inherited by all jobs. Ours had this pre-fix:

```yaml
env:
  NODE_VERSION: "20"
  NEXT_PUBLIC_DEV_MODE: "true"    # ← the bomb
  DATABASE_URL: "file:./dev.db"
  NEXTAUTH_SECRET: "ci-test-secret-not-for-production"
```

The `"true"` was set because the **E2E tests** assume middleware auth is bypassed (so tests navigate freely without real Google sessions). Legitimate need.

But `env:` at workflow scope applies to **every job**, including **Deploy to EC2**. The deploy job runs `npm run build`, Next.js sees `NEXT_PUBLIC_DEV_MODE === "true"` in `process.env`, and inlines `'true' === 'true'` everywhere the source referenced that var. The build artifact going to production had auth permanently bypassed, baked into JS.

### The fix

**Workflow env defaults to production-safe. Override unsafely only at the step level for steps that need it.**

```yaml
env:
  DEV_MODE: "false"
  NEXT_PUBLIC_DEV_MODE: "false"
```

And the e2e job's "Start server" step gets a local override of `DEV_MODE: "true"`. The build produces a production-shaped bundle; the e2e job starts the server with `DEV_MODE=true` *in the runtime environment only*. The middleware sees the runtime value, tests work, the deploy's separate build has no overrides and is production-shaped.

### General principle

**The security posture of a workflow's `env:` block is the security posture of every job, including deploy.** This applies to any CI system. Bitbucket Pipelines had the same issue and we patched it identically.

---

## 5. Swiss cheese — why this took five holes

Security incidents are rarely one thing. They're several controls failing simultaneously, where any one holding would have prevented the incident. For this one, five had to align:

1. **Wrong prefix for a security flag.** Fixed in 48c4790.
2. **CI workflow scope unsafe.** Fixed in 48c4790.
3. **OAuth never wired.** Empty `GOOGLE_CLIENT_ID` made flipping the flag uninviting — sign-in would have 500'd. Fixed via `apply-oauth-fix.sh` earlier today.
4. **`NEXTAUTH_URL` pointed at localhost.** Would have broken OAuth callbacks anyway. Same fix.
5. **`assertEnv()` warned but did not fail.** A warning in journald that nobody pages on. Action item: promote to hard throw.

If *any one* of these weren't broken, the incident wouldn't have happened or would have been caught much sooner. Half are now fixed; the rest are in the retrospective.

---

## 6. What's protecting us now

After commit 48c4790 lands on prod:

- Middleware auth gate reads runtime env — flipping `.env.local` + restart works.
- CI workflow defaults to production-safe — sloppy deploys can't bake bypass anymore.
- `assertEnv()` warns loudly at startup if `DEV_MODE=true` in production, or if the two flags disagree.
- `next.config.ts` warns at build time for the same conditions.
- `/api/admin/health` exposes both flags so operators see state without SSH.
- Google OAuth wired with real client ID, real secret, correct `NEXTAUTH_URL`.
- MFA enforced for ADMIN at sign-in via `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/src/lib/auth/mfa.ts:21-43`, satisfied by your YubiKey.
- Incident retrospective filed at `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/docs/incidents/INC-20260519-001.md` with action items, owners, dates.
- `@/Users/Jeffrey.Coy/CascadeProjects/InsightHub/scripts/apply-oauth-fix.sh` committed — reusable remediation tool.

---

## 7. Still to do

From the retrospective:

1. **Promote `assertEnv()` warning to a hard throw** for `NODE_ENV=production && DEV_MODE=true`. Forces a fail-fast — misconfigured deploy refuses to start.
2. **External attack-surface monitor.** Cron from *not* on autoqa that curls `/dashboards`, `/admin`, `/api/data/query` from the public internet and alerts on non-redirects. Would have caught this within minutes of first deploy.
3. **Refactor `/login` and `MetricExplanationModal`** to fetch dev-mode hint from an authenticated server endpoint, so we can drop `NEXT_PUBLIC_DEV_MODE` entirely.
4. **Update `CONTRIBUTING.md` + `README.md`** with the two-flag model and prod cutover checklist.
5. **Schedule a tabletop** on env-var-misconfiguration auth bypass for Q4 2026.

---

## 8. Talking to stakeholders

You'll be in rooms where someone asks "your site was running without auth?"

### One-paragraph honest version

> "On May 19, I discovered our analytics dashboard was running in 'demo mode' — auth was bypassed because of a config flag that had been on since the app was first deployed for prototyping. I took the site offline and ran a forensic review of access logs for the only day the misconfiguration exposed live customer data. No unauthorized access occurred — the only IPs that reached protected pages were mine. We fixed the underlying architectural issue that allowed the flag to be frozen into production builds, configured real Google OAuth, enforced multi-factor authentication for admin accounts, and filed a full incident retrospective with action items. The fix is structural — not just a config change — so this specific class of mistake cannot recur."

### Anticipated questions

- **"Was customer data exposed?"** "The bypass was active for one day with live customer data behind it. HTTP access logs show only IC IPs (mine) got successful responses. No outside party read customer data. We have the logs to prove it."
- **"How do you know nobody got in?"** "nginx access logs cover the window. They show source IP, path, status code. The bypass made auth a pass-through, so any access would have produced a 200-OK in the log. Forensic review found zero 200-OKs from unknown IPs. ~70 other IPs hit the site that day; all got 404s on generic scanner probes (`/wp-login.php`, etc.) — they never reached real endpoints."
- **"Why didn't your CI catch this?"** "CI tested that the app *worked* end-to-end. It didn't test 'is auth enforced from outside the host'. That's the external attack-surface monitor we're adding (action item 2)."
- **"How did this last so long?"** "The app was launched in a prototype posture and was reachable from the internet, but the live-data hookup that made it materially exposing only landed the day I discovered it. The window of meaningful exposure is one day. The window for the misconfiguration to be *theoretically present* is months. Both are documented in the retrospective."
- **"What stops this exact bug from happening again?"** "The security flag now has a different name and the wrong prefix is impossible to use accidentally — `NEXT_PUBLIC_DEV_MODE` is no longer wired to anything security-relevant. The CI workflow defaults to production-safe values. The startup validator warns loudly if either flag is on in production, and will be promoted to a hard refuse-to-start by end of next week."

---

## 9. Troubleshooting

### `validateEnv` says "DEV_MODE and NEXT_PUBLIC_DEV_MODE disagree"

Open `.env.local` (or the env file your server is reading). Make the two values match. Restart. The desync warning means one was updated and the other wasn't.

### "I edited `.env.local` and restarted but the UI still shows the dev login button"

That's expected — the dev login button is gated on `NEXT_PUBLIC_DEV_MODE`, which is **build-baked**. Editing `.env.local` and restarting changes the runtime value but not the inlined bundle value. To make the UI button reflect the new value, you have to rebuild (`npm run build`) and restart. The button being visible-but-non-functional is harmless; clicking it just fails because the server-side `authorize()` reads the runtime `DEV_MODE` and rejects.

### "I want to test prod-mode auth locally"

Set both flags to `"false"` in your local `.env.local`. Rebuild (`npm run build`). Start (`npm run start` — *not* `npm run dev`, dev mode reruns the build with the dev defaults). You'll need a real Google OAuth client configured against `http://localhost:3000` for sign-in to actually work.

### "I rotated `.env.local` on prod but the audit log still shows `dev-admin-user`"

The session was issued before the env change. Sign out, sign in again, the new session will carry your real CUID.

---

## 10. Pro-tips for future env vars

Before adding a new env var to this codebase:

- **Is this a security decision?** (Auth, audit, RBAC, rate-limit, encryption, secrets, anything where being wrong has a blast radius.) → **No `NEXT_PUBLIC_` prefix, ever.** Server-only.
- **Does a client component need to read this?** → Two flags. One server-only for the security decision. One `NEXT_PUBLIC_` for the UI hint. They should match in `.env.local`; the validator warns on desync.
- **Are you adding it to `.github/workflows/ci.yml` env at workflow scope?** → That value will be inherited by the deploy job. Treat it like a production env var. Override unsafely at the step level only for jobs that need it.
- **Are you adding a validation rule in `src/lib/env.ts`?** → Add the comment block explaining *why* the rule exists. Future engineers (including future-you) will read the rule and decide whether to remove or change it; a comment that explains the original intent saves a lot of git-archaeology.
- **Did you update `.env.example`?** → If not, the next dev to clone the repo won't know the var exists. Update it.
