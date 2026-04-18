import type { WidgetConfig } from '@/types';
import { TEMPLATE_SCHEMAS } from './templates';

export interface WidgetTemplate {
  id: string;
  title: string;
  description: string;
  type: WidgetConfig['type'];
  tags: string[];
  sourceDashboardId: string;
  sourceDashboardTitle: string;
  usageCount: number;
  config: WidgetConfig;
}

/**
 * Auto-extract every widget from every template dashboard into a flat,
 * searchable widget library. Each entry carries enough metadata for
 * both the AI system prompt and the browse-panel UI.
 */
function buildStaticLibrary(): WidgetTemplate[] {
  const library: WidgetTemplate[] = [];

  for (const [dashboardId, template] of Object.entries(TEMPLATE_SCHEMAS)) {
    for (const widget of template.schema.widgets) {
      library.push({
        id: `wlib-${widget.id}`,
        title: widget.title,
        description: widget.subtitle || describeWidget(widget),
        type: widget.type,
        tags: inferTags(widget, template.title),
        sourceDashboardId: dashboardId,
        sourceDashboardTitle: template.title,
        usageCount: Math.floor(Math.random() * 30) + 5,
        config: widget,
      });
    }
  }

  return library;
}

function describeWidget(w: WidgetConfig): string {
  const source = w.dataConfig.source?.replace(/_/g, ' ') || '';
  const agg = w.dataConfig.aggregation;
  if (agg) return `${agg.function}(${agg.field}) from ${source}`;
  return `${w.type.replace(/_/g, ' ')} showing ${source}`;
}

function inferTags(w: WidgetConfig, dashboardTitle: string): string[] {
  const tags: string[] = [];

  // From widget type
  if (w.type === 'kpi_card') tags.push('kpi');
  if (w.type.includes('chart') || w.type.includes('bar') || w.type.includes('area')) tags.push('chart');
  if (w.type === 'table') tags.push('table');

  // From data source
  const src = w.dataConfig.source || '';
  if (src.includes('revenue') || src.includes('mrr') || src.includes('arr')) tags.push('revenue');
  if (src.includes('churn') || src.includes('retention')) tags.push('churn', 'retention');
  if (src.includes('ticket') || src.includes('csat') || src.includes('frt')) tags.push('support');
  if (src.includes('deal') || src.includes('pipeline') || src.includes('win')) tags.push('sales');
  if (src.includes('customer')) tags.push('customers');

  // From dashboard title
  const dtl = dashboardTitle.toLowerCase();
  if (dtl.includes('executive')) tags.push('executive');
  if (dtl.includes('support')) tags.push('support');
  if (dtl.includes('churn')) tags.push('churn');
  if (dtl.includes('sales')) tags.push('sales');

  return [...new Set(tags)];
}

/**
 * Built-in text block templates — these are not extracted from template dashboards
 * but provided as first-class library entries so users can discover and use them.
 */
