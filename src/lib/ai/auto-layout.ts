import type { WidgetConfig, WidgetType } from '@/types';

/* ------------------------------------------------------------------ */
/*  Canonical sizing & priority by widget type                        */
/* ------------------------------------------------------------------ */

interface LayoutProfile {
  /** Grid columns the widget should occupy */
  w: number;
  /** Grid rows (each row = rowHeight px) */
  h: number;
  /** Lower = placed first (top of dashboard) */
  priority: number;
  /** How many of these fit side-by-side in a 12-col grid */
  perRow: number;
}

const TYPE_PROFILES: Record<WidgetType, LayoutProfile> = {
  // KPI / summary — small cards, pack 3-4 per row
  kpi_card:     { w: 3, h: 2, priority: 0, perRow: 4 },
  metric_row:   { w: 6, h: 2, priority: 0, perRow: 2 },
  gauge:        { w: 3, h: 3, priority: 1, perRow: 4 },

  // Charts — medium, 2 per row
  line_chart:   { w: 6, h: 4, priority: 2, perRow: 2 },
  bar_chart:    { w: 6, h: 4, priority: 2, perRow: 2 },
  area_chart:   { w: 6, h: 4, priority: 2, perRow: 2 },
  stacked_bar:  { w: 6, h: 4, priority: 2, perRow: 2 },
  scatter_plot: { w: 6, h: 4, priority: 3, perRow: 2 },

  // Circular charts — smaller
  pie_chart:    { w: 4, h: 4, priority: 3, perRow: 3 },
  donut_chart:  { w: 4, h: 4, priority: 3, perRow: 3 },
  funnel:       { w: 6, h: 4, priority: 3, perRow: 2 },

  // Full-width visuals
  heatmap:      { w: 12, h: 5, priority: 4, perRow: 1 },
  map:          { w: 12, h: 5, priority: 4, perRow: 1 },

  // Tables — full width, at the bottom
  table:        { w: 12, h: 5, priority: 5, perRow: 1 },
  pivot_table:  { w: 12, h: 5, priority: 5, perRow: 1 },

  // Content blocks
  text_block:   { w: 6, h: 2, priority: 6, perRow: 2 },
  image:        { w: 6, h: 3, priority: 6, perRow: 2 },
  divider:      { w: 12, h: 1, priority: 6, perRow: 1 },
};

function profileFor(type: WidgetType): LayoutProfile {
  return TYPE_PROFILES[type] ?? { w: 6, h: 4, priority: 3, perRow: 2 };
}

/* ------------------------------------------------------------------ */
/*  Auto-layout engine                                                */
/* ------------------------------------------------------------------ */

/**
 * Smart auto-arrange: groups widgets by type/priority, normalises sizes,
 * and packs rows left-to-right, top-to-bottom.
 *
 * Layout order:  KPIs → gauges → charts → circular → full-width → tables → content
 *
 * Within each priority tier widgets keep their original order so the AI's
 * chosen narrative flow is preserved.
 */
export function autoLayoutWidgets(widgets: WidgetConfig[], columns = 12): WidgetConfig[] {
  if (widgets.length === 0) return widgets;

  // Adaptive KPI sizing: if we have exactly 2 or 3 KPIs, widen them to fill the row
  const kpiCount = widgets.filter(w => w.type === 'kpi_card').length;
  const adaptiveKpiW = kpiCount === 2 ? 6 : kpiCount === 3 ? 4 : 3;
  const adaptiveKpiPerRow = Math.floor(columns / adaptiveKpiW);

  // Sort by priority tier, preserving original order within each tier
  const sorted = [...widgets].sort((a, b) => {
    const pa = profileFor(a.type).priority;
    const pb = profileFor(b.type).priority;
    return pa - pb;
  });

  // Group consecutive widgets that share the same layout profile
  interface TierGroup { profile: LayoutProfile; items: WidgetConfig[] }
  const groups: TierGroup[] = [];
  let prevPriority = -1;

  for (const w of sorted) {
    const p = profileFor(w.type);
    if (p.priority !== prevPriority) {
      groups.push({ profile: { ...p }, items: [] });
      prevPriority = p.priority;
    }
    groups[groups.length - 1].items.push(w);
  }

  // Place each group row-by-row
  const result: WidgetConfig[] = [];
  let currentRow = 0;

  for (const group of groups) {
    const items = group.items;
    if (items.length === 0) continue;

    // Determine target width & perRow for this group
    const isKpi = items[0].type === 'kpi_card';
    const targetW = isKpi ? adaptiveKpiW : group.profile.w;
    const perRow = isKpi ? adaptiveKpiPerRow : group.profile.perRow;
    const targetH = group.profile.h;

    // If a single chart exists alone in a tier, let it span full width
    const effectiveW = items.length === 1 && group.profile.priority >= 2 && group.profile.priority <= 3
      ? columns
      : targetW;
    const effectivePerRow = effectiveW === columns ? 1 : perRow;

    for (let i = 0; i < items.length; i++) {
      const col = (i % effectivePerRow) * effectiveW;
      const row = currentRow + Math.floor(i / effectivePerRow) * targetH;
      result.push({
        ...items[i],
        position: { x: col, y: row, w: effectiveW, h: targetH },
      });
    }

    const rowsUsed = Math.ceil(items.length / effectivePerRow) * targetH;
    currentRow += rowsUsed;
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Detection heuristic                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns true when the widget layout looks like it needs auto-arrangement.
 * Checks for overlaps, wasted space, misaligned widgets, and scattered
 * positioning patterns that are typical of raw AI output.
 */
export function needsAutoLayout(widgets: WidgetConfig[]): boolean {
  if (widgets.length <= 1) return false;

  const columns = 12;

  // 1. Overlapping widgets
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      const a = widgets[i].position;
      const b = widgets[j].position;
      if (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        return true;
      }
    }
  }

  // 2. Widgets stacked at column 0
  const allAtX0 = widgets.every(w => w.position.x === 0);
  if (allAtX0 && widgets.length >= 3) return true;

  // 3. Widgets that overflow the grid edge
  if (widgets.some(w => w.position.x + w.position.w > columns)) return true;

  // 4. Scattered: large total bounding box but low fill ratio
  if (widgets.length >= 3) {
    const maxY = Math.max(...widgets.map(w => w.position.y + w.position.h));
    const totalArea = columns * maxY;
    const widgetArea = widgets.reduce((sum, w) => sum + w.position.w * w.position.h, 0);
    // If widgets only fill <40% of the bounding rectangle, layout is scattered
    if (totalArea > 0 && widgetArea / totalArea < 0.4) return true;
  }

  // 5. KPI cards not in first row or not aligned
  const kpis = widgets.filter(w => w.type === 'kpi_card');
  const nonKpis = widgets.filter(w => w.type !== 'kpi_card');
  if (kpis.length > 0 && nonKpis.length > 0) {
    const kpiMaxY = Math.max(...kpis.map(w => w.position.y + w.position.h));
    const nonKpiMinY = Math.min(...nonKpis.map(w => w.position.y));
    // KPIs should be above other content; if not, layout needs fixing
    if (kpiMaxY > nonKpiMinY + 1) return true;
  }

  // 6. Misaligned: KPIs at different y values
  if (kpis.length >= 2) {
    const yValues = new Set(kpis.map(w => w.position.y));
    if (yValues.size > 1) return true;
  }

  return false;
}
