# Bundling Boundaries — Crash Course

> **Audience:** anyone editing InsightHub code that crosses the client/server line (Jeff, future contributors, anyone debugging a Turbopack build failure).
> **Last updated:** 2026-05-19.
> **TL;DR:** Next.js 16 ships two separate bundles — one that runs in the user's browser, one that runs on the EC2 box. Code that touches Node-only APIs (Redis, `fs`, `net`, anything from `process.env` that's a secret) belongs only in the server bundle. The job of the developer is to keep those two bundles cleanly separated. We have three tools for that, in strict order of preference: **file split**, **`serverExternalPackages`**, and **`use client`**. Pick the lowest-magic option that works.

---

## The incidents that prompted this doc

On **2026-05-19 between 14:00 and 15:30 UTC**, the Turbopack build broke twice in 30 minutes during demo prep. Each break came from a different side of the boundary, and the fixes are now the template for how we handle this class of problem.

**Incident A — Client bundle imported a Redis driver.** A new hook (`useWidgetData`) needed one boolean: "is this source name a Freshworks source?". It got that boolean from `isFreshworksSource()` exported by `src/lib/data/freshworks-data-provider.ts`. That file also imports `ioredis` for the server-side cache. Turbopack followed the import graph for the client bundle, found `ioredis`, tried to bundle it, and exploded because `ioredis` reaches for `net`, `dns`, and `tls` — Node-only APIs that don't exist in a browser.

**Incident B — Server bundle also exploded on the same package.** Even after the client side was fixed, the server bundle failed because **server bundling is not the same as "no bundling"**. Turbopack still tries to bundle server route handlers for performance. Some Node packages — `ioredis`, `bcrypt`, `prisma`, native `.node` add-ons — must be loaded by Node's regular `require()` at runtime, not bundled. Those go in `next.config.ts` under `serverExternalPackages`.

Both failed with cryptic Turbopack errors that did not name the offending package on the first line. The fix-and-verify loop took ~25 minutes that we couldn't afford the day before a stakeholder demo. The lesson: **architect for the boundary up front, don't debug it later**.

---

## How Next.js 16 actually builds the project

Next.js 16 produces (at least) three artefact sets:

1. **Client bundles** — JavaScript shipped to the browser. Every file imported, transitively, by a client component or hook. Anything React component-y under `src/components/`, every hook under `src/hooks/`, anything reached from a `'use client'` boundary.
2. **Server route handlers** — code that runs in Node on the EC2 box to answer HTTP requests. Files under `src/app/**/route.ts`, `src/middleware.ts`, server actions. Turbopack does still bundle these (for cold-start performance and to support the edge runtime when you opt in), unless a package is explicitly externalised.
3. **RSC (React Server Components)** — server-rendered React trees that get streamed to the browser as a payload, then hydrated. The `*.tsx` files under `src/app/` that don't say `'use client'`.

Each artefact set has its own module-resolution rules and its own list of forbidden APIs. The browser can't see `fs`, `net`, or your DB password. The server can see all those, but if you bundle a native module the build still fails.

Turbopack follows the import graph from each entry point. **If a client file `import`s a module, every line of that module — including its `import` statements — must be bundle-able for the browser**, even if the importing file only uses one tiny named export.

This is the rule that bit us in Incident A. We thought we were importing one function. Turbopack saw the file's `import 'ioredis'` and dutifully tried to bundle Redis into the browser bundle.

---

## The three tools, in order of preference

### Tool 1 — File split (best)

This is what we did to fix Incident A. Take the pure / client-safe parts of a server-only file and extract them to a new file that imports nothing Node-specific. Both sides import the new file freely.

```
src/lib/data/freshworks-data-provider.ts   (server-only — has the Redis client)
  └── re-exports from →
src/lib/data/freshworks-sources.ts         (pure data: source names + product gates)
  └── imported by both:
      src/hooks/useWidgetData.ts           (client)
      src/app/api/data/query/route.ts      (server)
```

The new file has zero side-effects, zero Node imports, and zero secrets. It can ship to the browser without harm.

**Why this is the best tool:** it makes the architecture *legible*. Anyone reading the import statement sees, at a glance, which side of the boundary they're on. There is no magic. The TypeScript types flow naturally. If someone later tries to put a secret in the pure file, the file-split convention is screaming "wrong place" even before they hit a build error.

Use this **first**. Reach for it whenever a client component or hook needs a small piece of static data, type, or pure function from a server-only module.

### Tool 2 — `serverExternalPackages` (for native modules)

Some npm packages must be loaded by Node's runtime `require()`, not by the bundler. Native modules (`.node` files), modules that call `eval`, modules that introspect their own location on disk, anything that uses Node's internal C++ bindings directly. `ioredis`, `bcrypt`, `prisma`'s native engine, `sharp` (if we ever add image processing), `canvas`, etc.

Add them to `next.config.ts`:

```ts
const nextConfig = {
  serverExternalPackages: ['ioredis'],
  // ...
};
```

That tells Turbopack: "On the server bundle, do not try to inline this package. Leave it as a runtime `require()`." Now Node loads it normally at server startup, with all its native bits intact.

**When you need this:** the build fails on the *server* side (not the client side) with errors mentioning the package's internal files or Node API names. Or the build succeeds but the runtime crashes with `Module not found` or `Cannot find module` for a transitive native dep.

**When you don't need this:** if the package is pure JavaScript and only uses standard Node APIs. Turbopack handles that case fine.

Today's `ioredis` fix is the canonical example. Add it to the list and move on.

