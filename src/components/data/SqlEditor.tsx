'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, Copy, Save, Download, Upload, Loader2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => Promise<void>;
  isExecuting?: boolean;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  enableSyntaxHighlighting?: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  isExecuting = false,
  placeholder = 'Write your SQL query here...',
  className = '',
  readOnly = false,
  showLineNumbers = true,
  enableSyntaxHighlighting = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // SQL keywords for basic syntax highlighting
  const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
    'UNION', 'UNION ALL', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
    'ALTER', 'DROP', 'INDEX', 'TABLE', 'DATABASE', 'VIEW',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'IS', 'NULL', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
    'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
  ];

  // Update line count when value changes
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(lines);
  }, [value]);

  // Handle textarea changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onExecute) {
      e.preventDefault();
      if (!isExecuting) {
        onExecute();
      }
    }

    // Tab to insert 2 spaces (better for SQL formatting)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Shift+Tab to remove indentation
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineText = value.substring(lineStart, start);

      if (lineText.startsWith('  ')) {
        const newValue = value.substring(0, lineStart) + lineText.substring(2) + value.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start - 2;
        }, 0);
      }
    }
  }, [value, onChange, onExecute, isExecuting]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [value]);

  // Simple syntax highlighting (basic implementation)
  const highlightedValue = enableSyntaxHighlighting ?
    value.replace(
      new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi'),
      '<span class="text-accent-blue font-semibold">$1</span>'
    ) : value;

  return (
    <div className={`relative border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)] ${className}`}>
      {/* Header with actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">SQL Editor</span>
          {showLineNumbers && (
            <span className="text-xs text-[var(--text-muted)]">{lineCount} lines</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Copy to clipboard">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Copy className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          </Tooltip>
          {onExecute && (
            <Tooltip content="Execute query" shortcut={['mod', 'enter']}>
              <button
                onClick={onExecute}
                disabled={isExecuting || !value.trim()}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-accent-blue text-white text-xs font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Run
                  </>
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative">
        {showLineNumbers && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-[var(--bg-card)]/50 border-r border-[var(--border-color)] flex flex-col text-xs text-[var(--text-muted)] font-mono">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="px-2 py-1 text-right select-none">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          {/* Syntax highlighting overlay (hidden, used for reference) */}
          {enableSyntaxHighlighting && (
            <div
              className="absolute inset-0 pointer-events-none opacity-0"
              style={{
                padding: showLineNumbers ? '8px 12px 8px 52px' : '8px 12px',
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: highlightedValue }}
            />
          )}

          {/* Actual textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            className="w-full resize-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-mono text-sm leading-6"
            style={{
              padding: showLineNumbers ? '8px 12px 8px 52px' : '8px 12px',
              minHeight: '200px',
              maxHeight: '600px',
              overflow: 'auto'
            }}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Footer with shortcuts hint */}
      <div className="px-3 py-2 border-t border-[var(--border-color)] bg-[var(--bg-card)]/30">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>
            {onExecute && 'Ctrl/Cmd + Enter to execute • '}
            Tab to indent • Shift+Tab to unindent
          </span>
          <span className="font-mono">{value.length} characters</span>
        </div>
      </div>
    </div>
  );
};