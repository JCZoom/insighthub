'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Play, Square, Save, Share, GitBranch, Settings, FileText, BarChart3, Database, X, ChevronDown, ChevronRight } from 'lucide-react';
import {
  PlaygroundSession,
  PlaygroundTab,
  PlaygroundCell,
  createEmptySession,
  createEmptyTab,
  createQueryCell,
  createMarkdownCell,
  PlaygroundSessionMeta,
  PlaygroundUIState
} from '@/types/playground';
import { PlaygroundTabComponent } from '@/components/data/PlaygroundTab';
import { queryDataSync } from '@/lib/data/sample-data';

function PlaygroundPageContent() {
  const searchParams = useSearchParams();

  // State management
  const [sessions, setSessions] = useState<PlaygroundSessionMeta[]>([]);
  const [currentSession, setCurrentSession] = useState<PlaygroundSession | null>(null);
  const [uiState, setUIState] = useState<PlaygroundUIState>({
    sidebarOpen: true,
    showSessionList: false,
    executionMode: 'single',
    isFullscreen: false,
    theme: 'dark'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('playground_sessions');
    const savedCurrentSession = localStorage.getItem('playground_current_session');

    if (savedSessions) {
      try {
        const sessionMetas = JSON.parse(savedSessions) as PlaygroundSessionMeta[];
        setSessions(sessionMetas);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    }

    if (savedCurrentSession) {
      try {
        const session = JSON.parse(savedCurrentSession) as PlaygroundSession;
        setCurrentSession(session);
        setUIState(prev => ({
          ...prev,
          selectedSessionId: session.id,
          activeTabId: session.activeTabId
        }));
      } catch (error) {
        console.error('Failed to load current session:', error);
      }
    }

    setIsLoading(false);
  }, []);

  // Handle widget import on mount
  useEffect(() => {
    const importType = searchParams.get('import');

    if (importType === 'widget' && !isLoading) {
      const importData = sessionStorage.getItem('playground_import_data');

      if (importData) {
        try {
          const data = JSON.parse(importData);

          if (data.fromWidget) {
            // Create new session with imported widget query
            const session = createEmptySession(`From Widget: ${data.fromWidget.widgetTitle}`);
            const tab = createEmptyTab('Widget Query');

            // Create markdown cell for context
            const contextCell = createMarkdownCell(`# Query from Widget: ${data.fromWidget.widgetTitle}

This query was imported from a dashboard widget.

**Source:** ${data.fromWidget.dataSource}
**Imported:** ${new Date(data.fromWidget.timestamp).toLocaleString()}

## Analysis
Add your notes and analysis here...`);

            // Create query cell with the imported SQL
            const queryCell = createQueryCell(data.fromWidget.sql);

            tab.cells = [contextCell, queryCell];
            tab.activeCellId = queryCell.id;
            contextCell.position = 0;
            queryCell.position = 1;

            session.tabs = [tab];
            session.activeTabId = tab.id;
            session.description = `Imported from widget: ${data.fromWidget.widgetTitle}`;

            setCurrentSession(session);
            setUIState(prev => ({
              ...prev,
              selectedSessionId: session.id,
              activeTabId: tab.id,
              activeCellId: queryCell.id
            }));

            // Clear the import data
            sessionStorage.removeItem('playground_import_data');
          }
        } catch (error) {
          console.error('Failed to import widget data:', error);
        }
      }
    }
  }, [searchParams, isLoading]);

  // Auto-save current session
  useEffect(() => {
    if (currentSession && !isLoading) {
      localStorage.setItem('playground_current_session', JSON.stringify(currentSession));
      // Update session metadata
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === currentSession.id);
        const meta: PlaygroundSessionMeta = {
          id: currentSession.id,
          name: currentSession.name,
          description: currentSession.description,
          tabCount: currentSession.tabs.length,
          lastModified: new Date(),
          isPublic: currentSession.isPublic,
          forkCount: currentSession.forkCount,
        };

        if (index >= 0) {
          const updated = [...prev];
          updated[index] = meta;
          return updated;
        } else {
          return [...prev, meta];
        }
      });
    }
  }, [currentSession, isLoading]);

  // Save sessions metadata to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('playground_sessions', JSON.stringify(sessions));
    }
  }, [sessions, isLoading]);

  const createNewSession = useCallback(() => {
    const session = createEmptySession(`Session ${sessions.length + 1}`);
    const tab = createEmptyTab('Query 1');
    const queryCell = createQueryCell('-- Welcome to the Query Playground!\n-- Start writing your SQL query here...\n\nSELECT * FROM sample_customers LIMIT 10;');
    const markdownCell = createMarkdownCell('# Query Analysis\n\nThis is a markdown cell where you can document your analysis, add notes, or explain your query logic.\n\n**Key insights:**\n- Use this space for documentation\n- Markdown cells support full markdown syntax\n- You can chain queries by referencing previous results');

    tab.cells = [markdownCell, queryCell];
    tab.activeCellId = queryCell.id;
    markdownCell.position = 0;
    queryCell.position = 1;

    session.tabs = [tab];
    session.activeTabId = tab.id;

    setCurrentSession(session);
    setUIState(prev => ({
      ...prev,
      selectedSessionId: session.id,
      activeTabId: tab.id,
      activeCellId: queryCell.id
    }));
  }, [sessions.length]);

  const createNewTab = useCallback(() => {
    if (!currentSession) return;

    const tab = createEmptyTab(`Query ${currentSession.tabs.length + 1}`);
    const queryCell = createQueryCell('-- New query tab\n\nSELECT COUNT(*) as total_records FROM sample_customers;');

    tab.cells = [queryCell];
    tab.activeCellId = queryCell.id;
    queryCell.position = 0;

    const updatedSession = {
      ...currentSession,
      tabs: [...currentSession.tabs, tab],
      activeTabId: tab.id,
      updatedAt: new Date()
    };

    setCurrentSession(updatedSession);
    setUIState(prev => ({ ...prev, activeTabId: tab.id, activeCellId: queryCell.id }));
  }, [currentSession]);

  const switchTab = useCallback((tabId: string) => {
    if (!currentSession) return;

    const tab = currentSession.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const updatedSession = {
      ...currentSession,
      activeTabId: tabId
    };

    setCurrentSession(updatedSession);
    setUIState(prev => ({
      ...prev,
      activeTabId: tabId,
      activeCellId: tab.activeCellId || tab.cells[0]?.id
    }));
  }, [currentSession]);

  const closeTab = useCallback((tabId: string) => {
    if (!currentSession || currentSession.tabs.length <= 1) return;

    const tabs = currentSession.tabs.filter(t => t.id !== tabId);
    const newActiveTabId = tabs[0]?.id;

    const updatedSession = {
      ...currentSession,
      tabs,
      activeTabId: newActiveTabId,
      updatedAt: new Date()
    };

    setCurrentSession(updatedSession);
    setUIState(prev => ({
      ...prev,
      activeTabId: newActiveTabId,
      activeCellId: tabs[0]?.activeCellId || tabs[0]?.cells[0]?.id
    }));
  }, [currentSession]);

  const updateTab = useCallback((tabId: string, updatedTab: PlaygroundTab) => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      tabs: currentSession.tabs.map(tab =>
        tab.id === tabId ? { ...updatedTab, updatedAt: new Date() } : tab
      ),
      updatedAt: new Date()
    };

    setCurrentSession(updatedSession);
  }, [currentSession]);

  const loadSession = useCallback((sessionId: string) => {
    const saved = localStorage.getItem(`playground_session_${sessionId}`);
    if (saved) {
      try {
        const session = JSON.parse(saved) as PlaygroundSession;
        setCurrentSession(session);
        setUIState(prev => ({
          ...prev,
          selectedSessionId: session.id,
          activeTabId: session.activeTabId,
          activeCellId: session.tabs.find(t => t.id === session.activeTabId)?.activeCellId
        }));
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    }
  }, []);

  const activeTab = useMemo(() => {
    if (!currentSession || !uiState.activeTabId) return null;
    return currentSession.tabs.find(t => t.id === uiState.activeTabId) || null;
  }, [currentSession, uiState.activeTabId]);

  // Initialize with default session if none exists
  useEffect(() => {
    if (!isLoading && sessions.length === 0 && !currentSession) {
      createNewSession();
    }
  }, [isLoading, sessions.length, currentSession, createNewSession]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)]">Loading Query Playground...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 backdrop-blur">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Title + Session */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-accent-purple" />
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Query Playground</h1>
            </div>

            {currentSession && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">/</span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">{currentSession.name}</span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={createNewTab}
              disabled={!currentSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              New Tab
            </button>

            <button
              onClick={createNewSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-accent-purple text-white hover:bg-accent-purple/90 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              New Session
            </button>

            <button
              onClick={() => setUIState(prev => ({ ...prev, showSessionList: !prev.showSessionList }))}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-lg transition-colors"
            >
              {uiState.showSessionList ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Session List */}
        {uiState.showSessionList && sessions.length > 0 && (
          <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    session.id === currentSession?.id
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <div className="font-medium text-sm">{session.name}</div>
                  {session.description && (
                    <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{session.description}</div>
                  )}
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''} • {new Date(session.lastModified).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {currentSession && currentSession.tabs.length > 0 && (
          <div className="border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
            <div className="flex overflow-x-auto">
              {currentSession.tabs.map(tab => (
                <div key={tab.id} className="flex items-center">
                  <button
                    onClick={() => switchTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      tab.id === uiState.activeTabId
                        ? 'border-accent-blue text-accent-blue bg-accent-blue/5'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]'
                    }`}
                  >
                    <span>{tab.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">({tab.cells.filter(c => c.type === 'query').length})</span>
                  </button>
                  {currentSession.tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {activeTab ? (
          <PlaygroundTabComponent
            tab={activeTab}
            onUpdateTab={(updatedTab) => updateTab(activeTab.id, updatedTab)}
            uiState={uiState}
            onUpdateUIState={(updates) => setUIState(prev => ({ ...prev, ...updates }))}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Active Tab</h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">Create a new tab to start querying your data.</p>
              <button
                onClick={createNewTab}
                disabled={!currentSession}
                className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-lg hover:bg-accent-purple/90 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Tab
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)]">Loading Query Playground...</span>
        </div>
      </div>
    }>
      <PlaygroundPageContent />
    </Suspense>
  );
}