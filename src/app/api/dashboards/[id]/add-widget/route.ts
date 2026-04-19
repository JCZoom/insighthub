import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { logDashboardAction, AuditAction } from '@/lib/audit';
import { withRateLimit, dashboardRateLimiter } from '@/lib/rate-limiter';
import type { DashboardSchema, WidgetConfig } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/dashboards/[id]/add-widget
 *
 * Append a widget (cloned from another dashboard) into the target dashboard.
 * Body: { widget: WidgetConfig, sourceDashboardId?: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:add-widget', async () => {
    try {
      const { id: targetId } = await context.params;
      const user = await getCurrentUser();
      const body = await request.json();
      const { widget, sourceDashboardId } = body as {
        widget: WidgetConfig;
        sourceDashboardId?: string;
      };

      if (!widget || !widget.type || !widget.title) {
        return NextResponse.json({ error: 'A valid widget config is required' }, { status: 400 });
      }

      // Verify user has edit access to the target dashboard
      const target = await prisma.dashboard.findFirst({
        where: {
          id: targetId,
          archivedAt: null,
          OR: [
            { ownerId: user.id },
            { shares: { some: { userId: user.id, permission: 'EDIT' } } },
          ],
        },
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });

      if (!target) {
        return NextResponse.json(
          { error: 'Dashboard not found or insufficient permissions' },
          { status: 404 },
        );
      }

      // Parse current schema
      const currentSchema: DashboardSchema = target.versions[0]?.schema
        ? JSON.parse(target.versions[0].schema)
        : { layout: { columns: 12, rowHeight: 80, gap: 16 }, globalFilters: [], widgets: [] };

      // Place the widget at the bottom of the existing grid
      const maxY = currentSchema.widgets.reduce(
        (max: number, w: WidgetConfig) => Math.max(max, w.position.y + w.position.h),
        0,
      );

      const clonedWidget: WidgetConfig = {
        ...widget,
        id: `widget-${widget.type}-${Math.random().toString(36).slice(2, 8)}`,
        position: { ...widget.position, x: 0, y: maxY },
      };

      const newSchema: DashboardSchema = {
        ...currentSchema,
        widgets: [...currentSchema.widgets, clonedWidget],
      };

      const nextVersion = (target.currentVersion || 1) + 1;

      await prisma.$transaction([
        prisma.dashboardVersion.create({
          data: {
            dashboardId: targetId,
            version: nextVersion,
            schema: JSON.stringify(newSchema),
            changeNote: `Added widget "${clonedWidget.title}" from ${sourceDashboardId ? 'another dashboard' : 'copy'}`,
            createdBy: user.id,
          },
        }),
        prisma.dashboard.update({
          where: { id: targetId },
          data: { currentVersion: nextVersion },
        }),
      ]);

      // Audit log
      await logDashboardAction(
        user.id,
        AuditAction.DASHBOARD_UPDATE,
        targetId,
        {
          action: 'add-widget',
          widgetTitle: clonedWidget.title,
          widgetType: clonedWidget.type,
          sourceDashboardId,
        },
      );

      return NextResponse.json(
        { success: true, widget: clonedWidget, targetDashboardId: targetId },
        { status: 201 },
      );
    } catch (error) {
      console.error('Add widget to dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
