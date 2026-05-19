/**
 * "Support Operations" — Jeff's real-data dashboard for the four
 * Freshworks customer-touchpoint products (Freshdesk tickets,
 * Freshcaller voice, Freshchat messaging, plus the Freshdesk agent
 * roster). Owned by jeffreycoy@jeffcoy.net, private (isPublic=false,
 * isTemplate=false).
 *
 * Integrity-ethos showpiece:
 *   - Freshdesk + Freshcaller KPIs render REAL "% vs prev" pills
 *     because their underlying APIs support date filters (see
 *     freshworks-data-provider.ts §"PoP policy").
 *   - Freshchat KPI renders the transparent "no comparison available"
 *     pill with the explicit reason "Source API has no date filter —
 *     historical snapshot table required for honest PoP."
 *   - Both states co-exist on the same dashboard. That's the demo.
 *
 * Layout uses the 12-column grid established in prompts.ts §"Widget
 * Sizing Guide": KPIs at w=3, bar charts at w=4, tables at w=6 or
 * w=12.
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
  color: 'blue' | 'green' | 'amber' | 'cyan' | 'red' | 'purple',
): WidgetConfig {
  return {
    id,
    type: 'kpi_card',
    title,
    position: { x, y, w: 3, h: KPI_HEIGHT },
    // Freshworks/Platform Health KPIs return a single row whose first
    // column is `value`. No aggregation needed; KpiCard reads row[0].value
    // directly. Per the prompts.ts contract for LIVE single-row sources.
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

export const JEFF_SUPPORT_OPS_DASHBOARD = {
  id: 'jeff-support-ops',
  title: 'Support Operations',
  description:
    "Live Freshworks customer-touchpoint metrics: tickets, calls, and messaging. KPIs use the honest PoP contract — Freshdesk and Freshcaller cards render real period-over-period pills; Freshchat transparently shows 'no comparison available' (vendor API has no date filter, awaiting snapshot history table).",
  tags: 'operator,real-data,support,freshworks',
  schema: buildSchema(),
} as const;

function buildSchema(): DashboardSchema {
  return {
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: [],
    widgets: [
      // Row 1: KPI bank (y=0, h=2)
      kpi('w-fd-open',     'Open Tickets',          'freshdesk_open_ticket_count',    0, 0, 'blue'),
      kpi('w-fd-overdue',  'Overdue Tickets',       'freshdesk_overdue_ticket_count', 3, 0, 'red'),
      kpi('w-fc-today',    'Calls Today',           'freshcaller_calls_today',        6, 0, 'cyan'),
      kpi('w-fch-active',  'Active Conversations',  'freshchat_active_conversations', 9, 0, 'amber'),

      // Row 2: status breakdown bar charts (y=2, h=4)
      bar('w-fd-by-status',  'Tickets by Status',        'freshdesk_tickets_by_status',       0, 2, 4, 'blue'),
      bar('w-fc-by-status',  'Calls by Status',          'freshcaller_calls_by_status',       4, 2, 4, 'cyan'),
      bar('w-fch-by-status', 'Conversations by Status',  'freshchat_conversations_by_status', 8, 2, 4, 'amber'),

      // Row 3: recent tickets table (y=6, h=5)
      table('w-fd-recent', 'Recent Tickets (Freshdesk)', 'freshdesk_recent_tickets', 0, 6, 12),

      // Row 4: recent calls + recent conversations side by side (y=11, h=5)
      table('w-fc-recent',  'Recent Calls (Freshcaller)',         'freshcaller_recent_calls',        0,  11, 6),
      table('w-fch-recent', 'Recent Conversations (Freshchat)',   'freshchat_recent_conversations',  6,  11, 6),

      // Row 5: Freshdesk agents roster (y=16, h=5)
      table('w-fd-agents', 'Freshdesk Agents', 'freshdesk_agents', 0, 16, 12),
    ],
  };
}
