import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { logDashboardAction, createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import { withRateLimit, dashboardRateLimiter } from '@/lib/rate-limiter';
import {
  canSetClassification,
  coerceClassification,
  isDowngrade,
  isValidClassification,
  type DataClassification,
} from '@/lib/data/classification';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id] — get dashboard with current version schema
export async function GET(request: NextRequest, context: RouteContext) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:get', async () => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser();

      const dashboard = await prisma.dashboard.findFirst({
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
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          // G-01: surface the data owner alongside the regular owner.
          dataOwner: { select: { id: true, name: true, email: true } },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true, version: true, schema: true, changeNote: true, createdAt: true, createdBy: true },
          },
          shares: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { versions: true } },
        },
      });

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
      }

      return NextResponse.json({
        dashboard: {
          ...dashboard,
          currentSchema: dashboard.versions[0]?.schema ? JSON.parse(dashboard.versions[0].schema) : null,
        },
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

// PUT /api/dashboards/[id] — update metadata (title, description, tags, etc)
export async function PUT(request: NextRequest, context: RouteContext) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:update', async () => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser();
      const body = await request.json();
      const { title, description, tags, isPublic, isTemplate, classification, dataOwnerId } = body as {
        title?: string;
        description?: string;
        tags?: string[] | string;
        isPublic?: boolean;
        isTemplate?: boolean;
        // G-01 — optional classification + data-owner updates.
        classification?: string;
        dataOwnerId?: string | null;
      };
      const tagsStr = tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : undefined;

      // G-01: validate classification value if supplied.
      if (classification !== undefined && !isValidClassification(classification)) {
        return NextResponse.json(
          { error: `Invalid classification value. Allowed: PUBLIC, USZOOM_CONFIDENTIAL, USZOOM_RESTRICTED, CUSTOMER_CONFIDENTIAL.` },
          { status: 400 },
        );
      }

      // Check if user has permission to manage templates when isTemplate is being modified
      if (isTemplate !== undefined) {
        const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
        const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

        if (!canManageUsers && !canManagePermissions) {
          return NextResponse.json({
            error: 'Insufficient permissions to manage templates'
          }, { status: 403 });
        }
      }

      // Check ownership or edit permission
      const existing = await prisma.dashboard.findFirst({
        where: {
          id,
          OR: [
            { ownerId: user.id },
            { shares: { some: { userId: user.id, permission: 'EDIT' } } },
          ],
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dashboard not found or insufficient permissions' }, { status: 404 });
      }

      // G-01: enforce classification transition rule before writing.
      let nextClassification: DataClassification | undefined;
      if (classification !== undefined) {
        nextClassification = classification as DataClassification;
        const currentClassification = coerceClassification(existing.classification);
        const check = canSetClassification(user, currentClassification, nextClassification);
        if (!check.ok) {
          return NextResponse.json({ error: check.reason }, { status: 403 });
        }
      }

      const dashboard = await prisma.dashboard.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(tagsStr !== undefined && { tags: tagsStr }),
          ...(isPublic !== undefined && { isPublic }),
          ...(isTemplate !== undefined && { isTemplate }),
          ...(nextClassification !== undefined && { classification: nextClassification }),
          ...(dataOwnerId !== undefined && { dataOwnerId }),
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          dataOwner: { select: { id: true, name: true, email: true } },
        },
      });

      // Log dashboard update for audit
      const changedFields = [];
      if (title !== undefined) changedFields.push('title');
      if (description !== undefined) changedFields.push('description');
      if (tagsStr !== undefined) changedFields.push('tags');
      if (isPublic !== undefined) changedFields.push('isPublic');
      if (isTemplate !== undefined) changedFields.push('isTemplate');
      if (nextClassification !== undefined) changedFields.push('classification');
      if (dataOwnerId !== undefined) changedFields.push('dataOwnerId');

      await logDashboardAction(
        user.id,
        AuditAction.DASHBOARD_UPDATE,
        id,
        {
          title: dashboard.title,
          changedFields,
          oldTitle: existing.title !== dashboard.title ? existing.title : undefined,
        }
      );

      // G-01 / Policy 3698 DC-02: dedicated audit entry for classification
      // changes so they can be queried independently from the noisy stream
      // of regular dashboard updates.
      if (
        nextClassification !== undefined &&
        coerceClassification(existing.classification) !== nextClassification
      ) {
        await createAuditLog({
          userId: user.id,
          action: AuditAction.DATA_CLASSIFICATION_CHANGE,
          resourceType: ResourceType.DASHBOARD,
          resourceId: id,
          metadata: {
            from: existing.classification,
            to: nextClassification,
            isDowngrade: isDowngrade(
              coerceClassification(existing.classification),
              nextClassification,
            ),
            title: dashboard.title,
          },
        });
      }
      if (dataOwnerId !== undefined && existing.dataOwnerId !== dataOwnerId) {
        await createAuditLog({
          userId: user.id,
          action: AuditAction.DATA_OWNER_CHANGE,
          resourceType: ResourceType.DASHBOARD,
          resourceId: id,
          metadata: {
            from: existing.dataOwnerId,
            to: dataOwnerId,
            title: dashboard.title,
          },
        });
      }

      return NextResponse.json({ dashboard });
    } catch (error) {
      console.error('Update dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

// DELETE /api/dashboards/[id] — soft-delete (archive) a dashboard
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:delete', async () => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser();

      const existing = await prisma.dashboard.findFirst({
        where: { id, ownerId: user.id },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dashboard not found or not owner' }, { status: 404 });
      }

      await prisma.dashboard.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      // Log dashboard deletion for audit
      await logDashboardAction(
        user.id,
        AuditAction.DASHBOARD_DELETE,
        id,
        {
          title: existing.title,
          description: existing.description,
          isArchive: true, // Soft delete
        }
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Delete dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
