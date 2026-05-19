/**
 * Freshworks suite — shared HTTP fetch wrapper.
 *
 * All 4 product clients (Freshsales, Freshdesk, Freshcaller, Freshchat)
 * funnel their outbound requests through `freshworksFetch`. That gives us
 * exactly one place that enforces:
 *   - Outbound rate limiting (per product, sliding window)
 *   - Audit logging for rate-limit rejections
 *   - Network-level error wrapping with PII-safe messages
 *   - TLS via `https://` (Node 18+ undici defaults; no plaintext)
 *
 * Auth header construction is intentionally NOT here — each product passes
 * an already-built headers object because the schemes differ:
 *   Freshsales:    Authorization: Token token=<key>
 *   Freshdesk:     Authorization: Basic base64(<key>:X)
 *   Freshcaller:   X-Api-Auth: <key>
 *   Freshchat:     Authorization: Bearer <key>
 */

import {
  FreshworksError,
  FreshworksRateLimitError,
  type FreshworksProduct,
} from './errors';
import { rateLimitAcquire } from './rate-limit';
import { auditFreshworksRateLimited } from './audit';

export interface FreshworksFetchOptions {
  product: FreshworksProduct;
  baseUrl: string;
  path: string;
  headers: Record<string, string>;
  /** Process-wide outbound calls per minute for this product. */
  rateLimitPerMin: number;
  /** Used to audit rate-limit rejections; not logged on success. */
  ctx: { userId: string; resource: string };
  /** HTTP method (default GET). */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Optional JSON body for mutating requests. */
  body?: unknown;
}

/**
 * Perform a Freshworks API call.
 *
 * Throws:
 *   - `FreshworksRateLimitError` if the product's window is full.
 *   - `FreshworksError(status=0, ...)` on network-level failures.
 *   - `FreshworksError(status=4xx/5xx, ...)` on non-OK HTTP responses.
 *
 * Never returns PII in error messages. Body previews are capped at 240 chars
 * to keep diagnostic output bounded.
 */
export async function freshworksFetch<T = unknown>(
  opts: FreshworksFetchOptions
): Promise<T> {
  const {
    product,
    baseUrl,
    path,
    headers,
    rateLimitPerMin,
    ctx,
    method = 'GET',
    body,
  } = opts;

  if (!rateLimitAcquire(product, rateLimitPerMin)) {
    // Best-effort audit; don't await long.
    auditFreshworksRateLimited({ userId: ctx.userId, product, resource: ctx.resource }).catch(
      () => undefined
    );
    throw new FreshworksRateLimitError(product);
  }

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network-level error. Do NOT include the URL in the message — it
    // contains the tenant domain, which is mildly sensitive.
    throw new FreshworksError(
      `Freshworks ${product} network error (${(err as Error).message})`,
      product,
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
    throw new FreshworksError(
      `Freshworks ${product} API ${res.status} for ${ctx.resource}`,
      product,
      res.status,
      bodyPreview
    );
  }

  // 204 No Content has no body to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
