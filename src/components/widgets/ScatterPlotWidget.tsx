'use client';

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts';
import type { WidgetConfig } from '@/types';

interface ScatterPlotWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function ScatterPlotWidget({ config, data }: ScatterPlotWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const numericKeys = Object.keys(data[0]).filter(k => typeof data[0][k] === 'number');
  const xKey = numericKeys[0] || Object.keys(data[0])[0];
  const yKey = numericKeys[1] || numericKeys[0] || Object.keys(data[0])[1];
  const zKey = numericKeys[2]; // optional size dimension

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
            <XAxis
              dataKey={xKey}
              type="number"
              name={xKey}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              dataKey={yKey}
              type="number"
              name={yKey}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            {zKey && <ZAxis dataKey={zKey} range={[40, 400]} name={zKey} />}
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            />
            <Scatter
              data={data}
              fill="#58a6ff"
              fillOpacity={0.7}
              animationDuration={800}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
