import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  isFreshworksSource,
  listFreshworksSources,
  FreshworksDataProvider,
} from '@/lib/data/freshworks-data-provider';

/**
 * GET /api/freshworks/sources
 *
 * Returns the catalog of Freshworks data sources available to this user.
 * Every authenticated user gets the catalog — redaction happens at the
 * data layer based on role, not at the catalog layer.
 *
 * Response:
 *   {
 *     configured: boolean,
 *     sources: Array<{ name: string; classification: 'CUSTOMER_CONFIDENTIAL'; description: string }>,
 *   }
 */
export async function GET() {
  try {
    await getCurrentUser(); // require auth
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const configured = FreshworksDataProvider.isAvailable();
  const sources = listFreshworksSources().map((name) => ({
    name,
    classification: 'CUSTOMER_CONFIDENTIAL' as const,
    description: describeSource(name),
  }));

  return NextResponse.json({ configured, sources });
}

function describeSource(name: string): string {
  switch (name) {
    case 'freshsales_deals_by_stage':
      return 'Count of deals grouped by stage (bar chart).';
    case 'freshsales_open_deal_count':
      return 'KPI: count of currently-open deals.';
    case 'freshsales_pipeline_value':
      return 'KPI: total dollar value of open deals.';
    case 'freshsales_top_deals':
      return 'Top 10 open deals by amount (table).';
    case 'freshsales_contacts_recent':
      return 'Recent contacts (table). PII masked for VIEWER/CREATOR.';
    case 'freshsales_accounts_recent':
      return 'Recent accounts/companies (table).';
    default:
      return isFreshworksSource(name) ? '(no description)' : 'unknown source';
  }
}
