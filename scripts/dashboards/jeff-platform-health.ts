/**
 * "Platform Health" — Jeff's real-data dashboard for the InsightHub
 * application itself.
 *
 * Owned by jeffreycoy@jeffcoy.net, private (isPublic=false,
 * isTemplate=false). All widgets bind to platform_* sources served by
 * the PlatformHealthDataProvider (Prisma-backed, USZOOM_RESTRICTED).
 *
 * Integrity-ethos showpiece (third in the set, contrast against the
 * Support Operations and Sales Pipeline dashboards):
 *   - Every KPI on this dashboard renders a REAL "% vs prev" pill.
 *     None say "no comparison available." That's because the
 *     underlying Prisma tables are append-only with immutable
 *     createdAt fields — every "how many existed at T-N" question is
 *     honestly computable from a single filtered count, no snapshot
 *     table needed.
 *   - The two current-state-only sources (users_by_role,
 *     classification_distribution) are deliberately exposed as charts
 *     ONLY, not KPIs — their underlying fields are mutable so a
 *     comparison pill would be a fabrication. Honest absence over
 *     honest-looking fabrication.
 *
 * Read together with the other two dashboards, this completes the
 * three-way demo of the truth-by-default contract:
 *   - Support Operations: mix of honest PoP + transparent unavailable
 *   - Sales Pipeline:     all unavailable, all transparent
 *   - Platform Health:    all honest, no fabrication anywhere
 *
 * Widget IDs are STABLE — re-running the seed updates the schema in
 * place by id rather than creating duplicates.
 */

import type { DashboardSchema, WidgetConfig } from '@/types';

const KPI_HEIGHT = 2;
const CHART_HEIGHT = 4;
const TABLE_HEIGHT = 5;

function kpi(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
  color: 'blue' | 'green' | 'amber' | 'cyan' | 'red' | 'purple',
): WidgetConfig {
  return {
    id,
    type: 'kpi_card',
    title,
    position: { x, y, w, h: KPI_HEIGHT },
    dataConfig: { source },
    visualConfig: { colorScheme: color },
  };
}

function bar(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
  color: 'blue' | 'green' | 'amber' | 'cyan' | 'red' | 'purple',
): WidgetConfig {
  return {
    id,
    type: 'bar_chart',
    title,
    position: { x, y, w, h: CHART_HEIGHT },
    dataConfig: { source },
    visualConfig: { chartType: 'bar', colorScheme: color, showLegend: false, showGrid: true },
  };
}

function pie(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
  color: 'blue' | 'green' | 'amber' | 'cyan' | 'red' | 'purple',
): WidgetConfig {
  return {
    id,
    type: 'pie_chart',
    title,
    position: { x, y, w, h: CHART_HEIGHT },
    dataConfig: { source },
    visualConfig: { chartType: 'pie', colorScheme: color, showLegend: true },
  };
}

function line(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
  color: 'blue' | 'green' | 'amber' | 'cyan' | 'red' | 'purple',
): WidgetConfig {
  return {
    id,
    type: 'line_chart',
    title,
    position: { x, y, w, h: CHART_HEIGHT },
    dataConfig: { source },
    visualConfig: { chartType: 'line', colorScheme: color, showGrid: true },
  };
}

function table(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
  h: number,
): WidgetConfig {
  return {
    id,
    type: 'table',
    title,
    position: { x, y, w, h },
    dataConfig: { source },
    visualConfig: { showGrid: true },
  };
}

export const JEFF_PLATFORM_HEALTH_DASHBOARD = {
  id: 'jeff-platform-health',
  title: 'Platform Health',
  description:
    "Live internal metrics for the InsightHub application itself: users, dashboards, audit activity, glossary coverage, classification distribution. All KPIs use honestly-computed period-over-period comparisons from immutable Prisma createdAt fields — no fabrication anywhere. Mutable-field metrics (role distribution, classification distribution) are exposed as current-state charts only, never as KPIs with a comparison pill.",
  tags: 'operator,real-data,platform,internal',
  schema: buildSchema(),
} as const;

function buildSchema(): DashboardSchema {
  return {
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: [],
    widgets: [
      // Row 1: KPI bank, 4 cards w=3 each, all with HONEST PoP pills
      kpi('w-ph-users',          'Total Users',          'platform_user_count',             0, 0, 3, 'cyan'),
      kpi('w-ph-dash',           'Active Dashboards',    'platform_dashboards_total',       3, 0, 3, 'blue'),
      kpi('w-ph-dash-30d',       'Dashboards (30d)',     'platform_dashboards_created_30d', 6, 0, 3, 'purple'),
      kpi('w-ph-active',         'Active Users (7d)',    'platform_active_users_7d',        9, 0, 3, 'green'),

      // Row 2: three distribution charts, current-state only (no PoP semantics)
      bar('w-ph-by-role',         'Users by Role',                'platform_users_by_role',                  0, 2, 4, 'cyan'),
      pie('w-ph-classification',  'Dashboard Classification',     'platform_classification_distribution',    4, 2, 4, 'purple'),
      bar('w-ph-events-by-type',  'Audit Events by Type (30d)',   'platform_audit_events_by_type_30d',       8, 2, 4, 'amber'),

      // Row 3: dashboard-creation trend (full-width line)
      line('w-ph-trend', 'Dashboards Created by Month (12mo)', 'platform_dashboards_created_by_month', 0, 6, 12, 'blue'),

      // Row 4: two wide KPIs, w=6 each, both with honest PoP pills
      kpi('w-ph-glossary',     'Glossary Terms',     'platform_glossary_term_count',  0, 10, 6, 'green'),
      kpi('w-ph-events-today', 'Audit Events Today', 'platform_audit_events_today',   6, 10, 6, 'amber'),

      // Row 5: full-width recent audit events table (h=5)
      table('w-ph-recent', 'Recent Audit Events', 'platform_recent_audit_events', 0, 12, 12, TABLE_HEIGHT),

      // Row 6: glossary by category (full-width bar to round out the page)
      bar('w-ph-glossary-cat', 'Glossary Terms by Category', 'platform_glossary_by_category', 0, 17, 12, 'green'),
    ],
  };
}
