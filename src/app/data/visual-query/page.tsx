'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VisualQueryBuilder } from '@/components/data/VisualQueryBuilder';
import { Database, Eye, Code, AlertCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type {
  VisualQueryConfig,
  QueryExecutionResult,
  TableConfig
} from '@/types/visual-query';
import type {
  SchemaResponse,
  DataColumn as ApiDataColumn,
} from '@/types/data-explorer';

/**
 * Convert the permission-aware /api/data/schema response into the
 * TableConfig[] shape the VisualQueryBuilder expects. We flatten the
 * source → tables → columns tree into a single list of TableConfigs
 * because VQB thinks in terms of tables/sources, not categories.
 *
 * Tables the user cannot access are omitted entirely — VQB should
 * only see queryable sources.
 */
function schemaResponseToTableConfigs(schema: SchemaResponse): TableConfig[] {
  const tables: TableConfig[] = [];
  for (const source of schema.sources) {
    for (const t of source.tables) {
      if (!t.isAccessible) continue;
      tables.push({
        name: t.name,
        // Don't set `alias` to the human-readable displayName — aliases
        // flow into FROM clauses and would produce invalid SQL when they
        // contain spaces (e.g. FROM mrr_by_month "Mrr By Month" would
        // require all column refs to use the quoted alias). The VQB uses
        // ColumnMetadata.displayName for labels in the UI already.
        columns: t.columns.map((c: ApiDataColumn) => ({
          name: c.name,
          displayName: c.displayName,
          type: mapColumnType(c.type),
          table: t.name,
          description: c.description,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: c.isForeignKey,
          isGlossaryLinked: Boolean(c.glossaryTermId),
          glossaryTermId: c.glossaryTermId,
        })),
      });
    }
  }
  return tables;
}

function mapColumnType(
  raw: string
): 'text' | 'number' | 'date' | 'boolean' | 'json' {
  const t = raw.toLowerCase();
  if (['integer', 'number', 'float', 'double', 'decimal', 'bigint'].some((x) => t.includes(x))) {
    return 'number';
  }
  if (t.includes('date') || t.includes('time')) return 'date';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('json')) return 'json';
  return 'text';
}

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: VisualQueryConfig;
  sql: string;
  createdAt: Date;
  lastModified: Date;
}

