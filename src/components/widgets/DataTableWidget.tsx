'use client';

import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';

interface DataTableWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

function formatCell(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value !== 'number') return String(value);
  const isPercent = key.includes('rate') || key.includes('percent') || key.includes('csat') || key.includes('adoption') || key.includes('win_rate');
  const isCurrency = key.includes('mrr') || key.includes('arr') || key.includes('revenue') || key.includes('amount') || key.includes('value');
  if (isPercent) return formatPercent(value);
  if (isCurrency) return formatCurrency(value, { compact: true });
  return formatNumber(value, { decimals: 0 });
}

export function DataTableWidget({ config, data }: DataTableWidgetProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.title}</h3>
        {config.subtitle && <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>}
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              {columns.map(col => (
                <th key={col} className="text-left py-2 px-2 font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-card-hover)] transition-colors">
                {columns.map(col => (
                  <td key={col} className="py-2 px-2 text-[var(--text-primary)]">
                    {formatCell(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
