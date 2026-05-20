import type { NextConfig } from "next";

// WARNING: Dev mode bypasses authentication. Two flags govern this:
//   - DEV_MODE              (server-only, runtime-evaluated) — SECURITY flag
//   - NEXT_PUBLIC_DEV_MODE  (client, build-baked)            — UI-hint flag
// See src/lib/env.ts for the full rationale and the 2026-05-19 incident
// that motivated the split. This block runs at build-time; we warn on both
// because either being true in production is a smell.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.DEV_MODE === 'true'
) {
  console.warn(
    '⚠️  DEV_MODE=true at build time with NODE_ENV=production — authentication will be bypassed at runtime. ' +
    'This must be disabled before serving real traffic.'
  );
}
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DEV_MODE === 'true'
) {
  console.warn(
    '⚠️  NEXT_PUBLIC_DEV_MODE=true at build time with NODE_ENV=production — dev UI affordances (dev login button, etc) will be baked into the bundle. Cosmetic only; security is governed by DEV_MODE.'
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  // `ioredis` pulls in Node built-ins (`dns`, `fs`, `net`, `tls`) at module
  // load. Turbopack would otherwise try to statically bundle it for App
  // Routes and Server Components, which fails because those built-ins are
  // not resolvable as packages. Marking it external delegates resolution to
  // Node's native `require` at runtime, where the built-ins are available.
  // See `docs/MEMORY_HARDENING_CRASH_COURSE.md` for the broader cache story.
  serverExternalPackages: ["@prisma/client", "ioredis"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
