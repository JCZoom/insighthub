import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// Process start time captured at module init — used to compute uptime.seconds.
const startedAt = Date.now();

/**
 * GET /api/health — public health endpoint for monitoring/load-balancers.
 *
 * Returns a monitoring-friendly subset of what `/api/admin/health` exposes:
 *   - status (ok | degraded)
 *   - timestamp
 *   - version
 *   - node version
 *   - uptime { seconds, since }
 *   - database { status, latencyMs }
 *   - memory { heapUsedMB, heapTotalMB, rssMB }
 *
 * Deliberately omits:
 *   - services.{anthropic,openai} (admin-only — telling random visitors which
 *     AI vendors we use is a minor info-disclosure)
 *   - environment.{nodeEnv,devMode} (admin-only — operational metadata)
 *   - commit (admin-only — reveals deploy version)
 *   - cgroup MemoryHigh/MemoryMax/pressureRatio (admin-only — internal
 *     resource budgets are not part of the public contract)
 *
 * The rich shape here keeps backwards-compat with e2e/{smoke,api-integration,
 * production-health}.spec.ts which assert on database.status, memory.*,
 * uptime, and version. Returning the minimal {status, timestamp} (the
 * previous shape) broke all three suites the moment they actually ran in
 * CI 2026-05-19.
 */
export async function GET() {
  const dbStart = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    /* dbStatus stays 'disconnected' */
  }

  const mem = process.memoryUsage();
  const body = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    node: process.version,
    uptime: {
      seconds: Math.floor((Date.now() - startedAt) / 1000),
      since: new Date(startedAt).toISOString(),
    },
    database: {
      status: dbStatus,
      latencyMs: Date.now() - dbStart,
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
  };

  return NextResponse.json(body, { status: dbStatus === 'connected' ? 200 : 503 });
}
