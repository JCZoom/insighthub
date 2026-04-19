import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canCreateDashboard } from '@/lib/auth/session';
import { EMPTY_DASHBOARD_SCHEMA } from '@/types';
import { logDashboardAction, AuditAction } from '@/lib/audit';
import { withRateLimit, dashboardRateLimiter } from '@/lib/rate-limiter';
import { z } from 'zod';

const WidgetPositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
});

const WidgetConfigSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().max(200),
  subtitle: z.string().max(500).optional(),
  position: WidgetPositionSchema,
  dataConfig: z.object({
    source: z.string().min(1),
    query: z.string().optional(),
    filters: z.array(z.record(z.string(), z.unknown())).optional(),
    aggregation: z.record(z.string(), z.unknown()).optional(),
    groupBy: z.array(z.string()).optional(),
    orderBy: z.array(z.record(z.string(), z.unknown())).optional(),
    limit: z.number().int().positive().optional(),
  }),
  visualConfig: z.record(z.string(), z.unknown()).optional(),
  glossaryTermIds: z.array(z.string()).optional(),
}).passthrough();

const DashboardSchemaValidator = z.object({
  layout: z.object({
    columns: z.number().int().min(1).max(24),
    rowHeight: z.number().int().min(20).max(500),
    gap: z.number().int().min(0).max(100),
  }),
  globalFilters: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  widgets: z.array(WidgetConfigSchema).max(100).optional().default([]),
}).passthrough();

const CreateDashboardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.union([z.array(z.string().max(50)).max(20), z.string().max(500)]).optional(),
  schema: DashboardSchemaValidator.optional(),
  isPublic: z.boolean().optional(),
});

// GET /api/dashboards — list dashboards accessible by the current user
export async function GET(request: NextRequest) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:list', async () => {
    try {
      const user = await getCurrentUser();
      const { searchParams } = new URL(request.url);
      const q = searchParams.get('q') || '';
      const sortBy = searchParams.get('sort') || 'updatedAt';
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const where = {
        archivedAt: null,
        OR: [
          { ownerId: user.id },
          { isPublic: true },
          { shares: { some: { userId: user.id } } },
        ],
        ...(q
          ? {
              AND: {
                OR: [
                  { title: { contains: q } },
                  { description: { contains: q } },
                  { tags: { contains: q } },
                ],
              },
            }
          : {}),
      };

      const [dashboards, total] = await Promise.all([
        prisma.dashboard.findMany({
          where,
          include: {
            owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            folder: { select: { id: true, name: true } },
            shares: {
              where: { userId: user.id },
              select: { id: true, permission: true, userId: true }
            },
            _count: { select: { versions: true, shares: true } },
          },
          orderBy: sortBy === 'title' ? { title: 'asc' } : { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.dashboard.count({ where }),
      ]);

      return NextResponse.json({ dashboards, total });
    } catch (error) {
      console.error('List dashboards error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

// POST /api/dashboards — create a new dashboard
export async function POST(request: NextRequest) {
  return withRateLimit(request, dashboardRateLimiter, 'dashboards:create', async () => {
    try {
      const user = await getCurrentUser();
      if (!canCreateDashboard(user)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const parseResult = CreateDashboardSchema.safeParse(body);
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return NextResponse.json(
          { error: `Validation error: ${firstError.path.join('.')}: ${firstError.message}` },
          { status: 400 }
        );
      }
      const { title, description, tags, schema, isPublic } = parseResult.data;

      const dashboardSchema = schema || EMPTY_DASHBOARD_SCHEMA;
      const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

      const dashboard = await prisma.dashboard.create({
        data: {
          title: title || 'Untitled Dashboard',
          description: description || null,
          tags: tagsStr,
          isPublic: isPublic || false,
          ownerId: user.id,
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              schema: JSON.stringify(dashboardSchema),
              changeNote: 'Initial version',
              createdBy: user.id,
            },
          },
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });

      // Log dashboard creation for audit
      await logDashboardAction(
        user.id,
        AuditAction.DASHBOARD_CREATE,
        dashboard.id,
        {
          title: dashboard.title,
          description: dashboard.description,
          isPublic: dashboard.isPublic,
          tags: dashboard.tags,
        }
      );

      return NextResponse.json({ dashboard }, { status: 201 });
    } catch (error) {
      console.error('Create dashboard error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
