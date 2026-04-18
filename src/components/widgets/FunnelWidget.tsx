'use client';

import type { WidgetConfig } from '@/types';
import { getColorPalette } from './widget-utils';

interface FunnelWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function FunnelWidget({ config, data }: FunnelWidgetProps) {
  const COLORS = getColorPalette(config.visualConfig.colorScheme);
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const nameKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'string') || Object.keys(data[0])[0];
  const valueKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'number') || Object.keys(data[0])[1];

  const maxValue = Math.max(...data.map(d => Number(d[valueKey]) || 0));

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-h-0">
        {data.map((item, i) => {
          const value = Number(item[valueKey]) || 0;
          const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const convRate = i > 0 ? ((value / (Number(data[i - 1][valueKey]) || 1)) * 100).toFixed(0) : '100';
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1" style={{ paddingLeft: `${(i / data.length) * 15}%`, paddingRight: `${(i / data.length) * 15}%` }}>
                <div
                  className="h-8 rounded-lg flex items-center justify-between px-3 transition-all"
                  style={{
                    width: `${Math.max(width, 20)}%`,
                    margin: '0 auto',
                    background: `${COLORS[i % COLORS.length]}22`,
                    border: `1px solid ${COLORS[i % COLORS.length]}44`,
                  }}
                >
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {String(item[nameKey])}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] ml-2 shrink-0">
                    {value.toLocaleString()}
                  </span>
                </div>
              </div>
              {i > 0 && (
                <span className="text-[9px] text-[var(--text-muted)] w-8 text-right shrink-0">
                  {convRate}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
