import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import {
  describeFreshsalesClient,
  describeFreshdeskClient,
  describeFreshcallerClient,
  describeFreshchatClient,
  isFreshsalesConfigured,
  isFreshdeskConfigured,
  isFreshcallerConfigured,
  isFreshchatConfigured,
  isFreshworksCacheAvailable,
} from '@/lib/integrations/freshworks';

/**
 * GET /api/admin/freshworks/diagnostics
 *
 * Admin-only snapshot of the entire Freshworks suite connector state.
 *
 * For each of the 4 products (Freshsales / Freshdesk / Freshcaller /
 * Freshchat) we return:
 *   - configured: whether env vars are present
 *   - client: redacted (no raw API key) connector state
 *
 * Plus suite-wide:
 *   - cacheAvailable: whether Redis is reachable
 *
 * Never returns raw API keys; key field is always rendered as
 * `<first-4>…<last-2>`.
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
    cacheAvailable: isFreshworksCacheAvailable(),
    products: {
      freshsales: {
        configured: isFreshsalesConfigured(),
        client: describeFreshsalesClient(),
      },
      freshdesk: {
        configured: isFreshdeskConfigured(),
        client: describeFreshdeskClient(),
      },
      freshcaller: {
        configured: isFreshcallerConfigured(),
        client: describeFreshcallerClient(),
      },
      freshchat: {
        configured: isFreshchatConfigured(),
        client: describeFreshchatClient(),
      },
    },
    asOf: new Date().toISOString(),
  });
}
