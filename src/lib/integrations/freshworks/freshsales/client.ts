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
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.query) qs.set('q', params.query);
    const data = await freshworksFetch<{ contacts?: FreshsalesContact[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/contacts?${qs.toString()}`,
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
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.stage) qs.set('q', params.stage);
    const data = await freshworksFetch<{ deals?: FreshsalesDeal[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/deals?${qs.toString()}`,
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
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    const data = await freshworksFetch<{ sales_accounts?: FreshsalesAccount[] }>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/crm/sales/api/sales_accounts?${qs.toString()}`,
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
