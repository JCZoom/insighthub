/**
 * Freshdesk — REST API client.
 *
 * API reference: https://developers.freshdesk.com/api/
 *
 * Key endpoints used:
 *   GET /api/v2/tickets             — list tickets (paginated, default 30/page)
 *   GET /api/v2/tickets?updated_since=... — incremental sync
 *   GET /api/v2/agents              — list agents
 *   GET /api/v2/tickets/<id>/conversations — replies on a ticket (NOT exposed
 *       at the source level today; would be a separate source with deeper
 *       redaction).
 *
 * Status code mapping (Freshdesk numeric → human label):
 *   2 = Open, 3 = Pending, 4 = Resolved, 5 = Closed, 6 = Waiting on Customer,
 *   7 = Waiting on Third Party.
 *
 * Priority mapping: 1 = Low, 2 = Medium, 3 = High, 4 = Urgent.
 */

import {
  getFreshdeskConfig,
  isFreshdeskConfigured,
  buildFreshdeskAuthHeaders,
  describeFreshdeskConfigForLog,
} from './config';
import {
  redactTickets,
  redactAgents,
  type FreshdeskTicket,
  type FreshdeskAgent,
} from './redact';
import { freshworksFetch } from '../shared/http';
import { buildCacheKey, getOrLoad } from '../shared/cache';
import { auditFreshworksRead } from '../shared/audit';
import { FreshworksNotConfiguredError } from '../shared/errors';
import { rateLimitWindowSize } from '../shared/rate-limit';
import type { UserRole } from '../shared/redact';

const PRODUCT = 'freshdesk' as const;

// ── Status / priority decoders for downstream callers ────────────────────────

export const FRESHDESK_STATUS: Record<number, string> = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed',
  6: 'Waiting on Customer',
  7: 'Waiting on Third Party',
};

export const FRESHDESK_PRIORITY: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent',
};

export function ticketIsOpen(t: FreshdeskTicket): boolean {
  // Open or Pending or any "waiting" state counts as open. Resolved/Closed don't.
  if (t.status == null) return false;
  return t.status !== 4 && t.status !== 5;
}

export function ticketIsOverdue(t: FreshdeskTicket, now = new Date()): boolean {
  if (!ticketIsOpen(t)) return false;
  if (!t.due_by) return false;
  return new Date(t.due_by).getTime() < now.getTime();
}

// ── List tickets ─────────────────────────────────────────────────────────────

export interface ListTicketsParams {
  /** Up to 100 per Freshdesk API. */
  limit?: number;
  /** ISO timestamp; only return tickets updated after this. */
  updatedSince?: string;
  /** Filter by Freshdesk numeric status (2=Open, etc.). */
  status?: number;
  /** Include sub-objects in the response (e.g. 'requester'). */
  include?: 'requester' | 'stats' | 'description';
}

