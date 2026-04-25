'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShieldCheck, Play, Save, Plus, Trash2, Eye, Database, AlertCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { ColumnPicker } from './ColumnPicker';
import { FilterBuilder } from './FilterBuilder';
import { FormulaBar } from './FormulaBar';
import { QueryAuditPanel } from './QueryAuditPanel';
import { visualToSQL, validateVisualQuery, estimateQueryComplexity } from '@/lib/data/visual-to-sql';
import type {
  VisualQueryConfig,
  VisualQueryBuilderState,
  ColumnMetadata,
  TableConfig,
  ColumnSelection,
  FormulaField,
  QueryExecutionResult,
  AggregationOperation,
  OrderByOperation
} from '@/types/visual-query';

interface VisualQueryBuilderProps {
  schema: TableConfig[];
  initialQuery?: VisualQueryConfig;
  onSave?: (query: VisualQueryConfig, sql: string) => void;
  /**
   * Called to execute the current query. Receives both the client-generated
   * SQL (for display/UX) and the full VisualQueryConfig (so the caller can
   * send the config to a server that regenerates SQL authoritatively and
   * applies RLS/masking). The server is the source of truth for SQL — the
   * `sql` argument is advisory only and MUST NOT be trusted for execution.
   */
  onExecute?: (
    sql: string,
    config: VisualQueryConfig
  ) => Promise<QueryExecutionResult>;
  className?: string;
}

const EMPTY_QUERY: VisualQueryConfig = {
  id: '',
  tables: [],
  joins: [],
  columns: [],
  filters: [],
  groupBy: [],
  aggregations: [],
  orderBy: [],
  formulas: []
};

