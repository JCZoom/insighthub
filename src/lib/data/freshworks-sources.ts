/**
 * Freshworks source-name registry — CLIENT-SAFE.
 *
 * Pure constants + pure type guards. Zero runtime dependencies, zero
 * imports of server-only modules (no ioredis, no fs, no integration
 * clients). Safe to import from React Client Components, hooks, and
 * anywhere else that runs in the browser bundle.
 *
 * Why this file exists separately from `freshworks-data-provider.ts`:
 *   The provider module imports the integration clients
 *   (`@/lib/integrations/freshworks/*`) which transitively import
 *   `ioredis` for the server-side cache. Pulling
 *   `freshworks-data-provider` into a client bundle therefore tries
 *   to bundle `ioredis` → `dns`/`fs`/`net` → build error in
 *   Turbopack/webpack ("Module not found: Can't resolve 'dns'").
 *
 *   The fix is the standard Next.js split: keep server logic in one
 *   module, keep the pure naming/type concerns the client needs in a
 *   separate module that has no transitive server dependencies.
 *
 * Source of truth note: the canonical list lives here. The provider
 * module re-exports `FRESHWORKS_SOURCES`, `FreshworksSource`,
 * `isFreshworksSource`, `listFreshworksSources`, and `sourceProduct`
 * for backward compatibility with all existing server-side imports.
 */

export const FRESHWORKS_SOURCES = [
  // Freshsales
  'freshsales_deals_by_stage',
  'freshsales_open_deal_count',
  'freshsales_pipeline_value',
  'freshsales_top_deals',
  'freshsales_contacts_recent',
  'freshsales_accounts_recent',
  // Freshdesk
  'freshdesk_tickets_by_status',
  'freshdesk_open_ticket_count',
  'freshdesk_overdue_ticket_count',
  'freshdesk_recent_tickets',
  'freshdesk_agents',
  // Freshcaller
  'freshcaller_calls_today',
  'freshcaller_calls_by_status',
  'freshcaller_recent_calls',
  // Freshchat
  'freshchat_active_conversations',
  'freshchat_conversations_by_status',
  'freshchat_recent_conversations',
] as const;

export type FreshworksSource = (typeof FRESHWORKS_SOURCES)[number];

export function isFreshworksSource(name: string): name is FreshworksSource {
  return (FRESHWORKS_SOURCES as readonly string[]).includes(name);
}

export function listFreshworksSources(): readonly FreshworksSource[] {
  return FRESHWORKS_SOURCES;
}

/** Which Freshworks product owns this source name (for routing + UI tabs). */
export function sourceProduct(
  name: FreshworksSource
): 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat' {
  if (name.startsWith('freshsales_')) return 'freshsales';
  if (name.startsWith('freshdesk_')) return 'freshdesk';
  if (name.startsWith('freshcaller_')) return 'freshcaller';
  if (name.startsWith('freshchat_')) return 'freshchat';
  // Unreachable given the literal-union type, but defensive.
  throw new Error(`Cannot determine product for source: ${name}`);
}
