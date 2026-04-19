'use client';

import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';

interface MetricRowWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const ACCENTS = ['accent-blue', 'accent-green', 'accent-purple', 'accent-amber', 'accent-cyan', 'accent-red'];

export function MetricRowWidget({ config, data }: MetricRowWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  // metric_row uses a single-row dataset where each key is a metric
  const row = data[0];
  const metrics = Object.entries(row).filter(([, v]) => typeof v === 'number');

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      {config.title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
          {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
        </div>
      )}
      <div className="flex-1 grid gap-3 min-h-0" style={{
        gridTemplateColumns: `repeat(${Math.min(metrics.length, 6)}, 1fr)`,
      }}>
        {metrics.map(([key, value], i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const numValue = Number(value);
          const isPct = key.includes('rate') || key.includes('percent') || key.includes('nrr') || key.includes('grr') || key.includes('retention') || key.includes('csat') || key.includes('win_rate') || key.includes('adoption');
          const isCur = key.includes('mrr') || key.includes('arr') || key.includes('revenue') || key.includes('amount') || key.includes('pipeline') || key.includes('deal_size');
          const formatted = isPct
            ? formatPercent(numValue)
            : isCur
            ? formatCurrency(numValue, { compact: true })
            : formatNumber(numValue, { compact: true });

          return (
            <div
              key={key}
              className={`hero-card hero-${accent} p-3 flex flex-col justify-center`}
            >
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider truncate">
                {formattedLabel}
              </p>
              <p className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
                {formatted}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
