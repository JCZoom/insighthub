'use client';

import type { WidgetConfig } from '@/types';
import { getPrimaryColor } from './widget-utils';

interface GaugeWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

export function GaugeWidget({ config, data }: GaugeWidgetProps) {
  const row = data[0] || {};
  const field = config.dataConfig.aggregation?.field || Object.keys(row).find(k => typeof row[k] === 'number') || 'value';
  const value = typeof row[field] === 'number' ? row[field] as number : Number(row[field]) || 0;
  const max = 100;
  const percent = Math.min(value / max, 1);
  const angle = percent * 180;

  // Use explicit colorScheme if set, otherwise fall back to threshold colors
  const thresholdColor = percent > 0.75 ? '#56c47a' : percent > 0.5 ? '#dba644' : '#f47670';
  const color = config.visualConfig.colorScheme ? getPrimaryColor(config.visualConfig.colorScheme) : thresholdColor;

  return (
    <div className="card p-4 h-full flex flex-col items-center justify-center fade-in">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{config.title}</h3>
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.37} 141.37`}
            className="transition-all duration-1000"
          />
        </svg>
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value.toFixed(1)}%</p>
      {config.subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{config.subtitle}</p>}
    </div>
  );
}
