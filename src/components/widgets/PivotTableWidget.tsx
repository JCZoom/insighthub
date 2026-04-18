'use client';

import { useRef, useEffect, useState } from 'react';
import type { WidgetConfig } from '@/types';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import { useResponsiveWidget } from '@/hooks/useResponsiveWidget';

interface PivotTableWidgetProps {
  config: WidgetConfig;
  data: Record<string, unknown>[];
}

interface PivotCell {
  value: number;
  count: number;
}

interface PivotData {
  rows: string[];
  columns: string[];
  matrix: { [row: string]: { [col: string]: PivotCell } };
  rowTotals: { [row: string]: PivotCell };
  colTotals: { [col: string]: PivotCell };
  grandTotal: PivotCell;
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

function buildPivotData(
  data: Record<string, unknown>[],
  rowField: string,
  colField: string,
  valueField: string,
  aggregation: 'sum' | 'avg' | 'count' = 'sum'
): PivotData {
  const matrix: { [row: string]: { [col: string]: PivotCell } } = {};
  const rowTotals: { [row: string]: PivotCell } = {};
  const colTotals: { [col: string]: PivotCell } = {};
  let grandTotal: PivotCell = { value: 0, count: 0 };

  // Collect all unique row and column values
  const rows = [...new Set(data.map(d => String(d[rowField] || 'Unknown')))].sort();
  const columns = [...new Set(data.map(d => String(d[colField] || 'Unknown')))].sort();

  // Initialize structure
  rows.forEach(row => {
    matrix[row] = {};
    rowTotals[row] = { value: 0, count: 0 };
    columns.forEach(col => {
      matrix[row][col] = { value: 0, count: 0 };
    });
  });

  columns.forEach(col => {
    colTotals[col] = { value: 0, count: 0 };
  });

  // Aggregate data
  data.forEach(record => {
    const rowKey = String(record[rowField] || 'Unknown');
    const colKey = String(record[colField] || 'Unknown');
    const numValue = typeof record[valueField] === 'number' ? record[valueField] : Number(record[valueField]) || 0;

    if (!matrix[rowKey]) return; // Skip invalid rows
    if (!matrix[rowKey][colKey]) return; // Skip invalid columns

    matrix[rowKey][colKey].value += numValue;
    matrix[rowKey][colKey].count += 1;

    rowTotals[rowKey].value += numValue;
    rowTotals[rowKey].count += 1;

    colTotals[colKey].value += numValue;
    colTotals[colKey].count += 1;

    grandTotal.value += numValue;
    grandTotal.count += 1;
  });

  // Apply aggregation function
  if (aggregation === 'avg') {
    rows.forEach(row => {
      columns.forEach(col => {
        if (matrix[row][col].count > 0) {
          matrix[row][col].value = matrix[row][col].value / matrix[row][col].count;
        }
      });
      if (rowTotals[row].count > 0) {
        rowTotals[row].value = rowTotals[row].value / rowTotals[row].count;
      }
    });

    columns.forEach(col => {
      if (colTotals[col].count > 0) {
        colTotals[col].value = colTotals[col].value / colTotals[col].count;
      }
    });

    if (grandTotal.count > 0) {
      grandTotal.value = grandTotal.value / grandTotal.count;
    }
  } else if (aggregation === 'count') {
    rows.forEach(row => {
      columns.forEach(col => {
        matrix[row][col].value = matrix[row][col].count;
      });
      rowTotals[row].value = rowTotals[row].count;
    });

    columns.forEach(col => {
      colTotals[col].value = colTotals[col].count;
    });

    grandTotal.value = grandTotal.count;
  }

  return {
    rows,
    columns,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

export function PivotTableWidget({ config, data }: PivotTableWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const responsive = useResponsiveWidget(containerRef);

  if (!data.length) {
    return (
      <div className="card p-4 h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            {config.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">No data available</p>
        </div>
      </div>
    );
  }

  const availableFields = Object.keys(data[0]);

  // Get pivot configuration from widget config
  const groupBy = config.dataConfig.groupBy || [];
  const rowField = groupBy[0] || availableFields[0];
  const colField = groupBy[1] || availableFields[1] || rowField;
  const valueField = config.dataConfig.aggregation?.field ||
                    availableFields.find(f => typeof data[0][f] === 'number') ||
                    availableFields[availableFields.length - 1];
  const aggregation = config.dataConfig.aggregation?.function || 'sum';

  // Handle case where we don't have enough fields for a proper pivot
  if (availableFields.length < 2) {
    return (
      <div className="card p-4 h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            {config.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Need at least 2 fields for pivot table
          </p>
        </div>
      </div>
    );
  }

  const pivotData = buildPivotData(data, rowField, colField, valueField, aggregation as any);
  const isMobile = responsive.size === 'mobile';

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

    const resizeObserver = new ResizeObserver(checkScrollIndicator);
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [pivotData]);

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
        <div className={`${isMobile ? "text-[9px]" : "text-[10px]"} text-[var(--text-muted)] mt-1`}>
          {rowField} × {colField} • {aggregation}({valueField})
        </div>
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
                {/* Row field header */}
                <th
                  className={`text-left ${headerPadding} font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${headerTextSize} ${
                    isMobile ? 'sticky left-0 bg-[var(--bg-card)] z-20 min-w-[100px] whitespace-nowrap' : ''
                  }`}
                >
                  {isMobile ? rowField.slice(0, 8) + (rowField.length > 8 ? '…' : '') : rowField.replace(/_/g, ' ')}
                </th>

                {/* Column headers */}
                {pivotData.columns.map((col) => (
                  <th
                    key={col}
                    className={`text-center ${headerPadding} font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${headerTextSize} ${
                      isMobile ? 'whitespace-nowrap' : ''
                    }`}
                  >
                    {isMobile ? col.slice(0, 6) + (col.length > 6 ? '…' : '') : col}
                  </th>
                ))}

                {/* Total column header */}
                <th
                  className={`text-center ${headerPadding} font-semibold text-[var(--text-accent)] uppercase tracking-wider ${headerTextSize} ${
                    isMobile ? 'whitespace-nowrap' : ''
                  }`}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Data rows */}
              {pivotData.rows.map((row, i) => (
                <tr key={row} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-card-hover)] transition-colors">
                  {/* Row label */}
                  <td
                    className={`${padding} font-medium text-[var(--text-primary)] ${
                      isMobile ? 'sticky left-0 bg-[var(--bg-card)] z-10 min-w-[100px] whitespace-nowrap' : ''
                    }`}
                  >
                    {isMobile ? row.slice(0, 12) + (row.length > 12 ? '…' : '') : row}
                  </td>

                  {/* Data cells */}
                  {pivotData.columns.map((col) => (
                    <td
                      key={col}
                      className={`${padding} text-center text-[var(--text-primary)] ${
                        isMobile ? 'whitespace-nowrap' : ''
                      }`}
                    >
                      {pivotData.matrix[row][col].value > 0
                        ? formatCell(valueField, pivotData.matrix[row][col].value)
                        : '—'
                      }
                    </td>
                  ))}

                  {/* Row total */}
                  <td
                    className={`${padding} text-center font-semibold text-[var(--text-accent)] ${
                      isMobile ? 'whitespace-nowrap' : ''
                    } border-l border-[var(--border-color)]`}
                  >
                    {formatCell(valueField, pivotData.rowTotals[row].value)}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="border-t-2 border-[var(--border-color)] bg-[var(--bg-card-hover)]/50">
                <td
                  className={`${padding} font-semibold text-[var(--text-accent)] ${
                    isMobile ? 'sticky left-0 bg-[var(--bg-card-hover)]/50 z-10 min-w-[100px] whitespace-nowrap' : ''
                  }`}
                >
                  Total
                </td>
                {pivotData.columns.map((col) => (
                  <td
                    key={col}
                    className={`${padding} text-center font-semibold text-[var(--text-accent)] ${
                      isMobile ? 'whitespace-nowrap' : ''
                    }`}
                  >
                    {formatCell(valueField, pivotData.colTotals[col].value)}
                  </td>
                ))}
                <td
                  className={`${padding} text-center font-bold text-[var(--text-accent)] ${
                    isMobile ? 'whitespace-nowrap' : ''
                  } border-l border-[var(--border-color)]`}
                >
                  {formatCell(valueField, pivotData.grandTotal.value)}
                </td>
              </tr>
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