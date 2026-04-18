import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canCreateDashboard } from '@/lib/auth/session';
import { EMPTY_DASHBOARD_SCHEMA } from '@/types';

// GET /api/dashboards — list dashboards accessible by the current user
export async function GET(request: NextRequest) {
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
}

// POST /api/dashboards — create a new dashboard
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canCreateDashboard(user)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, tags, schema, isPublic } = body as {
      title?: string;
      description?: string;
      tags?: string[] | string;
      schema?: unknown;
      isPublic?: boolean;
    };

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

    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    console.error('Create dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
