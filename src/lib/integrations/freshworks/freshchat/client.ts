/**
 * Freshchat — REST API client.
 *
 * API reference: https://developers.freshchat.com/api/
 *
 * Conversations are the primary resource. Each conversation has a status
 * ("new", "assigned", "resolved") and 0..N messages. We expose:
 *   - listConversations(filters) — list with status / channel filters
 *   - listUsers(filters)        — end-user (customer) records
 *
 * The conversations endpoint is paginated via cursor (`page` query param
 * for /v2/). We pull at most one page per call — analytics callers
 * shouldn't need deep history; cron-driven sync can fetch more if needed.
 */

import {
  getFreshchatConfig,
  isFreshchatConfigured,
  buildFreshchatAuthHeaders,
  describeFreshchatConfigForLog,
} from './config';
import {
  redactConversations,
  redactUsers,
  type FreshchatConversation,
  type FreshchatUser,
} from './redact';
import { freshworksFetch } from '../shared/http';
import { buildCacheKey, getOrLoad } from '../shared/cache';
import { auditFreshworksRead } from '../shared/audit';
import { FreshworksNotConfiguredError } from '../shared/errors';
import { rateLimitWindowSize } from '../shared/rate-limit';
import type { UserRole } from '../shared/redact';

const PRODUCT = 'freshchat' as const;

// ── List conversations ───────────────────────────────────────────────────────

export interface ListConversationsParams {
  limit?: number;
  status?: 'new' | 'assigned' | 'resolved';
}

export async function listConversations(
  userId: string,
  role: UserRole,
  params: ListConversationsParams = {}
): Promise<FreshchatConversation[]> {
  if (!isFreshchatConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshchatConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  if (params.status) filter.status = params.status;
  const key = buildCacheKey(PRODUCT, 'conversations', filter);

  const { value, hit } = await getOrLoad<FreshchatConversation[]>(
    key,
    cfg.cacheTtlSeconds,
    async () => {
      const qs = new URLSearchParams();
      qs.set('items_per_page', String(limit));
      if (params.status) qs.set('status', params.status);
      const data = await freshworksFetch<{
        conversations?: FreshchatConversation[];
      } | FreshchatConversation[]>({
        product: PRODUCT,
        baseUrl: cfg.baseUrl,
        path: `/v2/conversations?${qs.toString()}`,
        headers: buildFreshchatAuthHeaders(cfg),
        rateLimitPerMin: cfg.rateLimitPerMin,
        ctx: { userId, resource: 'conversations' },
      });
      if (Array.isArray(data)) return data;
      return data.conversations ?? [];
    }
  );

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'conversations',
    count: value.length,
    cacheHit: hit,
    filter: params.status ? `status=${params.status}` : undefined,
  }).catch(() => undefined);

  return redactConversations(value, role);
}

// ── List users (end customers) ──────────────────────────────────────────────

export interface ListUsersParams {
  limit?: number;
}

export async function listUsers(
  userId: string,
  role: UserRole,
  params: ListUsersParams = {}
): Promise<FreshchatUser[]> {
  if (!isFreshchatConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshchatConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  const key = buildCacheKey(PRODUCT, 'users', filter);

  const { value, hit } = await getOrLoad<FreshchatUser[]>(key, cfg.cacheTtlSeconds, async () => {
    const qs = new URLSearchParams();
    qs.set('items_per_page', String(limit));
    const data = await freshworksFetch<{ users?: FreshchatUser[] } | FreshchatUser[]>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/v2/users?${qs.toString()}`,
      headers: buildFreshchatAuthHeaders(cfg),
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

export function describeFreshchatClient(): Record<string, unknown> {
  if (!isFreshchatConfigured()) return { configured: false };
  return {
    ...describeFreshchatConfigForLog(getFreshchatConfig()),
    outboundWindowSize: rateLimitWindowSize(PRODUCT),
  };
}
