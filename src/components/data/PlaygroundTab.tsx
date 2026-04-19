'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, Play, Square, BarChart3, Type, Code2, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Split, Download, Share, Clock } from 'lucide-react';
import {
  PlaygroundTab,
  PlaygroundCell,
  PlaygroundUIState,
  QueryResults,
  createQueryCell,
  createMarkdownCell,
  createChartCell
} from '@/types/playground';
import { ResultDiff } from './ResultDiff';
import { QuickChart } from './QuickChart';
import { queryDataSync } from '@/lib/data/sample-data';

interface PlaygroundTabComponentProps {
  tab: PlaygroundTab;
  onUpdateTab: (tab: PlaygroundTab) => void;
  uiState: PlaygroundUIState;
  onUpdateUIState: (state: Partial<PlaygroundUIState>) => void;
}

interface MarkdownRendererProps {
  content: string;
  onChange: (content: string) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

function MarkdownRenderer({ content, onChange, isEditing, onToggleEdit }: MarkdownRendererProps) {
  if (isEditing) {
    return (
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between bg-[var(--bg-card)] px-3 py-2 border-b border-[var(--border-color)]">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Markdown Editor</span>
          <button
            onClick={onToggleEdit}
            className="text-xs text-accent-blue hover:text-accent-blue/80"
          >
            Preview
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-32 p-3 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
          placeholder="Write your markdown here..."
        />
      </div>
    );
  }

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-[var(--bg-card)] px-3 py-2 border-b border-[var(--border-color)]">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Documentation</span>
        <button
          onClick={onToggleEdit}
          className="text-xs text-accent-blue hover:text-accent-blue/80"
        >
          Edit
        </button>
      </div>
      <div className="p-3 prose prose-sm max-w-none dark:prose-invert">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
        ) : (
          <p className="text-[var(--text-muted)] italic">Click Edit to add documentation...</p>
        )}
      </div>
    </div>
  );
}

// Simple markdown parser for basic formatting
function parseMarkdown(content: string): string {
  return content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
    .replace(/<\/ul>\s*<ul>/g, '');
}

interface QueryEditorProps {
  content: string;
  onChange: (content: string) => void;
  onExecute: () => void;
  isExecuting: boolean;
  results?: QueryResults;
  error?: string;
  executionTime?: number;
}

