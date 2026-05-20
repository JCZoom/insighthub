/**
 * Freshworks Health source-name registry — CLIENT-SAFE.
 *
 * Pure constants + pure type guards for the freshworks_health_* data
 * sources served by `FreshworksHealthDataProvider`. Same client-safe
 * split rationale as `freshworks-sources.ts` and
 * `platform-health-sources.ts`: keep the names where the schema route
 * and any client code can reach them without dragging the server-only
 * provider (which transitively imports the Freshworks integration
 * clients + ioredis) into the browser bundle.
 *
 * The freshworks_health_* sources expose the existing
 * `probeFreshworksHealth()` operator-diagnostic function as a regular
 * data-source surface, so dashboards can render connector trust state
 * the same way any other dashboard renders sales or support metrics.
 *
 * Architectural notes:
 *   - Phase C.2 of docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md
 *   - probeFreshworksHealth lives at src/lib/data/freshworks-health.ts
 */

export const FRESHWORKS_HEALTH_SOURCES = [
  // KPI-shape (single-row, 5-field PoP contract). Health is a
  // current-state signal so previous_value is always null, with an
  // explicit comparison_unavailable_reason — the standard truth-by-
  // default 'honest absence' pattern, not a fabrication.
  'freshworks_health_ok_count',
  'freshworks_health_suspicious_count',
  'freshworks_health_error_count',
  // Multi-row aggregate: {status, count} — natural fit for bar/pie.
  'freshworks_health_summary',
  // Detail table: one row per registered Freshworks source, with
  // status/flags/latency/error suitable for an operator audit table.
  'freshworks_health_per_source',
] as const;

export type FreshworksHealthSource = (typeof FRESHWORKS_HEALTH_SOURCES)[number];

export function isFreshworksHealthSource(name: string): name is FreshworksHealthSource {
  return (FRESHWORKS_HEALTH_SOURCES as readonly string[]).includes(name);
}

export function listFreshworksHealthSources(): readonly FreshworksHealthSource[] {
  return FRESHWORKS_HEALTH_SOURCES;
}
