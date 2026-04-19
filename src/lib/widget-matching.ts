import type { GlossaryEntry } from '@/app/glossary/glossary-client';
import type { WidgetTemplate } from '@/lib/data/widget-library';

/**
 * Calculate relevance score between a glossary term and a widget template.
 * Higher scores indicate better matches.
 */
export function calculateWidgetRelevance(
  glossaryTerm: GlossaryEntry,
  widget: WidgetTemplate
): number {
  let score = 0;
  const termLower = glossaryTerm.term.toLowerCase();
  const definitionLower = glossaryTerm.definition.toLowerCase();
  const categoryLower = glossaryTerm.category.toLowerCase();
  const dataSourceLower = (glossaryTerm.data_source || '').toLowerCase();

  const widgetTitleLower = widget.title.toLowerCase();
  const widgetDescLower = widget.description.toLowerCase();
  const widgetTags = widget.tags.map(t => t.toLowerCase());
  const widgetDataSourceLower = (widget.config.dataConfig.source || '').toLowerCase();

  // Direct title matches (highest weight)
  if (widgetTitleLower.includes(termLower) || termLower.includes(widgetTitleLower)) {
    score += 20;
  }

  // Keyword matching in title vs term
  const termWords = termLower.split(/\s+/);
  const titleWords = widgetTitleLower.split(/\s+/);
  termWords.forEach(word => {
    if (word.length > 3 && titleWords.some(tw => tw.includes(word) || word.includes(tw))) {
      score += 8;
    }
  });

  // Tag matching
  widgetTags.forEach(tag => {
    if (termLower.includes(tag) || tag.includes(termLower)) {
      score += 12;
    }
    // Check against term words
    termWords.forEach(word => {
      if (word.length > 3 && (tag.includes(word) || word.includes(tag))) {
        score += 6;
      }
    });
  });

  // Category matching
  if (categoryLower.includes('revenue') && widgetTags.includes('revenue')) score += 10;
  if (categoryLower.includes('retention') && (widgetTags.includes('churn') || widgetTags.includes('retention'))) score += 10;
  if (categoryLower.includes('support') && widgetTags.includes('support')) score += 10;
  if (categoryLower.includes('sales') && widgetTags.includes('sales')) score += 10;
  if (categoryLower.includes('product') && widgetTags.includes('customers')) score += 8;

  // Data source matching
  if (dataSourceLower && widgetDataSourceLower) {
    if (dataSourceLower.includes(widgetDataSourceLower) || widgetDataSourceLower.includes(dataSourceLower)) {
      score += 15;
    }
    // Check for related data sources
    const dataSourceWords = dataSourceLower.split(/\s+|_/);
    const widgetSourceWords = widgetDataSourceLower.split(/\s+|_/);
    dataSourceWords.forEach(word => {
      if (word.length > 3 && widgetSourceWords.some(wsw => wsw.includes(word) || word.includes(wsw))) {
        score += 5;
      }
    });
  }

  // Definition keyword matching (lower weight)
  termWords.forEach(word => {
    if (word.length > 4 && (widgetDescLower.includes(word) || widgetTitleLower.includes(word))) {
      score += 3;
    }
  });

  // Common business metric keywords
  const metricKeywords = ['rate', 'ratio', 'count', 'total', 'average', 'growth', 'conversion', 'ltv', 'arpu', 'mrr', 'arr'];
  metricKeywords.forEach(keyword => {
    if (termLower.includes(keyword) && widgetTitleLower.includes(keyword)) {
      score += 5;
    }
  });

  return Math.max(0, score);
}

/**
 * Find related widgets for a given glossary term.
 * Returns widgets sorted by relevance score in descending order.
 */
export function findRelatedWidgets(
  glossaryTerm: GlossaryEntry,
  widgets: WidgetTemplate[],
  limit = 6
): Array<WidgetTemplate & { relevanceScore: number }> {
  const scored = widgets.map(widget => ({
    ...widget,
    relevanceScore: calculateWidgetRelevance(glossaryTerm, widget),
  }));

  return scored
    .filter(widget => widget.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}