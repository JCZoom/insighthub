'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Table, Search, Sparkles, Key, Link } from 'lucide-react';
import type { TableConfig, ColumnMetadata, DragItem } from '@/types/visual-query';
import { Tooltip } from '@/components/ui/Tooltip';

interface ColumnPickerProps {
  schema: TableConfig[];
  onColumnSelect: (column: ColumnMetadata) => void;
  selectedColumns: ColumnMetadata[];
  className?: string;
}

interface GroupedColumn extends ColumnMetadata {
  tableName: string;
}

export const ColumnPicker: React.FC<ColumnPickerProps> = ({
  schema,
  onColumnSelect,
  selectedColumns,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);

  // Auto-expand first table on mount
  useEffect(() => {
    if (schema.length > 0 && expandedTables.size === 0) {
      setExpandedTables(new Set([schema[0].name]));
    }
  }, [schema, expandedTables.size]);

  const filteredColumns = React.useMemo(() => {
    const allColumns: GroupedColumn[] = [];

    schema.forEach(table => {
      table.columns.forEach(column => {
        allColumns.push({ ...column, tableName: table.name });
      });
    });

    if (!searchTerm) return allColumns;

    return allColumns.filter(column =>
      column.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [schema, searchTerm]);

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, column: ColumnMetadata) => {
    const dragData: DragItem = {
      type: 'column',
      data: column
    };
    setDraggedItem(dragData);
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const getColumnTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return 'Aa';
      case 'number':
        return '#';
      case 'date':
        return '📅';
      case 'boolean':
        return '✓';
      case 'json':
        return '{}';
      default:
        return '?';
    }
  };

  const getColumnTypeColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'text-blue-400';
      case 'number':
        return 'text-green-400';
      case 'date':
        return 'text-purple-400';
      case 'boolean':
        return 'text-amber-400';
      case 'json':
        return 'text-cyan-400';
      default:
        return 'text-gray-400';
    }
  };

  const isColumnSelected = (column: ColumnMetadata) => {
    return selectedColumns.some(selected =>
      selected.name === column.name && selected.table === column.table
    );
  };

  const renderColumn = (column: GroupedColumn, isInSearch: boolean = false) => {
    const isSelected = isColumnSelected(column);
    const isDragging = draggedItem?.type === 'column' &&
                     (draggedItem.data as ColumnMetadata).name === column.name &&
                     (draggedItem.data as ColumnMetadata).table === column.table;

    return (
      <div
        key={`${column.tableName}.${column.name}`}
        className={`
          group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200
          hover:bg-card-hover border border-transparent
          ${isSelected ? 'bg-accent-blue/10 border-accent-blue/30' : ''}
          ${isDragging ? 'opacity-50 scale-95' : ''}
        `}
        draggable
        onDragStart={(e) => handleDragStart(e, column)}
        onDragEnd={handleDragEnd}
        onClick={() => onColumnSelect(column)}
      >
        {/* Type indicator */}
        <span className={`text-xs font-mono w-6 text-center ${getColumnTypeColor(column.type)}`}>
          {getColumnTypeIcon(column.type)}
        </span>

        {/* Column info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isInSearch && (
              <span className="text-xs text-muted opacity-75">{column.tableName}.</span>
            )}
            <span className="font-medium text-sm truncate">
              {column.displayName || column.name}
            </span>

            {/* Special indicators */}
            <div className="flex items-center gap-1">
              {column.isPrimaryKey && (
                <Tooltip content="Primary Key">
                  <span><Key className="w-3 h-3 text-amber-400" /></span>
                </Tooltip>
              )}
              {column.isForeignKey && (
                <Tooltip content="Foreign Key">
                  <span><Link className="w-3 h-3 text-cyan-400" /></span>
                </Tooltip>
              )}
              {column.isGlossaryLinked && (
                <Tooltip content="Glossary Term">
                  <span><Sparkles className="w-3 h-3 text-accent-green" /></span>
                </Tooltip>
              )}
            </div>
          </div>

          {column.description && (
            <div className="text-xs text-muted truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {column.description}
            </div>
          )}
        </div>

        {/* Drag indicator */}
        <div className="text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          Drag
        </div>
      </div>
    );
  };

  const renderTableSection = (table: TableConfig) => {
    const isExpanded = expandedTables.has(table.name);
    const tableColumns = table.columns;

    return (
      <div key={table.name} className="mb-1">
        {/* Table header */}
        <div
          className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-card-hover cursor-pointer group"
          onClick={() => toggleTable(table.name)}
        >
          <div className="flex items-center gap-1 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted" />
            )}
            <Table className="w-4 h-4 text-muted" />
            <span className="font-medium text-sm">{table.alias || table.name}</span>
            <span className="text-xs text-muted">({tableColumns.length} columns)</span>
          </div>
        </div>

        {/* Table columns */}
        {isExpanded && (
          <div className="ml-4 space-y-1">
            {tableColumns.map(column =>
              renderColumn({ ...column, tableName: table.name })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-lg border border-border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm mb-3">Data Sources</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {searchTerm ? (
          // Search results view
          <div className="space-y-1">
            {filteredColumns.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">
                No columns found matching "{searchTerm}"
              </div>
            ) : (
              filteredColumns.map(column =>
                renderColumn(column, true)
              )
            )}
          </div>
        ) : (
          // Table tree view
          <div className="space-y-1">
            {schema.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">
                No data sources available
              </div>
            ) : (
              schema.map(table => renderTableSection(table))
            )}
          </div>
        )}
      </div>

      {/* Footer with help */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted">
          💡 Drag columns to the query canvas or click to select
        </div>
      </div>
    </div>
  );
};

export default ColumnPicker;