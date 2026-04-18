'use client';

import { useRef, useEffect, useState } from 'react';
import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const responsive = useResponsiveWidget(containerRef);

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
  }

  const columns = Object.keys(data[0]);
  const isMobile = responsive.size === 'mobile';
  const isTablet = responsive.size === 'tablet';

  // Check if horizontal scrolling is needed
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const checkScrollIndicator = () => {
      const canScroll = scrollContainer.scrollWidth > scrollContainer.clientWidth;
      const isAtEnd = scrollContainer.scrollLeft >= scrollContainer.scrollWidth - scrollContainer.clientWidth - 1;
      setShowScrollIndicator(canScroll && !isAtEnd);
    };

    const handleScroll = () => {
      checkScrollIndicator();
    };

    checkScrollIndicator();
    scrollContainer.addEventListener('scroll', handleScroll);

    // Also check on resize
    const resizeObserver = new ResizeObserver(checkScrollIndicator);
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [data]);

  const textSize = isMobile ? "text-[10px]" : "text-xs";
  const headerTextSize = isMobile ? "text-[9px]" : "text-[10px]";
  const padding = isMobile ? "py-1 px-1" : "py-2 px-2";
  const headerPadding = isMobile ? "py-1 px-1" : "py-2 px-2";

  return (
    <div ref={containerRef} className="card p-4 h-full flex flex-col fade-in">
      <div className="mb-3">
        <h3 className={`${isMobile ? "text-xs" : "text-sm"} font-semibold text-[var(--text-primary)]`}>
          {config.title}
        </h3>
        {config.subtitle && !isMobile && (
          <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>
        )}
      </div>
      <div className="flex-1 min-h-0 relative">
        <div
          ref={scrollRef}
          className={`h-full overflow-auto ${isMobile ? 'overflow-x-scroll' : ''}`}
          style={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table className={`w-full ${textSize} ${isMobile ? 'min-w-max' : ''}`}>
            <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
              <tr className="border-b border-[var(--border-color)]">
                {columns.map((col, index) => (
                  <th
                    key={col}
                    className={`text-left ${headerPadding} font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${headerTextSize} ${
                      isMobile && index === 0 ? 'sticky left-0 bg-[var(--bg-card)] z-20 min-w-[100px]' : ''
                    } ${isMobile ? 'whitespace-nowrap' : ''}`}
                  >
                    {isMobile ? col.replace(/_/g, ' ').slice(0, 8) + (col.length > 8 ? '…' : '') : col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-card-hover)] transition-colors">
                  {columns.map((col, index) => (
                    <td
                      key={col}
                      className={`${padding} text-[var(--text-primary)] ${
                        isMobile && index === 0 ? 'sticky left-0 bg-[var(--bg-card)] z-10 min-w-[100px]' : ''
                      } ${isMobile ? 'whitespace-nowrap' : ''}`}
                    >
                      {formatCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Scroll indicator shadow */}
        {showScrollIndicator && (
          <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[var(--bg-card)] to-transparent pointer-events-none z-10" />
        )}

        {/* Touch scroll hint for mobile */}
        {isMobile && showScrollIndicator && (
          <div className="absolute bottom-2 right-2 text-[8px] text-[var(--text-muted)] bg-[var(--bg-card)] px-1 py-0.5 rounded">
            ← scroll
          </div>
        )}
      </div>
    </div>
  );
}
