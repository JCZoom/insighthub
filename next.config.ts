import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
