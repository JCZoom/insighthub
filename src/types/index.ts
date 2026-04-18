export interface DashboardSchema {
  layout: {
    columns: number;
    rowHeight: number;
    gap: number;
  };
  globalFilters: FilterConfig[];
  widgets: WidgetConfig[];
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  position: { x: number; y: number; w: number; h: number };
  dataConfig: {
    source: string;
    query?: string;
    filters?: FilterConfig[];
    aggregation?: AggregationConfig;
    groupBy?: string[];
    orderBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
  };
  visualConfig: {
    chartType?: ChartType;
    colorScheme?: string;
    showLegend?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
    stacked?: boolean;
    animate?: boolean;
    thresholds?: ThresholdConfig[];
    customStyles?: Record<string, string>;
  };
  glossaryTermIds?: string[];
}

export type WidgetType =
  | 'kpi_card'
  | 'line_chart'
  | 'bar_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'stacked_bar'
  | 'scatter_plot'
  | 'heatmap'
  | 'table'
  | 'pivot_table'
  | 'funnel'
  | 'gauge'
  | 'metric_row'
  | 'text_block'
  | 'image'
  | 'divider'
  | 'map';

export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'funnel'
  | 'gauge'
  | 'radar'
  | 'treemap';

export interface FilterConfig {
  field: string;
  label: string;
  type: 'date_range' | 'select' | 'multi_select' | 'number_range' | 'text';
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

export interface AggregationConfig {
  function: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'median' | 'percentile';
  field: string;
  percentileValue?: number;
}

export interface ThresholdConfig {
  value: number;
  color: string;
  label?: string;
}

export interface SchemaPatch {
  type: 'add_widget' | 'remove_widget' | 'update_widget' | 'update_layout' | 'update_filters' | 'replace_all' | 'use_widget';
  widgetId?: string;
  widget?: WidgetConfig;
  widgetTemplateId?: string;
  changes?: Partial<WidgetConfig>;
  layout?: Partial<DashboardSchema['layout']>;
  filters?: FilterConfig[];
  schema?: DashboardSchema;
}

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  schemaPatches?: SchemaPatch[];
  quickActions?: QuickAction[];
  sql?: string;
  sqlType?: 'generated' | 'explained' | 'optimized' | 'verified';
  isSqlMode?: boolean;
  createdAt: Date;
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon?: string;
}

export const EMPTY_DASHBOARD_SCHEMA: DashboardSchema = {
  layout: { columns: 12, rowHeight: 80, gap: 16 },
  globalFilters: [],
  widgets: [],
};
