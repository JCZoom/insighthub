export interface PlaygroundSession {
  id: string;
  name: string;
  description?: string;
  tabs: PlaygroundTab[];
  activeTabId: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  isPublic: boolean;
  shareToken?: string;
  forkCount: number;
  parentSessionId?: string; // For forked sessions
}

export interface PlaygroundTab {
  id: string;
  name: string;
  type: 'notebook' | 'split-view';
  cells: PlaygroundCell[];
  activeCellId?: string;
  splitView?: SplitViewConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type PlaygroundCellType = 'query' | 'markdown' | 'chart';

export interface PlaygroundCell {
  id: string;
  type: PlaygroundCellType;
  content: string; // SQL query for query cells, markdown for markdown cells
  position: number;
  isExecuting?: boolean;
  lastExecuted?: Date;
  executionTime?: number;
  results?: QueryResults;
  chartConfig?: QuickChartConfig;
  chainedFromCellId?: string; // For query chaining
  error?: string;
}

export interface QueryResults {
  data: Record<string, unknown>[];
  columns: string[];
  totalRows: number;
  executionTime: number;
  sql: string;
  tempTableName?: string; // For chaining to next query
}

export interface SplitViewConfig {
  leftCellId: string;
  rightCellId: string;
  showDiff: boolean;
  diffMode: 'rows' | 'values' | 'schema';
}

export interface QuickChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'area';
  xAxis?: string;
  yAxis?: string;
  colorBy?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface PlaygroundComment {
  id: string;
  cellId: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  position: { x: number; y: number };
  resolved: boolean;
}

export interface PlaygroundShare {
  sessionId: string;
  shareToken: string;
  expiresAt?: Date;
  permissions: 'read' | 'comment' | 'edit';
  createdBy: string;
  createdAt: Date;
}

export interface PlaygroundFork {
  id: string;
  originalSessionId: string;
  forkedSessionId: string;
  forkedBy: string;
  forkedAt: Date;
  changes?: string; // Brief description of what was changed
}

// For promoting to widget
export interface WidgetPromotionRequest {
  cellId: string;
  sessionId: string;
  widgetType: 'kpi_card' | 'line_chart' | 'bar_chart' | 'area_chart' | 'pie_chart' | 'table';
  title: string;
  chartConfig?: QuickChartConfig;
  targetDashboardId?: string;
}

// Execution context for query chaining
export interface QueryChainContext {
  availableTables: string[]; // Temp tables from previous queries
  variables: Record<string, unknown>; // Variables from markdown cells or previous queries
}

// Result comparison for diff view
export interface ResultComparison {
  leftResults: QueryResults;
  rightResults: QueryResults;
  differences: ResultDifference[];
  summary: ComparisonSummary;
}

export interface ResultDifference {
  type: 'added' | 'removed' | 'modified' | 'schema_change';
  rowIndex?: number;
  column?: string;
  leftValue?: unknown;
  rightValue?: unknown;
  details?: string;
}

export interface ComparisonSummary {
  totalRows: { left: number; right: number };
  addedRows: number;
  removedRows: number;
  modifiedRows: number;
  schemaChanges: number;
  matchPercentage: number;
}

// For notebook-style execution
export interface NotebookExecutionResult {
  cellId: string;
  success: boolean;
  results?: QueryResults;
  error?: string;
  chainContext?: QueryChainContext;
}

// Session management
export interface PlaygroundSessionMeta {
  id: string;
  name: string;
  description?: string;
  tabCount: number;
  lastModified: Date;
  isPublic: boolean;
  forkCount: number;
  owner?: {
    id: string;
    name: string;
  };
}

// UI state management
export interface PlaygroundUIState {
  selectedSessionId?: string;
  activeTabId?: string;
  activeCellId?: string;
  sidebarOpen: boolean;
  showSessionList: boolean;
  executionMode: 'single' | 'all' | 'chain';
  isFullscreen: boolean;
  theme: 'light' | 'dark';
  splitRatio?: number; // For split view
}

// Export helper for creating new sessions/tabs
export const createEmptySession = (name: string): PlaygroundSession => ({
  id: crypto.randomUUID(),
  name,
  tabs: [],
  activeTabId: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublic: false,
  forkCount: 0
});

export const createEmptyTab = (name: string, type: PlaygroundTab['type'] = 'notebook'): PlaygroundTab => ({
  id: crypto.randomUUID(),
  name,
  type,
  cells: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createQueryCell = (content: string = '', chainedFromCellId?: string): PlaygroundCell => ({
  id: crypto.randomUUID(),
  type: 'query',
  content,
  position: 0,
  chainedFromCellId
});

export const createMarkdownCell = (content: string = ''): PlaygroundCell => ({
  id: crypto.randomUUID(),
  type: 'markdown',
  content,
  position: 0
});

export const createChartCell = (content: string = '', chartConfig?: QuickChartConfig): PlaygroundCell => ({
  id: crypto.randomUUID(),
  type: 'chart',
  content,
  position: 0,
  chartConfig
});