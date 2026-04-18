import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id]/versions — list all versions
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    // Verify access
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
      select: { id: true },
    });

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const versions = await prisma.dashboardVersion.findMany({
      where: { dashboardId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        changeNote: true,
        createdAt: true,
        createdBy: true,
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('List versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dashboards/[id]/versions — save a new version
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { schema, changeNote } = body as { schema: unknown; changeNote?: string };

    if (!schema) {
      return NextResponse.json({ error: 'Schema is required' }, { status: 400 });
    }

    // Verify edit access
    const dashboard = await prisma.dashboard.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { shares: { some: { userId: user.id, permission: 'EDIT' } } },
        ],
      },
    });

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found or insufficient permissions' }, { status: 404 });
    }

    const nextVersion = dashboard.currentVersion + 1;

    const [version] = await prisma.$transaction([
      prisma.dashboardVersion.create({
        data: {
          dashboardId: id,
          version: nextVersion,
          schema: JSON.stringify(schema),
          changeNote: changeNote || null,
          createdBy: user.id,
        },
      }),
      prisma.dashboard.update({
        where: { id },
        data: { currentVersion: nextVersion },
      }),
    ]);

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error('Save version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
