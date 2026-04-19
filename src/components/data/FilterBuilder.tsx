'use client';

import React, { useState } from 'react';
import { X, Plus, Calendar, ChevronDown, Filter } from 'lucide-react';
import type { VisualFilter, ColumnMetadata, FilterOperation, FilterValue } from '@/types/visual-query';
import { Tooltip } from '@/components/ui/Tooltip';

interface FilterBuilderProps {
  filters: VisualFilter[];
  availableColumns: ColumnMetadata[];
  onChange: (filters: VisualFilter[]) => void;
  className?: string;
}

interface FilterOperationConfig {
  value: FilterOperation;
  label: string;
  supportsValue: boolean;
  supportedTypes: ('text' | 'number' | 'date' | 'boolean')[];
}

const FILTER_OPERATIONS: FilterOperationConfig[] = [
  { value: 'equals', label: 'equals', supportsValue: true, supportedTypes: ['text', 'number', 'date', 'boolean'] },
  { value: 'not_equals', label: 'does not equal', supportsValue: true, supportedTypes: ['text', 'number', 'date', 'boolean'] },
  { value: 'greater_than', label: 'greater than', supportsValue: true, supportedTypes: ['number', 'date'] },
  { value: 'greater_than_or_equal', label: 'greater than or equal', supportsValue: true, supportedTypes: ['number', 'date'] },
  { value: 'less_than', label: 'less than', supportsValue: true, supportedTypes: ['number', 'date'] },
  { value: 'less_than_or_equal', label: 'less than or equal', supportsValue: true, supportedTypes: ['number', 'date'] },
  { value: 'contains', label: 'contains', supportsValue: true, supportedTypes: ['text'] },
  { value: 'not_contains', label: 'does not contain', supportsValue: true, supportedTypes: ['text'] },
  { value: 'starts_with', label: 'starts with', supportsValue: true, supportedTypes: ['text'] },
  { value: 'ends_with', label: 'ends with', supportsValue: true, supportedTypes: ['text'] },
  { value: 'is_null', label: 'is empty', supportsValue: false, supportedTypes: ['text', 'number', 'date', 'boolean'] },
  { value: 'is_not_null', label: 'is not empty', supportsValue: false, supportedTypes: ['text', 'number', 'date', 'boolean'] },
  { value: 'in', label: 'is one of', supportsValue: true, supportedTypes: ['text', 'number'] },
  { value: 'not_in', label: 'is not one of', supportsValue: true, supportedTypes: ['text', 'number'] },
  { value: 'between', label: 'is between', supportsValue: true, supportedTypes: ['number', 'date'] },
  { value: 'date_range', label: 'date range', supportsValue: true, supportedTypes: ['date'] }
];

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filters,
  availableColumns,
  onChange,
  className = ''
}) => {
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addFilter = () => {
    const newFilter: VisualFilter = {
      id: generateId(),
      column: availableColumns[0],
      operation: 'equals',
      value: '',
      logicalOperator: filters.length > 0 ? 'AND' : undefined
    };
    onChange([...filters, newFilter]);
  };

  const removeFilter = (filterId: string) => {
    const newFilters = filters.filter(f => f.id !== filterId);
    // Remove logical operator from first filter if it exists
    if (newFilters.length > 0 && newFilters[0].logicalOperator) {
      newFilters[0].logicalOperator = undefined;
    }
    onChange(newFilters);
  };

  const updateFilter = (filterId: string, updates: Partial<VisualFilter>) => {
    onChange(filters.map(filter =>
      filter.id === filterId ? { ...filter, ...updates } : filter
    ));
  };

  const getAvailableOperations = (columnType: string): FilterOperationConfig[] => {
    return FILTER_OPERATIONS.filter(op =>
      op.supportedTypes.includes(columnType as any)
    );
  };

  const renderValueInput = (filter: VisualFilter) => {
    const operation = FILTER_OPERATIONS.find(op => op.value === filter.operation);
    if (!operation?.supportsValue) return null;

    const handleValueChange = (value: FilterValue) => {
      updateFilter(filter.id, { value });
    };

    switch (filter.column.type) {
      case 'text':
        if (filter.operation === 'in' || filter.operation === 'not_in') {
          return (
            <input
              type="text"
              placeholder="value1, value2, value3"
              value={Array.isArray(filter.value) ? filter.value.join(', ') : ''}
              onChange={(e) => handleValueChange(e.target.value.split(',').map(v => v.trim()))}
              className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
            />
          );
        }
        return (
          <input
            type="text"
            placeholder="Enter text value"
            value={filter.value as string || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        );

      case 'number':
        if (filter.operation === 'in' || filter.operation === 'not_in') {
          return (
            <input
              type="text"
              placeholder="1, 2, 3"
              value={Array.isArray(filter.value) ? filter.value.join(', ') : ''}
              onChange={(e) => handleValueChange(e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v)))}
              className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
            />
          );
        }
        if (filter.operation === 'between') {
          const rangeValue = filter.value as { start: number; end: number } || { start: 0, end: 0 };
          return (
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={rangeValue.start || ''}
                onChange={(e) => handleValueChange({ ...rangeValue, start: parseFloat(e.target.value) || 0 })}
                className="w-20 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
              />
              <span className="text-muted">and</span>
              <input
                type="number"
                placeholder="Max"
                value={rangeValue.end || ''}
                onChange={(e) => handleValueChange({ ...rangeValue, end: parseFloat(e.target.value) || 0 })}
                className="w-20 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
              />
            </div>
          );
        }
        return (
          <input
            type="number"
            placeholder="Enter number"
            value={filter.value as number || ''}
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        );

      case 'date':
        if (filter.operation === 'between' || filter.operation === 'date_range') {
          const rangeValue = filter.value as { start: string; end: string } || { start: '', end: '' };
          return (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={rangeValue.start || ''}
                onChange={(e) => handleValueChange({ ...rangeValue, start: e.target.value })}
                className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
              />
              <span className="text-muted">to</span>
              <input
                type="date"
                value={rangeValue.end || ''}
                onChange={(e) => handleValueChange({ ...rangeValue, end: e.target.value })}
                className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
              />
            </div>
          );
        }
        return (
          <input
            type="date"
            value={filter.value as string || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        );

      case 'boolean':
        return (
          <select
            value={filter.value as string || 'true'}
            onChange={(e) => handleValueChange(e.target.value === 'true')}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      default:
        return (
          <input
            type="text"
            placeholder="Enter value"
            value={filter.value as string || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        );
    }
  };

  const renderFilterRow = (filter: VisualFilter, index: number) => {
    const availableOperations = getAvailableOperations(filter.column.type);

    return (
      <div key={filter.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
        {/* Logical operator (AND/OR) */}
        {index > 0 && (
          <select
            value={filter.logicalOperator || 'AND'}
            onChange={(e) => updateFilter(filter.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
            className="w-16 px-2 py-1 text-xs bg-card border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        )}

        {/* Column selector */}
        <div className="relative">
          <select
            value={`${filter.column.table}.${filter.column.name}`}
            onChange={(e) => {
              const [table, columnName] = e.target.value.split('.');
              const column = availableColumns.find(c => c.table === table && c.name === columnName);
              if (column) {
                // Reset operation when changing column type
                const newOperations = getAvailableOperations(column.type);
                const currentOpSupported = newOperations.find(op => op.value === filter.operation);
                updateFilter(filter.id, {
                  column,
                  operation: currentOpSupported ? filter.operation : newOperations[0].value,
                  value: ''
                });
              }
            }}
            className="min-w-32 px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50 appearance-none"
          >
            {availableColumns.map(column => (
              <option key={`${column.table}.${column.name}`} value={`${column.table}.${column.name}`}>
                {column.displayName || column.name} ({column.table})
              </option>
            ))}
          </select>
        </div>

        {/* Operation selector */}
        <div className="relative">
          <select
            value={filter.operation}
            onChange={(e) => updateFilter(filter.id, { operation: e.target.value as FilterOperation, value: '' })}
            className="min-w-32 px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50 appearance-none"
          >
            {availableOperations.map(op => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value input */}
        <div className="flex-1">
          {renderValueInput(filter)}
        </div>

        {/* Remove button */}
        <Tooltip content="Remove filter">
          <button
            onClick={() => removeFilter(filter.id)}
            className="p-2 text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <span className="font-medium text-sm">Filters</span>
          {filters.length > 0 && (
            <span className="text-xs text-muted">({filters.length})</span>
          )}
        </div>
        <button
          onClick={addFilter}
          className="flex items-center gap-1 px-3 py-1 text-sm text-accent-blue hover:bg-accent-blue/10 rounded-md transition-colors"
          disabled={availableColumns.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Filter
        </button>
      </div>

      {filters.length === 0 ? (
        <div className="text-center text-muted text-sm py-8 border-2 border-dashed border-border rounded-lg">
          {availableColumns.length === 0
            ? "Add columns to the query to create filters"
            : "No filters applied. Click 'Add Filter' to filter your data."
          }
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, index) => renderFilterRow(filter, index))}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;