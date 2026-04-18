'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { WidgetConfig } from '@/types';
import { queryData } from '@/lib/data/sample-data';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';

interface WidgetDetailOverlayProps {
  config: WidgetConfig;
  onClose: () => void;
}

// --- Detail data generators per widget type ---

interface DetailSection {
  title: string;
  type: 'chart' | 'table' | 'stats' | 'text';
  data?: Record<string, unknown>[];
  chartType?: 'line' | 'bar';
  text?: string;
}

function formatCell(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value !== 'number') return String(value);
  const isPercent = key.includes('rate') || key.includes('percent') || key.includes('csat') || key.includes('adoption') || key.includes('win_rate');
  const isCurrency = key.includes('mrr') || key.includes('arr') || key.includes('revenue') || key.includes('amount') || key.includes('value') || key.includes('deal_size');
  if (isPercent) return formatPercent(value);
  if (isCurrency) return formatCurrency(value, { compact: true });
  return formatNumber(value, { decimals: value % 1 !== 0 ? 1 : 0 });
}

// Map from a widget's data source to related sources for drill-down
const RELATED_SOURCES: Record<string, string[]> = {
  'kpi_summary': ['mrr_by_month', 'churn_by_region', 'tickets_by_category'],
  'mrr_by_month': ['revenue_by_type', 'customers_by_plan'],
  'revenue_by_month': ['revenue_by_type', 'mrr_by_month'],
  'revenue_by_type': ['revenue_by_month', 'customers_by_plan'],
  'churn_by_region': ['churn_by_month', 'churn_by_plan'],
  'churn_by_month': ['churn_by_region', 'churn_by_plan'],
  'churn_by_plan': ['churn_by_month', 'churn_by_region'],
  'tickets_by_category': ['tickets_by_month', 'tickets_by_team'],
  'tickets_by_month': ['tickets_by_category', 'tickets_by_team'],
  'tickets_by_team': ['tickets_by_month', 'tickets_by_category'],
  'deals_pipeline': ['deals_by_source', 'kpi_summary'],
  'deals_by_source': ['deals_pipeline', 'kpi_summary'],
  'usage_by_feature': ['usage_by_month', 'customers_by_plan'],
  'usage_by_month': ['usage_by_feature', 'customers_by_region'],
  'customers_by_plan': ['mrr_by_month', 'churn_by_plan'],
  'customers_by_region': ['churn_by_region', 'mrr_by_month'],
  'sample_subscriptions': ['revenue_by_type', 'churn_by_plan'],
  'sample_tickets': ['tickets_by_category', 'tickets_by_team'],
  'sample_revenue': ['revenue_by_type', 'mrr_by_month'],
  'sample_usage': ['usage_by_feature', 'customers_by_region'],
  'sample_deals': ['deals_by_source', 'kpi_summary'],
  'sample_customers': ['customers_by_plan', 'churn_by_region'],
};

const FRIENDLY_NAMES: Record<string, string> = {
  'mrr_by_month': 'MRR Trend by Month',
  'revenue_by_month': 'Revenue Over Time',
  'revenue_by_type': 'Revenue Breakdown by Type',
  'churn_by_region': 'Churn Rate by Region',
  'churn_by_month': 'Churn Trend by Month',
  'churn_by_plan': 'Churn by Plan',
  'tickets_by_category': 'Tickets by Category',
  'tickets_by_month': 'Support Volume Over Time',
  'tickets_by_team': 'Performance by Team',
  'deals_pipeline': 'Pipeline Stages',
  'deals_by_source': 'Deals by Source',
  'usage_by_feature': 'Feature Usage',
  'usage_by_month': 'Usage Trend',
  'customers_by_plan': 'Customer Distribution by Plan',
  'customers_by_region': 'Customers by Region',
  'kpi_summary': 'Key Metrics Summary',
};

