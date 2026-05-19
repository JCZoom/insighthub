import type { NextConfig } from "next";

// WARNING: Dev mode bypasses authentication. When OAuth is configured, set
// NEXT_PUBLIC_DEV_MODE=false in .env.local and optionally restore the throw below.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DEV_MODE === 'true'
) {
  console.warn(
    '⚠️  NEXT_PUBLIC_DEV_MODE=true in production — authentication is bypassed. ' +
    'This is acceptable during development but must be disabled before public launch.'
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
