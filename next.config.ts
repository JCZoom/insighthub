import type { NextConfig } from "next";

// CRITICAL: Hard-fail build if NEXT_PUBLIC_DEV_MODE=true in production
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DEV_MODE === 'true'
) {
  const msg =
    '🚨 CRITICAL: NEXT_PUBLIC_DEV_MODE=true in production — authentication is completely bypassed! ' +
    'This is a critical security vulnerability. Set NEXT_PUBLIC_DEV_MODE=false or remove it entirely.';
  console.error(msg);
  throw new Error(msg);
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