function QueryEditor({ content, onChange, onExecute, isExecuting, results, error, executionTime }: QueryEditorProps) {
  const [showResults, setShowResults] = useState(true);

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      {/* Query Editor Header */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">SQL Query</span>
        </div>
        <div className="flex items-center gap-2">
          {results && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showResults ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              Results
            </button>
          )}
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-accent-green hover:bg-accent-green/90 rounded transition-colors disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <Square className="w-3 h-3" />
                Running
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Query Editor */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-40 p-3 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
          placeholder="-- Write your SQL query here...&#10;-- Use Ctrl/Cmd + Enter to execute"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              onExecute();
            }
          }}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border-t border-red-500/20 p-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Query Error</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && results && (
        <div className="border-t border-[var(--border-color)]">
          <div className="bg-[var(--bg-card)] px-3 py-2 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Results</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {results.data.length} rows × {results.columns.length} columns
                </span>
                {executionTime && (
                  <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3 h-3" />
                    {executionTime}ms
                  </span>
                )}
              </div>
              <button className="text-xs text-[var(--text-muted)] hover:text-accent-blue">
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>

          {results.data.length > 0 ? (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
                  <tr>
                    {results.columns.map(column => (
                      <th key={column} className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.data.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]">
                      {results.columns.map(column => (
                        <td key={column} className="px-3 py-2 text-[var(--text-primary)] font-mono">
                          {typeof row[column] === 'number'
                            ? (row[column] as number).toLocaleString()
                            : String(row[column] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">No results</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlaygroundTabComponent({ tab, onUpdateTab, uiState, onUpdateUIState }: PlaygroundTabComponentProps) {
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set());
  const [executingCells, setExecutingCells] = useState<Set<string>>(new Set());
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const addCell = useCallback((type: 'query' | 'markdown' | 'chart', afterCellId?: string) => {
    const newCell = type === 'markdown'
      ? createMarkdownCell()
      : type === 'chart'
        ? createChartCell()
        : createQueryCell();

    const cells = [...tab.cells];
    const insertIndex = afterCellId
      ? cells.findIndex(c => c.id === afterCellId) + 1
      : cells.length;

    cells.splice(insertIndex, 0, newCell);

    // Reorder positions
    cells.forEach((cell, index) => {
      cell.position = index;
    });

    const updatedTab = {
      ...tab,
      cells,
      activeCellId: newCell.id,
      updatedAt: new Date()
    };

    onUpdateTab(updatedTab);
    onUpdateUIState({ activeCellId: newCell.id });

    // Auto-edit new cells
    if (type === 'markdown') {
      setEditingCells(prev => new Set([...prev, newCell.id]));
    }
  }, [tab, onUpdateTab, onUpdateUIState]);

  const deleteCell = useCallback((cellId: string) => {
    if (tab.cells.length <= 1) return; // Don't delete the last cell

    const cells = tab.cells.filter(c => c.id !== cellId);

    // Reorder positions
    cells.forEach((cell, index) => {
      cell.position = index;
    });

    const updatedTab = {
      ...tab,
      cells,
      activeCellId: cells[0]?.id,
      updatedAt: new Date()
    };

    onUpdateTab(updatedTab);
    onUpdateUIState({ activeCellId: cells[0]?.id });
  }, [tab, onUpdateTab, onUpdateUIState]);

  const updateCell = useCallback((cellId: string, updates: Partial<PlaygroundCell>) => {
    const cells = tab.cells.map(cell =>
      cell.id === cellId ? { ...cell, ...updates } : cell
    );

    const updatedTab = {
      ...tab,
      cells,
      updatedAt: new Date()
    };

    onUpdateTab(updatedTab);
  }, [tab, onUpdateTab]);

  const executeCell = useCallback(async (cellId: string) => {
    const cell = tab.cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'query') return;

    setExecutingCells(prev => new Set([...prev, cellId]));

    try {
      const startTime = Date.now();

      // Execute query using sample data
      const result = queryDataSync(extractDataSource(cell.content) || 'sample_customers');
      const executionTime = Date.now() - startTime;

      const queryResults: QueryResults = {
        data: result.data,
        columns: result.columns,
        totalRows: result.data.length,
        executionTime,
        sql: cell.content,
        tempTableName: `temp_result_${cellId.slice(0, 8)}`
      };

      updateCell(cellId, {
        results: queryResults,
        lastExecuted: new Date(),
        executionTime,
        error: undefined
      });

    } catch (error) {
      updateCell(cellId, {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        results: undefined
      });
    } finally {
      setExecutingCells(prev => {
        const next = new Set(prev);
        next.delete(cellId);
        return next;
      });
    }
  }, [tab.cells, updateCell]);

  const toggleCellEdit = useCallback((cellId: string) => {
    setEditingCells(prev => {
      const next = new Set(prev);
      if (next.has(cellId)) {
        next.delete(cellId);
      } else {
        next.add(cellId);
      }
      return next;
    });
  }, []);

  const moveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
    const cellIndex = tab.cells.findIndex(c => c.id === cellId);
    if (cellIndex === -1) return;

    const newIndex = direction === 'up' ? cellIndex - 1 : cellIndex + 1;
    if (newIndex < 0 || newIndex >= tab.cells.length) return;

    const cells = [...tab.cells];
    [cells[cellIndex], cells[newIndex]] = [cells[newIndex], cells[cellIndex]];

    // Update positions
    cells.forEach((cell, index) => {
      cell.position = index;
    });

    const updatedTab = {
      ...tab,
      cells,
      updatedAt: new Date()
    };

    onUpdateTab(updatedTab);
  }, [tab, onUpdateTab]);

  // Extract data source from SQL query
  function extractDataSource(sql: string): string | null {
    const match = sql.match(/FROM\s+(\w+)/i);
    return match ? match[1] : null;
  }

  // Sort cells by position
  const sortedCells = useMemo(() => {
    return [...tab.cells].sort((a, b) => a.position - b.position);
  }, [tab.cells]);

  const executeAllCells = useCallback(async () => {
    const queryCells = sortedCells.filter(c => c.type === 'query');

    for (const cell of queryCells) {
      await executeCell(cell.id);
    }
  }, [sortedCells, executeCell]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Tab Actions */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={executeAllCells}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent-green hover:bg-accent-green/90 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Run All
            </button>

            <div className="flex items-center gap-1 border border-[var(--border-color)] rounded-lg overflow-hidden">
              <button
                onClick={() => addCell('markdown')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                title="Add Markdown Cell"
              >
                <Type className="w-3 h-3" />
                Text
              </button>
              <button
                onClick={() => addCell('query')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border-l border-[var(--border-color)]"
                title="Add Query Cell"
              >
                <Code2 className="w-3 h-3" />
                Query
              </button>
              <button
                onClick={() => addCell('chart')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border-l border-[var(--border-color)]"
                title="Add Chart Cell"
              >
                <BarChart3 className="w-3 h-3" />
                Chart
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{tab.cells.length} cells</span>
            <span>•</span>
            <span>{tab.cells.filter(c => c.type === 'query').length} queries</span>
          </div>
        </div>
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 max-w-6xl mx-auto">
          {sortedCells.map((cell, index) => (
            <div
              key={cell.id}
              ref={el => {
                if (el) {
                  cellRefs.current.set(cell.id, el);
                }
              }}
              className={`group relative ${
                uiState.activeCellId === cell.id ? 'ring-2 ring-accent-blue/20 rounded-lg' : ''
              }`}
              onClick={() => onUpdateUIState({ activeCellId: cell.id })}
            >
              {/* Cell Controls */}
              <div className="absolute -left-12 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveCell(cell.id, 'up')}
                  disabled={index === 0}
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded disabled:opacity-30"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveCell(cell.id, 'down')}
                  disabled={index === sortedCells.length - 1}
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded disabled:opacity-30"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteCell(cell.id)}
                  disabled={tab.cells.length <= 1}
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded disabled:opacity-30"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Cell Content */}
              {cell.type === 'markdown' && (
                <MarkdownRenderer
                  content={cell.content}
                  onChange={(content) => updateCell(cell.id, { content })}
                  isEditing={editingCells.has(cell.id)}
                  onToggleEdit={() => toggleCellEdit(cell.id)}
                />
              )}

              {cell.type === 'query' && (
                <QueryEditor
                  content={cell.content}
                  onChange={(content) => updateCell(cell.id, { content })}
                  onExecute={() => executeCell(cell.id)}
                  isExecuting={executingCells.has(cell.id)}
                  results={cell.results}
                  error={cell.error}
                  executionTime={cell.executionTime}
                />
              )}

              {cell.type === 'chart' && (
                <QuickChart
                  data={cell.results?.data || []}
                  columns={cell.results?.columns || []}
                  config={cell.chartConfig}
                  onConfigChange={(config) => updateCell(cell.id, { chartConfig: config })}
                />
              )}

              {/* Add Cell Button */}
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => addCell('query', cell.id)}
                  className="w-8 h-6 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-accent-blue hover:border-accent-blue rounded-full transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Add First Cell if empty */}
          {tab.cells.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Code2 className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Empty Notebook</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Start by adding a query or markdown cell.</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => addCell('markdown')}
                    className="flex items-center gap-1 px-3 py-2 text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] rounded-lg"
                  >
                    <Type className="w-4 h-4" />
                    Text
                  </button>
                  <button
                    onClick={() => addCell('query')}
                    className="flex items-center gap-1 px-3 py-2 text-sm bg-accent-blue text-white hover:bg-accent-blue/90 rounded-lg"
                  >
                    <Code2 className="w-4 h-4" />
                    Query
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}