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
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
