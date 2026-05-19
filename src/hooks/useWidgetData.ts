'use client';

import { useEffect, useState } from 'react';
import { queryDataSync } from '@/lib/data/sample-data';
import { isFreshworksSource } from '@/lib/data/freshworks-sources';

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
 *   2. Everything else (sample-data sources, future Snowflake sources)  →
 *      sync `queryDataSync()` against the in-process sample-data
 *      generators. No network hop, no flash, no risk of regression in
 *      the >60 widgets that already work fine off sample data today.
 *
 * Why split the path:
 *   - Sample-data sources are deterministic, in-process, and cheap. Going
 *     async for them would introduce a loading flash and >60 unnecessary
 *     fetches per dashboard view, with zero benefit (the API would just
 *     re-run the same generator on the server).
 *   - Freshworks sources MUST go through the API because the secrets,
 *     vendor clients, audit logger, and 60-s server-side cache only
 *     exist server-side. Calling them from the browser is a non-starter.
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
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

export interface UseWidgetDataResult {
  data: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
}

export function useWidgetData(
  source: string,
  groupBy?: string[],
  limit?: number,
): UseWidgetDataResult {
  const isFreshworks = source ? isFreshworksSource(source) : false;
  const groupByKey = JSON.stringify(groupBy ?? []);

  // Initial state: for sample sources, populate synchronously from the
  // generator so the widget renders immediately with no loading flash.
  // For Freshworks sources, start in loading state.
  const [state, setState] = useState<UseWidgetDataResult>(() => {
    if (!source) return { data: [], loading: false, error: null };
    if (!isFreshworksSource(source)) {
      try {
        const result = queryDataSync(source, groupBy);
        return { data: result.data || [], loading: false, error: null };
      } catch {
        return { data: [], loading: false, error: null };
      }
    }
    // Freshworks: check cache before declaring loading=true.
    const cacheKey = `${source}|${groupByKey}|${limit ?? ''}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return { data: cached.data, loading: false, error: null };
    }
    return { data: [], loading: true, error: null };
  });

  useEffect(() => {
    if (!source) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    // Sample-data path: synchronous, no fetch.
    if (!isFreshworks) {
      try {
        const result = queryDataSync(source, groupBy);
        setState({ data: result.data || [], loading: false, error: null });
      } catch (err) {
        setState({
          data: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Sample-data query failed',
        });
      }
      return;
    }

    // Freshworks path: cached server fetch.
    const cacheKey = `${source}|${groupByKey}|${limit ?? ''}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setState({ data: cached.data, loading: false, error: null });
      return;
    }

    setState((s) => ({ data: s.data, loading: true, error: null }));
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
      .then((result: { data?: Record<string, unknown>[] }) => {
        if (cancelled) return;
        const rows = result.data || [];
        CACHE.set(cacheKey, { data: rows, ts: Date.now() });
        setState({ data: rows, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          error: err.message || 'Query failed',
        });
      });

    return () => {
      cancelled = true;
    };
    // groupByKey is the serialized form; including it captures group-by changes.
  }, [source, groupByKey, limit, isFreshworks]);

  return state;
}
