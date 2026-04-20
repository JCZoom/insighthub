import type { DashboardSchema } from '@/types';

interface TemplateDefinition {
  title: string;
  schema: DashboardSchema;
}

export const TEMPLATE_SCHEMAS: Record<string, TemplateDefinition> = {
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * EXECUTIVE SUMMARY — 14 widgets
   * The flagship template. Dense KPI banner, revenue deep-dive,
   * growth trends, pipeline funnel, and regional breakdown.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-exec': {
    title: 'Executive Summary',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-exec',
          type: 'text_block',
          title: 'Executive Summary',
          subtitle: 'Real-time business health across revenue, retention, and growth',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'blue' } },
        },
        // ── Row 1: KPI Banner (6 compact cards) ──────────────
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'Monthly Recurring Revenue',
          subtitle: 'All active subscriptions',
          position: { x: 0, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'Annual Run Rate',
          subtitle: 'Projected yearly revenue',
          position: { x: 2, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 4, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-churn',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 6, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 8, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-pipeline',
          type: 'kpi_card',
          title: 'Pipeline Value',
          subtitle: 'Weighted open deals',
          position: { x: 10, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'pipeline_value' } },
          visualConfig: { colorScheme: 'amber' },
        },
        // ── Row 1: Revenue & Plan Mix ────────────────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 0, y: 3, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-customers-plan',
          type: 'donut_chart',
          title: 'Customers by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 8, y: 3, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 2: Growth, Composition, Pipeline ─────────────
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth Trend',
          subtitle: 'Month-over-month recurring revenue',
          position: { x: 0, y: 7, w: 4, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true, animate: true },
        },
        {
          id: 'chart-revenue-composition',
          type: 'stacked_bar',
          title: 'Revenue Composition',
          subtitle: 'Monthly revenue by category',
          position: { x: 4, y: 7, w: 4, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { stacked: true, colorScheme: 'cool', showLegend: true },
        },
        {
          id: 'chart-pipeline-funnel',
          type: 'funnel',
          title: 'Deal Pipeline',
          subtitle: 'Prospect → Negotiation',
          position: { x: 8, y: 7, w: 4, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
        // ── Row 3: Regional & Team Deep-Dives ────────────────
        {
          id: 'chart-churn-region',
          type: 'bar_chart',
          title: 'Churn Rate by Region',
          subtitle: 'Geographic churn distribution',
          position: { x: 0, y: 11, w: 4, h: 4 },
          dataConfig: { source: 'churn_by_region' },
          visualConfig: { colorScheme: 'warm' },
        },
        {
          id: 'chart-customers-region',
          type: 'bar_chart',
          title: 'Customers by Region',
          subtitle: 'Regional customer distribution',
          position: { x: 4, y: 11, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'table-team-perf',
          type: 'table',
          title: 'Support Team Performance',
          subtitle: 'Open · Pending · Resolved · CSAT',
          position: { x: 8, y: 11, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: {},
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-exec',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'NRR above 100% signals expansion revenue is outpacing churn — the strongest leading indicator of sustainable growth. Watch for regional divergence in APAC.',
          position: { x: 0, y: 15, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'amber', backgroundColor: 'amber' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SUPPORT OPERATIONS — 10 widgets
   * Ticket volume trends, resolution analytics, CSAT tracking,
   * category breakdown, and full team performance table.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-support': {
    title: 'Support Operations',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-support',
          type: 'text_block',
          title: 'Support Operations',
          subtitle: 'Ticket volume, resolution efficiency, and team performance at a glance',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'green' } },
        },
        // ── Row 1: KPIs ──────────────────────────────────────
        {
          id: 'kpi-open-tickets',
          type: 'kpi_card',
          title: 'Open Tickets',
          subtitle: 'Awaiting resolution',
          position: { x: 0, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'open_tickets' } },
          visualConfig: { colorScheme: 'amber' },
        },
        {
          id: 'kpi-frt',
          type: 'kpi_card',
          title: 'Avg First Response',
          subtitle: 'Minutes to first reply',
          position: { x: 3, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_frt_minutes' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 6, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-total-customers',
          type: 'kpi_card',
          title: 'Total Customers',
          subtitle: 'All active accounts',
          position: { x: 9, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'total_customers' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 2: Volume & Breakdown ────────────────────────
        {
          id: 'chart-ticket-volume',
          type: 'area_chart',
          title: 'Ticket Volume Over Time',
          subtitle: 'Total vs. resolved tickets by month',
          position: { x: 0, y: 3, w: 8, h: 4 },
          dataConfig: { source: 'tickets_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-tickets-category',
          type: 'donut_chart',
          title: 'Tickets by Category',
          subtitle: 'Billing · Technical · Onboarding · Feature · Cancel',
          position: { x: 8, y: 3, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_category' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 3: Resolution & CSAT ─────────────────────────
        {
          id: 'chart-resolution-times',
          type: 'bar_chart',
          title: 'Resolution Times by Category',
          subtitle: 'Avg hours to resolve per category',
          position: { x: 0, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'tickets_by_category' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'chart-csat-trend',
          type: 'line_chart',
          title: 'CSAT Trend Over Time',
          subtitle: 'Monthly customer satisfaction score',
          position: { x: 6, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'tickets_by_month' },
          visualConfig: { colorScheme: 'green', showGrid: true, animate: true },
        },
        // ── Row 4: Team Performance ──────────────────────────
        {
          id: 'table-team-perf',
          type: 'table',
          title: 'Team Performance',
          subtitle: 'Open · Pending · Resolved · Avg Resolution · CSAT',
          position: { x: 0, y: 11, w: 8, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: {},
        },
        {
          id: 'chart-team-bar',
          type: 'bar_chart',
          title: 'Resolved Tickets by Team',
          subtitle: 'Team contribution to resolution',
          position: { x: 8, y: 11, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: { colorScheme: 'vibrant' },
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-support',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Billing-related tickets have 2x longer resolution times than other categories. Consider dedicated billing support specialists to reduce MTTR and improve CSAT.',
          position: { x: 0, y: 15, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'green', backgroundColor: 'green' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CHURN ANALYSIS — 12 widgets
   * Comprehensive retention story: KPI banner, temporal trends,
   * plan & region segmentation, revenue impact, customer distribution.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-churn': {
    title: 'Churn Analysis',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-churn',
          type: 'text_block',
          title: 'Churn Analysis',
          subtitle: 'Retention metrics, cohort trends, and revenue impact from customer attrition',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'purple' } },
        },
        // ── Row 1: KPI Banner (6 retention-focused metrics) ──
        {
          id: 'kpi-churn-rate',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 0, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Revenue kept + expansion',
          position: { x: 2, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-grr',
          type: 'kpi_card',
          title: 'Gross Revenue Retention',
          subtitle: 'Before expansion revenue',
          position: { x: 4, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'grr' } },
          visualConfig: { colorScheme: 'amber' },
        },
        {
          id: 'kpi-active',
          type: 'kpi_card',
          title: 'Active Customers',
          subtitle: 'Currently subscribed',
          position: { x: 6, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'active_customers' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'MRR',
          subtitle: 'Monthly recurring revenue',
          position: { x: 8, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Satisfaction indicator',
          position: { x: 10, y: 1, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 2: Churn Trend & Plan Breakdown ──────────────
        {
          id: 'chart-churn-trend',
          type: 'area_chart',
          title: 'Churn Rate Trend',
          subtitle: '16-month churn trajectory with churned customer volume',
          position: { x: 0, y: 3, w: 8, h: 5 },
          dataConfig: { source: 'churn_by_month' },
          visualConfig: { colorScheme: 'warm', showLegend: true, showGrid: true, animate: true },
        },
        {
          id: 'chart-churn-plan',
          type: 'bar_chart',
          title: 'Churn Rate by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 8, y: 3, w: 4, h: 5 },
          dataConfig: { source: 'churn_by_plan' },
          visualConfig: { colorScheme: 'cool' },
        },
        // ── Row 3: Regional & Revenue Impact ─────────────────
        {
          id: 'chart-churn-region',
          type: 'bar_chart',
          title: 'Churn by Region',
          subtitle: 'Geographic churn distribution',
          position: { x: 0, y: 8, w: 6, h: 4 },
          dataConfig: { source: 'churn_by_region' },
          visualConfig: { colorScheme: 'vibrant' },
        },
        {
          id: 'chart-revenue-impact',
          type: 'area_chart',
          title: 'Revenue Impact',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 6, y: 8, w: 6, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        // ── Row 4: Customer Distribution ─────────────────────
        {
          id: 'chart-customers-plan',
          type: 'donut_chart',
          title: 'Customers by Plan',
          subtitle: 'Subscription tier distribution',
          position: { x: 0, y: 12, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        {
          id: 'table-customers-region',
          type: 'table',
          title: 'Regional Customer Breakdown',
          subtitle: 'Customers · MRR · Churn Rate by region',
          position: { x: 4, y: 12, w: 8, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: {},
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-churn',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Starter plan churn is 3x higher than Enterprise. Investing in onboarding automation for Starter-tier customers could reduce overall churn by 15-20% within two quarters.',
          position: { x: 0, y: 16, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'purple', backgroundColor: 'purple' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SALES PIPELINE — 10 widgets
   * Pipeline funnel, deal source mix, revenue trends,
   * MRR growth, and detailed deal tables.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-sales': {
    title: 'Sales Pipeline',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-sales',
          type: 'text_block',
          title: 'Sales Pipeline',
          subtitle: 'Deal flow, conversion rates, and revenue pipeline health',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'cyan' } },
        },
        // ── Row 1: KPIs ──────────────────────────────────────
        {
          id: 'kpi-pipeline',
          type: 'kpi_card',
          title: 'Pipeline Value',
          subtitle: 'Total weighted pipeline',
          position: { x: 0, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'pipeline_value' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-win-rate',
          type: 'kpi_card',
          title: 'Win Rate',
          subtitle: 'Deal close percentage',
          position: { x: 3, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'win_rate' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-deal-size',
          type: 'kpi_card',
          title: 'Avg Deal Size',
          subtitle: 'Average contract value',
          position: { x: 6, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_deal_size' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'ARR',
          subtitle: 'Annual recurring revenue',
          position: { x: 9, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 2: Pipeline & Source ─────────────────────────
        {
          id: 'chart-pipeline-funnel',
          type: 'funnel',
          title: 'Pipeline Funnel',
          subtitle: 'Prospect → Qualified → Proposal → Negotiation',
          position: { x: 0, y: 3, w: 6, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
        {
          id: 'chart-deals-source',
          type: 'donut_chart',
          title: 'Deals by Source',
          subtitle: 'Inbound · Outbound · Referral · Partner',
          position: { x: 6, y: 3, w: 6, h: 4 },
          dataConfig: { source: 'deals_by_source' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 3: Revenue & Growth ──────────────────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'Monthly revenue trajectory',
          position: { x: 0, y: 7, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth',
          subtitle: 'Month-over-month trend',
          position: { x: 8, y: 7, w: 4, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true },
        },
        // ── Row 4: Detail Tables ─────────────────────────────
        {
          id: 'table-deals-source',
          type: 'table',
          title: 'Deal Source Performance',
          subtitle: 'Count · Value · Win Rate by source',
          position: { x: 0, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'deals_by_source' },
          visualConfig: {},
        },
        {
          id: 'chart-customers-plan',
          type: 'bar_chart',
          title: 'Customers by Plan',
          subtitle: 'Revenue by subscription tier',
          position: { x: 6, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { colorScheme: 'cool' },
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-sales',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Referral-sourced deals close at 2x the rate of outbound with 40% larger ACV. Scaling the partner program could accelerate pipeline velocity significantly.',
          position: { x: 0, y: 15, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'cyan', backgroundColor: 'cyan' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CUSTOMER HEALTH — 10 widgets
   * Usage analytics, feature adoption, regional distribution,
   * satisfaction metrics, and churn risk indicators.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-customer': {
    title: 'Customer Health',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-customer',
          type: 'text_block',
          title: 'Customer Health',
          subtitle: 'Usage patterns, feature adoption, and engagement signals across your customer base',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'amber' } },
        },
        // ── Row 1: KPIs ──────────────────────────────────────
        {
          id: 'kpi-active',
          type: 'kpi_card',
          title: 'Active Customers',
          subtitle: 'Currently subscribed',
          position: { x: 0, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'active_customers' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 3, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 6, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-churn',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 9, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        // ── Row 2: Usage Trends & Adoption ───────────────────
        {
          id: 'chart-usage-trend',
          type: 'area_chart',
          title: 'Product Usage Over Time',
          subtitle: 'Mail Scan · Package Forward · Check Deposit · Address Use',
          position: { x: 0, y: 3, w: 8, h: 4 },
          dataConfig: { source: 'usage_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-feature-adoption',
          type: 'donut_chart',
          title: 'Feature Adoption',
          subtitle: 'Usage distribution across features',
          position: { x: 8, y: 3, w: 4, h: 4 },
          dataConfig: { source: 'usage_by_feature' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 3: Customer Distribution ─────────────────────
        {
          id: 'chart-customers-plan',
          type: 'bar_chart',
          title: 'Customers by Plan',
          subtitle: 'Count & revenue per tier',
          position: { x: 0, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'chart-customers-region',
          type: 'bar_chart',
          title: 'Customers by Region',
          subtitle: 'Geographic distribution',
          position: { x: 6, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: { colorScheme: 'warm' },
        },
        // ── Row 4: Detail Tables ─────────────────────────────
        {
          id: 'table-feature-usage',
          type: 'table',
          title: 'Feature Usage Details',
          subtitle: 'Daily Users · Total Usage · Adoption Rate',
          position: { x: 0, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'usage_by_feature' },
          visualConfig: {},
        },
        {
          id: 'chart-churn-plan',
          type: 'bar_chart',
          title: 'Churn Risk by Plan',
          subtitle: 'Churn rate per subscription tier',
          position: { x: 6, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'churn_by_plan' },
          visualConfig: { colorScheme: 'warm' },
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-customer',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Customers using 3+ features have 78% lower churn than single-feature users. Focus onboarding on driving multi-feature adoption within the first 30 days.',
          position: { x: 0, y: 15, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'amber', backgroundColor: 'amber' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * FINANCIAL OVERVIEW — 10 widgets
   * Revenue deep-dive, MRR/ARR tracking, retention metrics,
   * revenue composition, and customer revenue analysis.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-finance': {
    title: 'Financial Overview',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-finance',
          type: 'text_block',
          title: 'Financial Overview',
          subtitle: 'Revenue performance, retention economics, and growth trajectory',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'dark' } },
        },
        // ── Row 1: KPIs ──────────────────────────────────────
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'MRR',
          subtitle: 'Monthly recurring revenue',
          position: { x: 0, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'ARR',
          subtitle: 'Annual recurring revenue',
          position: { x: 3, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 6, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-grr',
          type: 'kpi_card',
          title: 'Gross Revenue Retention',
          subtitle: 'Before expansion revenue',
          position: { x: 9, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'grr' } },
          visualConfig: { colorScheme: 'amber' },
        },
        // ── Row 2: Revenue Trend & Composition ───────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 0, y: 3, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-revenue-mix',
          type: 'stacked_bar',
          title: 'Revenue Composition',
          subtitle: 'Monthly breakdown by type',
          position: { x: 8, y: 3, w: 4, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { stacked: true, colorScheme: 'cool', showLegend: true },
        },
        // ── Row 3: MRR & Plan Revenue ────────────────────────
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth Trend',
          subtitle: 'Month-over-month recurring revenue',
          position: { x: 0, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true, animate: true },
        },
        {
          id: 'chart-plan-revenue',
          type: 'donut_chart',
          title: 'Revenue by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 6, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 4: Regional & Pipeline ───────────────────────
        {
          id: 'table-region-revenue',
          type: 'table',
          title: 'Revenue by Region',
          subtitle: 'Customers · MRR · Churn Rate',
          position: { x: 0, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: {},
        },
        {
          id: 'chart-pipeline',
          type: 'funnel',
          title: 'Sales Pipeline',
          subtitle: 'Prospect → Negotiation',
          position: { x: 6, y: 11, w: 6, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-finance',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Expansion revenue now represents 35% of new MRR — a sign of strong product-market fit. GRR above 90% confirms the core product retains value even without upsells.',
          position: { x: 0, y: 15, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'blue', backgroundColor: 'blue' } },
        },
      ],
    },
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CS AUTOMATION — 12 widgets
   * Chatbot & voice bot deflection rates, automated resolution trends,
   * channel performance, topic-level bot accuracy, and cost savings.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  'template-cs-automation': {
    title: 'CS Automation',
    schema: {
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      globalFilters: [],
      widgets: [
        // ── Banner ─────────────────────────────────────────────
        {
          id: 'banner-cs',
          type: 'text_block',
          title: 'CS Automation',
          subtitle: 'AI deflection rates, bot performance, and cost savings across chat, voice, and ticket channels',
          position: { x: 0, y: 0, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'purple' } },
        },
        // ── Row 1: KPIs ──────────────────────────────────────
        {
          id: 'kpi-chat-deflection',
          type: 'kpi_card',
          title: 'Chat Deflection Rate',
          subtitle: 'Fully resolved by chatbot',
          position: { x: 0, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'cs_automation_summary', aggregation: { function: 'avg', field: 'chat_deflection_rate' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-voice-deflection',
          type: 'kpi_card',
          title: 'Voice Deflection Rate',
          subtitle: 'Resolved by voice bot',
          position: { x: 3, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'cs_automation_summary', aggregation: { function: 'avg', field: 'voice_deflection_rate' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-ticket-deflection',
          type: 'kpi_card',
          title: 'Ticket Deflection Rate',
          subtitle: 'Auto-resolved tickets',
          position: { x: 6, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'cs_automation_summary', aggregation: { function: 'avg', field: 'ticket_deflection_rate' } },
          visualConfig: { colorScheme: 'amber' },
        },
        {
          id: 'kpi-overall-deflection',
          type: 'kpi_card',
          title: 'Overall Deflection',
          subtitle: 'All channels combined',
          position: { x: 9, y: 1, w: 3, h: 2 },
          dataConfig: { source: 'cs_automation_summary', aggregation: { function: 'avg', field: 'overall_deflection_rate' } },
          visualConfig: { colorScheme: 'purple' },
        },
        // ── Row 2: Deflection Trend & Channel Breakdown ───────
        {
          id: 'chart-deflection-trend',
          type: 'area_chart',
          title: 'Deflection Rate Trend',
          subtitle: 'Chat · Voice · Ticket deflection over 16 months',
          position: { x: 0, y: 3, w: 8, h: 4 },
          dataConfig: { source: 'cs_deflection_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'cool', showGrid: true, animate: true },
        },
        {
          id: 'chart-channel-breakdown',
          type: 'bar_chart',
          title: 'Deflection by Channel',
          subtitle: 'Chat vs. Voice vs. Ticket',
          position: { x: 8, y: 3, w: 4, h: 4 },
          dataConfig: { source: 'cs_deflection_by_channel' },
          visualConfig: { colorScheme: 'vibrant' },
        },
        // ── Row 3: Cost Savings & Bot CSAT ────────────────────
        {
          id: 'chart-cost-savings',
          type: 'area_chart',
          title: 'Cost Savings from Automation',
          subtitle: 'Monthly savings vs. human support costs',
          position: { x: 0, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'cs_cost_savings' },
          visualConfig: { showLegend: true, colorScheme: 'green', animate: true },
        },
        {
          id: 'chart-conversations-donut',
          type: 'donut_chart',
          title: 'Conversations by Channel',
          subtitle: 'Volume distribution across channels',
          position: { x: 6, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'cs_deflection_by_channel' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 4: Bot Topic Performance Table ────────────────
        {
          id: 'table-bot-topics',
          type: 'table',
          title: 'Bot Performance by Topic',
          subtitle: 'Queries · Deflection Rate · Confidence · Escalation · CSAT',
          position: { x: 0, y: 11, w: 12, h: 5 },
          dataConfig: { source: 'cs_bot_topic_performance' },
          visualConfig: {},
        },
        // ── Key Insight ────────────────────────────────────────
        {
          id: 'insight-cs',
          type: 'text_block',
          title: 'Key Insight',
          subtitle: 'Chat deflection at ~50% is saving $14K+/mo in agent costs. Voice bot is early (7%) but growing fast. Ticket automation is the next frontier — even 10% deflection would save $8K/mo at current volume.',
          position: { x: 0, y: 16, w: 12, h: 1 },
          dataConfig: { source: '' },
          visualConfig: { customStyles: { variant: 'callout', icon: 'lightbulb', borderAccent: 'purple', backgroundColor: 'purple' } },
        },
      ],
    },
  },
};
