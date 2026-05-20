/**
 * "Today" — Jeff's real-data cross-functional daily-snapshot dashboard.
 *
 * The fourth in the day-one set (alongside Support Operations, Sales
 * Pipeline, and Platform Health). Designed as the answer to "what's
 * the one screen I look at first in the morning?" — a single dashboard
 * that pulls the most-relevant operational signal from every real data
 * provider available today:
 *
 *   - Sales (Freshsales):    pipeline value, open deal count
 *   - Support (Freshdesk):   open ticket count, overdue ticket count
 *   - Voice (Freshcaller):   calls today
 *   - Messaging (Freshchat): active conversations
 *   - Platform Health:       dashboards created (30d), audit events today
 *
 * Owned by jeffreycoy@jeffcoy.net, private (isPublic=false,
 * isTemplate=false), classification USZOOM_RESTRICTED. Zero demo
 * sources.
 *
 * Truth-by-default story (heterogeneous on purpose — this is the
 * dashboard that demonstrates ALL THREE states of the PoP contract on
 * one screen):
 *
 *   - HONEST PoP pills      → freshcaller_calls_today (yesterday-vs-
 *     today), freshdesk_open_ticket_count (7d), freshdesk_overdue_
 *     ticket_count (7d), platform_dashboards_created_30d (vs prior
 *     30d), platform_audit_events_today (vs yesterday).
 *   - HONEST ABSENCE pills  → freshsales_pipeline_value, freshsales_
 *     open_deal_count, freshchat_active_conversations (vendor APIs
 *     lack a date filter; reason surfaced in tooltip).
 *
 * Read together with the existing three real-data dashboards, "Today"
 * demonstrates that honest period-over-period and honest absence can
 * sit side-by-side on the same screen without one undermining the
 * other — exactly the demo argument for the truth-by-default contract.
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

export const JEFF_TODAY_DASHBOARD = {
  id: 'jeff-today',
  title: 'Today',
  description:
    "Daily cross-functional snapshot: sales pipeline, support backlog, today's call volume, active conversations, and platform activity. Every widget binds to a live data provider (Freshworks suite + Platform Health) — zero synthetic data. KPIs render honest comparison pills when the vendor API permits and honest 'no comparison available' pills when it doesn't, all on the same screen. This is the dashboard that demonstrates the truth-by-default contract end-to-end.",
  tags: 'operator,real-data,daily,cross-functional',
  schema: buildSchema(),
} as const;

function buildSchema(): DashboardSchema {
  return {
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: [],
    widgets: [
      // Row 1: revenue + support backlog (4 KPIs, w=3 each)
      // Freshsales pair shows honest-absence pills (no vendor date filter);
      // Freshdesk pair shows honest 7d PoP via wasTicketOpenAt().
      kpi('w-today-pipeline',  'Pipeline Value',    'freshsales_pipeline_value',         0, 0, 3, 'green'),
      kpi('w-today-deals',     'Open Deals',        'freshsales_open_deal_count',        3, 0, 3, 'cyan'),
      kpi('w-today-tickets',   'Open Tickets',      'freshdesk_open_ticket_count',       6, 0, 3, 'blue'),
      kpi('w-today-overdue',   'Overdue Tickets',   'freshdesk_overdue_ticket_count',    9, 0, 3, 'red'),

      // Row 2: contact volume + platform pulse (4 KPIs, w=3 each)
      // freshcaller_calls_today + the two platform_* KPIs render honest
      // PoP pills; freshchat_active_conversations shows honest absence.
      kpi('w-today-calls',     'Calls Today',         'freshcaller_calls_today',           0, 2, 3, 'amber'),
      kpi('w-today-chats',     'Active Conversations','freshchat_active_conversations',    3, 2, 3, 'purple'),
      kpi('w-today-dash-30d',  'Dashboards (30d)',    'platform_dashboards_created_30d',   6, 2, 3, 'blue'),
      kpi('w-today-audit',     'Audit Events Today',  'platform_audit_events_today',       9, 2, 3, 'green'),

      // Row 3: current operational state — ticket + call status breakdowns
      // (deliberately omits freshchat_conversations_by_status because the
      //  Freshchat search endpoint silently returns [] on this tenant per
      //  docs/FRESHWORKS_FIELD_SHAPE_FINDINGS_2026-05-19.md §F-2; widget
      //  would look broken until that's fixed in a follow-up)
      bar('w-today-tickets-status', 'Tickets by Status',   'freshdesk_tickets_by_status',   0, 4, 6, 'blue'),
      bar('w-today-calls-status',   'Calls by Status',     'freshcaller_calls_by_status',   6, 4, 6, 'amber'),

      // Row 4: recent activity tables
      table('w-today-recent-tickets', 'Recently Updated Tickets', 'freshdesk_recent_tickets',   0, 8, 12, TABLE_HEIGHT),
      table('w-today-recent-audit',   'Recent Platform Activity', 'platform_recent_audit_events', 0, 13, 12, TABLE_HEIGHT),
    ],
  };
}