function VisualQueryPageContent() {
  const searchParams = useSearchParams();
  const [currentQuery, setCurrentQuery] = useState<VisualQueryConfig | undefined>();
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [schema, setSchema] = useState<TableConfig[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);

  // Load the real permission-aware schema from the server.
  // Tables the user cannot access are filtered out at the API layer.
  useEffect(() => {
    let cancelled = false;
    async function loadSchema() {
      try {
        const res = await fetch('/api/data/schema');
        if (!res.ok) {
          throw new Error(`Schema request failed with ${res.status}`);
        }
        const body = (await res.json()) as SchemaResponse;
        if (cancelled) return;
        setSchema(schemaResponseToTableConfigs(body));
      } catch (err) {
        if (cancelled) return;
        setSchemaError(
          err instanceof Error ? err.message : 'Failed to load schema'
        );
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }
    }
    loadSchema();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load saved queries from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('visual_queries');
    if (saved) {
      try {
        const queries = JSON.parse(saved) as SavedQuery[];
        setSavedQueries(queries.map(q => ({
          ...q,
          createdAt: new Date(q.createdAt),
          lastModified: new Date(q.lastModified)
        })));
      } catch (error) {
        console.error('Failed to load saved queries:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Initialize query from URL parameters (once schema is loaded)
  useEffect(() => {
    const table = searchParams.get('table');
    const column = searchParams.get('column');

    if (table && !isLoading && !schemaLoading && schema.length > 0) {
      const tableConfig = schema.find(t => t.name === table);
      if (tableConfig) {
        const initialQuery: VisualQueryConfig = {
          id: crypto.randomUUID(),
          tables: [tableConfig],
          joins: [],
          columns: column ? [{
            id: crypto.randomUUID(),
            column: tableConfig.columns.find(c => c.name === column) || tableConfig.columns[0],
            isVisible: true
          }] : [],
          filters: [],
          groupBy: [],
          aggregations: [],
          orderBy: [],
          formulas: []
        };

        setCurrentQuery(initialQuery);
      }
    }
  }, [searchParams, isLoading, schemaLoading, schema]);

  // Save queries to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('visual_queries', JSON.stringify(savedQueries));
    }
  }, [savedQueries, isLoading]);

  /**
   * Execute the current query via the secure server endpoint. The server
   * regenerates SQL from the config (we never send client SQL as the
   * execution source of truth), applies RBAC + RLS + masking, and returns
   * the full audit report.
   */
  const executeQuery = useCallback(
    async (
      _sql: string,
      config: VisualQueryConfig
    ): Promise<QueryExecutionResult> => {
      const res = await fetch('/api/data/visual-query/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            err.error ||
            `Query execution failed (HTTP ${res.status})`
        );
      }

      return (await res.json()) as QueryExecutionResult;
    },
    []
  );

  // Save current query
  const saveQuery = useCallback((query: VisualQueryConfig, sql: string) => {
    const name = prompt('Enter a name for this query:');
    if (!name) return;

    const description = prompt('Enter a description (optional):');

    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      description: description || undefined,
      query,
      sql,
      createdAt: new Date(),
      lastModified: new Date()
    };

    setSavedQueries(prev => [newQuery, ...prev]);
  }, []);

  // Load a saved query
  const loadQuery = useCallback((savedQuery: SavedQuery) => {
    setCurrentQuery(savedQuery.query);
    setShowSavedQueries(false);
  }, []);

  // Delete a saved query
  const deleteQuery = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this query?')) {
      setSavedQueries(prev => prev.filter(q => q.id !== id));
    }
  }, []);

  if (isLoading || schemaLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)]">Loading Visual Query Builder...</span>
        </div>
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="max-w-md text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-accent-red mx-auto" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Failed to load data sources</h2>
          <p className="text-sm text-[var(--text-secondary)]">{schemaError}</p>
          <p className="text-xs text-[var(--text-muted)]">
            You may not be authenticated, or the schema endpoint is unavailable. Try reloading.
          </p>
        </div>
      </div>
    );
  }

  if (schema.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="max-w-md text-center space-y-3">
          <Database className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">No accessible data sources</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Your role doesn&apos;t have access to any data sources. Contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 backdrop-blur">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-accent-blue" />
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Visual Query Builder</h1>
            </div>
            <span className="text-sm text-[var(--text-muted)]">
              Drag & drop query builder with Sigma-style interface
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSavedQueries(!showSavedQueries)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              Saved Queries ({savedQueries.length})
            </button>

            <button
              onClick={() => {
                const playground = window.open('/data/playground', '_blank');
                if (playground) {
                  // Could pass the generated SQL to the playground
                  console.log('Opening playground - could pass SQL here');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-accent-purple hover:bg-accent-purple/10 rounded-lg transition-colors"
            >
              <Code className="w-4 h-4" />
              Open in Playground
            </button>
          </div>
        </div>

        {/* Saved Queries Panel */}
        {showSavedQueries && (
          <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Saved Queries</h3>
              {savedQueries.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center border-2 border-dashed border-[var(--border-color)] rounded-lg">
                  No saved queries yet. Create a query and click Save to store it.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedQueries.map(query => (
                    <div
                      key={query.id}
                      className="p-3 border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-[var(--text-primary)]">{query.name}</h4>
                          {query.description && (
                            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{query.description}</p>
                          )}
                          <p className="text-xs text-[var(--text-muted)] mt-2">
                            {query.lastModified.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Tooltip content="Load query">
                            <button
                              onClick={() => loadQuery(query)}
                              className="p-1 text-[var(--text-muted)] hover:text-accent-blue rounded transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete query">
                            <button
                              onClick={() => deleteQuery(query.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded transition-colors"
                            >
                              ×
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <VisualQueryBuilder
          schema={schema}
          initialQuery={currentQuery}
          onSave={saveQuery}
          onExecute={executeQuery}
          className="h-full"
        />
      </div>
    </div>
  );
}

export default function VisualQueryPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)]">Loading Visual Query Builder...</span>
        </div>
      </div>
    }>
      <VisualQueryPageContent />
    </Suspense>
  );
}