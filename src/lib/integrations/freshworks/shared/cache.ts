/**
 * Freshworks suite — shared Redis cache.
 *
 * Each product gets its own key namespace so flushes can be scoped:
 *   freshsales  → `fw-sales:*`
 *   freshdesk   → `fw-desk:*`
 *   freshcaller → `fw-call:*`
 *   freshchat   → `fw-chat:*`
 *
 * **TTL = 60 seconds** for ALL products (Game Plan §3 amendment 09:16 ET).
 * PII + chat content + ticket bodies + call recordings metadata must not
 * sit in Redis for the conventional 5-minute cache window. 60 s gives
 * meaningful rate-limit relief without creating a stale-data exposure
 * surface.
 *
 * Compliance refs:
 *   - Policy 3700 DR-01 (bounded retention)
 *   - Policy 3698 DC-02 (CC-tier data across all 4 products)
 *   - Gap G-05 closure (retention automation)
 */

import type { FreshworksProduct } from './errors';

// Optional Redis client — match the established pattern in `src/lib/redis/client.ts`
// (try/require to keep ioredis a soft dep).
let Redis: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Redis = require('ioredis');
} catch {
  Redis = null;
}

import { getRedisConfig, buildRedisConnectionOptions, isRedisConfigured } from '@/lib/redis/config';

/** Map a product to its cache key prefix (single source of truth). */
export const PRODUCT_CACHE_PREFIX: Record<FreshworksProduct, string> = {
  freshsales: 'fw-sales:',
  freshdesk: 'fw-desk:',
  freshcaller: 'fw-call:',
  freshchat: 'fw-chat:',
};

/** Combined prefix matcher for cross-product flushes (retention purge). */
export const FRESHWORKS_PREFIX_MATCHER = 'fw-*';

/** Lazy-initialized singleton client shared across all products. */
let freshworksRedis: any = null;
let initAttempted = false;

function getClient(): any {
  if (initAttempted) return freshworksRedis;
  initAttempted = true;
  if (!Redis || !isRedisConfigured()) {
    return null;
  }
  try {
    const opts = buildRedisConnectionOptions(getRedisConfig());
    freshworksRedis = new Redis(opts);
    freshworksRedis.on('error', (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[freshworks-cache] Redis error:', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[freshworks-cache] Redis init failed; caching disabled.', err);
    freshworksRedis = null;
  }
  return freshworksRedis;
}

export function isFreshworksCacheAvailable(): boolean {
  return getClient() !== null;
}

/** Canonical filter-fingerprint for cache keys. */
function fingerprintFilter(filter: Record<string, unknown> | undefined): string {
  if (!filter || Object.keys(filter).length === 0) return 'all';
  const sortedKeys = Object.keys(filter).sort();
  const parts: string[] = [];
  for (const k of sortedKeys) {
    const v = filter[k];
    const sv =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : JSON.stringify(v);
    parts.push(`${k}=${sv}`);
  }
  return parts.join('&');
}

/**
 * Build a fully-qualified cache key for a product + resource + filter.
 *
 * Example: `fw-desk:tickets:status=open&priority=high`
 */
export function buildCacheKey(
  product: FreshworksProduct,
  resource: string,
  filter?: Record<string, unknown>
): string {
  return `${PRODUCT_CACHE_PREFIX[product]}${resource}:${fingerprintFilter(filter)}`;
}

/**
 * Get-or-load with TTL.
 *
 * If Redis is unavailable, the loader is called every time (no-op cache).
 * Errors from Redis are swallowed — a failed cache must never break the
 * underlying read.
 */
export async function getOrLoad<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const client = getClient();
  if (!client) {
    const value = await loader();
    return { value, hit: false };
  }

  try {
    const cached = await client.get(key);
    if (cached) {
      try {
        return { value: JSON.parse(cached) as T, hit: true };
      } catch {
        // Corrupt JSON in cache — fall through to reload + overwrite.
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[freshworks-cache] GET ${key} failed; falling through.`, err);
  }

  const value = await loader();

  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[freshworks-cache] SET ${key} failed; result uncached.`, err);
  }

  return { value, hit: false };
}

/** Delete every cache entry whose key starts with the given prefix. */
async function flushByPrefix(prefix: string): Promise<number> {
  const client = getClient();
  if (!client) return 0;
  const keys: string[] = [];
  let cursor = '0';
  try {
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (batch?.length) keys.push(...batch);
    } while (cursor !== '0');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[freshworks-cache] SCAN ${prefix}* failed.`, err);
    return 0;
  }
  if (keys.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    try {
      const count = await client.del(...chunk);
      deleted += typeof count === 'number' ? count : 0;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[freshworks-cache] DEL chunk failed.', err);
    }
  }
  return deleted;
}

/** Flush a single product's cache. */
export async function flushProductCache(product: FreshworksProduct): Promise<number> {
  return flushByPrefix(PRODUCT_CACHE_PREFIX[product]);
}

/**
 * Flush ALL Freshworks-suite caches across every product.
 * Used by the retention purge endpoint and the demo Purge button.
 *
 * Implemented as a SCAN over the combined `fw-*` prefix matcher so we don't
 * issue 4 separate SCANs.
 */
export async function flushAllFreshworksCaches(): Promise<number> {
  return flushByPrefix('fw-');
}

/**
 * Backwards-compat name preserved for callers that already wired against the
 * pre-refactor module. New code should use `flushAllFreshworksCaches()`.
 */
export const flushFreshworksCache = flushAllFreshworksCaches;
