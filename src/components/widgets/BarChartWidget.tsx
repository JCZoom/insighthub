'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';

interface BarChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#39d2c0', '#f85149'];

export function BarChartWidget({ config, data }: BarChartWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    typeof sampleRow[k] === 'string'
  ) || Object.keys(sampleRow)[0];
  const barKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            />
            {config.visualConfig.showLegend !== false && barKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            )}
            {barKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[4, 4, 0, 0]}
                animationDuration={800}
                stackId={config.visualConfig.stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
