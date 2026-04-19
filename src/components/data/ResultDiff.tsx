'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Plus, Minus, Edit, Info, Download } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  QueryResults,
  ResultComparison,
  ResultDifference,
  ComparisonSummary
} from '@/types/playground';

interface ResultDiffProps {
  leftResults: QueryResults;
  rightResults: QueryResults;
  leftTitle?: string;
  rightTitle?: string;
  onClose?: () => void;
}

interface DiffRowProps {
  leftRow?: Record<string, unknown>;
  rightRow?: Record<string, unknown>;
  columns: string[];
  rowIndex: number;
  differences: ResultDifference[];
  diffType: 'added' | 'removed' | 'modified' | 'unchanged';
}

function DiffRow({ leftRow, rightRow, columns, rowIndex, differences, diffType }: DiffRowProps) {
  const getColumnDiff = (column: string) => {
    return differences.find(diff => diff.rowIndex === rowIndex && diff.column === column);
  };

  const getCellStyle = (column: string, side: 'left' | 'right') => {
    const diff = getColumnDiff(column);
    if (!diff) {
      if (diffType === 'added') return side === 'left' ? 'bg-transparent' : 'bg-green-500/10';
      if (diffType === 'removed') return side === 'left' ? 'bg-red-500/10' : 'bg-transparent';
      return 'bg-transparent';
    }

    if (diff.type === 'modified') {
      return side === 'left' ? 'bg-red-500/10' : 'bg-green-500/10';
    }

    return 'bg-transparent';
  };

  return (
    <tr className={`border-b border-[var(--border-color)] ${diffType === 'unchanged' ? 'hover:bg-[var(--bg-card-hover)]' : ''}`}>
      {/* Row number/status */}
      <td className="px-3 py-2 text-xs text-[var(--text-muted)] border-r border-[var(--border-color)] sticky left-0 bg-[var(--bg-card)]">
        <div className="flex items-center gap-1">
          <span>{rowIndex + 1}</span>
          {diffType === 'added' && <Plus className="w-3 h-3 text-green-500" />}
          {diffType === 'removed' && <Minus className="w-3 h-3 text-red-500" />}
          {diffType === 'modified' && <Edit className="w-3 h-3 text-amber-500" />}
        </div>
      </td>

      {/* Left side values */}
      {columns.map(column => (
        <td
          key={`left-${column}`}
          className={`px-3 py-2 text-xs font-mono border-r border-[var(--border-color)] ${getCellStyle(column, 'left')}`}
        >
          {leftRow ? String(leftRow[column] ?? '') : '—'}
        </td>
      ))}

      {/* Right side values */}
      {columns.map(column => (
        <td
          key={`right-${column}`}
          className={`px-3 py-2 text-xs font-mono ${getCellStyle(column, 'right')}`}
        >
          {rightRow ? String(rightRow[column] ?? '') : '—'}
        </td>
      ))}
    </tr>
  );
}