function generateDetailSections(config: WidgetConfig): DetailSection[] {
  const source = config.dataConfig.source;
  const { data: primaryData } = queryData(source, config.dataConfig.groupBy);
  const sections: DetailSection[] = [];

  // Summary stats from primary data
  if (primaryData.length > 0) {
    const numericKeys = Object.keys(primaryData[0]).filter(k => typeof primaryData[0][k] === 'number');
    if (numericKeys.length > 0) {
      const stats: Record<string, unknown>[] = numericKeys.map(key => {
        const values = primaryData.map(row => Number(row[key]) || 0);
        return {
          metric: key.replace(/_/g, ' '),
          min: Math.min(...values),
          max: Math.max(...values),
          avg: +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1),
          total: Math.round(values.reduce((s, v) => s + v, 0)),
        };
      });
      sections.push({ title: 'Summary Statistics', type: 'stats', data: stats });
    }
  }

  // Full data table
  if (primaryData.length > 0 && config.type !== 'table' && config.type !== 'pivot_table') {
    sections.push({ title: 'Full Data', type: 'table', data: primaryData });
  }

  // Related drill-down data
  const relatedSources = RELATED_SOURCES[source] || [];
  for (const relSource of relatedSources.slice(0, 2)) {
    const { data: relData } = queryData(relSource);
    if (relData.length > 0) {
      const hasMonth = Object.keys(relData[0]).some(k => k.includes('month') || k.includes('date'));
      sections.push({
        title: FRIENDLY_NAMES[relSource] || relSource.replace(/_/g, ' '),
        type: 'chart',
        data: relData,
        chartType: hasMonth ? 'line' : 'bar',
      });
    }
  }

  return sections;
}

// --- Renderers for detail sections ---

const CHART_COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#39d2c0', '#f85149'];

function DetailChart({ section }: { section: DetailSection }) {
  const data = section.data || [];
  if (!data.length) return null;

  const sample = data[0];
  const xKey = Object.keys(sample).find(k => typeof sample[k] === 'string') || Object.keys(sample)[0];
  const numKeys = Object.keys(sample).filter(k => k !== xKey && typeof sample[k] === 'number');

  const ChartComp = section.chartType === 'line' ? LineChart : BarChart;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ChartComp data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '11px' }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} />
          {numKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '10px' }} />}
          {numKeys.map((key, i) =>
            section.chartType === 'line' ? (
              <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
            ) : (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
            )
          )}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
}

function DetailTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return null;
  const columns = Object.keys(data[0]);
  return (
    <div className="overflow-auto max-h-64 rounded-lg border border-[var(--border-color)]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--bg-card)]">
          <tr className="border-b border-[var(--border-color)]">
            {columns.map(col => (
              <th key={col} className="text-left py-2 px-3 font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-card-hover)] transition-colors">
              {columns.map(col => (
                <td key={col} className="py-2 px-3 text-[var(--text-primary)]">
                  {formatCell(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailStats({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {data.map((stat, i) => (
        <div key={i} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            {String(stat.metric)}
          </p>
          <div className="space-y-0.5 text-xs">
            <p className="text-[var(--text-primary)]"><span className="text-[var(--text-muted)]">Avg:</span> {formatCell(String(stat.metric), stat.avg)}</p>
            <p className="text-[var(--text-primary)]"><span className="text-[var(--text-muted)]">Min:</span> {formatCell(String(stat.metric), stat.min)}</p>
            <p className="text-[var(--text-primary)]"><span className="text-[var(--text-muted)]">Max:</span> {formatCell(String(stat.metric), stat.max)}</p>
            <p className="text-[var(--text-primary)]"><span className="text-[var(--text-muted)]">Total:</span> {formatCell(String(stat.metric), stat.total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Overlay ---

export function WidgetDetailOverlay({ config, onClose }: WidgetDetailOverlayProps) {
  const sections = generateDetailSections(config);
  const source = config.dataConfig.source;
  const { data: primaryData } = queryData(source, config.dataConfig.groupBy);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Overlay panel */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] mt-[5vh] mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 overflow-y-auto fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{config.title}</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {config.subtitle || `${config.type.replace(/_/g, ' ')} · ${primaryData.length} records · Source: ${source}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Detail sections */}
        <div className="p-6 space-y-6">
          {sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{section.title}</h3>
              {section.type === 'chart' && <DetailChart section={section} />}
              {section.type === 'table' && section.data && <DetailTable data={section.data} />}
              {section.type === 'stats' && section.data && <DetailStats data={section.data} />}
              {section.type === 'text' && (
                <p className="text-xs text-[var(--text-secondary)]">{section.text}</p>
              )}
            </div>
          ))}

          {sections.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              No additional detail data available for this widget type.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
