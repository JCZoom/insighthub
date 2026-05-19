/**
 * Freshsales REST API client.
 *
 * Thin typed wrapper over `fetch` with:
 *   - process-wide outbound rate limit (separate from per-user limiter)
 *   - automatic Redis caching (60 s TTL per Game Plan §3.2 amendment)
 *   - automatic read audit logging
 *   - automatic field-level redaction for masked roles
 *   - no PII in error messages, no API key in logs
 *
 * API reference: https://developers.freshworks.com/crm/api/
 *
 * Compliance refs:
 *   - Policy 3701 ENC-01 (TLS, enforced by https:// + Node 18+ defaults)
 *   - Policy 3698 DC-02 (every CC read audit-logged)
 *   - Policy 3699 DD-05 (no destructive ops via this client today)
 *   - Gap G-05, G-08, G-26, V-01
 */

import {
  getFreshsalesConfig,
  isFreshsalesConfigured,
  buildAuthHeaders,
  describeConfigForLog,
} from './config';
import { buildCacheKey, getOrLoad } from './cache';
import {
  auditFreshworksRead,
  auditFreshworksRateLimited,
} from './audit';
import {
  redactContacts,
  redactDeals,
  redactAccounts,
  type UserRole,
  type FreshsalesContact,
  type FreshsalesDeal,
  type FreshsalesAccount,
} from './redact';

// ── Outbound rate limiter ────────────────────────────────────────────────────
// Process-wide sliding window. Not per-user — this protects the upstream API
// from our aggregate traffic. Freshsales free tier ceiling: 100/min; we set
// our ceiling at 60/min (configurable via FRESHSALES_RATE_LIMIT_PER_MIN).

const outboundWindow: number[] = []; // timestamps in ms
const WINDOW_MS = 60_000;

function rateLimitAcquire(maxPerMin: number): boolean {
  const now = Date.now();
  // Drop expired entries.
  while (outboundWindow.length > 0 && outboundWindow[0] < now - WINDOW_MS) {
    outboundWindow.shift();
  }
  if (outboundWindow.length >= maxPerMin) return false;
  outboundWindow.push(now);
  return true;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class FreshsalesError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly bodyPreview: string
  ) {
    super(message);
    this.name = 'FreshsalesError';
  }
}

export class FreshsalesNotConfiguredError extends Error {
  constructor() {
    super('Freshsales connector is not configured (missing FRESHSALES_API_KEY or FRESHSALES_DOMAIN).');
    this.name = 'FreshsalesNotConfiguredError';
  }
}

export class FreshsalesRateLimitError extends Error {
  constructor() {
    super('Freshsales outbound rate limit exceeded (process-wide).');
    this.name = 'FreshsalesRateLimitError';
  }
}

// ── Core fetch ───────────────────────────────────────────────────────────────

/**
 * Internal raw fetch wrapper. Never returns PII in errors.
 *
 * Generic on the response shape. Callers should pass a Zod-like guard or
 * accept the result as `unknown` and narrow downstream — our resource
 * helpers below do the latter.
 */
async function freshsalesFetch<T = unknown>(
  path: string,
  ctx: { userId: string; resource: string }
): Promise<T> {
  if (!isFreshsalesConfigured()) {
    throw new FreshsalesNotConfiguredError();
  }

  const cfg = getFreshsalesConfig();

  if (!rateLimitAcquire(cfg.rateLimitPerMin)) {
    // Best-effort audit; don't await long.
    auditFreshworksRateLimited({ userId: ctx.userId, resource: ctx.resource }).catch(
      () => undefined
    );
    throw new FreshsalesRateLimitError();
  }

  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = buildAuthHeaders(cfg);

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  } catch (err) {
    // Network-level error. Do NOT include the URL in the message — it
    // contains the tenant domain, which is mildly sensitive.
    throw new FreshsalesError(
      `Freshsales network error (${(err as Error).message})`,
      0,
      ''
    );
  }

  if (!res.ok) {
    // Read a SMALL preview of the body for diagnostics. Truncated to 240
    // chars so we don't risk dragging PII into error logs.
    let bodyPreview = '';
    try {
      bodyPreview = (await res.text()).slice(0, 240);
    } catch {
      bodyPreview = '<could not read body>';
    }
    throw new FreshsalesError(
      `Freshsales API ${res.status} for ${ctx.resource}`,
      res.status,
      bodyPreview
    );
  }

  return (await res.json()) as T;
}

