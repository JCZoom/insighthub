/**
 * Sample (demo) source-name registry — CLIENT-SAFE.
 *
 * Pure constants + pure type guards. Zero runtime dependencies, zero
 * imports of server-only modules. Safe to import from React Client
 * Components, hooks, and anywhere else that runs in the browser bundle.
 *
 * Mirrors the architectural pattern established by
 * `src/lib/data/freshworks-sources.ts` (see commit 9fcf273): keep the
 * naming/type concerns the client needs in a module with no transitive
 * server dependencies, so it can be imported from anywhere without
 * dragging server-only deps (ioredis, Prisma) into the browser bundle.
 *
 * ── Purpose ─────────────────────────────────────────────────────────
 *
 * These are the canonical names of the seed-data demonstration sources
 * served by `src/lib/data/sample-data.ts`. The list here is used to
 * QUARANTINE them from discovery surfaces (LLM prompt catalog, source
 * pickers, schema explorer) when the operator has not opted into demo
 * mode via the `FEATURE_DEMO_SOURCES` env flag.
 *
 * Important: quarantine = discovery hidden, query path preserved. We do
 * NOT delete sample data, and we do NOT remove their entries from
 * `source-field-registry.ts` — saved dashboards that reference these
 * sources must keep rendering. The POST /api/data/query path resolves
 * them unconditionally; only GET /api/data/query (catalog), GET
 * /api/data/schema, and the LLM source-catalog prompt section filter
 * them out when the flag is off.
 *
 * The 27 names below are the CANONICAL keys exposed in the
 * "Pre-Aggregated Data Sources" prompt block and the `DATA_GENERATORS`
 * map in sample-data.ts. The ~25 additional alias keys in that map
 * (e.g. `monthly_churn`, `pipeline`, `kpis`) are intentionally NOT
 * listed here — they are synonym fallbacks for the AI builder, not
 * canonical names, and the LLM is never told they exist. If the LLM
 * emits an alias on a quarantined deploy, the query path still
 * resolves it (which is correct quarantine semantics: don't break
 * saved widgets, just don't advertise the demo surface).
 */

export const SAMPLE_SOURCES: readonly string[] = [
  // KPI + time-series + dimension-breakdown pre-aggregates
  'kpi_summary',
  'mrr_by_month',
  'churn_by_month',
  'churn_by_region',
  'churn_by_plan',
  'revenue_by_month',
  'revenue_by_type',
  'tickets_by_month',
  'tickets_by_category',
  'tickets_by_team',
  'deals_pipeline',
  'deals_by_source',
  'customers_by_plan',
  'customers_by_region',
  'usage_by_feature',
  'usage_by_month',
  // CS automation pre-aggregates
  'cs_automation_summary',
  'cs_deflection_by_month',
  'cs_deflection_by_channel',
  'cs_bot_topic_performance',
  'cs_cost_savings',
  // Raw sample tables (exposed via dataConfig.source by the AI builder)
  'sample_customers',
  'sample_subscriptions',
  'sample_tickets',
  'sample_revenue',
  'sample_usage',
  'sample_deals',
] as const;

const SAMPLE_SOURCE_SET = new Set<string>(SAMPLE_SOURCES);

/** True if `name` is one of the canonical demo source names. */
export function isSampleSource(name: string): boolean {
  return SAMPLE_SOURCE_SET.has(name);
}

/**
 * Read the FEATURE_DEMO_SOURCES env flag at call time.
 *
 * Server-side gate. Reads `process.env.FEATURE_DEMO_SOURCES` directly so
 * test harnesses can mutate process.env between calls. Server-only
 * because `FEATURE_DEMO_SOURCES` is NOT prefixed with `NEXT_PUBLIC_` —
 * Next.js does not inline it into the client bundle. Use this in route
 * handlers, server components, and the AI prompt builder.
 *
 * For client components (which run in the browser bundle), use
 * `clientDemoSourcesEnabled()` instead. The two flags are paired and
 * the desync warning in `src/lib/env.ts:validateEnv()` fires at boot if
 * they disagree.
 */
export function demoSourcesEnabled(): boolean {
  return process.env.FEATURE_DEMO_SOURCES === 'true';
}

/**
 * Client-side mirror of `demoSourcesEnabled()`, reading the build-baked
 * `NEXT_PUBLIC_FEATURE_DEMO_SOURCES` flag instead.
 *
 * Safe to call from React Client Components. The value is inlined into
 * the bundle at `next build` time — changes at runtime have no effect.
 * Read it once at component init or inside the consumer's `useMemo`;
 * there is no benefit to re-reading on every render.
 *
 * Pattern matches `env.NEXT_PUBLIC_DEV_MODE` from `src/lib/env.ts`.
 */
export function clientDemoSourcesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_DEMO_SOURCES === 'true';
}

/**
 * Pure predicate: does this widget config bind to a sample (demo) source?
 *
 * Used by the widget-library gate and the AI prompt's widget catalog
 * gate to drop sample-bound widget templates when demo discovery is off.
 * Accepts a minimal structural shape so it can be unit-tested without
 * loading the full WidgetConfig type system (which pulls server-only
 * Prisma types via @/types).
 *
 * Text blocks and other widgets with an empty `dataConfig.source`
 * return false — they aren't bound to any source.
 */
export function widgetUsesSampleSource(
  widget: { config?: { dataConfig?: { source?: string } } } | { dataConfig?: { source?: string } },
): boolean {
  const source =
    (widget as { config?: { dataConfig?: { source?: string } } }).config?.dataConfig?.source ??
    (widget as { dataConfig?: { source?: string } }).dataConfig?.source ??
    '';
  if (!source) return false;
  return SAMPLE_SOURCE_SET.has(source);
}

/**
 * Filter a list of source names through the demo-mode gate.
 *
 * When `FEATURE_DEMO_SOURCES=true`, returns `names` unchanged.
 * Otherwise strips any name that is in `SAMPLE_SOURCES`.
 * Non-sample names (Freshworks, Platform Health, future Snowflake) are
 * always returned regardless of the flag.
 *
 * This is the canonical filter used by all discovery surfaces:
 *   - LLM source catalog (src/lib/ai/prompts.ts)
 *   - GET /api/data/query (source picker)
 *   - GET /api/data/schema (Data Explorer)
 */
export function filterSampleSources<T extends string>(names: readonly T[]): T[] {
  if (demoSourcesEnabled()) return [...names];
  return names.filter((n) => !SAMPLE_SOURCE_SET.has(n));
}
