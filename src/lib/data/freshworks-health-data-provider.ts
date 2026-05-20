/**
 * Freshworks Health data provider — server-only.
 *
 * Wraps the existing `probeFreshworksHealth()` operator-diagnostic
 * function as a regular data-source surface, so dashboards can render
 * connector trust state the same way they render sales or support
 * metrics. Phase C.2 of docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md.
 *
 * ── Truth-by-default contract ────────────────────────────────────────
 *
 * Health is a CURRENT-STATE signal — there's no history table tracking
 * "how many sources were OK 7 days ago." Every KPI source therefore
 * returns `previous_value: null` together with an explicit
 * `comparison_unavailable_reason`. The KpiCard renderer (truth-by-
 * default since 2026-05-19) will draw an honest "no comparison
 * available" pill with the reason in a tooltip — never fabricate a
 * baseline we don't actually observe.
 *
 * If we want PoP for connector health later, the right approach is to
 * persist probe snapshots to a new table and read the previous one
 * from there — not to invent comparisons here.
 *
 * ── Shared probe per request ────────────────────────────────────────
 *
 * `probeFreshworksHealth()` exercises every Freshworks source in
 * parallel. A single dashboard render with all 5 freshworks_health_*
 * widgets would otherwise trigger 5 full probe runs.
 *
 * The probe itself uses per-source caches inside the integration
 * clients (per-key Redis cache via `getOrLoad`), so 5 probes within
 * the cache TTL window are cheap — but parallelism is bounded only by
 * upstream API rate limits, and 5 simultaneous probe runs are still
 * 5x the work for no gain. We therefore add a tiny in-memory TTL
 * cache here keyed by user.id with a 30-second window. This is a
 * deliberate "cheaper-than-correct" cache: a 30s lag in connector-
 * status reporting is a non-issue for an operator dashboard, and the
 * underlying probes are themselves cached so the staleness ceiling is
 * already bounded.
 *
 * Eviction strategy: passive — we only hold one entry per user, and
 * stale entries are replaced on the next request. No background
 * cleanup needed.
 *
 * ── Permissions ──────────────────────────────────────────────────────
 *
 * freshworks_health_* sources are mapped to the `Operations` data
 * category (see src/lib/auth/permissions.ts). ADMIN/POWER_USER get
 * FULL; CREATOR/VIEWER get NONE. This matches the gating on
 * `/admin/freshworks/health` and the `platform_*` Platform Health
 * sources — connector diagnostics are operator data.
 */

import { probeFreshworksHealth, type FreshworksHealthReport } from './freshworks-health';
import type { DataProviderResult } from './snowflake-data-provider';
import type { SessionUser } from '@/lib/auth/session';
import { isFreshworksHealthSource, FRESHWORKS_HEALTH_SOURCES } from './freshworks-health-sources';

const KPI_COLUMNS: Array<{ name: string; type: string }> = [
  { name: 'value', type: 'number' },
  { name: 'label', type: 'string' },
  { name: 'previous_value', type: 'number' },
  { name: 'comparison_label', type: 'string' },
  { name: 'comparison_unavailable_reason', type: 'string' },
];

const HEALTH_PROBE_TTL_MS = 30 * 1000;
const POP_REASON =
  'Connector health is a current-state signal; probe results are not history-tracked. Building period-over-period would require persisting probe snapshots to a new table.';

interface CacheEntry {
  expiresAt: number;
  report: FreshworksHealthReport;
}

const probeCache = new Map<string, CacheEntry>();

/**
 * Fetch the current Freshworks health report for the given user, with
 * a short-TTL in-memory cache so a single dashboard render that
 * touches multiple freshworks_health_* widgets only triggers one
 * underlying probe.
 *
 * Per-user keying matters because `probeFreshworksHealth` redacts
 * sample rows for non-FULL CustomerPII roles — a viewer's report has
 * different sample-row contents than an admin's, so they can't share
 * cache entries.
 */
async function getCachedReport(user: SessionUser): Promise<FreshworksHealthReport> {
  const now = Date.now();
  const key = user.id ?? 'anonymous';
  const cached = probeCache.get(key);
  if (cached && cached.expiresAt > now) return cached.report;
  const report = await probeFreshworksHealth(user);
  probeCache.set(key, { report, expiresAt: now + HEALTH_PROBE_TTL_MS });
  return report;
}

