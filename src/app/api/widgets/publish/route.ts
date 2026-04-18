import { NextRequest, NextResponse } from 'next/server';
import type { WidgetConfig } from '@/types';

/**
 * POST /api/widgets/publish
 *
 * Publish widgets from a dashboard into the company widget library.
 * In Phase 1 this is a stub that validates + returns success.
 * In Phase 2 this will persist to the WidgetTemplate table.
 *
 * Body: {
 *   dashboardId: string,
 *   dashboardTitle: string,
 *   widgets: WidgetConfig[],
 *   publisherId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dashboardId, dashboardTitle, widgets, publisherId } = body as {
      dashboardId: string;
      dashboardTitle: string;
      widgets: WidgetConfig[];
      publisherId?: string;
    };

    if (!dashboardId || !dashboardTitle || !Array.isArray(widgets)) {
      return NextResponse.json(
        { error: 'dashboardId, dashboardTitle, and widgets[] are required' },
        { status: 400 },
      );
    }

    // Phase 2: Persist to database
    // const prisma = new PrismaClient();
    // const created = await prisma.widgetTemplate.createMany({
    //   data: widgets.map(w => ({
    //     title: w.title,
    //     description: w.subtitle || null,
    //     type: w.type,
    //     tags: inferTags(w),
    //     config: w as any,
    //     sourceDashboardId: dashboardId,
    //     sourceDashboardTitle: dashboardTitle,
    //     publishedById: publisherId || null,
    //   })),
    //   skipDuplicates: true,
    // });

    return NextResponse.json({
      published: widgets.length,
      message: `${widgets.length} widget(s) from "${dashboardTitle}" added to the company library.`,
      // Phase 2: ids: created.map(c => c.id)
    });
  } catch (error) {
    console.error('Widget publish error:', error);
    return NextResponse.json({ error: 'Failed to publish widgets' }, { status: 500 });
  }
}