### Tool 3 — `'use client'` directive (last resort)

This is the directive everyone learns first and reaches for too often. `'use client'` at the top of a file tells Next.js: "this file and everything in its import sub-tree is part of the client bundle." It exists so that components can hold React state and call browser APIs.

**It does NOT make a server-only file safe to import from the client.** It is not a security boundary. If you put `'use client'` on a file that imports `ioredis`, you've made the problem worse: now Turbopack is even more committed to bundling Redis for the browser.

The only legitimate uses of `'use client'`:

- A component that holds React state (`useState`, `useReducer`).
- A component that listens for browser events (`window`, `document`, `addEventListener`).
- A component that uses browser-only libraries (`recharts`, `lucide-react` icons that need DOM measurement, etc.).
- A hook that does any of the above.

Never put `'use client'` on a file just to "make the import work". If you find yourself doing that, you needed Tool 1 (file split), not this.

### Anti-tool — Dynamic `import()`

You will occasionally see `const mod = await import('./server-only')` used to defer loading a module until runtime. This works because the bundler can sometimes prove that the import won't fire on the client side. But it's fragile, depends on bundler heuristics that change between versions, and produces opaque errors when the heuristic guesses wrong. **Don't use it for boundary problems.** It's fine for legitimate code-splitting (lazy-loading a heavy widget on user interaction), but not as a band-aid for an import leak.

---

## How to spot a future leak in code review

Three checks, in order:

1. **Read the imports at the top of any new file.** If a `src/hooks/*` or `src/components/*` file imports from `src/lib/*` or `src/server/*`, look at what's in the imported file's top-of-file imports. If you see `ioredis`, `fs`, `net`, `dns`, `child_process`, `prisma/client`, or `next-auth` (server side), you've got a leak.
2. **Run `npm run build` locally before pushing.** Turbopack's error messages are cryptic but the build *will* fail. The two-minute local check beats a 25-minute fix-and-redeploy under pressure. We learned this the hard way today.
3. **If the build complains about a transitive dep you've never heard of**, trace upward: `npm ls <pkg>` shows who pulled it in, and `grep -r '<pkg>' src/` shows who imports the offender. Today the chain was `useWidgetData` → `freshworks-data-provider` → `ioredis` → `net`. Once you can name that chain, the fix is obvious.

---

## A note on the security boundary

The bundling boundary is not the security boundary. The security boundary is the HTTP request: the server can enforce authentication, RBAC, and audit logging only on data that arrives via a `fetch()` from the browser, because that's the only point at which it can run server code. Anything you put in a client bundle is **public**. Don't ship API keys, internal IPs, customer data, or anything you wouldn't paste into a public chat.

A common mistake is to think "the file is `.server.ts`, so it's safe to put a secret in it." It isn't. The filename is just a convention. If anything in the import graph touches a client bundle, the contents ship. **Use `process.env.SECRET_NAME` only from files that are clearly server-only and never imported by anything client-bundled.**

---

## Demo narrative (if a stakeholder asks)

If a stakeholder during the 2026-05-20 review asks "how do you stop secrets from leaking to the browser", the honest answer is layered:

1. **Convention** — server-only files live under `src/lib/data/*-data-provider.ts`, `src/lib/auth/*`, `src/app/api/**/route.ts`, and import the secret from `process.env`. Client files (hooks, components) never import from those.
2. **Build-time enforcement** — Next.js + Turbopack fail the build when a client bundle pulls in a Node-only API. This catches accidental leaks before they ship.
3. **Pure-data files** — when client code legitimately needs a small piece of server-known information (like a catalog of available data sources), we extract that to a third file with no secrets in it. Today's `freshworks-sources.ts` is the canonical example.
4. **No dev tools in prod** — production builds are minified, source maps are not shipped, and `NODE_ENV=production` disables React's development warnings. (We will harden this further when we disable `NEXT_PUBLIC_DEV_MODE` and turn on real Google OAuth.)

That's the honest, complete story. The boundary is enforced by a combination of project convention, build-tool rules, and the architectural file split. None of the three alone is sufficient; together they are.

---

## File map

| Path | Purpose |
|---|---|
| `next.config.ts` | `serverExternalPackages` list — native modules that must not be bundled on the server side |
| `src/lib/data/freshworks-sources.ts` | Pure client-safe catalog (source names, product availability gates) |
| `src/lib/data/freshworks-data-provider.ts` | Server-only Freshworks provider — imports `ioredis`, calls Freshworks REST APIs |
| `src/hooks/useWidgetData.ts` | Client hook that fetches widget data via `/api/data/query` for Freshworks sources |
| `src/app/api/data/query/route.ts` | Server route handler that runs the provider, applies RBAC, classifies, and audits |
| `docs/MEMORY_HARDENING_CRASH_COURSE.md` | Sibling crash course on the systemd memory limits |
| `docs/BUNDLING_BOUNDARIES_CRASH_COURSE.md` | This doc |

## Annual review checklist (due 2027-05-19)

- [ ] Confirm `next.config.ts:serverExternalPackages` still lists `ioredis` (and anything else added since). Run `npm run build` from a clean checkout to verify the boundary still holds.
- [ ] Re-read this doc in the context of whatever Next.js major has been released. The bundling model evolves — Next.js 15 changed it materially from 14, 16 changed it again. Check whether `serverExternalPackages` is still the right knob.
- [ ] Audit `src/hooks/*` and `src/components/*` for imports from `src/lib/data/*-data-provider.ts`. There should be zero. If any are found, the offender belongs in the pure sources file.
