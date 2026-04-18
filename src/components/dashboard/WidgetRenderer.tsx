'use client';

import type { WidgetConfig } from '@/types';
import { queryData } from '@/lib/data/sample-data';
import { KpiCard } from '@/components/widgets/KpiCard';
import { LineChartWidget } from '@/components/widgets/LineChartWidget';
import { BarChartWidget } from '@/components/widgets/BarChartWidget';
import { AreaChartWidget } from '@/components/widgets/AreaChartWidget';
import { PieChartWidget } from '@/components/widgets/PieChartWidget';
import { DataTableWidget } from '@/components/widgets/DataTableWidget';
import { GaugeWidget } from '@/components/widgets/GaugeWidget';
import { TextBlockWidget } from '@/components/widgets/TextBlockWidget';
import { FunnelWidget } from '@/components/widgets/FunnelWidget';
import { MetricRowWidget } from '@/components/widgets/MetricRowWidget';
import { ScatterPlotWidget } from '@/components/widgets/ScatterPlotWidget';

interface WidgetRendererProps {
  config: WidgetConfig;
  onDetailClick?: (config: WidgetConfig) => void;
}

export function WidgetRenderer({ config, onDetailClick }: WidgetRendererProps) {
  const source = config.dataConfig.source;
  const { data } = queryData(source, config.dataConfig.groupBy);

  // If the AI referenced a data source we don't have sample data for,
  // show a clear message instead of rendering an empty/broken chart.
  if (data.length === 0 && config.type !== 'text_block' && config.type !== 'divider') {
    return (
      <div className="card p-4 h-full flex flex-col items-center justify-center text-center gap-1">
        <p className="text-xs font-medium text-[var(--text-primary)]">{config.title}</p>
        <p className="text-[10px] text-[var(--text-muted)]">
          No data available for source &ldquo;{source}&rdquo;
        </p>
      </div>
    );
  }

  let widget: React.ReactNode;
  let showDetail = true;

  switch (config.type) {
    case 'kpi_card':
      widget = <KpiCard config={config} data={data} />;
      break;
    case 'line_chart':
      widget = <LineChartWidget config={config} data={data} />;
      break;
    case 'bar_chart':
    case 'stacked_bar':
      widget = <BarChartWidget config={config} data={data} />;
      break;
    case 'area_chart':
      widget = <AreaChartWidget config={config} data={data} />;
      break;
    case 'pie_chart':
    case 'donut_chart':
      widget = <PieChartWidget config={config} data={data} />;
      break;
    case 'table':
    case 'pivot_table':
      widget = <DataTableWidget config={config} data={data} />;
      break;
    case 'gauge':
      widget = <GaugeWidget config={config} data={data} />;
      break;
    case 'funnel':
      widget = <FunnelWidget config={config} data={data} />;
      break;
    case 'metric_row':
      widget = <MetricRowWidget config={config} data={data} />;
      break;
    case 'scatter_plot':
      widget = <ScatterPlotWidget config={config} data={data} />;
      break;
    case 'text_block':
      widget = <TextBlockWidget config={config} />;
      showDetail = false;
      break;
    case 'divider':
      return <div className="border-b border-[var(--border-color)] h-0 my-2" />;
    default:
      widget = (
        <div className="card p-4 h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Widget type &ldquo;{config.type}&rdquo; not yet implemented
        </div>
      );
      showDetail = false;
  }

  if (!showDetail || !onDetailClick) return <div className="h-full select-none">{widget}</div>;

  const handleClick = (e: React.MouseEvent) => {
    // Only open detail when clicking blank space — skip interactive child elements
    const target = e.target as HTMLElement;
    const tag = target.tagName.toLowerCase();
    const isInteractive = tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea';
    const insideInteractive = target.closest('button, a, input, select, textarea, .recharts-surface, table, th, td');
    if (isInteractive || insideInteractive) return;
    onDetailClick(config);
  };

  return (
    <div className="relative h-full group/detail select-none cursor-pointer" onClick={handleClick}>
      {widget}
      <button
        onClick={(e) => { e.stopPropagation(); onDetailClick(config); }}
        className="absolute bottom-2 right-3 z-10 opacity-0 group-hover/detail:opacity-100 text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-all flex items-center gap-0.5 cursor-pointer"
      >
        ▸ view data
      </button>
    </div>
  );
}
