'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, BookOpen, X, Link2, Unlink2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  formula: string | null;
  category: string;
  examples: string | null;
  relatedTerms: string;
  dataSource: string | null;
}

interface GlossaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlossaryPanel({ isOpen, onClose }: GlossaryPanelProps) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { selectedWidgetId, schema, updateWidget } = useDashboardStore();
  const selectedWidget = schema.widgets.find(w => w.id === selectedWidgetId);
  const { toast } = useToast();

  // Fetch terms from API
  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (selectedCategory) params.set('category', selectedCategory);
      const res = await fetch(`/api/glossary/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    if (isOpen) {
      fetchTerms();
    }
  }, [isOpen, fetchTerms]);

  // Focus search when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Extract unique categories
  const categories = [...new Set(terms.map(t => t.category))].sort();

  // Link/unlink a term to the selected widget
  const linkTermToWidget = (termId: string) => {
    if (!selectedWidget) {
      toast({ type: 'error', title: 'No widget selected', description: 'Click a widget on the canvas first.' });
      return;
    }
    const existing = selectedWidget.glossaryTermIds || [];
    if (existing.includes(termId)) return;
    updateWidget(selectedWidget.id, { glossaryTermIds: [...existing, termId] });
    toast({ type: 'success', title: 'Term linked to widget' });
  };

  const unlinkTermFromWidget = (termId: string) => {
    if (!selectedWidget) return;
    const existing = selectedWidget.glossaryTermIds || [];
    updateWidget(selectedWidget.id, { glossaryTermIds: existing.filter(id => id !== termId) });
    toast({ type: 'success', title: 'Term unlinked' });
  };

  const isTermLinked = (termId: string): boolean => {
    return (selectedWidget?.glossaryTermIds || []).includes(termId);
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l border-[var(--border-color)] bg-[var(--bg-primary)] w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-accent-purple" />
          <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Glossary</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <X size={14} className="text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms..."
            className="w-full pl-7 pr-3 py-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                !selectedCategory
                  ? 'bg-accent-purple/10 text-accent-purple'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                  cat === selectedCategory
                    ? 'bg-accent-purple/10 text-accent-purple'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected widget context */}
      {selectedWidget && (
        <div className="px-3 py-2 border-b border-[var(--border-color)] bg-accent-blue/5">
          <p className="text-[10px] text-accent-blue font-medium">
            Linking to: {selectedWidget.title}
          </p>
          {(selectedWidget.glossaryTermIds?.length ?? 0) > 0 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              {selectedWidget.glossaryTermIds!.length} term{selectedWidget.glossaryTermIds!.length !== 1 ? 's' : ''} linked
            </p>
          )}
        </div>
      )}

      {/* Terms list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : terms.length === 0 ? (
          <div className="text-center py-8 px-3">
            <BookOpen size={24} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-muted)]">
              {search ? 'No terms match your search' : 'No glossary terms found'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {terms.map(term => {
              const isExpanded = expandedTermId === term.id;
              const linked = isTermLinked(term.id);

              return (
                <div
                  key={term.id}
                  className={cn(
                    'border-b border-[var(--border-color)]/30',
                    linked && 'bg-accent-purple/5'
                  )}
                >
                  {/* Term header */}
                  <button
                    onClick={() => setExpandedTermId(isExpanded ? null : term.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <ChevronRight size={10} className="text-[var(--text-muted)] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {term.term}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {term.category}
                      </p>
                    </div>
                    {linked && (
                      <Link2 size={10} className="text-accent-purple shrink-0" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        {term.definition}
                      </p>

                      {term.formula && (
                        <div className="bg-[var(--bg-card)] rounded-md px-2 py-1.5 border border-[var(--border-color)]">
                          <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Formula</p>
                          <p className="text-[11px] font-mono text-accent-cyan">{term.formula}</p>
                        </div>
                      )}

                      {term.dataSource && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Source: <span className="font-mono text-accent-blue">{term.dataSource}</span>
                        </p>
                      )}

                      {term.examples && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Examples: {term.examples}
                        </p>
                      )}

                      {term.relatedTerms && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Related: {term.relatedTerms}
                        </p>
                      )}

                      {/* Link/Unlink button */}
                      {selectedWidget && (
                        <button
                          onClick={() => linked ? unlinkTermFromWidget(term.id) : linkTermToWidget(term.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                            linked
                              ? 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20'
                              : 'bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20'
                          )}
                        >
                          {linked ? (
                            <><Unlink2 size={10} /> Unlink from widget</>
                          ) : (
                            <><Link2 size={10} /> Link to widget</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
