import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';

// Base color palette — order matches the colorScheme names
const BASE_COLORS: Record<string, string> = {
  blue: '#6baaff',
  green: '#56c47a',
  purple: '#b48eff',
  amber: '#dba644',
  cyan: '#4dcec2',
  red: '#f47670',
};

const ALL_COLORS = ['#6baaff', '#56c47a', '#b48eff', '#dba644', '#4dcec2', '#f47670'];

/**
 * Returns a 6-color palette rotated so the selected scheme's color is first.
 * e.g. getColorPalette('green') → ['#56c47a', '#b48eff', '#dba644', '#4dcec2', '#f47670', '#6baaff']
 */
export function getColorPalette(scheme?: string): string[] {
  if (!scheme || !BASE_COLORS[scheme]) return ALL_COLORS;
  const primary = BASE_COLORS[scheme];
  const idx = ALL_COLORS.indexOf(primary);
  if (idx <= 0) return ALL_COLORS;
  return [...ALL_COLORS.slice(idx), ...ALL_COLORS.slice(0, idx)];
}

/** Returns the primary accent color for single-color widgets (scatter, gauge, etc.) */
export function getPrimaryColor(scheme?: string): string {
  return BASE_COLORS[scheme || 'blue'] || BASE_COLORS.blue;
}

/** Returns animation duration: 0 if animate is explicitly false, 800 otherwise */
export function getAnimationDuration(config: WidgetConfig): number {
  return config.visualConfig.animate === false ? 0 : 800;
}

/** Shared Recharts tooltip style matching the glassmorphism theme */
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(8px)',
  },
  labelStyle: { color: 'var(--text-primary)', fontWeight: 600 },
  itemStyle: { color: 'var(--text-secondary)' },
};

/** Widget minimum height constraints to prevent unreadable rendering */
export const MIN_WIDGET_HEIGHTS: Record<string, number> = {
  kpi_card: 120,
  line_chart: 150,
  bar_chart: 150,
  area_chart: 150,
  pie_chart: 150,
  donut_chart: 150,
  stacked_bar: 150,
  scatter_plot: 150,
  heatmap: 180,
  table: 200,
  pivot_table: 200,
  funnel: 150,
  gauge: 120,
  metric_row: 80,
  text_block: 60,
  image: 100,
  divider: 20,
  map: 200,
};

/** Widget minimum width constraints (in grid columns) to maintain usability */
export const MIN_WIDGET_WIDTHS: Record<string, number> = {
  kpi_card: 2,
  line_chart: 3,
  bar_chart: 3,
  area_chart: 3,
  pie_chart: 3,
  donut_chart: 3,
  stacked_bar: 3,
  scatter_plot: 3,
  heatmap: 4,
  table: 4,
  pivot_table: 4,
  funnel: 3,
  gauge: 2,
  metric_row: 3,
  text_block: 2,
  image: 2,
  divider: 1,
  map: 4,
};

/** Get minimum dimensions for a widget type */
export function getMinWidgetSize(widgetType: string): { minW: number; minH: number } {
  return {
    minW: MIN_WIDGET_WIDTHS[widgetType] || 2,
    minH: Math.ceil((MIN_WIDGET_HEIGHTS[widgetType] || 120) / 80), // Convert pixel height to grid rows (assuming 80px row height)
  };
}

// ── Smart Axis Formatting ──────────────────────────────────────────────

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format date-like x-axis labels compactly: "2025-01" → "Jan '25" */
export function formatDateTick(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  const m = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (m) {
    return `${SHORT_MONTHS[parseInt(m[2], 10) - 1]} '${m[1].slice(2)}`;
  }
  return value;
}

/** Compact Y-axis tick: 4500000 → "4.5M", 12000 → "12K" */
export function formatAxisNumber(value: unknown): string {
  const n = Number(value);
  if (isNaN(n)) return String(value ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return n.toFixed(n % 1 !== 0 ? 1 : 0);
}

/**
 * Calculate smart X-axis interval to prevent label overlap.
 * Returns the number of ticks to skip between visible labels.
 */
export function calcXInterval(dataLen: number, containerWidth: number): number {
  if (dataLen <= 4) return 0;
  const labelWidth = 55; // approx px per formatted label like "Jan '25"
  const usableWidth = containerWidth * 0.82; // account for margins
  const maxLabels = Math.max(3, Math.floor(usableWidth / labelWidth));
  if (dataLen <= maxLabels) return 0;
  return Math.ceil(dataLen / maxLabels) - 1;
}

/** Enhanced tooltip value formatter using existing utility functions */
function formatTooltipValue(value: any, name: string | number | undefined): [string, string] {
  const displayName = String(name || 'Value');
  if (value == null) return ['—', displayName];

  // Convert to number if possible
  const numValue = typeof value === 'number' ? value : Number(value);
  if (isNaN(numValue)) return [String(value), displayName];

  // Format based on field name patterns
  const lowerName = displayName.toLowerCase();
  const isPercent = lowerName.includes('rate') || lowerName.includes('percent') ||
                   lowerName.includes('nrr') || lowerName.includes('grr') ||
                   lowerName.includes('retention') || lowerName.includes('csat') ||
                   lowerName.includes('adoption') || lowerName.includes('win_rate') ||
                   lowerName.endsWith('%');
  const isCurrency = lowerName.includes('mrr') || lowerName.includes('arr') ||
                    lowerName.includes('revenue') || lowerName.includes('amount') ||
                    lowerName.includes('pipeline') || lowerName.includes('value') ||
                    lowerName.includes('deal_size') || lowerName.startsWith('$');

  let formattedValue: string;
  if (isPercent) {
    formattedValue = formatPercent(numValue);
  } else if (isCurrency) {
    formattedValue = formatCurrency(numValue, { compact: true });
  } else {
    // Use compact formatting for large numbers
    formattedValue = formatNumber(numValue, {
      decimals: numValue % 1 !== 0 ? 1 : 0,
      compact: Math.abs(numValue) >= 1000
    });
  }

  // Clean up field name for display
  const cleanDisplayName = displayName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();

  return [formattedValue, cleanDisplayName];
}

/** Get responsive tooltip configuration for touch vs desktop */
export function getTooltipConfig(isTouchDevice: boolean) {
  const baseConfig = {
    ...TOOLTIP_STYLE,
    formatter: formatTooltipValue,
    labelFormatter: (label: any) => {
      // Format labels (usually dates/categories) nicely
      if (typeof label === 'string' && label.includes('-')) {
        // Looks like a date
        const date = new Date(label);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short'
          });
        }
      }
      return String(label).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
  };

  if (isTouchDevice) {
    return {
      ...baseConfig,
      trigger: 'click' as const,
      allowEscapeViewBox: { x: true, y: true },
    };
  }
  return baseConfig;
}
