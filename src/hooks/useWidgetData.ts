'use client';

import { useEffect, useState } from 'react';
import { queryDataSync } from '@/lib/data/sample-data';
import { isFreshworksSource } from '@/lib/data/freshworks-sources';
import { isPlatformHealthSource } from '@/lib/data/platform-health-sources';

/**
 * useWidgetData — fetch widget rows from the right data provider.
 *
 * Routing logic mirrors the server-side `queryDataWithProvider()` in
 * `src/lib/data/snowflake-data-provider.ts`:
 *
 *   1. Freshworks sources (`freshsales_*`, `freshdesk_*`, `freshcaller_*`,
 *      `freshchat_*`)  →  POST /api/data/query  →  FreshworksDataProvider
 *      (live, cached, audited, classified, RBAC-gated).
 *
 *   2. Platform Health sources (`platform_*`)  →  POST /api/data/query
 *      →  PlatformHealthDataProvider (Prisma-backed; honest internal
 *      counts of users, dashboards, audit activity, glossary coverage,
 *      classification distribution).
 *
 *   3. Everything else (sample-data sources, future Snowflake sources) →
 *      sync `queryDataSync()` against the in-process sample-data
 *      generators. No network hop, no flash, no risk of regression in
 *      the >60 widgets that already work fine off sample data today.
 *
 * Why split the path:
 *   - Sample-data sources are deterministic, in-process, and cheap. Going
 *     async for them would introduce a loading flash and >60 unnecessary
 *     fetches per dashboard view, with zero benefit (the API would just
 *     re-run the same generator on the server).
 *   - Freshworks + Platform Health sources MUST go through the API. For
 *     Freshworks, vendor secrets, audit logger, and the 60-s server-side
 *     cache only exist server-side. For Platform Health, the Prisma
 *     client only exists server-side. Calling either from the browser
 *     is a non-starter.
 *
 * Cache: client-side module-level Map, keyed by (source, groupBy, limit)
 * with a 30-s TTL. This is the *outer* cache; the FreshworksDataProvider
 * has its own 60-s server-side cache layered underneath. Net effect: a
 * dashboard with 10 widgets pointing at the same Freshworks source makes
 * exactly 1 API call across the dashboard's lifetime (until either
 * cache expires).
 */

interface CacheEntry {
  data: Record<string, unknown>[];
  ts: number;
  /** Server-asserted fetched_at (ISO) — honest as-of for the freshness widget. */
  fetchedAt: Date | null;
  /** Server-asserted: was THIS request served from a server-side cache. */
  fromCache: boolean | null;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

export interface UseWidgetDataResult {
  data: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  /**
   * Honest "as-of" timestamp for the data. For Freshworks sources this is
   * the server-side response time of the API call; for sample-data sources
   * it is the local fetch time. Null when no fetch has completed (initial
   * loading state). The DataFreshness widget renders only when this is set
   * — we never fabricate a timestamp.
   */
  fetchedAt: Date | null;
  /**
   * True when the underlying API response was served from the server-side
   * cache layer. Sample-data path is always `false` (no cache there).
   * Surfaced in the DataFreshness tooltip for transparency.
   */
  fromCache: boolean | null;
}

/**
 * Predicate: this source must be fetched via POST /api/data/query
 * (Freshworks or Platform Health). Anything else flows through the
 * synchronous in-process sample-data generators.
 */
function requiresServerFetch(source: string): boolean {
  return isFreshworksSource(source) || isPlatformHealthSource(source);
}

export function useWidgetData(
  source: string,
  groupBy?: string[],
  limit?: number,
): UseWidgetDataResult {
  const isServerFetched = source ? requiresServerFetch(source) : false;
  const groupByKey = JSON.stringify(groupBy ?? []);

  // Initial state: for sample sources, populate synchronously from the
  // generator so the widget renders immediately with no loading flash.
  // For server-fetched sources (Freshworks + Platform Health), start in
  // loading state unless we hit the client cache.
  const [state, setState] = useState<UseWidgetDataResult>(() => {
    if (!source) {
      return { data: [], loading: false, error: null, fetchedAt: null, fromCache: null };
    }
    if (!requiresServerFetch(source)) {
      try {
        const result = queryDataSync(source, groupBy);
        return {
          data: result.data || [],
          loading: false,
          error: null,
          fetchedAt: new Date(),
          fromCache: false,
        };
      } catch {
        return { data: [], loading: false, error: null, fetchedAt: null, fromCache: null };
      }
    }
    // Server-fetched: check cache before declaring loading=true.
    const cacheKey = `${source}|${groupByKey}|${limit ?? ''}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return {
        data: cached.data,
        loading: false,
        error: null,
        fetchedAt: cached.fetchedAt,
        fromCache: cached.fromCache,
      };
    }
    return { data: [], loading: true, error: null, fetchedAt: null, fromCache: null };
  });

  useEffect(() => {
    if (!source) {
      setState({ data: [], loading: false, error: null, fetchedAt: null, fromCache: null });
      return;
    }

    // Sample-data path: synchronous, no fetch.
    if (!isServerFetched) {
      try {
        const result = queryDataSync(source, groupBy);
        setState({
          data: result.data || [],
          loading: false,
          error: null,
          fetchedAt: new Date(),
          fromCache: false,
        });
      } catch (err) {
        setState({
          data: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Sample-data query failed',
          fetchedAt: null,
          fromCache: null,
        });
      }
      return;
    }

    // Server-fetched path (Freshworks + Platform Health): cached server fetch.
    const cacheKey = `${source}|${groupByKey}|${limit ?? ''}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setState({
        data: cached.data,
        loading: false,
        error: null,
        fetchedAt: cached.fetchedAt,
        fromCache: cached.fromCache,
      });
      return;
    }

    setState((s) => ({
      data: s.data,
      loading: true,
      error: null,
      fetchedAt: s.fetchedAt,
      fromCache: s.fromCache,
    }));
    let cancelled = false;

    fetch('/api/data/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, groupBy, limit }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        return res.text().then((t) => Promise.reject(new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`)));
      })
      .then((result: {
        data?: Record<string, unknown>[];
        fetched_at?: string;
        fromCache?: boolean;
      }) => {
        if (cancelled) return;
        const rows = result.data || [];
        // Parse the server-asserted fetched_at honestly. If the API didn't
        // send one (older deploy, error path), fall back to current time —
        // that is the moment we received the data, which is still honest.
        const fetchedAt = result.fetched_at ? new Date(result.fetched_at) : new Date();
        const fromCache = typeof result.fromCache === 'boolean' ? result.fromCache : null;
        CACHE.set(cacheKey, { data: rows, ts: Date.now(), fetchedAt, fromCache });
        setState({ data: rows, loading: false, error: null, fetchedAt, fromCache });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          error: err.message || 'Query failed',
          fetchedAt: null,
          fromCache: null,
        });
      });

    return () => {
      cancelled = true;
    };
    // groupByKey is the serialized form; including it captures group-by changes.
  }, [source, groupByKey, limit, isServerFetched]);

  return state;
}
