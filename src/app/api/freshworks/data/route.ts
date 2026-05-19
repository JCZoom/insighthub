import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { FreshworksDataProvider, isFreshworksSource } from '@/lib/data/freshworks-data-provider';
import {
  FreshworksError,
  FreshworksNotConfiguredError,
  FreshworksRateLimitError,
} from '@/lib/integrations/freshworks';

/**
 * GET /api/freshworks/data?source=<name>
 *
 * Queries a registered Freshworks source across the entire suite
 * (Freshsales, Freshdesk, Freshcaller, Freshchat). Authenticated users only.
 *
 * RBAC posture: every authenticated user can call this endpoint; data is
 * **automatically redacted at the connector layer** based on the caller's
 * role (VIEWER and CREATOR see masked PII; POWER_USER and ADMIN see full
 * data). Every read is audit-logged with the product name in the metadata.
 *
 * Errors:
 *   401 if unauthenticated
 *   400 if source missing or unknown
 *   429 if outbound rate limit reached for the source's product
 *   503 if the source's product is not configured / upstream API error
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
    if (err instanceof FreshworksNotConfiguredError) {
      return NextResponse.json(
        { error: `Freshworks ${err.product} is not configured on this environment.` },
        { status: 503 }
      );
    }
    if (err instanceof FreshworksRateLimitError) {
      return NextResponse.json(
        { error: `Freshworks ${err.product} rate limit reached; retry in a few seconds.` },
        { status: 429 }
      );
    }
    if (err instanceof FreshworksError) {
      // Do NOT echo the connector's bodyPreview back to the client (may
      // contain partial PII in error responses). Log it server-side only.
      // eslint-disable-next-line no-console
      console.error('[freshworks/data] API error:', {
        product: err.product,
        status: err.status,
        message: err.message,
        bodyPreview: err.bodyPreview,
      });
      return NextResponse.json(
        { error: `Freshworks ${err.product} API error (${err.status})` },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('[freshworks/data] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