// ── Resource: contacts ───────────────────────────────────────────────────────

export interface ListContactsParams {
  /** Up to 100 per Freshsales API. */
  limit?: number;
  /** Free-text search query (passed through to Freshsales `query` param). */
  query?: string;
}

export async function listContacts(
  userId: string,
  role: UserRole,
  params: ListContactsParams = {}
): Promise<FreshsalesContact[]> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  if (params.query) filter.query = params.query;
  const key = buildCacheKey('contacts', filter);

  const { value, hit } = await getOrLoad<FreshsalesContact[]>(key, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.query) qs.set('q', params.query);
    const data = await freshsalesFetch<{ contacts?: FreshsalesContact[] }>(
      `/crm/sales/api/contacts?${qs.toString()}`,
      { userId, resource: 'contacts' }
    );
    return data.contacts ?? [];
  });

  // Audit read (best-effort; don't block response).
  auditFreshworksRead({
    userId,
    resource: 'contacts',
    count: value.length,
    cacheHit: hit,
    filter: params.query ? `q=${params.query.length}c` : undefined,
  }).catch(() => undefined);

  // Apply redaction at the edge of the connector — outside callers receive
  // already-masked data when role is below the visibility threshold.
  return redactContacts(value, role);
}

// ── Resource: deals ──────────────────────────────────────────────────────────

export interface ListDealsParams {
  limit?: number;
  /** Filter by stage name fragment, e.g. "open", "won", "lost". */
  stage?: string;
}

export async function listDeals(
  userId: string,
  role: UserRole,
  params: ListDealsParams = {}
): Promise<FreshsalesDeal[]> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  if (params.stage) filter.stage = params.stage;
  const key = buildCacheKey('deals', filter);

  const { value, hit } = await getOrLoad<FreshsalesDeal[]>(key, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    if (params.stage) qs.set('q', params.stage);
    const data = await freshsalesFetch<{ deals?: FreshsalesDeal[] }>(
      `/crm/sales/api/deals?${qs.toString()}`,
      { userId, resource: 'deals' }
    );
    return data.deals ?? [];
  });

  auditFreshworksRead({
    userId,
    resource: 'deals',
    count: value.length,
    cacheHit: hit,
    filter: params.stage ? `stage=${params.stage}` : undefined,
  }).catch(() => undefined);

  return redactDeals(value, role);
}

// ── Resource: accounts ───────────────────────────────────────────────────────

export interface ListAccountsParams {
  limit?: number;
}

export async function listAccounts(
  userId: string,
  role: UserRole,
  params: ListAccountsParams = {}
): Promise<FreshsalesAccount[]> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 25));
  const filter: Record<string, unknown> = { limit };
  const key = buildCacheKey('accounts', filter);

  const { value, hit } = await getOrLoad<FreshsalesAccount[]>(key, async () => {
    const qs = new URLSearchParams();
    qs.set('per_page', String(limit));
    const data = await freshsalesFetch<{ sales_accounts?: FreshsalesAccount[] }>(
      `/crm/sales/api/sales_accounts?${qs.toString()}`,
      { userId, resource: 'accounts' }
    );
    return data.sales_accounts ?? [];
  });

  auditFreshworksRead({
    userId,
    resource: 'accounts',
    count: value.length,
    cacheHit: hit,
  }).catch(() => undefined);

  return redactAccounts(value, role);
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

/**
 * Returns a safe-to-log description of the client state. Used by the admin
 * diagnostics page and the demo dry-run.
 */
export function describeFreshsalesClient(): Record<string, unknown> {
  if (!isFreshsalesConfigured()) {
    return { configured: false };
  }
  return {
    ...describeConfigForLog(getFreshsalesConfig()),
    outboundWindowSize: outboundWindow.length,
  };
}
