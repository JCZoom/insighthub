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