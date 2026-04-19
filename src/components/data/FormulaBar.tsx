'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calculator, BookOpen, X, Check, AlertCircle } from 'lucide-react';
import type { FormulaField, ColumnMetadata, FormulaFunction } from '@/types/visual-query';

interface FormulaBarProps {
  formula: FormulaField;
  availableColumns: ColumnMetadata[];
  onUpdate: (formula: FormulaField) => void;
  onDelete?: () => void;
  className?: string;
}

const FORMULA_FUNCTIONS: FormulaFunction[] = [
  {
    name: 'Sum',
    category: 'aggregate',
    description: 'Calculates the sum of numeric values',
    syntax: 'Sum([column])',
    examples: ['Sum([revenue])', 'Sum([quantity] * [price])'],
    returnType: 'number'
  },
  {
    name: 'Avg',
    category: 'aggregate',
    description: 'Calculates the average of numeric values',
    syntax: 'Avg([column])',
    examples: ['Avg([score])', 'Avg([revenue])'],
    returnType: 'number'
  },
  {
    name: 'Count',
    category: 'aggregate',
    description: 'Counts non-null values',
    syntax: 'Count([column])',
    examples: ['Count([customer_id])', 'Count(*)'],
    returnType: 'number'
  },
  {
    name: 'CountIf',
    category: 'aggregate',
    description: 'Counts values that meet a condition',
    syntax: 'CountIf([column], condition)',
    examples: ['CountIf([status], "active")', 'CountIf([revenue] > 1000)'],
    returnType: 'number'
  },
  {
    name: 'Max',
    category: 'aggregate',
    description: 'Returns the maximum value',
    syntax: 'Max([column])',
    examples: ['Max([date])', 'Max([revenue])'],
    returnType: 'number'
  },
  {
    name: 'Min',
    category: 'aggregate',
    description: 'Returns the minimum value',
    syntax: 'Min([column])',
    examples: ['Min([date])', 'Min([price])'],
    returnType: 'number'
  },
  {
    name: 'If',
    category: 'logical',
    description: 'Returns different values based on a condition',
    syntax: 'If(condition, value_if_true, value_if_false)',
    examples: ['If([revenue] > 1000, "High", "Low")', 'If([status] = "active", 1, 0)'],
    returnType: 'text'
  },
  {
    name: 'Contains',
    category: 'text',
    description: 'Checks if text contains a substring',
    syntax: 'Contains([column], "text")',
    examples: ['Contains([name], "Corp")', 'Contains([email], "@gmail")'],
    returnType: 'boolean'
  },
  {
    name: 'Length',
    category: 'text',
    description: 'Returns the length of text',
    syntax: 'Length([column])',
    examples: ['Length([name])', 'Length([description])'],
    returnType: 'number'
  },
  {
    name: 'Upper',
    category: 'text',
    description: 'Converts text to uppercase',
    syntax: 'Upper([column])',
    examples: ['Upper([name])', 'Upper([category])'],
    returnType: 'text'
  },
  {
    name: 'Lower',
    category: 'text',
    description: 'Converts text to lowercase',
    syntax: 'Lower([column])',
    examples: ['Lower([email])', 'Lower([status])'],
    returnType: 'text'
  },
  {
    name: 'DateDiff',
    category: 'date',
    description: 'Calculates difference between dates',
    syntax: 'DateDiff([date1], [date2], "unit")',
    examples: ['DateDiff([end_date], [start_date], "days")', 'DateDiff(Today(), [created_at], "months")'],
    returnType: 'number'
  },
  {
    name: 'Today',
    category: 'date',
    description: 'Returns the current date',
    syntax: 'Today()',
    examples: ['Today()', 'DateDiff(Today(), [created_at], "days")'],
    returnType: 'date'
  },
  {
    name: 'Year',
    category: 'date',
    description: 'Extracts the year from a date',
    syntax: 'Year([date_column])',
    examples: ['Year([created_at])', 'Year([order_date])'],
    returnType: 'number'
  },
  {
    name: 'Month',
    category: 'date',
    description: 'Extracts the month from a date',
    syntax: 'Month([date_column])',
    examples: ['Month([created_at])', 'Month([order_date])'],
    returnType: 'number'
  }
];

