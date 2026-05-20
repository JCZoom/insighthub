import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import { probeFreshworksHealth } from '@/lib/data/freshworks-health';

/**
 * GET /api/admin/freshworks/health
 *
 * Admin-only. Exercises every registered Freshworks source and returns a
 * per-source report (row counts, sample field keys, sanitized sample row,
 * heuristic flags, latency). Companion of `/api/admin/freshworks/diagnostics`
 * which reports CONNECTOR state — this one reports DATA-SHAPE state.
 *
 * The probe issues 17 requests, one per registered source. Each request
 * hits the underlying integration client which honours the 60-second
 * per-key cache. Running this in quick succession is cheap (cache hits)
 * and safe.
 *
 * Response shape: see `FreshworksHealthReport` in
 * `src/lib/data/freshworks-health.ts`.
 *
 * Note: the API route lives under `/api/admin/freshworks/` next to the
 * existing `diagnostics` route. The UI lives at `/admin/freshworks/health`.
 */
export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = await probeFreshworksHealth(user);
  return NextResponse.json(report, {
    headers: {
      // The probe result is per-moment-in-time operator diagnostics. Never
      // cache at the edge or in the browser; always serve fresh.
      'Cache-Control': 'no-store',
    },
  });
}
