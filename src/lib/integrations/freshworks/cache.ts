/**
 * Freshsales connector — Redis cache.
 *
 * Top-tier hardening (per Game Plan §3.2 amendment, 2026-05-19 09:16 ET):
 *   **TTL = 60 seconds.** PII + customer chat content must not sit in Redis
 *   for the conventional 5-minute cache window. 60 s gives meaningful
 *   rate-limit relief (a refreshing dashboard hits Redis instead of the API)
 *   without creating a stale-data exposure surface.
 *
 * Key shape: `fw:<resource>:<filter-fingerprint>`
 *   - `fw:contacts:all` — full contact list (rare, expensive)
 *   - `fw:deals:stage=open` — filtered deal list
 *   - `fw:account:<id>` — single account by id
 *
 * The `fw:` prefix is also what `purgeFreshworksCache()` in
 * `src/lib/data/retention.ts:343-427` uses for bulk-wipe. Keep them
 * consistent.
 *
 * Compliance refs:
 *   - Policy 3700 DR-01 (bounded retention)
 *   - Policy 3698 DC-02 (CC tier data, see Freshsales asset INFO-25)
 *   - Gap G-05 closure
 */

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
import { getFreshsalesConfig } from './config';

const KEY_PREFIX = 'fw:';

/** Lazy-initialized singleton client for the Freshsales cache. */
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

/** Whether the cache is usable right now. */
export function isFreshworksCacheAvailable(): boolean {
  return getClient() !== null;
}

/**
 * Compute a stable, opaque key fragment from an arbitrary filter object.
 *
 * We sort keys to make the result canonical, then JSON-stringify, then
 * collapse to a fixed-length-ish slug. This is NOT a security-critical
 * hash (no PII goes through it) — just a cache key.
 */
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
 * Build a fully-qualified cache key.
 *
 * Example: `fw:deals:stage=open&owner=42`
 */
export function buildCacheKey(
  resource: string,
  filter?: Record<string, unknown>
): string {
  return `${KEY_PREFIX}${resource}:${fingerprintFilter(filter)}`;
}

/**
 * Get-or-load with TTL.
 *
 * If Redis is unavailable, the loader is called every time (no-op cache).
 * If the key is present, the JSON-parsed value is returned and `hit=true`.
 * Otherwise the loader runs, the result is cached, and `hit=false`.
 *
 * Errors from Redis are swallowed — a failed cache must never break the
 * underlying read. The caller still gets correct data from the loader.
 */
export async function getOrLoad<T>(
  key: string,
  loader: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const client = getClient();
  if (!client) {
    const value = await loader();
    return { value, hit: false };
  }

  // Try the cache first.
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
    console.warn(`[freshworks-cache] GET ${key} failed; falling through to loader.`, err);
  }

  const value = await loader();

  // Best-effort SET; bound the TTL strictly to the connector config.
  try {
    const ttl = getFreshsalesConfig().cacheTtlSeconds;
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[freshworks-cache] SET ${key} failed; result returned uncached.`, err);
  }

  return { value, hit: false };
}

/**
 * Delete all cache entries for the Freshsales connector.
 *
 * Used by:
 *   - `purgeFreshworksCache()` in `src/lib/data/retention.ts`
 *   - The demo retention story (live wipe + re-fetch)
 *
 * Returns the count of keys deleted, or 0 if Redis is unavailable.
 */
export async function flushFreshworksCache(): Promise<number> {
  const client = getClient();
  if (!client) return 0;

  const keys: string[] = [];
  let cursor = '0';
  try {
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100);
      cursor = next;
      if (batch?.length) keys.push(...batch);
    } while (cursor !== '0');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[freshworks-cache] SCAN failed during flush.', err);
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
      console.warn('[freshworks-cache] DEL chunk failed; continuing.', err);
    }
  }
  return deleted;
}
