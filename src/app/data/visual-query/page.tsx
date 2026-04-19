'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VisualQueryBuilder } from '@/components/data/VisualQueryBuilder';
import { Database, Eye, Code, Save, Share } from 'lucide-react';
import { queryDataSync } from '@/lib/data/sample-data';
import type {
  VisualQueryConfig,
  QueryExecutionResult,
  TableConfig,
  ColumnMetadata
} from '@/types/visual-query';

// Sample schema for demonstration
const SAMPLE_SCHEMA: TableConfig[] = [
  {
    name: 'sample_customers',
    alias: 'customers',
    columns: [
      { name: 'id', type: 'number', table: 'sample_customers', description: 'Customer ID', isPrimaryKey: true },
      { name: 'name', type: 'text', table: 'sample_customers', description: 'Customer name' },
      { name: 'email', type: 'text', table: 'sample_customers', description: 'Customer email' },
      { name: 'city', type: 'text', table: 'sample_customers', description: 'Customer city' },
      { name: 'signup_date', type: 'date', table: 'sample_customers', description: 'Account signup date' },
      { name: 'total_orders', type: 'number', table: 'sample_customers', description: 'Total number of orders' },
      { name: 'total_spent', type: 'number', table: 'sample_customers', description: 'Total amount spent' }
    ]
  },
  {
    name: 'sample_orders',
    alias: 'orders',
    columns: [
      { name: 'id', type: 'number', table: 'sample_orders', description: 'Order ID', isPrimaryKey: true },
      { name: 'customer_id', type: 'number', table: 'sample_orders', description: 'Customer ID', isForeignKey: true, referencedTable: 'sample_customers', referencedColumn: 'id' },
      { name: 'order_date', type: 'date', table: 'sample_orders', description: 'Order date' },
      { name: 'total_amount', type: 'number', table: 'sample_orders', description: 'Order total amount' },
      { name: 'status', type: 'text', table: 'sample_orders', description: 'Order status' },
      { name: 'product_count', type: 'number', table: 'sample_orders', description: 'Number of products' }
    ]
  },
  {
    name: 'sample_products',
    alias: 'products',
    columns: [
      { name: 'id', type: 'number', table: 'sample_products', description: 'Product ID', isPrimaryKey: true },
      { name: 'name', type: 'text', table: 'sample_products', description: 'Product name' },
      { name: 'category', type: 'text', table: 'sample_products', description: 'Product category' },
      { name: 'price', type: 'number', table: 'sample_products', description: 'Product price' },
      { name: 'stock', type: 'number', table: 'sample_products', description: 'Stock quantity' },
      { name: 'created_date', type: 'date', table: 'sample_products', description: 'Product creation date' }
    ]
  }
];

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

  // Initialize query from URL parameters
  useEffect(() => {
    const table = searchParams.get('table');
    const source = searchParams.get('source');
    const column = searchParams.get('column');

    if (table && source && !isLoading) {
      // Find the table in our sample schema
      const tableConfig = SAMPLE_SCHEMA.find(t => t.name === table);
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
  }, [searchParams, isLoading]);

  // Save queries to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('visual_queries', JSON.stringify(savedQueries));
    }
  }, [savedQueries, isLoading]);

  // Execute query using sample data
  const executeQuery = useCallback(async (sql: string): Promise<QueryExecutionResult> => {
    const startTime = performance.now();

    try {
      // For demo purposes, just return sample data
      // In a real implementation, this would execute the SQL against your data source
      const sampleData = queryDataSync(sql);
      const endTime = performance.now();

      return {
        data: sampleData.data.slice(0, 100), // Limit to first 100 rows for demo
        columns: sampleData.columns,
        totalRows: sampleData.data.length,
        executionTime: endTime - startTime,
        sql
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

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

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)]">Loading Visual Query Builder...</span>
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
                          <button
                            onClick={() => loadQuery(query)}
                            className="p-1 text-[var(--text-muted)] hover:text-accent-blue rounded transition-colors"
                            title="Load query"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteQuery(query.id)}
                            className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded transition-colors"
                            title="Delete query"
                          >
                            ×
                          </button>
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
          schema={SAMPLE_SCHEMA}
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