/**
 * "Sales Pipeline" — Jeff's real-data dashboard for the Freshsales CRM.
 *
 * Owned by jeffreycoy@jeffcoy.net, private (isPublic=false,
 * isTemplate=false).
 *
 * Integrity-ethos showpiece (deliberate, twin to Support Operations):
 *   - BOTH Freshsales KPIs intentionally render the "no comparison
 *     available" pill. The vendor's listDeals() endpoint has no date
 *     filter, so the data provider returns previous_value=null with
 *     the explicit reason "Source API has no date filter —
 *     historical snapshot table required for honest PoP."
 *   - That's the most aggressive demo of honest absence: a dashboard
 *     that proudly shows it CAN'T compute a comparison rather than
 *     fabricating one to fill the UI slot.
 *
 * Bar chart + tables show real data (stage breakdown, top open deals,
 * recent contacts/accounts), all live from Freshsales API via
 * FreshworksDataProvider.
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

function table(
  id: string,
  title: string,
  source: string,
  x: number,
  y: number,
  w: number,
): WidgetConfig {
  return {
    id,
    type: 'table',
    title,
    position: { x, y, w, h: TABLE_HEIGHT },
    dataConfig: { source },
    visualConfig: { showGrid: true },
  };
}

export const JEFF_SALES_PIPELINE_DASHBOARD = {
  id: 'jeff-sales-pipeline',
  title: 'Sales Pipeline',
  description:
    "Live Freshsales CRM metrics: pipeline value, open deal count, stage breakdown, top open deals, and recent contacts/accounts. Both KPIs render 'no comparison available' transparently — the Freshsales listDeals() API has no date filter, so honest PoP requires a snapshot history table (G-FW-PoP-1). The dashboard demonstrates the integrity ethos by surfacing the limitation instead of fabricating a number.",
  tags: 'operator,real-data,sales,freshsales',
  schema: buildSchema(),
} as const;

function buildSchema(): DashboardSchema {
  return {
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: [],
    widgets: [
      // Row 1: KPI bank — 2 cards, w=6 each, both with transparent "no
      // comparison available" pills (Freshsales API has no date filter)
      kpi('w-fs-pipeline', 'Pipeline Value (Open)', 'freshsales_pipeline_value',   0, 0, 6, 'green'),
      kpi('w-fs-open',     'Open Deal Count',       'freshsales_open_deal_count',  6, 0, 6, 'purple'),

      // Row 2: stage breakdown (full-width bar)
      bar('w-fs-by-stage', 'Deals by Stage', 'freshsales_deals_by_stage', 0, 2, 12, 'green'),

      // Row 3: top open deals (full-width table)
      table('w-fs-top', 'Top Open Deals', 'freshsales_top_deals', 0, 6, 12),

      // Row 4: recent contacts + recent accounts side by side
      table('w-fs-contacts', 'Recent Contacts', 'freshsales_contacts_recent', 0, 11, 6),
      table('w-fs-accounts', 'Recent Accounts', 'freshsales_accounts_recent', 6, 11, 6),
    ],
  };
}