function compareResults(leftResults: QueryResults, rightResults: QueryResults): ResultComparison {
  const differences: ResultDifference[] = [];
  const leftData = leftResults.data;
  const rightData = rightResults.data;
  const leftColumns = new Set(leftResults.columns);
  const rightColumns = new Set(rightResults.columns);

  // Check for schema differences
  const allColumns = [...leftColumns, ...rightColumns];
  const addedColumns = rightResults.columns.filter(col => !leftColumns.has(col));
  const removedColumns = leftResults.columns.filter(col => !rightColumns.has(col));

  addedColumns.forEach(column => {
    differences.push({
      type: 'schema_change',
      column,
      details: `Column '${column}' added in right result`
    });
  });

  removedColumns.forEach(column => {
    differences.push({
      type: 'schema_change',
      column,
      details: `Column '${column}' removed in right result`
    });
  });

  // Create row hashes for comparison
  const leftHashes = new Map<string, number>();
  const rightHashes = new Map<string, number>();

  leftData.forEach((row, index) => {
    const hash = JSON.stringify(row);
    leftHashes.set(hash, index);
  });

  rightData.forEach((row, index) => {
    const hash = JSON.stringify(row);
    rightHashes.set(hash, index);
  });

  // Track processed rows
  const processedLeft = new Set<number>();
  const processedRight = new Set<number>();

  // Find exact matches
  leftHashes.forEach((leftIndex, hash) => {
    if (rightHashes.has(hash)) {
      processedLeft.add(leftIndex);
      processedRight.add(rightHashes.get(hash)!);
    }
  });

  // Find modified rows (same position, different values)
  const maxRows = Math.max(leftData.length, rightData.length);
  for (let i = 0; i < maxRows; i++) {
    const leftRow = leftData[i];
    const rightRow = rightData[i];

    if (!processedLeft.has(i) && !processedRight.has(i) && leftRow && rightRow) {
      // Check if rows are similar (might be modified)
      const commonColumns = allColumns.filter(col => leftColumns.has(col) && rightColumns.has(col));
      let modifiedColumns: string[] = [];

      commonColumns.forEach(column => {
        if (leftRow[column] !== rightRow[column]) {
          modifiedColumns.push(column);
          differences.push({
            type: 'modified',
            rowIndex: i,
            column,
            leftValue: leftRow[column],
            rightValue: rightRow[column]
          });
        }
      });

      if (modifiedColumns.length > 0) {
        processedLeft.add(i);
        processedRight.add(i);
      }
    }
  }

  // Find added rows (only in right)
  rightData.forEach((row, index) => {
    if (!processedRight.has(index)) {
      differences.push({
        type: 'added',
        rowIndex: index,
        details: 'Row added in right result'
      });
    }
  });

  // Find removed rows (only in left)
  leftData.forEach((row, index) => {
    if (!processedLeft.has(index)) {
      differences.push({
        type: 'removed',
        rowIndex: index,
        details: 'Row removed in right result'
      });
    }
  });

  const summary: ComparisonSummary = {
    totalRows: { left: leftData.length, right: rightData.length },
    addedRows: differences.filter(d => d.type === 'added').length,
    removedRows: differences.filter(d => d.type === 'removed').length,
    modifiedRows: new Set(differences.filter(d => d.type === 'modified').map(d => d.rowIndex)).size,
    schemaChanges: differences.filter(d => d.type === 'schema_change').length,
    matchPercentage: Math.round(
      ((maxRows - differences.filter(d => d.type === 'added' || d.type === 'removed').length) / maxRows) * 100
    ) || 0
  };

  return {
    leftResults,
    rightResults,
    differences,
    summary
  };
}

