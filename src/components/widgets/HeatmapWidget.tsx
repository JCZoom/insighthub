'use client';

import type { WidgetConfig } from '@/types';
import { getPrimaryColor } from './widget-utils';

interface HeatmapWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

// Convert hex to rgb tuple
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Map a value 0–1 to a color gradient based on the primary accent color
function heatColor(ratio: number, primary: string): string {
  const [r, g, b] = hexToRgb(primary);
  const alpha = 0.15 + ratio * 0.75;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

export function HeatmapWidget({ config, data }: HeatmapWidgetProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No data
      </div>
    );
  }

  const sampleRow = data[0];
  const keys = Object.keys(sampleRow);
  const labelKey = keys.find(k => typeof sampleRow[k] === 'string') || keys[0];
  const numericKeys = keys.filter(k => k !== labelKey && typeof sampleRow[k] === 'number');

  if (numericKeys.length === 0) {
    return (
      <div className="card p-4 h-full flex flex-col items-center justify-center text-center gap-1">
        <p className="text-xs font-medium text-[var(--text-primary)]">{config.title}</p>
        <p className="text-[10px] text-[var(--text-muted)]">No numeric data found for heatmap</p>
      </div>
    );
  }

  // Compute global min/max for color normalization
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const row of data) {
    for (const k of numericKeys) {
      const v = Number(row[k]) || 0;
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    }
  }
  const range = globalMax - globalMin || 1;

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[var(--text-muted)] font-medium p-1.5 sticky top-0 bg-[var(--bg-card)]" />
              {numericKeys.map((k) => (
                <th
                  key={k}
                  className="text-center text-[var(--text-muted)] font-medium p-1.5 sticky top-0 bg-[var(--bg-card)] truncate max-w-[80px]"
                  title={k.replace(/_/g, ' ')}
                >
                  {k.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="text-[var(--text-secondary)] font-medium p-1.5 whitespace-nowrap">
                  {String(row[labelKey] ?? '')}
                </td>
                {numericKeys.map((k) => {
                  const val = Number(row[k]) || 0;
                  const ratio = (val - globalMin) / range;
                  return (
                    <td
                      key={k}
                      className="text-center p-1.5 rounded-sm"
                      style={{ backgroundColor: heatColor(ratio, getPrimaryColor(config.visualConfig.colorScheme)) }}
                      title={`${k}: ${val.toLocaleString()}`}
                    >
                      <span className="text-white font-medium text-[10px] drop-shadow-sm">
                        {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString()}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
