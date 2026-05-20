/**
 * "Data Trust" — Jeff's connector-diagnostic dashboard.
 *
 * The fifth real-data dashboard in the day-one set. Reframes
 * `probeFreshworksHealth()` (the existing operator-microscope at
 * /admin/freshworks/health) as a regular dashboard surface so trust
 * state is visible alongside the operational dashboards that depend on
 * it. Phase C.2 of docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md.
 *
 * Owned by jeffreycoy@jeffcoy.net, private (isPublic=false,
 * isTemplate=false). All widgets bind to freshworks_health_* sources
 * served by FreshworksHealthDataProvider (USZOOM_RESTRICTED, mapped to
 * the Operations data category — ADMIN/POWER_USER only).
 *
 * ── Truth-by-default story ───────────────────────────────────────────
 *
 * Health is a CURRENT-STATE signal — there is no history table tracking
 * "how many sources were OK 7 days ago." The KPI sources here therefore
 * always render an HONEST ABSENCE pill: previous_value=null and
 * comparison_unavailable_reason set to a concrete sentence the
 * KpiCard surfaces in its tooltip ("Connector health is a current-
 * state signal; probe results are not history-tracked.").
 *
 * That is the deliberate design — it would be trivial to invent a
 * "vs last probe" pill (compare against the cached report from 30s
 * ago) but that would be a fabrication: we don't track history, and
 * the right way to add real PoP is to persist probe snapshots to a
 * new table. Until that lands, honest absence > convenient lie.
 *
 * ── Layout ───────────────────────────────────────────────────────────
 *
 *   Row 1: 3 status KPIs (OK / Suspicious / Erroring), w=4 each
 *   Row 2: 1 status-distribution bar chart, w=12
 *   Row 3: 1 per-source detail table, w=12, h=8
 *
 * Widget IDs are STABLE — re-running the seed updates the schema in
 * place by id rather than creating duplicates.
 */

import type { DashboardSchema, WidgetConfig } from '@/types';

const KPI_HEIGHT = 2;
const CHART_HEIGHT = 4;

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

export const JEFF_DATA_TRUST_DASHBOARD = {
  id: 'jeff-data-trust',
  title: 'Data Trust',
  description:
    "Live connector-trust diagnostics for the Freshworks suite (Freshsales, Freshdesk, Freshcaller, Freshchat). Shows how many of the registered real-data sources are healthy, suspicious, or erroring, plus a per-source detail table with status flags and latency. Wraps probeFreshworksHealth() as a dashboard so operators can see connector trust state alongside the operational dashboards that depend on it. Health is a current-state signal — KPIs render honest 'no comparison available' pills with the reason ('probe results are not history-tracked') in the tooltip rather than fabricating period-over-period.",
  tags: 'operator,real-data,diagnostics,trust,freshworks',
  schema: buildSchema(),
} as const;

function buildSchema(): DashboardSchema {
  return {
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: [],
    widgets: [
      // Row 1: status KPIs. All three render honest-absence pills —
      // green/amber/red colour scheme matches the
      // /admin/freshworks/health page's status badges.
      kpi('w-trust-ok',          'Healthy Sources',     'freshworks_health_ok_count',         0, 0, 4, 'green'),
      kpi('w-trust-suspicious',  'Suspicious Sources',  'freshworks_health_suspicious_count', 4, 0, 4, 'amber'),
      kpi('w-trust-error',       'Erroring Sources',    'freshworks_health_error_count',      8, 0, 4, 'red'),

      // Row 2: full-width status distribution. Bars include all five
      // statuses (ok/suspicious/empty/error/not_configured) even when
      // count is zero, so the chart shape is stable across renders.
      bar('w-trust-summary', 'Sources by Status', 'freshworks_health_summary', 0, 2, 12, 'cyan'),

      // Row 3: per-source detail table — the operator's audit row.
      // Tall (h=8) so all 17 Freshworks source rows render without
      // scrolling on a default viewport.
      table('w-trust-per-source', 'Per-Source Health Detail', 'freshworks_health_per_source', 0, 6, 12, 8),
    ],
  };
}
