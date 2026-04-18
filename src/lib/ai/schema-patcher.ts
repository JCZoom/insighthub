import type { DashboardSchema, SchemaPatch, WidgetConfig } from '@/types';
import { getWidgetTemplate, cloneWidgetFromLibrary } from '@/lib/data/widget-library';
import { autoLayoutWidgets, needsAutoLayout } from './auto-layout';

export function applyPatches(
  schema: DashboardSchema,
  patches: SchemaPatch[],
): DashboardSchema {
  let result = structuredClone(schema);

  for (const patch of patches) {
    result = applySinglePatch(result, patch);
  }

  // Always auto-arrange after AI patches — the layout engine is type-aware
  // and will produce a clean, prioritised grid regardless of what the AI emits.
  // needsAutoLayout is kept as a secondary check for edge-case manual additions.
  const hasStructuralChange = patches.some(p =>
    p.type === 'add_widget' || p.type === 'use_widget' || p.type === 'replace_all'
  );

  if (hasStructuralChange || needsAutoLayout(result.widgets)) {
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
        widgets: [...schema.widgets, patch.widget],
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
      return patch.schema;
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
