'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';

interface LineChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const COLOR_PALETTES: Record<string, string[]> = {
  default: ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#39d2c0', '#f85149'],
  warm: ['#f85149', '#d29922', '#e3b341', '#f0883e', '#db6d28', '#bc4c00'],
  cool: ['#58a6ff', '#388bfd', '#bc8cff', '#8b5cf6', '#39d2c0', '#2dd4bf'],
  vibrant: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#1abc9c'],
};

export function LineChartWidget({ config, data }: LineChartWidgetProps) {
  const palette = COLOR_PALETTES[config.visualConfig.colorScheme || 'default'] || COLOR_PALETTES.default;

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  // Determine which keys are numeric (to plot as lines)
  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    k.includes('month') || k.includes('date') || k.includes('period') || k.includes('day')
  ) || Object.keys(sampleRow)[0];
  const lineKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12px',
                backdropFilter: 'blur(12px)',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
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
                animationDuration={800}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
