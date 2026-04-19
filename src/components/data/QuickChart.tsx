'use client';

import { useState, useMemo, useRef } from 'react';
import { BarChart3, LineChart, ScatterChart, PieChart, TrendingUp, Settings, Download, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { QuickChartConfig, WidgetPromotionRequest } from '@/types/playground';

interface QuickChartProps {
  data: Record<string, unknown>[];
  columns: string[];
  config?: QuickChartConfig;
  onConfigChange: (config: QuickChartConfig) => void;
  onPromoteToWidget?: (request: WidgetPromotionRequest) => void;
}

interface ChartHeaderProps {
  config: QuickChartConfig;
  onConfigChange: (config: QuickChartConfig) => void;
  onToggleSettings: () => void;
  showSettings: boolean;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}

function ChartHeader({ config, onConfigChange, onToggleSettings, showSettings, onFullscreen, isFullscreen }: ChartHeaderProps) {
  const chartTypes = [
    { type: 'bar' as const, icon: BarChart3, label: 'Bar Chart' },
    { type: 'line' as const, icon: LineChart, label: 'Line Chart' },
    { type: 'area' as const, icon: TrendingUp, label: 'Area Chart' },
    { type: 'scatter' as const, icon: ScatterChart, label: 'Scatter Plot' },
    { type: 'pie' as const, icon: PieChart, label: 'Pie Chart' }
  ];

  return (
    <div className="flex items-center justify-between bg-[var(--bg-card)] px-3 py-2 border-b border-[var(--border-color)]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Quick Chart</span>
        {config.title && (
          <>
            <span className="text-xs text-[var(--text-muted)]">•</span>
            <span className="text-xs text-[var(--text-primary)]">{config.title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Chart Type Selector */}
        <div className="flex items-center gap-0.5 border border-[var(--border-color)] rounded overflow-hidden">
          {chartTypes.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => onConfigChange({ ...config, type })}
              className={`p-1.5 text-xs transition-colors ${
                config.type === type
                  ? 'bg-accent-blue text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title={label}
            >
              <Icon className="w-3 h-3" />
            </button>
          ))}
        </div>

        <button
          onClick={onToggleSettings}
          className={`p-1.5 rounded text-xs transition-colors ${
            showSettings
              ? 'bg-accent-purple text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
          }`}
          title="Chart Settings"
        >
          <Settings className="w-3 h-3" />
        </button>

        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface ChartSettingsProps {
  config: QuickChartConfig;
  columns: string[];
  onConfigChange: (config: QuickChartConfig) => void;
}

function ChartSettings({ config, columns, onConfigChange }: ChartSettingsProps) {
  const numericColumns = columns.filter(col => col.toLowerCase().includes('count') || col.toLowerCase().includes('total') || col.toLowerCase().includes('amount') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('mrr') || col.toLowerCase().includes('rate'));
  const categoricalColumns = columns.filter(col => !numericColumns.includes(col));

  return (
    <div className="border-b border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Chart Title */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Chart Title</label>
          <input
            type="text"
            value={config.title || ''}
            onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            placeholder="Enter chart title..."
          />
        </div>

        {/* X-Axis */}
        {config.type !== 'pie' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">X-Axis</label>
            <select
              value={config.xAxis || ''}
              onChange={(e) => onConfigChange({ ...config, xAxis: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="">Select column...</option>
              {categoricalColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        )}

        {/* Y-Axis */}
        {config.type !== 'pie' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Y-Axis</label>
            <select
              value={config.yAxis || ''}
              onChange={(e) => onConfigChange({ ...config, yAxis: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="">Select column...</option>
              {numericColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        )}

        {/* Value/Size for Pie Chart */}
        {config.type === 'pie' && (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={config.xAxis || ''}
                onChange={(e) => onConfigChange({ ...config, xAxis: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
              >
                <option value="">Select category...</option>
                {categoricalColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Value</label>
              <select
                value={config.yAxis || ''}
                onChange={(e) => onConfigChange({ ...config, yAxis: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
              >
                <option value="">Select value...</option>
                {numericColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Color By (optional) */}
        {config.type === 'scatter' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Color By</label>
            <select
              value={config.colorBy || ''}
              onChange={(e) => onConfigChange({ ...config, colorBy: e.target.value || undefined })}
              className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="">None</option>
              {categoricalColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart Dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Width</label>
          <input
            type="number"
            value={config.width || 400}
            onChange={(e) => onConfigChange({ ...config, width: parseInt(e.target.value) })}
            className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            min="200"
            max="1200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Height</label>
          <input
            type="number"
            value={config.height || 300}
            onChange={(e) => onConfigChange({ ...config, height: parseInt(e.target.value) })}
            className="w-full px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            min="150"
            max="800"
          />
        </div>
      </div>
    </div>
  );
}

function SimpleChart({ data, config }: { data: Record<string, unknown>[]; config: QuickChartConfig }) {
  const chartData = useMemo(() => {
    if (!config.xAxis || !config.yAxis || data.length === 0) {
      return [];
    }

    if (config.type === 'pie') {
      // For pie chart, group by category and sum values
      const grouped = data.reduce((acc, row) => {
        const category = String(row[config.xAxis!] || 'Unknown');
        const value = Number(row[config.yAxis!]) || 0;
        const currentValue = (acc[category] as number) || 0;
        acc[category] = currentValue + value;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([category, value]) => ({
        category,
        value,
        percentage: 0 // Will be calculated below
      }));
    }

    return data.map(row => ({
      x: row[config.xAxis!],
      y: Number(row[config.yAxis!]) || 0,
      color: config.colorBy ? String(row[config.colorBy]) : undefined
    }));
  }, [data, config]);

  const width = config.width || 400;
  const height = config.height || 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  if (chartData.length === 0 || !config.xAxis || !config.yAxis) {
    return (
      <div
        className="flex items-center justify-center bg-[var(--bg-hover)] border border-[var(--border-color)] rounded"
        style={{ width, height }}
      >
        <div className="text-center">
          <BarChart3 className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-muted)]">
            {!config.xAxis || !config.yAxis
              ? 'Select columns to create chart'
              : 'No data available for chart'}
          </p>
        </div>
      </div>
    );
  }

  if (config.type === 'pie') {
    // Simple pie chart with SVG
    const pieData = chartData as Array<{ category: string; value: number }>;
    const total = pieData.reduce((sum, d) => sum + d.value, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 20;

    let currentAngle = 0;
    const slices = pieData.map((d, i) => {
      const percentage = (d.value / total) * 100;
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;
      const pathData = [
        'M', centerX, centerY,
        'L', x1, y1,
        'A', radius, radius, 0, largeArc, 1, x2, y2,
        'Z'
      ].join(' ');

      currentAngle += angle;

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      return {
        ...d,
        pathData,
        color: colors[i % colors.length],
        percentage
      };
    });

    return (
      <div style={{ width, height }}>
        <svg width={width} height={height}>
          {slices.map((slice, i) => (
            <g key={i}>
              <path
                d={slice.pathData}
                fill={slice.color}
                stroke="#fff"
                strokeWidth="2"
                className="hover:opacity-80 cursor-pointer"
              >
                <title>{`${slice.category}: ${slice.value} (${slice.percentage.toFixed(1)}%)`}</title>
              </path>
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-[var(--text-primary)]">
                {slice.category} ({slice.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For other chart types, create a simple bar/line chart
  const chartPoints = chartData as Array<{ x: unknown; y: number; color?: string }>;
  const maxY = Math.max(...chartPoints.map(d => d.y));
  const minY = Math.min(...chartPoints.map(d => d.y));
  const yRange = maxY - minY || 1;

  return (
    <div style={{ width, height }}>
      <svg width={width} height={height}>
        {/* Chart Area Background */}
        <rect
          x={margin.left}
          y={margin.top}
          width={chartWidth}
          height={chartHeight}
          fill="var(--bg-hover)"
          stroke="var(--border-color)"
        />

        {/* Y-Axis Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = margin.top + chartHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={margin.left}
              y1={y}
              x2={margin.left + chartWidth}
              y2={y}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              opacity="0.5"
            />
          );
        })}

        {/* Chart Data */}
        {config.type === 'bar' && (
          <>
            {chartPoints.map((point, i) => {
              const barWidth = chartWidth / chartPoints.length * 0.8;
              const x = margin.left + (chartWidth / chartPoints.length) * i + barWidth * 0.1;
              const barHeight = ((point.y - minY) / yRange) * chartHeight;
              const y = margin.top + chartHeight - barHeight;

              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#3b82f6"
                  className="hover:fill-blue-400"
                >
                  <title>{`${point.x}: ${point.y}`}</title>
                </rect>
              );
            })}
          </>
        )}

        {(config.type === 'line' || config.type === 'area') && (
          <>
            {/* Create path for line/area */}
            {(() => {
              const points = chartPoints.map((point, i) => {
                const x = margin.left + (chartWidth / (chartPoints.length - 1)) * i;
                const y = margin.top + chartHeight - ((point.y - minY) / yRange) * chartHeight;
                return { x, y };
              });

              const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <g>
                  {config.type === 'area' && (
                    <path
                      d={`${pathData} L ${points[points.length - 1].x} ${margin.top + chartHeight} L ${margin.left} ${margin.top + chartHeight} Z`}
                      fill="#3b82f6"
                      opacity="0.3"
                    />
                  )}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                  {points.map((point, i) => (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill="#3b82f6"
                      className="hover:r-4"
                    >
                      <title>{`${chartPoints[i].x}: ${chartPoints[i].y}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })()}
          </>
        )}

        {config.type === 'scatter' && (
          <>
            {chartPoints.map((point, i) => {
              const x = margin.left + (chartWidth / chartPoints.length) * i;
              const y = margin.top + chartHeight - ((point.y - minY) / yRange) * chartHeight;

              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={point.color ? '#10b981' : '#3b82f6'}
                  className="hover:r-5 hover:opacity-80"
                >
                  <title>{`${point.x}: ${point.y}`}</title>
                </circle>
              );
            })}
          </>
        )}

        {/* Y-Axis Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const value = minY + yRange * ratio;
          const y = margin.top + chartHeight * (1 - ratio);
          return (
            <text
              key={ratio}
              x={margin.left - 10}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--text-muted)"
            >
              {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          );
        })}

        {/* X-Axis Label */}
        <text
          x={margin.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-muted)"
        >
          {config.xAxis}
        </text>

        {/* Y-Axis Label */}
        <text
          x={15}
          y={margin.top + chartHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="var(--text-muted)"
          transform={`rotate(-90 15 ${margin.top + chartHeight / 2})`}
        >
          {config.yAxis}
        </text>
      </svg>
    </div>
  );
}

