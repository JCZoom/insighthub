'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Lightbulb, Database, Calculator, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import type { WidgetConfig } from '@/types';
import { Tooltip } from '@/components/ui/Tooltip';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  formula?: string;
  category: string;
  examples?: string;
  dataSource?: string;
}

interface MetricExplanationModalProps {
  widget: WidgetConfig;
  onClose: () => void;
}

export function MetricExplanationModal({ widget, onClose }: MetricExplanationModalProps) {
  const [explanation, setExplanation] = useState<string>('');
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuery, setShowQuery] = useState(false);
  const [isPowerUser, setIsPowerUser] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch user role (for dev mode, assume power user for demo)
        const isDev = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
        setIsPowerUser(isDev); // In production, you'd fetch actual user role

        // Fetch glossary terms if widget has glossaryTermIds
        if (widget.glossaryTermIds && widget.glossaryTermIds.length > 0) {
          setIsLoadingGlossary(true);
          try {
            const glossaryResponse = await fetch(`/api/glossary?ids=${widget.glossaryTermIds.join(',')}`);
            if (glossaryResponse.ok) {
              const glossaryData = await glossaryResponse.json();
              setGlossaryTerms(glossaryData.terms || []);
            }
          } catch (err) {
            console.warn('Failed to fetch glossary terms:', err);
          } finally {
            setIsLoadingGlossary(false);
          }
        }

        // Fetch AI explanation
        const response = await fetch('/api/widgets/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widget }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch explanation' }));
          throw new Error(errorData.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        setExplanation(data.explanation);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [widget]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[80vh] bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-[var(--border-color)]">
          <div className="p-2 rounded-lg bg-accent-purple/10">
            <Lightbulb size={20} className="text-accent-purple" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Metric Explanation
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {widget.title} • {widget.type.replace('_', ' ')}
            </p>
          </div>
          {isPowerUser && (
            <Tooltip content={showQuery ? 'Hide query details' : 'Show query details'}>
              <button
                onClick={() => setShowQuery(!showQuery)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                {showQuery ? (
                  <ToggleRight size={16} className="text-accent-cyan" />
                ) : (
                  <ToggleLeft size={16} className="text-[var(--text-muted)]" />
                )}
                <span className="text-xs text-[var(--text-secondary)]">Query</span>
              </button>
            </Tooltip>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-96">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-accent-purple" />
              <span className="ml-3 text-[var(--text-secondary)]">Analyzing metric...</span>
            </div>
          )}

          {error && (
            <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg p-4 text-center mx-6">
              <p className="text-accent-red font-medium">Failed to generate explanation</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Glossary Terms Section */}
              {glossaryTerms.length > 0 && (
                <div className="px-6 py-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen size={16} className="text-accent-blue" />
                    <h3 className="font-semibold text-[var(--text-primary)]">Glossary Definitions</h3>
                  </div>
                  <div className="space-y-4">
                    {glossaryTerms.map((term) => (
                      <div key={term.id} className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border-color)]">
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-md bg-accent-blue/10 mt-0.5">
                            <Database size={12} className="text-accent-blue" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[var(--text-primary)] mb-1">{term.term}</h4>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{term.definition}</p>

                            {term.formula && (
                              <div className="flex items-start gap-2 mb-2">
                                <Calculator size={14} className="text-accent-green mt-0.5" />
                                <div>
                                  <span className="text-xs font-medium text-accent-green">Formula:</span>
                                  <code className="ml-2 text-xs bg-[var(--bg-hover)] px-2 py-1 rounded text-[var(--text-primary)]">{term.formula}</code>
                                </div>
                              </div>
                            )}

                            {term.dataSource && (
                              <div className="flex items-center gap-2">
                                <Database size={14} className="text-accent-purple" />
                                <span className="text-xs text-[var(--text-muted)]">Source: {term.dataSource}</span>
                              </div>
                            )}

                            <div className="mt-2 text-xs text-[var(--text-muted)]">
                              Category: {term.category}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingGlossary && (
                <div className="px-6 py-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-accent-blue" />
                    <span className="text-sm text-[var(--text-secondary)]">Loading glossary definitions...</span>
                  </div>
                </div>
              )}

              {/* Power User Query Section */}
              {isPowerUser && showQuery && (
                <div className="px-6 py-4 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Database size={16} className="text-accent-cyan" />
                    <h3 className="font-semibold text-[var(--text-primary)]">Query Details</h3>
                  </div>
                  <div className="bg-[var(--bg-hover)] rounded-lg p-4 border border-[var(--border-color)]">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-[var(--text-secondary)]">Data Source:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{widget.dataConfig.source}</span>
                      </div>
                      {widget.dataConfig.aggregation && (
                        <div>
                          <span className="font-medium text-[var(--text-secondary)]">Aggregation:</span>
                          <span className="ml-2 text-[var(--text-primary)]">
                            {widget.dataConfig.aggregation.function}({widget.dataConfig.aggregation.field})
                          </span>
                        </div>
                      )}
                      {widget.dataConfig.groupBy && widget.dataConfig.groupBy.length > 0 && (
                        <div>
                          <span className="font-medium text-[var(--text-secondary)]">Group By:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{widget.dataConfig.groupBy.join(', ')}</span>
                        </div>
                      )}
                      {widget.dataConfig.filters && widget.dataConfig.filters.length > 0 && (
                        <div>
                          <span className="font-medium text-[var(--text-secondary)]">Filters:</span>
                          <code className="ml-2 text-xs bg-[var(--bg-primary)] px-2 py-1 rounded text-[var(--text-primary)]">
                            {JSON.stringify(widget.dataConfig.filters, null, 2)}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Explanation Section */}
              {explanation && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb size={16} className="text-accent-amber" />
                    <h3 className="font-semibold text-[var(--text-primary)]">AI Analysis</h3>
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-[var(--text-primary)] leading-relaxed
                      [&_strong]:text-[var(--text-primary)] [&_strong]:font-semibold
                      [&_em]:text-[var(--text-secondary)]
                      [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[var(--text-primary)] [&_h1]:mt-4 [&_h1]:mb-2
                      [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--text-primary)] [&_h2]:mt-3 [&_h2]:mb-2
                      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[var(--text-primary)] [&_h3]:mt-3 [&_h3]:mb-1
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-2
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-2
                      [&_li]:text-sm [&_li]:text-[var(--text-secondary)]
                      [&_code]:text-xs [&_code]:bg-[var(--bg-hover)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-accent-cyan
                      [&_p]:text-sm [&_p]:text-[var(--text-secondary)] [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: parseExplanationMarkdown(explanation) }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-b-2xl">
          <p className="text-xs text-[var(--text-muted)] text-center">
            {glossaryTerms.length > 0
              ? 'Glossary definitions are curated by data experts. AI analysis is generated and may need verification for critical business decisions.'
              : 'This explanation is generated by AI and may need verification for critical business decisions.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// Parse markdown-like text from AI responses into HTML
function parseExplanationMarkdown(text: string): string {
  // Normalize line endings and trim
  const lines = text.trim().split('\n');
  const html: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines (they just create paragraph breaks)
    if (line.trim() === '') {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h3>${inlineFmt(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h2>${inlineFmt(h2[1])}</h2>`); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h1>${inlineFmt(h1[1])}</h1>`); continue; }

    // Unordered list items (• or - or * at start)
    const ul = line.match(/^[•\-*]\s+(.*)/);
    if (ul) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inlineFmt(ul[1])}</li>`);
      continue;
    }

    // Ordered list items (1. 2. etc.)
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inlineFmt(ol[1])}</li>`);
      continue;
    }

    // Regular paragraph line
    if (inList) { html.push('</ul>'); inList = false; }
    html.push(`<p>${inlineFmt(line)}</p>`);
  }

  if (inList) html.push('</ul>');
  return html.join('');
}

// Inline formatting: bold, italic, code
function inlineFmt(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}