export interface DataSource {
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
  isAccessible: boolean;
  accessLevel?: 'FULL' | 'FILTERED' | 'NONE';
  deniedReason?: string;
  tables: DataTable[];
  lastUpdated?: Date;
}

export interface DataTable {
  name: string;
  displayName?: string;
  description?: string;
  rowCount?: number;
  columns: DataColumn[];
  isAccessible: boolean;
  accessLevel?: 'FULL' | 'FILTERED' | 'NONE';
  deniedReason?: string;
  lastUpdated?: Date;
  primaryKeys?: string[];
  foreignKeys?: ForeignKeyRelation[];
}

export interface DataColumn {
  name: string;
  displayName?: string;
  type: string;
  nullable: boolean;
  description?: string;
  isAccessible: boolean;
  accessLevel?: 'FULL' | 'FILTERED' | 'NONE';
  deniedReason?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  sampleValues?: unknown[];
  glossaryTermId?: string;
  glossaryTerm?: {
    id: string;
    term: string;
    definition: string;
  };
}

export interface ForeignKeyRelation {
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

export interface ColumnProfile {
  columnName: string;
  dataType: string;
  totalRows: number;
  nullCount: number;
  uniqueCount: number;
  nullPercentage: number;
  uniquePercentage: number;
  statistics?: NumericStats | TextStats | DateStats;
  topValues?: ValueCount[];
  histogram?: HistogramBucket[];
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface TextStats {
  avgLength: number;
  minLength: number;
  maxLength: number;
  mostCommonWords?: string[];
  patterns?: {
    email: number;
    url: number;
    phone: number;
    numeric: number;
  };
}

export interface DateStats {
  earliestDate: Date;
  latestDate: Date;
  dateRange: string;
  gaps?: DateGap[];
  distribution?: {
    byYear: Record<string, number>;
    byMonth: Record<string, number>;
    byDayOfWeek: Record<string, number>;
  };
}

export interface DateGap {
  from: Date;
  to: Date;
  durationDays: number;
}

export interface ValueCount {
  value: unknown;
  count: number;
  percentage: number;
}

export interface HistogramBucket {
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface TablePreviewData {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  isFiltered?: boolean;
  accessLevel?: 'FULL' | 'FILTERED' | 'NONE';
}

export interface SchemaExplorerState {
  expandedSources: Set<string>;
  expandedTables: Set<string>;
  selectedItem?: {
    type: 'source' | 'table' | 'column';
    path: string; // e.g., "source.table.column"
    source?: string;
    table?: string;
    column?: string;
  };
  searchQuery: string;
  filterByCategory?: string;
  showOnlyAccessible: boolean;
}

export interface DataExplorerState {
  schema: DataSource[];
  schemaLoading: boolean;
  schemaError?: string;

  selectedTable?: string;
  previewData?: TablePreviewData;
  previewLoading: boolean;
  previewError?: string;

  selectedColumn?: string;
  columnProfile?: ColumnProfile;
  profileLoading: boolean;
  profileError?: string;

  sidebarOpen: boolean;
  profilePanelOpen: boolean;

  // UI state
  explorerState: SchemaExplorerState;
}

export interface TableRelationshipDiagram {
  tables: TableNode[];
  relationships: RelationshipEdge[];
  layout?: 'hierarchical' | 'circular' | 'force';
}

export interface TableNode {
  id: string;
  name: string;
  displayName?: string;
  columns: string[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface RelationshipEdge {
  id: string;
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

// API request/response types
export interface SchemaRequest {
  includeProfiles?: boolean;
  includeSampleData?: boolean;
  filterByCategory?: string;
}

export interface SchemaResponse {
  sources: DataSource[];
  totalSources: number;
  totalTables: number;
  totalColumns: number;
  lastUpdated: Date;
}

export interface ProfileRequest {
  source: string;
  table: string;
  column: string;
  includeHistogram?: boolean;
  includeTopValues?: boolean;
  topValuesLimit?: number;
}

export interface ProfileResponse {
  profile: ColumnProfile;
  executionTime: number;
}

export interface PreviewRequest {
  source: string;
  table: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface PreviewResponse {
  data: TablePreviewData;
  executionTime: number;
}

// Utility functions
export function getColumnPath(source: string, table: string, column: string): string {
  return `${source}.${table}.${column}`;
}

export function getTablePath(source: string, table: string): string {
  return `${source}.${table}`;
}

export function parseColumnPath(path: string): { source?: string; table?: string; column?: string } | null {
  const parts = path.split('.');
  if (parts.length === 3) {
    return { source: parts[0], table: parts[1], column: parts[2] };
  }
  if (parts.length === 2) {
    return { source: parts[0], table: parts[1] };
  }
  if (parts.length === 1) {
    return { source: parts[0] };
  }
  return null;
}

export function isNumericType(type: string): boolean {
  const numericTypes = ['number', 'integer', 'float', 'double', 'decimal', 'bigint', 'smallint'];
  return numericTypes.some(t => type.toLowerCase().includes(t));
}

export function isTextType(type: string): boolean {
  const textTypes = ['string', 'text', 'varchar', 'char', 'json'];
  return textTypes.some(t => type.toLowerCase().includes(t));
}

export function isDateType(type: string): boolean {
  const dateTypes = ['date', 'datetime', 'timestamp', 'time'];
  return dateTypes.some(t => type.toLowerCase().includes(t));
}

export function formatDataType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getTypeIcon(type: string): string {
  if (isNumericType(type)) return '🔢';
  if (isTextType(type)) return '📝';
  if (isDateType(type)) return '📅';
  return '❔';
}

// Constants
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;
export const DEFAULT_TOP_VALUES_LIMIT = 10;
export const MAX_TOP_VALUES_LIMIT = 100;
export const DEFAULT_HISTOGRAM_BUCKETS = 20;
export const MAX_HISTOGRAM_BUCKETS = 100;

// Access control helpers
export function canAccessColumn(column: DataColumn): boolean {
  return column.isAccessible && column.accessLevel !== 'NONE';
}

export function canAccessTable(table: DataTable): boolean {
  return table.isAccessible && table.accessLevel !== 'NONE';
}

export function canAccessSource(source: DataSource): boolean {
  return source.isAccessible && source.accessLevel !== 'NONE';
}

export function getAccessIcon(accessLevel?: 'FULL' | 'FILTERED' | 'NONE'): string {
  switch (accessLevel) {
    case 'FULL': return '✅';
    case 'FILTERED': return '⚠️';
    case 'NONE': return '🔒';
    default: return '❔';
  }
}