export const VisualQueryBuilder: React.FC<VisualQueryBuilderProps> = ({
  schema,
  initialQuery,
  onSave,
  onExecute,
  className = ''
}) => {
  const [query, setQuery] = useState<VisualQueryConfig>(initialQuery || EMPTY_QUERY);
  const [state, setState] = useState<VisualQueryBuilderState>({
    showSqlPreview: false,
    showFormulaReference: false,
    isExecuting: false
  });
  const [activeFormula, setActiveFormula] = useState<string | null>(null);

  // Debounce timer lives in a ref (not state) — mutating it shouldn't
  // trigger re-renders, and the effect closure's cleanup handles invalidation.
  const executeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether the user has intentionally modified the query. While the
  // query is still "pristine" (only contains our auto-selected first table),
  // we suppress the red validation banner so a fresh canvas doesn't look
  // broken.
  const isPristine =
    query.columns.length === 0 &&
    query.aggregations.length === 0 &&
    query.formulas.length === 0 &&
    query.filters.length === 0 &&
    query.joins.length === 0;

  // Sync initialQuery from the parent when it arrives async (e.g. the page
  // loads schema, then sets currentQuery from URL params). We only overwrite
  // if the user hasn't started editing — respecting any in-progress work.
  useEffect(() => {
    if (initialQuery && isPristine && query.id === '') {
      setQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Initialize query with first table if empty
  useEffect(() => {
    if (query.tables.length === 0 && schema.length > 0) {
      setQuery(prev => ({
        ...prev,
        tables: [schema[0]]
      }));
    }
  }, [schema, query.tables.length]);

  // Available columns from all tables in the query
  const availableColumns = useMemo(() => {
    const columns: ColumnMetadata[] = [];
    query.tables.forEach(table => {
      table.columns.forEach(column => {
        columns.push({ ...column, table: table.name });
      });
    });
    return columns;
  }, [query.tables]);

  // Generate SQL from current query
  const generatedSQL = useMemo(() => {
    if (query.tables.length === 0) return '';

    try {
      return visualToSQL(query, { prettyFormat: true, includeComments: true });
    } catch (error) {
      console.error('SQL generation error:', error);
      return `-- Error generating SQL: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }, [query]);

  // Validate current query
  const validationErrors = useMemo(() => {
    return validateVisualQuery(query);
  }, [query]);

  // Query complexity estimate
  const complexity = useMemo(() => {
    return estimateQueryComplexity(query);
  }, [query]);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleColumnSelect = useCallback((column: ColumnMetadata) => {
    const existingColumn = query.columns.find(col =>
      col.column.name === column.name && col.column.table === column.table
    );

    if (existingColumn) {
      // Toggle visibility if already selected
      setQuery(prev => ({
        ...prev,
        columns: prev.columns.map(col =>
          col.id === existingColumn.id
            ? { ...col, isVisible: !col.isVisible }
            : col
        )
      }));
    } else {
      // Add new column
      const newColumn: ColumnSelection = {
        id: generateId(),
        column,
        isVisible: true
      };

      setQuery(prev => ({
        ...prev,
        columns: [...prev.columns, newColumn]
      }));
    }
  }, [query.columns]);

  const addAggregation = () => {
    if (availableColumns.length === 0) return;

    const numericColumns = availableColumns.filter(col => col.type === 'number');
    const targetColumn = numericColumns.length > 0 ? numericColumns[0] : availableColumns[0];

    const newAggregation: AggregationOperation = {
      id: generateId(),
      function: 'sum',
      column: targetColumn
    };

    setQuery(prev => ({
      ...prev,
      aggregations: [...prev.aggregations, newAggregation]
    }));
  };

  const removeAggregation = (id: string) => {
    setQuery(prev => ({
      ...prev,
      aggregations: prev.aggregations.filter(agg => agg.id !== id)
    }));
  };

  const updateAggregation = (id: string, updates: Partial<AggregationOperation>) => {
    setQuery(prev => ({
      ...prev,
      aggregations: prev.aggregations.map(agg =>
        agg.id === id ? { ...agg, ...updates } : agg
      )
    }));
  };

  const addFormula = () => {
    const newFormula: FormulaField = {
      id: generateId(),
      name: 'New Formula',
      expression: '',
      type: 'number'
    };

    setQuery(prev => ({
      ...prev,
      formulas: [...prev.formulas, newFormula]
    }));

    setActiveFormula(newFormula.id);
  };

  const updateFormula = (id: string, updates: Partial<FormulaField>) => {
    setQuery(prev => ({
      ...prev,
      formulas: prev.formulas.map(formula =>
        formula.id === id ? { ...formula, ...updates } : formula
      )
    }));
  };

  const removeFormula = (id: string) => {
    setQuery(prev => ({
      ...prev,
      formulas: prev.formulas.filter(formula => formula.id !== id)
    }));
    if (activeFormula === id) {
      setActiveFormula(null);
    }
  };

  const executeQuery = useCallback(async () => {
    if (!onExecute || validationErrors.length > 0) return;

    setState(prev => ({ ...prev, isExecuting: true }));

    try {
      const result = await onExecute(generatedSQL, query);
      setState(prev => ({
        ...prev,
        results: result,
        lastExecutedQuery: query,
        isExecuting: false
      }));
    } catch (error) {
      console.error('Query execution error:', error);
      setState(prev => ({ ...prev, isExecuting: false }));
    }
  }, [onExecute, generatedSQL, validationErrors, query]);

  // Auto-execute with debouncing for live preview. We wait until the user
  // has actually selected at least one column/agg/formula before firing —
  // otherwise a fresh canvas triggers a 400 round-trip just because the
  // first table got auto-added.
  useEffect(() => {
    if (!onExecute) return;
    if (validationErrors.length > 0) return;
    if (isPristine) return;

    if (executeTimeoutRef.current) {
      clearTimeout(executeTimeoutRef.current);
    }

    const timeoutId = setTimeout(() => {
      executeQuery();
    }, 500); // 500ms debounce

    executeTimeoutRef.current = timeoutId;

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, validationErrors, executeQuery, onExecute, isPristine]);

  const handleSave = () => {
    if (onSave && validationErrors.length === 0) {
      onSave(query, generatedSQL);
    }
  };

  return (
    <div className={`flex h-full bg-background ${className}`}>
      {/* Left Sidebar - Schema & Tools */}
      <div className="w-80 flex flex-col border-r border-border">
        <ColumnPicker
          schema={schema}
          onColumnSelect={handleColumnSelect}
          selectedColumns={query.columns.map(col => col.column)}
          className="flex-1"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Query Builder Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-semibold">Visual Query Builder</h2>
              {validationErrors.length > 0 && !isPristine && (
                <div className="flex items-center gap-1 text-accent-red">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{validationErrors.length} error(s)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content="See the SQL, applied security policies, and execution details">
                <button
                  onClick={() => setState(prev => ({ ...prev, showSqlPreview: !prev.showSqlPreview }))}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                    state.showSqlPreview
                      ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30'
                      : 'bg-card hover:bg-card-hover border border-border'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Audit
                  {state.results?.audit && (
                    state.results.audit.wasModified ||
                      state.results.audit.appliedPolicies.length > 0 ||
                      state.results.audit.maskedColumns.length > 0
                  ) && (
                    <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-accent-amber" aria-hidden />
                  )}
                </button>
              </Tooltip>
              <button
                onClick={executeQuery}
                disabled={state.isExecuting || validationErrors.length > 0}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-accent-blue hover:bg-accent-blue/80 text-white rounded-md transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {state.isExecuting ? 'Executing...' : 'Run'}
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={validationErrors.length > 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-accent-green hover:bg-accent-green/80 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Query Stats */}
          <div className="flex items-center gap-4 text-sm text-muted">
            <span>{query.tables.length} table(s)</span>
            <span>{query.columns.filter(c => c.isVisible).length} column(s)</span>
            <span>{query.filters.length} filter(s)</span>
            <span>{query.aggregations.length} aggregation(s)</span>
            <span>Complexity: {complexity.score}/10</span>
          </div>
        </div>

        {/* Query Configuration Area */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Selected Columns */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Selected Columns</h3>
            </div>
            {query.columns.length === 0 ? (
              <div className="text-center text-muted text-sm py-4 border-2 border-dashed border-border rounded-lg">
                Drag columns from the sidebar or click to select them
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {query.columns.map(col => (
                  <div
                    key={col.id}
                    className={`p-2 rounded border transition-colors ${
                      col.isVisible
                        ? 'bg-card border-border'
                        : 'bg-muted/20 border-border opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {col.column.displayName || col.column.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Tooltip content={col.isVisible ? 'Hide column' : 'Show column'}>
                          <button
                            onClick={() => handleColumnSelect(col.column)}
                            className="p-1 text-muted hover:text-foreground rounded"
                          >
                            <Eye className={`w-3 h-3 ${col.isVisible ? '' : 'opacity-50'}`} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Remove column">
                          <button
                            onClick={() => {
                              setQuery(prev => ({
                                ...prev,
                                columns: prev.columns.filter(c => c.id !== col.id)
                              }));
                            }}
                            className="p-1 text-muted hover:text-accent-red rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      {col.column.table}.{col.column.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aggregations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Aggregations</h3>
              <button
                onClick={addAggregation}
                className="flex items-center gap-1 px-2 py-1 text-sm text-accent-blue hover:bg-accent-blue/10 rounded"
                disabled={availableColumns.length === 0}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {query.aggregations.length === 0 ? (
              <div className="text-center text-muted text-sm py-4 border-2 border-dashed border-border rounded-lg">
                No aggregations. Click 'Add' to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {query.aggregations.map(agg => (
                  <div key={agg.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded">
                    <select
                      value={agg.function}
                      onChange={(e) => updateAggregation(agg.id, { function: e.target.value as any })}
                      className="px-2 py-1 text-sm bg-background border border-border rounded"
                    >
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="count_distinct">Count Distinct</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="median">Median</option>
                    </select>

                    <select
                      value={`${agg.column.table}.${agg.column.name}`}
                      onChange={(e) => {
                        const [table, name] = e.target.value.split('.');
                        const column = availableColumns.find(c => c.table === table && c.name === name);
                        if (column) {
                          updateAggregation(agg.id, { column });
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                    >
                      {availableColumns.map(col => (
                        <option key={`${col.table}.${col.name}`} value={`${col.table}.${col.name}`}>
                          {col.displayName || col.name} ({col.table})
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Alias (optional)"
                      value={agg.alias || ''}
                      onChange={(e) => updateAggregation(agg.id, { alias: e.target.value || undefined })}
                      className="w-32 px-2 py-1 text-sm bg-background border border-border rounded"
                    />

                    <button
                      onClick={() => removeAggregation(agg.id)}
                      className="p-1 text-muted hover:text-accent-red rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <FilterBuilder
            filters={query.filters}
            availableColumns={availableColumns}
            onChange={(filters) => setQuery(prev => ({ ...prev, filters }))}
          />

          {/* Formulas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Formulas</h3>
              <button
                onClick={addFormula}
                className="flex items-center gap-1 px-2 py-1 text-sm text-accent-blue hover:bg-accent-blue/10 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Formula
              </button>
            </div>

            {query.formulas.length === 0 ? (
              <div className="text-center text-muted text-sm py-4 border-2 border-dashed border-border rounded-lg">
                No formulas. Click 'Add Formula' to create calculated fields.
              </div>
            ) : (
              <div className="space-y-4">
                {query.formulas.map(formula => (
                  <div key={formula.id} className="p-4 bg-card border border-border rounded-lg">
                    <FormulaBar
                      formula={formula}
                      availableColumns={availableColumns}
                      onUpdate={(updated) => updateFormula(formula.id, updated)}
                      onDelete={() => removeFormula(formula.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit panel — shows generated SQL, executed SQL, applied
            security policies, masked columns, and execution metadata.
            Designed for data analytics owners to validate exactly what
            the server runs on their behalf. */}
        {state.showSqlPreview && (
          <QueryAuditPanel
            audit={state.results?.audit}
            fallbackSql={generatedSQL}
          />
        )}

        {/* Results Preview */}
        {state.results && (
          <div className="border-t border-border">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Results Preview</h3>
                <span className="text-sm text-muted">
                  {state.results.data.length} rows in {state.results.executionTime}ms
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border rounded">
                  <thead className="bg-card">
                    <tr>
                      {state.results.columns.map(col => (
                        <th key={col} className="px-3 py-2 text-left border-b border-border font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.results.data.slice(0, 10).map((row, index) => (
                      <tr key={index} className="hover:bg-card">
                        {state.results!.columns.map(col => (
                          <td key={col} className="px-3 py-2 border-b border-border">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.results.data.length > 10 && (
                  <div className="text-center text-muted text-sm py-2">
                    Showing first 10 of {state.results.data.length} rows
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors — suppressed on a pristine canvas where
            "no columns selected" is an expected empty state, not an error. */}
        {validationErrors.length > 0 && !isPristine && (
          <div className="border-t border-border bg-accent-red/5">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-accent-red" />
                <h3 className="font-medium text-accent-red">Query Validation Errors</h3>
              </div>
              <ul className="space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm text-accent-red">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualQueryBuilder;