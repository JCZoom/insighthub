import type {
  VisualQueryConfig,
  VisualFilter,
  AggregationOperation,
  OrderByOperation,
  ColumnSelection,
  FilterOperation,
} from '@/types/visual-query';

export interface EvaluationResult {
  rows: Record<string, unknown>[];
  columns: string[];
  /** True when at least one stage was skipped because it's unsupported */
  skippedFeatures: string[];
}

/**
 * Evaluate a VisualQueryConfig over an in-memory row set.
 *
 * This is the sample-data-mode query engine. It mirrors the operations the
 * SQL generator produces (WHERE, GROUP BY, aggregations, SELECT projection,
 * ORDER BY, LIMIT) so the results the user sees actually match the SQL
 * shown in the audit panel.
 *
 * Not supported (reported via skippedFeatures):
 *   - JOINs across tables (sample data is flat per source)
 *   - Formula fields (require a safe expression evaluator; out of scope)
 *   - date_range / between on non-comparable values
 *
 * When Snowflake is connected, this evaluator is bypassed — the real SQL
 * engine handles all of the above correctly.
 */
export function evaluateVisualQueryOnSample(
  config: VisualQueryConfig,
  rawRows: Record<string, unknown>[]
): EvaluationResult {
  const skipped: string[] = [];

  // Snapshot, don't mutate the caller's array.
  let rows: Record<string, unknown>[] = [...rawRows];

  // ── 1. WHERE filters ─────────────────────────────────────────────
  if (config.filters.length > 0) {
    rows = rows.filter((row) => applyFilters(row, config.filters));
  }

  // ── 2. JOINs (unsupported in sample mode) ────────────────────────
  if (config.joins.length > 0) {
    skipped.push(
      `${config.joins.length} JOIN(s) — not evaluated in sample mode (single-table only). Connect Snowflake for multi-table queries.`
    );
  }

  // ── 3. Formulas (unsupported without a safe evaluator) ───────────
  if (config.formulas.length > 0) {
    skipped.push(
      `${config.formulas.length} formula(s) — not evaluated in sample mode (requires a safe expression evaluator). Connect Snowflake to use formulas.`
    );
  }

  // ── 4. GROUP BY + aggregations ───────────────────────────────────
  const hasAgg = config.aggregations.length > 0;
  const hasGroupBy = config.groupBy.length > 0;

  if (hasAgg || hasGroupBy) {
    rows = groupAndAggregate(
      rows,
      config.groupBy,
      config.aggregations,
      config.columns
    );
  } else {
    // Plain projection when there's no aggregation.
    rows = projectColumns(rows, config.columns);
  }

  // ── 5. ORDER BY ──────────────────────────────────────────────────
  if (config.orderBy.length > 0) {
    rows = [...rows].sort((a, b) => compareByOrder(a, b, config.orderBy));
  }

  // ── 6. LIMIT ─────────────────────────────────────────────────────
  if (typeof config.limit === 'number' && config.limit > 0) {
    rows = rows.slice(0, config.limit);
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : inferEmptyColumns(config);

  return { rows, columns, skippedFeatures: skipped };
}

// ───────────────────────────────────────────────────────────────────
// Filter evaluation
// ───────────────────────────────────────────────────────────────────

function applyFilters(
  row: Record<string, unknown>,
  filters: VisualFilter[]
): boolean {
  if (filters.length === 0) return true;

  // The first filter sets the initial verdict; subsequent filters combine via
  // their logicalOperator (AND/OR). This matches how buildWhereClause
  // concatenates them in the SQL generator.
  let result = evaluateFilter(row, filters[0]);

  for (let i = 1; i < filters.length; i++) {
    const f = filters[i];
    const v = evaluateFilter(row, f);
    if (f.logicalOperator === 'OR') {
      result = result || v;
    } else {
      result = result && v;
    }
  }

  return result;
}

function evaluateFilter(
  row: Record<string, unknown>,
  filter: VisualFilter
): boolean {
  const cell = row[filter.column.name];
  const op: FilterOperation = filter.operation;

  switch (op) {
    case 'equals':
      return looseEq(cell, filter.value);
    case 'not_equals':
      return !looseEq(cell, filter.value);
    case 'greater_than':
      return asNum(cell) > asNum(filter.value);
    case 'greater_than_or_equal':
      return asNum(cell) >= asNum(filter.value);
    case 'less_than':
      return asNum(cell) < asNum(filter.value);
    case 'less_than_or_equal':
      return asNum(cell) <= asNum(filter.value);
    case 'contains':
      return asStr(cell).toLowerCase().includes(asStr(filter.value).toLowerCase());
    case 'not_contains':
      return !asStr(cell).toLowerCase().includes(asStr(filter.value).toLowerCase());
    case 'starts_with':
      return asStr(cell).toLowerCase().startsWith(asStr(filter.value).toLowerCase());
    case 'ends_with':
      return asStr(cell).toLowerCase().endsWith(asStr(filter.value).toLowerCase());
    case 'is_null':
      return cell === null || cell === undefined;
    case 'is_not_null':
      return cell !== null && cell !== undefined;
    case 'in':
      return Array.isArray(filter.value)
        ? filter.value.some((v) => looseEq(cell, v))
        : false;
    case 'not_in':
      return Array.isArray(filter.value)
        ? !filter.value.some((v) => looseEq(cell, v))
        : true;
    case 'between':
    case 'date_range': {
      const rangeVal = filter.value as unknown;
      if (
        rangeVal &&
        typeof rangeVal === 'object' &&
        'start' in rangeVal &&
        'end' in rangeVal
      ) {
        const { start, end } = rangeVal as { start: unknown; end: unknown };
        const n = asNum(cell);
        return n >= asNum(start) && n <= asNum(end);
      }
      return false;
    }
    default:
      return true;
  }
}

// ───────────────────────────────────────────────────────────────────
// GROUP BY + aggregations
// ───────────────────────────────────────────────────────────────────

function groupAndAggregate(
  rows: Record<string, unknown>[],
  groupBy: string[],
  aggregations: AggregationOperation[],
  columnSelections: ColumnSelection[]
): Record<string, unknown>[] {
  // When there's no explicit group-by but there are aggregations, the whole
  // set becomes one group (SQL semantics: SELECT SUM(x) FROM t -> 1 row).
  const effectiveGroupBy = groupBy.length > 0 ? groupBy : [];

  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const key = effectiveGroupBy.length === 0
      ? '__all__'
      : effectiveGroupBy.map((g) => JSON.stringify(row[g] ?? null)).join('||');

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const out: Record<string, unknown>[] = [];

  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const record: Record<string, unknown> = {};

    // Include GROUP BY columns (and any visible non-aggregated columns the
    // user picked — SQL allows this if they're in GROUP BY; we just emit
    // the first row's value, which is correct when they *are* in GROUP BY).
    for (const key of effectiveGroupBy) {
      record[key] = first[key];
    }
    for (const sel of columnSelections) {
      if (!sel.isVisible) continue;
      const colName = sel.column.name;
      const alias = sel.alias || colName;
      // Only emit visible columns that were grouped — mirroring SQL behavior.
      if (effectiveGroupBy.includes(colName)) {
        record[alias] = first[colName];
      }
    }

    // Compute aggregations
    for (const agg of aggregations) {
      const alias = agg.alias || `${agg.function}_${agg.column.name}`;
      const values = groupRows.map((r) => r[agg.column.name]);
      record[alias] = applyAggregation(agg.function, values);
    }

    out.push(record);
  }

  return out;
}

