import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

const startedAt = Date.now();

/**
 * Read a single integer from a cgroup pseudo-file. systemd v2 cgroups expose
 * the unit's MemoryMax / MemoryHigh / current usage as plain numeric files
 * under /sys/fs/cgroup/<slice>/<unit>/. We read whichever paths are present.
 *
 * The value "max" (string) means uncapped on cgroup v2 — return null in that
 * case so the caller can render "unlimited" instead of NaN.
 */
async function readCgroupInt(path: string): Promise<number | null> {
  try {
    const raw = (await readFile(path, 'utf8')).trim();
    if (raw === 'max' || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort discovery of the current systemd unit's cgroup directory.
 * Reads /proc/self/cgroup which on cgroup v2 looks like:
 *   0::/system.slice/insighthub.service
 * Returns null off-Linux or when cgroups are unavailable (dev mode).
 */
async function findCgroupDir(): Promise<string | null> {
  try {
    const raw = await readFile('/proc/self/cgroup', 'utf8');
    // Format: "0::/path" for cgroup v2 unified hierarchy.
    const line = raw.split('\n').find((l) => l.startsWith('0::'));
    if (!line) return null;
    const rel = line.slice(3); // strip "0::"
    if (!rel.startsWith('/')) return null;
    return `/sys/fs/cgroup${rel}`;
  } catch {
    return null;
  }
}

/**
 * Collect runtime memory data: V8 heap (process.memoryUsage), V8 heap limit
 * (NODE_OPTIONS --max-old-space-size effective ceiling), and the systemd
 * cgroup limits (MemoryHigh / MemoryMax / current usage). Failures degrade
 * gracefully — anything unavailable comes back as `null`, never throws.
 */
async function collectMemorySnapshot() {
  const mem = process.memoryUsage();
  // V8 heap stats expose the actual configured heap limit (in bytes). This
  // reflects --max-old-space-size and any V8 internal adjustments.
  let heapLimitBytes: number | null = null;
  try {
    const v8 = await import('node:v8');
    heapLimitBytes = v8.getHeapStatistics().heap_size_limit;
  } catch {
    /* best-effort */
  }

  // systemd cgroup v2 limits — only populated when running under the
  // production systemd unit on Linux. On macOS / dev mode all three stay null.
  const cgroupDir = await findCgroupDir();
  const [usageBytes, highBytes, maxBytes] = cgroupDir
    ? await Promise.all([
        readCgroupInt(`${cgroupDir}/memory.current`),
        readCgroupInt(`${cgroupDir}/memory.high`),
        readCgroupInt(`${cgroupDir}/memory.max`),
      ])
    : [null, null, null];

  const toMB = (b: number | null) => (b === null ? null : Math.round(b / 1024 / 1024));

  // "pressure" is a single-number tell of how close we are to the limit.
  // We pick the tightest configured ceiling and compute (current / ceiling).
  // Caller can alert at >0.75, page at >0.9.
  const ceilingBytes = maxBytes ?? highBytes ?? heapLimitBytes;
  const currentForPressure = usageBytes ?? mem.rss;
  const pressureRatio =
    ceilingBytes && ceilingBytes > 0 ? +(currentForPressure / ceilingBytes).toFixed(3) : null;

  return {
    // V8 heap
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    heapLimitMB: toMB(heapLimitBytes),
    // Process resident set (what Linux/macOS calls "RSS" in `ps`)
    rssMB: Math.round(mem.rss / 1024 / 1024),
    externalMB: Math.round(mem.external / 1024 / 1024),
    // systemd unit ceiling (cgroup v2, Linux prod only — null in dev)
    unit: {
      currentMB: toMB(usageBytes),
      highMB: toMB(highBytes), // soft cap (throttle above this)
      maxMB: toMB(maxBytes), // hard cap (systemd kills unit above this)
    },
    // 0.0 = idle, 1.0 = at ceiling. null if no ceiling known (dev mode).
    pressureRatio,
  };
}

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

    // Memory usage (process + systemd unit ceiling — see collectMemorySnapshot
    // for the full shape). `pressureRatio` >= 0.75 means we should investigate;
    // >= 0.90 means we're about to be SIGKILLed by systemd at MemoryMax.
    checks.memory = await collectMemorySnapshot();

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