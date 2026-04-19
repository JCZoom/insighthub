'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Search,
  X,
  RefreshCw,
  ArrowUpDown,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type { TablePreviewData } from '@/types/data-explorer';

interface DataPreviewProps {
  source?: string;
  table?: string;
  className?: string;
  maxHeight?: number;
  onClose?: () => void;
  showHeader?: boolean;
}

interface FilterState {
  [column: string]: {
    type: 'text' | 'number' | 'date';
    value: string;
    operator: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  };
}

interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

export function DataPreview({
  source,
  table,
  className,
  maxHeight = 400,
  onClose,
  showHeader = true
}: DataPreviewProps) {
  const [data, setData] = useState<TablePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: 'asc' });
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Fetch table data
  const fetchData = useCallback(async () => {
    if (!source || !table) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/data/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          groupBy: undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const result = await response.json();

      const previewData: TablePreviewData = {
        tableName: table,
        columns: result.columns || [],
        rows: result.data || [],
        totalRows: result.data?.length || 0,
        hasMore: false,
        page: 1,
        pageSize: result.data?.length || 0,
        isFiltered: result.isFiltered,
        accessLevel: result.accessLevel
      };

      setData(previewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [source, table]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply local filtering and sorting
  const processedData = useMemo(() => {
    if (!data) return null;

    let processed = [...data.rows];

    // Apply filters
    Object.entries(filters).forEach(([column, filter]) => {
      processed = processed.filter(row => {
        const value = row[column];
        const filterValue = filter.value.toLowerCase();

        if (!filterValue) return true;

        const stringValue = String(value || '').toLowerCase();

        switch (filter.operator) {
          case 'contains':
            return stringValue.includes(filterValue);
          case 'eq':
            return stringValue === filterValue;
          case 'gt':
            return Number(value) > Number(filter.value);
          case 'lt':
            return Number(value) < Number(filter.value);
          case 'gte':
            return Number(value) >= Number(filter.value);
          case 'lte':
            return Number(value) <= Number(filter.value);
          default:
            return stringValue.includes(filterValue);
        }
      });
    });

    // Apply sorting
    if (sortState.column) {
      processed.sort((a, b) => {
        const aVal = a[sortState.column!];
        const bVal = b[sortState.column!];

        let comparison = 0;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal || '').localeCompare(String(bVal || ''));
        }

        return sortState.direction === 'desc' ? -comparison : comparison;
      });
    }

    return {
      ...data,
      rows: processed,
      totalRows: processed.length
    };
  }, [data, filters, sortState]);

  // Visible columns
  const visibleColumns = useMemo(() => {
    if (!data) return [];
    return data.columns.filter(col => !hiddenColumns.has(col));
  }, [data, hiddenColumns]);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    setSortState(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((column: string, value: string, operator: string = 'contains') => {
    setFilters(prev => ({
      ...prev,
      [column]: {
        type: 'text', // Simplified for now
        value,
        operator: operator as any
      }
    }));
  }, []);

  // Clear filter
  const clearFilter = useCallback((column: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
  }, []);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((column: string) => {
    setHiddenColumns(prev => {
      const newHidden = new Set(prev);
      if (newHidden.has(column)) {
        newHidden.delete(column);
      } else {
        newHidden.add(column);
      }
      return newHidden;
    });
  }, []);

  // Format cell value
  const formatCellValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }, []);

  if (!source || !table) {
    return (
      <div className={cn("flex items-center justify-center h-32 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg", className)}>
        <p className="text-sm text-[var(--text-muted)]">Select a table to preview data</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Table size={14} className="text-accent-green" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {table}
            </h3>
            {data?.isFiltered && (
              <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-600 rounded">
                Filtered Access
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Toggle filters">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "p-2 rounded-md transition-colors text-xs",
                  showFilters
                    ? "bg-accent-blue/10 text-accent-blue"
                    : "hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
                )}
              >
                <Filter size={12} />
              </button>
            </Tooltip>
            <Tooltip content="Refresh data">
              <button
                onClick={fetchData}
                className="p-2 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
                disabled={loading}
              >
                <RefreshCw size={12} className={cn("text-[var(--text-muted)]", loading && "animate-spin")} />
              </button>
            </Tooltip>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <X size={12} className="text-[var(--text-muted)]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Column controls */}
      {data && visibleColumns.length > 0 && (
        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Columns ({visibleColumns.length}/{data.columns.length} visible)
            </summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.columns.map(column => (
                <button
                  key={column}
                  onClick={() => toggleColumnVisibility(column)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
                    hiddenColumns.has(column)
                      ? "bg-gray-500/10 text-[var(--text-muted)]"
                      : "bg-accent-blue/10 text-accent-blue"
                  )}
                >
                  {hiddenColumns.has(column) ? <EyeOff size={8} /> : <Eye size={8} />}
                  {column}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-center p-4">
            <div>
              <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-sm text-red-400 mb-1">Failed to load data</p>
              <p className="text-xs text-[var(--text-muted)]">{error}</p>
            </div>
          </div>
        ) : !processedData || processedData.rows.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[var(--text-muted)]">No data available</p>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
                {/* Filter row */}
                {showFilters && (
                  <tr>
                    {visibleColumns.map(column => (
                      <th key={`filter-${column}`} className="px-3 py-2 text-left">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={filters[column]?.value || ''}
                            onChange={(e) => handleFilterChange(column, e.target.value)}
                            className="w-full px-2 py-1 text-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] rounded focus:outline-none focus:ring-1 focus:ring-accent-blue"
                          />
                          {filters[column] && (
                            <button
                              onClick={() => clearFilter(column)}
                              className="p-0.5 hover:bg-[var(--bg-card-hover)] rounded"
                            >
                              <X size={8} className="text-[var(--text-muted)]" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                )}

                {/* Header row */}
                <tr>
                  {visibleColumns.map(column => (
                    <th
                      key={column}
                      className="px-3 py-2 text-left font-medium text-[var(--text-primary)] border-r border-[var(--border-color)] last:border-r-0"
                    >
                      <button
                        onClick={() => handleSort(column)}
                        className="flex items-center gap-1 hover:text-accent-blue transition-colors"
                      >
                        <span className="truncate max-w-[100px]">{column}</span>
                        {sortState.column === column ? (
                          sortState.direction === 'asc' ? (
                            <ChevronUp size={10} />
                          ) : (
                            <ChevronDown size={10} />
                          )
                        ) : (
                          <ArrowUpDown size={8} className="opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedData.rows.map((row, index) => (
                  <tr
                    key={index}
                    className="hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border-color)]/30 last:border-b-0"
                  >
                    {visibleColumns.map(column => (
                      <td
                        key={column}
                        className="px-3 py-2 text-[var(--text-secondary)] border-r border-[var(--border-color)]/30 last:border-r-0"
                      >
                        <div className="truncate max-w-[150px]" title={String(row[column] || '')}>
                          {formatCellValue(row[column])}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {processedData && (
        <div className="flex items-center justify-between p-2 border-t border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <p className="text-[10px] text-[var(--text-muted)]">
            Showing {processedData.rows.length} of {processedData.totalRows} rows
            {Object.keys(filters).length > 0 && (
              <span className="text-accent-blue ml-1">
                (filtered)
              </span>
            )}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {visibleColumns.length} of {data?.columns.length || 0} columns visible
          </p>
        </div>
      )}
    </div>
  );
}