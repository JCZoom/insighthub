'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Database, BarChart3, Copy, Check, Table2, Filter, Layers, Download, FileText, Camera, Image } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { WidgetConfig } from '@/types';
import { Tooltip as UITooltip } from '@/components/ui/Tooltip';
import { queryDataSync } from '@/lib/data/sample-data';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import { exportToCSV, exportToPNG } from '@/lib/export-utils';

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
  const isPercent = key.includes('rate') || key.includes('percent') || key.includes('nrr') || key.includes('grr') || key.includes('retention') || key.includes('csat') || key.includes('win_rate') || key.includes('adoption');
  const isCurrency = key.includes('mrr') || key.includes('arr') || key.includes('revenue') || key.includes('amount') || key.includes('pipeline') || key.includes('deal_size');
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
  const { data: primaryData } = queryDataSync(source, config.dataConfig.groupBy);
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
    const { data: relData } = queryDataSync(relSource);
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
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '11px' }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} />
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

// --- Data Lineage Tab ---

function DataLineageTab({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  const [copied, setCopied] = useState(false);
  const source = config.dataConfig.source;
  const { groupBy, filters, aggregation, orderBy, limit, query } = config.dataConfig;
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const handleCopyConfig = () => {
    const configObj = {
      widgetId: config.id,
      title: config.title,
      type: config.type,
      dataConfig: config.dataConfig,
    };
    navigator.clipboard.writeText(JSON.stringify(configObj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Source Badge */}
      <div className="flex items-start gap-4">
        <div className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-accent-blue" />
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Data Source</h4>
          </div>
          <p className="text-sm font-mono text-accent-cyan">{source}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {FRIENDLY_NAMES[source] || source.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Table2 size={14} className="text-accent-purple" />
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Shape</h4>
          </div>
          <p className="text-sm text-[var(--text-primary)]">
            <span className="font-semibold">{data.length}</span> rows × <span className="font-semibold">{columns.length}</span> columns
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Widget type: {config.type.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      {/* Query Configuration */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-accent-amber" />
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Query Configuration</h4>
          </div>
          <button
            onClick={handleCopyConfig}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            {copied ? <><Check size={10} className="text-accent-green" /> Copied</> : <><Copy size={10} /> Copy Config</>}
          </button>
        </div>
        <div className="space-y-2 text-xs">
          {query && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Query:</span>
              <span className="font-mono text-[var(--text-primary)]">{query}</span>
            </div>
          )}
          {groupBy && groupBy.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Group by:</span>
              <span className="font-mono text-accent-cyan">{groupBy.join(', ')}</span>
            </div>
          )}
          {aggregation && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Aggregation:</span>
              <span className="font-mono text-accent-purple">{aggregation.function}({aggregation.field})</span>
            </div>
          )}
          {filters && filters.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Filters:</span>
              <span className="font-mono text-accent-amber">{filters.map(f => `${f.field}: ${f.type}`).join(', ')}</span>
            </div>
          )}
          {orderBy && orderBy.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Order by:</span>
              <span className="font-mono text-[var(--text-primary)]">{orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}</span>
            </div>
          )}
          {limit && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)] min-w-[80px]">Limit:</span>
              <span className="font-mono text-[var(--text-primary)]">{limit}</span>
            </div>
          )}
          {!query && !groupBy?.length && !aggregation && !filters?.length && !orderBy?.length && !limit && (
            <p className="text-[var(--text-muted)] italic">No query modifiers — using full dataset from source</p>
          )}
        </div>
      </div>

      {/* Column Schema */}
      {columns.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-accent-green" />
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Column Schema</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {columns.map(col => {
              const sampleVal = data[0][col];
              const colType = typeof sampleVal;
              const typeColor = colType === 'number' ? 'text-accent-blue' : colType === 'string' ? 'text-accent-green' : 'text-[var(--text-muted)]';
              return (
                <div key={col} className="flex items-center gap-2 py-1 px-2 rounded-md bg-[var(--bg-card-hover)]">
                  <span className={`text-[10px] font-mono ${typeColor} min-w-[40px]`}>{colType === 'number' ? 'NUM' : colType === 'string' ? 'STR' : 'ANY'}</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono truncate">{col}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Data Preview */}
      {data.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Table2 size={14} className="text-[var(--text-muted)]" />
            Raw Data ({data.length} rows)
          </h4>
          <DetailTable data={data} />
        </div>
      )}
    </div>
  );
}

// --- Main Overlay ---

type TabId = 'insights' | 'data';

export function WidgetDetailOverlay({ config, onClose }: WidgetDetailOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabId>('insights');
  const sections = generateDetailSections(config);
  const source = config.dataConfig.source;
  const { data: primaryData } = queryDataSync(source, config.dataConfig.groupBy);

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
      <div id="widget-detail-overlay" className="relative z-10 w-full max-w-4xl max-h-[90vh] mt-[5vh] mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 overflow-y-auto fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{config.title}</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {config.subtitle || `${config.type.replace(/_/g, ' ')} · ${primaryData.length} records · Source: ${source}`}
              </p>
            </div>
            <div data-export-ignore="true" className="flex items-center gap-1">
              <UITooltip content="Export data as CSV">
                <button
                  onClick={() => exportToCSV(primaryData, `${config.title.replace(/[^a-zA-Z0-9]/g, '_')}_data`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <FileText size={14} />
                  CSV
                </button>
              </UITooltip>
              <UITooltip content="Export widget as PNG image">
                <button
                  onClick={() => exportToPNG('widget-detail-overlay', `${config.title.replace(/[^a-zA-Z0-9]/g, '_')}_widget`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <Camera size={14} />
                  PNG
                </button>
              </UITooltip>
              {/* SVG export hidden — font fidelity issues. Code kept in export-utils.ts for future use. */}
              <button
                data-export-ignore="true"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 px-6 pb-0">
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'insights'
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BarChart3 size={12} /> Insights
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'data'
                  ? 'border-accent-cyan text-accent-cyan'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Database size={12} /> Data Lineage
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'insights' && (
            <div className="space-y-6">
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
          )}
          {activeTab === 'data' && (
            <DataLineageTab config={config} data={primaryData} />
          )}
        </div>
      </div>
    </div>
  );
}
