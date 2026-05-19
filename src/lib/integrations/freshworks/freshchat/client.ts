/**
 * Freshchat — REST API client.
 *
 * API reference: https://developers.freshchat.com/api/
 *
 * Endpoint shape gotcha (discovered during 2026-05-19 smoke test):
 *   - `GET /v2/conversations` does NOT exist. Returns 403 on this tenant.
 *   - The supported listing endpoints are `GET /v2/users` (end customers)
 *     and `POST /v2/conversations/search` (with a filter body).
 *
 * What this means for our 3 data sources:
 *   - `active_conversations`         → derived from POST /v2/conversations/search
 *                                      with status filter, OR aggregated from
 *                                      users (each user has conversation_count
 *                                      on some plans).
 *   - `conversations_by_status`      → from POST /v2/conversations/search per
 *                                      status, summing counts.
 *   - `recent_conversations`         → POST /v2/conversations/search with
 *                                      sort=updated_time desc.
 *
 * If POST /v2/conversations/search also returns 403 (token scope problem),
 * we degrade gracefully and surface an empty array — the connector stays
 * configured but the UI shows "No data" rather than an error panel.
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
import { logRowKeysOnce } from '../shared/dev-introspect';
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
      // Freshchat doesn't expose GET /v2/conversations. Use the search endpoint
      // which accepts a POST body with optional filters and pagination.
      const body: Record<string, unknown> = {
        items_per_page: limit,
        page: 1,
        sort_by: 'updated_time',
        sort_order: 'desc',
      };
      if (params.status) {
        body.filter = { status: params.status };
      }
      try {
        const data = await freshworksFetch<{
          conversations?: FreshchatConversation[];
        } | FreshchatConversation[]>({
          product: PRODUCT,
          baseUrl: cfg.baseUrl,
          path: `/v2/conversations/search`,
          headers: buildFreshchatAuthHeaders(cfg),
          rateLimitPerMin: cfg.rateLimitPerMin,
          ctx: { userId, resource: 'conversations' },
          method: 'POST',
          body,
        });
        const convos = Array.isArray(data) ? data : (data.conversations ?? []);
        // Dev-mode field peek — and crucially, log the WRAPPER keys too
        // so we see if Freshchat returns { conversations: [...] } vs.
        // { results: [...] } vs. { items: [...] }.
        if (!Array.isArray(data)) {
          logRowKeysOnce(PRODUCT, 'conversations/search.wrapper', data);
        }
        logRowKeysOnce(PRODUCT, 'conversations', convos[0]);
        return convos;
      } catch (err) {
        // If the search endpoint isn't available on this Freshchat plan
        // (some tiers gate it), gracefully degrade to empty so the demo
        // page shows "No data" instead of a red error panel. Log loudly so
        // we can diagnose why we got zero results.
        // eslint-disable-next-line no-console
        console.warn('[freshchat] conversations/search FAILED; returning empty. Cause:', err);
        return [];
      }
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