export function ResultDiff({ leftResults, rightResults, leftTitle = 'Left Query', rightTitle = 'Right Query', onClose }: ResultDiffProps) {
  const [diffMode, setDiffMode] = useState<'all' | 'differences' | 'schema'>('all');
  const [showSummary, setShowSummary] = useState(true);

  const comparison = useMemo(() => {
    return compareResults(leftResults, rightResults);
  }, [leftResults, rightResults]);

  const allColumns = useMemo(() => {
    const leftCols = new Set(leftResults.columns);
    const rightCols = new Set(rightResults.columns);
    return [...new Set([...leftResults.columns, ...rightResults.columns])];
  }, [leftResults.columns, rightResults.columns]);

  const processedRows = useMemo(() => {
    const maxRows = Math.max(leftResults.data.length, rightResults.data.length);
    const rows: Array<{
      leftRow?: Record<string, unknown>;
      rightRow?: Record<string, unknown>;
      rowIndex: number;
      diffType: 'added' | 'removed' | 'modified' | 'unchanged';
    }> = [];

    // Track which rows have differences
    const diffRows = new Set(comparison.differences.filter(d => d.rowIndex !== undefined).map(d => d.rowIndex));

    for (let i = 0; i < maxRows; i++) {
      const leftRow = leftResults.data[i];
      const rightRow = rightResults.data[i];

      let diffType: 'added' | 'removed' | 'modified' | 'unchanged';
      if (!leftRow && rightRow) {
        diffType = 'added';
      } else if (leftRow && !rightRow) {
        diffType = 'removed';
      } else if (diffRows.has(i)) {
        diffType = 'modified';
      } else {
        diffType = 'unchanged';
      }

      // Filter based on diff mode
      if (diffMode === 'differences' && diffType === 'unchanged') {
        continue;
      }

      rows.push({ leftRow, rightRow, rowIndex: i, diffType });
    }

    return rows;
  }, [leftResults.data, rightResults.data, comparison.differences, diffMode]);

  const exportComparison = () => {
    const data = {
      comparison: {
        leftTitle,
        rightTitle,
        summary: comparison.summary,
        differences: comparison.differences
      },
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query-comparison-${new Date().toISOString().slice(0, 16).replace(/[:-]/g, '')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Query Results Comparison</h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 rounded-full">{leftTitle}</span>
              <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="px-3 py-1 text-xs bg-purple-500/10 text-purple-400 rounded-full">{rightTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border border-[var(--border-color)] rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => setDiffMode('all')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  diffMode === 'all'
                    ? 'bg-accent-blue text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                All Rows
              </button>
              <button
                onClick={() => setDiffMode('differences')}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-[var(--border-color)] ${
                  diffMode === 'differences'
                    ? 'bg-accent-blue text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                Differences Only
              </button>
            </div>

            <Tooltip content="Toggle Summary">
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg"
              >
                <Info className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content="Export Comparison">
              <button
                onClick={exportComparison}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg"
              >
                <Download className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Summary */}
        {showSummary && (
          <div className="mt-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{comparison.summary.matchPercentage}%</div>
                <div className="text-xs text-[var(--text-muted)]">Match</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{comparison.summary.addedRows}</div>
                <div className="text-xs text-[var(--text-muted)]">Added</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{comparison.summary.removedRows}</div>
                <div className="text-xs text-[var(--text-muted)]">Removed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-500">{comparison.summary.modifiedRows}</div>
                <div className="text-xs text-[var(--text-muted)]">Modified</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{comparison.summary.totalRows.left}</div>
                <div className="text-xs text-[var(--text-muted)]">Left Rows</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{comparison.summary.totalRows.right}</div>
                <div className="text-xs text-[var(--text-muted)]">Right Rows</div>
              </div>
            </div>

            {comparison.summary.schemaChanges > 0 && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-center">
                <span className="text-sm text-amber-400 font-medium">
                  {comparison.summary.schemaChanges} schema change{comparison.summary.schemaChanges !== 1 ? 's' : ''} detected
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          {/* Header */}
          <thead className="sticky top-0 bg-[var(--bg-card)] border-b-2 border-[var(--border-color)]">
            <tr>
              {/* Row number header */}
              <th className="px-3 py-3 text-left font-semibold border-r border-[var(--border-color)] sticky left-0 bg-[var(--bg-card)] z-10">
                #
              </th>

              {/* Left side headers */}
              <th colSpan={allColumns.length} className="px-3 py-3 text-center font-semibold border-r border-[var(--border-color)] bg-blue-500/10">
                {leftTitle} ({leftResults.columns.length} columns, {leftResults.data.length} rows)
              </th>

              {/* Right side headers */}
              <th colSpan={allColumns.length} className="px-3 py-3 text-center font-semibold bg-purple-500/10">
                {rightTitle} ({rightResults.columns.length} columns, {rightResults.data.length} rows)
              </th>
            </tr>

            <tr>
              <th className="sticky left-0 bg-[var(--bg-card)] border-r border-[var(--border-color)]"></th>

              {/* Left column headers */}
              {allColumns.map(column => (
                <th
                  key={`left-header-${column}`}
                  className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] border-r border-[var(--border-color)] bg-blue-500/5"
                >
                  <div className="flex items-center gap-1">
                    <span>{column}</span>
                    {!leftResults.columns.includes(column) && (
                      <Tooltip content="Column missing in left result"><span>
                        <Minus className="w-3 h-3 text-red-500" />
                      </span></Tooltip>
                    )}
                  </div>
                </th>
              ))}

              {/* Right column headers */}
              {allColumns.map(column => (
                <th
                  key={`right-header-${column}`}
                  className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] bg-purple-500/5"
                >
                  <div className="flex items-center gap-1">
                    <span>{column}</span>
                    {!rightResults.columns.includes(column) && (
                      <Tooltip content="Column added in right result"><span>
                        <Plus className="w-3 h-3 text-green-500" />
                      </span></Tooltip>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {processedRows.map(({ leftRow, rightRow, rowIndex, diffType }) => (
              <DiffRow
                key={rowIndex}
                leftRow={leftRow}
                rightRow={rightRow}
                columns={allColumns}
                rowIndex={rowIndex}
                differences={comparison.differences}
                diffType={diffType}
              />
            ))}
          </tbody>
        </table>

        {processedRows.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Info className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                {diffMode === 'differences' ? 'No Differences Found' : 'No Data to Compare'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {diffMode === 'differences'
                  ? 'The query results are identical.'
                  : 'Both query results are empty.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}