function finish(
  data: Record<string, unknown>[],
  columns: Array<{ name: string; type: string }>,
  start: number,
  fromCache: boolean,
): DataProviderResult {
  return {
    data,
    columns,
    executionTime: Date.now() - start,
    totalRows: data.length,
    fromCache,
    dataSource: 'freshworks_health',
    accessLevel: 'FULL',
    isFiltered: false,
    appliedPolicies: ['platform.classification:USZOOM_RESTRICTED'],
  };
}

export class FreshworksHealthDataProvider {
  /** Always available — there are no env vars to gate this on. The
   * underlying probe will report `not_configured` per-source for any
   * Freshworks product whose env vars are missing.
   */
  static isAvailable(): boolean {
    return true;
  }

  /**
   * Query a registered Freshworks Health source.
   *
   * Throws if the source is unknown — caller should check
   * `isFreshworksHealthSource()` first or route by name prefix.
   */
  static async queryData(
    source: string,
    user: SessionUser,
  ): Promise<DataProviderResult> {
    const start = Date.now();
    if (!isFreshworksHealthSource(source)) {
      throw new Error(
        `Unknown Freshworks Health source: "${source}". Known: ${FRESHWORKS_HEALTH_SOURCES.join(', ')}`,
      );
    }

    // We can't tell at this layer whether the report itself was a
    // cache hit (the per-source caches inside the integration clients
    // are opaque to us). Best signal we DO have is whether our 30s
    // in-memory probe cache served the request — surface that as
    // `fromCache` so the dashboard freshness widget reflects reality.
    const cacheKey = user.id ?? 'anonymous';
    const wasCached = (probeCache.get(cacheKey)?.expiresAt ?? 0) > Date.now();
    const report = await getCachedReport(user);

    switch (source) {
      case 'freshworks_health_ok_count':
        return finish(
          [{
            value: report.summary.ok,
            label: 'Healthy sources',
            previous_value: null,
            comparison_label: null,
            comparison_unavailable_reason: POP_REASON,
          }],
          KPI_COLUMNS,
          start,
          wasCached,
        );

      case 'freshworks_health_suspicious_count':
        return finish(
          [{
            value: report.summary.suspicious,
            label: 'Suspicious sources',
            previous_value: null,
            comparison_label: null,
            comparison_unavailable_reason: POP_REASON,
          }],
          KPI_COLUMNS,
          start,
          wasCached,
        );

      case 'freshworks_health_error_count':
        return finish(
          [{
            value: report.summary.error,
            label: 'Erroring sources',
            previous_value: null,
            comparison_label: null,
            comparison_unavailable_reason: POP_REASON,
          }],
          KPI_COLUMNS,
          start,
          wasCached,
        );

      case 'freshworks_health_summary': {
        // Stable, ordered status list — keeps the bar chart from
        // re-ordering between renders. Statuses with zero are
        // included so the chart always shows the full vocabulary
        // (operator can see "ok=17, error=0" rather than wondering
        // whether 'error' got dropped).
        const STATUS_ORDER = ['ok', 'suspicious', 'empty', 'error', 'not_configured'] as const;
        const rows = STATUS_ORDER.map(status => ({
          status,
          count: report.summary[status] ?? 0,
        }));
        return finish(
          rows,
          [
            { name: 'status', type: 'string' },
            { name: 'count', type: 'number' },
          ],
          start,
          wasCached,
        );
      }

      case 'freshworks_health_per_source': {
        // One row per registered Freshworks source. Keep the column
        // set to operator-relevant fields — `sampleRow` and
        // `sampleKeys` from the underlying probe are useful on the
        // /admin/freshworks/health diagnostic page but too verbose
        // for a dashboard table. `flags` is joined into a comma-
        // separated string so the table cell is renderable as plain
        // text without a custom array renderer.
        const rows = report.sources.map(s => ({
          source: s.source,
          product: s.product,
          status: s.status,
          row_count: s.rowCount,
          latency_ms: s.latencyMs,
          flags: s.flags.join(', '),
          from_cache: s.fromCache,
          error: s.error,
        }));
        return finish(
          rows,
          [
            { name: 'source', type: 'string' },
            { name: 'product', type: 'string' },
            { name: 'status', type: 'string' },
            { name: 'row_count', type: 'number' },
            { name: 'latency_ms', type: 'number' },
            { name: 'flags', type: 'string' },
            { name: 'from_cache', type: 'boolean' },
            { name: 'error', type: 'string' },
          ],
          start,
          wasCached,
        );
      }

      default: {
        // Unreachable given the type guard above; satisfies the
        // compiler's exhaustiveness check.
        const _exhaustive: never = source;
        throw new Error(`Unhandled Freshworks Health source: ${String(_exhaustive)}`);
      }
    }
  }
}
