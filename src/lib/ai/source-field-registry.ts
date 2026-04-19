/**
 * Static registry of all known pre-aggregated data sources and their fields.
 * Used by the Data Integrity Verification Pipeline to validate that AI-generated
 * widget configurations reference real sources and fields.
 *
 * Source of truth: the data sources defined in prompts.ts § "Pre-Aggregated Data Sources"
 * and the generators in sample-data.ts.
 */

// ── Source → Field Mapping ─────────────────────────────────

export const SOURCE_FIELD_REGISTRY: Record<string, string[]> = {
  kpi_summary: [
    'total_customers', 'active_customers', 'mrr', 'arr', 'churn_rate',
    'nrr', 'grr', 'gross_revenue_retention', 'avg_csat', 'open_tickets',
    'avg_frt_minutes', 'pipeline_value', 'win_rate', 'avg_deal_size',
  ],
  churn_by_month: ['month', 'churn_rate', 'churned', 'active_start'],
  churn_by_region: ['region', 'churn_rate', 'churned_customers', 'total_customers'],
  churn_by_plan: ['plan', 'churn_rate', 'customers'],
  revenue_by_month: ['month', 'total', 'new', 'expansion', 'contraction', 'churn'],
  mrr_by_month: ['month', 'mrr', 'growth'],
  tickets_by_month: ['month', 'total', 'resolved', 'avg_frt_minutes', 'csat'],
  tickets_by_category: ['category', 'count', 'avg_resolution_hours', 'csat'],
  tickets_by_team: ['team', 'open', 'pending', 'resolved', 'avg_resolution_hours', 'csat'],
  deals_pipeline: ['stage', 'count', 'value', 'avg_days'],
  deals_by_source: ['source', 'count', 'value', 'win_rate'],
  customers_by_plan: ['plan', 'count', 'revenue'],
  customers_by_region: ['region', 'count', 'mrr', 'churn_rate'],
  usage_by_feature: ['feature', 'daily_users', 'total_usage', 'adoption_rate'],
  usage_by_month: ['month', 'mail_scan', 'package_forward', 'check_deposit', 'address_use'],
};

// ── Valid Enums ────────────────────────────────────────────

export const VALID_WIDGET_TYPES = [
  'kpi_card', 'line_chart', 'bar_chart', 'area_chart', 'pie_chart',
  'donut_chart', 'stacked_bar', 'scatter_plot', 'heatmap', 'table',
  'pivot_table', 'funnel', 'gauge', 'metric_row', 'text_block',
  'image', 'divider', 'map',
] as const;

export const VALID_AGGREGATION_FUNCTIONS = [
  'sum', 'avg', 'count', 'count_distinct', 'min', 'max', 'median', 'percentile',
] as const;

/** Widget types that don't display data (no dataConfig verification needed) */
export const NON_DATA_WIDGET_TYPES = ['text_block', 'divider', 'image'] as const;

/** Widget types that require categorical + numeric data (not time series) */
export const CATEGORICAL_CHART_TYPES = ['pie_chart', 'donut_chart', 'funnel'] as const;

/** Widget types that work best with time-series data */
export const TIME_SERIES_CHART_TYPES = ['line_chart', 'area_chart'] as const;

/** Fields that indicate time-series data */
export const TIME_DIMENSION_FIELDS = ['month', 'quarter', 'year', 'date', 'period', 'week'] as const;

/** Fields that indicate categorical data */
export const CATEGORICAL_DIMENSION_FIELDS = [
  'region', 'plan', 'category', 'team', 'stage', 'source', 'feature', 'status',
] as const;

// ── Helper Functions ───────────────────────────────────────

export function isValidSource(source: string): boolean {
  return source in SOURCE_FIELD_REGISTRY;
}

export function getFieldsForSource(source: string): string[] {
  return SOURCE_FIELD_REGISTRY[source] || [];
}

export function isValidField(source: string, field: string): boolean {
  const fields = SOURCE_FIELD_REGISTRY[source];
  return fields ? fields.includes(field) : false;
}

export function isNonDataWidget(type: string): boolean {
  return (NON_DATA_WIDGET_TYPES as readonly string[]).includes(type);
}

export function getAllSources(): string[] {
  return Object.keys(SOURCE_FIELD_REGISTRY);
}

/**
 * Determine whether a source primarily contains time-series data
 * by checking if it has a time dimension field.
 */
export function isTimeSeriesSource(source: string): boolean {
  const fields = SOURCE_FIELD_REGISTRY[source];
  if (!fields) return false;
  return fields.some(f => (TIME_DIMENSION_FIELDS as readonly string[]).includes(f));
}

/**
 * Determine whether a source primarily contains categorical data
 * by checking if it has a categorical dimension field.
 */
export function isCategoricalSource(source: string): boolean {
  const fields = SOURCE_FIELD_REGISTRY[source];
  if (!fields) return false;
  return fields.some(f => (CATEGORICAL_DIMENSION_FIELDS as readonly string[]).includes(f));
}
