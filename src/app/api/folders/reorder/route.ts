import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

// PUT /api/folders/reorder
// Body: { orders: Array<{ id: string; sortOrder: number }> }
// Bulk-update sortOrder for one or more folders owned by the current user.
// All updates are wrapped in a single transaction so the sibling ordering
// stays consistent even if the request is interrupted halfway through.
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const ordersRaw = body?.orders;
    if (!Array.isArray(ordersRaw) || ordersRaw.length === 0) {
      return NextResponse.json({ error: 'orders must be a non-empty array' }, { status: 400 });
    }

    const orders = ordersRaw
      .filter(
        (o): o is { id: string; sortOrder: number } =>
          o && typeof o.id === 'string' && Number.isFinite(o?.sortOrder)
      )
      .map((o) => ({ id: o.id, sortOrder: Math.trunc(o.sortOrder) }));

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No valid order entries' }, { status: 400 });
    }

    // Verify every folder belongs to the user before writing anything
    const ids = orders.map((o) => o.id);
    const owned = await prisma.folder.findMany({
      where: { id: { in: ids }, ownerId: user.id },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return NextResponse.json({ error: 'One or more folders not found' }, { status: 404 });
    }

    await prisma.$transaction(
      orders.map((o) =>
        prisma.folder.update({
          where: { id: o.id },
          data: { sortOrder: o.sortOrder },
        })
      )
    );

    await createAuditLog({
      userId: user.id,
      action: AuditAction.FOLDER_REORDER,
      resourceType: ResourceType.FOLDER,
      resourceId: ids.join(','),
      metadata: { count: orders.length },
    });

    return NextResponse.json({ updated: orders.length });
  } catch (error) {
    console.error('Folder reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
