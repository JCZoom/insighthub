'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useRef } from 'react';
import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

interface KpiCardProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

const ACCENT_CLASSES: Record<string, string> = {
  blue: 'hero-accent-blue',
  green: 'hero-accent-green',
  purple: 'hero-accent-purple',
  amber: 'hero-accent-amber',
  cyan: 'hero-accent-cyan',
  red: 'hero-accent-red',
};

/**
 * Resolve a field name against the available keys in a data row.
 * Handles exact match, normalised match (ignore _, -, spaces, case),
 * and substring containment so AI-generated names like
 * "overall_churn_rate" still resolve to "churn_rate".
 */
function resolveField(row: Record<string, unknown>, target: string): string {
  if (target in row) return target;
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');
  const nt = norm(target);
  const keys = Object.keys(row);
  // normalised exact match
  const exact = keys.find(k => norm(k) === nt);
  if (exact) return exact;
  // target contains a key (e.g. "overall_churn_rate" contains "churn_rate")
  const contains = keys.find(k => nt.includes(norm(k)) && norm(k).length > 2);
  if (contains) return contains;
  // key contains target
  const reverse = keys.find(k => norm(k).includes(nt) && nt.length > 2);
  if (reverse) return reverse;
  return target; // fallback — will yield 0 as before
}

function computeAggregation(
  data: Record<string, unknown>[],
  field: string,
  fn: string,
): number {
  const resolved = data.length > 0 ? resolveField(data[0], field) : field;
  const values = data.map(r => Number(r[resolved]) || 0);
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'count_distinct': return new Set(values).size;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    default: return values[0];
  }
}

export function KpiCard({ config, data }: KpiCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const responsive = useResponsiveWidget(containerRef);

  const row = data[0] || {};
  const agg = config.dataConfig.aggregation;
  const rawField = agg?.field || Object.keys(row)[0] || 'value';
  const field = resolveField(row, rawField);
  const aggFn = agg?.function || 'sum';

  // If we have multiple rows and an aggregation function, compute it
  const value = data.length > 1
    ? computeAggregation(data, field, aggFn)
    : (typeof row[field] === 'number' ? row[field] as number : Number(row[field]) || 0);

  const accent = config.visualConfig.colorScheme || 'blue';
  const accentClass = ACCENT_CLASSES[accent] || ACCENT_CLASSES.blue;

  // Detect if it's a percentage, currency, or plain number
  const isPercent = field.includes('rate') || field.includes('percent') || field.includes('nrr') || field.includes('grr') || field.includes('retention') || field.includes('csat') || field.includes('win_rate') || field.includes('adoption');
  const isCurrency = field.includes('mrr') || field.includes('arr') || field.includes('revenue') || field.includes('amount') || field.includes('pipeline') || field.includes('deal_size');

  const formatted = isPercent
    ? formatPercent(value)
    : isCurrency
    ? formatCurrency(value, { compact: true })
    : formatNumber(value, { compact: true });

  // Deterministic fake trend based on widget id + field name.
  // Uses a simple string hash so the value is stable across renders and SSR/client.
  // This will be replaced with real period-over-period calculation when Snowflake is connected.
  const trendSeed = `${config.id}-${field}`.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const trendValue = +((((trendSeed % 100) / 100) * 10 - 2)).toFixed(1);
  const TrendIcon = trendValue > 0 ? TrendingUp : trendValue < 0 ? TrendingDown : Minus;
  const trendColor = trendValue > 0 ? 'pill-green' : trendValue < 0 ? 'pill-red' : 'pill-blue';

  // Responsive layout classes and sizes
  const isMobile = responsive.size === 'mobile';
  const isTablet = responsive.size === 'tablet';

  const titleClass = isMobile
    ? "text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1 truncate"
    : "text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1";

  const valueClass = isMobile
    ? "text-xl font-extrabold tracking-tight leading-none mb-1"
    : isTablet
    ? "text-2xl font-extrabold tracking-tight leading-none mb-1"
    : "text-3xl font-extrabold tracking-tight leading-none mb-2";

  const pillClass = isMobile
    ? `pill ${trendColor} text-[9px] px-1.5 py-0.5`
    : `pill ${trendColor}`;

  const iconSize = isMobile ? 10 : 12;
  const padding = isMobile ? "p-3" : isTablet ? "p-4" : "p-5";

  return (
    <div ref={containerRef} className={`hero-card ${accentClass} ${padding} h-full flex flex-col justify-between fade-in`}>
      <div>
        <p className={titleClass}>
          {config.title}
        </p>
        {config.subtitle && !isMobile && (
          <p className="text-[10px] text-[var(--text-muted)] mb-2">{config.subtitle}</p>
        )}
      </div>
      <div>
        <p className={valueClass} style={{ letterSpacing: '-0.02em' }}>
          {formatted}
        </p>
        <span className={pillClass}>
          <TrendIcon size={iconSize} className="mr-1" />
          {isMobile ?
            `${trendValue > 0 ? '+' : ''}${trendValue}%` :
            `${trendValue > 0 ? '+' : ''}${trendValue}% vs prev`
          }
        </span>
      </div>
    </div>
  );
}
