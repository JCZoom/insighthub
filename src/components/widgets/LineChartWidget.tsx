'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';
import { getColorPalette, getAnimationDuration, TOOLTIP_STYLE } from './widget-utils';

interface LineChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function LineChartWidget({ config, data }: LineChartWidgetProps) {
  const palette = getColorPalette(config.visualConfig.colorScheme);
  const animDuration = getAnimationDuration(config);
  const showGrid = config.visualConfig.showGrid !== false;
  const showLabels = config.visualConfig.showLabels !== false;

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  // Determine which keys are numeric (to plot as lines)
  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    k.includes('month') || k.includes('date') || k.includes('period') || k.includes('day')
  ) || Object.keys(sampleRow)[0];
  const lineKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  if (lineKeys.length === 0 || !xKey) {
    return (
      <div className="card p-4 h-full flex flex-col items-center justify-center text-center gap-1">
        <p className="text-xs font-medium text-[var(--text-primary)]">{config.title}</p>
        <p className="text-[10px] text-[var(--text-muted)]">No numeric data found to chart</p>
      </div>
    );
  }

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />}
            <XAxis
              dataKey={xKey}
              tick={showLabels ? { fontSize: 11, fill: 'var(--text-secondary)' } : false}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              tick={showLabels ? { fontSize: 11, fill: 'var(--text-secondary)' } : false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              {...TOOLTIP_STYLE}
            />
            {config.visualConfig.showLegend !== false && lineKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            )}
            {lineKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: palette[i % palette.length] }}
                activeDot={{ r: 5 }}
                animationDuration={animDuration}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
