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
        // ── Row 0: KPI Banner (6 compact cards) ──────────────
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'Monthly Recurring Revenue',
          subtitle: 'All active subscriptions',
          position: { x: 0, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'Annual Run Rate',
          subtitle: 'Projected yearly revenue',
          position: { x: 2, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 4, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-churn',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 6, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 8, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-pipeline',
          type: 'kpi_card',
          title: 'Pipeline Value',
          subtitle: 'Weighted open deals',
          position: { x: 10, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'pipeline_value' } },
          visualConfig: { colorScheme: 'amber' },
        },
        // ── Row 1: Revenue & Plan Mix ────────────────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 0, y: 2, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-customers-plan',
          type: 'donut_chart',
          title: 'Customers by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 8, y: 2, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 2: Growth, Composition, Pipeline ─────────────
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth Trend',
          subtitle: 'Month-over-month recurring revenue',
          position: { x: 0, y: 6, w: 4, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true, animate: true },
        },
        {
          id: 'chart-revenue-composition',
          type: 'stacked_bar',
          title: 'Revenue Composition',
          subtitle: 'Monthly revenue by category',
          position: { x: 4, y: 6, w: 4, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { stacked: true, colorScheme: 'cool', showLegend: true },
        },
        {
          id: 'chart-pipeline-funnel',
          type: 'funnel',
          title: 'Deal Pipeline',
          subtitle: 'Prospect → Negotiation',
          position: { x: 8, y: 6, w: 4, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
        // ── Row 3: Regional & Team Deep-Dives ────────────────
        {
          id: 'chart-churn-region',
          type: 'bar_chart',
          title: 'Churn Rate by Region',
          subtitle: 'Geographic churn distribution',
          position: { x: 0, y: 10, w: 4, h: 4 },
          dataConfig: { source: 'churn_by_region' },
          visualConfig: { colorScheme: 'warm' },
        },
        {
          id: 'chart-customers-region',
          type: 'bar_chart',
          title: 'Customers by Region',
          subtitle: 'Regional customer distribution',
          position: { x: 4, y: 10, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'table-team-perf',
          type: 'table',
          title: 'Support Team Performance',
          subtitle: 'Open · Pending · Resolved · CSAT',
          position: { x: 8, y: 10, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: {},
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
        // ── Row 0: KPIs ──────────────────────────────────────
        {
          id: 'kpi-open-tickets',
          type: 'kpi_card',
          title: 'Open Tickets',
          subtitle: 'Awaiting resolution',
          position: { x: 0, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'open_tickets' } },
          visualConfig: { colorScheme: 'amber' },
        },
        {
          id: 'kpi-frt',
          type: 'kpi_card',
          title: 'Avg First Response',
          subtitle: 'Minutes to first reply',
          position: { x: 3, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_frt_minutes' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 6, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-total-customers',
          type: 'kpi_card',
          title: 'Total Customers',
          subtitle: 'All active accounts',
          position: { x: 9, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'total_customers' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 1: Volume & Breakdown ────────────────────────
        {
          id: 'chart-ticket-volume',
          type: 'area_chart',
          title: 'Ticket Volume Over Time',
          subtitle: 'Total vs. resolved tickets by month',
          position: { x: 0, y: 2, w: 8, h: 4 },
          dataConfig: { source: 'tickets_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-tickets-category',
          type: 'donut_chart',
          title: 'Tickets by Category',
          subtitle: 'Billing · Technical · Onboarding · Feature · Cancel',
          position: { x: 8, y: 2, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_category' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 2: Resolution & CSAT ─────────────────────────
        {
          id: 'chart-resolution-times',
          type: 'bar_chart',
          title: 'Resolution Times by Category',
          subtitle: 'Avg hours to resolve per category',
          position: { x: 0, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'tickets_by_category' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'chart-csat-trend',
          type: 'line_chart',
          title: 'CSAT Trend Over Time',
          subtitle: 'Monthly customer satisfaction score',
          position: { x: 6, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'tickets_by_month' },
          visualConfig: { colorScheme: 'green', showGrid: true, animate: true },
        },
        // ── Row 3: Team Performance ──────────────────────────
        {
          id: 'table-team-perf',
          type: 'table',
          title: 'Team Performance',
          subtitle: 'Open · Pending · Resolved · Avg Resolution · CSAT',
          position: { x: 0, y: 10, w: 8, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: {},
        },
        {
          id: 'chart-team-bar',
          type: 'bar_chart',
          title: 'Resolved Tickets by Team',
          subtitle: 'Team contribution to resolution',
          position: { x: 8, y: 10, w: 4, h: 4 },
          dataConfig: { source: 'tickets_by_team' },
          visualConfig: { colorScheme: 'vibrant' },
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
        // ── Row 0: KPI Banner (6 retention-focused metrics) ──
        {
          id: 'kpi-churn-rate',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 0, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Revenue kept + expansion',
          position: { x: 2, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-grr',
          type: 'kpi_card',
          title: 'Gross Revenue Retention',
          subtitle: 'Before expansion revenue',
          position: { x: 4, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'grr' } },
          visualConfig: { colorScheme: 'amber' },
        },
        {
          id: 'kpi-active',
          type: 'kpi_card',
          title: 'Active Customers',
          subtitle: 'Currently subscribed',
          position: { x: 6, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'active_customers' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'MRR',
          subtitle: 'Monthly recurring revenue',
          position: { x: 8, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Satisfaction indicator',
          position: { x: 10, y: 0, w: 2, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 1: Churn Trend & Plan Breakdown ──────────────
        {
          id: 'chart-churn-trend',
          type: 'area_chart',
          title: 'Churn Rate Trend',
          subtitle: '16-month churn trajectory with churned customer volume',
          position: { x: 0, y: 2, w: 8, h: 5 },
          dataConfig: { source: 'churn_by_month' },
          visualConfig: { colorScheme: 'warm', showLegend: true, showGrid: true, animate: true },
        },
        {
          id: 'chart-churn-plan',
          type: 'bar_chart',
          title: 'Churn Rate by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 8, y: 2, w: 4, h: 5 },
          dataConfig: { source: 'churn_by_plan' },
          visualConfig: { colorScheme: 'cool' },
        },
        // ── Row 2: Regional & Revenue Impact ─────────────────
        {
          id: 'chart-churn-region',
          type: 'bar_chart',
          title: 'Churn by Region',
          subtitle: 'Geographic churn distribution',
          position: { x: 0, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'churn_by_region' },
          visualConfig: { colorScheme: 'vibrant' },
        },
        {
          id: 'chart-revenue-impact',
          type: 'area_chart',
          title: 'Revenue Impact',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 6, y: 7, w: 6, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        // ── Row 3: Customer Distribution ─────────────────────
        {
          id: 'chart-customers-plan',
          type: 'donut_chart',
          title: 'Customers by Plan',
          subtitle: 'Subscription tier distribution',
          position: { x: 0, y: 11, w: 4, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        {
          id: 'table-customers-region',
          type: 'table',
          title: 'Regional Customer Breakdown',
          subtitle: 'Customers · MRR · Churn Rate by region',
          position: { x: 4, y: 11, w: 8, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: {},
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
        // ── Row 0: KPIs ──────────────────────────────────────
        {
          id: 'kpi-pipeline',
          type: 'kpi_card',
          title: 'Pipeline Value',
          subtitle: 'Total weighted pipeline',
          position: { x: 0, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'pipeline_value' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-win-rate',
          type: 'kpi_card',
          title: 'Win Rate',
          subtitle: 'Deal close percentage',
          position: { x: 3, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'win_rate' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-deal-size',
          type: 'kpi_card',
          title: 'Avg Deal Size',
          subtitle: 'Average contract value',
          position: { x: 6, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_deal_size' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'ARR',
          subtitle: 'Annual recurring revenue',
          position: { x: 9, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        // ── Row 1: Pipeline & Source ─────────────────────────
        {
          id: 'chart-pipeline-funnel',
          type: 'funnel',
          title: 'Pipeline Funnel',
          subtitle: 'Prospect → Qualified → Proposal → Negotiation',
          position: { x: 0, y: 2, w: 6, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
        {
          id: 'chart-deals-source',
          type: 'donut_chart',
          title: 'Deals by Source',
          subtitle: 'Inbound · Outbound · Referral · Partner',
          position: { x: 6, y: 2, w: 6, h: 4 },
          dataConfig: { source: 'deals_by_source' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 2: Revenue & Growth ──────────────────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'Monthly revenue trajectory',
          position: { x: 0, y: 6, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth',
          subtitle: 'Month-over-month trend',
          position: { x: 8, y: 6, w: 4, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true },
        },
        // ── Row 3: Detail Tables ─────────────────────────────
        {
          id: 'table-deals-source',
          type: 'table',
          title: 'Deal Source Performance',
          subtitle: 'Count · Value · Win Rate by source',
          position: { x: 0, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'deals_by_source' },
          visualConfig: {},
        },
        {
          id: 'chart-customers-plan',
          type: 'bar_chart',
          title: 'Customers by Plan',
          subtitle: 'Revenue by subscription tier',
          position: { x: 6, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { colorScheme: 'cool' },
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
        // ── Row 0: KPIs ──────────────────────────────────────
        {
          id: 'kpi-active',
          type: 'kpi_card',
          title: 'Active Customers',
          subtitle: 'Currently subscribed',
          position: { x: 0, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'active_customers' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-csat',
          type: 'kpi_card',
          title: 'CSAT Score',
          subtitle: 'Customer satisfaction',
          position: { x: 3, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'avg_csat' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 6, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'purple' },
        },
        {
          id: 'kpi-churn',
          type: 'kpi_card',
          title: 'Churn Rate',
          subtitle: 'Monthly customer churn',
          position: { x: 9, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'churn_rate' } },
          visualConfig: { colorScheme: 'red' },
        },
        // ── Row 1: Usage Trends & Adoption ───────────────────
        {
          id: 'chart-usage-trend',
          type: 'area_chart',
          title: 'Product Usage Over Time',
          subtitle: 'Mail Scan · Package Forward · Check Deposit · Address Use',
          position: { x: 0, y: 2, w: 8, h: 4 },
          dataConfig: { source: 'usage_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-feature-adoption',
          type: 'donut_chart',
          title: 'Feature Adoption',
          subtitle: 'Usage distribution across features',
          position: { x: 8, y: 2, w: 4, h: 4 },
          dataConfig: { source: 'usage_by_feature' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 2: Customer Distribution ─────────────────────
        {
          id: 'chart-customers-plan',
          type: 'bar_chart',
          title: 'Customers by Plan',
          subtitle: 'Count & revenue per tier',
          position: { x: 0, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { colorScheme: 'cool' },
        },
        {
          id: 'chart-customers-region',
          type: 'bar_chart',
          title: 'Customers by Region',
          subtitle: 'Geographic distribution',
          position: { x: 6, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: { colorScheme: 'warm' },
        },
        // ── Row 3: Detail Tables ─────────────────────────────
        {
          id: 'table-feature-usage',
          type: 'table',
          title: 'Feature Usage Details',
          subtitle: 'Daily Users · Total Usage · Adoption Rate',
          position: { x: 0, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'usage_by_feature' },
          visualConfig: {},
        },
        {
          id: 'chart-churn-plan',
          type: 'bar_chart',
          title: 'Churn Risk by Plan',
          subtitle: 'Churn rate per subscription tier',
          position: { x: 6, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'churn_by_plan' },
          visualConfig: { colorScheme: 'warm' },
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
        // ── Row 0: KPIs ──────────────────────────────────────
        {
          id: 'kpi-mrr',
          type: 'kpi_card',
          title: 'MRR',
          subtitle: 'Monthly recurring revenue',
          position: { x: 0, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'mrr' } },
          visualConfig: { colorScheme: 'blue' },
        },
        {
          id: 'kpi-arr',
          type: 'kpi_card',
          title: 'ARR',
          subtitle: 'Annual recurring revenue',
          position: { x: 3, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'sum', field: 'arr' } },
          visualConfig: { colorScheme: 'cyan' },
        },
        {
          id: 'kpi-nrr',
          type: 'kpi_card',
          title: 'Net Revenue Retention',
          subtitle: 'Expansion vs. churn',
          position: { x: 6, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'nrr' } },
          visualConfig: { colorScheme: 'green' },
        },
        {
          id: 'kpi-grr',
          type: 'kpi_card',
          title: 'Gross Revenue Retention',
          subtitle: 'Before expansion revenue',
          position: { x: 9, y: 0, w: 3, h: 2 },
          dataConfig: { source: 'kpi_summary', aggregation: { function: 'avg', field: 'grr' } },
          visualConfig: { colorScheme: 'amber' },
        },
        // ── Row 1: Revenue Trend & Composition ───────────────
        {
          id: 'chart-revenue-trend',
          type: 'area_chart',
          title: 'Revenue Trend',
          subtitle: 'New · Expansion · Contraction · Churn',
          position: { x: 0, y: 2, w: 8, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { showLegend: true, colorScheme: 'default', animate: true },
        },
        {
          id: 'chart-revenue-mix',
          type: 'stacked_bar',
          title: 'Revenue Composition',
          subtitle: 'Monthly breakdown by type',
          position: { x: 8, y: 2, w: 4, h: 4 },
          dataConfig: { source: 'revenue_by_month' },
          visualConfig: { stacked: true, colorScheme: 'cool', showLegend: true },
        },
        // ── Row 2: MRR & Plan Revenue ────────────────────────
        {
          id: 'chart-mrr-growth',
          type: 'line_chart',
          title: 'MRR Growth Trend',
          subtitle: 'Month-over-month recurring revenue',
          position: { x: 0, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'mrr_by_month' },
          visualConfig: { colorScheme: 'blue', showGrid: true, animate: true },
        },
        {
          id: 'chart-plan-revenue',
          type: 'donut_chart',
          title: 'Revenue by Plan',
          subtitle: 'Starter · Professional · Enterprise',
          position: { x: 6, y: 6, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_plan' },
          visualConfig: { showLegend: true, colorScheme: 'vibrant' },
        },
        // ── Row 3: Regional & Pipeline ───────────────────────
        {
          id: 'table-region-revenue',
          type: 'table',
          title: 'Revenue by Region',
          subtitle: 'Customers · MRR · Churn Rate',
          position: { x: 0, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'customers_by_region' },
          visualConfig: {},
        },
        {
          id: 'chart-pipeline',
          type: 'funnel',
          title: 'Sales Pipeline',
          subtitle: 'Prospect → Negotiation',
          position: { x: 6, y: 10, w: 6, h: 4 },
          dataConfig: { source: 'deals_pipeline' },
          visualConfig: { colorScheme: 'purple', animate: true },
        },
      ],
    },
  },
};