function applyAggregation(
  fn: AggregationOperation['function'],
  values: unknown[]
): number | null {
  const nums = values
    .filter((v) => v !== null && v !== undefined)
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));

  switch (fn) {
    case 'count':
      return values.filter((v) => v !== null && v !== undefined).length;
    case 'count_distinct':
      return new Set(
        values.filter((v) => v !== null && v !== undefined).map((v) => JSON.stringify(v))
      ).size;
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return nums.length === 0 ? null : Math.min(...nums);
    case 'max':
      return nums.length === 0 ? null : Math.max(...nums);
    case 'median': {
      if (nums.length === 0) return null;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
    default:
      return null;
  }
}

// ───────────────────────────────────────────────────────────────────
// Projection + ordering
// ───────────────────────────────────────────────────────────────────

function projectColumns(
  rows: Record<string, unknown>[],
  columnSelections: ColumnSelection[]
): Record<string, unknown>[] {
  const visible = columnSelections.filter((c) => c.isVisible);

  // If the user hasn't picked anything, return rows as-is — matches SQL
  // generator's `SELECT *` fallback.
  if (visible.length === 0) return rows;

  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const sel of visible) {
      const key = sel.alias || sel.column.name;
      out[key] = row[sel.column.name];
    }
    return out;
  });
}

function compareByOrder(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  orderBy: OrderByOperation[]
): number {
  for (const ord of orderBy) {
    const colName = ord.column.name;
    const cmp = compareValues(a[colName], b[colName]);
    if (cmp !== 0) return ord.direction === 'desc' ? -cmp : cmp;
  }
  return 0;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function inferEmptyColumns(config: VisualQueryConfig): string[] {
  const cols: string[] = [];
  for (const g of config.groupBy) cols.push(g);
  for (const sel of config.columns) {
    if (sel.isVisible) cols.push(sel.alias || sel.column.name);
  }
  for (const agg of config.aggregations) {
    cols.push(agg.alias || `${agg.function}_${agg.column.name}`);
  }
  return cols;
}

// ───────────────────────────────────────────────────────────────────
// Coercion helpers
// ───────────────────────────────────────────────────────────────────

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  // Coerce numbers and strings so "5" === 5 in filter contexts.
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

function asNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}
