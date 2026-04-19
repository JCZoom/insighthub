'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, BookOpen, Hash, Calculator, Database, Users2, ChevronDown, Briefcase, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RelatedWidgets } from '@/components/glossary/RelatedWidgets';

export interface GlossaryEntry {
  term: string;
  category: string;
  definition: string;
  formula?: string;
  data_source?: string;
  related_terms?: string[];
  approved_by?: string;
  last_reviewed?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Revenue: 'pill-green',
  Retention: 'pill-red',
  Support: 'pill-blue',
  Sales: 'pill-purple',
  Product: 'pill-amber',
  Operations: 'pill-cyan',
};

const CATEGORY_ICONS: Record<string, typeof Hash> = {
  Revenue: Calculator,
  Retention: Users2,
  Support: BookOpen,
  Sales: Database,
  Product: Hash,
  Operations: Briefcase,
};

interface GlossaryClientProps {
  initialTerms: GlossaryEntry[];
}

export function GlossaryClient({ initialTerms }: GlossaryClientProps) {
  const terms = initialTerms;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const categories = [...new Set(terms.map(t => t.category))];

  const navigateToTerm = useCallback((targetTerm: string, fromTerm: string | null) => {
    // Clear filters so the target term is visible
    setSearch('');
    setSelectedCategory(null);
    setCameFrom(fromTerm);
    setExpandedTerm(targetTerm);
    // Scroll after state update
    setTimeout(() => {
      const el = cardRefs.current[targetTerm];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, []);

  const filtered = terms.filter(t => {
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <main className="flex-1 w-full px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
          <BookOpen size={24} className="text-accent-blue" />
          Company Glossary
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Official definitions for all business metrics. These definitions are used by the AI when building dashboards.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search terms, definitions..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              !selectedCategory
                ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-card)]'
            )}
          >
            All ({terms.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                selectedCategory === cat
                  ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                  : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-card)]'
              )}
            >
              {cat} ({terms.filter(t => t.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div className="space-y-3">
        {filtered.map(term => {
          const isExpanded = expandedTerm === term.term;
          const CatIcon = CATEGORY_ICONS[term.category] || Hash;
          return (
            <div key={term.term} ref={el => { cardRefs.current[term.term] = el; }} className="card p-0 overflow-hidden">
              <button
                onClick={() => setExpandedTerm(isExpanded ? null : term.term)}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <CatIcon size={16} className="text-accent-blue mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{term.term}</h3>
                    <span className={cn('pill', CATEGORY_COLORS[term.category] || 'pill-blue')}>
                      {term.category}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{term.definition}</p>
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    'text-[var(--text-muted)] transition-transform shrink-0 mt-1',
                    isExpanded && 'rotate-180'
                  )}
                />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 ml-7 border-t border-[var(--border-color)] mt-0 fade-in">
                  <div className="pt-3 space-y-3">
                    {cameFrom && expandedTerm === term.term && (
                      <button
                        onClick={() => navigateToTerm(cameFrom, null)}
                        className="flex items-center gap-1 text-[11px] text-accent-blue hover:underline"
                      >
                        <ArrowLeft size={12} />
                        Back to {cameFrom}
                      </button>
                    )}
                    {term.formula && (
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Formula</span>
                        <p className="text-xs text-accent-cyan font-mono bg-accent-cyan/5 px-2 py-1 rounded mt-0.5 break-all">{term.formula}</p>
                      </div>
                    )}
                    {term.data_source && (
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Data Source</span>
                        <p className="text-xs text-[var(--text-primary)] mt-0.5">{term.data_source}</p>
                      </div>
                    )}
                    {term.related_terms && term.related_terms.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Related Terms</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {term.related_terms.map(rt => {
                            const targetExists = terms.some(t => t.term === rt || t.term.includes(rt) || rt.includes(t.term.split(' (')[0]));
                            const resolvedTarget = terms.find(t => t.term === rt || t.term.includes(rt) || rt.includes(t.term.split(' (')[0]));
                            return targetExists && resolvedTarget ? (
                              <button
                                key={rt}
                                onClick={() => navigateToTerm(resolvedTarget.term, term.term)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors cursor-pointer"
                              >
                                {rt}
                              </button>
                            ) : (
                              <span key={rt} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-card-hover)] text-[var(--text-secondary)]">{rt}</span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {term.approved_by && (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Approved by {term.approved_by} {term.last_reviewed && `— ${term.last_reviewed}`}
                      </div>
                    )}

                    {/* Related Widgets */}
                    <RelatedWidgets glossaryTerm={term} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)]">
              {search || selectedCategory ? 'No terms match your filters.' : 'No glossary terms defined yet.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