export function QuickChart({ data, columns, config, onConfigChange, onPromoteToWidget }: QuickChartProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const chartConfig = config || {
    type: 'bar',
    width: 400,
    height: 300
  };

  const exportChart = () => {
    if (!chartRef.current) return;

    // Create a simple export of the chart configuration and data
    const exportData = {
      config: chartConfig,
      data: data.slice(0, 100), // Limit data for export
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chart-data-${new Date().toISOString().slice(0, 16).replace(/[:-]/g, '')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const promoteToWidget = () => {
    if (onPromoteToWidget) {
      const request: WidgetPromotionRequest = {
        cellId: 'temp-chart-cell',
        sessionId: 'temp-session',
        widgetType: chartConfig.type === 'bar' ? 'bar_chart' :
                   chartConfig.type === 'line' ? 'line_chart' :
                   chartConfig.type === 'area' ? 'area_chart' :
                   chartConfig.type === 'pie' ? 'pie_chart' : 'bar_chart',
        title: chartConfig.title || `${chartConfig.type} Chart`,
        chartConfig
      };
      onPromoteToWidget(request);
    }
  };

  return (
    <div className={`border border-[var(--border-color)] rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50 bg-[var(--bg-primary)]' : ''}`}>
      <ChartHeader
        config={chartConfig}
        onConfigChange={onConfigChange}
        onToggleSettings={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
        onFullscreen={() => setIsFullscreen(!isFullscreen)}
        isFullscreen={isFullscreen}
      />

      {showSettings && (
        <ChartSettings
          config={chartConfig}
          columns={columns}
          onConfigChange={onConfigChange}
        />
      )}

      {/* Chart Content */}
      <div className="flex-1 p-4 bg-[var(--bg-primary)]">
        <div ref={chartRef} className="flex justify-center">
          <SimpleChart data={data} config={chartConfig} />
        </div>

        {/* Chart Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)]">
            {data.length} data points • {columns.length} columns
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportChart}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors"
              title="Export Chart Data"
            >
              <Download className="w-3 h-3" />
              Export
            </button>

            {onPromoteToWidget && (
              <button
                onClick={promoteToWidget}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-accent-purple hover:bg-accent-purple/90 rounded transition-colors"
                title="Add to Dashboard"
              >
                <ExternalLink className="w-3 h-3" />
                Promote to Widget
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}