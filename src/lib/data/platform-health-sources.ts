/**
 * Platform Health source-name registry — CLIENT-SAFE.
 *
 * Pure constants + pure type guards. Zero runtime dependencies, zero
 * imports of server-only modules (no Prisma client, no Node imports).
 * Safe to import from React Client Components, hooks, and anywhere
 * else that runs in the browser bundle.
 *
 * Mirrors the architectural pattern of `freshworks-sources.ts` —
 * keep the naming/type concerns the client needs in a module with no
 * transitive server dependencies, so the data-provider module (which
 * imports the Prisma client) is never pulled into client bundles.
 *
 * ── Why a Platform Health provider exists ────────────────────────────
 *
 * Post-2026-05-19, with sample/demo sources quarantined behind
 * FEATURE_DEMO_SOURCES, the dashboard builder needs REAL alternatives
 * to bind to. The Platform Health sources expose honest, Prisma-backed
 * counts of the InsightHub application itself (users, dashboards,
 * audit events, glossary terms, classification distribution) so an
 * operator with no Freshworks/Snowflake config can still produce
 * meaningful dashboards.
 *
 * Truth-by-default contract: every KPI source returns the same 5-field
 * row shape as the Freshworks live KPIs:
 *
 *     { value, label, previous_value, comparison_label,
 *       comparison_unavailable_reason }
 *
 * Period-over-period is computed honestly from immutable `createdAt`
 * fields on append-only tables. Where honest PoP is NOT possible
 * (mutable fields like User.role or Dashboard.classification), we
 * expose the metric ONLY as a current-state breakdown chart — never as
 * a KPI with a fabricated comparison.
 */

export const PLATFORM_HEALTH_SOURCES = [
  // ── User / membership ──
  'platform_user_count',
  'platform_users_by_role',
  'platform_active_users_7d',
  // ── Dashboards ──
  'platform_dashboards_total',
  'platform_dashboards_created_30d',
  'platform_dashboards_created_by_month',
  'platform_classification_distribution',
  // ── Glossary ──
  'platform_glossary_term_count',
  'platform_glossary_by_category',
  // ── Audit / activity ──
  'platform_audit_events_today',
  'platform_audit_events_by_type_30d',
  'platform_recent_audit_events',
] as const;

export type PlatformHealthSource = (typeof PLATFORM_HEALTH_SOURCES)[number];

const PLATFORM_HEALTH_SET = new Set<string>(PLATFORM_HEALTH_SOURCES);

/** True when the given name is one of the Platform Health sources. */
export function isPlatformHealthSource(name: string): name is PlatformHealthSource {
  return PLATFORM_HEALTH_SET.has(name);
}

export function listPlatformHealthSources(): readonly PlatformHealthSource[] {
  return PLATFORM_HEALTH_SOURCES;
}
