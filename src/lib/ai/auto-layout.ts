import type { WidgetConfig } from '@/types';

/**
 * Auto-arrange widgets into a clean grid layout.
 * Groups by size class (KPI row, chart pair, full-width tables)
 * and fills rows left-to-right, top-to-bottom.
 */
export function autoLayoutWidgets(widgets: WidgetConfig[], columns = 12): WidgetConfig[] {
  if (widgets.length === 0) return widgets;

  // Categorize widgets by size class
  const kpis: WidgetConfig[] = [];     // w <= 3 — pack 4 per row
  const medium: WidgetConfig[] = [];   // w <= 6 — pack 2 per row
  const wide: WidgetConfig[] = [];     // w <= 9 — one per row
  const full: WidgetConfig[] = [];     // w > 9  — one per row

  for (const w of widgets) {
    if (w.position.w <= 3) kpis.push(w);
    else if (w.position.w <= 6) medium.push(w);
    else if (w.position.w <= 9) wide.push(w);
    else full.push(w);
  }

  const result: WidgetConfig[] = [];
  let currentRow = 0;

  // Helper: place a group of widgets in rows of given capacity
  function placeRow(items: WidgetConfig[], perRow: number, targetW: number, h?: number) {
    for (let i = 0; i < items.length; i++) {
      const col = (i % perRow) * targetW;
      const row = currentRow + Math.floor(i / perRow);
      result.push({
        ...items[i],
        position: {
          ...items[i].position,
          x: col,
          y: row,
          w: targetW,
          h: h ?? items[i].position.h,
        },
      });
    }
    if (items.length > 0) {
      currentRow += Math.ceil(items.length / perRow);
    }
  }

  // KPIs: 4 across (3 columns each), uniform height
  placeRow(kpis, 4, 3, 2);

  // Add a gap row between sections if both KPIs and charts exist
  if (kpis.length > 0 && (medium.length > 0 || wide.length > 0 || full.length > 0)) {
    // No extra gap needed — the row increment handles spacing
  }

  // Medium charts: 2 across (6 columns each)
  placeRow(medium, 2, 6);

  // Wide widgets: 1 per row spanning 12 columns
  placeRow(wide, 1, columns);

  // Full-width: 1 per row spanning 12 columns
  placeRow(full, 1, columns);

  return result;
}

/**
 * Check if widgets are likely from AI generation (chaotic positions)
 * vs user-arranged (intentional layout).
 * Returns true if layout looks like it needs auto-arrangement.
 */
export function needsAutoLayout(widgets: WidgetConfig[]): boolean {
  if (widgets.length <= 1) return false;

  // Check for overlapping widgets
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

  // Check for widgets stacked in column 0 with no spacing variation
  const allAtX0 = widgets.every(w => w.position.x === 0);
  if (allAtX0 && widgets.length >= 3) return true;

  return false;
}
