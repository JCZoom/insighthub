import type { DashboardSchema, SchemaPatch, WidgetConfig } from '@/types';
import { getWidgetTemplate, cloneWidgetFromLibrary } from '@/lib/data/widget-library';
import { autoLayoutWidgets, appendWidgetsToLayout, needsAutoLayout } from './auto-layout';

/**
 * Ensure a widget config coming from the AI has all required fields with
 * safe defaults. The AI frequently omits visualConfig, dataConfig, or
 * position — any of which would crash the chart widgets.
 */
function normalizeWidget(w: Partial<WidgetConfig> & { id: string; type: string; title: string }): WidgetConfig {
  return {
    ...w,
    type: (w.type || 'text_block') as WidgetConfig['type'],
    title: w.title || 'Untitled Widget',
    position: {
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      ...(w.position || {}),
    },
    dataConfig: {
      source: '',
      ...(w.dataConfig || {}),
    },
    visualConfig: {
      ...(w.visualConfig || {}),
    },
  };
}

/** Normalize all widgets in a full schema (used for replace_all patches) */
function normalizeSchema(schema: DashboardSchema): DashboardSchema {
  return {
    ...schema,
    layout: schema.layout || { columns: 12, rowHeight: 80, gap: 16 },
    globalFilters: schema.globalFilters || [],
    widgets: (schema.widgets || []).map(w => normalizeWidget(w as any)),
  };
}

export function applyPatches(
  schema: DashboardSchema,
  patches: SchemaPatch[],
): DashboardSchema {
  let result = structuredClone(schema);

  for (const patch of patches) {
    result = applySinglePatch(result, patch);
  }

  // Decide between full re-layout vs incremental append.
  // replace_all → full re-layout (new dashboard, everything gets arranged).
  // add_widget / use_widget → append only (preserve existing positions,
  //   pack new widgets tightly below current content, no white-space gaps).
  const isFullReplace = patches.some(p => p.type === 'replace_all');
  const addedWidgetIds = new Set<string>();

  for (const p of patches) {
    if (p.type === 'add_widget' && p.widget?.id) addedWidgetIds.add(p.widget.id);
    if (p.type === 'use_widget' && p.widgetTemplateId) {
      // use_widget clones get a generated ID — find the newest widget not in the original schema
      const origIds = new Set(schema.widgets.map(w => w.id));
      for (const w of result.widgets) {
        if (!origIds.has(w.id)) addedWidgetIds.add(w.id);
      }
    }
  }

  if (isFullReplace) {
    // Full re-layout for new dashboards
    result = {
      ...result,
      widgets: autoLayoutWidgets(result.widgets, result.layout.columns),
    };
  } else if (addedWidgetIds.size > 0) {
    // Incremental append — keep existing layout, pack new widgets below
    const existing = result.widgets.filter(w => !addedWidgetIds.has(w.id));
    const added = result.widgets.filter(w => addedWidgetIds.has(w.id));
    result = {
      ...result,
      widgets: appendWidgetsToLayout(existing, added, result.layout.columns),
    };
  } else if (needsAutoLayout(result.widgets)) {
    // Fallback: fix badly-positioned widgets
    result = {
      ...result,
      widgets: autoLayoutWidgets(result.widgets, result.layout.columns),
    };
  }

  return result;
}

function applySinglePatch(
  schema: DashboardSchema,
  patch: SchemaPatch,
): DashboardSchema {
  switch (patch.type) {
    case 'add_widget': {
      if (!patch.widget) {
        console.warn('[schema-patcher] add_widget patch missing .widget field, skipping');
        return schema;
      }
      return {
        ...schema,
        widgets: [...schema.widgets, normalizeWidget(patch.widget as any)],
      };
    }

    case 'remove_widget': {
      if (!patch.widgetId) {
        console.warn('[schema-patcher] remove_widget patch missing .widgetId, skipping');
        return schema;
      }
      return {
        ...schema,
        widgets: schema.widgets.filter(w => w.id !== patch.widgetId),
      };
    }

    case 'update_widget': {
      if (!patch.widgetId || !patch.changes) {
        console.warn('[schema-patcher] update_widget patch missing .widgetId or .changes, skipping');
        return schema;
      }
      return {
        ...schema,
        widgets: schema.widgets.map(w =>
          w.id === patch.widgetId ? mergeWidget(w, patch.changes!) : w,
        ),
      };
    }

    case 'update_layout': {
      if (!patch.layout) {
        console.warn('[schema-patcher] update_layout patch missing .layout, skipping');
        return schema;
      }
      return {
        ...schema,
        layout: { ...schema.layout, ...patch.layout },
      };
    }

    case 'update_filters': {
      if (!patch.filters) {
        console.warn('[schema-patcher] update_filters patch missing .filters, skipping');
        return schema;
      }
      return {
        ...schema,
        globalFilters: patch.filters,
      };
    }

    case 'replace_all': {
      if (!patch.schema) {
        console.warn('[schema-patcher] replace_all patch missing .schema, skipping');
        return schema;
      }
      return normalizeSchema(patch.schema);
    }

    case 'use_widget': {
      if (!patch.widgetTemplateId) {
        console.warn('[schema-patcher] use_widget patch missing .widgetTemplateId, skipping');
        return schema;
      }
      const template = getWidgetTemplate(patch.widgetTemplateId);
      if (!template) {
        console.warn(`[schema-patcher] Widget template "${patch.widgetTemplateId}" not found, skipping`);
        return schema;
      }
      // Place the cloned widget below existing widgets
      const maxY = schema.widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);
      const cloned = cloneWidgetFromLibrary(template, { y: maxY });
      return {
        ...schema,
        widgets: [...schema.widgets, cloned],
      };
    }

    default:
      console.warn(`[schema-patcher] Unrecognized patch type: "${patch.type}", skipping`);
      return schema;
  }
}

function mergeWidget(
  widget: WidgetConfig,
  changes: Partial<WidgetConfig>,
): WidgetConfig {
  return {
    ...widget,
    ...changes,
    position: changes.position
      ? { ...widget.position, ...changes.position }
      : widget.position,
    dataConfig: changes.dataConfig
      ? { ...widget.dataConfig, ...changes.dataConfig }
      : widget.dataConfig,
    visualConfig: changes.visualConfig
      ? { ...widget.visualConfig, ...changes.visualConfig }
      : widget.visualConfig,
  };
}
