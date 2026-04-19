'use client';

import { useState, useCallback } from 'react';
import { Database, Eye, BarChart3, Code, BookOpen, PanelLeftClose, PanelLeft } from 'lucide-react';
import { SchemaExplorer } from '@/components/data/SchemaExplorer';
import { DataPreview } from '@/components/data/DataPreview';
import { DataProfiler } from '@/components/data/DataProfiler';
import { GlossaryPanel } from '@/components/glossary/GlossaryPanel';
import { cn } from '@/lib/utils';

interface DataExplorerState {
  selectedSource?: string;
  selectedTable?: string;
  selectedColumn?: string;
  schemaOpen: boolean;
  previewOpen: boolean;
  profileOpen: boolean;
  glossaryOpen: boolean;
}

export default function DataExplorerPage() {
  const [state, setState] = useState<DataExplorerState>({
    schemaOpen: true,
    previewOpen: false,
    profileOpen: false,
    glossaryOpen: false
  });

  // Handle table selection from schema explorer
  const handleTableSelect = useCallback((source: string, table: string) => {
    setState(prev => ({
      ...prev,
      selectedSource: source,
      selectedTable: table,
      selectedColumn: undefined,
      previewOpen: true,
      profileOpen: false
    }));
  }, []);

  // Handle column selection from schema explorer
  const handleColumnSelect = useCallback((source: string, table: string, column: string) => {
    setState(prev => ({
      ...prev,
      selectedSource: source,
      selectedTable: table,
      selectedColumn: column,
      previewOpen: true,
      profileOpen: true
    }));
  }, []);

  // Handle "Open in SQL Editor" - for now just show a placeholder
  const handleOpenInSqlEditor = useCallback((source: string, table?: string, column?: string) => {
    let query = '';
    if (column) {
      query = `SELECT ${column} FROM ${source}${table ? ` -- Table: ${table}` : ''} LIMIT 100;`;
    } else if (table) {
      query = `SELECT * FROM ${source} LIMIT 100;`;
    } else {
      query = `-- Data source: ${source}\nSELECT * FROM ${source} LIMIT 100;`;
    }

    // For now, copy to clipboard
    navigator.clipboard.writeText(query);
    // TODO: Integrate with actual SQL Editor when available
    alert('SQL query copied to clipboard!\n\n' + query);
  }, []);

  // Handle "Open in Visual Query Builder"
  const handleOpenInVisualQueryBuilder = useCallback((source: string, table?: string, column?: string) => {
    // Navigate to Visual Query Builder
    const url = new URL('/data/visual-query', window.location.origin);

    // Pass table/column information via URL params for initialization
    if (table) {
      url.searchParams.set('table', table);
      url.searchParams.set('source', source);
    }
    if (column) {
      url.searchParams.set('column', column);
    }

    window.open(url.toString(), '_blank');
  }, []);

  // Toggle panels
  const togglePanel = useCallback((panel: keyof DataExplorerState) => {
    setState(prev => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  const closePanels = useCallback((panels: ('schemaOpen' | 'previewOpen' | 'profileOpen' | 'glossaryOpen')[]) => {
    setState(prev => {
      const newState = { ...prev };
      panels.forEach(panel => {
        newState[panel] = false;
      });
      return newState;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Database size={20} className="text-accent-blue" />
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Data Explorer</h1>
              <span className="text-sm text-[var(--text-muted)]">
                Browse schemas, preview data, and analyze columns
              </span>
            </div>

            {/* Panel toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => togglePanel('schemaOpen')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  state.schemaOpen
                    ? "bg-accent-blue/10 text-accent-blue"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                )}
              >
                {state.schemaOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
                Schema
              </button>

              <button
                onClick={() => togglePanel('previewOpen')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  state.previewOpen
                    ? "bg-accent-green/10 text-accent-green"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                )}
                disabled={!state.selectedTable}
              >
                <Eye size={14} />
                Preview
              </button>

              <button
                onClick={() => togglePanel('profileOpen')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  state.profileOpen
                    ? "bg-accent-purple/10 text-accent-purple"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                )}
                disabled={!state.selectedColumn}
              >
                <BarChart3 size={14} />
                Profile
              </button>

              <button
                onClick={() => togglePanel('glossaryOpen')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  state.glossaryOpen
                    ? "bg-accent-orange/10 text-accent-orange"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                )}
              >
                <BookOpen size={14} />
                Glossary
              </button>

              <button
                onClick={() => handleOpenInSqlEditor(state.selectedSource || '', state.selectedTable, state.selectedColumn)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/20 transition-colors"
                disabled={!state.selectedSource}
              >
                <Code size={14} />
                SQL Editor
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Schema Explorer */}
        <SchemaExplorer
          isOpen={state.schemaOpen}
          onClose={() => togglePanel('schemaOpen')}
          onTableSelect={handleTableSelect}
          onColumnSelect={handleColumnSelect}
          onOpenInSqlEditor={handleOpenInSqlEditor}
          onOpenInVisualQueryBuilder={handleOpenInVisualQueryBuilder}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Status bar */}
          <div className="px-4 py-2 bg-[var(--bg-card)]/30 border-b border-[var(--border-color)] text-xs text-[var(--text-muted)]">
            {state.selectedSource && (
              <div className="flex items-center gap-2">
                <span>Source: <span className="font-mono text-[var(--text-primary)]">{state.selectedSource}</span></span>
                {state.selectedTable && (
                  <>
                    <span className="text-[var(--border-color)]">•</span>
                    <span>Table: <span className="font-mono text-[var(--text-primary)]">{state.selectedTable}</span></span>
                  </>
                )}
                {state.selectedColumn && (
                  <>
                    <span className="text-[var(--border-color)]">•</span>
                    <span>Column: <span className="font-mono text-[var(--text-primary)]">{state.selectedColumn}</span></span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {!state.previewOpen ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Database size={64} className="mx-auto text-[var(--text-muted)] opacity-20" />
                  <div>
                    <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                      Welcome to Data Explorer
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] max-w-md">
                      Select a table from the schema explorer to preview data, or choose a column to view detailed statistics and profiling information.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Database size={12} className="text-accent-blue" />
                      Browse schema
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Eye size={12} className="text-accent-green" />
                      Preview data
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <BarChart3 size={12} className="text-accent-purple" />
                      Analyze columns
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <DataPreview
                source={state.selectedSource}
                table={state.selectedTable}
                className="h-full"
                onClose={() => closePanels(['previewOpen', 'profileOpen'])}
              />
            )}
          </div>
        </div>

        {/* Data Profiler */}
        <DataProfiler
          source={state.selectedSource}
          table={state.selectedTable}
          column={state.selectedColumn}
          isOpen={state.profileOpen}
          onClose={() => togglePanel('profileOpen')}
        />

        {/* Glossary Panel */}
        <GlossaryPanel
          isOpen={state.glossaryOpen}
          onClose={() => togglePanel('glossaryOpen')}
        />
      </div>
    </div>
  );
}