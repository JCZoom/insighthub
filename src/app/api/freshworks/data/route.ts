import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { FreshworksDataProvider, isFreshworksSource } from '@/lib/data/freshworks-data-provider';
import {
  FreshsalesError,
  FreshsalesNotConfiguredError,
  FreshsalesRateLimitError,
} from '@/lib/integrations/freshworks';

/**
 * GET /api/freshworks/data?source=<name>
 *
 * Queries a registered Freshworks source. Authenticated users only.
 *
 * RBAC posture: every authenticated user can call this endpoint; data is
 * **automatically redacted at the connector layer** based on the caller's
 * role (VIEWER and CREATOR see masked PII; POWER_USER and ADMIN see full
 * data). Every read is audit-logged.
 *
 * To gate an entire source behind a permission group, wrap the source name
 * with a check against `hasFeaturePermission(user, ...)`. We don't today
 * because the masking-by-default design already provides the protection
 * the gap requires.
 *
 * Errors:
 *   401 if unauthenticated
 *   400 if source missing or unknown
 *   503 if Freshworks not configured / rate-limited / upstream API error
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const source = new URL(request.url).searchParams.get('source');
  if (!source) {
    return NextResponse.json({ error: 'Missing required query param: source' }, { status: 400 });
  }
  if (!isFreshworksSource(source)) {
    return NextResponse.json(
      { error: `Unknown Freshworks source: "${source}"` },
      { status: 400 }
    );
  }

  try {
    const result = await FreshworksDataProvider.queryData(source, user);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FreshsalesNotConfiguredError) {
      return NextResponse.json(
        { error: 'Freshworks connector is not configured on this environment.' },
        { status: 503 }
      );
    }
    if (err instanceof FreshsalesRateLimitError) {
      return NextResponse.json(
        { error: 'Freshworks rate limit reached; retry in a few seconds.' },
        { status: 429 }
      );
    }
    if (err instanceof FreshsalesError) {
      // Do NOT echo the connector's bodyPreview back to the client (may
      // contain partial PII in error responses). Log it server-side only.
      // eslint-disable-next-line no-console
      console.error('[freshworks/data] Freshsales API error:', {
        status: err.status,
        message: err.message,
        bodyPreview: err.bodyPreview,
      });
      return NextResponse.json(
        { error: `Freshworks API error (${err.status})` },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('[freshworks/data] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
