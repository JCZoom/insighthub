import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  isFreshworksSource,
  listFreshworksSources,
  sourceProduct,
  FreshworksDataProvider,
} from '@/lib/data/freshworks-data-provider';

/**
 * GET /api/freshworks/sources
 *
 * Returns the catalog of Freshworks data sources available across the
 * suite. Every authenticated user gets the catalog; redaction happens at
 * the data layer based on role, not at the catalog layer.
 *
 * Response:
 *   {
 *     productsConfigured: { freshsales: boolean, freshdesk: ..., freshcaller: ..., freshchat: ... },
 *     sources: Array<{
 *       name: string,
 *       product: 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat',
 *       classification: 'CUSTOMER_CONFIDENTIAL',
 *       description: string,
 *       enabled: boolean   // false if the source's product is not configured
 *     }>
 *   }
 */
export async function GET() {
  try {
    await getCurrentUser();
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const productsConfigured = FreshworksDataProvider.productAvailability();
  const sources = listFreshworksSources().map((name) => {
    const product = sourceProduct(name);
    return {
      name,
      product,
      classification: 'CUSTOMER_CONFIDENTIAL' as const,
      description: describeSource(name),
      enabled: productsConfigured[product],
    };
  });

  return NextResponse.json({ productsConfigured, sources });
}

function describeSource(name: string): string {
  switch (name) {
    // Freshsales
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
    // Freshdesk
    case 'freshdesk_tickets_by_status':
      return 'Count of tickets grouped by status (bar chart).';
    case 'freshdesk_open_ticket_count':
      return 'KPI: count of tickets in non-terminal states.';
    case 'freshdesk_overdue_ticket_count':
      return 'KPI: tickets past their due_by timestamp.';
    case 'freshdesk_recent_tickets':
      return 'Top 10 most-recently-updated tickets (table). PII masked.';
    case 'freshdesk_agents':
      return 'Support agents (table). PII masked.';
    // Freshcaller
    case 'freshcaller_calls_today':
      return 'KPI: count of calls created today (UTC).';
    case 'freshcaller_calls_by_status':
      return 'Count of calls grouped by status (bar chart).';
    case 'freshcaller_recent_calls':
      return 'Top 10 most-recent calls (table). Phone numbers masked.';
    // Freshchat
    case 'freshchat_active_conversations':
      return 'KPI: count of conversations in new/assigned states.';
    case 'freshchat_conversations_by_status':
      return 'Count of conversations grouped by status (bar chart).';
    case 'freshchat_recent_conversations':
      return 'Top 10 most-recently-updated conversations (table). Message bodies masked.';
    default:
      return isFreshworksSource(name) ? '(no description)' : 'unknown source';
  }
}
