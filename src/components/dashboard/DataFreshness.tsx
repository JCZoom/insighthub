'use client';

import { Clock } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useWidgetData } from '@/hooks/useWidgetData';
import { getFreshnessColor, formatTimeAgo } from './WidgetQueryPanel';

/**
 * DataFreshness — truth-by-default freshness indicator for a widget.
 *
 * Prior implementation hashed the widget id into a fake "minutes ago"
 * value (`getLastRefreshed(widgetId)`), so EVERY widget on EVERY dashboard
 * showed a fabricated "Data as of <precise timestamp>" tooltip with
 * green/amber/red color coding that had nothing to do with reality. That
 * was the same data-integrity violation as the old KpiCard fake-trend
 * pill — a stable lie that stakeholders could not distinguish from real
 * signal. Removed (2026-05-19, with the PoP rebuild).
 *
 * New rule: render the indicator only when we have a real `fetchedAt`
 * timestamp from the data fetch (server response time for Freshworks /
 * Snowflake, local fetch time for sample-data). The hook
 * `useWidgetData(source)` is the single source of truth — it returns
 * `fetchedAt: Date | null` and `fromCache: boolean | null` alongside
 * the row data. When `fetchedAt` is null (initial loading, error,
 * unknown source) we render nothing rather than fabricate a value.
 *
 * Calling `useWidgetData` here is cheap: the hook is internally cached
 * (30s client, 60s server), so the WidgetRenderer's call and this
 * component's call deduplicate to a single network fetch per dashboard.
 */
interface DataFreshnessProps {
  /** The widget's data source — same value passed to WidgetRenderer. */
  source: string;
  /** Optional groupBy fields, mirrors useWidgetData's signature. */
  groupBy?: string[];
  className?: string;
}

export function DataFreshness({ source, groupBy, className = '' }: DataFreshnessProps) {
  const { fetchedAt, fromCache, loading } = useWidgetData(source, groupBy);

  // Truth-by-default: no honest timestamp ⇒ render nothing.
  if (!fetchedAt || loading) return null;

  const color = getFreshnessColor(fetchedAt);
  const timeAgo = formatTimeAgo(fetchedAt);
  const cacheNote =
    fromCache === true
      ? ' (served from server-side cache)'
      : fromCache === false
        ? ''
        : '';
  const tooltipContent = `Data fetched at ${fetchedAt.toLocaleString()}${cacheNote}`;

  return (
    <Tooltip content={tooltipContent}>
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${className}`}
      >
        <Clock size={8} className={color} />
        <span className={`font-medium ${color}`}>{timeAgo}</span>
      </div>
    </Tooltip>
  );
}
