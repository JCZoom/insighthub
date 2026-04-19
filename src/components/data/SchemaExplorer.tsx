'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Database,
  Table,
  Columns,
  ChevronDown,
  ChevronRight,
  Lock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Code,
  BookOpen,
  Loader2,
  Filter,
  X,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type {
  DataSource,
  DataTable,
  DataColumn,
  SchemaExplorerState,
  SchemaResponse
} from '@/types/data-explorer';

interface SchemaExplorerProps {
  isOpen: boolean;
  onClose?: () => void;
  onTableSelect?: (source: string, table: string) => void;
  onColumnSelect?: (source: string, table: string, column: string) => void;
  onOpenInSqlEditor?: (source: string, table?: string, column?: string) => void;
  onOpenInVisualQueryBuilder?: (source: string, table?: string, column?: string) => void;
  className?: string;
}

export function SchemaExplorer({
  isOpen,
  onClose,
  onTableSelect,
  onColumnSelect,
  onOpenInSqlEditor,
  onOpenInVisualQueryBuilder,
  className
}: SchemaExplorerProps) {
  const [schema, setSchema] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorerState, setExplorerState] = useState<SchemaExplorerState>({
    expandedSources: new Set<string>(),
    expandedTables: new Set<string>(),
    searchQuery: '',
    showOnlyAccessible: false
  });

  // Fetch schema data
  const fetchSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/data/schema');
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }
      const data: SchemaResponse = await response.json();
      setSchema(data.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSchema();
    }
  }, [isOpen, fetchSchema]);

  // Filter and search logic
  const filteredSchema = useMemo(() => {
    const { searchQuery, filterByCategory, showOnlyAccessible } = explorerState;

    let filtered = schema;

    // Filter by category
    if (filterByCategory) {
      filtered = filtered.filter(source =>
        source.category?.toLowerCase() === filterByCategory.toLowerCase()
      );
    }

    // Filter by accessibility
    if (showOnlyAccessible) {
      filtered = filtered
        .map(source => ({
          ...source,
          tables: source.tables.filter(table => table.isAccessible)
        }))
        .filter(source => source.tables.length > 0 || source.isAccessible);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered
        .map(source => {
          const matchingTables = source.tables
            .map(table => {
              const matchingColumns = table.columns.filter(column =>
                column.name.toLowerCase().includes(query) ||
                column.displayName?.toLowerCase().includes(query) ||
                column.description?.toLowerCase().includes(query) ||
                column.glossaryTerm?.term.toLowerCase().includes(query)
              );

              const tableMatches = table.name.toLowerCase().includes(query) ||
                table.displayName?.toLowerCase().includes(query) ||
                table.description?.toLowerCase().includes(query);

              return {
                ...table,
                columns: tableMatches ? table.columns : matchingColumns,
                _isMatch: tableMatches || matchingColumns.length > 0
              };
            })
            .filter(table => (table as any)._isMatch);

          const sourceMatches = source.name.toLowerCase().includes(query) ||
            source.displayName?.toLowerCase().includes(query) ||
            source.description?.toLowerCase().includes(query);

          return {
            ...source,
            tables: sourceMatches ? source.tables : matchingTables,
            _isMatch: sourceMatches || matchingTables.length > 0
          };
        })
        .filter(source => (source as any)._isMatch);
    }

    return filtered;
  }, [schema, explorerState]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    schema.forEach(source => {
      if (source.category) cats.add(source.category);
    });
    return Array.from(cats).sort();
  }, [schema]);

  // Toggle expansion state
  const toggleSourceExpansion = useCallback((sourceName: string) => {
    setExplorerState(prev => {
      const newExpanded = new Set(prev.expandedSources);
      if (newExpanded.has(sourceName)) {
        newExpanded.delete(sourceName);
      } else {
        newExpanded.add(sourceName);
      }
      return { ...prev, expandedSources: newExpanded };
    });
  }, []);

  const toggleTableExpansion = useCallback((tablePath: string) => {
    setExplorerState(prev => {
      const newExpanded = new Set(prev.expandedTables);
      if (newExpanded.has(tablePath)) {
        newExpanded.delete(tablePath);
      } else {
        newExpanded.add(tablePath);
      }
      return { ...prev, expandedTables: newExpanded };
    });
  }, []);

  // Access level icons
  const getAccessIcon = (accessLevel?: 'FULL' | 'FILTERED' | 'NONE', isAccessible?: boolean) => {
    if (!isAccessible || accessLevel === 'NONE') {
      return <Tooltip content="Access denied"><span><Lock size={12} className="text-red-400" /></span></Tooltip>;
    }
    if (accessLevel === 'FILTERED') {
      return <Tooltip content="Filtered access"><span><AlertTriangle size={12} className="text-yellow-400" /></span></Tooltip>;
    }
    return <Tooltip content="Full access"><span><CheckCircle size={12} className="text-green-400" /></span></Tooltip>;
  };

  if (!isOpen) return null;

  return (
    <div className={cn("flex flex-col h-full border-r border-[var(--border-color)] bg-[var(--bg-primary)] w-80 shrink-0", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-accent-blue" />
          <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Data Explorer</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <X size={14} className="text-[var(--text-muted)]" />
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div className="px-3 py-2 border-b border-[var(--border-color)] space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={explorerState.searchQuery}
            onChange={(e) => setExplorerState(prev => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="Search tables, columns..."
            className="w-full pl-7 pr-3 py-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            {categories.length > 1 && (
              <select
                value={explorerState.filterByCategory || ''}
                onChange={(e) => setExplorerState(prev => ({
                  ...prev,
                  filterByCategory: e.target.value || undefined
                }))}
                className="text-[10px] border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] rounded px-1 py-0.5"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          <label className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={explorerState.showOnlyAccessible}
              onChange={(e) => setExplorerState(prev => ({
                ...prev,
                showOnlyAccessible: e.target.checked
              }))}
              className="w-3 h-3"
            />
            Accessible only
          </label>
        </div>
      </div>

      {/* Schema tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="text-center py-8 px-3">
            <Database size={24} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-xs text-red-400 mb-2">Failed to load schema</p>
            <p className="text-[10px] text-[var(--text-muted)]">{error}</p>
            <button
              onClick={fetchSchema}
              className="text-[10px] text-accent-blue hover:underline mt-2"
            >
              Try again
            </button>
          </div>
        ) : filteredSchema.length === 0 ? (
          <div className="text-center py-8 px-3">
            <Database size={24} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-muted)]">
              {explorerState.searchQuery ? 'No matches found' : 'No data sources available'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredSchema.map(source => {
              const isSourceExpanded = explorerState.expandedSources.has(source.name);

              return (
                <div key={source.name} className="border-b border-[var(--border-color)]/30 last:border-b-0">
                  {/* Source header */}
                  <button
                    onClick={() => toggleSourceExpansion(source.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    {isSourceExpanded ? (
                      <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <ChevronRight size={10} className="text-[var(--text-muted)] shrink-0" />
                    )}
                    <Database size={12} className="text-accent-blue shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {source.displayName || source.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {source.tables.length} table{source.tables.length !== 1 ? 's' : ''}
                        {source.category && ` • ${source.category}`}
                      </p>
                    </div>
                    {getAccessIcon(source.accessLevel, source.isAccessible)}
                  </button>

                  {/* Tables */}
                  {isSourceExpanded && (
                    <div className="pl-4">
                      {source.tables.map(table => {
                        const tablePath = `${source.name}.${table.name}`;
                        const isTableExpanded = explorerState.expandedTables.has(tablePath);

                        return (
                          <div key={table.name} className="border-b border-[var(--border-color)]/20 last:border-b-0">
                            {/* Table header */}
                            <div className="flex items-center">
                              <button
                                onClick={() => toggleTableExpansion(tablePath)}
                                className="flex-1 flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                              >
                                {isTableExpanded ? (
                                  <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0" />
                                ) : (
                                  <ChevronRight size={10} className="text-[var(--text-muted)] shrink-0" />
                                )}
                                <Table size={11} className="text-accent-green shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-[var(--text-primary)] truncate">
                                    {table.displayName || table.name}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                                    {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}
                                    {table.rowCount !== undefined && ` • ${table.rowCount.toLocaleString()} rows`}
                                  </p>
                                </div>
                                {getAccessIcon(table.accessLevel, table.isAccessible)}
                              </button>
                              <div className="flex items-center gap-1 pr-2">
                                <Tooltip content="Preview table data">
                                  <button
                                    onClick={() => onTableSelect?.(source.name, table.name)}
                                    className="p-1 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                                  >
                                    <Eye size={10} className="text-[var(--text-muted)]" />
                                  </button>
                                </Tooltip>
                                <Tooltip content="Open in SQL Editor">
                                  <button
                                    onClick={() => onOpenInSqlEditor?.(source.name, table.name)}
                                    className="p-1 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                                  >
                                    <Code size={10} className="text-[var(--text-muted)]" />
                                  </button>
                                </Tooltip>
                                <Tooltip content="Open in Visual Query Builder">
                                  <button
                                    onClick={() => onOpenInVisualQueryBuilder?.(source.name, table.name)}
                                    className="p-1 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                                  >
                                    <Zap size={10} className="text-accent-blue" />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>

                            {/* Columns */}
                            {isTableExpanded && (
                              <div className="pl-4 bg-[var(--bg-card)]/30">
                                {table.columns.map(column => (
                                  <div
                                    key={column.name}
                                    className="flex items-center justify-between px-3 py-1 hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border-color)]/10 last:border-b-0"
                                  >
                                    <button
                                      onClick={() => onColumnSelect?.(source.name, table.name, column.name)}
                                      className="flex-1 flex items-center gap-2 text-left"
                                    >
                                      <Columns size={10} className="text-accent-yellow shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-[var(--text-primary)] truncate">
                                          {column.displayName || column.name}
                                        </p>
                                        <div className="flex items-center gap-1">
                                          <p className="text-[9px] text-[var(--text-muted)] font-mono">
                                            {column.type}
                                          </p>
                                          {column.nullable && (
                                            <span className="text-[8px] text-[var(--text-muted)] opacity-60">nullable</span>
                                          )}
                                          {column.isPrimaryKey && (
                                            <span className="text-[8px] text-accent-blue font-bold">PK</span>
                                          )}
                                          {column.isForeignKey && (
                                            <span className="text-[8px] text-accent-purple font-bold">FK</span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                    <div className="flex items-center gap-1">
                                      {column.glossaryTerm && (
                                        <Tooltip content={`Linked to: ${column.glossaryTerm.term}`}>
                                          <span>
                                            <BookOpen
                                              size={10}
                                              className="text-accent-purple"
                                            />
                                          </span>
                                        </Tooltip>
                                      )}
                                      <Tooltip content="Open in SQL Editor">
                                        <button
                                          onClick={() => onOpenInSqlEditor?.(source.name, table.name, column.name)}
                                          className="p-0.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                                        >
                                          <Code size={9} className="text-[var(--text-muted)]" />
                                        </button>
                                      </Tooltip>
                                      <Tooltip content="Open in Visual Query Builder">
                                        <button
                                          onClick={() => onOpenInVisualQueryBuilder?.(source.name, table.name, column.name)}
                                          className="p-0.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                                        >
                                          <Zap size={9} className="text-accent-blue" />
                                        </button>
                                      </Tooltip>
                                      {getAccessIcon(column.accessLevel, column.isAccessible)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-[var(--border-color)] bg-[var(--bg-card)]/30">
        <p className="text-[10px] text-[var(--text-muted)]">
          {filteredSchema.length} source{filteredSchema.length !== 1 ? 's' : ''} • {' '}
          {filteredSchema.reduce((sum, source) => sum + source.tables.length, 0)} table{filteredSchema.reduce((sum, source) => sum + source.tables.length, 0) !== 1 ? 's' : ''} • {' '}
          {filteredSchema.reduce((sum, source) =>
            sum + source.tables.reduce((tableSum, table) => tableSum + table.columns.length, 0), 0
          )} column{filteredSchema.reduce((sum, source) =>
            sum + source.tables.reduce((tableSum, table) => tableSum + table.columns.length, 0), 0
          ) !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}