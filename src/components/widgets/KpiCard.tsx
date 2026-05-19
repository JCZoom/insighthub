'use client';

import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useRef } from 'react';
import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';
import { Tooltip } from '@/components/ui/Tooltip';

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

  // ── Period-over-period: truth-by-default ───────────────────────────────
  // Prior versions of this widget rendered a *deterministic fake* "% vs prev"
  // delta computed from a hash of (config.id + field). That number was always
  // shown but had no relationship to real data — a $30,540 pipeline KPI would
  // display "-1.9% vs prev" even though no previous-period value was ever
  // computed. That is a data-integrity violation: stakeholders read the pill
  // as a real signal.
  //
  // New rule: the trend pill renders ONLY when the data row carries an
  // explicit `previous_value` (number) AND we have a non-zero current value.
  // The data provider is responsible for computing prev-period values
  // honestly — see freshworks-data-provider.ts for the per-source logic.
  // When a source cannot compute PoP honestly (no snapshot history, no API
  // date filter, etc.) it returns previous_value: null and optionally a
  // `comparison_unavailable_reason` string. The renderer surfaces that
  // reason via a small "info" indicator instead of silently hiding the
  // absence — transparency over fabrication.
  const prevRaw = row['previous_value'];
  const comparisonLabel = typeof row['comparison_label'] === 'string'
    ? (row['comparison_label'] as string)
    : null;
  const comparisonUnavailableReason = typeof row['comparison_unavailable_reason'] === 'string'
    ? (row['comparison_unavailable_reason'] as string)
    : null;
  const previousValue: number | null = typeof prevRaw === 'number' && Number.isFinite(prevRaw)
    ? prevRaw
    : null;
  const hasComparison = previousValue !== null && previousValue !== 0 && Number.isFinite(value);
  const trendValue = hasComparison
    ? +(((value - (previousValue as number)) / (previousValue as number)) * 100).toFixed(1)
    : 0;
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
        {hasComparison ? (
          <Tooltip
            content={comparisonLabel ?? 'Period-over-period comparison'}
            side="top"
          >
            <span className={pillClass}>
              <TrendIcon size={iconSize} className="mr-1" />
              {isMobile
                ? `${trendValue > 0 ? '+' : ''}${trendValue}%`
                : `${trendValue > 0 ? '+' : ''}${trendValue}% ${comparisonLabel ?? 'vs prev'}`}
            </span>
          </Tooltip>
        ) : comparisonUnavailableReason ? (
          <Tooltip
            content={`No comparison available — ${comparisonUnavailableReason}`}
            side="top"
          >
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1">
              <Info size={iconSize} className="opacity-60" />
              <span>{isMobile ? 'no comparison' : 'no comparison available'}</span>
            </span>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
