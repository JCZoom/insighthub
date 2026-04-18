import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id] — get dashboard with current version schema
export async function GET(_request: NextRequest, context: RouteContext) {
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
}

// PUT /api/dashboards/[id] — update metadata (title, description, tags, etc)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { title, description, tags, isPublic, isTemplate } = body as {
      title?: string;
      description?: string;
      tags?: string[] | string;
      isPublic?: boolean;
      isTemplate?: boolean;
    };
    const tagsStr = tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : undefined;

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

    const dashboard = await prisma.dashboard.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(tagsStr !== undefined && { tags: tagsStr }),
        ...(isPublic !== undefined && { isPublic }),
        ...(isTemplate !== undefined && { isTemplate }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ dashboard });
  } catch (error) {
    console.error('Update dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/dashboards/[id] — soft-delete (archive) a dashboard
export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
