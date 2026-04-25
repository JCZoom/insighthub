export interface VisualQueryConfig {
  id: string;
  name?: string;
  tables: TableConfig[];
  joins: JoinConfig[];
  columns: ColumnSelection[];
  filters: VisualFilter[];
  groupBy: string[];
  aggregations: AggregationOperation[];
  orderBy: OrderByOperation[];
  limit?: number;
  formulas: FormulaField[];
}

export interface TableConfig {
  name: string;
  alias?: string;
  columns: ColumnMetadata[];
}

export interface ColumnMetadata {
  name: string;
  displayName?: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  table: string;
  description?: string;
  isGlossaryLinked?: boolean;
  glossaryTermId?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface JoinConfig {
  id: string;
  leftTable: string;
  rightTable: string;
  leftColumn: string;
  rightColumn: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  isAutoSuggested?: boolean;
}

export interface ColumnSelection {
  id: string;
  column: ColumnMetadata;
  alias?: string;
  isVisible: boolean;
}

export interface VisualFilter {
  id: string;
  column: ColumnMetadata;
  operation: FilterOperation;
  value: FilterValue;
  logicalOperator?: 'AND' | 'OR';
}

export type FilterOperation =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in'
  | 'between'
  | 'date_range';

export type FilterValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[]
  | { start: string | number | Date; end: string | number | Date };

export interface AggregationOperation {
  id: string;
  function: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'median';
  column: ColumnMetadata;
  alias?: string;
}

export interface OrderByOperation {
  column: ColumnMetadata;
  direction: 'asc' | 'desc';
}

export interface FormulaField {
  id: string;
  name: string;
  expression: string;
  alias?: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  description?: string;
}

export interface QueryExecutionResult {
  data: Record<string, unknown>[];
  columns: string[];
  totalRows: number;
  executionTime: number;
  sql?: string;
  audit?: QueryAuditReport;
}

/**
 * Full audit trail for a Visual Query Builder execution. Returned by the
 * server so the user can validate exactly what SQL ran, which security
 * policies were applied, and which columns were masked.
 *
 * This is the "trust panel" surfaced to data analytics owners.
 */
export interface QueryAuditReport {
  // ─── What the user built ─────────────────────────────────────────
  /** SQL generated from the user's VisualQueryConfig (pre-security) */
  userSql: string;

  // ─── What actually ran on the server ─────────────────────────────
  /** Final SQL executed against the data source, after RLS injection */
  executedSql: string;
  /** True when executedSql differs from userSql (RLS modified the query) */
  wasModified: boolean;

  // ─── Security layer breakdown ────────────────────────────────────
  appliedPolicies: AppliedPolicyInfo[];
  maskedColumns: MaskedColumnInfo[];
  accessLevel: 'FULL' | 'FILTERED' | 'NONE';
  /** Identity + attributes the RLS engine saw for this request */
  securityContext: {
    userId: string;
    userRole: string;
    department?: string;
    region?: string;
    hasFinancialAccess: boolean;
    hasPiiAccess: boolean;
  };

  // ─── Execution metadata ──────────────────────────────────────────
  /** Which backend actually answered — real Snowflake or sample data */
  dataSource: 'snowflake' | 'sample';
  /** Served from Redis cache vs. freshly executed */
  fromCache: boolean;
  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
  /** Rows returned after RLS + masking */
  rowCount: number;
  /** Source identifier the query ran against (e.g. "mrr_by_month") */
  source: string;
  /** Row limit that was enforced (post-cap) */
  rowLimit: number;
  /** ISO timestamp when the query ran (server clock) */
  executedAt: string;
  /**
   * Features that could not be evaluated in the current backend. Only ever
   * populated in sample-data mode — the JS evaluator does not support JOINs
   * or custom formulas. Empty when running against Snowflake.
   */
  skippedFeatures?: string[];
}

export interface AppliedPolicyInfo {
  id: string;
  name: string;
  description: string;
  /** Substituted SQL condition that was injected into the WHERE clause */
  resolvedCondition: string;
  priority: number;
}

export interface MaskedColumnInfo {
  /** Column name in the result set */
  column: string;
  /** Sensitivity level that triggered masking (e.g. PII, FINANCIAL) */
  sensitivityLevel: string;
  /** Which masking rule applied (FULL_MASK, PARTIAL_MASK, HASH, REDACT, NULL) */
  maskingType: string;
}

export interface SchemaInfo {
  tables: TableConfig[];
  relationships: SchemaRelationship[];
}

export interface SchemaRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationshipType: 'one_to_one' | 'one_to_many' | 'many_to_many';
}

// Formula function definitions for the reference panel
export interface FormulaFunction {
  name: string;
  category: 'math' | 'text' | 'date' | 'logical' | 'aggregate';
  description: string;
  syntax: string;
  examples: string[];
  returnType: 'text' | 'number' | 'date' | 'boolean';
}

// Drag and drop types
export interface DragItem {
  type: 'column' | 'table' | 'formula';
  data: ColumnMetadata | TableConfig | FormulaField;
}

export interface DropZoneConfig {
  accepts: ('column' | 'table' | 'formula')[];
  onDrop: (item: DragItem) => void;
  isActive?: boolean;
}

// UI state for the query builder
export interface VisualQueryBuilderState {
  selectedTable?: string;
  showSqlPreview: boolean;
  showFormulaReference: boolean;
  isExecuting: boolean;
  results?: QueryExecutionResult;
  lastExecutedQuery?: VisualQueryConfig;
}