export async function listTickets(
  userId: string,
  role: UserRole,
  params: ListTicketsParams = {}
): Promise<FreshdeskTicket[]> {
  if (!isFreshdeskConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshdeskConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 30));
  const filter: Record<string, unknown> = { limit };
  if (params.updatedSince) filter.updated_since = params.updatedSince;
  if (params.status != null) filter.status = params.status;
  if (params.include) filter.include = params.include;
  const key = buildCacheKey(PRODUCT, 'tickets', filter);

  const { value, hit } = await getOrLoad<FreshdeskTicket[]>(key, cfg.cacheTtlSeconds, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.updatedSince) qs.set('updated_since', params.updatedSince);
    if (params.include) qs.set('include', params.include);
    // Freshdesk uses 'status' as a numeric filter via /tickets?status=2
    if (params.status != null) qs.set('status', String(params.status));
    const data = await freshworksFetch<FreshdeskTicket[]>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/api/v2/tickets?${qs.toString()}`,
      headers: buildFreshdeskAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'tickets' },
    });
    // Freshdesk returns a bare array, NOT a wrapped object.
    return Array.isArray(data) ? data : [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'tickets',
    count: value.length,
    cacheHit: hit,
    filter: params.status != null ? `status=${params.status}` : undefined,
  }).catch(() => undefined);

  return redactTickets(value, role);
}

// ── Search tickets (authoritative counts) ────────────────────────────────────

export interface SearchTicketsParams {
  /**
   * Freshdesk search query language. Examples:
   *   - "status:2"                              — single status
   *   - "status:2 OR status:3"                  — multiple statuses
   *   - "(status:2 OR status:3) AND priority:4" — boolean composition
   *   - "due_by:<'2026-05-28'"                  — date comparison
   * The wrapping double-quotes that Freshdesk's API requires are added
   * by this function — pass the raw query body only.
   * Docs: https://developers.freshdesk.com/api/#filter_tickets
   */
  query: string;
}

export interface SearchTicketsResult {
  /**
   * Authoritative total count of all matching tickets in the tenant.
   * This is the true count even when `results` is capped at 30 per page
   * (300 total) — that's what makes the search endpoint suitable for
   * driving KPI cards and status distributions.
   */
  total: number;
  /** Up to 30 sample ticket rows from the first page. May be empty when only the count is needed. */
  results: FreshdeskTicket[];
}

/**
 * Query the Freshdesk search index for tickets matching a filter.
 *
 * WHY THIS EXISTS: `listTickets()` is a paginated list of the most
 * recently updated 100 tickets — it CANNOT give a true count of a
 * population larger than 100. The search endpoint can, via its
 * `total` field, and is the right primitive for KPI/distribution
 * sources. See `docs/FRESHDESK_WINDOWING_FINDING_2026-05-28.md` for the
 * full motivation.
 *
 * The search index is "near-real-time" per Freshdesk docs; counts may
 * lag the source of truth by tens of seconds. For hourly+ dashboards
 * this is well within tolerance.
 */
export async function searchTickets(
  userId: string,
  role: UserRole,
  params: SearchTicketsParams
): Promise<SearchTicketsResult> {
  if (!isFreshdeskConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshdeskConfig();
  const filter: Record<string, unknown> = { search: params.query };
  const key = buildCacheKey(PRODUCT, 'search-tickets', filter);

  const { value, hit } = await getOrLoad<SearchTicketsResult>(
    key,
    cfg.cacheTtlSeconds,
    async () => {
      // Freshdesk requires the query body to be wrapped in literal
      // double-quotes: ?query="status:2"
      const qs = new URLSearchParams();
      qs.set('query', `"${params.query}"`);
      const data = await freshworksFetch<Partial<SearchTicketsResult>>({
        product: PRODUCT,
        baseUrl: cfg.baseUrl,
        path: `/api/v2/search/tickets?${qs.toString()}`,
        headers: buildFreshdeskAuthHeaders(cfg),
        rateLimitPerMin: cfg.rateLimitPerMin,
        ctx: { userId, resource: 'search-tickets' },
      });
      return {
        total: typeof data?.total === 'number' ? data.total : 0,
        results: Array.isArray(data?.results) ? data.results : [],
      };
    }
  );

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'search-tickets',
    count: value.total,
    cacheHit: hit,
    filter: params.query,
  }).catch(() => undefined);

  return {
    total: value.total,
    results: redactTickets(value.results, role),
  };
}

// ── List agents ──────────────────────────────────────────────────────────────

export interface ListAgentsParams {
  limit?: number;
}

export async function listAgents(
  userId: string,
  role: UserRole,
  params: ListAgentsParams = {}
): Promise<FreshdeskAgent[]> {
  if (!isFreshdeskConfigured()) throw new FreshworksNotConfiguredError(PRODUCT);
  const cfg = getFreshdeskConfig();
  const limit = Math.max(1, Math.min(100, params.limit ?? 30));
  const filter: Record<string, unknown> = { limit };
  const key = buildCacheKey(PRODUCT, 'agents', filter);

  const { value, hit } = await getOrLoad<FreshdeskAgent[]>(key, cfg.cacheTtlSeconds, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    const data = await freshworksFetch<FreshdeskAgent[]>({
      product: PRODUCT,
      baseUrl: cfg.baseUrl,
      path: `/api/v2/agents?${qs.toString()}`,
      headers: buildFreshdeskAuthHeaders(cfg),
      rateLimitPerMin: cfg.rateLimitPerMin,
      ctx: { userId, resource: 'agents' },
    });
    return Array.isArray(data) ? data : [];
  });

  auditFreshworksRead({
    userId,
    product: PRODUCT,
    resource: 'agents',
    count: value.length,
    cacheHit: hit,
  }).catch(() => undefined);

  return redactAgents(value, role);
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export function describeFreshdeskClient(): Record<string, unknown> {
  if (!isFreshdeskConfigured()) return { configured: false };
  return {
    ...describeFreshdeskConfigForLog(getFreshdeskConfig()),
    outboundWindowSize: rateLimitWindowSize(PRODUCT),
  };
}