export const FormulaBar: React.FC<FormulaBarProps> = ({
  formula,
  availableColumns,
  onUpdate,
  onDelete,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(!formula.expression);
  const [showReference, setShowReference] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const validateFormula = (expression: string): string[] => {
    const errors: string[] = [];

    if (!expression.trim()) {
      errors.push('Formula expression cannot be empty');
      return errors;
    }

    // Basic syntax validation
    const bracketPattern = /\[([^\]]+)\]/g;
    const brackets = expression.match(bracketPattern);

    if (brackets) {
      brackets.forEach(bracket => {
        const columnName = bracket.slice(1, -1);
        // Check if it's a valid column
        const isValidColumn = availableColumns.some(col =>
          col.name === columnName || `${col.table}.${col.name}` === columnName
        );

        if (!isValidColumn && columnName !== '*') {
          errors.push(`Unknown column: ${columnName}`);
        }
      });
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of expression) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        errors.push('Unmatched closing parenthesis');
        break;
      }
    }
    if (parenCount > 0) {
      errors.push('Unmatched opening parenthesis');
    }

    return errors;
  };

  const handleExpressionChange = (expression: string) => {
    const validationErrors = validateFormula(expression);
    setErrors(validationErrors);

    onUpdate({
      ...formula,
      expression
    });
  };

  const handleNameChange = (name: string) => {
    onUpdate({
      ...formula,
      name
    });
  };

  const insertFunction = (func: FormulaFunction) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentExpression = formula.expression;

    const newExpression =
      currentExpression.slice(0, start) +
      func.syntax +
      currentExpression.slice(end);

    handleExpressionChange(newExpression);

    // Set cursor position after the inserted function
    setTimeout(() => {
      if (textarea) {
        const newPosition = start + func.syntax.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }
    }, 0);
  };

  const insertColumn = (column: ColumnMetadata) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentExpression = formula.expression;

    const columnRef = `[${column.table}.${column.name}]`;
    const newExpression =
      currentExpression.slice(0, start) +
      columnRef +
      currentExpression.slice(end);

    handleExpressionChange(newExpression);

    // Set cursor position after the inserted column
    setTimeout(() => {
      if (textarea) {
        const newPosition = start + columnRef.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }
    }, 0);
  };

  const filteredFunctions = FORMULA_FUNCTIONS.filter(func =>
    func.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    func.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    func.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredColumns = availableColumns.filter(col =>
    col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    col.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    col.table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const functionsByCategory = filteredFunctions.reduce((acc, func) => {
    if (!acc[func.category]) acc[func.category] = [];
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, FormulaFunction[]>);

  const hasErrors = errors.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted" />
          <span className="font-medium text-sm">Formula</span>
          {hasErrors && (
            <AlertCircle className="w-4 h-4 text-accent-red" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReference(!showReference)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-muted hover:text-foreground hover:bg-card-hover rounded-md transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Reference
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-sm text-accent-red hover:bg-accent-red/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Formula Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          ref={inputRef}
          type="text"
          value={formula.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Enter formula name..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
        />
      </div>

      {/* Formula Expression */}
      <div>
        <label className="block text-sm font-medium mb-1">Expression</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={formula.expression}
            onChange={(e) => handleExpressionChange(e.target.value)}
            placeholder="Enter formula expression... e.g., Sum([revenue])"
            className={`w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 resize-none ${
              hasErrors
                ? 'border-accent-red focus:ring-accent-red/50'
                : 'border-border focus:ring-accent-blue/50'
            }`}
            rows={3}
            spellCheck={false}
          />
        </div>

        {/* Validation Errors */}
        {hasErrors && (
          <div className="mt-2 space-y-1">
            {errors.map((error, index) => (
              <div key={index} className="text-sm text-accent-red flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference Panel */}
      {showReference && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Function Reference</h4>
            <button
              onClick={() => setShowReference(false)}
              className="p-1 text-muted hover:text-foreground rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search functions and columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue/50 mb-3"
          />

          <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto">
            {/* Functions */}
            <div>
              <h5 className="font-medium text-xs text-muted uppercase tracking-wide mb-2">Functions</h5>
              <div className="space-y-3">
                {Object.entries(functionsByCategory).map(([category, funcs]) => (
                  <div key={category}>
                    <h6 className="font-medium text-xs text-muted mb-1 capitalize">{category}</h6>
                    <div className="space-y-1">
                      {funcs.map(func => (
                        <div
                          key={func.name}
                          className="p-2 bg-background rounded border cursor-pointer hover:border-accent-blue/50"
                          onClick={() => insertFunction(func)}
                        >
                          <div className="font-mono text-sm text-accent-blue">{func.syntax}</div>
                          <div className="text-xs text-muted">{func.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columns */}
            <div>
              <h5 className="font-medium text-xs text-muted uppercase tracking-wide mb-2">Columns</h5>
              <div className="space-y-1">
                {filteredColumns.map(column => (
                  <div
                    key={`${column.table}.${column.name}`}
                    className="p-2 bg-background rounded border cursor-pointer hover:border-accent-blue/50"
                    onClick={() => insertColumn(column)}
                  >
                    <div className="font-mono text-sm text-accent-green">
                      [{column.table}.{column.name}]
                    </div>
                    <div className="text-xs text-muted">
                      {column.displayName || column.name} ({column.type})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaBar;