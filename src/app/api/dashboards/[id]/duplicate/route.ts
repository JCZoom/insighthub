import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canCreateDashboard } from '@/lib/auth/session';
import { logDashboardAction, AuditAction } from '@/lib/audit';
import { withRateLimit, dashboardRateLimiter } from '@/lib/rate-limiter';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/dashboards/[id]/duplicate — clone a dashboard
export async function POST(request: NextRequest, context: RouteContext) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:duplicate', async () => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser();

      if (!canCreateDashboard(user)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // Get the source dashboard with current version
      const source = await prisma.dashboard.findFirst({
        where: {
          id,
          archivedAt: null,
          OR: [
            { ownerId: user.id },
            { isPublic: true },
            { shares: { some: { userId: user.id } } },
          ],
        },
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });

      if (!source) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
      }

      // Optional body: { folderId?: string | null, title?: string }
      // If the caller supplies a folderId, we verify ownership and place the clone
      // there. Otherwise, the clone defaults to the source's primary folder so the
      // user doesn't surprise-lose their organizational context.
      let body: { folderId?: string | null; title?: string } = {};
      try {
        body = await request.json();
      } catch {
        // No body or invalid JSON — fall through with defaults.
      }

      let targetFolderId: string | null = source.folderId;
      if (body.folderId !== undefined) {
        if (body.folderId === null) {
          targetFolderId = null;
        } else {
          const folder = await prisma.folder.findFirst({
            where: { id: body.folderId, ownerId: user.id },
            select: { id: true },
          });
          if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
          }
          targetFolderId = body.folderId;
        }
      }

      const cloneTitle =
        typeof body.title === 'string' && body.title.trim().length > 0
          ? body.title.trim().slice(0, 200)
          : `${source.title} (copy)`;

      const sourceSchema = source.versions[0]?.schema || '{}';

      const clone = await prisma.dashboard.create({
        data: {
          title: cloneTitle,
          description: source.description,
          tags: source.tags,
          ownerId: user.id,
          folderId: targetFolderId,
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              schema: sourceSchema,
              changeNote: `Cloned from "${source.title}"`,
              createdBy: user.id,
            },
          },
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          versions: { take: 1 },
        },
      });

      // Log dashboard duplication for audit
      await logDashboardAction(
        user.id,
        AuditAction.DASHBOARD_DUPLICATE,
        clone.id,
        {
          title: clone.title,
          sourceDashboardId: id,
          sourceDashboardTitle: source.title,
        }
      );

      return NextResponse.json({ dashboard: clone }, { status: 201 });
    } catch (error) {
      console.error('Duplicate dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
