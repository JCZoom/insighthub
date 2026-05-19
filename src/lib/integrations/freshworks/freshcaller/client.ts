/**
 * Freshcaller — REST API client.
 *
 * API reference: https://support.freshcaller.com/support/solutions/articles/50000027841-api-documentation
 *
 * Note: the Freshcaller API is less stable than Freshsales/Freshdesk — the
 * `/api/v1/calls` shape has changed across releases. We defensively cast
 * the response and let the redactor handle missing fields.
 *
 * Status values observed in the wild:
 *   "completed", "missed", "abandoned", "voicemail", "no-answer", "busy",
 *   "failed", "in-progress"
 */

import {
  getFreshcallerConfig,
  isFreshcallerConfigured,
  buildFreshcallerAuthHeaders,
  describeFreshcallerConfigForLog,
} from './config';
import {
  redactCalls,
  redactUsers,
  type FreshcallerCall,
  type FreshcallerUser,
} from './redact';
import { freshworksFetch } from '../shared/http';
import { buildCacheKey, getOrLoad } from '../shared/cache';
import { auditFreshworksRead } from '../shared/audit';
import { FreshworksNotConfiguredError } from '../shared/errors';
import { rateLimitWindowSize } from '../shared/rate-limit';
import type { UserRole } from '../shared/redact';

const PRODUCT = 'freshcaller' as const;

// ── List calls ───────────────────────────────────────────────────────────────

export interface ListCallsParams {
  limit?: number;
  /** ISO date (yyyy-MM-dd). Returns calls from this date forward. */
  from?: string;
  /** ISO date (yyyy-MM-dd). Returns calls up to this date inclusive. */
  to?: string;
  /** Filter by status string. */
  status?: string;
}

export async function listCalls(
  userId: string,
  role: UserRole,
  params: ListCallsParams = {}
): Promise<FreshcallerCall[]> {
  if (!isFreshcallerConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshcallerConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const filter: Record<string, unknown> = { limit };
  if (params.from) filter.from = params.from;
  if (params.to) filter.to = params.to;
  if (params.status) filter.status = params.status;
  const key = buildCacheKey(PRODUCT, 'calls', filter);

  const { value, hit } = await getOrLoad<FreshcallerCall[]>(key, cfg.cacheTtlSeconds, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.status) qs.set('status', params.status);
    const data = await freshworksFetch<{ calls?: FreshcallerCall[] } | FreshcallerCall[]>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/api/v1/calls?${qs.toString()}`,
      headers: buildFreshcallerAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'calls' },
    });
    // Tolerate both shapes (bare array or { calls: [...] }).
    if (Array.isArray(data)) return data;
    return data.calls ?? [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'calls',
    count: value.length,
    cacheHit: hit,
    filter: params.status ? `status=${params.status}` : undefined,
  }).catch(() => undefined);

  return redactCalls(value, role);
}

// ── List users (agents) ──────────────────────────────────────────────────────

export interface ListUsersParams {
  limit?: number;
}

export async function listUsers(
  userId: string,
  role: UserRole,
  params: ListUsersParams = {}
): Promise<FreshcallerUser[]> {
  if (!isFreshcallerConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshcallerConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const filter: Record<string, unknown> = { limit };
  const key = buildCacheKey(PRODUCT, 'users', filter);

  const { value, hit } = await getOrLoad<FreshcallerUser[]>(key, cfg.cacheTtlSeconds, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    const data = await freshworksFetch<{ users?: FreshcallerUser[] } | FreshcallerUser[]>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/api/v1/users?${qs.toString()}`,
      headers: buildFreshcallerAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'users' },
    });
    if (Array.isArray(data)) return data;
    return data.users ?? [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'users',
    count: value.length,
    cacheHit: hit,
  }).catch(() => undefined);

  return redactUsers(value, role);
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export function describeFreshcallerClient(): Record<string, unknown> {
  if (!isFreshcallerConfigured()) return { configured: false };
  return {
    ...describeFreshcallerConfigForLog(getFreshcallerConfig()),
    outboundWindowSize: rateLimitWindowSize(PRODUCT),
  };
}
