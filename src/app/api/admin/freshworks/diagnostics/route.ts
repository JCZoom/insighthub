import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import {
  describeFreshsalesClient,
  isFreshworksCacheAvailable,
  isFreshsalesConfigured,
} from '@/lib/integrations/freshworks';

/**
 * GET /api/admin/freshworks/diagnostics
 *
 * Admin-only safe-to-log snapshot of the Freshworks connector state.
 *
 * Returns:
 *   - configured: whether env vars are present
 *   - cacheAvailable: whether Redis is reachable
 *   - clientDescription: redacted (no raw API key) connector state
 *
 * The connector is meant to be invisible most of the time. This endpoint
 * exists so that when something looks wrong on the demo, we have a single
 * place to point at and say "yes the connector is configured and the cache
 * is connected" before we go deeper.
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

  return NextResponse.json({
    configured: isFreshsalesConfigured(),
    cacheAvailable: isFreshworksCacheAvailable(),
    client: describeFreshsalesClient(),
    asOf: new Date().toISOString(),
  });
}
