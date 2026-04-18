import { NextRequest, NextResponse } from 'next/server';
import { getWidgetTemplate, cloneWidgetFromLibrary } from '@/lib/data/widget-library';

/**
 * POST /api/widgets/fork
 * 
 * Clone a widget from the library into a fresh WidgetConfig.
 * Body: { widgetTemplateId: string, positionOverride?: { x, y, w, h } }
 * Returns the cloned WidgetConfig ready to drop into a dashboard schema.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { widgetTemplateId, positionOverride } = body as {
      widgetTemplateId: string;
      positionOverride?: { x?: number; y?: number; w?: number; h?: number };
    };

    if (!widgetTemplateId) {
      return NextResponse.json({ error: 'widgetTemplateId is required' }, { status: 400 });
    }

    const template = getWidgetTemplate(widgetTemplateId);
    if (!template) {
      return NextResponse.json({ error: `Widget template "${widgetTemplateId}" not found` }, { status: 404 });
    }

    const cloned = cloneWidgetFromLibrary(template, positionOverride);

    return NextResponse.json({
      widget: cloned,
      source: {
        templateId: template.id,
        title: template.title,
        sourceDashboard: template.sourceDashboardTitle,
      },
    });
  } catch (error) {
    console.error('Widget fork error:', error);
    return NextResponse.json({ error: 'Failed to fork widget' }, { status: 500 });
  }
}
