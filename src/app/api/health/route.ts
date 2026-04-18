import { NextResponse } from 'next/server';

const startedAt = Date.now();

// GET /api/health — health check endpoint for monitoring
export async function GET() {
  const checks: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: {
      seconds: Math.floor((Date.now() - startedAt) / 1000),
      since: new Date(startedAt).toISOString(),
    },
  };

  // Check database connectivity with timing
  const dbStart = Date.now();
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = { status: 'connected', latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'disconnected', latencyMs: Date.now() - dbStart };
  }

  // Check if Anthropic key is configured
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';

  // Memory usage (useful for detecting leaks)
  const mem = process.memoryUsage();
  checks.memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  };

  // Git commit (set via GIT_COMMIT env var in CI/deploy)
  if (process.env.GIT_COMMIT) {
    checks.commit = process.env.GIT_COMMIT;
  }

  // Node.js version
  checks.node = process.version;

  const dbStatus = (checks.database as Record<string, string>).status;
  const isHealthy = dbStatus === 'connected';
  checks.status = isHealthy ? 'ok' : 'degraded';

  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}
