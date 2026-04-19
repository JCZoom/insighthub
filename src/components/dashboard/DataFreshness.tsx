'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { getLastRefreshed, getFreshnessColor, formatTimeAgo } from './WidgetQueryPanel';

interface DataFreshnessProps {
  widgetId: string;
  className?: string;
}

export function DataFreshness({ widgetId, className = '' }: DataFreshnessProps) {
  const lastRefreshed = useMemo(() => getLastRefreshed(widgetId), [widgetId]);
  const color = getFreshnessColor(lastRefreshed);
  const timeAgo = formatTimeAgo(lastRefreshed);

  return (
    <Tooltip content={`Data as of ${lastRefreshed.toLocaleString()}`}>
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${className}`}
      >
        <Clock size={8} className={color} />
        <span className={`font-medium ${color}`}>{timeAgo}</span>
      </div>
    </Tooltip>
  );
}