const TEXT_BLOCK_TEMPLATES: WidgetTemplate[] = [
  {
    id: 'wlib-text-banner',
    title: 'Title Banner',
    description: 'Full-width colored banner for dashboard titles and headings',
    type: 'text_block',
    tags: ['text', 'banner', 'header', 'title', 'heading'],
    sourceDashboardId: 'built-in',
    sourceDashboardTitle: 'Built-in Templates',
    usageCount: 50,
    config: {
      id: 'widget-text-banner',
      type: 'text_block',
      title: 'Dashboard Title',
      subtitle: 'Add a subtitle or description here',
      position: { x: 0, y: 0, w: 12, h: 1 },
      dataConfig: { source: '' },
      visualConfig: { customStyles: { variant: 'banner', backgroundColor: 'blue' } },
    },
  },
  {
    id: 'wlib-text-callout',
    title: 'Callout Box',
    description: 'Highlighted callout with left border accent — great for insights and alerts',
    type: 'text_block',
    tags: ['text', 'callout', 'alert', 'insight', 'note', 'warning'],
    sourceDashboardId: 'built-in',
    sourceDashboardTitle: 'Built-in Templates',
    usageCount: 40,
    config: {
      id: 'widget-text-callout',
      type: 'text_block',
      title: 'Key Insight',
      subtitle: 'Add your observation or alert text here.',
      position: { x: 0, y: 0, w: 6, h: 2 },
      dataConfig: { source: '' },
      visualConfig: { customStyles: { variant: 'callout', borderAccent: 'amber', icon: 'lightbulb' } },
    },
  },
  {
    id: 'wlib-text-section-header',
    title: 'Section Header',
    description: 'Large text with gradient underline — use to separate dashboard sections',
    type: 'text_block',
    tags: ['text', 'header', 'section', 'divider', 'heading', 'separator'],
    sourceDashboardId: 'built-in',
    sourceDashboardTitle: 'Built-in Templates',
    usageCount: 45,
    config: {
      id: 'widget-text-header',
      type: 'text_block',
      title: 'Section Title',
      subtitle: '',
      position: { x: 0, y: 0, w: 12, h: 1 },
      dataConfig: { source: '' },
      visualConfig: { customStyles: { variant: 'header' } },
    },
  },
  {
    id: 'wlib-text-quote',
    title: 'Quote Block',
    description: 'Purple-accented block for key takeaways, quotes, or executive highlights',
    type: 'text_block',
    tags: ['text', 'quote', 'takeaway', 'highlight', 'executive'],
    sourceDashboardId: 'built-in',
    sourceDashboardTitle: 'Built-in Templates',
    usageCount: 25,
    config: {
      id: 'widget-text-quote',
      type: 'text_block',
      title: 'Key Takeaway',
      subtitle: 'Add your quote or executive summary here.',
      position: { x: 0, y: 0, w: 6, h: 2 },
      dataConfig: { source: '' },
      visualConfig: { customStyles: { variant: 'quote', icon: 'star' } },
    },
  },
  {
    id: 'wlib-text-plain',
    title: 'Text Note',
    description: 'Simple text block for notes, instructions, or context on a dashboard',
    type: 'text_block',
    tags: ['text', 'note', 'plain', 'description', 'instructions', 'context'],
    sourceDashboardId: 'built-in',
    sourceDashboardTitle: 'Built-in Templates',
    usageCount: 35,
    config: {
      id: 'widget-text-plain',
      type: 'text_block',
      title: 'Note',
      subtitle: 'Add your text content here.',
      position: { x: 0, y: 0, w: 6, h: 2 },
      dataConfig: { source: '' },
      visualConfig: {},
    },
  },
];

/** The full static widget library — available at import time */
export const WIDGET_LIBRARY: WidgetTemplate[] = [
  ...buildStaticLibrary(),
  ...TEXT_BLOCK_TEMPLATES,
];

/** Search the widget library by query string (matches title, description, tags) */
export function searchWidgets(query: string, limit = 10): WidgetTemplate[] {
  if (!query.trim()) return WIDGET_LIBRARY.slice(0, limit);

  const q = query.toLowerCase();
  const scored = WIDGET_LIBRARY.map(w => {
    let score = 0;
    if (w.title.toLowerCase().includes(q)) score += 10;
    if (w.description.toLowerCase().includes(q)) score += 5;
    if (w.tags.some(t => t.includes(q))) score += 8;
    if (w.type.includes(q)) score += 3;
    if (w.sourceDashboardTitle.toLowerCase().includes(q)) score += 2;
    return { widget: w, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || b.widget.usageCount - a.widget.usageCount)
    .slice(0, limit)
    .map(s => s.widget);
}

/** Get a single widget template by its library ID */
export function getWidgetTemplate(id: string): WidgetTemplate | undefined {
  return WIDGET_LIBRARY.find(w => w.id === id);
}

/**
 * Clone a widget from the library into a fresh WidgetConfig with a new ID.
 * The position is optionally overridden so it doesn't overlap existing widgets.
 */
export function cloneWidgetFromLibrary(
  template: WidgetTemplate,
  positionOverride?: Partial<WidgetConfig['position']>,
): WidgetConfig {
  const cloned = structuredClone(template.config);
  cloned.id = `widget-${cloned.type}-${Math.random().toString(36).slice(2, 6)}`;
  if (positionOverride) {
    cloned.position = { ...cloned.position, ...positionOverride };
  }
  return cloned;
}
