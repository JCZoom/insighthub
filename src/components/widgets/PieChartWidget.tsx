'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';

interface PieChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#39d2c0', '#f85149'];

export function PieChartWidget({ config, data }: PieChartWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const sampleRow = data[0];
  const nameKey = Object.keys(sampleRow).find(k => typeof sampleRow[k] === 'string') || Object.keys(sampleRow)[0];
  const valueKey = Object.keys(sampleRow).find(k => typeof sampleRow[k] === 'number') || Object.keys(sampleRow)[1];
  const isDonut = config.type === 'donut_chart';

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={isDonut ? '50%' : 0}
              outerRadius="80%"
              dataKey={valueKey}
              nameKey={nameKey}
              paddingAngle={2}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {config.visualConfig.showLegend !== false && (
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
