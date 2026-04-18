'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { WidgetConfig } from '@/types';

interface AreaChartWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const COLORS = ['#6baaff', '#56c47a', '#b48eff', '#dba644', '#4dcec2', '#f47670'];

export function AreaChartWidget({ config, data }: AreaChartWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const sampleRow = data[0];
  const xKey = Object.keys(sampleRow).find(k =>
    k.includes('month') || k.includes('date') || k.includes('period')
  ) || Object.keys(sampleRow)[0];
  const areaKeys = Object.keys(sampleRow).filter(k => k !== xKey && typeof sampleRow[k] === 'number');

  if (areaKeys.length === 0) {
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
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              {areaKeys.map((key, i) => (
                <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--text-secondary)' }}
            />
            {config.visualConfig.showLegend !== false && areaKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            )}
            {areaKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={`url(#gradient-${key})`}
                strokeWidth={2}
                animationDuration={800}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
