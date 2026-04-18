import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';

// NOTE: PermissionGroup and DataAccessRule Prisma models are not yet in schema.prisma.
// These handlers return stubs until the schema migration is completed.
// See Asana task GID 1214125662501105 for the full RBAC implementation plan.

const STUB_MSG = 'Permission groups require schema migration. See Asana task for RBAC plan.';

async function checkPermission() {
  const user = await getCurrentUser();
  const canManage = await hasFeaturePermission(user, 'canManagePermissions');
  if (!canManage) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  return null;
}

// GET - List all permission groups (stub)
export async function GET(_request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;
  return NextResponse.json({ groups: [], _stub: STUB_MSG });
}

// POST - Create a new permission group (stub)
export async function POST(_request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;
  return NextResponse.json({ error: STUB_MSG }, { status: 501 });
}

// PUT - Update a permission group (stub)
export async function PUT(_request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;
  return NextResponse.json({ error: STUB_MSG }, { status: 501 });
}

// DELETE - Delete a permission group (stub)
export async function DELETE(_request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;
  return NextResponse.json({ error: STUB_MSG }, { status: 501 });
}