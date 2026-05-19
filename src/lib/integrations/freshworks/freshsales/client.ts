/**
 * Freshsales — REST API client.
 *
 * Thin typed wrapper. Auth, rate-limit, cache, audit, and redaction are
 * all handled by the shared layer. This file knows only the Freshsales
 * URL paths and response shapes.
 *
 * API reference: https://developers.freshworks.com/crm/api/
 */

import {
  getFreshsalesConfig,
  isFreshsalesConfigured,
  buildFreshsalesAuthHeaders,
  describeFreshsalesConfigForLog,
  type FreshsalesConfig,
} from './config';
import {
  redactContacts,
  redactDeals,
  redactAccounts,
  type FreshsalesContact,
  type FreshsalesDeal,
  type FreshsalesAccount,
} from './redact';
import { freshworksFetch } from '../shared/http';
import { buildCacheKey, getOrLoad } from '../shared/cache';
import { auditFreshworksRead } from '../shared/audit';
import { FreshworksNotConfiguredError } from '../shared/errors';
import { rateLimitWindowSize } from '../shared/rate-limit';
import type { UserRole } from '../shared/redact';

const PRODUCT = 'freshsales' as const;

// ── View discovery (Freshsales-specific) ─────────────────────────────────────
//
// Freshsales does NOT expose `/crm/sales/api/{resource}` as a list endpoint.
// Listings are only available via `/crm/sales/api/{resource}/view/{view_id}`,
// where `{view_id}` is the numeric ID of a saved filter ("All Contacts",
// "Open Deals", etc.). We discover view IDs once per process via the
// `/filters` endpoint and cache them in module memory.
//
// On first list call:
//   1. GET /crm/sales/api/{resource}/filters → returns array of saved views
//   2. Pick the most-permissive view (usually the first, labeled "All ..."
//      or named with `is_default: true`).
//   3. Memoize the view ID for the connector lifetime.

const viewCache: Record<'contacts' | 'deals' | 'sales_accounts', number | null | undefined> = {
  contacts: undefined,
  deals: undefined,
  sales_accounts: undefined,
};

interface FreshsalesFilter {
  id: number;
  name?: string | null;
  is_default?: boolean | null;
  default?: boolean | null;
}

async function discoverViewId(
  cfg: FreshsalesConfig,
  resource: 'contacts' | 'deals' | 'sales_accounts',
  ctx: { userId: string }
): Promise<number | null> {
  if (viewCache[resource] !== undefined) return viewCache[resource] ?? null;
  try {
    const data = await freshworksFetch<{ filters?: FreshsalesFilter[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/${resource}/filters`,
      headers: buildFreshsalesAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId: ctx.userId, resource: `${resource}.filters` },
    });
    const filters = data.filters ?? [];
    // Prefer an explicitly-default view; otherwise the first one.
    const def = filters.find((f) => f.is_default || f.default) ?? filters[0];
    viewCache[resource] = def ? def.id : null;
    return viewCache[resource] ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[freshsales] could not discover view for ${resource}; will return empty.`, err);
    viewCache[resource] = null;
    return null;
  }
}

export interface ListContactsParams {
  limit?: number;
  query?: string;
}

export async function listContacts(
  userId: string,
  role: UserRole,
  params: ListContactsParams = {}
): Promise<FreshsalesContact[]> {
  if (!isFreshsalesConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshsalesConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  if (params.query) filter.query = params.query;
  const key = buildCacheKey(PRODUCT, 'contacts', filter);

  const { value, hit } = await getOrLoad<FreshsalesContact[]>(key, cfg.cacheTtlSeconds, async () => {
    const viewId = await discoverViewId(cfg, 'contacts', { userId });
    if (viewId == null) return [];
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.query) qs.set('q', params.query);
    const data = await freshworksFetch<{ contacts?: FreshsalesContact[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/contacts/view/${viewId}?${qs.toString()}`,
      headers: buildFreshsalesAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'contacts' },
    });
    return data.contacts ?? [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'contacts',
    count: value.length,
    cacheHit: hit,
    filter: params.query ? `q=${params.query.length}c` : undefined,
  }).catch(() => undefined);

  return redactContacts(value, role);
}

export interface ListDealsParams {
  limit?: number;
  stage?: string;
}

export async function listDeals(
  userId: string,
  role: UserRole,
  params: ListDealsParams = {}
): Promise<FreshsalesDeal[]> {
  if (!isFreshsalesConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshsalesConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  if (params.stage) filter.stage = params.stage;
  const key = buildCacheKey(PRODUCT, 'deals', filter);

  const { value, hit } = await getOrLoad<FreshsalesDeal[]>(key, cfg.cacheTtlSeconds, async () => {
    const viewId = await discoverViewId(cfg, 'deals', { userId });
    if (viewId == null) return [];
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.stage) qs.set('q', params.stage);
    const data = await freshworksFetch<{ deals?: FreshsalesDeal[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/deals/view/${viewId}?${qs.toString()}`,
      headers: buildFreshsalesAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'deals' },
    });
    return data.deals ?? [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'deals',
    count: value.length,
    cacheHit: hit,
    filter: params.stage ? `stage=${params.stage}` : undefined,
  }).catch(() => undefined);

  return redactDeals(value, role);
}

export interface ListAccountsParams {
  limit?: number;
}

export async function listAccounts(
  userId: string,
  role: UserRole,
  params: ListAccountsParams = {}
): Promise<FreshsalesAccount[]> {
  if (!isFreshsalesConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshsalesConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  const key = buildCacheKey(PRODUCT, 'accounts', filter);

  const { value, hit } = await getOrLoad<FreshsalesAccount[]>(key, cfg.cacheTtlSeconds, async () => {
    const viewId = await discoverViewId(cfg, 'sales_accounts', { userId });
    if (viewId == null) return [];
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    const data = await freshworksFetch<{ sales_accounts?: FreshsalesAccount[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/sales_accounts/view/${viewId}?${qs.toString()}`,
      headers: buildFreshsalesAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'accounts' },
    });
    return data.sales_accounts ?? [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'accounts',
    count: value.length,
    cacheHit: hit,
  }).catch(() => undefined);

  return redactAccounts(value, role);
}

export function describeFreshsalesClient(): Record<string, unknown> {
  if (!isFreshsalesConfigured()) return { configured: false };
  return {
    ...describeFreshsalesConfigForLog(getFreshsalesConfig()),
    outboundWindowSize: rateLimitWindowSize(PRODUCT),
  };
}
