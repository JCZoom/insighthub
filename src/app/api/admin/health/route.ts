import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

const startedAt = Date.now();

// GET /api/admin/health — private health endpoint with detailed diagnostics (admin only)
export async function GET() {
  try {
    // Authentication required - admin only
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'connected', latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'disconnected', latencyMs: Date.now() - dbStart };
    }

    // Check if AI services are configured
    checks.services = {
      anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    };

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

    // Environment info
    checks.environment = {
      nodeEnv: process.env.NODE_ENV,
      devMode: process.env.NEXT_PUBLIC_DEV_MODE === 'true',
    };

    const dbStatus = (checks.database as Record<string, string>).status;
    const isHealthy = dbStatus === 'connected';
    checks.status = isHealthy ? 'ok' : 'degraded';

    return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
  } catch (error) {
    console.error('Admin health check error:', error);

    // Handle auth errors specifically
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}